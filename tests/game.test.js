import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Game } from "../src/game.js";
import { World } from "../src/world.js";
import { ALL_STAGES, findStage } from "../src/missions.js";
import { createProgress, earnedUpgrades, recordResult } from "../src/rules.js";

function harness(progress = createProgress()) {
  const mission = new THREE.Group();
  const world = {
    mission, cameraYaw: Math.PI / 6, launches: 0,
    clearMission: () => mission.clear(),
    createActor: (_name, p) => {
      const object = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
      object.position.set(p.x, 0.55, p.z); mission.add(object); return object;
    },
    createMarker: () => { const group = new THREE.Group(); group.userData.ring = new THREE.Group(); mission.add(group); return group; },
    createRoute: () => { const line = new THREE.Group(); mission.add(line); return line; },
    release: object => object.removeFromParent(), pulse: () => {}, launchRocket: () => { world.launches++; },
  };
  const input = { enabled: false, actions: new Set(), clear() { this.actions.clear(); }, consume(action) { return this.actions.delete(action); }, movement: () => ({ x: 0, y: 0 }) };
  const ui = { outcome: null, message() {}, dialogue() {}, showGame() { this.outcome = null; }, prompt(text) { this.promptText = text; }, updateHUD() {}, setProgress() {}, modal(value) { this.outcome = value; } };
  const game = new Game(world, input, ui, progress, () => {});
  return { game, world, input, ui };
}
function move(game, target) { game.player.x = target.x; game.player.z = target.z; game.player.object.position.set(target.x, 0.55, target.z); }
function pulseAt(game, target) { move(game, target); game.pulseCooldown = 0; game.pulse(); }
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
      assert.equal(game.phase, "launch");
      move(game, game.rocketGoal); game.interact();
      assert.equal(world.launches, 1);
      assert.equal(game.phase, "celebrate");
      game.update(5.1);
    }
    assert.equal(game.running, false, `${item.stage.id} must end`);
    assert.equal(ui.outcome?.eyebrow, "Mission complete", `${item.stage.id}: ${ui.outcome?.text}`);
  }
  assert.equal(game.progress.completed.length, 15);
  assert.equal(earnedUpgrades(game.progress).freeRoam, true);
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
