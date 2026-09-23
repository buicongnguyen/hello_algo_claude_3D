import * as THREE from "three";
import { sunDirection } from "./atmosphere.js";

// One gradient dome follows the camera. It also seeds a matching prefiltered environment map,
// so reflections on robots and water agree with the visible sky of every destination.
const vertexShader = /* glsl */`
  varying vec3 vDirection;
  void main() {
    vDirection = normalize((modelMatrix * vec4(position, 0.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform vec3 ground;
  uniform vec3 sunColor;
  uniform vec3 sunDirection;
  uniform float sunSize;
  uniform float stars;
  uniform float flash;
  varying vec3 vDirection;
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  void main() {
    vec3 direction = normalize(vDirection);
    float h = direction.y;
    vec3 color = h >= 0.0
      ? mix(horizon, zenith, pow(smoothstep(0.0, 1.0, h), 0.62))
      : mix(horizon, ground, smoothstep(0.0, 0.28, -h));
    float facing = max(dot(direction, sunDirection), 0.0);
    color += sunColor * (pow(facing, 1400.0 / sunSize) * 18.0 + pow(facing, 24.0) * 0.28 + pow(facing, 4.0) * 0.12);
    if (stars > 0.0 && h > -0.05) {
      vec3 cell = floor(direction * 420.0);
      float star = step(0.9975, hash(cell));
      float twinkle = 0.55 + 0.45 * hash(cell + 7.0);
      color += vec3(star * twinkle * stars * smoothstep(-0.05, 0.25, h));
    }
    color += vec3(0.55, 0.62, 1.0) * flash;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class SkyDome {
  constructor(renderer) {
    this.renderer = renderer;
    this.uniforms = {
      zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, ground: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() }, sunDirection: { value: new THREE.Vector3(0, 1, 0) },
      sunSize: { value: 1 }, stars: { value: 0 }, flash: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
    this.geometry = new THREE.SphereGeometry(1, 48, 24);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = "Sky dome";
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.scale.setScalar(120);
    this.mesh.userData.sky = true;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.environmentScene = new THREE.Scene();
    this.environmentMesh = new THREE.Mesh(this.geometry, this.material);
    this.environmentMesh.scale.setScalar(50);
    this.environmentScene.add(this.environmentMesh);
    this.target = null;
  }

  apply(atmosphere) {
    const u = this.uniforms;
    u.zenith.value.setHex(atmosphere.zenith);
    u.horizon.value.setHex(atmosphere.horizon);
    u.ground.value.setHex(atmosphere.ground);
    u.sunColor.value.setHex(atmosphere.sunColor);
    const sun = sunDirection(atmosphere);
    u.sunDirection.value.set(sun.x, sun.y, sun.z);
    u.sunSize.value = atmosphere.sunSize;
    u.stars.value = atmosphere.stars;
    u.flash.value = 0;
    // Stars and the sun disc are too sharp for rough reflections; bake a softened copy.
    u.stars.value = 0;
    const previous = this.target;
    this.target = this.pmrem.fromScene(this.environmentScene, 0.04, 0.1, 100);
    u.stars.value = atmosphere.stars;
    previous?.dispose();
    return this.target.texture;
  }

  follow(camera) { this.mesh.position.copy(camera.position); }
}
