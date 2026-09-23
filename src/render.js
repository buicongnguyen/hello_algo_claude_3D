import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

// Quality is a rendering budget. It never changes gameplay, collision or timing.
export const QUALITY_PROFILES = Object.freeze({
  low: Object.freeze({ post: false, ao: false, shadows: false, softShadows: false, shadowMap: 0, pixelRatio: 1, samples: 0 }),
  medium: Object.freeze({ post: true, ao: false, shadows: true, softShadows: true, shadowMap: 1024, pixelRatio: 1.25, samples: 4 }),
  high: Object.freeze({ post: true, ao: true, shadows: true, softShadows: true, shadowMap: 2048, pixelRatio: 1.75, samples: 4 }),
});

export function resolveQuality(setting, width, software = false) {
  if (setting === "low" || setting === "high" || setting === "medium") return setting;
  // Software rasterizers (no GPU acceleration) cannot afford post-processing at interactive rates.
  if (software) return "low";
  return width < 760 ? "medium" : "high";
}

export function isSoftwareRenderer(renderer) {
  try {
    const gl = renderer.getContext();
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch { return false; }
}

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, vignette: { value: .32 }, saturation: { value: 1.06 }, lift: { value: .012 } },
  vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float vignette; uniform float saturation; uniform float lift;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      color.rgb = mix(vec3(luma), color.rgb, saturation) + lift * (1.0 - color.rgb);
      vec2 d = (vUv - 0.5) * vec2(1.1, 1.0);
      color.rgb *= mix(1.0, smoothstep(0.95, 0.28, length(d) * 1.2), vignette);
      gl_FragColor = color;
    }`,
};

export class RenderPipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.profile = QUALITY_PROFILES.low;
    this.level = "low";
    this.composer = null;
    this.width = 1;
    this.height = 1;
    this.bloomStrength = .32;
    // Scene cost (shadow map + main view) is tracked apart from the post-processing passes.
    this.sceneStats = { calls: 0, triangles: 0 };
    renderer.info.autoReset = false;
  }

  configure(level) {
    this.level = level;
    this.profile = QUALITY_PROFILES[level] || QUALITY_PROFILES.low;
    this.disposeComposer();
    if (!this.profile.post || !this.renderer.capabilities.isWebGL2) return;
    // EffectComposer treats a supplied target's size as CSS pixels; setSize() below applies the pixel ratio.
    const size = this.renderer.getSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: this.profile.samples });
    const composer = new EffectComposer(this.renderer, target);
    const scenePass = new RenderPass(this.scene, this.camera);
    const renderScene = scenePass.render.bind(scenePass);
    scenePass.render = (...args) => { renderScene(...args); this.recordScene(); };
    composer.addPass(scenePass);
    if (this.profile.ao) {
      const ao = new GTAOPass(this.scene, this.camera, Math.max(1, size.x >> 1), Math.max(1, size.y >> 1));
      ao.updateGtaoMaterial({ radius: .55, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 12 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      ao.blendIntensity = .85;
      // Labels, markers, beams and the sky do not occlude anything.
      const hide = ao._overrideVisibility.bind(ao);
      ao._overrideVisibility = () => {
        hide();
        this.scene.traverse(object => {
          if (!object.visible) return;
          const material = object.material;
          if (object.isSprite || object.userData.sky || material && !Array.isArray(material) && (material.transparent || !material.depthWrite)) {
            object.visible = false;
            ao._visibilityCache.push(object);
          }
        });
      };
      // Half-resolution AO keeps cost bounded on high-DPI displays.
      ao.setSize = (width, height) => GTAOPass.prototype.setSize.call(ao, Math.max(1, width >> 1), Math.max(1, height >> 1));
      composer.addPass(ao);
      this.ao = ao;
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), this.bloomStrength, .55, .82);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    composer.addPass(this.grade);
    this.composer = composer;
    this.setSize(size.x, size.y);
  }

  setBloom(strength) {
    this.bloomStrength = strength;
    if (this.bloom) this.bloom.strength = strength;
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;
    if (!this.composer) return;
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
  }

  recordScene() {
    this.sceneStats.calls = this.renderer.info.render.calls;
    this.sceneStats.triangles = this.renderer.info.render.triangles;
  }

  render() {
    this.renderer.info.reset();
    if (this.composer) this.composer.render();
    else { this.renderer.render(this.scene, this.camera); this.recordScene(); }
  }

  disposeComposer() {
    if (!this.composer) return;
    for (const pass of this.composer.passes) pass.dispose?.();
    this.composer.renderTarget1.dispose();
    this.composer.renderTarget2.dispose();
    this.composer = this.bloom = this.ao = this.grade = null;
  }
}
