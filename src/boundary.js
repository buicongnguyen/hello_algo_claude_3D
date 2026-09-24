import * as THREE from "three";
import { PLAY_RADIUS } from "./presentation.js";

// A readable play-space edge: a faint dashed ground ring is always visible, and a holographic fence
// lights up only near KAI, growing stronger as KAI presses against it. Neither blocks the view.
const vertexShader = /* glsl */`
  varying vec3 vWorld;
  varying float vHeight;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vHeight = uv.y;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;

const fenceFragment = /* glsl */`
  uniform vec3 color;
  uniform vec2 player;
  uniform float proximity;
  uniform float time;
  varying vec3 vWorld;
  varying float vHeight;
  void main() {
    float near = 1.0 - smoothstep(1.2, 7.5, distance(vWorld.xz, player));
    float angle = atan(vWorld.z, vWorld.x);
    float column = abs(fract(angle * 160.0 / 6.28318) - 0.5);
    float grid = max(smoothstep(0.42, 0.5, column), smoothstep(0.44, 0.5, abs(fract(vHeight * 7.0 - time * 0.35) - 0.5)));
    float fade = (1.0 - vHeight) * smoothstep(0.0, 0.06, vHeight);
    float alpha = near * proximity * fade * (0.18 + 0.82 * grid);
    gl_FragColor = vec4(color * alpha * 1.6, alpha);
  }`;

const ringFragment = /* glsl */`
  uniform vec3 color;
  uniform vec2 player;
  uniform float proximity;
  uniform float time;
  varying vec3 vWorld;
  void main() {
    float angle = atan(vWorld.z, vWorld.x);
    float dash = step(0.45, fract(angle * 120.0 / 6.28318 - time * 0.08));
    float near = 1.0 - smoothstep(1.0, 9.0, distance(vWorld.xz, player));
    float alpha = dash * (0.3 + near * proximity * 0.6);
    gl_FragColor = vec4(color * alpha * 1.4, alpha);
  }`;

export class Boundary {
  constructor(radius = PLAY_RADIUS) {
    this.radius = radius;
    this.uniforms = { color: { value: new THREE.Color(0x9fd8ff) }, player: { value: new THREE.Vector2(0, 999) }, proximity: { value: 0 }, time: { value: 0 } };
    const material = fragmentShader => new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.group = new THREE.Group();
    this.group.name = "Play boundary";
    this.fence = new THREE.Mesh(new THREE.CylinderGeometry(radius + .35, radius + .35, 2.4, 160, 1, true), material(fenceFragment));
    this.fence.position.y = 1.62;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(radius + .2, radius + .5, 160, 1), material(ringFragment));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = .47;
    for (const mesh of [this.fence, this.ring]) { mesh.frustumCulled = false; mesh.renderOrder = 3; this.group.add(mesh); }
    this.group.visible = false;
  }

  setColor(hex) { this.uniforms.color.value.setHex(hex); }

  update(dt, focus, reducedMotion = false) {
    this.group.visible = Boolean(focus);
    if (!focus) return;
    if (!reducedMotion) this.uniforms.time.value += dt;
    this.uniforms.player.value.set(focus.x, focus.z);
    const edge = Math.hypot(focus.x, focus.z);
    const target = THREE.MathUtils.smoothstep(edge, this.radius - 5, this.radius - .15);
    this.uniforms.proximity.value += (target - this.uniforms.proximity.value) * Math.min(1, dt * 8);
  }

  dispose() {
    for (const mesh of [this.fence, this.ring]) { mesh.geometry.dispose(); mesh.material.dispose(); }
  }
}
