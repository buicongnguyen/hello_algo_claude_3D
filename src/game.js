import * as THREE from "three";
import { applyHit, earnedUpgrades, medalFor, recordResult, sequenceStep, availableCheckpoint } from "./rules.js";
import { Combat } from "./combat.js";
import { Expedition } from "./expeditions.js";
import { dressRobot, equipmentStats } from "./equipment.js";
import { actorHeight, VICTORY_DURATION } from "./presentation.js";
import { challengeStatus, runSummary } from "./mission-report.js";
import { ALL_STAGES } from "./missions.js";
import { isStoryMode, storyFor } from "./story.js";
import { DIRECTIONS, traceRelays } from "./relay.js";
import { DiscoveryActivity } from "./discovery.js";
import { fitTravelRig } from "./districts.js";
import { ENVIRONMENTS } from "./journey-data.js";

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class Game {
  constructor(world, input, ui, progress, save) {
    this.world = world;
    this.input = input;
    this.ui = ui;
    this.progress = progress;
    this.save = save;
    this.running = false;
    this.paused = false;
    this.entities = [];
    this.effects = [];
  }

  begin(item, { resumeCheckpoint = false } = {}) {
    const checkpoint = resumeCheckpoint && item.stage.id === "signalbreak" ? availableCheckpoint(this.progress) : null;
    this.cancelVictory();
    this.item = item;
    this.stage = item.stage;
    this.world.clearMission();
    this.world.setScenario?.(this.stage.theme || null);
    if (storyFor(item)) this.world.setDistrict?.(item);
    this.expedition = null;
    this.discovery = null;
    this.input.clear();
    this.entities = [];
    this.time = this.stage.time;
    this.storyMode = isStoryMode(item, this.progress);
    this.elapsed = 0;
    this.progressCount = 0;
    this.sequenceIndex = 0;
    this.upgrades = earnedUpgrades(this.progress);
    this.shields = this.upgrades.maxShields;
    this.invulnerable = 0;
    this.pulseCooldown = 0;
    this.dashCooldown = 0;
    this.dashTime = 0;
    this.carry = null;
    this.goal = null;
    this.shelter = null;
    this.shelters = [];
    this.finalBeacon = null;
    this.rocketGoal = null;
    this.relay = null;
    this.relayTurns = 0;
    this.relayLines = [];
    this.relayState = null;
    this.wardenRepair = null;
    this.boss = null;
    this.tide = null;
    this.core = null;
    this.hazards = [];
    this.turrets = [];
    this.pads = [];
    this.gates = [];
    this.wrongActions = 0;
    this.metrics = { damageTaken: 0, recruited: 0, calls: 0, frozenEnemies: 0 };
    this.phase = "active";
    this.spawned = 0;
    this.escaped = 0;
    this.spawnTimer = 1;
    this.hudElapsed = 0.1;
    this.world.setCampaign?.(this.progress);
    this.player = { x: 0, z: 13, speed: 6.3, radius: 0.9, object: this.world.createActor("kai", { x: 0, z: 13 }, 0.94) };
    this.player.object.rotation.y = Math.PI;
    this.lastMove = { x: -Math.sin(this.world.cameraYaw || 0), z: -Math.cos(this.world.cameraYaw || 0) };
    this.setupMission();
    this.combat = new Combat(this);
    this.refreshEquipment(false);
    fitTravelRig(this.world,this.player.object,ENVIRONMENTS[this.stage.scene]?.travel);
    if (["scan","escort","homecoming"].includes(this.stage.type)) this.discovery = new DiscoveryActivity(this);
    if (this.combat.enabled && this.progress.equipment.equipped.software === "frost") this.combat.freezeCharges = 1;
    if (this.stage.type === "expedition") this.expedition = new Expedition(this);
    if (checkpoint) this.enterWarden(checkpoint);
    this.ui.showGame(item);
    this.running = true;
    this.paused = false;
    this.input.enabled = true;
    this.ui.dialogue(checkpoint ? [{ speaker: "LUMA", text: "Checkpoint restored. The core remembers its damage; your shield and Bubble Blaster are ready." }] : this.stage.dialogue);
    this.ui.message(checkpoint ? "Warden checkpoint restored" : "Mission started");
  }

  refreshEquipment(preserveHealth = true) {
    const previousMax = this.upgrades.maxShields;
    this.upgrades = equipmentStats(earnedUpgrades(this.progress), this.progress.equipment, ["brawl", "expedition"].includes(this.stage.type));
    this.shields = preserveHealth ? Math.min(this.upgrades.maxShields, this.shields + Math.max(0, this.upgrades.maxShields - previousMax)) : this.upgrades.maxShields;
    this.player.speed = this.upgrades.moveSpeed;
    dressRobot(this.world, this.player.object, this.progress.equipment);
  }

  setupMission() {
    const type = this.stage.type;
    if (["collect", "race-collect"].includes(type)) this.setupCollect(type === "race-collect");
    else if (type === "sequence") this.setupSequence();
    else if (type === "relay") this.setupRelays();
    else if (type === "combat") this.setupCombat();
    else if (type === "rescue") this.setupRescue();
    else if (type === "defense") this.setupDefense();
    else if (type === "boss") this.setupBoss(false);
    else if (type === "race") this.setupRace();
    else if (type === "finale") this.setupFinale();
  }

  setupCollect(moving = false) {
    const positions = this.stage.positions || this.routePositions(this.stage.count);
    positions.forEach((position, index) => this.entities.push(this.makeEntity("cell", "energy_cell", position, 1.22, { id: index, moving, angle: index })));
    if (this.stage.goal) {
      this.goal = this.stage.id === "wake"
        ? { kind: "goal", ...this.stage.goal, locked: true }
        : this.makeEntity("goal", "beacon", this.stage.goal, 0.9, { locked: true });
      this.goal.marker = this.world.createMarker(this.stage.goal, 0xffd166, 1.45);
    }
    if (this.stage.enemies) for (let index = 0; index < this.stage.enemies; index += 1) this.spawnEnemy(false, index);
  }

  setupSequence() {
    this.expected = this.stage.positions.map((_, index) => index);
    const colors = [0x65e5ff, 0xffd166, 0xbf8cff];
    this.stage.positions.forEach((position, index) => {
      const entity = this.makeEntity("node", "beacon", position, 0.82, { id: index, label: this.stage.labels[index] });
      this.cloneMaterials(entity.object);
      entity.marker = this.world.createMarker(position, colors[index], 1.35);
      const label = this.world.label?.(entity.object, `${index + 1} · ${entity.label}`, colors[index], 3.2);
      if (this.stage.id === "core") {
        const height = 1 + index * 0.45;
        entity.object.scale.y *= height;
        if (label) label.scale.y /= height;
      }
      this.entities.push(entity);
    });
    this.world.createRoute(this.stage.positions, 0xffffff);
  }

  setupCombat() {
    this.stage.positions.forEach((_, index) => this.spawnEnemy(false, index));
    if (!this.stage.goal) return;
    this.goal = this.makeEntity("goal", "beacon", this.stage.goal, 0.95, { locked: true });
    this.goal.marker = this.world.createMarker(this.stage.goal, 0xffd166, 1.5);
  }

  setupRelays() {
    this.relayNodes = this.stage.positions.map((position, id) => {
      const node = this.makeEntity("relay-node", "beacon", position, .82, { id, turn: this.stage.turns[id] });
      node.marker = this.world.createMarker(position, 0x65e5ff, 1.1);
      const heading = new THREE.Group();
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(.32, .9, 3), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
      arrow.rotation.x = -Math.PI / 2; arrow.position.z = -1.3; heading.add(arrow);
      heading.position.set(position.x, 1.85, position.z); this.world.mission.add(heading);
      node.heading = heading;
      this.world.label?.(node.object, `${String.fromCharCode(65 + id)} · ${this.stage.labels[id]}`, 0xffffff, 3);
      this.entities.push(node); return node;
    });
    this.receiver = this.makeEntity("receiver", "energy_cell", this.stage.receiver, 1.2);
    this.receiver.marker = this.world.createMarker(this.stage.receiver, 0xffd166, 1.4);
    this.world.label?.(this.receiver.object, "RECEIVER", 0xffd166, 2.3);
    this.world.createActor("energy_cell", this.stage.source, .85);
    this.world.createRoute([this.stage.source, this.stage.positions[0]], 0x65e5ff, { beam: true });
    this.refreshRelays();
  }

  refreshRelays() {
    for (const line of this.relayLines) this.world.release?.(line);
    this.relayState = traceRelays(this.stage.positions, this.relayNodes.map(node => node.turn), this.stage.receiver);
    this.relayLines = this.relayState.outputs.map((output, id) => {
      this.relayNodes[id].heading.rotation.y = -this.relayNodes[id].turn * Math.PI / 2;
      this.relayNodes[id].heading.children[0].material.color.setHex(output.powered ? 0xffd166 : 0x71899c);
      return this.world.createRoute([output.from, output.to], output.powered ? 0x65e5ff : 0x536778, { beam: output.powered });
    });
    this.progressCount = this.relayState.outputs.filter(output => output.powered && output.hit !== null).length;
  }

  turnRelay(range = 2.5) {
    if (!this.running) return;
    const node = [...this.relayNodes].sort((a, b) => distance(a, this.player) - distance(b, this.player))[0];
    if (!node || distance(node, this.player) > range) return this.ui.message("Move beside a relay. Q or E turns its arrow clockwise.", true);
    node.turn = (node.turn + 1) % 4; this.relayTurns++;
    this.world.pulse(node, 1, 0xffd166); this.refreshRelays();
    if (this.relayState.complete) return this.finish(true, "Every relay carries power into the receiver. The repaired network answers.");
    this.ui.message(`Relay ${String.fromCharCode(65 + node.id)} points ${DIRECTIONS[node.turn].name}. ${this.relayState.powered.includes(node.id) ? "Follow its beam." : "It is waiting for upstream power."}`);
  }

  setupRescue() {
    this.stage.positions.forEach((position, index) => {
      const creature = this.makeEntity("creature", ["crab", "starfish", "octopus", "snail", "clam"][index % 5], position, 0.88 + (index % 2) * 0.08, { id: index });
      creature.marker = this.world.createMarker(position, 0x65e5ff, 1.1);
      this.entities.push(creature);
    });
    this.shelters = (this.stage.shelters || [this.stage.goal]).map(position => {
      const shelter = this.makeEntity("shelter", "beacon", position, 1.05, {});
      shelter.marker = this.world.createMarker(position, 0x4cde8a, 2.0);
      this.world.label?.(shelter.object, "SAFE SHELTER", 0x4cde8a, 2.8);
      return shelter;
    });
    this.shelter = this.shelters[0];
    const tideMat = new THREE.MeshBasicMaterial({ color: 0x1e9fe0, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
    this.tide = new THREE.Mesh(new THREE.RingGeometry(12, 32, 64), tideMat);
    this.tide.rotation.x = -Math.PI / 2;
    this.tide.position.y = 0.61;
    this.tide.scale.setScalar(1.7);
    this.tide.visible = !this.stage.scene;
    this.world.mission.add(this.tide);
    if (this.stage.hazards) this.createHazards(3);
    if (this.stage.finalBeacon) {
      this.finalBeacon = this.makeEntity("final-beacon", "beacon", this.stage.finalBeacon, 0.92, { locked: true });
      this.finalBeacon.marker = this.world.createMarker(this.stage.finalBeacon, 0xff7b4b, 1.45);
    }
  }

  setupDefense() {
    this.relay = this.makeEntity("relay", "beacon", { x: 0, z: -11 }, 1.1, {});
    this.relay.marker = this.world.createMarker({ x: 0, z: -11 }, 0x65e5ff, 1.8);
    const pads = this.stage.pads === 2 ? [{ x: -6, z: -3 }, { x: 6, z: -3 }] : [{ x: -7, z: -3 }, { x: 0, z: -3 }, { x: 7, z: -3 }];
    this.approaches = pads.map(position => ({ x: position.x, z: 14 }));
    this.approaches.forEach(position => this.world.createRoute([position, this.relay], 0xff765f));
    this.pads = pads.slice(0, this.stage.pads).map((position, index) => ({ position, index, placed: false, marker: this.world.createMarker(position, 0xffd166, 1.55) }));
    this.phase = "prepare";
    if (this.stage.prebuilt) {
      for (const pad of this.pads) {
        pad.placed = true; pad.marker.visible = false;
        this.turrets.push({...pad.position, object:this.world.createActor("turret",pad.position,1),cooldown:0});
      }
      this.phase = "battle";
    }
    this.ui.message(this.stage.prebuilt ? "Turrets online · protect the receiver" : `Place ${this.stage.pads} solar turrets`);
  }

  setupBoss(finale) {
    this.boss = this.spawnEnemy(true, 0, finale ? 20 : this.stage.health);
    this.boss.x = 0;
    this.boss.z = -8;
    this.boss.object.position.set(0, 0.55, -8);
    this.boss.state = "shielded";
    this.boss.stateTime = 2.4;
    this.boss.final = finale;
    this.boss.cycles = 0;
  }

  setupRace() {
    this.gates = (this.stage.gatePositions || this.routePositions(this.stage.count)).map((position, index) => {
      const group = new THREE.Group();
      const color = index === 0 ? 0xffd166 : 0x65e5ff;
      const torus = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.13, 10, 36), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6 }));
      torus.rotation.x = Math.PI / 2;
      torus.position.y = 0.85;
      group.add(torus);
      this.world.label?.(group, String(index + 1), color, 2.5);
      group.position.set(position.x, 0, position.z);
      this.world.mission.add(group);
      return { position, object: group, active: index === 0, index };
    });
    this.world.createRoute(this.gates.map(gate => gate.position), 0xffd166);
    if (this.stage.hazards) this.createHazards(4);
  }

  setupFinale() {
    this.core = this.makeEntity("core", "energy_cell", { x: 0, z: -6 }, 1.35, { health: 5 });
    this.core.marker = this.world.createMarker({ x: 0, z: -6 }, 0xbf8cff, 2.1);
    this.phase = "defend";
    this.finalWaveCount = 6;
    this.rocketGoal = { kind: "rocket-goal", x: -13, z: -9, locked: true };
  }

  makeEntity(kind, model, position, scale, extras = {}) {
    const object = this.world.createActor(model, position, scale);
    return { kind, object, x: position.x, z: position.z, radius: 0.9, active: true, ...extras };
  }

  spawnEnemy(boss = false, index = 0, health = boss ? 12 : 2) {
    const angle = index * 2.31 + 0.6;
    const radius = boss ? 10 : 14 + (index % 3);
    let position = this.stage.type === "defense" && !boss
      ? this.approaches[index % this.approaches.length]
      : this.stage.type === "combat" ? this.stage.positions[index] : { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
    if (["brawl", "expedition"].includes(this.stage.type) && distance(position, this.player) < 8) position = { x: -position.x, z: -position.z };
    const variant = boss ? "captain" : ["bot", "dog", "drone"][index % 3];
    const model = variant === "dog" ? "zombie_dog" : variant === "drone" ? "rust_drone" : "rust_scout";
    const enemy = this.makeEntity(boss ? "boss" : "enemy", model, position, boss ? 1.24 : variant === "bot" ? 0.56 : 0.78, { health, maxHealth: health, speed: boss ? 3.7 : variant === "dog" ? 3.4 : 2.4, boss, variant, attackState: "approach", attackTime: 0, frozen: 0 });
    if (this.stage.type === "defense" && this.stage.id === "approaches") { enemy.health = 3; enemy.maxHealth = 3; enemy.speed = 2.8; }
    this.cloneMaterials(enemy.object);
    enemy.healthBar = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff745c, depthTest: false }));
    enemy.healthBar.scale.set(1.5, 0.13, 1);
    enemy.healthBar.position.y = variant === "drone" ? 1.35 : variant === "dog" ? 2.35 : 3.2;
    enemy.object.add(enemy.healthBar);
    this.entities.push(enemy);
    return enemy;
  }

  cloneMaterials(object) {
    object.traverse(child => { if (child.isMesh) child.material = child.material.clone(); });
  }

  tint(object, color, emissive = 0) {
    object.traverse(child => {
      if (!child.isMesh || !child.material?.color) return;
      child.material.color.lerp(new THREE.Color(color), 0.72);
      if (child.material.emissive) { child.material.emissive.set(color); child.material.emissiveIntensity = emissive; }
    });
  }

  routePositions(count) {
    return Array.from({ length: count }, (_, index) => {
      const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
      const radius = 11 + (index % 2) * 3;
      return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
    });
  }

  createHazards(count) {
    this.hazards = Array.from({ length: count }, (_, index) => {
      const angle = index * Math.PI * 2 / count;
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.16, 8, 24), new THREE.MeshBasicMaterial({ color: 0xff5d49, transparent: true, opacity: 0.82 }));
      mesh.rotation.x = Math.PI / 2;
      this.world.mission.add(mesh);
      return { object: mesh, angle, radius: 7 + index * 1.5, x: 0, z: 0, cooldown: 0 };
    });
  }

  update(dt) {
    if (this.pendingResult) {
      this.victoryElapsed += dt;
      if (this.victoryElapsed >= VICTORY_DURATION) this.completeVictory();
      return;
    }
    if (!this.running || this.paused) return;
    if (this.input.consume("pause")) return this.pause();
    if (this.stage.type === "roam") {
      this.elapsed += dt;
      this.pulseCooldown = Math.max(0, this.pulseCooldown - dt);
      this.dashCooldown = Math.max(0, this.dashCooldown - dt);
      this.dashTime = Math.max(0, this.dashTime - dt);
      this.updatePlayer(dt);
      if (this.input.consume("pulse")) this.pulse();
      if (this.input.consume("dash")) this.dash();
      this.updateHUD(dt);
      return;
    }
    this.elapsed += dt;
    if (this.phase !== "prepare" && this.phase !== "ready") this.time = this.storyMode ? Math.max(0, this.time - dt) : this.time - dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.pulseCooldown = Math.max(0, this.pulseCooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.dashTime = Math.max(0, this.dashTime - dt);

    if (!this.storyMode && this.time <= 0) return this.finish(false, "The mission clock expired before the objective was complete.");
    this.updatePlayer(dt);
    this.updateHazards(dt);
    if (this.shields <= 0) return this.finish(false, "KAI's shield is empty. Dash away from red warning zones and try again.");
    this.combat.update(dt);
    if (!this.running) return;
    if (this.input.consume("freeze")) this.combat.freeze();
    if (this.input.consume("call")) this.combat.callAnimals();
    if (this.input.held?.("shoot") || this.input.consume("shoot")) this.combat.shoot();
    if (!this.running) return;
    if (this.input.consume("dash")) this.dash();
    this.updateMission(dt);
    if (!this.running) return;
    if (this.shields <= 0) return this.finish(false, "KAI's shield is empty. Dash away from red warning zones and try again.");
    this.updatePrompt();
    this.updateHUD(dt);

    if (this.input.consume("pulse")) this.pulse();
    if (!this.running) return;
    if (this.input.consume("interact")) this.interact();
  }

  updatePlayer(dt) {
    const move = this.input.movement();
    const yaw = this.world.cameraYaw || 0;
    const direction = { x: move.x * Math.cos(yaw) + move.y * Math.sin(yaw), z: -move.x * Math.sin(yaw) + move.y * Math.cos(yaw) };
    if (Math.hypot(move.x, move.y) > 0.05) this.lastMove = direction;
    if (this.dashTime > 0 || Math.hypot(move.x, move.y) > 0.05) {
      const heading = this.dashTime > 0 ? this.dashMove : direction;
      const speed = this.player.speed * (this.dashTime > 0 ? 2.4 : 1);
      this.player.x = clamp(this.player.x + heading.x * speed * dt, -18, 18);
      this.player.z = clamp(this.player.z + heading.z * speed * dt, -18, 18);
      this.world.constrainPlayer?.(this.player);
      const islandLimit = 18.5;
      const radius = Math.hypot(this.player.x, this.player.z);
      if (radius > islandLimit) { this.player.x *= islandLimit / radius; this.player.z *= islandLimit / radius; }
      this.player.object.rotation.y = Math.atan2(heading.x, heading.z);
      this.player.object.position.set(this.player.x, 0.55 + Math.sin(this.elapsed * 10) * 0.035, this.player.z);
    }
    this.player.object.rotation.z *= Math.max(0, 1 - dt * 8);
    this.world.animateActor?.(this.player.object, this.elapsed, Math.hypot(move.x, move.y) > 0.05 || this.dashTime > 0);
    if (this.carry) {
      this.carry.x = this.player.x;
      this.carry.z = this.player.z;
      this.carry.object.position.set(this.player.x, actorHeight(this.player.object, 3.25), this.player.z);
      this.carry.object.rotation.y += dt * 2;
    }
  }

  updateMission(dt) {
    if (this.stage.type === "race-collect") {
      this.entities.filter(entity => entity.kind === "cell" && entity.active).forEach(entity => {
        entity.angle += dt * 0.35;
        entity.x += Math.sin(entity.angle) * dt * 0.35;
        entity.z += Math.cos(entity.angle) * dt * 0.35;
        entity.object.position.set(entity.x, 0.72 + Math.sin(this.elapsed * 3 + entity.angle) * 0.22, entity.z);
      });
    }
    if (this.stage.type === "rescue") this.updateTide(dt);
    if (["combat", "defense", "boss", "finale", "collect", "brawl", "expedition"].includes(this.stage.type)) this.updateEnemies(dt);
    if (!this.running) return;
    if (this.shields <= 0) return this.finish(false, "KAI's shield is empty. Protect yourself as well as the relay.");
    if (this.stage.type === "defense") this.updateDefense(dt);
    if (this.stage.type === "boss") this.updateBoss(dt, this.boss);
    if (this.stage.type === "race") this.updateRace();
    if (this.stage.type === "finale") this.updateFinale(dt);
    this.expedition?.update(dt);
    this.discovery?.update(dt);
    this.entities.forEach(entity => {
      if (entity.active && ["cell", "node"].includes(entity.kind)) entity.object.rotation.y += dt * 0.8;
      if (entity.marker?.userData.ring) entity.marker.visible = entity.active && !entity.carried;
    });
  }

  updateTide() {
    if (this.stage.scene) return;
    const amount = clamp(this.elapsed / this.stage.time, 0, 1);
    this.tide.scale.setScalar(1.7 - amount * 0.75);
    this.tide.material.opacity = 0.22 + amount * 0.24;
    if (amount > 0.72) {
      const stranded = this.entities.find(entity => entity.kind === "creature" && entity.active && !entity.carried);
      if (stranded && Math.hypot(stranded.x, stranded.z) > 10 + (1 - amount) * 12) this.ui.message("The tide is close to a beach friend!", true);
    }
  }

  updateEnemies(dt) {
    for (const enemy of this.entities.filter(entity => ["enemy", "boss"].includes(entity.kind) && entity.active)) {
      if (enemy.boss) continue;
      if (enemy.frozen > 0) continue;
      const target = this.stage.type === "defense" ? this.relay : this.stage.type === "finale" ? this.core : this.player;
      if (!target) continue;
      const attacking = this.combat.moveEnemy(enemy, target, dt);
      if (attacking && distance(enemy, this.player) < 1.35) {
        this.damagePlayer();
      }
      if (this.stage.type === "defense" && distance(enemy, this.relay) < 1.4) {
        this.disableEntity(enemy, false, false);
        this.escaped += 1;
        this.shields = Math.max(0, this.shields - 1);
        this.invulnerable = 0;
        this.ui.message("A scout reached the relay!", true);
      }
      if (this.stage.type === "finale" && this.core && distance(enemy, this.core) < 1.5) {
        this.disableEntity(enemy, false, false);
        this.core.health -= 1;
        this.ui.message(`Core integrity ${this.core.health} / 5`, true);
        if (this.core.health <= 0) return this.finish(false, "The Warden overwhelmed the Aurora Core. Use pulse and dash to intercept scouts earlier.");
      }
    }
  }

  updateDefense(dt) {
    if (this.phase !== "battle") return;
    this.spawnTimer -= dt;
    if (this.spawned < this.stage.count && this.spawnTimer <= 0) {
      this.spawnEnemy(false, this.spawned);
      this.spawned += 1;
      this.spawnTimer = this.stage.id === "approaches" ? 1.8 : 2.6;
    }
    for (const turret of this.turrets || []) {
      turret.cooldown = Math.max(0, turret.cooldown - dt);
      const target = this.entities.find(entity => entity.kind === "enemy" && entity.active && distance(turret, entity) < 8.5);
      if (target && turret.cooldown <= 0) {
        turret.object.rotation.y = Math.atan2(target.x - turret.x, target.z - turret.z);
        turret.cooldown = 0.8;
        this.combat.makeBolt([turret, target], 0xffd166);
        this.combat.hit(target, 1);
      }
    }
    if (this.spawned >= this.stage.count && !this.entities.some(entity => entity.kind === "enemy" && entity.active)) {
      if (this.escaped === 0) this.finish(true, "The relay is secure and every scout has rebooted safely.");
      else this.finish(false, `${this.escaped} scout${this.escaped === 1 ? "" : "s"} reached the relay. Place turrets across every approach.`);
    }
  }

  updateBoss(dt, boss) {
    if (!boss?.active) return;
    if (boss.frozen > 0) return;
    boss.stateTime -= dt;
    if (boss.state === "shielded" && boss.stateTime <= 0) {
      boss.state = "warning";
      boss.stateTime = 1.35;
      boss.chargeX = this.player.x;
      boss.chargeZ = this.player.z;
      boss.warningLine = this.world.createRoute([{ x: boss.x, z: boss.z }, { x: boss.chargeX, z: boss.chargeZ }], 0xff493b);
      this.ui.message("Orange line—dash sideways!", true);
      this.tint(boss.object, 0xff7b4b, 1.8);
    } else if (boss.state === "warning" && boss.stateTime <= 0) {
      boss.state = "charge";
      boss.stateTime = 1.0;
      if (boss.warningLine) { this.world.release?.(boss.warningLine); boss.warningLine = null; }
    } else if (boss.state === "charge") {
      const d = Math.hypot(boss.chargeX - boss.x, boss.chargeZ - boss.z) || 1;
      const step = Math.min(d, 11 * dt);
      boss.object.rotation.y = Math.atan2(boss.chargeX - boss.x, boss.chargeZ - boss.z);
      boss.x += ((boss.chargeX - boss.x) / d) * step;
      boss.z += ((boss.chargeZ - boss.z) / d) * step;
      boss.object.position.set(boss.x, 0.55, boss.z);
      if (distance(boss, this.player) < 1.8) this.damagePlayer();
      if (boss.stateTime <= 0 || d - step < 0.5) {
        boss.state = "exposed";
        boss.stateTime = 2.8;
        this.tint(boss.object, 0x65e5ff, 1.2);
        this.ui.message("Core exposed—pulse now!");
      }
    } else if (boss.state === "exposed" && boss.stateTime <= 0) {
      boss.state = "shielded";
      boss.stateTime = 2.2;
      this.tint(boss.object, 0xc54831, 0.2);
      boss.cycles += 1;
      if (boss.final && boss.cycles <= 2) {
        this.spawnEnemy(false, boss.cycles * 2);
        this.spawnEnemy(false, boss.cycles * 2 + 1);
        this.ui.message("Warden calls two scouts—protect the core!", true);
      }
    }
  }

  updateRace() {
    const gate = this.gates?.[this.progressCount];
    if (!gate || distance(this.player, gate.position) >= 1.8) return;
    gate.object.visible = false;
    this.progressCount += 1;
    const next = this.gates[this.progressCount];
    if (next) {
      next.active = true;
      next.object.traverse(child => { if (child.material?.emissive) child.material.emissive.set(0xffd166); });
      this.ui.message(`Gate ${this.progressCount} clear`);
    } else {
      const clean = !this.stage.minShield || this.shields >= this.stage.minShield;
      if (clean) this.finish(true, "Skyway complete. The route stayed bright behind you.");
      else this.finish(false, `Course complete, but ${this.stage.minShield} shield charges must remain.`);
    }
  }

  updateFinale(dt) {
    if (this.phase === "defend") {
      this.spawnTimer -= dt;
      if (this.spawned < this.finalWaveCount && this.spawnTimer <= 0) {
        this.spawnEnemy(false, this.spawned);
        this.spawned += 1;
        this.spawnTimer = 2.2;
      }
      if (this.spawned >= this.finalWaveCount && !this.entities.some(entity => entity.kind === "enemy" && entity.active)) {
        this.enterWarden();
      }
    } else if (this.phase === "warden") {
      this.updateBoss(dt, this.boss);
      if (!this.boss.active && !this.entities.some(entity => entity.kind === "enemy" && entity.active)) {
        this.phase = "repair";
        this.wardenRepair = { x: this.boss.x, z: this.boss.z };
        this.wardenRepair.marker = this.world.createMarker(this.wardenRepair, 0x65e5ff, 1.8);
        this.ui.dialogue([{ speaker: "LUMA", text: "Its shield is down. Install the shared-signal patch with Use. This repair costs no scrap." }]);
        this.ui.message("Use beside the Warden to install the repair");
      }
    }
  }

  enterWarden(checkpoint = null) {
    if (checkpoint) {
      this.time = checkpoint.time; this.elapsed = checkpoint.elapsed; this.core.health = checkpoint.coreHealth;
      this.metrics = { ...checkpoint.metrics };
    }
    this.phase = "warden"; this.spawned = this.finalWaveCount; this.progressCount = this.finalWaveCount;
    this.shields = this.upgrades.maxShields; this.invulnerable = 1.25;
    this.player.x = 0; this.player.z = 7; this.player.object.position.set(0, .55, 7);
    // Reuse the mission's crate so fresh entry and a restored checkpoint receive the same refill.
    const starter = this.combat.pickups.find(pickup => pickup.type === "bubble");
    starter.active = true;
    this.combat.collect(starter);
    this.setupBoss(true);
    if (!checkpoint) {
      this.progress.checkpoint = { stage: "siege:signalbreak", mode: this.storyMode ? "story" : "challenge", time: this.time, elapsed: this.elapsed, coreHealth: this.core.health, metrics: { ...this.metrics } };
      const saved = this.save(this.progress) !== false;
      this.ui.setProgress(this.progress);
      this.ui.message(saved ? "Checkpoint saved · shield and Bubble Blaster ready" : "Checkpoint ready for this session · shield and Bubble Blaster ready");
      this.ui.dialogue([{ speaker: "WARDEN", text: "Isolation protected you once. Why will you not stay where it is safe?" }, { speaker: "LUMA", text: "Because our friends are out there. KAI, dodge the fixed charge line, then attack the exposed cyan core." }]);
    }
  }

  updateHazards(dt) {
    for (const hazard of this.hazards || []) {
      hazard.angle += dt * (0.45 + hazard.radius * 0.012);
      hazard.x = Math.cos(hazard.angle) * hazard.radius;
      hazard.z = Math.sin(hazard.angle) * hazard.radius;
      hazard.object.position.set(hazard.x, 0.66, hazard.z);
      hazard.cooldown = Math.max(0, hazard.cooldown - dt);
      if (hazard.cooldown <= 0 && distance(hazard, this.player) < 1.5) {
        hazard.cooldown = 1.4;
        this.damagePlayer("Surge contact—one shield used.");
      }
    }
  }

  pulse() {
    if (this.pulseCooldown > 0) return this.ui.message("Pulse is recharging", true);
    if (this.stage.type === "relay") { this.pulseCooldown = .25; return this.turnRelay(this.upgrades.pulseRadius); }
    const radius = this.upgrades.pulseRadius;
    const damage = this.upgrades.pulseDamage;
    this.pulseCooldown = 1.1;
    this.world.pulse(this.player, radius, 0x65e5ff);
    let hits = 0;
    for (const entity of this.entities.filter(entity => entity.active && distance(entity, this.player) <= radius)) {
      if (!this.running) break;
      if (entity.kind === "cell") {
        this.collect(entity);
        hits += 1;
      } else if (entity.kind === "node") {
        this.activateNode(entity);
        hits += 1;
      } else if (["enemy", "boss"].includes(entity.kind)) {
        if (entity.boss && entity.state !== "exposed") {
          this.ui.message("The shield is solid—bait a charge first", true);
          continue;
        }
        hits += 1;
        this.combat.hit(entity, damage);
      }
    }
    if (!hits) this.ui.message("No pulse target in range", true);
  }

  collect(entity) {
    if (!entity.active) return;
    entity.active = false;
    entity.object.visible = false;
    if (entity.marker) entity.marker.visible = false;
    this.progressCount += 1;
    this.ui.message(`Energy collected · ${this.progressCount}/${this.stage.count}`);
    if (this.progressCount >= this.stage.count) {
      if (this.goal) { this.goal.locked = false; this.ui.message("All cells charged—repair the gold beacon"); }
      else this.finish(true, "Every energy cell is safely back in the network.");
    }
  }

  activateNode(entity) {
    const result = sequenceStep(this.expected, this.sequenceIndex, entity.id);
    if (!result.correct) {
      this.wrongActions += 1;
      this.ui.message(`Follow the circuit: ${this.stage.labels[this.sequenceIndex]} is next`, true);
      return;
    }
    entity.active = false;
    this.tint(entity.object, 0x4cde8a, 1.3);
    this.sequenceIndex = result.index;
    this.progressCount = result.index;
    this.ui.message(result.complete ? "Signal route complete" : `${this.stage.labels[result.index]} is next`);
    if (result.complete) this.finish(true, "The signal followed a complete, logical path through every node.");
  }

  dash() {
    if (this.dashCooldown > 0) return this.ui.message("Dash is recharging", true);
    this.dashTime = this.upgrades.dashDuration;
    this.dashCooldown = this.upgrades.dashRecharge;
    const length = Math.hypot(this.lastMove.x, this.lastMove.z) || 1;
    this.dashMove = { x: this.lastMove.x / length, z: this.lastMove.z / length };
    this.invulnerable = Math.max(this.invulnerable, this.dashTime);
  }

  interact() {
    if (this.discovery?.interact()) return;
    if (this.stage.type === "relay") return this.turnRelay();
    if (this.stage.type === "finale" && this.phase === "repair" && distance(this.player, this.wardenRepair) < 2.5) {
      this.wardenRepair.marker.visible = false;
      this.phase = "launch"; this.rocketGoal.locked = false;
      this.world.createMarker(this.rocketGoal, 0xffd166, 2.2);
      this.ui.dialogue([{ speaker: "WARDEN", text: "Shared-signal patch accepted. Keep the routes open. Ask before closing a door." }, { speaker: "BOLT", text: "Welcome back. You are just in time to help with the festival." }]);
      return this.ui.message("Warden repaired · send the festival signal from the rocket");
    }
    if (this.expedition?.interact()) return;
    if (this.finalBeacon && !this.carry && distance(this.player, this.finalBeacon) < 2.2) {
      if (this.progressCount < this.stage.count) return this.ui.message("Bring every beach friend to safety first", true);
      return this.finish(true, "The tide beacon is offline and the second fragment is secure.");
    }
    if (this.stage.type === "rescue") return this.interactRescue();
    if (this.stage.type === "defense" && this.phase === "prepare") return this.interactPad();
    if (this.stage.type === "defense" && this.phase === "ready") {
      this.phase = "battle";
      return this.ui.message("Defense line ready—scouts incoming!", true);
    }
    if (this.goal && distance(this.player, this.goal) < 2.2) {
      if (this.goal.locked) return this.ui.message(this.stage.type === "combat" ? "Reboot every scout before activating the beacon" : "The beacon still needs every energy cell", true);
      return this.finish(true, this.stage.id === "wake" ? "BOLT is online. The restored dock points toward the first fragment." : "The beacon is restored and the next part of the island network is open.");
    }
    if (this.stage.type === "finale" && this.phase === "launch" && distance(this.player, this.rocketGoal) < 3) {
      return this.finish(true, "The Warden is repaired and the Aurora signal is restored. AURORA carries the good news to every island. The whole beach is ready for the festival!");
    }
    if (this.combat.repair()) return;
    this.ui.message("Move closer to the highlighted target", true);
  }

  interactRescue() {
    if (this.carry) {
      if (!this.shelters.some(shelter => distance(this.player, shelter) <= 2.5)) return this.ui.message("Carry your friend to a green shelter", true);
      this.carry.active = false;
      this.carry.carried = false;
      this.carry.object.visible = false;
      this.carry = null;
      this.progressCount += 1;
      this.ui.message(`Friend safe · ${this.progressCount}/${this.stage.count}`);
      if (this.progressCount >= this.stage.count && !this.finalBeacon) this.finish(true, "Every beach friend reached high ground before the tide.");
      else if (this.progressCount >= this.stage.count) { this.finalBeacon.locked = false; this.ui.message("Everyone is safe—disable the orange tide beacon"); }
      return;
    }
    const creature = this.entities.find(entity => entity.kind === "creature" && entity.active && !entity.carried && distance(entity, this.player) < 2.1);
    if (!creature) return this.ui.message("Move close to a beach friend", true);
    creature.carried = true;
    if (creature.marker) creature.marker.visible = false;
    this.carry = creature;
    this.ui.message("Friend aboard—head for green high ground");
  }

  interactPad() {
    const pad = this.pads.find(candidate => !candidate.placed && distance(this.player, candidate.position) < 2.2);
    if (!pad) return this.ui.message("Stand inside a gold turret pad", true);
    pad.placed = true;
    pad.marker.visible = false;
    const turretObject = this.world.createActor("turret", pad.position, 1.0);
    this.turrets.push({ ...pad.position, object: turretObject, cooldown: 0 });
    this.progressCount += 1;
    this.ui.message(`Turret placed · ${this.progressCount}/${this.stage.pads}`);
    if (this.progressCount >= this.stage.pads) {
      this.phase = "ready";
      this.progressCount = 0;
      this.ui.message("Turrets ready. Press Use / E when you are ready for the wave.");
    }
  }

  disableEntity(entity, count = true, defeated = true) {
    if (!entity.active) return;
    entity.active = false;
    entity.object.scale.multiplyScalar(entity.boss ? 0.82 : 0.92);
    if (entity.healthBar) entity.healthBar.visible = false;
    this.tint(entity.object, 0x4bd6c4, 0.8);
    this.world.animateActor?.(entity.object, 0, false);
    this.combat?.onDisabled(entity, defeated);
    if (count) this.progressCount += 1;
    if (entity.kind === "boss") {
      if (this.stage.type === "boss") this.finish(true, "The Rust Captain rebooted peacefully and released the third fragment.");
      return;
    }
    if (this.stage.type === "combat" && this.progressCount >= this.stage.count) {
      if (!this.goal) return this.finish(true,this.stage.outcome);
      this.goal.locked = false;
      this.ui.message("Scouts restored—activate the marina beacon");
    }
  }

  damagePlayer(message = "Impact absorbed—dash away!") {
    const result = applyHit(this.shields, this.invulnerable);
    this.shields = result.shields;
    this.invulnerable = result.invulnerable;
    if (result.damaged) {
      this.metrics.damageTaken += 1;
      this.ui.message(message, true);
      if (!this.progress.settings.reducedMotion) this.player.object.rotation.z = 0.12;
    }
  }

  updatePrompt() {
    if (this.discovery) return this.ui.prompt(this.discovery.prompt());
    if (this.expedition) {
      this.ui.prompt(this.expedition.prompt() || (this.combat.repairTarget() ? "E · REPAIR TEAMMATE · 2 SCRAP" : ""));
      return;
    }
    let text = "";
    if (this.stage.type === "relay" && this.relayNodes.some(node => distance(this.player, node) <= 2.5)) text = "E / Q · TURN RELAY CLOCKWISE";
    else if (this.stage.type === "finale" && this.phase === "repair" && distance(this.player, this.wardenRepair) < 2.5) text = "E · INSTALL SHARED SIGNAL · FREE REPAIR";
    else if (this.finalBeacon && !this.carry && this.progressCount >= this.stage.count && distance(this.player, this.finalBeacon) < 2.2) text = "E · DISABLE TIDE BEACON";
    else if (this.stage.type === "rescue") {
      if (this.carry && this.shelters.some(shelter => distance(this.player, shelter) < 2.5)) text = "E · SET FRIEND DOWN SAFELY";
      else if (!this.carry && this.entities.some(entity => entity.kind === "creature" && entity.active && distance(entity, this.player) < 2.1)) text = "E · PICK UP FRIEND";
    } else if (this.stage.type === "defense" && this.phase === "prepare" && this.pads.some(pad => !pad.placed && distance(this.player, pad.position) < 2.2)) text = "E · PLACE SOLAR TURRET";
    else if (this.stage.type === "defense" && this.phase === "ready") text = "E · START DEFENSE WAVE";
    else if (this.goal && distance(this.player, this.goal) < 2.2) text = this.goal.locked ? (this.stage.type === "combat" ? "REBOOT THE REMAINING SCOUTS" : "BEACON NEEDS MORE ENERGY") : "E · REPAIR BEACON";
    else if (this.stage.type === "finale" && this.phase === "launch" && distance(this.player, this.rocketGoal) < 3) text = "E · LAUNCH FESTIVAL ROCKET";
    if (!text && this.combat.repairTarget()) text = "E · REPAIR TEAMMATE · 2 SCRAP";
    this.ui.prompt(text);
  }

  progressText() {
    if (this.discovery) return `${this.progressCount}/${this.stage.count} ${this.stage.type === "scan" ? "scans" : this.stage.type === "escort" ? "waypoints" : "atlas delivered"}`;
    if (this.expedition) return this.expedition.progressText();
    if (this.stage.type === "brawl") return `Wave ${Math.max(1, this.combat.wave)} / 3 · ${this.combat.kills} / 24`;
    if (this.stage.type === "roam") return "Island restored";
    if (this.stage.type === "relay") return `${this.progressCount}/${this.stage.count} links · ${this.relayTurns} turns`;
    if (this.stage.type === "defense" && this.phase === "ready") return "Ready · press E";
    if (this.stage.type === "defense") return this.phase === "prepare" ? `${this.progressCount} / ${this.stage.pads} turrets` : `${this.progressCount} / ${this.stage.count} scouts`;
    if (this.stage.type === "boss") return `${Math.max(0, this.boss.health)} / ${this.boss.maxHealth} core`;
    if (this.stage.type === "finale") {
      if (this.phase === "defend") return `${this.progressCount} / ${this.finalWaveCount} scouts`;
      if (this.phase === "warden") return `${Math.max(0, this.boss.health)} Warden · ${this.core.health}/5 core`;
      if (this.phase === "repair") return "Install the repair · E";
      return "Rocket ready";
    }
    return `${this.progressCount} / ${this.stage.count}`;
  }

  updateHUD(dt = 0.1) {
    this.hudElapsed += dt;
    if (this.hudElapsed < 0.1) return;
    this.hudElapsed = 0;
    this.ui.updateHUD({
      time: this.time,
      elapsed: this.elapsed, storyMode: this.storyMode,
      progressText: this.progressText(),
      progressIcon: this.item.chapter.icon,
      shields: this.shields,
      maxShields: this.upgrades.maxShields,
      untimed: ["prepare", "ready"].includes(this.phase) || this.stage.type === "roam",
      pulseReady: 1 - clamp(this.pulseCooldown / 1.1, 0, 1),
      dashReady: 1 - clamp(this.dashCooldown / this.upgrades.dashRecharge, 0, 1),
      combat: this.combat,
      challenge: challengeStatus(this),
    });
    const target = this.objectiveTarget();
    this.ui.navigation?.(target, this.player, this.world.cameraYaw || 0);
    this.ui.minimap?.draw(this, target);
  }

  objectiveTarget() {
    if (this.discovery) return this.discovery.objective();
    if (this.expedition) return this.expedition.objective();
    const combatTarget = this.combat.objective();
    if (combatTarget) return combatTarget;
    const nearest = (entities, label) => {
      const entity = entities.filter(entity => entity.active !== false).sort((a, b) => distance(this.player, a) - distance(this.player, b))[0];
      return entity ? { ...entity, label } : null;
    };
    if (this.carry) return nearest(this.shelters, "Green shelter · Use to rescue");
    if (this.stage.type === "rescue") return this.progressCount >= this.stage.count && this.finalBeacon ? { ...this.finalBeacon, label: "Tide beacon · Use to disable" } : nearest(this.entities.filter(e => e.kind === "creature"), "Beach friend · Use to carry");
    if (this.stage.type === "sequence") {
      const node = this.entities.find(e => e.kind === "node" && e.id === this.sequenceIndex);
      return node ? { ...node, label: `${this.sequenceIndex + 1} · ${node.label} · Pulse` } : null;
    }
    if (this.stage.type === "relay") {
      const disconnected = this.relayState.outputs.findIndex(output => output.powered && (output.hit === null || !this.relayState.receiverPowered && output.hit === 0));
      const node = disconnected >= 0 ? this.relayNodes[disconnected] : [...this.relayNodes].sort((a, b) => distance(this.player, a) - distance(this.player, b))[0];
      return { ...node, label: "Relay arrow · Q / Use to turn" };
    }
    if (this.stage.type === "race") {
      const gate = this.gates[this.progressCount];
      return gate ? { ...gate.position, label: `Gate ${this.progressCount + 1} · move through` } : null;
    }
    if (this.stage.type === "defense" && this.phase === "prepare") return nearest(this.pads.filter(p => !p.placed).map(p => p.position), "Gold pad · Use to build");
    if (this.stage.type === "defense" && this.phase === "ready") return { ...this.relay, label: "Defense ready · press Use / E" };
    if (this.stage.type === "finale" && this.phase === "launch") return { ...this.rocketGoal, label: "Festival rocket · Use to launch" };
    if (this.stage.type === "finale" && this.phase === "repair") return { ...this.wardenRepair, label: "Warden · Use to install free repair" };
    if (this.boss?.active) return { ...this.boss, label: this.boss.state === "exposed" ? "Core exposed · Pulse now" : "Boss shielded · dodge its charge" };
    if (this.goal && !this.goal.locked) return { ...this.goal, label: this.stage.id === "wake" ? "BOLT's dock · Use to repair" : "Gold beacon · Use to repair" };
    return nearest(this.entities.filter(e => e.kind === "cell"), "Energy cell · Pulse") || nearest(this.entities.filter(e => e.kind === "enemy"), "Rust scout · Pulse to reboot");
  }

  pause() {
    if (!this.running) return;
    this.paused = true;
    this.input.clear();
    this.input.enabled = false;
    this.ui.modal({ icon: "Ⅱ", eyebrow: "Mission paused", title: this.stage.name, text: `${this.stage.objective}${challengeStatus(this) ? ` Optional: ${challengeStatus(this).text}.` : ""}`, actions: [
      { label: "Resume", run: () => { this.input.clear(); this.input.enabled = true; this.paused = false; } },
      { label: "Restart", run: () => this.begin(this.item) },
      this.returnAction(),
    ] });
  }

  finish(won, text) {
    if (!this.running) return;
    if (won && (!this.storyMode && this.time <= 0 || this.shields <= 0)) {
      won = false;
      text = !this.storyMode && this.time <= 0 ? "The mission clock expired before the objective was complete." : "KAI's shield is empty. Try the route again.";
    }
    this.running = false;
    this.phase = won ? "complete" : "failed";
    this.paused = false;
    this.input.enabled = false;
    this.input.clear();
    this.ui.hideDialogue?.();
    this.ui.prompt("");
    const bonus = challengeStatus(this);
    const report = `${won && storyFor(this.item) ? storyFor(this.item).outcome : text}\n${runSummary(this)}.\nOptional challenge: ${bonus?.text || "Explore"} — ${won && bonus?.done ? "completed!" : "not earned this run."}`;
    let outcome;
    let saved = true;
    if (won && this.expedition) {
      const score = this.combat.kills * 100 + this.shields * 100 + Math.max(0, Math.floor(this.time)) * 5 + (bonus.done ? 500 : 0);
      this.progress.expeditionResults[this.stage.id] = Math.max(this.progress.expeditionResults[this.stage.id] || 0, score);
      saved = this.save(this.progress) !== false;
      this.ui.setProgress(this.progress);
      outcome = { icon: this.stage.icon, eyebrow: "Expedition complete", title: this.stage.name, text: report,
        stats: [[score, "this run"], [this.progress.equipment.owned.length, "discoveries owned"], [this.progress.expeditionResults[this.stage.id], "best"], [bonus.done ? "+500" : "—", "challenge bonus"]], actions: [
          { label: "More expeditions", run: () => { this.stop(); this.ui.showExpeditions(); } },
          { label: "Workshop", run: () => { this.stop(); this.ui.showWorkshop(); } },
          { label: "Replay", run: () => this.begin(this.item) },
        ] };
    } else if (won && this.stage.type === "brawl") {
      const allies = this.entities.filter(e => e.kind === "ally").length;
      const score = this.combat.kills * 100 + allies * 200 + this.shields * 50 + Math.max(0, Math.floor(this.time)) * 10 + (bonus.done ? 500 : 0);
      this.progress.brawlBest = Math.max(this.progress.brawlBest || 0, score);
      saved = this.save(this.progress) !== false;
      outcome = { icon: "✦", eyebrow: "Brawl won", title: "Tiny heroes. Big beach party.", text: report, stats: [[score, "this run"], [allies, "robot pals"], [this.progress.brawlBest, "best"], [bonus.done ? "+500" : "—", "challenge bonus"]], actions: [
        { label: "Play again", run: () => this.begin(this.item) },
        { label: "Back to title", run: () => { this.stop(); this.ui.showTitle(); } },
      ] };
    } else if (won) {
      if (this.stage.id === "signalbreak") this.progress.checkpoint = null;
      const medals = medalFor(this.time, this.stage.time, bonus.done);
      this.progress = recordResult(this.progress, this.item.chapter, this.stage, Math.max(0, this.time), bonus.done);
      saved = this.save(this.progress) !== false;
      this.ui.setProgress(this.progress);
      const result = this.progress.results[`${this.item.chapter.id}:${this.stage.id}`];
      const next = ALL_STAGES[ALL_STAGES.findIndex(item => item.stage.id === this.stage.id) + 1];
      outcome = { icon: "✦", eyebrow: "Mission complete", title: this.stage.name, text: report, stats: [["◆".repeat(medals), "this run"], ["◆".repeat(result.medals), "best medals"], [Math.ceil(this.storyMode ? this.elapsed : this.time), this.storyMode ? "seconds played" : "seconds left"], [this.shields, "shield"]], actions: [
        ...(next ? [{ label: "Next mission", run: () => { this.stop(); this.ui.showBriefing(next); } }] : []),
        { label: "Mission map", run: () => { this.stop(); this.ui.showMap(); } },
        { label: "Replay", run: () => this.begin(this.item) },
      ] };
    } else {
      this.ui.modal({ icon: "↻", eyebrow: "Mission incomplete", title: this.stage.scene ? "This discovery needs another try" : "The beach needs another try", text, stats: [[this.progressText(), "progress"], [this.shields, "shield"]], actions: [
        ...(this.stage.id === "signalbreak" && availableCheckpoint(this.progress) ? [{ label: "Retry from checkpoint", run: () => this.begin(this.item, { resumeCheckpoint: true }) }] : []),
        { label: "Try again", run: () => this.begin(this.item) },
        this.returnAction(),
      ] });
      return;
    }
    if (!saved) outcome.text += "\nSaving is unavailable: progress is kept for this session only.";
    this.ui.callbacks?.sound?.("victory");
    // Save is complete. Animation and skipping cannot modify the recorded outcome.
    if (this.world.startCelebration && this.ui.showCelebration) {
      this.pendingResult = outcome;
      this.victoryElapsed = 0;
      this.world.startCelebration(this.progress.equipment);
      const pending = outcome;
      const nextStage = ALL_STAGES[ALL_STAGES.findIndex(item=>item.stage.id===this.stage.id)+1];
      this.ui.showCelebration(this.stage.name, () => { if (this.pendingResult === pending) this.completeVictory(); }, saved, storyFor(this.item)?.outcome, this.stage.discovery ? { discovery:this.stage.discovery, next:nextStage?.stage.location || "Home · atlas complete" } : null);
    } else this.ui.modal(outcome);
  }

  returnAction() {
    return { label: this.expedition ? "Expeditions" : this.stage.type === "brawl" ? "Back to title" : "Mission map", run: () => {
      const destination = this.expedition ? "showExpeditions" : this.stage.type === "brawl" ? "showTitle" : "showMap";
      this.stop(); this.ui[destination]();
    } };
  }

  completeVictory() {
    if (!this.pendingResult) return;
    const outcome = this.pendingResult;
    this.pendingResult = null;
    this.ui.hideCelebration?.();
    this.ui.modal(outcome);
  }

  cancelVictory() {
    this.pendingResult = null;
    this.victoryElapsed = 0;
    this.ui.hideCelebration?.();
  }

  stop() {
    this.cancelVictory();
    this.running = false;
    this.paused = false;
    this.world.clearMission();
    this.input.clear();
    this.input.enabled = false;
    this.ui.hideDialogue?.();
  }
}
