import * as THREE from "three";

// Pooled, allocation-free particle bursts. One draw call; additive, so bloom gives them a soft core.
const vertexShader = /* glsl */`
  attribute float size;
  attribute vec3 color;
  uniform float scale;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * scale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
    vColor = color;
  }`;
const fragmentShader = /* glsl */`
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * alpha, alpha);
  }`;

export class Particles {
  constructor(max = 640) {
    this.max = max;
    this.cursor = 0;
    this.position = new Float32Array(max * 3);
    this.color = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.velocity = new Float32Array(max * 3);
    this.tint = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.span = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.position, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("size", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({ uniforms: { scale: { value: 400 } }, vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = "Feedback particles";
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    this.alive = 0;
  }

  emit(x, y, z, { count = 12, color = 0xffffff, speed = 3, up = 1.5, life = .55, size = .22, gravity = -4, drag = 2.5, spread = .2 } = {}) {
    const tint = new THREE.Color(color);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const a = Math.random() * Math.PI * 2, e = Math.random() * 2 - 1, s = speed * (.35 + Math.random() * .65);
      const horizontal = Math.sqrt(1 - e * e);
      this.position.set([x + (Math.random() - .5) * spread, y + (Math.random() - .5) * spread, z + (Math.random() - .5) * spread], i * 3);
      this.velocity.set([Math.cos(a) * horizontal * s, Math.abs(e) * s * .6 + up * (.5 + Math.random() * .5), Math.sin(a) * horizontal * s], i * 3);
      this.tint.set([tint.r, tint.g, tint.b], i * 3);
      this.life[i] = this.span[i] = life * (.7 + Math.random() * .6);
      this.baseSize[i] = size * (.7 + Math.random() * .6);
      this.gravity[i] = gravity;
      this.drag[i] = drag;
    }
    this.alive = this.max;
  }

  update(dt) {
    if (!this.alive) return;
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { if (this.size[i]) this.size[i] = 0; continue; }
      this.life[i] = Math.max(0, this.life[i] - dt);
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      alive++;
      const k = i * 3, damping = Math.exp(-this.drag[i] * dt);
      this.velocity[k] *= damping; this.velocity[k + 2] *= damping;
      this.velocity[k + 1] = this.velocity[k + 1] * damping + this.gravity[i] * dt;
      this.position[k] += this.velocity[k] * dt;
      this.position[k + 1] += this.velocity[k + 1] * dt;
      this.position[k + 2] += this.velocity[k + 2] * dt;
      const t = this.life[i] / this.span[i];
      this.size[i] = this.baseSize[i] * (.35 + .65 * t);
      const fade = Math.min(1, t * 1.6);
      this.color[k] = this.tint[k] * fade; this.color[k + 1] = this.tint[k + 1] * fade; this.color[k + 2] = this.tint[k + 2] * fade;
    }
    this.alive = alive;
    for (const name of ["position", "color", "size"]) this.geometry.attributes[name].needsUpdate = true;
  }

  clear() {
    this.life.fill(0); this.size.fill(0); this.alive = 0;
    this.geometry.attributes.size.needsUpdate = true;
  }
}

// Trauma-based shake: amplitude grows with the square of trauma, and trauma decays over time.
export class Shake {
  constructor() { this.trauma = 0; this.time = 0; this.offset = new THREE.Vector3(); }
  add(amount) { this.trauma = Math.min(1, this.trauma + amount); }
  update(dt, reducedMotion) {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    const power = reducedMotion ? 0 : this.trauma * this.trauma * .45;
    const t = this.time * 38;
    this.offset.set(Math.sin(t * 1.1) * power, Math.sin(t * 1.7 + 1.3) * power * .7, Math.sin(t * .9 + 2.1) * power);
    return this.offset;
  }
}

const WHITE = new THREE.Color(0xffffff);

// Remember an actor's own emissive response so hit flashes and tints can always return to it.
export function rememberEmissive(object) {
  object.traverse(child => {
    const material = child.isMesh && child.material;
    if (!material?.emissive) return;
    child.userData.baseEmissive = material.emissive.clone();
    child.userData.baseEmissiveIntensity = material.emissiveIntensity;
  });
}

export function flashActor(object, amount) {
  object.traverse(child => {
    const material = child.isMesh && child.material;
    if (!material?.emissive || !child.userData.baseEmissive) return;
    material.emissive.copy(child.userData.baseEmissive).lerp(WHITE, Math.min(1, amount));
    material.emissiveIntensity = child.userData.baseEmissiveIntensity + amount * 2.2;
  });
}

export function turnToward(current, target, rate) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * Math.min(1, rate);
}
