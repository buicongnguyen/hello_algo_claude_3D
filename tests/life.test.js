// Ambient life (src/life.js, src/life-data.js) and adaptive quality (src/governor.js).
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Swarm, Motes, Sway, Life, fishGeometry, birdGeometry, butterflyGeometry, jellyGeometry, mulberry32 } from "../src/life.js";
import { LIFE, LIFE_BUDGET, islandLife } from "../src/life-data.js";
import { QualityGovernor } from "../src/governor.js";
import { QUALITY_PROFILES } from "../src/render.js";
import { ENVIRONMENTS } from "../src/journey-data.js";

const tris = g => g.attributes.position.count / 3;
const area = { x: 2, z: -3, rx: 8, rz: 5, y0: 1, y1: 4 };
const fishSwarm = (options = {}) => new Swarm({ geometry: fishGeometry(), area, count: 24, schools: 4, seed: 5, ...options });
function run(swarm, seconds, ctx = {}, dt = 1 / 60) { for (let t = 0; t < seconds; t += dt) swarm.update(dt, ctx); }

test("creature meshes stay within tiny triangle budgets and carry their motion weights", () => {
  // The skill's budget for 16–48 px creatures is 60–450 triangles; these sit at or below its floor.
  for (const [geometry, budget] of [[fishGeometry(), 48], [fishGeometry({ deep: 1.8, slim: .7 }), 48], [birdGeometry(), 32], [butterflyGeometry(), 16], [jellyGeometry(), 70]]) {
    assert.ok(tris(geometry) <= budget, `${tris(geometry)} triangles > ${budget}`);
    for (const name of ["aBend", "aPaint", "aShade"]) assert.ok(geometry.attributes[name], name);
    const bend = geometry.attributes.aBend.array;
    assert.ok(bend.every(v => v >= 0 && v <= 1));
  }
});

test("a swarm is one instanced, shadowless draw and every creature stays inside its area", () => {
  const swarm = fishSwarm();
  assert.ok(swarm.mesh.isInstancedMesh);
  assert.equal(swarm.mesh.castShadow, false);
  for (const dt of [1 / 120, 1 / 30, .2]) run(swarm, 8, {}, dt);
  for (let i = 0; i < swarm.count; i++) {
    const u = (swarm.x[i] - area.x) / area.rx, v = (swarm.z[i] - area.z) / area.rz;
    assert.ok(u * u + v * v <= 1.0001, `creature ${i} left the area`);
    assert.ok(swarm.y[i] >= area.y0 - 1e-6 && swarm.y[i] <= area.y1 + 1e-6);
  }
  assert.ok([...swarm.mesh.instanceMatrix.array].every(Number.isFinite), "no NaN in the instance buffer");
});

test("cosmetic randomness is seeded: same seed, same flight; the simulation never touches Math.random", () => {
  // (three itself uses Math.random for object UUIDs at construction; the per-frame steering must not.)
  const a = fishSwarm(), b = fishSwarm(), c = fishSwarm({ seed: 6 });
  const original = Math.random;
  Math.random = () => { throw new Error("ambient life must not consume gameplay randomness"); };
  try {
    run(a, 3); run(b, 3); run(c, 3);
    assert.deepEqual([...a.x], [...b.x]);
    assert.notDeepEqual([...a.x], [...c.x]);
  } finally { Math.random = original; }
});

test("creatures dart away from KAI and part around the camera's line to KAI", () => {
  const swarm = fishSwarm({ count: 1, schools: 1 });
  swarm.x[0] = 2; swarm.y[0] = 2; swarm.z[0] = -3; swarm.v[0] = .5;
  swarm.update(1 / 60, { threat: { x: 2.5, y: 1.5, z: -3 } });
  assert.ok(swarm.flee[0] > 0, "startled");
  run(swarm, .6);
  assert.ok(swarm.v[0] > 1.5, `darts faster than it cruises (${swarm.v[0].toFixed(2)})`);
  run(swarm, 3);
  assert.equal(swarm.flee[0] <= 0, true, "calms down again");
  // On the line from the camera to KAI, far from KAI itself: it still moves aside.
  const line = fishSwarm({ count: 1, schools: 1, scare: .1 });
  line.x[0] = 2; line.y[0] = 2.5; line.z[0] = -3;
  line.update(1 / 60, { threat: { x: 2, y: 1, z: -9 }, eye: { x: 2, y: 4, z: 3 } });
  assert.ok(line.flee[0] > 0, "parts for the camera");
});

test("the phase is accumulated, so a calm-to-flee change of beat never jumps", () => {
  // Calm ~2 Hz, fleeing ~4 Hz (Zoo Garden: 1.4 and 3.5 Hz); no frame may advance further than that.
  const swarm = fishSwarm({ count: 1, schools: 1 });
  const fastest = (swarm.beat + swarm.fleeSpeed * swarm.beatPerSpeed) * Math.PI * 2 / 60;
  let previous = swarm.phase[0], biggest = 0;
  for (let i = 0; i < 240; i++) {
    if (i === 120) swarm.startle(0, 1, 0);
    swarm.update(1 / 60);
    const step = (swarm.phase[0] - previous + Math.PI * 2) % (Math.PI * 2); previous = swarm.phase[0];
    biggest = Math.max(biggest, step);
  }
  assert.ok(biggest <= fastest + 1e-6 && biggest < .5, `largest per-frame phase step ${biggest.toFixed(3)} rad`);
});

test("quality budgets and reduced motion scale life down", () => {
  const swarm = fishSwarm();
  swarm.setBudget(LIFE_BUDGET.low);
  assert.equal(swarm.mesh.count, Math.round(24 * LIFE_BUDGET.low));
  const motes = new Motes({ count: 100, box: area });
  motes.setBudget(.5);
  assert.equal(motes.points.geometry.drawRange.count, 50);
  motes.update(1 / 60, { quiet: true });
  assert.equal(motes.points.visible, false, "no particles under reduced motion");
  motes.update(1 / 60, {});
  assert.equal(motes.points.visible, true);
  for (const value of Object.values(LIFE_BUDGET)) assert.ok(value > 0 && value <= 1);
});

test("plant sway patches each shared foliage material once and survives revisiting a scene", () => {
  const scenery = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ name: "Journey Ground" }));
  const foliage = new THREE.MeshStandardMaterial({ name: "Journey Foliage" });
  scenery.add(ground, new THREE.Mesh(new THREE.BoxGeometry(), foliage), new THREE.Mesh(new THREE.BoxGeometry(), foliage));
  const first = new Sway(scenery, { angle: .2 }); first.dispose();
  const second = new Sway(scenery, { angle: .1 });
  const shader = { uniforms: {}, vertexShader: "#include <common>\n#include <begin_vertex>", fragmentShader: "" };
  foliage.onBeforeCompile(shader, null);
  assert.equal(shader.vertexShader.match(/uniform float uTime/g).length, 1, "one declaration after two visits");
  assert.equal(shader.uniforms.uSway.value.x, .1, "the current visit's settings");
  second.update(1 / 60, { quiet: true });
  assert.equal(shader.uniforms.uSway.value.x, 0, "reduced motion stills the plants");
  second.dispose();
});

test("every destination has a recipe, and every recipe builds", () => {
  for (const key of Object.keys(ENVIRONMENTS)) assert.ok(LIFE[key], `${key} has ambient life`);
  for (const [key, recipe] of [...Object.entries(LIFE), ...["coral", "scrapyard", "moonpool"].map(t => [t, islandLife(t, [[0, 0, 2]])])]) {
    const parent = new THREE.Group();
    const life = new Life(parent, recipe, { budget: 1 });
    life.update(1 / 60, {});
    const stats = life.stats;
    assert.equal(stats.calls, (recipe.swarms?.length || 0) + (recipe.motes?.length || 0), `${key}: one draw call per kind`);
    assert.ok(stats.creatures <= 80 && stats.motes <= 300, `${key}: counts stay modest`);
    life.dispose();
    assert.equal(parent.children.length, 0);
  }
});

test("the auto-quality governor gives up resolution first, then a tier, and recovers resolution", () => {
  const g = new QualityGovernor();
  // One second of frames at `fps` (the last frame closes the second).
  const second = (fps, active = true, tier = "high", governor = g) => { let changed = false; for (let i = 0; i < fps; i++) changed = governor.sample(1.0001 / fps, active, tier) || changed; return changed; };
  assert.equal(second(30), false); assert.equal(second(30), false);
  assert.equal(second(30), true); assert.equal(g.scale, .85);
  second(30); second(30); second(30); assert.equal(g.scale, .7);
  second(30); second(30); assert.equal(second(30), true); assert.equal(g.cap, "medium"); assert.equal(g.scale, 1);
  assert.equal(g.limit("high"), "medium"); assert.equal(g.limit("low"), "low");
  g.scale = .7;
  for (let i = 0; i < 4; i++) assert.equal(second(60), false);
  assert.equal(second(60), true); assert.equal(g.scale, .85);
  // Menus and pauses never count.
  const idle = new QualityGovernor();
  for (let i = 0; i < 10; i++) second(20, false, "high", idle);
  assert.deepEqual(idle.toJSON(), { cap: "high", scale: 1 });
  const restored = new QualityGovernor(JSON.parse(JSON.stringify(g)));
  assert.deepEqual(restored.toJSON(), g.toJSON());
  assert.deepEqual(new QualityGovernor({ cap: "ultra", scale: 9 }).toJSON(), { cap: "high", scale: 1 });
});

test("only the low tier drops image-based lighting", () => {
  assert.equal(QUALITY_PROFILES.low.ibl, false);
  assert.equal(QUALITY_PROFILES.medium.ibl, true);
  assert.equal(QUALITY_PROFILES.high.ibl, true);
  assert.equal(typeof mulberry32(1)(), "number");
});
