import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Game } from "../src/game.js";
import { World } from "../src/world.js";
import { ALL_STAGES, BRAWL, findStage } from "../src/missions.js";
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
