import { EQUIPMENT, equipItem } from "./equipment.js";

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class Expedition {
  constructor(game) {
    this.game = game;
    this.mode = game.stage.mode;
    this.friends = [];
    this.discoveries = [];
    this.rescued = 0;
    this.discs = 0;
    this.spawned = 0;
    this.spawnClock = 5;
    this.checkpoint = 0;
    this.clamCooldown = 0;
    this.inkCooldown = 0;
    this.exit = this.actor("beacon", { x: 10, z: -6 }, 1);
    this.exit.marker = game.world.createMarker(this.exit, 0xffd166, 1.5);
    this.sanctuary = this.actor("reef_arch", { x: 0, z: -11 }, 0.9);
    this.sanctuary.marker = game.world.createMarker(this.sanctuary, 0x65edac, 2);
    this.clam = this.actor("clam", { x: 10, z: 5 }, 1.15);
    this.clam.marker = game.world.createMarker(this.clam, 0xff8bc5, 1.3);
    this.helper = this.actor("octopus", { x: 0, z: -2 }, 0.85);
    this.helper.object.rotation.y = Math.PI;
    if (this.mode === "rescue") {
      [["octopus", -9, 6], ["starfish", 8, 0], ["starfish", -8, -8]].forEach(([model, x, z]) => {
        const friend = this.actor(model, { x, z }, model === "starfish" ? 1.25 : 0.9);
        Object.assign(friend, { kind: "reef_friend", active: true, model });
        friend.marker = game.world.createMarker(friend, 0x65edac, 1.1);
        this.friends.push(friend);
      });
      this.addDiscovery("turbo", { x: -4, z: 9 });
      this.addDiscovery("armor", { x: 5, z: 9 });
    } else if (this.mode === "salvage") {
      this.addDiscovery("turbo", { x: -7, z: 7 }, true);
      this.addDiscovery("overclock", { x: 8, z: 0 }, true);
      this.addDiscovery("frost", { x: -7, z: -8 }, true);
      this.addDiscovery("thrusters", { x: 6, z: 9 });
    } else {
      this.snail = this.actor("snail", { x: 0, z: 7 }, 1.35);
      this.path = [{ x: -7, z: 4 }, { x: -5, z: -4 }, { x: 5, z: -9 }];
      this.flags = this.path.map((p, i) => {
        const marker = game.world.createMarker(p, i ? 0x68dfd3 : 0xffd166, 1.3);
        game.world.label?.(marker, String(i + 1), 0xffd166, 2.3);
        return marker;
      });
      game.world.createRoute([this.snail, ...this.path], 0x68dfd3);
      this.addDiscovery("frost", { x: -4, z: 10 });
      this.addDiscovery("antenna", { x: 6, z: 9 });
    }
    game.combat.whistles = Math.max(1, game.combat.whistles);
  }

  actor(model, position, scale) {
    return { ...position, object: this.game.world.createActor(model, position, scale) };
  }

  addDiscovery(id, position, missionDisc = false) {
    const data = EQUIPMENT[id];
    const item = this.actor(data.model, position, data.slot === "software" ? 0.9 : 0.48);
    Object.assign(item, { id, active: true, missionDisc });
    item.marker = this.game.world.createMarker(position, data.color, 1);
    item.tag = this.game.world.label?.(item.marker, data.name.toUpperCase(), data.color, 2.4);
    if (item.tag) { item.tag.scale.set(3.5, 0.66, 1); item.tag.visible = false; }
    this.discoveries.push(item);
  }

  collect(item) {
    if (!item.active) return false;
    item.active = false; item.object.visible = false; item.marker.visible = false;
    if (item.missionDisc) this.discs++;
    const equipment = this.game.progress.equipment;
    const isNew = !equipment.owned.includes(item.id);
    if (isNew) equipment.owned.push(item.id);
    equipItem(equipment, item.id);
    this.game.refreshEquipment(true);
    if (item.id === "frost" && isNew) this.game.combat.freezeCharges = Math.min(3, this.game.combat.freezeCharges + 1);
    this.game.save(this.game.progress);
    this.game.ui.message(`${EQUIPMENT[item.id].name} installed! ${EQUIPMENT[item.id].description}. Saved in Workshop.`);
    return true;
  }

  update(dt) {
    const g = this.game;
    this.spawnClock -= dt;
    if (this.spawned < g.stage.patrols && this.spawnClock <= 0 && g.combat.enemies().length < 6) {
      g.spawnEnemy(false, this.spawned, this.mode === "rescue" ? 2 : 3);
      this.spawned++;
      this.spawnClock = this.mode === "rescue" ? 3.8 : 2.8;
    }
    const nearest = g.combat.nearest(g.player, 5, this.discoveries.filter(d => d.active));
    for (const item of this.discoveries) if (item.active) {
      item.object.rotation.y += dt;
      item.object.position.y = 0.8 + Math.sin(g.elapsed * 2 + item.x) * 0.15;
      if (item.tag) item.tag.visible = item === nearest;
      if (distance(g.player, item) < 1.6) this.collect(item);
    }
    this.clamCooldown = Math.max(0, this.clamCooldown - dt);
    this.inkCooldown = Math.max(0, this.inkCooldown - dt);
    this.clam.marker.visible = this.clamCooldown <= 0;
    g.world.animateSeaLife?.(this.helper.object, g.elapsed);
    g.world.animateSeaLife?.(this.clam.object, g.elapsed, this.clamCooldown <= 0);
    const inkTargets = g.combat.enemies().filter(e => distance(e, this.helper) < 5);
    if (inkTargets.length && this.inkCooldown <= 0) {
      this.inkCooldown = 8;
      g.world.pulse(this.helper, 5, 0xc792ff);
      for (const enemy of inkTargets) enemy.inkSlow = 4;
    }
    for (const friend of this.friends) if (!friend.carried) g.world.animateSeaLife?.(friend.object, g.elapsed);
    if (this.snail && this.checkpoint < this.path.length) this.updateEscort(dt);
  }

  updateEscort(dt) {
    const g = this.game;
    const near = distance(this.snail, g.player) <= 6;
    const blocked = g.combat.enemies().some(e => distance(e, this.snail) < 3.5);
    this.escortState = !near ? "waiting for you" : blocked ? "clear nearby bots" : "parading";
    if (!near || blocked) return;
    const target = this.path[this.checkpoint];
    const d = distance(this.snail, target);
    const step = Math.min(d, dt * 1.45);
    if (d > 0) { this.snail.x += (target.x - this.snail.x) / d * step; this.snail.z += (target.z - this.snail.z) / d * step; }
    this.snail.object.position.set(this.snail.x, 0.55, this.snail.z);
    this.snail.object.rotation.y = Math.atan2(target.x - this.snail.x, target.z - this.snail.z);
    if (distance(this.snail, target) < 0.5) {
      this.flags[this.checkpoint].visible = false;
      this.checkpoint++;
      g.combat.addPickup("shield", this.snail);
      g.ui.message(`NORI reached flag ${this.checkpoint} / 3. Slow and stylish!`);
    }
  }

  patrolsClear() { return this.spawned >= this.game.stage.patrols && !this.game.combat.enemies().length; }
  taskComplete() { return this.mode === "rescue" ? this.rescued === 3 : this.mode === "salvage" ? this.discs === 3 : this.checkpoint === 3; }
  ready() { return this.taskComplete() && this.patrolsClear(); }

  interact() {
    const g = this.game;
    if (g.carry) {
      if (distance(g.player, this.sanctuary) > 2.8) { g.ui.message("Carry your friend to the green sanctuary.", true); return true; }
      const friend = g.carry;
      Object.assign(friend, { carried: false, active: false, x: this.sanctuary.x - 2 + this.rescued * 2, z: this.sanctuary.z + 1 });
      friend.object.position.set(friend.x, 0.55, friend.z);
      g.carry = null; this.rescued++;
      g.ui.message(`Friend safe! ${this.rescued} / 3 musicians reunited.`);
      return true;
    }
    const friend = g.combat.nearest(g.player, 2.5, this.friends.filter(f => f.active));
    if (friend) {
      friend.carried = true; friend.marker.visible = false; g.carry = friend;
      g.ui.message("Friend aboard! Follow the green sanctuary marker.");
      return true;
    }
    if (distance(g.player, this.exit) < 2.5) {
      if (this.ready()) g.finish(true, `${g.stage.name} complete! Your new software and robot parts are waiting in the Workshop.`);
      else g.ui.message(this.taskComplete() ? "Stop every patrol bot before using the exit." : "Finish the expedition objective before using the exit.", true);
      return true;
    }
    if (distance(g.player, this.clam) < 2.6) {
      if (g.shields >= g.upgrades.maxShields) g.ui.message("Clam says: your shields are already sparkling!");
      else if (this.clamCooldown > 0) g.ui.message(`Clam recharging · ${Math.ceil(this.clamCooldown)}s`, true);
      else { g.shields++; this.clamCooldown = 16; g.world.pulse(this.clam, 2, 0xff8bc5); g.ui.message("Pearl polish! One shield repaired."); }
      return true;
    }
    return false;
  }

  prompt() {
    const g = this.game;
    if (g.carry) return distance(g.player, this.sanctuary) < 2.8 ? "E · SET FRIEND DOWN" : "CARRY FRIEND TO GREEN SANCTUARY";
    if (this.friends.some(f => f.active && distance(g.player, f) < 2.5)) return "E · PICK UP FRIEND";
    if (distance(g.player, this.exit) < 2.5) return this.ready() ? "E · FINISH EXPEDITION" : "FINISH TASK + CLEAR PATROLS";
    if (distance(g.player, this.clam) < 2.6) return `E · CLAM REPAIR${this.clamCooldown > 0 ? ` · ${Math.ceil(this.clamCooldown)}s` : ""}`;
    return "";
  }

  objective() {
    const g = this.game;
    if (g.carry) return { ...this.sanctuary, label: "Green sanctuary · Use to rescue" };
    if (this.ready()) return { ...this.exit, label: "Gold beacon · Use to finish" };
    if (!g.combat.weapon || g.combat.ammo <= 0) {
      const weapon = g.combat.objective();
      if (weapon) return weapon;
    }
    const nearest = (candidates, label) => { const t = g.combat.nearest(g.player, Infinity, candidates); return t ? { ...t, label } : null; };
    if (this.mode === "rescue" && this.rescued < 3) return nearest(this.friends.filter(f => f.active), "Beach friend · Use to carry");
    if (this.mode === "salvage" && this.discs < 3) return nearest(this.discoveries.filter(d => d.active && d.missionDisc), "Software CD · walk over to install");
    if (this.snail && this.checkpoint < 3) return { ...this.snail, label: `NORI · ${this.escortState || "stay close"}` };
    return nearest(g.combat.enemies(), "Clear remaining patrols · hold Fire") || { x: 0, z: 3, label: "Patrol approaching · explore / repair" };
  }

  progressText() {
    const action = this.mode === "rescue" ? `${this.rescued}/3 friends` : this.mode === "salvage" ? `${this.discs}/3 CDs` : `${this.checkpoint}/3 flags`;
    return `${action} · ${this.game.combat.kills}/${this.game.stage.patrols} bots`;
  }
}
