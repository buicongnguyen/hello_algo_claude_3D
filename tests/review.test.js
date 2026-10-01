// Regression coverage for the gameplay logic review: each test pins one confirmed defect.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Game } from "../src/game.js";
import { findStage } from "../src/missions.js";
import { createProgress } from "../src/rules.js";
import { challengeStatus, fieldChallenge } from "../src/mission-report.js";
import { solveRelays, traceRelays } from "../src/relay.js";
import { Particles, Shake, turnToward } from "../src/feedback.js";
import { atmosphereFor, ATMOSPHERES } from "../src/atmosphere.js";
import { ENVIRONMENTS } from "../src/journey-data.js";
import { resolveQuality, QUALITY_PROFILES } from "../src/render.js";
import { PLAY_RADIUS } from "../src/presentation.js";
import { Boundary } from "../src/boundary.js";
import { mapPoint } from "../src/minimap.js";
import { readFileSync } from "node:fs";
import { World } from "../src/world.js";
import { clearPath, moveAgent, reachablePoint } from "../src/navigation.js";
import { BRAWL } from "../src/missions.js";
import { EXPEDITIONS } from "../src/expedition-data.js";
import { normalizeSettings } from "../src/rules.js";
import { InputController } from "../src/input.js";

function harness(progress = createProgress({ settings: { campaignMode: "challenge" } })) {
  const mission = new THREE.Group();
  const world = {
    mission, cameraYaw: Math.PI / 6,
    clearMission: () => mission.clear(),
    createActor: (_name, p, _scale, parent = mission) => {
      const object = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0x336699 }));
      object.position.set(p.x, 0.55, p.z); parent.add(object); return object;
    },
    createMarker: () => { const group = new THREE.Group(); group.userData.ring = new THREE.Group(); mission.add(group); return group; },
    createRoute: () => { const line = new THREE.Group(); mission.add(line); return line; },
    release: object => object.removeFromParent(), pulse: () => {},
  };
  const input = { enabled: false, actions: new Set(), clear() { this.actions.clear(); }, consume(action) { return this.actions.delete(action); }, movement: () => ({ x: 0, y: 0 }) };
  const ui = { messages: [], message(text) { this.messages.push(text); }, dialogue() {}, showGame() { this.outcome = null; }, prompt(text) { this.promptText = text; }, updateHUD() {}, setProgress() {}, modal(value) { this.outcome = value; } };
  const game = new Game(world, input, ui, progress, () => true);
  return { game, world, input, ui };
}
const move = (game, p) => { game.player.x = p.x; game.player.z = p.z; };

const journeyAssets = JSON.parse(readFileSync(new URL("../public/models/journey-manifest.json", import.meta.url))).assets;
function useColliders(world, name = "journey_beach") {
  world.obstacles = journeyAssets.find(asset => asset.name === name).colliders.map(([x, z, radius]) => ({ x, z, radius }));
  world.constrainPlayer = World.prototype.constrainPlayer;
}

test("bullet momentum pushes away from the shooter at every supported frame time", () => {
  const { game } = harness(); game.begin(findStage("fragment"));
  move(game, { x: 0, z: 0 });
  for (const dt of [1 / 120, 1 / 60, 1 / 30, .05]) for (const distance of [.7, 1.1, 4.4]) for (const angle of [0, Math.PI / 3, Math.PI]) {
    const start = { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance };
    const enemy = game.makeEntity("enemy", "rust_scout", start, 1, { health: 10, maxHealth: 10, variant: "bot" });
    game.entities = [enemy];
    game.combat.makeBullet(enemy, { color: 0x65e5ff, damage: 1 });
    for (let tick = 0; tick < 120 && game.combat.bullets.length; tick++) game.combat.updateBullets(dt);
    assert.equal(enemy.health, 9);
    assert.ok(Math.abs(enemy.x - start.x - Math.cos(angle) * .32) < 1e-8, `X knockback: dt=${dt}, distance=${distance}`);
    assert.ok(Math.abs(enemy.z - start.z - Math.sin(angle) * .32) < 1e-8, `Z knockback: dt=${dt}, distance=${distance}`);
  }
});

test("knockback cannot push a disabled robot or its loot into a solid prop", () => {
  const { game, world } = harness(); game.begin(findStage("fragment"));
  world.obstacles = [{ x: 3, z: 0, radius: 1 }];
  const enemy = game.entities.find(entity => entity.kind === "enemy");
  Object.assign(enemy, { x: 1, z: 0, health: 10, maxHealth: 10 });
  move(game, { x: -1, z: 0 });
  game.combat.hit(enemy, 1);
  assert.equal(enemy.health, 9);
  assert.equal(enemy.x, 1, "the hit deals damage but does not embed the robot in the obstacle");
  world.obstacles = [];
  game.combat.hit(enemy, 1);
  assert.equal(enemy.x, 1.32, "pulse / arc attacks still push away from their source");
});

test("all enemy variants detour around a real Blender prop before winding up", () => {
  for (const index of [0, 1, 2]) for (const dt of [1 / 60, .05]) {
    const { game, world } = harness(); game.begin(findStage("fragment")); useColliders(world);
    const enemy = game.entities.filter(entity => entity.kind === "enemy")[index];
    Object.assign(enemy, { x: -15.1, z: 1, attackState: "approach" });
    move(game, { x: -10.9, z: 1 });
    assert.equal(clearPath(enemy, game.player, world.obstacles, enemy.radius), false, "the beach prop must block the straight line");
    let approached = false;
    for (let tick = 0; tick < 15 / dt; tick++) {
      const before = { x: enemy.x, z: enemy.z };
      game.combat.moveEnemy(enemy, game.player, dt);
      assert.ok(clearPath(before, enemy, world.obstacles, enemy.radius), "every movement step clears the scenery");
      assert.ok(Math.hypot(enemy.x, enemy.z) <= PLAY_RADIUS - .5 + 1e-6);
      if (enemy.attackState === "windup") { approached = true; break; }
    }
    assert.ok(approached, `${enemy.variant} must not remain stuck behind the beach prop`);
    assert.ok(clearPath(enemy, game.player, world.obstacles, enemy.radius), "do not commit a charge into a wall");
  }
});

test("summoned crabs have a footprint and route around solid scenery to help", () => {
  const { game, world } = harness(); game.begin(findStage("fragment")); useColliders(world);
  const enemy = game.entities.find(entity => entity.kind === "enemy");
  Object.assign(enemy, { x: -10.5, z: 1, health: 100, maxHealth: 100 }); game.entities = [enemy];
  move(game, { x: -16, z: 1 });
  game.combat.whistles = 1; assert.equal(game.combat.callAnimals(), true);
  for (const animal of game.combat.animals) assert.equal(animal.radius, .45);
  Object.assign(game.combat.animals[0], { x: -15, z: 1 });
  assert.equal(clearPath(game.combat.animals[0], enemy, world.obstacles, .45), false, "the beach prop must block the crab's straight line");
  for (const animal of game.combat.animals.slice(1)) animal.life = 0;
  for (let tick = 0; tick < 200 && enemy.health === 100; tick++) {
    const before = game.combat.animals.map(a => ({ x: a.x, z: a.z }));
    game.combat.updateAllies(.05);
    game.combat.animals.forEach((animal, i) => assert.ok(clearPath(before[i], animal, world.obstacles, animal.radius)));
  }
  assert.ok(enemy.health < 100, "the crab crew reaches the enemy and attacks without passing through the prop");
});

test("recruited robots use the same safe detour before attacking through scenery", () => {
  const { game, world } = harness(); game.begin(findStage("fragment")); useColliders(world);
  const [ally, enemy] = game.entities.filter(entity => entity.kind === "enemy");
  Object.assign(ally, { kind: "ally", x: -15.1, z: 1, cooldown: 0, index: 0 });
  Object.assign(enemy, { x: -10.9, z: 1, health: 100, maxHealth: 100 }); game.entities = [ally, enemy];
  assert.equal(clearPath(ally, enemy, world.obstacles, ally.radius), false, "the beach prop must block the teammate's line of fire");
  game.combat.updateAllies(.05);
  assert.equal(enemy.health, 100, "a blocked teammate must navigate instead of firing through the prop");
  for (let tick = 0; tick < 300 && enemy.health === 100; tick++) {
    const before = { x: ally.x, z: ally.z };
    game.combat.updateAllies(.05);
    assert.ok(clearPath(before, ally, world.obstacles, ally.radius));
  }
  assert.ok(enemy.health < 100, "the teammate reaches an unobstructed firing position");
});

test("navigation follows moving targets, overlapping props and the circular arena", () => {
  const obstacles = [{ x: 0, z: 0, radius: 1.4 }, { x: 0, z: 2, radius: 1.4 }];
  const actor = { x: -4, z: 1, radius: .9 };
  let target = { x: 4, z: 1 };
  for (let tick = 0; tick < 400; tick++) {
    if (tick === 12) target = { x: 3, z: -4 };
    const before = { x: actor.x, z: actor.z };
    moveAgent(actor, target, .12, obstacles);
    assert.ok(clearPath(before, actor, obstacles, actor.radius));
    assert.ok(Math.hypot(actor.x - before.x, actor.z - before.z) <= .120001, "routing never teleports or exceeds speed");
  }
  assert.ok(Math.hypot(actor.x - target.x, actor.z - target.z) < .01);
  for (let i = 0; i < 250; i++) moveAgent(actor, { x: 40, z: 0 }, .12, obstacles);
  assert.ok(Math.hypot(actor.x, actor.z) <= PLAY_RADIUS - .5 + 1e-8);
});

test("unreachable destinations are bounded and agents recover when the target moves", () => {
  const obstacles = [{ x: 0, z: 0, radius: 2 }], actor = { x: -4, z: 0, radius: .9 };
  for (let i = 0; i < 30; i++) {
    moveAgent(actor, { x: 0, z: 0 }, .12, obstacles);
    assert.ok(Math.hypot(actor.x, actor.z) >= 2.9 - 1e-6, "an agent never clips into the prop that hides its target");
  }
  // It closes in on the nearest reachable spot instead of freezing where it stood.
  assert.ok(Math.hypot(actor.x + 2.98, actor.z) < .05, `stopped at (${actor.x.toFixed(2)}, ${actor.z.toFixed(2)})`);
  for (let i = 0; i < 300; i++) moveAgent(actor, { x: 4, z: 0 }, .12, obstacles);
  assert.ok(Math.hypot(actor.x - 4, actor.z) < .01);
});

test("relay guidance never loops and a closed loop never reads as solved", () => {
  const { game } = harness(); game.begin(findStage("trail"));
  // The audit's loop: relay A east into B, B north into C, C still south back into B.
  game.relayNodes[0].turn = 1; game.relayNodes[1].turn = 0; game.relayNodes[2].turn = 2; game.refreshRelays();
  assert.equal(game.relayState.complete, false);
  assert.ok(game.progressCount < game.stage.count, "a loop must not report 3/3 links");
  const target = game.objectiveTarget();
  assert.equal(target.x, game.relayNodes[2].x, "guidance points at the relay whose beam loops back");
  // Following the compass solves the puzzle in a bounded number of turns.
  for (let i = 0; i < 12 && game.running; i++) { const next = game.objectiveTarget(); move(game, next); game.interact(); }
  assert.equal(game.relayState.complete, true);
});

// Reference optimum, independent of solveRelays: breadth-first search over single clockwise quarter-turns.
function fewestTurns(positions, turns, receiver) {
  const start = turns.map(t => t % 4), seen = new Set([start.join()]);
  let frontier = [start];
  for (let depth = 0; frontier.length; depth++) {
    const next = [];
    for (const state of frontier) {
      if (traceRelays(positions, state, receiver).complete) return depth;
      for (let i = 0; i < state.length; i++) {
        const turned = state.slice(); turned[i] = (turned[i] + 1) % 4;
        if (!seen.has(turned.join())) { seen.add(turned.join()); next.push(turned); }
      }
    }
    frontier = next;
  }
  return Infinity;
}

test("the relay solver finds the cheapest completing orientation", () => {
  for (const id of ["trail", "core"]) {
    const stage = findStage(id).stage;
    const solution = solveRelays(stage.positions, stage.turns, stage.receiver);
    assert.ok(traceRelays(stage.positions, solution.turns, stage.receiver).complete);
    assert.equal(solution.cost, fewestTurns(stage.positions, stage.turns, stage.receiver), `${id}: the solver's cost is the true minimum`);
    assert.equal(solution.cost, solution.turns.reduce((sum, value, i) => sum + (value - stage.turns[i] + 4) % 4, 0), "the cost counts clockwise turns");
    // From a scrambled start the solver must still agree with the search.
    const scrambled = stage.turns.map((t, i) => (t + i + 1) % 4);
    assert.equal(solveRelays(stage.positions, scrambled, stage.receiver)?.cost ?? Infinity, fewestTurns(stage.positions, scrambled, stage.receiver));
  }
});

test("the Floating Observatory cannot be won without the player", () => {
  const { game, ui } = harness(); game.begin(findStage("boardwalk"));
  move(game, { x: 17, z: 8 });
  for (let tick = 0; tick < 2400 && game.running; tick++) game.update(.05);
  assert.equal(game.running, false);
  assert.equal(ui.outcome.eyebrow, "Mission incomplete");
  assert.match(ui.outcome.text, /centre lane/);
  assert.equal(game.progress.completed.length, 0);
});

test("a defense breach fails immediately without draining KAI's shield", () => {
  const { game, ui } = harness(); game.begin(findStage("boardwalk"));
  const shields = game.shields;
  const scout = game.spawnEnemy(false, 1); scout.x = game.relay.x; scout.z = game.relay.z;
  game.updateEnemies(0);
  assert.equal(game.running, false);
  assert.equal(game.shields, shields);
  assert.equal(ui.outcome.eyebrow, "Mission incomplete");
});

test("no-damage challenges only appear where something can deal damage", () => {
  for (const id of ["little-wave", "split-current", "storm"]) assert.equal(fieldChallenge(findStage(id).stage).id, "speed", id);
  for (const id of ["approaches", "boardwalk", "captain"]) assert.equal(fieldChallenge(findStage(id).stage).id, "clean", id);
  const home = fieldChallenge(findStage("signalbreak").stage);
  assert.equal(home.id, "exhibits"); assert.equal(home.goal, 4);
});

test("homecoming exhibits are an optional lap that counts each exhibit once", () => {
  const { game, ui } = harness(); game.begin(findStage("signalbreak"));
  assert.equal(challengeStatus(game).done, false);
  for (const exhibit of game.discovery.exhibits) { move(game, exhibit); game.discovery.update(.1); game.discovery.update(.1); }
  assert.equal(game.metrics.exhibits, 4);
  assert.equal(challengeStatus(game).done, true);
  move(game, game.discovery.terminal); game.interact();
  assert.equal(ui.outcome.eyebrow, "Mission complete");
  assert.match(ui.outcome.text, /completed!/);
  assert.ok(game.progress.completed.includes("siege:signalbreak"));
});

test("Use collects a nearby battery and the prompt says so", () => {
  const { game } = harness(); game.begin(findStage("wake"));
  const cell = game.entities.find(e => e.kind === "cell");
  move(game, { x: cell.x + 1, z: cell.z }); game.updatePrompt();
  assert.match(game.ui.promptText, /COLLECT BATTERY/);
  game.interact();
  assert.equal(cell.active, false); assert.equal(game.progressCount, 1);
});

test("whistles are kept when nothing is nearby, and helpers ignore a shielded boss", () => {
  const { game, ui } = harness(); game.begin(findStage("captain"));
  game.combat.whistles = 1;
  game.boss.x = 30; game.boss.z = 30;
  assert.equal(game.combat.callAnimals(), false); assert.equal(game.combat.whistles, 1);
  game.boss.x = game.player.x + 2; game.boss.z = game.player.z; game.boss.state = "shielded";
  assert.equal(game.combat.callAnimals(), true);
  const before = ui.messages.length;
  game.combat.updateAllies(.1); game.combat.updateAllies(1.3);
  assert.equal(game.boss.health, game.boss.maxHealth);
  assert.ok(!ui.messages.slice(before).some(text => /shield up/.test(text)), "helpers never overwrite the charge telegraph");
});

test("repeated tints blend from the authored colour instead of drifting", () => {
  const { game } = harness(); game.begin(findStage("captain"));
  const mesh = game.boss.object;
  game.tint(mesh, 0xff7b4b, 1.8); const first = mesh.material.color.getHex();
  for (let i = 0; i < 6; i++) { game.tint(mesh, 0x65e5ff, 1.2); game.tint(mesh, 0xff7b4b, 1.8); }
  assert.equal(mesh.material.color.getHex(), first);
});

test("checkpoint state can never be restored into a non-finale stage", () => {
  const progress = createProgress({ settings: { campaignMode: "challenge" } });
  progress.completed = ["siege:core"];
  progress.checkpoint = { stage: "siege:signalbreak", mode: "challenge", time: 60, elapsed: 30, coreHealth: 3, metrics: {} };
  const { game } = harness(progress);
  assert.doesNotThrow(() => game.begin(findStage("signalbreak"), { resumeCheckpoint: true }));
  assert.equal(game.boss, null);
  assert.equal(game.phase, "active");
});

test("dogs telegraph the distance their rush really travels", () => {
  const { game } = harness(); game.begin(findStage("fragment"));
  const routes = [];
  game.world.createRoute = points => { routes.push(points); const g = new THREE.Group(); game.world.mission.add(g); return g; };
  const dog = game.spawnEnemy(false, 1);
  Object.assign(dog, { x: 0, z: 0, attackState: "approach" });
  game.player.x = 4; game.player.z = 0;
  game.combat.moveEnemy(dog, game.player, .016);
  assert.equal(dog.attackState, "windup");
  const [from, to] = routes.at(-1);
  const drawn = Math.hypot(to.x - from.x, to.z - from.z);
  dog.attackState = "rush"; dog.attackTime = .55; dog.rushX = 1; dog.rushZ = 0; dog.x = 0; dog.z = 0;
  game.player.x = 99;
  for (let i = 0; i < 60 && dog.attackState === "rush"; i++) game.combat.moveEnemy(dog, game.player, .01);
  assert.ok(Math.abs(dog.x - drawn) < .2, `drawn ${drawn.toFixed(2)} m, travelled ${dog.x.toFixed(2)} m`);
});

test("feedback helpers are bounded and deterministic", () => {
  const particles = new Particles(32);
  particles.emit(0, 1, 0, { count: 50 });
  particles.update(.1); assert.ok(particles.alive <= 32);
  particles.update(5); assert.equal(particles.alive, 0);
  const shake = new Shake(); shake.add(2); assert.equal(shake.trauma, 1);
  assert.equal(shake.update(.1, true).length(), 0, "reduced motion never shakes the camera");
  assert.ok(Math.abs(turnToward(3.1, -3.1, 1) - (-3.1 + Math.PI * 2)) < 1e-9, "turning takes the short way around");
});

test("every destination has an art-directed atmosphere and quality never changes gameplay", () => {
  for (const key of Object.keys(ENVIRONMENTS)) assert.ok(ATMOSPHERES[key], key);
  assert.equal(new Set(Object.keys(ENVIRONMENTS).map(key => atmosphereFor(key).horizon)).size, 15);
  assert.equal(resolveQuality("auto", 400), "medium");
  assert.equal(resolveQuality("auto", 1400), "high");
  assert.equal(resolveQuality("auto", 1400, true), "low", "software rendering falls back to the low profile");
  assert.equal(resolveQuality("high", 1400, true), "high", "an explicit choice is always respected");
  assert.equal(QUALITY_PROFILES.low.post, false);
});

test("the play space is one circle shared by KAI, enemies, the fence and the radar", () => {
  const { game } = harness(); game.begin(findStage("wake"));
  assert.equal(PLAY_RADIUS, 21);
  for (const angle of [0, Math.PI / 4, 1.2, Math.PI, 4.1]) {
    game.player.x = Math.cos(angle) * 17; game.player.z = Math.sin(angle) * 17;
    game.lastMove = { x: Math.cos(angle), z: Math.sin(angle) };
    game.dashMove = game.lastMove; game.dashTime = 10;
    for (let i = 0; i < 60; i++) game.updatePlayer(.05);
    assert.ok(Math.abs(Math.hypot(game.player.x, game.player.z) - PLAY_RADIUS) < 1e-6, "KAI reaches exactly the circular edge, with no square clamp");
  }
  game.begin(findStage("fragment"));
  const enemy = game.spawnEnemy(false, 0); Object.assign(enemy, { x: 30, z: 0, attackState: "approach" });
  game.combat.moveEnemy(enemy, { x: 40, z: 0 }, .1);
  assert.ok(Math.hypot(enemy.x, enemy.z) <= PLAY_RADIUS - .5 + 1e-9);
  const fence = new Boundary(PLAY_RADIUS);
  fence.update(.1, { x: 0, z: 0 });
  assert.ok(fence.uniforms.proximity.value < .01, "the fence stays hidden in the middle of the play space");
  for (let i = 0; i < 30; i++) fence.update(.1, { x: PLAY_RADIUS, z: 0 });
  assert.ok(fence.uniforms.proximity.value > .95, "the fence is fully lit at the edge");
  fence.update(.1, null); assert.equal(fence.group.visible, false);
  fence.dispose();
  const edge = mapPoint({ x: PLAY_RADIUS, z: 0 }, 0, 160), centre = mapPoint({ x: 0, z: 0 }, 0, 160);
  assert.ok(edge.x - centre.x < 80, "the radar shows the whole play space");
});

// ---- second review pass: each test pins a defect fixed in the review-pass branch ----

test("enemies reach a player standing in the pocket between a rim prop and the edge", () => {
  const { world } = harness(); useColliders(world);
  const prop = { x: 15.79, z: -12.63, radius: .88 }, base = Math.atan2(prop.z, prop.x);
  let pocket = null;
  for (let da = 0; da < .2 && !pocket; da += .002) for (const side of [1, -1]) {
    const a = base + side * da, p = { x: Math.cos(a) * PLAY_RADIUS, z: Math.sin(a) * PLAY_RADIUS };
    const inside = { x: p.x * (PLAY_RADIUS - .5) / PLAY_RADIUS, z: p.z * (PLAY_RADIUS - .5) / PLAY_RADIUS };
    if (Math.hypot(p.x - prop.x, p.z - prop.z) >= prop.radius + .9 && !clearPath(inside, inside, world.obstacles, .9)) { pocket = p; break; }
  }
  assert.ok(pocket, "the beach still has a pocket to test");
  const target = reachablePoint(pocket, world.obstacles, .78);
  assert.ok(clearPath(target, target, world.obstacles, .78), "the reachable point is outside every prop");
  const agent = { x: 6, z: -3, radius: .78 };
  for (let tick = 0; tick < 60 * 20; tick++) {
    const before = { x: agent.x, z: agent.z };
    moveAgent(agent, pocket, 2.4 / 60, world.obstacles);
    assert.ok(clearPath(before, agent, world.obstacles, agent.radius));
  }
  assert.ok(Math.hypot(agent.x - pocket.x, agent.z - pocket.z) < 1.35, `a scout closes to contact range (${agent.x.toFixed(2)}, ${agent.z.toFixed(2)})`);
});

test("crab crews spawn and idle inside the play boundary", () => {
  const { game } = harness(); game.begin(BRAWL);
  move(game, { x: 0, z: PLAY_RADIUS });
  const enemy = game.spawnEnemy(false, 0); Object.assign(enemy, { x: 0, z: 12, frozen: 99 });
  game.combat.whistles = 1; assert.equal(game.combat.callAnimals(), true);
  for (const animal of game.combat.animals) assert.ok(Math.hypot(animal.x, animal.z) <= PLAY_RADIUS - .5 + 1e-9, "spawned inside");
  enemy.active = false;
  for (let tick = 0; tick < 120; tick++) game.combat.updateAllies(1 / 60);
  for (const animal of game.combat.animals) assert.ok(Math.hypot(animal.x, animal.z) <= PLAY_RADIUS - .5 + 1e-9, "stays inside");
});

test("pulsing a shielded boss explains the shield instead of reporting no target", () => {
  const { game, ui } = harness(); game.begin(findStage("captain"));
  move(game, { x: game.boss.x + 2, z: game.boss.z });
  const before = ui.messages.length; game.pulse();
  const said = ui.messages.slice(before);
  assert.ok(said.some(text => /shield is solid/.test(text)), said.join(" | "));
  assert.ok(!said.some(text => /No pulse target/.test(text)), said.join(" | "));
});

test("defense stages start KAI inside the line and fresh spawns cannot hit before they are seen", () => {
  const { game } = harness(); game.begin(findStage("boardwalk"));
  assert.deepEqual({ x: game.player.x, z: game.player.z }, { x: 0, z: 5 });
  for (let t = 0; t < 5 && game.running; t += 1 / 60) game.update(1 / 60);
  assert.equal(game.metrics.damageTaken, 0, "no hit during the opening seconds");
  const enemy = game.spawnEnemy(false, 0);
  assert.ok(enemy.grace > 0, "new robots carry a contact grace");
});

test("a downed robot beside the clam can be repaired, but carrying a friend still wins", () => {
  const { game } = harness(); game.begin(EXPEDITIONS[0]);
  const clam = game.expedition.clam;
  move(game, { x: clam.x - 1.5, z: clam.z });
  const bot = game.makeEntity("enemy", "rust_scout", { x: clam.x - 2, z: clam.z }, .8, { variant: "bot", repairable: true, active: false, health: 0, maxHealth: 3 });
  game.entities.push(bot); game.combat.scrap = 2;
  const shields = game.shields;
  game.interact();
  assert.equal(bot.kind, "ally", "the repair ran");
  assert.equal(game.combat.scrap, 0);
  assert.equal(game.shields, shields, "the clam was not used by the same press");
  const other = game.makeEntity("enemy", "rust_scout", { x: clam.x - 2, z: clam.z + .5 }, .8, { variant: "bot", repairable: true, active: false, health: 0, maxHealth: 3 });
  game.entities.push(other); game.combat.scrap = 2; game.carry = { id: "friend" };
  assert.equal(game.expedition.urgent(), true, "carrying makes the expedition action urgent");
});

test("the x-ray silhouette is idempotent and never writes stencil state into shared model materials", () => {
  const shared = new THREE.MeshStandardMaterial({ name: "Shared" });
  const own = new THREE.MeshStandardMaterial({ name: "Private" });
  const actor = new THREE.Group();
  actor.add(new THREE.Mesh(new THREE.BoxGeometry(), shared), new THREE.Mesh(new THREE.BoxGeometry(), own));
  const world = { assetResources: new Set([shared]) };
  World.prototype.addSilhouette.call(world, actor);
  World.prototype.addSilhouette.call(world, actor);
  let ghosts = 0; actor.traverse(o => { if (o.userData.silhouette) ghosts++; });
  assert.equal(ghosts, 2, "one ghost per mesh, even when refreshed");
  assert.equal(shared.stencilWrite, false, "the cached material stays untouched");
  const [a, b] = actor.children;
  assert.notEqual(a.material, shared); assert.equal(a.material.stencilWrite, true);
  assert.equal(b.material, own, "private materials are updated in place, not cloned again");
  assert.notEqual(a.userData.ghost.material, b.userData.ghost.material, "each ghost owns its material");
});

test("saved settings are validated and keep unknown future keys", () => {
  assert.deepEqual(normalizeSettings({ quality: "ultra", reducedMotion: "yes", sound: 0, campaignMode: "hard" }),
    { quality: "auto", reducedMotion: false, sound: true, campaignMode: "story" });
  const kept = normalizeSettings({ quality: "medium", reducedMotion: true, sound: false, campaignMode: "challenge", language: "vi" });
  assert.deepEqual(kept, { quality: "medium", reducedMotion: true, sound: false, campaignMode: "challenge", language: "vi" });
  assert.equal(createProgress({ settings: [] }).settings.quality, "auto");
});

test("pointer presses that belong to the tap which started play are ignored", () => {
  const originalWindow = globalThis.window, originalDocument = globalThis.document;
  globalThis.window = { addEventListener() {} };
  globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };
  try {
    const input = new InputController();
    input.enabled = true;
    assert.equal(input.settling({ timeStamp: input.enabledAt + 100 }), true);
    assert.equal(input.settling({ timeStamp: input.enabledAt + 400 }), false);
    const first = input.enabledAt; input.enabled = true;
    assert.equal(input.enabledAt, first, "re-enabling while enabled does not restart the grace");
  } finally {
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
  }
});

test("movers cast shadows only near KAI, and tiny parts never do", () => {
  const { game } = harness(); game.begin(BRAWL);
  const enemy = game.spawnEnemy(false, 0);
  enemy.object.traverse(o => { if (o.isMesh) { o.userData.casts = true; o.castShadow = true; } });
  const tiny = new THREE.Mesh(new THREE.BoxGeometry(.01, .01, .01), new THREE.MeshBasicMaterial()); tiny.userData.casts = false; enemy.object.add(tiny);
  const parts = []; enemy.object.traverse(o => { if (o.isMesh && o !== tiny) parts.push(o); });
  Object.assign(enemy, { x: game.player.x + 20, z: game.player.z });
  game.updateShadowCasters(1);
  assert.equal(parts.some(o => o.castShadow), false, "far away: no shadow-pass draws");
  Object.assign(enemy, { x: game.player.x + 3, z: game.player.z });
  game.updateShadowCasters(1);
  assert.equal(tiny.castShadow, false, "tiny parts stay off");
  assert.ok(parts.every(o => o.castShadow), "near: casts again");
});
