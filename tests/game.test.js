import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Game } from "../src/game.js";
import { World } from "../src/world.js";
import { ALL_STAGES, BRAWL, findStage } from "../src/missions.js";
import { createProgress, earnedUpgrades, recordResult, availableCheckpoint } from "../src/rules.js";
import { traceRelays } from "../src/relay.js";
import { EXPEDITIONS } from "../src/expedition-data.js";
import { EQUIPMENT, equipItem, normalizeEquipment, equipmentStats } from "../src/equipment.js";
import { mapMarkers, mapPoint } from "../src/minimap.js";
import { challengeStatus, fieldChallenge } from "../src/mission-report.js";
import { VICTORY_DURATION } from "../src/presentation.js";

function harness(progress = createProgress({ settings: { campaignMode: "challenge" } })) {
  const mission = new THREE.Group();
  const world = {
    mission, cameraYaw: Math.PI / 6,
    clearMission: () => mission.clear(),
    createActor: (_name, p, _scale, parent = mission) => {
      const object = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
      object.position.set(p.x, 0.55, p.z); parent.add(object); return object;
    },
    createMarker: () => { const group = new THREE.Group(); group.userData.ring = new THREE.Group(); mission.add(group); return group; },
    createRoute: () => { const line = new THREE.Group(); mission.add(line); return line; },
    release: object => object.removeFromParent(), pulse: () => {},
  };
  const input = { enabled: false, actions: new Set(), clear() { this.actions.clear(); }, consume(action) { return this.actions.delete(action); }, movement: () => ({ x: 0, y: 0 }) };
  const ui = { outcome: null, message() {}, dialogue() {}, showGame() { this.outcome = null; }, prompt(text) { this.promptText = text; }, updateHUD() {}, setProgress() {}, modal(value) { this.outcome = value; } };
  const game = new Game(world, input, ui, progress, () => {});
  return { game, world, input, ui };
}
function move(game, target) { game.player.x = target.x; game.player.z = target.z; game.player.object.position.set(target.x, 0.55, target.z); }
function pulseAt(game, target) { move(game, target); game.pulseCooldown = 0; game.pulse(); }
function solveRelay(game) {
  const stage = game.stage;
  let solution;
  for (let value = 0; value < 4 ** stage.count; value++) {
    const turns = stage.positions.map((_, i) => Math.floor(value / 4 ** i) % 4);
    if (traceRelays(stage.positions, turns, stage.receiver).complete) { solution = turns; break; }
  }
  assert.ok(solution, "authored relay must have a solution");
  // Downstream devices are deliberately configured first: power is spatial, not a sequence code.
  for (const node of [...game.relayNodes].reverse()) {
    while (node.turn !== solution[node.id]) pulseAt(game, node);
  }
}
function defeat(game, enemy) {
  if (enemy.boss) {
    enemy.stateTime = 0; game.updateBoss(0, enemy);
    assert.equal(enemy.state, "warning");
    enemy.stateTime = 0; game.updateBoss(0, enemy);
    assert.equal(enemy.state, "charge");
    enemy.stateTime = 0; game.updateBoss(0, enemy);
    assert.equal(enemy.state, "exposed");
  }
  while (enemy.active) pulseAt(game, enemy);
}

test("Story has no campaign deadline but still fails on shield damage; arcade remains timed", () => {
  const { game, ui } = harness(createProgress());
  game.begin(findStage("wake")); game.time = .01; game.update(.05);
  assert.equal(game.running, true);
  assert.equal(game.time, 0);
  assert.ok(game.elapsed > 0);
  for (const cell of game.entities.filter(e => e.kind === "cell")) pulseAt(game, cell);
  move(game, game.goal); game.interact();
  assert.equal(ui.outcome.eyebrow, "Mission complete");
  game.begin(findStage("wake")); game.shields = 0; game.update(.01);
  assert.equal(ui.outcome.eyebrow, "Mission incomplete");
  game.begin(BRAWL); game.time = .01; game.update(.05);
  assert.equal(ui.outcome.eyebrow, "Mission incomplete");
});

test("relay mistakes remain recoverable and distant actions never rotate a device", () => {
  const { game } = harness();
  game.begin(findStage("trail"));
  game.interact(); assert.equal(game.relayTurns, 0);
  const downstream = game.relayNodes[2];
  for (let i = 0; i < 4; i++) pulseAt(game, downstream);
  assert.equal(game.running, true);
  assert.equal(game.relayTurns, 4);
  assert.equal(game.relayState.powered.includes(2), false);
  solveRelay(game);
  assert.equal(game.running, false);
  assert.equal(game.relayState.complete, true);
  const turns = game.relayTurns;
  game.interact(); assert.equal(game.relayTurns, turns, "completed puzzle cannot change");
});

test("both shelters accept rescues once and guidance selects the nearest safe destination", () => {
  const { game } = harness();
  game.begin(findStage("split-current"));
  const friends = game.entities.filter(e => e.kind === "creature");
  assert.equal(game.shelters.length, 2);
  for (let index = 0; index < 2; index++) {
    move(game, friends[index]); game.interact();
    const shelter = game.shelters[index]; move(game, shelter);
    assert.equal(game.objectiveTarget().x, shelter.x);
    game.interact(); game.interact();
    assert.equal(game.progressCount, index + 1);
    assert.equal(game.carry, null);
  }
  const markers = mapMarkers(game, null);
  for (const shelter of game.shelters) assert.ok(markers.some(m => m.type === "friend" && m.x === shelter.x && m.z === shelter.z));
});

test("Warden checkpoint persists core damage and requires a nearby free repair before launch", () => {
  const progress = createProgress({ completed: ALL_STAGES.slice(0, -1).map(item => `${item.chapter.id}:${item.stage.id}`) });
  const first = harness(progress);
  let saved;
  first.game.save = value => { saved = JSON.parse(JSON.stringify(value)); return true; };
  first.game.begin(findStage("signalbreak"));
  first.game.core.health = 3; first.game.metrics.damageTaken = 2;
  first.game.time = 0; first.game.elapsed = 201;
  first.game.spawned = first.game.finalWaveCount;
  first.game.updateFinale(0);
  assert.equal(first.game.phase, "warden");
  assert.equal(saved.completed.includes("siege:signalbreak"), false);
  assert.equal(availableCheckpoint(createProgress(saved)).coreHealth, 3);

  const { game, ui } = harness(createProgress(saved));
  game.begin(findStage("signalbreak"), { resumeCheckpoint: true });
  assert.equal(game.phase, "warden");
  assert.equal(game.core.health, 3);
  assert.equal(game.metrics.damageTaken, 2);
  assert.equal(game.elapsed, 201);
  assert.equal(game.time, 0);
  assert.equal(game.shields, game.upgrades.maxShields);
  assert.equal(game.combat.weapon, "bubble");
  assert.equal(game.combat.ammo, 36);
  move(game, game.rocketGoal); game.interact();
  assert.equal(game.running, true, "rocket is locked until the Warden is repaired");
  const escort = game.spawnEnemy(false, 2);
  defeat(game, game.boss); game.updateFinale(0);
  assert.equal(game.phase, "warden", "living escorts block the repair step");
  defeat(game, escort); game.updateFinale(0);
  assert.equal(game.phase, "repair");
  game.combat.scrap = 0;
  move(game, game.rocketGoal); game.interact();
  assert.equal(game.phase, "repair", "repair cannot be installed remotely");
  assert.match(game.objectiveTarget().label, /free repair/);
  move(game, game.wardenRepair); game.interact();
  assert.equal(game.phase, "launch");
  assert.equal(game.combat.scrap, 0);
  move(game, game.rocketGoal); game.interact();
  assert.equal(ui.outcome.eyebrow, "Mission complete");
  assert.equal(game.progress.checkpoint, null);
});

test("all fifteen mission objectives can reach completion through their actions", () => {
  const { game, ui, world } = harness();
  for (const item of ALL_STAGES) {
    game.begin(item);
    const type = item.stage.type;
    if (["collect", "race-collect"].includes(type)) {
      for (const cell of game.entities.filter(e => e.kind === "cell")) pulseAt(game, cell);
      if (game.goal) { move(game, game.goal); game.interact(); }
    } else if (type === "sequence") {
      for (const node of game.entities.filter(e => e.kind === "node")) pulseAt(game, node);
    } else if (type === "relay") {
      solveRelay(game);
    } else if (type === "combat") {
      for (const enemy of game.entities.filter(e => e.kind === "enemy")) defeat(game, enemy);
      move(game, game.goal); game.interact();
    } else if (type === "rescue") {
      for (const friend of game.entities.filter(e => e.kind === "creature")) {
        move(game, friend); game.interact();
        assert.equal(game.carry, friend);
        move(game, game.shelter); game.interact();
      }
      if (game.finalBeacon) {
        assert.equal(game.running, true, "final rescue requires the tide-beacon action");
        move(game, game.finalBeacon); game.updatePrompt();
        assert.match(ui.promptText, /DISABLE TIDE BEACON/);
        game.interact();
      }
    } else if (type === "defense") {
      const time = game.time;
      game.update(10);
      assert.equal(game.time, time, "preparation is untimed");
      for (const pad of game.pads) { move(game, pad.position); game.interact(); }
      assert.equal(game.phase, "ready");
      game.interact();
      move(game, { x: 18, z: 0 });
      for (let t = 0; t < 1800 && game.running; t++) {
        game.update(0.05);
        // Player supplements the line using the same pulse action.
        const enemy = game.entities.find(e => e.active && e.kind === "enemy");
        if (enemy && game.pulseCooldown <= 0) pulseAt(game, enemy);
        move(game, { x: 18, z: 0 });
      }
    } else if (type === "boss") defeat(game, game.boss);
    else if (type === "race") for (const gate of game.gates) { move(game, gate.position); game.updateRace(); }
    else if (type === "finale") {
      for (let i = 0; i < game.finalWaveCount; i++) {
        game.updateFinale(3);
        for (const enemy of game.entities.filter(e => e.active && e.kind === "enemy")) defeat(game, enemy);
      }
      game.updateFinale(0);
      assert.equal(game.phase, "warden");
      defeat(game, game.boss);
      game.updateFinale(0);
      assert.equal(game.phase, "repair");
      move(game, game.wardenRepair); game.interact();
      assert.equal(game.phase, "launch");
      move(game, game.rocketGoal); game.interact();
      assert.equal(game.phase, "complete");
      assert.ok(game.progress.completed.includes("siege:signalbreak"), "finale is saved before departure");
    }
    assert.equal(game.running, false, `${item.stage.id} must end`);
    assert.equal(ui.outcome?.eyebrow, "Mission complete", `${item.stage.id}: ${ui.outcome?.text}`);
  }
  assert.equal(game.progress.completed.length, 15);
  assert.equal(earnedUpgrades(game.progress).freeRoam, true);
});

test("every victory saves once before a skippable, gameplay-frozen departure", () => {
  for (const item of [...ALL_STAGES, BRAWL, ...EXPEDITIONS]) {
    const { game, world, ui, input } = harness();
    let saves = 0, launches = 0;
    game.save = () => saves++;
    world.startCelebration = () => launches++;
    ui.showCelebration = (_name, skip) => { ui.skip = skip; };
    ui.hideCelebration = () => {};
    game.begin(item); game.finish(true, "Well done");
    assert.equal(saves, 1, item.stage.id);
    assert.equal(launches, 1);
    assert.equal(game.running, false);
    assert.equal(input.enabled, false);
    assert.ok(game.pendingResult);
    const time = game.time, shields = game.shields, position = game.player.x;
    input.actions.add("pulse"); input.actions.add("interact");
    game.update(0.5);
    assert.equal(game.time, time); assert.equal(game.shields, shields); assert.equal(game.player.x, position);
    ui.skip(); ui.skip(); game.finish(true, "Duplicate");
    assert.equal(saves, 1); assert.equal(launches, 1);
    assert.equal(game.pendingResult, null);
    assert.ok(ui.outcome);
  }
});

test("departure timeout, replay and stale skip cannot reopen an earlier result", () => {
  const { game, world, ui } = harness();
  world.startCelebration = () => {};
  ui.showCelebration = (_name, skip) => { ui.skip = skip; };
  ui.hideCelebration = () => {};
  game.begin(findStage("wake")); game.finish(true, "First");
  const staleSkip = ui.skip;
  game.begin(findStage("trail")); staleSkip(); game.update(0);
  assert.equal(ui.outcome, null); assert.equal(game.running, true);
  game.finish(true, "Second"); game.update(VICTORY_DURATION);
  assert.equal(ui.outcome.title, "Follow the Light");
  game.stop(); assert.equal(game.pendingResult, null);
});

test("failure has no launch and arcade returns to its own title", () => {
  const { game, world, ui } = harness();
  world.startCelebration = () => assert.fail("A failure must not launch");
  ui.showCelebration = () => assert.fail("A failure must not celebrate");
  game.begin(BRAWL); game.finish(false, "Time expired");
  assert.equal(ui.outcome.eyebrow, "Mission incomplete");
  assert.equal(ui.outcome.actions[1].label, "Back to title");
  assert.equal(game.progress.brawlBest, 0);
});

test("storage failure keeps the win in session without claiming it was saved", () => {
  const { game, world, ui } = harness();
  let persisted;
  game.save = () => false;
  world.startCelebration = () => {};
  ui.showCelebration = (_name, _skip, saved) => { persisted = saved; };
  game.begin(findStage("wake")); game.finish(true, "Complete");
  assert.equal(persisted, false);
  assert.ok(game.progress.completed.includes("signal:wake"));
  game.completeVictory(); assert.match(ui.outcome.text, /session only/);
});

test("an expired or unshielded direct victory request becomes a failure", () => {
  for (const field of ["time", "shields"]) {
    const { game, ui } = harness(); game.begin(findStage("wake"));
    game[field] = 0; game.finish(true, "Too late");
    assert.equal(ui.outcome.eyebrow, "Mission incomplete");
    assert.equal(game.progress.completed.length, 0);
  }
});

test("an arcade field challenge awards exactly 500 points once", () => {
  const { game, ui } = harness(); game.begin(BRAWL);
  game.finish(true, "Complete"); const withoutBonus = ui.outcome.stats[0][0];
  game.begin(BRAWL); game.metrics.recruited = 1;
  game.finish(true, "Complete");
  assert.equal(ui.outcome.stats[0][0], withoutBonus + 500);
  const best = game.progress.brawlBest;
  game.finish(true, "Duplicate"); assert.equal(game.progress.brawlBest, best);
});

test("replays distinguish this run's medals from the persistent best", () => {
  const { game, ui } = harness();
  const item = findStage("wake");
  game.progress = recordResult(game.progress, item.chapter, item.stage, 85, true);
  game.begin(item); game.time = 1; game.finish(true, "Complete");
  assert.deepEqual(ui.outcome.stats.slice(0, 2), [["◆", "this run"], ["◆◆◆", "best medals"]]);
  assert.ok(game.progress.completed.includes("signal:wake"));
  assert.equal(ui.outcome.actions[0].label, "Next mission");
});

test("field challenges count successful calls, repairs and distinct freezes only", () => {
  const { game } = harness(); game.begin(EXPEDITIONS[1]);
  assert.equal(fieldChallenge(game.stage).id, "freeze");
  const enemies = [0, 1, 2].map(i => game.spawnEnemy(false, i));
  enemies.forEach((e, i) => { e.x = game.player.x + i; e.z = game.player.z + 3; });
  game.combat.freezeCharges = 2;
  assert.equal(game.combat.freeze(), true); assert.equal(game.metrics.frozenEnemies, 3);
  game.combat.freeze(); assert.equal(game.metrics.frozenEnemies, 3);
  assert.equal(challengeStatus(game).done, true);
  game.combat.whistles = 0; game.combat.callAnimals(); assert.equal(game.metrics.calls, 0);
  game.combat.whistles = 1; game.combat.callAnimals(); assert.equal(game.metrics.calls, 1);
  game.disableEntity(enemies[0]); move(game, enemies[0]);
  game.combat.scrap = 0; game.combat.repair(); assert.equal(game.metrics.recruited, 0);
  game.combat.scrap = 2; game.combat.repair(); assert.equal(game.metrics.recruited, 1);
  game.combat.repair(); assert.equal(game.metrics.recruited, 1);
});

test("missing challenges never block victory and healing cannot erase damage", () => {
  const { game, ui } = harness(); game.begin(findStage("little-wave"));
  game.damagePlayer(); game.shields = game.upgrades.maxShields;
  assert.equal(challengeStatus(game).done, false);
  game.finish(true, "Rescued"); assert.equal(ui.outcome.eyebrow, "Mission complete");
  assert.match(ui.outcome.text, /not earned this run/);
});

test("boss stops at its charge endpoint and rushing dogs keep their heading", () => {
  const { game } = harness(); game.begin(findStage("captain"));
  const boss = game.boss;
  Object.assign(boss, { x: 0, z: 0, chargeX: 0.2, chargeZ: 0, state: "charge", stateTime: 1 });
  game.updateBoss(0.1, boss);
  assert.equal(boss.x, 0.2); assert.equal(boss.state, "exposed");
  game.begin(BRAWL);
  const dog = game.spawnEnemy(false, 1);
  Object.assign(dog, { x: 0, z: 0, attackState: "rush", attackTime: 0.5, rushX: 1, rushZ: 0 });
  game.player.x = -4; game.player.z = -4;
  game.combat.moveEnemy(dog, game.player, 0.05);
  assert.equal(dog.object.rotation.y, Math.PI / 2);
});

test("search patrol kills do not replace energy cells", () => {
  const { game } = harness(); game.begin(findStage("dark-beach"));
  const enemy = game.entities.find(e => e.kind === "enemy");
  defeat(game, enemy);
  assert.equal(game.progressCount, 0);
  assert.equal(game.goal.locked, true);
});

test("a leaked scout cannot produce a defense victory", () => {
  const { game, ui } = harness(); game.begin(findStage("boardwalk"));
  game.phase = "battle"; game.spawned = game.stage.count;
  const enemy = game.spawnEnemy(false, 0);
  enemy.x = game.relay.x; enemy.z = game.relay.z;
  game.updateEnemies(0); game.updateDefense(0);
  assert.equal(game.escaped, 1);
  assert.equal(ui.outcome.eyebrow, "Mission incomplete");
});

test("deadline and lethal damage take precedence over queued winning actions", () => {
  const { game, input, ui } = harness(); game.begin(findStage("wake"));
  game.goal.locked = false; move(game, game.goal); game.time = 0.01;
  input.actions.add("interact"); game.update(0.05);
  assert.equal(ui.outcome.eyebrow, "Mission incomplete");
  assert.equal(game.progress.completed.length, 0);
  game.begin(findStage("wake"));
  game.goal.locked = false; move(game, game.goal); game.shields = 0;
  input.actions.add("interact"); game.update(0.05);
  assert.equal(ui.outcome.eyebrow, "Mission incomplete");
  assert.equal(game.progress.completed.length, 0);
  game.begin(findStage("sprint"));
  game.progressCount = game.gates.length - 1;
  move(game, game.gates.at(-1).position); game.shields = 0;
  game.update(0.05);
  assert.equal(ui.outcome.eyebrow, "Mission incomplete");
});

test("earned upgrades persist on early-stage replays and are not granted by selection", () => {
  const { game } = harness(); game.begin(findStage("signalbreak"));
  assert.equal(game.upgrades.pulseDamage, 1);
  assert.equal(game.shields, 3);
  for (const item of ALL_STAGES.slice(0, 12)) game.progress = recordResult(game.progress, item.chapter, item.stage, 30, true);
  game.begin(findStage("wake"));
  assert.equal(game.shields, 4);
  assert.equal(game.upgrades.pulseDamage, 2);
  assert.equal(game.upgrades.dashRecharge, 1.8);
});

test("camera-relative forward and a stationary dash move toward the screen's far edge", () => {
  const { game, input } = harness(); game.begin(findStage("wake"));
  input.movement = () => ({ x: 0, y: -1 });
  const before = { x: game.player.x, z: game.player.z };
  game.updatePlayer(0.1);
  assert.ok(game.player.x < before.x && game.player.z < before.z);
  input.movement = () => ({ x: 0, y: 0 });
  const x = game.player.x;
  game.dash(); game.updatePlayer(0.1);
  assert.ok(game.player.x < x);
});

test("boss shield blocks damage until the telegraphed charge ends", () => {
  const { game } = harness(); game.begin(findStage("captain"));
  pulseAt(game, game.boss);
  assert.equal(game.boss.health, game.boss.maxHealth);
  defeat(game, game.boss);
  assert.equal(game.boss.active, false);
});

test("mission disposal frees unique resources and preserves cached Blender geometry", () => {
  const sharedGeometry = new THREE.BoxGeometry();
  const sharedMaterial = new THREE.MeshStandardMaterial();
  const uniqueMaterial = sharedMaterial.clone();
  const uniqueGeometry = new THREE.RingGeometry();
  const group = new THREE.Group();
  group.add(new THREE.Mesh(sharedGeometry, uniqueMaterial), new THREE.Mesh(uniqueGeometry, sharedMaterial));
  let sharedDisposed = 0, uniqueDisposed = 0;
  for (const resource of [sharedGeometry, sharedMaterial]) resource.addEventListener("dispose", () => sharedDisposed++);
  for (const resource of [uniqueGeometry, uniqueMaterial]) resource.addEventListener("dispose", () => uniqueDisposed++);
  World.prototype.release.call({ assetResources: new Set([sharedGeometry, sharedMaterial]) }, group);
  assert.equal(sharedDisposed, 0);
  assert.equal(uniqueDisposed, 2);
});

test("weapons are pickups, consume ammunition on shots, and never replace unlimited pulse", () => {
  const { game } = harness(); game.begin(BRAWL);
  const c = game.combat;
  assert.equal(c.shoot(), false);
  c.collect(c.pickups.find(p => p.type === "bubble"));
  assert.equal(c.weapon, "bubble");
  assert.equal(c.ammo, 36);
  assert.equal(c.shoot(), false, "no enemy means no ammunition wasted");
  const enemy = game.spawnEnemy(false, 0);
  Object.assign(enemy, { x: game.player.x + 3, z: game.player.z });
  assert.equal(c.shoot(), true);
  assert.equal(c.ammo, 35);
  c.updateBullets(0.2);
  assert.equal(enemy.health, 1, "swept bullet should hit the tiny target");
  c.ammo = 0;
  pulseAt(game, enemy);
  assert.equal(enemy.active, false);
});

test("freeze interrupts dog pounces and drone dives without opening boss shields", () => {
  const { game } = harness(); game.begin(BRAWL);
  const c = game.combat;
  c.freezeCharges = 1;
  const dog = game.spawnEnemy(false, 1);
  const drone = game.spawnEnemy(false, 2);
  Object.assign(dog, { x: 1, z: 8, attackState: "rush" });
  Object.assign(drone, { x: 2, z: 8, attackState: "rush" });
  assert.equal(c.freeze(), true);
  assert.equal(dog.frozen, 5); assert.equal(drone.frozen, 5);
  const before = { x: dog.x, z: dog.z };
  game.updateEnemies(1);
  assert.deepEqual({ x: dog.x, z: dog.z }, before);
  assert.equal(dog.attackState, "recover");
  game.begin(findStage("captain"));
  game.combat.freezeCharges = 1; move(game, game.boss);
  game.combat.freeze();
  assert.equal(game.boss.frozen, 1.5);
  game.combat.hit(game.boss, 20);
  assert.equal(game.boss.health, game.boss.maxHealth);
});

test("repairs spend scrap once and recruited robots fight only hostiles", () => {
  const { game } = harness(); game.begin(BRAWL);
  const bot = game.spawnEnemy(false, 0), dog = game.spawnEnemy(false, 1);
  defeat(game, bot); defeat(game, dog);
  assert.equal(game.combat.scrap, 2);
  move(game, bot); game.interact();
  assert.equal(bot.kind, "ally");
  assert.equal(game.combat.scrap, 0);
  assert.equal(game.combat.kills, 2);
  assert.equal(game.combat.repair(), false, "the same ally cannot be repaired twice");
  const target = game.spawnEnemy(false, 2);
  target.x = bot.x + 2; target.z = bot.z;
  game.combat.updateAllies(1);
  assert.equal(target.health, 1);
  assert.equal(bot.active, true);
  assert.equal(game.combat.hit(bot, 99), false, "friendly fire cannot change objectives or drop scrap");
});

test("animal calls have a duration and a bounded crew", () => {
  const { game } = harness(); game.begin(BRAWL);
  game.combat.whistles = 2;
  game.combat.callAnimals(); game.combat.callAnimals();
  assert.equal(game.combat.animals.length, 3);
  assert.equal(game.combat.whistles, 0);
  game.combat.updateAllies(15);
  assert.ok(game.combat.animals.every(animal => !animal.object.visible));
});

test("arc weapon chains at most three nearby hostiles", () => {
  const { game } = harness(); game.begin(BRAWL);
  game.combat.collect(game.combat.pickups.find(p => p.type === "arc"));
  for (let i = 0; i < 4; i++) {
    const e = game.spawnEnemy(false, i);
    e.x = game.player.x + 2 + i; e.z = game.player.z;
  }
  game.combat.shoot();
  assert.equal(game.combat.kills, 3);
  assert.equal(game.combat.enemies().length, 1);
});

test("three brawl waves finish without unlocking or corrupting campaign progress", () => {
  const { game, ui } = harness(); game.begin(BRAWL);
  const variants = new Set();
  for (let tick = 0; tick < 1000 && game.running; tick++) {
    game.combat.updateBrawl(0.5);
    for (const enemy of game.combat.enemies()) {
      variants.add(enemy.variant);
      assert.equal(enemy.maxHealth, game.combat.wave + 1);
      defeat(game, enemy);
    }
  }
  assert.equal(ui.outcome.eyebrow, "Brawl won");
  assert.equal(game.combat.kills, 24);
  assert.equal(variants.size, 3, "every enemy type appears regardless of defeat timing");
  assert.equal(game.progress.completed.length, 0);
  assert.ok(game.progress.brawlBest >= 2400);
  const previous = game.combat;
  game.begin(BRAWL);
  assert.notEqual(game.combat, previous);
  assert.equal(game.combat.scrap, 0);
  assert.equal(game.combat.bullets.length, 0);
});

test("repairable bodies, allies, loot, and projectiles stay bounded", () => {
  const { game, world } = harness(); game.begin(BRAWL);
  const c = game.combat;
  for (let i = 0; i < 20; i++) {
    const enemy = game.spawnEnemy(false, i);
    c.hit(enemy, enemy.health);
  }
  assert.equal(game.entities.filter(e => e.repairable).length, 6);
  assert.equal(game.entities[0].object.parent, null, "old bodies must be released, not merely hidden");
  const candidates = game.entities.filter(e => e.repairable);
  for (const enemy of candidates.slice(0, 4)) { move(game, enemy); c.repair(); }
  assert.equal(game.entities.filter(e => e.kind === "ally").length, 3);
  assert.equal(c.scrap, 14, "a full team must not consume repair scrap");
  for (let i = 0; i < 30; i++) c.addPickup("shield", { x: 0, z: 0 });
  assert.equal(c.pickups.length, 18);
  for (let i = 0; i < 40; i++) c.makeBolt([game.player, { x: 0, z: 0 }], 0xffffff);
  assert.equal(c.bullets.length, 28);
  c.collect(c.pickups.find(p => p.type === "bubble"));
  c.cooldown = 0;
  assert.equal(c.shoot(), false);
  assert.equal(c.ammo, 36, "effect saturation cannot waste ammo");
  c.updateBullets(1);
  assert.equal(c.bullets.length, 0);
  game.stop();
  assert.equal(world.mission.children.length, 0);
});

test("dogs and drones telegraph a fixed, dodgeable attack before touching the player", () => {
  const { game } = harness(); game.begin(BRAWL);
  for (const index of [1, 2]) {
    const enemy = game.spawnEnemy(false, index);
    Object.assign(enemy, { x: 0, z: 9 });
    game.combat.moveEnemy(enemy, game.player, 0.05);
    assert.equal(enemy.attackState, "windup");
    assert.ok(enemy.warningLine);
    const rushX = enemy.rushX;
    move(game, { x: 5, z: 13 });
    game.combat.moveEnemy(enemy, game.player, 1);
    assert.equal(enemy.attackState, "rush");
    assert.equal(enemy.rushX, rushX, "warning direction cannot secretly retarget the player");
    assert.equal(enemy.warningLine, null);
    enemy.active = false;
    move(game, { x: 0, z: 13 });
  }
});

test("unavailable or capped consumables never waste inventory", () => {
  const { game } = harness(); game.begin(BRAWL);
  const c = game.combat;
  c.freezeCharges = 1;
  assert.equal(c.freeze(), false);
  assert.equal(c.freezeCharges, 1);
  c.freezeCharges = 3;
  const ice = c.pickups.find(p => p.type === "freeze");
  c.collect(ice);
  assert.equal(ice.active, true);
  assert.equal(c.freezeCharges, 3);
  c.addPickup("shield", game.player);
  const shield = c.pickups.find(p => p.type === "shield");
  c.collect(shield);
  assert.equal(shield.active, true);
  game.shields--;
  c.collect(shield);
  assert.equal(shield.active, false);
  assert.equal(game.shields, game.upgrades.maxShields);
});

test("optional loot guidance never hides required campaign actions or wastes shots on a boss shield", () => {
  const { game } = harness(); game.begin(findStage("boardwalk"));
  assert.match(game.objectiveTarget().label, /build/);
  game.phase = "ready";
  assert.match(game.objectiveTarget().label, /Defense ready/);
  game.begin(findStage("captain"));
  const c = game.combat;
  c.collect(c.pickups.find(p => p.type === "bubble"));
  move(game, game.boss);
  assert.equal(c.shoot(), false);
  assert.equal(c.ammo, 36);
  game.boss.state = "exposed";
  assert.equal(c.shoot(), true);
  game.begin(ALL_STAGES.find(item => item.stage.type === "combat"));
  for (const enemy of game.combat.enemies()) defeat(game, enemy);
  assert.match(game.objectiveTarget().label, /Gold beacon/);
});

function clearExpeditionPatrols(game) {
  for (let tick = 0; tick < 80 && !game.expedition.patrolsClear(); tick++) {
    game.expedition.update(4);
    for (const enemy of game.combat.enemies()) game.combat.hit(enemy, enemy.health);
  }
  assert.equal(game.expedition.patrolsClear(), true);
  assert.equal(game.combat.kills, game.stage.patrols);
}

test("three expeditions have distinct, finite, reachable action paths", () => {
  const { game, ui } = harness();
  assert.equal(new Set(EXPEDITIONS.map(item => item.stage.mode)).size, 3);
  for (const item of EXPEDITIONS) {
    game.begin(item);
    const e = game.expedition;
    assert.equal(game.shields, 5);
    move(game, e.exit); game.interact();
    assert.equal(game.running, true, "exit cannot bypass the objective");
    if (e.mode === "rescue") for (const friend of e.friends) {
      move(game, friend); game.interact();
      assert.equal(game.carry, friend);
      move(game, e.sanctuary); game.interact();
      assert.equal(game.carry, null);
      assert.equal(friend.active, false);
    }
    if (e.mode === "salvage") for (const item of e.discoveries.filter(d => d.missionDisc)) {
      move(game, item); e.update(0);
      assert.equal(item.active, false);
    }
    clearExpeditionPatrols(game);
    if (e.mode === "escort") for (let tick = 0; tick < 1000 && e.checkpoint < 3; tick++) {
      move(game, e.snail); e.updateEscort(0.05);
    }
    assert.equal(e.taskComplete(), true);
    move(game, e.exit); game.interact();
    assert.equal(game.running, false);
    assert.equal(ui.outcome.eyebrow, "Expedition complete");
    assert.ok(game.progress.expeditionResults[item.stage.id] > 0);
  }
  assert.equal(game.progress.completed.length, 0);
  assert.equal(game.progress.brawlBest, 0);
});

test("equipment migration rejects unknown, unowned and wrong-slot saved items", () => {
  const equipment = normalizeEquipment({ owned: ["turbo", "turbo", "armor", "evil"], paint: "unknown", equipped: { software: "frost", body: "turbo", head: "antenna", back: "__proto__" } });
  assert.deepEqual(equipment.owned, ["turbo", "armor"]);
  assert.equal(equipment.paint, "lagoon");
  assert.ok(Object.values(equipment.equipped).every(v => v === null));
  assert.equal(equipItem(equipment, "frost"), false);
  assert.equal(equipItem(equipment, "turbo"), true);
  const restored = createProgress({ equipment, expeditionResults: { coral: 100, moonpool: -9, unknown: 10 }, completed: ["signal:wake"] });
  assert.equal(restored.equipment.equipped.software, "turbo");
  assert.deepEqual(restored.expeditionResults, { coral: 100 });
  assert.equal(restored.completed[0], "signal:wake");
});

test("discs install one software choice, survive a failed run and cannot stack bonuses", () => {
  const { game } = harness(); game.begin(EXPEDITIONS[1]);
  const turbo = game.expedition.discoveries.find(d => d.id === "turbo");
  game.expedition.collect(turbo);
  const speed = game.player.speed;
  assert.equal(speed, 6.3 * 1.12);
  assert.equal(game.expedition.collect(turbo), false);
  for (let i = 0; i < 10; i++) game.refreshEquipment(true);
  assert.equal(game.player.speed, speed);
  game.expedition.collect(game.expedition.discoveries.find(d => d.id === "overclock"));
  assert.equal(game.player.speed, 6.3);
  assert.equal(game.upgrades.fireRate, 0.82);
  game.finish(false, "test retry");
  const saved = createProgress(JSON.parse(JSON.stringify(game.progress)));
  const resumed = harness(saved).game; resumed.begin(BRAWL);
  assert.equal(resumed.upgrades.fireRate, 0.82);
  assert.deepEqual(resumed.progress.equipment.owned, ["turbo", "overclock"]);
  assert.equal(resumed.progress.completed.length, 0);
});

test("physical parts attach once, preserve lost shields and persist across missions", () => {
  const { game } = harness(); game.begin(EXPEDITIONS[0]);
  game.shields = 3;
  game.expedition.collect(game.expedition.discoveries.find(d => d.id === "armor"));
  assert.equal(game.upgrades.maxShields, 6);
  assert.equal(game.shields, 4);
  for (let i = 0; i < 5; i++) game.refreshEquipment(true);
  assert.equal(game.shields, 4, "re-equipping cannot manufacture shield refills");
  for (const id of ["thrusters", "antenna"]) { game.progress.equipment.owned.push(id); equipItem(game.progress.equipment, id); }
  game.refreshEquipment(true);
  assert.equal(game.player.object.userData.attachments.length, 3);
  assert.equal(game.player.object.children.filter(c => c.userData.equipmentSlot).length, 3);
  assert.equal(game.upgrades.dashRecharge, 2);
  assert.equal(game.upgrades.pulseRadius, 3.95);
  game.begin(findStage("wake"));
  assert.equal(game.shields, 4);
  assert.equal(game.player.object.userData.attachments.length, 3);
});

test("Frost OS grants one starting charge and weapon software changes real cooldown", () => {
  const progress = createProgress({ equipment: { owned: ["frost", "overclock"], equipped: { software: "frost" } } });
  const { game } = harness(progress); game.begin(BRAWL);
  assert.equal(game.combat.freezeCharges, 1);
  game.refreshEquipment(true);
  assert.equal(game.combat.freezeCharges, 1);
  equipItem(game.progress.equipment, "overclock"); game.refreshEquipment(true);
  game.combat.collect(game.combat.pickups.find(p => p.type === "bubble"));
  const target = game.spawnEnemy(false, 0); target.x = game.player.x + 4; target.z = game.player.z;
  game.combat.shoot();
  assert.equal(game.combat.cooldown, 0.24 * 0.82);
  assert.equal(equipmentStats(earnedUpgrades(progress), progress.equipment).fireRate, 0.82);
});

test("NORI waits for the player and blocking enemies instead of failing off screen", () => {
  const { game } = harness(); game.begin(EXPEDITIONS[2]);
  const e = game.expedition, before = { x: e.snail.x, z: e.snail.z };
  move(game, { x: 17, z: 0 }); e.updateEscort(1);
  assert.equal(e.escortState, "waiting for you");
  assert.deepEqual({ x: e.snail.x, z: e.snail.z }, before);
  const enemy = game.spawnEnemy(false, 0); enemy.x = e.snail.x; enemy.z = e.snail.z;
  move(game, e.snail); e.updateEscort(1);
  assert.equal(e.escortState, "clear nearby bots");
  game.combat.hit(enemy, enemy.health); e.updateEscort(1);
  assert.equal(e.escortState, "parading");
  assert.ok(Math.hypot(e.snail.x - before.x, e.snail.z - before.z) > 1);
});

test("clam healing has a cooldown and octopus ink slows hostiles", () => {
  const { game } = harness(); game.begin(EXPEDITIONS[0]);
  const e = game.expedition;
  move(game, e.clam); game.interact();
  assert.equal(e.clamCooldown, 0);
  game.shields = 2; game.interact();
  assert.equal(game.shields, 3); assert.equal(e.clamCooldown, 16);
  game.interact(); assert.equal(game.shields, 3);
  const enemy = game.spawnEnemy(false, 0);
  enemy.x = e.helper.x + 1; enemy.z = e.helper.z;
  e.update(0.05);
  assert.equal(enemy.inkSlow, 4);
  const before = enemy.x;
  game.combat.moveEnemy(enemy, { x: enemy.x + 10, z: enemy.z }, 1);
  assert.ok(enemy.x - before < enemy.speed, "ink must reduce real movement, not just display a cue");
});

test("minimap matches camera controls and excludes collected loot and defeated enemies", () => {
  const { game } = harness(); game.begin(EXPEDITIONS[0]);
  const yaw = game.world.cameraYaw;
  const forward = mapPoint({ x: -Math.sin(yaw), z: -Math.cos(yaw) }, yaw);
  assert.ok(Math.abs(forward.x - 80) < 0.001 && forward.y < 80);
  const e = game.spawnEnemy(false, 0);
  assert.ok(mapMarkers(game, e).some(m => m.type === "enemy"));
  game.combat.hit(e, e.health);
  const disc = game.expedition.discoveries[0]; game.expedition.collect(disc);
  const markers = mapMarkers(game, game.objectiveTarget());
  assert.ok(!markers.some(m => m.type === "enemy"));
  assert.ok(!markers.some(m => m.type === "loot" && m.id === disc.id));
  assert.equal(markers.filter(m => m.type === "player").length, 1);
  assert.equal(markers.filter(m => m.type === "target").length, 1);
});

test("expedition pause and failure return to expeditions, and deadline wins over exit input", () => {
  const { game, ui, input } = harness(); game.begin(EXPEDITIONS[0]);
  game.pause();
  assert.equal(ui.outcome.actions.at(-1).label, "Expeditions");
  const remaining = game.time; game.update(1);
  assert.equal(game.time, remaining);
  ui.outcome.actions[0].run();
  game.expedition.rescued = 3; game.expedition.spawned = game.stage.patrols;
  move(game, game.expedition.exit); game.time = 0.01;
  input.actions.add("interact"); game.update(0.05);
  assert.equal(ui.outcome.eyebrow, "Mission incomplete");
  assert.equal(ui.outcome.actions.at(-1).label, "Expeditions");
  assert.equal(game.progress.expeditionResults.coral, undefined);
});
