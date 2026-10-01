// Ambient life: schools of fish, flocks of birds, butterflies, jellyfish, drifting motes and
// swaying plants, drawn the "lightweight-game-objects" way. Every kind of creature is ONE
// InstancedMesh of a tiny procedural mesh (12–40 triangles); its swim, flap or pulse runs in the
// vertex shader. The CPU only steers (a few dozen multiplies per creature, no allocation) and
// sleeps while a swarm is off screen. Motes and plant sway are GPU-only: one uniform per frame.
// Cosmetic randomness comes from a seeded RNG of its own, so gameplay randomness never shifts.
import * as THREE from "three";

const TAU = Math.PI * 2;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The signed angle from a to b, the short way round (never a 270° spin).
export const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// ---- geometry: one unit long, nose toward +z, flat-shaded toy facets ---------------------------
// aBend: how far the motion moves a vertex (0 = rigid). aPaint: 0 body colour → 1 accent colour.
// aShade: baked brightness (darker back, lighter belly) so tiny unlit-looking shapes still read round.

function builder() {
  const pos = [], bend = [], paint = [], shade = [];
  const tri = (a, b, c, p = 0, s = 1) => {
    for (const v of [a, b, c]) { pos.push(v[0], v[1], v[2]); bend.push(v[3] ?? 0); paint.push(p); shade.push(s); }
  };
  const quad = (a, b, c, d, p, s) => { tri(a, b, c, p, s); tri(a, c, d, p, s); };
  const done = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aBend", new THREE.Float32BufferAttribute(bend, 1));
    g.setAttribute("aPaint", new THREE.Float32BufferAttribute(paint, 1));
    g.setAttribute("aShade", new THREE.Float32BufferAttribute(shade, 1));
    g.computeVertexNormals();
    return g;
  };
  return { tri, quad, done };
}

// A fish: diamond-section body loft, forked tail and a dorsal fin (36 triangles).
// `deep` makes tall reef fish (tangs, butterflyfish), `slim` long fast ones (sardines).
export function fishGeometry({ deep = 1, slim = 1, saddle = true } = {}) {
  const b = builder();
  const S = [[0, 0, 0], [.14, .15 * slim, .12 * deep], [.38, .19 * slim, .15 * deep], [.66, .1 * slim, .09 * deep], [.82, .035, .035]];
  const ring = ([t, w, h]) => [[w, 0, .5 - t, t], [0, h, .5 - t, t], [-w, 0, .5 - t, t], [0, -h, .5 - t, t]];
  const rings = S.map(ring);
  for (let i = 0; i < rings.length - 1; i++) {
    const near = rings[i], far = rings[i + 1];
    for (let k = 0; k < 4; k++) {
      const a0 = near[k], b0 = near[(k + 1) % 4], a1 = far[k], b1 = far[(k + 1) % 4];
      const back = k < 2, accent = saddle && back && i === 1;
      const s = back ? (k === 0 ? .86 : .78) : 1.12;
      if (i > 0) b.tri(a0, a1, b0, accent ? 1 : 0, s);
      b.tri(b0, a1, b1, accent ? 1 : 0, s);
    }
  }
  const [r, top, l, bottom] = rings[rings.length - 1];
  b.tri(r, bottom, l, 0, .9); b.tri(l, top, r, 0, .9);
  const root = [0, 0, -.3, .82], notch = [0, .01, -.42, .92], right = [0, .2 * deep, -.56, 1], left = [0, -.2 * deep, -.56, 1];
  // The tail stands upright like a real fish; seen from the high camera it reads as a flick.
  b.tri(root, right, notch, 1, 1); b.tri(root, notch, right, 1, .85);
  b.tri(root, notch, left, 1, 1); b.tri(root, left, notch, 1, .85);
  // Dorsal fin: one upright triangle on the back, both faces.
  const f0 = [0, .14 * deep, .16, .24], f1 = [0, .3 * deep, -.02, .4], f2 = [0, .12 * deep, -.16, .5];
  b.tri(f0, f1, f2, 1, .95); b.tri(f0, f2, f1, 1, .8);
  return b.done();
}

// A gull, swallow or goose: a slim body, two-segment wings (the outer part flaps more) and a tail.
// Wings are along ±x; aBend = how far out on the wing (0 body, .45 elbow, 1 tip). 24 triangles.
export function birdGeometry({ span = 1, body = 1 } = {}) {
  const b = builder();
  const n = [0, 0, .42 * body], t = [0, 0, -.38 * body], up = [0, .07, .05], dn = [0, -.06, .02];
  const sl = [-.08, 0, .04], sr = [.08, 0, .04];
  // Body: a double pyramid, back darker than belly.
  b.tri(n, sr, up, 0, .82); b.tri(n, up, sl, 0, .82); b.tri(t, up, sr, 0, .78); b.tri(t, sl, up, 0, .78);
  b.tri(n, dn, sr, 0, 1.12); b.tri(n, sl, dn, 0, 1.12); b.tri(t, sr, dn, 0, 1.08); b.tri(t, dn, sl, 0, 1.08);
  for (const side of [1, -1]) {
    const root0 = [.06 * side, .01, .14, 0], root1 = [.06 * side, .01, -.12, 0];
    const elbow0 = [.32 * span * side, .02, .1, .45], elbow1 = [.32 * span * side, .02, -.12, .45];
    const tip = [.62 * span * side, .0, -.18, 1];
    const front = side > 0 ? [root0, elbow0, elbow1, root1] : [root0, root1, elbow1, elbow0];
    b.quad(...front, 0, 1); b.quad(...[...front].reverse(), 0, .9);
    const outer = side > 0 ? [elbow0, tip, elbow1] : [elbow0, elbow1, tip];
    b.tri(...outer, 1, 1); b.tri(outer[0], outer[2], outer[1], 1, .9);
  }
  const tl = [-.07, 0, -.5 * body], tr = [.07, 0, -.5 * body], tb = [0, 0, -.3 * body];
  b.tri(tb, tr, tl, 1, 1); b.tri(tb, tl, tr, 1, .9);
  return b.done();
}

// A butterfly: fore and hind wings hinged on the body (aBend 1 on every wing vertex). 12 triangles.
export function butterflyGeometry() {
  const b = builder();
  for (const side of [1, -1]) {
    const h0 = [.02 * side, 0, .12, .2], h1 = [.02 * side, 0, -.06, .2];
    const fore = [.5 * side, 0, .3, 1], foreTip = [.42 * side, 0, -.02, 1];
    const hind = [.34 * side, 0, -.3, 1];
    const a = side > 0 ? [h0, fore, foreTip] : [h0, foreTip, fore];
    b.tri(...a, 1, 1); b.tri(a[0], a[2], a[1], 1, .8);
    const c = side > 0 ? [h1, foreTip, hind] : [h1, hind, foreTip];
    b.tri(...c, 0, 1); b.tri(c[0], c[2], c[1], 0, .8);
  }
  const head = [0, .02, .2], tail = [0, .02, -.24], l = [-.025, .02, 0], r = [.025, .02, 0];
  b.tri(head, r, tail, 0, .45); b.tri(head, tail, l, 0, .45);
  return b.done();
}

// A jellyfish: a six-sided bell (top dark, rim bright) and four trailing tentacle ribbons.
// aBend: 0 at the crown → .3 at the rim → 1 at the tentacle tips. 36 triangles.
export function jellyGeometry() {
  const b = builder();
  const ring = (r, y, k) => Array.from({ length: 6 }, (_, i) => [Math.cos(i / 6 * TAU) * r, y, Math.sin(i / 6 * TAU) * r, k]);
  const crown = [0, .32, 0, 0], mid = ring(.3, .2, .15), rim = ring(.42, 0, .3);
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    b.tri(crown, mid[j], mid[i], 0, 1.05);
    b.quad(mid[i], mid[j], rim[j], rim[i], 1, 1);
  }
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + .4, x = Math.cos(a) * .2, z = Math.sin(a) * .2, w = .05;
    let prev = [[x - w, 0, z, .3], [x + w, 0, z, .3]];
    for (let s = 1; s <= 3; s++) {
      const y = -s * .28, k = .3 + s * .233;
      const next = [[x - w * (1 - s * .25), y, z, k], [x + w * (1 - s * .25), y, z, k]];
      b.quad(prev[0], prev[1], next[1], next[0], 1, .9); b.quad(prev[0], next[0], next[1], prev[1], 1, .9);
      prev = next;
    }
  }
  return b.done();
}

// ---- material: a built-in Lambert (so fog, tone mapping and lights stay right) plus motion ----
const MOTION = {
  // A wave travels from head to tail; the head barely moves, the tail swings most.
  swim: "transformed.x += sin(aMotion.x - aBend * 3.2) * aMotion.y * aBend * aBend;",
  // Wings rotate about the body axis; the outer segment adds a little lag for a soft curve.
  flap: `{ float side = sign(transformed.x); float ax = abs(transformed.x);
    float th = (sin(aMotion.x) + .35) * aMotion.y * aBend + sin(aMotion.x - .9) * aMotion.y * .45 * max(aBend - .45, 0.);
    transformed.x = side * ax * cos(th); transformed.y += ax * sin(th); }`,
  // Butterflies hold their wings in a V and clap them quickly.
  flutter: `{ float side = sign(transformed.x); float ax = abs(transformed.x);
    float th = (.55 + sin(aMotion.x) * .5) * aMotion.y * aBend * 2.;
    transformed.x = side * ax * cos(th); transformed.y += ax * sin(th); }`,
  // The bell contracts and relaxes; tentacles trail the beat.
  pulse: `{ float bell = 1. - smoothstep(.15, .35, aBend);
    transformed.xz *= 1. - sin(aMotion.x) * aMotion.y * bell * .5;
    transformed.x += sin(aMotion.x - aBend * 4.) * aMotion.y * .3 * aBend; }`,
};

export function creatureMaterial(motion, { glow = 0, water = null } = {}) {
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const uniforms = { uGlow: { value: glow }, uWater: { value: new THREE.Color(water?.color ?? 0) }, uWaterMix: { value: water?.mix ?? 0 } };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
attribute float aBend; attribute float aPaint; attribute float aShade;
attribute vec2 aMotion; attribute vec3 aBody; attribute vec3 aAccent;
varying vec3 vPaint; varying float vAccent;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
${MOTION[motion]}
vPaint = mix(aBody, aAccent, aPaint) * aShade; vAccent = aPaint;`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
uniform float uGlow; uniform vec3 uWater; uniform float uWaterMix; varying vec3 vPaint; varying float vAccent;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb * vPaint, uWater, uWaterMix);`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
totalEmissiveRadiance += vPaint * vAccent * uGlow;`);
  };
  // Without a key per motion, three would reuse another creature's compiled program.
  material.customProgramCacheKey = () => `life-creature:${motion}`;
  material.userData.uniforms = uniforms;
  return material;
}

// ---- swarm: steering on the CPU, one draw call per kind -------------------------------------
// area: an ellipse {x, z, rx, rz} with a height band [y0, y1].
export class Swarm {
  constructor({
    name = "life", geometry, motion = "swim", count = 20, schools = 4, area, length = .6, lengthJitter = .2,
    speed = [.6, 1.2], fleeSpeed = 3.2, turnRate = 2.4, climbRate = 1.2, maxPitch = .35, bank = 0,
    beat = 1.2, beatPerSpeed = .9, amplitude = .09, fleeAmplitude = .17, glide = 0, scare = 2.6,
    colors = [[0xff8a2a, 0xffffff]], glow = 0, water = null, seed = 1, formation = "school",
  }) {
    Object.assign(this, { name, count, area, speed, fleeSpeed, turnRate, climbRate, maxPitch, bank, beat, beatPerSpeed,
      amplitude, fleeAmplitude, glide, scare, time: 0, budget: 1, quiet: false, asleep: false });
    const rng = this.rng = mulberry32(seed);
    const between = (a, b) => a + rng() * (b - a);
    const F = () => new Float32Array(count);
    Object.assign(this, { x: F(), y: F(), z: F(), h: F(), p: F(), r: F(), v: F(), cruise: F(), gx: F(), gy: F(), gz: F(), gt: F(),
      flee: F(), fh: F(), phase: F(), amp: F(), size: F(), ox: F(), oy: F(), oz: F(), leader: new Int32Array(count) });
    this.motion = new Float32Array(count * 2);
    const body = new Float32Array(count * 3), accent = new Float32Array(count * 3), color = new THREE.Color();
    const group = Math.max(1, Math.ceil(count / Math.max(1, schools)));
    for (let i = 0; i < count; i++) {
      const lead = Math.floor(i / group) * group, slot = i - lead, pair = colors[Math.floor(lead / group) % colors.length];
      this.leader[i] = lead;
      if (formation === "vee") {
        // Geese: alternating sides, each one further back along the V.
        const rank = Math.ceil(slot / 2);
        this.ox[i] = slot ? (slot % 2 ? 1 : -1) * rank * .9 * length : 0;
        this.oz[i] = -rank * .75 * length; this.oy[i] = 0;
      } else {
        this.ox[i] = slot ? (slot % 2 ? 1 : -1) * between(.35, .9) * length : 0;
        this.oz[i] = slot ? -(.45 + .5 * Math.ceil(slot / 2)) * length * between(.8, 1.2) : 0;
        this.oy[i] = slot ? between(-.5, .5) * length : 0;
      }
      this.size[i] = length * between(1 - lengthJitter, 1 + lengthJitter);
      this.cruise[i] = between(speed[0], speed[1]);
      this.phase[i] = rng() * TAU;
      this.amp[i] = amplitude;
      this.h[i] = rng() * TAU;
      // Slight per-creature brightness, so a school reads as individuals.
      const jitter = between(.9, 1.1);
      color.set(pair[0]).multiplyScalar(jitter).toArray(body, i * 3);
      color.set(pair[1]).multiplyScalar(jitter).toArray(accent, i * 3);
      const p = lead === i ? this.randomPoint(.7) : null;
      this.x[i] = p ? p.x : this.x[lead] + this.ox[i];
      this.y[i] = p ? p.y : this.y[lead] + this.oy[i];
      this.z[i] = p ? p.z : this.z[lead] + this.oz[i];
      this.gt[i] = 0;
    }
    const g = geometry;
    this.motionAttribute = new THREE.InstancedBufferAttribute(this.motion, 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aMotion", this.motionAttribute);
    g.setAttribute("aBody", new THREE.InstancedBufferAttribute(body, 3));
    g.setAttribute("aAccent", new THREE.InstancedBufferAttribute(accent, 3));
    this.material = creatureMaterial(motion, { glow, water });
    this.mesh = new THREE.InstancedMesh(g, this.material, count);
    this.mesh.name = `life:${name}`;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = this.mesh.receiveShadow = false;
    // The swarm never leaves its area, so one fixed sphere culls (and sleeps) the whole flock.
    const reach = Math.max(area.rx, area.rz, (area.y1 - area.y0) / 2) + length * 2;
    this.mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(area.x, (area.y0 + area.y1) / 2, area.z), reach);
    this.write(count);
  }

  randomPoint(margin = .85) {
    const { area, rng } = this, a = rng() * TAU, r = Math.sqrt(rng()) * margin;
    return { x: area.x + Math.cos(a) * area.rx * r, y: area.y0 + (area.y1 - area.y0) * (.15 + rng() * .7), z: area.z + Math.sin(a) * area.rz * r };
  }

  inside(px, pz) { const u = (px - this.area.x) / this.area.rx, v = (pz - this.area.z) / this.area.rz; return u * u + v * v <= 1; }

  setBudget(fraction) { this.budget = fraction; this.mesh.count = Math.max(0, Math.min(this.count, Math.round(this.count * fraction))); }

  // Startle creatures near (x, y, z): a dart away, then back to cruising.
  startle(i, awayX, awayZ) {
    this.flee[i] = .8 + this.rng() * .6;
    this.fh[i] = Math.atan2(awayX, awayZ) + (this.rng() - .5) * .6;
  }

  // ctx: {frustum, threat: {x, y, z} (KAI), eye: camera position, quiet}
  update(dt, ctx = {}) {
    dt = Math.min(dt, .05); // after a stall (tab switch, GC): a step, never a teleport
    this.time += dt;
    this.asleep = Boolean(ctx.frustum && !ctx.frustum.intersectsObject(this.mesh));
    if (this.asleep || this.mesh.count === 0) return;
    this.quiet = Boolean(ctx.quiet);
    const n = this.mesh.count, { x, y, z, h, p, v, area } = this, threat = ctx.threat, eye = ctx.eye;
    const ease = 1 - Math.exp(-3 * dt), easeAmp = 1 - Math.exp(-6 * dt), scare2 = this.scare * this.scare;
    // The camera's line to KAI: creatures crossing it part, so the hero is never hidden.
    let lx = 0, ly = 0, lz = 0, ll = 0;
    if (eye && threat) { lx = threat.x - eye.x; ly = (threat.y ?? 1) - eye.y; lz = threat.z - eye.z; ll = lx * lx + ly * ly + lz * lz; }
    for (let i = 0; i < n; i++) {
      const lead = this.leader[i];
      if (!this.quiet && this.flee[i] <= 0 && threat) {
        const dx = x[i] - threat.x, dy = y[i] - (threat.y ?? 1), dz = z[i] - threat.z;
        if (dx * dx + dy * dy + dz * dz < scare2) this.startle(i, dx, dz);
        else if (ll > 0) {
          const t = Math.max(0, Math.min(1, ((x[i] - eye.x) * lx + (y[i] - eye.y) * ly + (z[i] - eye.z) * lz) / ll));
          if (t > .1 && t < .92) {
            const cx = x[i] - eye.x - lx * t, cy = y[i] - eye.y - ly * t, cz = z[i] - eye.z - lz * t;
            if (cx * cx + cy * cy + cz * cz < 1.4) this.startle(i, cx || .1, cz || .1);
          }
        }
      }
      const fleeing = this.flee[i] > 0;
      let tx, ty, tz, want;
      if (fleeing) {
        this.flee[i] -= dt;
        tx = x[i] + Math.sin(this.fh[i]) * 4; tz = z[i] + Math.cos(this.fh[i]) * 4; ty = y[i] + .6;
        want = this.fleeSpeed;
      } else if (lead !== i && this.flee[lead] <= 0 && lead < n) {
        // Follower: its slot behind the leader, in the leader's frame.
        const c = Math.cos(h[lead]), s = Math.sin(h[lead]);
        tx = x[lead] + this.ox[i] * c + this.oz[i] * s;
        tz = z[lead] - this.ox[i] * s + this.oz[i] * c;
        ty = y[lead] + this.oy[i];
        want = Math.min(this.fleeSpeed, v[lead] * .9 + Math.hypot(tx - x[i], tz - z[i]) * 1.6);
      } else {
        this.gt[i] -= dt;
        if (this.gt[i] <= 0 || Math.hypot(this.gx[i] - x[i], this.gz[i] - z[i]) < .5) {
          const g = this.randomPoint();
          this.gx[i] = g.x; this.gy[i] = g.y; this.gz[i] = g.z; this.gt[i] = 4 + this.rng() * 5;
        }
        tx = this.gx[i]; ty = this.gy[i]; tz = this.gz[i];
        want = this.cruise[i] * (this.quiet ? .6 : 1);
      }
      // Turn the short way at a capped rate (arcs, never snaps); bank into the turn.
      const turn = this.turnRate * (fleeing ? 2 : 1) * dt;
      let d = 0;
      if (Math.abs(tx - x[i]) + Math.abs(tz - z[i]) > 1e-4) { d = angleDelta(h[i], Math.atan2(tx - x[i], tz - z[i])); h[i] += Math.max(-turn, Math.min(turn, d)); }
      this.r[i] += (Math.max(-.7, Math.min(.7, -d * this.bank)) - this.r[i]) * ease;
      const flat = Math.hypot(tx - x[i], tz - z[i]) || 1, pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, Math.atan2(ty - y[i], flat)));
      p[i] += (pitch - p[i]) * Math.min(1, this.climbRate * dt);
      v[i] += (want - v[i]) * ease;
      const cp = Math.cos(p[i]), step = v[i] * dt;
      const nx = x[i] + Math.sin(h[i]) * cp * step, nz = z[i] + Math.cos(h[i]) * cp * step;
      y[i] = Math.max(area.y0, Math.min(area.y1, y[i] + Math.sin(p[i]) * step));
      if (this.inside(nx, nz)) { x[i] = nx; z[i] = nz; }
      else {
        // At the edge: hold this step and turn back toward the middle.
        const back = angleDelta(h[i], Math.atan2(area.x - x[i], area.z - z[i]));
        h[i] += Math.max(-turn * 2, Math.min(turn * 2, back));
        if (lead === i) this.gt[i] = 0;
      }
      h[i] = Math.atan2(Math.sin(h[i]), Math.cos(h[i]));
      // Accumulate the phase, so a change of beat (calm → flee) never jumps.
      const gliding = this.glide > 0 && !fleeing && p[i] < -.04;
      this.phase[i] = (this.phase[i] + dt * (this.beat + v[i] * this.beatPerSpeed) * (this.quiet ? .6 : 1) * (gliding ? .25 : 1) * TAU) % TAU;
      const target = fleeing ? this.fleeAmplitude : gliding ? this.amplitude * this.glide : this.amplitude;
      this.amp[i] += (target - this.amp[i]) * easeAmp;
    }
    this.write(n);
  }

  // Yaw, pitch and roll (YXZ, like three's Euler) and uniform scale, straight into the instance buffer.
  write(n = this.count) {
    const m = this.mesh.instanceMatrix.array, { x, y, z, h, p, r } = this;
    for (let i = 0; i < n; i++) {
      const s = this.size[i], ax = -p[i], a = Math.cos(ax), b = Math.sin(ax), c = Math.cos(h[i]), d = Math.sin(h[i]), e = Math.cos(r[i]), f = Math.sin(r[i]);
      const ce = c * e, cf = c * f, de = d * e, df = d * f, o = i * 16;
      m[o] = (ce + df * b) * s; m[o + 1] = a * f * s; m[o + 2] = (cf * b - de) * s; m[o + 3] = 0;
      m[o + 4] = (de * b - cf) * s; m[o + 5] = a * e * s; m[o + 6] = (df + ce * b) * s; m[o + 7] = 0;
      m[o + 8] = a * d * s; m[o + 9] = -b * s; m[o + 10] = a * c * s; m[o + 11] = 0;
      m[o + 12] = x[i]; m[o + 13] = y[i]; m[o + 14] = z[i]; m[o + 15] = 1;
      this.motion[i * 2] = this.phase[i]; this.motion[i * 2 + 1] = this.amp[i];
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.motionAttribute.needsUpdate = true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

// ---- motes: drifting specks with zero CPU cost (plankton, fireflies, pollen, bubbles, rain) ----
let dotTexture = null;
function dot() {
  if (dotTexture) return dotTexture;
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const d = Math.hypot(i + .5 - size / 2, j + .5 - size / 2) / (size / 2), a = Math.max(0, 1 - d) ** 1.6;
    data.set([255, 255, 255, Math.round(a * 255)], (j * size + i) * 4);
  }
  dotTexture = new THREE.DataTexture(data, size, size);
  dotTexture.needsUpdate = true;
  return dotTexture;
}

// box: {x, z, rx, rz, y0, y1}. kind: "drift" (wander in place), "rise" (bubbles), "fall"
// (petals, confetti, rain). Positions are a pure function of time and a per-mote seed.
export class Motes {
  constructor({ name = "motes", count = 80, box, kind = "drift", speed = .3, wobble = .4, size = .08, colors = [0xffffff],
    opacity = .8, additive = false, streak = 0, seed = 7 }) {
    this.count = count;
    const rng = mulberry32(seed), positions = new Float32Array(count * 3), seeds = new Float32Array(count * 4), tint = new Float32Array(count * 3), color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = rng() * TAU, r = Math.sqrt(rng());
      positions.set([box.x + Math.cos(a) * box.rx * r, box.y0 + rng() * (box.y1 - box.y0), box.z + Math.sin(a) * box.rz * r], i * 3);
      seeds.set([rng(), rng(), rng(), rng()], i * 4);
      color.set(colors[i % colors.length]).multiplyScalar(.85 + rng() * .3).toArray(tint, i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    geometry.setAttribute("color", new THREE.BufferAttribute(tint, 3));
    this.uniforms = { uTime: { value: 0 }, uSpeed: { value: kind === "drift" ? speed : speed }, uWobble: { value: wobble }, uSpan: { value: box.y1 - box.y0 }, uFloor: { value: box.y0 }, uStreak: { value: streak } };
    const material = new THREE.PointsMaterial({ size, map: dot(), vertexColors: true, transparent: true, opacity, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const travel = kind === "rise" ? "1." : kind === "fall" ? "-1." : "0.";
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>
attribute vec4 aSeed; uniform float uTime, uSpeed, uWobble, uSpan, uFloor, uStreak; varying float vFade;`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>
float t = uTime * (.6 + aSeed.x * .8);
transformed.x += sin(t * .7 + aSeed.y * 6.283) * uWobble + sin(t * 1.9 + aSeed.z * 9.) * uWobble * .3;
transformed.z += cos(t * .6 + aSeed.w * 6.283) * uWobble;
float lift = ${travel} * uSpeed * uTime * (.7 + aSeed.y * .6);
float h = mod(transformed.y - uFloor + lift + (${travel} == 0. ? sin(t + aSeed.x * 6.283) * uWobble * .5 : 0.), uSpan);
transformed.y = uFloor + h;
// Fade at the top and bottom of the band, so wrapping motes never pop.
vFade = smoothstep(0., .12, h / uSpan) * smoothstep(1., .85, h / uSpan) * (.55 + .45 * sin(t * 2. + aSeed.z * 6.283));`)
        .replace("gl_PointSize = size;", "gl_PointSize = size * (1. + uStreak);");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vFade;")
        .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.a *= vFade;");
    };
    material.customProgramCacheKey = () => `life-motes:${kind}`;
    this.material = material;
    this.points = new THREE.Points(geometry, material);
    this.points.name = `life:${name}`;
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
  }

  setBudget(fraction) { this.points.geometry.setDrawRange(0, Math.max(0, Math.round(this.count * fraction))); }

  // Reduced motion: no drifting particles at all.
  update(dt, ctx = {}) { this.points.visible = !ctx.quiet; if (!ctx.quiet) this.uniforms.uTime.value += Math.min(dt, .05); }

  dispose() { this.points.removeFromParent(); this.points.geometry.dispose(); this.material.dispose(); }
}

// ---- sway: plants bend in the wind or current, by height above the terrain, on the GPU -------
// The terrain's heights are packed once into a small texture, so a tuft on a hill sways like a
// tuft, not like a tree. It patches the scenery's own foliage material: no extra draw call.
// Each plant bends by an angle that shrinks with height (grass flexes, trunks barely), so the
// sideways offset is angle × height: grass a few centimetres, a tree crown ~10 cm, kelp ~0.6 m.
export class Sway {
  constructor(scenery, { angle = .15, stiffness = .8, frequency = .5, flutter = .02, ground = "Journey Ground", foliage = /^Journey (Foliage|Bark)/ } = {}) {
    let terrain = null;
    scenery.traverse(o => { if (o.isMesh && o.material?.name === ground) terrain = o; });
    this.texture = heightTexture(terrain);
    this.settings = new THREE.Vector4(angle, frequency, flutter, stiffness);
    this.uniforms = [];
    const seen = new Set();
    scenery.traverse(o => {
      const material = o.material;
      if (!o.isMesh || !foliage.test(material?.name || "") || seen.has(material)) return;
      seen.add(material);
      // The patch is installed once per (cached, shared) material and reads stable uniform
      // objects, so revisiting a destination only refreshes their values.
      let uniforms = material.userData.swayUniforms;
      if (!uniforms) {
        uniforms = material.userData.swayUniforms = { uTime: { value: 0 }, uSway: { value: new THREE.Vector4() }, uGround: { value: null }, uBox: { value: new THREE.Vector4(-60.75, -60.75, 121.5, 121.5) } };
        // Trunks only follow above 2 m, so crowns and the top of the trunk move together.
        const bark = /Bark/.test(material.name), previous = material.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) => {
          previous?.call(material, shader, renderer);
          Object.assign(shader.uniforms, uniforms);
          shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
uniform float uTime; uniform vec4 uSway, uBox; uniform sampler2D uGround;`)
            .replace("#include <begin_vertex>", `#include <begin_vertex>
{ vec4 wp = modelMatrix * vec4(transformed, 1.);
  float ground = texture2D(uGround, (wp.xz - uBox.xy) / uBox.zw).r * 48. - 12.;
  float h = clamp(wp.y - ground, 0., 12.)${bark ? " * smoothstep(2., 5., wp.y - ground)" : ""};
  float phase = uTime * uSway.y * 6.283 + dot(wp.xz, vec2(.21, .17));
  float bendBy = uSway.x * h / (1. + h / max(uSway.w, .01));
  float s = bendBy * (sin(phase) + .35 * sin(phase * 2.3 + 1.7)) + uSway.z * min(h, 1.5) * sin(uTime * 7. + wp.x * 1.7 + wp.z * 1.3);
  transformed.xz += vec2(.86, .5) * s; }`);
        };
        material.customProgramCacheKey = () => `life-sway:${material.name}`;
        material.needsUpdate = true;
      }
      uniforms.uGround.value = this.texture;
      uniforms.uSway.value.copy(this.settings);
      this.uniforms.push(uniforms);
    });
  }

  update(dt, ctx = {}) { for (const u of this.uniforms) { u.uTime.value += Math.min(dt, .05); u.uSway.value.x = ctx.quiet ? 0 : this.settings.x; u.uSway.value.z = ctx.quiet ? 0 : this.settings.z; } }

  dispose() { for (const u of this.uniforms) u.uSway.value.set(0, 0, 0, 1); this.texture.dispose(); }
}

// Lowest height per 1.5 m terrain cell (the Blender terrain grid), as an 8-bit texture over
// -60..60 m storing heights from -12 to +36 m.
function heightTexture(terrain) {
  const N = 81, step = 1.5, heights = new Float32Array(N * N).fill(Infinity);
  const position = terrain?.geometry.attributes.position;
  if (position) {
    terrain.updateWorldMatrix(true, false);
    const v = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(terrain.matrixWorld);
      const ix = Math.round((v.x + 60) / step), iz = Math.round((v.z + 60) / step);
      if (ix < 0 || iz < 0 || ix >= N || iz >= N) continue;
      heights[iz * N + ix] = Math.min(heights[iz * N + ix], v.y);
    }
  }
  const data = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    const y = Number.isFinite(heights[i]) ? heights[i] : .42, byte = Math.round(Math.max(0, Math.min(1, (y + 12) / 48)) * 255);
    data.set([byte, byte, byte, 255], i * 4);
  }
  const texture = new THREE.DataTexture(data, N, N);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// ---- a destination's life: built from a recipe, budgeted by quality, updated each frame ------
const GEOMETRY = {
  fish: options => fishGeometry(options),
  bird: options => birdGeometry(options),
  butterfly: () => butterflyGeometry(),
  jelly: () => jellyGeometry(),
};

export class Life {
  // sizeScale: creatures are sized for the desktop camera; portrait phones see the world from
  // further away, so the same pixels need bigger (still toy-proportioned) creatures and motes.
  constructor(parent, recipe, { scenery = null, budget = 1, sizeScale = 1 } = {}) {
    this.group = new THREE.Group();
    this.group.name = "Ambient life";
    parent.add(this.group);
    this.swarms = []; this.motes = []; this.sway = null;
    for (const spec of recipe.swarms || []) {
      const swarm = new Swarm({ ...spec, length: (spec.length ?? .6) * sizeScale, geometry: GEOMETRY[spec.shape](spec.shapeOptions) });
      this.swarms.push(swarm); this.group.add(swarm.mesh);
    }
    for (const spec of recipe.motes || []) {
      const motes = new Motes({ ...spec, size: (spec.size ?? .08) * sizeScale });
      this.motes.push(motes); this.group.add(motes.points);
    }
    if (recipe.sway && scenery) this.sway = new Sway(scenery, recipe.sway);
    this.frustum = new THREE.Frustum();
    this.matrix = new THREE.Matrix4();
    this.setBudget(budget);
  }

  setBudget(fraction) {
    this.budget = fraction;
    for (const swarm of this.swarms) swarm.setBudget(fraction);
    for (const motes of this.motes) motes.setBudget(fraction);
  }

  update(dt, { camera, threat, quiet = false } = {}) {
    if (camera) this.frustum.setFromProjectionMatrix(this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const ctx = { frustum: camera ? this.frustum : null, threat, eye: camera?.position, quiet };
    for (const swarm of this.swarms) swarm.update(dt, ctx);
    for (const motes of this.motes) motes.update(dt, ctx);
    this.sway?.update(dt, ctx);
  }

  get stats() {
    let creatures = 0, motes = 0, awake = 0;
    for (const s of this.swarms) { creatures += s.mesh.count; if (!s.asleep) awake++; }
    for (const m of this.motes) motes += m.points.geometry.drawRange.count === Infinity ? m.count : m.points.geometry.drawRange.count;
    return { swarms: this.swarms.length, awake, creatures, motes, sway: Boolean(this.sway), calls: this.swarms.length + this.motes.length };
  }

  dispose() {
    for (const swarm of this.swarms) swarm.dispose();
    for (const motes of this.motes) motes.dispose();
    this.sway?.dispose();
    this.group.removeFromParent();
  }
}
