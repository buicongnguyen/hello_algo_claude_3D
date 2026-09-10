import * as THREE from "three";
import { actorHeight } from "./presentation.js";

const aimHeight = entity => actorHeight(entity.object, entity.variant === "drone" ? 0.38 : entity.variant === "dog" ? 0.8 : 1.35);

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const hostile = entity => entity.active && ["enemy", "boss"].includes(entity.kind);
export const WEAPONS = {
  bubble: { name: "Bubble Blaster", ammo: 36, range: 14, cooldown: 0.24, damage: 1, color: 0x5ce5ff },
  arc: { name: "Arc Fork", ammo: 18, range: 11, cooldown: 0.6, damage: 2, color: 0xc99bff },
};
const LOOT = {
  bubble: { label: "BUBBLE BLASTER", color: 0x5ce5ff },
  arc: { label: "ARC FORK", color: 0xc99bff },
  freeze: { label: "FREEZE POP", color: 0xa3f6ff },
  whistle: { label: "CRAB WHISTLE", color: 0xffc75f },
  shield: { label: "+1 SHIELD", color: 0x65ed9c },
};

export class Combat {
  constructor(game) {
    this.game = game;
    this.enabled = ["combat", "defense", "boss", "finale", "brawl", "expedition"].includes(game.stage.type) || Boolean(game.stage.enemies);
    this.weapon = null;
    this.ammo = 0;
    this.cooldown = 0;
    this.freezeCharges = 0;
    this.whistles = 0;
    this.scrap = 0;
    this.pickups = [];
    this.bullets = [];
    this.bulletPool = [];
    this.animals = [];
    this.kills = 0;
    this.wave = 0;
    this.waveSpawned = 0;
    this.waveDelay = 4;
    this.spawnDelay = 0;
    this.waves = [6, 8, 10];
    if (!this.enabled) return;
    this.addPickup("bubble", { x: -2, z: 10 });
    this.addPickup("arc", { x: 3, z: 8 });
    this.addPickup("freeze", { x: -5, z: 6 });
    this.addPickup("whistle", { x: 6, z: 5 });
    if (game.stage.type === "brawl") {
      game.upgrades.maxShields = Math.max(5, game.upgrades.maxShields);
      game.shields = game.upgrades.maxShields;
      this.addPickup("freeze", { x: 8, z: -4 });
      this.addPickup("whistle", { x: -8, z: -4 });
    }
  }

  enemies() { return this.game.entities.filter(hostile); }
  nearest(origin, range = Infinity, candidates = this.enemies()) {
    let best = null, limit = range;
    for (const candidate of candidates) {
      const d = distance(origin, candidate);
      if (d < limit) { best = candidate; limit = d; }
    }
    return best;
  }

  addPickup(type, position) {
    const data = LOOT[type];
    let item = this.pickups.find(p => !p.active && p.type === type);
    if (!item) {
      if (this.pickups.length >= 18) return;
      const object = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({ color: data.color, emissive: data.color, emissiveIntensity: 0.5, roughness: 0.3 });
      const geometry = type === "freeze" ? new THREE.IcosahedronGeometry(0.5, 0) : type === "whistle" ? new THREE.TorusGeometry(0.4, 0.15, 8, 14) : new THREE.BoxGeometry(0.85, 0.65, 0.55);
      const mesh = new THREE.Mesh(geometry, material); mesh.scale.setScalar(0.72); mesh.position.y = 0.75; object.add(mesh);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.045, 6, 24), new THREE.MeshBasicMaterial({ color: data.color }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.12; object.add(ring);
      const tag = this.game.world.label?.(object, data.label, data.color, 1.6);
      if (tag) { tag.scale.set(3.2, 0.60, 1); tag.visible = false; }
      this.game.world.mission.add(object);
      item = { type, object, mesh, tag, active: true }; this.pickups.push(item);
    }
    Object.assign(item, { x: position.x, z: position.z, active: true });
    item.object.position.set(item.x, 0.55, item.z); item.object.visible = true;
  }

  collect(item) {
    if (!item.active) return;
    if (item.type === "freeze" && this.freezeCharges >= 3 || item.type === "whistle" && this.whistles >= 3 || item.type === "shield" && this.game.shields >= this.game.upgrades.maxShields) return;
    item.active = false; item.object.visible = false;
    if (WEAPONS[item.type]) {
      this.weapon = item.type;
      this.ammo = WEAPONS[item.type].ammo;
      this.cooldown = 0;
      this.equipVisual();
      this.game.ui.message(`${WEAPONS[item.type].name}! Hold Fire / Space to auto-aim.`);
    } else if (item.type === "freeze") { this.freezeCharges++; this.game.ui.message("Freeze Pop! F / Freeze stops a nearby group."); }
    else if (item.type === "whistle") { this.whistles++; this.game.ui.message("Crab Whistle! R / Call brings three tiny helpers."); }
    else { this.game.shields = Math.min(this.game.upgrades.maxShields, this.game.shields + 1); this.game.ui.message("Shield patched. Back in the brawl!"); }
  }

  equipVisual() {
    if (this.gear) this.game.world.release(this.gear);
    this.gear = new THREE.Group();
    const color = WEAPONS[this.weapon].color;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.35), new THREE.MeshStandardMaterial({ color: 0x16344b }));
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.26, 0.85, 10), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 }));
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.18, 0.32);
    this.gear.add(grip, barrel); this.gear.position.set(-0.78, 1.18, 0.3);
    this.game.player.object.add(this.gear);
  }

  update(dt) {
    if (!this.enabled) return;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const nearbyLoot = this.nearest(this.game.player, 5, this.pickups.filter(p => p.active));
    for (const item of this.pickups) if (item.active) {
      // One nearby caption identifies loot without hiding the fighting behind it.
      if (item.tag) item.tag.visible = item === nearbyLoot;
      item.mesh.rotation.y += dt * 1.5;
      item.mesh.position.y = 0.75 + Math.sin(this.game.elapsed * 3 + item.x) * 0.09;
      if (distance(item, this.game.player) < 1.45) this.collect(item);
    }
    for (const enemy of this.game.entities) {
      if (enemy.repairTag) enemy.repairTag.visible = enemy.repairable && distance(enemy, this.game.player) < 5;
      if (enemy.frozen > 0) {
        enemy.frozen = Math.max(0, enemy.frozen - dt);
        if (enemy.ice) enemy.ice.visible = enemy.frozen > 0 && enemy.active;
      }
    }
    this.updateBullets(dt);
    if (!this.game.running) return;
    this.updateAllies(dt);
    if (!this.game.running) return;
    if (this.game.stage.type === "brawl") this.updateBrawl(dt);
  }

  shoot() {
    if (!this.enabled || this.cooldown > 0 || this.bullets.length >= 28) return false;
    if (!this.weapon || this.ammo <= 0) { this.game.ui.message("Grab a glowing weapon crate. Q / Pulse always works.", true); this.cooldown = 0.6; return false; }
    const weapon = WEAPONS[this.weapon];
    const target = this.nearest(this.game.player, weapon.range, this.enemies().filter(e => !e.boss || e.state === "exposed"));
    if (!target) return false; // Holding Fire never wastes ammunition on empty sky.
    this.cooldown = weapon.cooldown * (this.game.upgrades.fireRate || 1); this.ammo--;
    this.game.player.object.rotation.y = Math.atan2(target.x - this.game.player.x, target.z - this.game.player.z);
    if (this.weapon === "arc") {
      const chain = [target];
      while (chain.length < 3) {
        const next = this.nearest(chain.at(-1), 4.5, this.enemies().filter(e => !chain.includes(e)));
        if (!next) break;
        chain.push(next);
      }
      this.makeBolt([this.game.player, ...chain], weapon.color);
      for (const enemy of chain) this.hit(enemy, weapon.damage);
    } else this.makeBullet(target, weapon);
    this.game.ui.callbacks?.sound?.("shot");
    return true;
  }

  makeBolt(points, color) {
    if (this.bullets.length >= 28) return;
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p.x, p.object ? (p === this.game.player ? actorHeight(p.object, 1.18) : aimHeight(p)) : p.y ?? 1.4, p.z)));
    const object = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color }));
    this.game.world.mission.add(object);
    this.bullets.push({ object, life: 0.16, beam: true });
  }

  makeBullet(target, weapon) {
    if (this.bullets.length >= 28) return;
    const object = this.bulletPool.pop() || new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshBasicMaterial({ color: weapon.color }));
    const muzzleY = actorHeight(this.game.player.object, 1.18);
    object.position.set(this.game.player.x, muzzleY, this.game.player.z);
    object.visible = true; this.game.world.mission.add(object);
    const dx = target.x - this.game.player.x, dz = target.z - this.game.player.z;
    const d = Math.hypot(dx, dz) || 1;
    const height = aimHeight(target);
    this.bullets.push({ object, x: this.game.player.x, z: this.game.player.z, y: muzzleY, vy: (height - muzzleY) / Math.max(0.1, d / 22), vx: dx / d * 22, vz: dz / d * 22, life: 0.7, damage: weapon.damage });
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const shot = this.bullets[i]; shot.life -= dt;
      if (!shot.beam) {
        const oldX = shot.x, oldZ = shot.z;
        shot.x += shot.vx * dt; shot.z += shot.vz * dt;
        shot.y += shot.vy * dt;
        shot.object.position.set(shot.x, shot.y, shot.z);
        // Swept collision prevents fast bullets skipping small dogs and drones.
        const dx = shot.x - oldX, dz = shot.z - oldZ;
        const hit = this.enemies().map(enemy => {
          const t = Math.max(0, Math.min(1, ((enemy.x - oldX) * dx + (enemy.z - oldZ) * dz) / (dx * dx + dz * dz || 1)));
          return { enemy, t, d: Math.hypot(enemy.x - oldX - t * dx, enemy.z - oldZ - t * dz) };
        }).filter(hit => hit.d < (hit.enemy.boss ? 1.3 : 0.85)).sort((a, b) => a.t - b.t)[0];
        if (hit) { this.hit(hit.enemy, shot.damage); shot.life = 0; }
      }
      if (shot.life <= 0) {
        if (shot.beam) this.game.world.release(shot.object);
        else { shot.object.visible = false; this.bulletPool.push(shot.object); }
        this.bullets.splice(i, 1);
      }
    }
  }

  hit(enemy, damage) {
    if (!hostile(enemy)) return false;
    if (enemy.boss && enemy.state !== "exposed") {
      this.game.ui.message("Boss shield up—dodge the charge, then hit the cyan core.", true);
      return false;
    }
    enemy.health -= damage;
    if (enemy.healthBar) enemy.healthBar.scale.x = Math.max(0, enemy.health / enemy.maxHealth) * 1.5;
    this.game.world.pulse(enemy, 0.65, 0xffd166);
    if (enemy.health <= 0) this.game.disableEntity(enemy, ["combat", "defense", "finale", "brawl"].includes(this.game.stage.type));
    return true;
  }

  moveEnemy(enemy, target, dt) {
    const g = this.game;
    if (enemy.inkSlow > 0) { enemy.inkSlow = Math.max(0, enemy.inkSlow - dt); dt *= 0.4; }
    const d = distance(enemy, target) || 1;
    let moving = false;
    const approach = () => {
      const step = Math.min(d, enemy.speed * dt);
      enemy.x += (target.x - enemy.x) / d * step;
      enemy.z += (target.z - enemy.z) / d * step;
      moving = true;
    };
    // Relay attackers follow their marked lanes. Dogs and drones still show intent near KAI.
    const attackingPlayer = target === g.player;
    if (!attackingPlayer) approach();
    else if (enemy.attackState === "approach") {
      const range = enemy.variant === "dog" ? 5 : enemy.variant === "drone" ? 7 : 1.8;
      if (d > range) approach();
      else {
        enemy.attackState = "windup";
        enemy.attackTime = enemy.variant === "drone" ? 0.85 : enemy.variant === "dog" ? 0.65 : 0.4;
        enemy.rushX = (target.x - enemy.x) / d;
        enemy.rushZ = (target.z - enemy.z) / d;
        enemy.warningLine = g.world.createRoute([enemy, { x: enemy.x + enemy.rushX * range, z: enemy.z + enemy.rushZ * range }], 0xff5b45);
      }
    } else {
      enemy.attackTime -= dt;
      if (enemy.attackState === "windup" && enemy.attackTime <= 0) {
        enemy.attackState = "rush"; enemy.attackTime = enemy.variant === "bot" ? 0.3 : 0.55;
        if (enemy.warningLine) { g.world.release(enemy.warningLine); enemy.warningLine = null; }
      } else if (enemy.attackState === "rush") {
        const speed = enemy.variant === "bot" ? 6 : 12;
        enemy.x += enemy.rushX * speed * dt; enemy.z += enemy.rushZ * speed * dt;
        moving = true;
        if (enemy.attackTime <= 0) { enemy.attackState = "recover"; enemy.attackTime = 0.8; }
      } else if (enemy.attackState === "recover" && enemy.attackTime <= 0) enemy.attackState = "approach";
    }
    const radius = Math.hypot(enemy.x, enemy.z);
    if (radius > 18) { enemy.x *= 18 / radius; enemy.z *= 18 / radius; }
    const height = enemy.variant === "drone" ? (enemy.attackState === "rush" ? 0.95 : 1.85 + Math.sin(g.elapsed * 5 + enemy.x) * 0.2) : 0.55;
    enemy.object.position.set(enemy.x, height, enemy.z);
    enemy.object.rotation.y = Math.atan2(target.x - enemy.x, target.z - enemy.z);
    g.world.animateActor?.(enemy.object, g.elapsed + enemy.x, moving);
    enemy.object.traverse(child => { if (child.name.startsWith("Rotor")) child.rotation.y += dt * 28; });
    return !attackingPlayer || enemy.attackState === "rush";
  }

  freeze() {
    if (!this.enabled || this.freezeCharges <= 0) { this.game.ui.message("Find a blue Freeze Pop first.", true); return false; }
    const center = this.nearest(this.game.player, 12);
    if (!center) { this.game.ui.message("No enemies close enough to freeze.", true); return false; }
    this.freezeCharges--;
    this.game.world.pulse(center, 5.5, 0xa3f6ff);
    for (const enemy of this.enemies()) if (distance(center, enemy) <= 5.5) {
      enemy.frozen = enemy.boss ? 1.5 : 5;
      if (!enemy.boss) { enemy.attackState = "recover"; enemy.attackTime = 0.6; }
      if (enemy.warningLine && !enemy.boss) { this.game.world.release(enemy.warningLine); enemy.warningLine = null; }
      if (!enemy.ice) {
        enemy.ice = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 0), new THREE.MeshBasicMaterial({ color: 0x8befff, transparent: true, opacity: 0.35, wireframe: true }));
        enemy.ice.position.y = 1; enemy.object.add(enemy.ice);
      }
      enemy.ice.visible = true;
    }
    this.game.ui.message("Brain freeze! Five seconds to regroup or shoot.");
    return true;
  }

  callAnimals() {
    if (!this.enabled || this.whistles <= 0) { this.game.ui.message("Pick up a gold Crab Whistle first.", true); return false; }
    this.whistles--;
    if (!this.animals.length) for (let i = 0; i < 3; i++) {
      const p = { x: this.game.player.x + (i - 1) * 1.2, z: this.game.player.z + 1.2 };
      const object = this.game.world.createActor("crab", p, 1);
      this.game.cloneMaterials(object); this.game.tint(object, 0xffc75f, 0.3);
      this.animals.push({ ...p, object, cooldown: 0, animal: true, index: i });
    }
    for (const animal of this.animals) { animal.life = 14; animal.object.visible = true; }
    this.game.ui.message("Crab crew reporting for pinch duty! 14 seconds of help.");
    return true;
  }

  onDisabled(enemy, defeated) {
    if (!this.enabled) return;
    if (enemy.warningLine) { this.game.world.release(enemy.warningLine); enemy.warningLine = null; }
    if (enemy.ice) enemy.ice.visible = false;
    if (!defeated || enemy.boss) return;
    enemy.repairable = true;
    enemy.object.rotation.z = Math.PI / 2;
    enemy.repairTag = this.game.world.label?.(enemy.object, "FIX · 2 SCRAP", 0x65ed9c, 2.2);
    if (enemy.repairTag) { enemy.repairTag.scale.set(3.8, 0.72, 1); enemy.repairTag.visible = false; }
    this.scrap++; this.kills++;
    // Keep a useful repair choice without retaining an island full of rendered bodies.
    const downed = this.game.entities.filter(e => e.repairable);
    for (const old of downed.slice(0, Math.max(0, downed.length - 6))) {
      old.repairable = false;
      this.game.world.release(old.object);
    }
    const drop = ["freeze", "shield", "whistle", "bubble", "arc"][Math.floor(this.kills / 3) % 5];
    if (this.kills % 3 === 0) this.addPickup(drop, enemy);
  }

  repairTarget() { return this.nearest(this.game.player, 2.5, this.game.entities.filter(e => e.repairable)); }
  repair() {
    const enemy = this.repairTarget();
    if (!enemy) return false;
    const team = this.game.entities.filter(e => e.kind === "ally");
    if (team.length >= 3) { this.game.ui.message("Your robot team is full: three happy helpers.", true); return true; }
    if (this.scrap < 2) { this.game.ui.message("Repair needs 2 scrap. Down another zombie bot first.", true); return true; }
    this.scrap -= 2;
    Object.assign(enemy, { kind: "ally", active: true, repairable: false, cooldown: 0.3, frozen: 0, index: team.length });
    enemy.object.rotation.z = 0;
    enemy.object.traverse(child => { if (child.isSprite) child.visible = false; });
    this.game.tint(enemy.object, 0x56e8af, 0.35);
    const tag = this.game.world.label?.(enemy.object, "TEAM KAI", 0x65ed9c, 2.5);
    if (tag) tag.scale.set(2.8, 0.53, 1);
    this.game.ui.message("Repaired! Your new teammate will follow and fight.");
    return true;
  }

  updateAllies(dt) {
    const team = this.game.entities.filter(e => e.kind === "ally").concat(this.animals.filter(a => a.life > 0));
    for (const ally of team) {
      if (ally.animal) { ally.life -= dt; if (ally.life <= 0) { ally.object.visible = false; continue; } }
      ally.cooldown = Math.max(0, ally.cooldown - dt);
      const target = this.nearest(ally, 11);
      const destination = target || { x: this.game.player.x + (ally.index - 1) * 1.8, z: this.game.player.z + 2 };
      const d = distance(ally, destination) || 1;
      const range = ally.animal ? 1.35 : 6;
      if (d > (target ? range * 0.8 : 1)) {
        const step = Math.min(d, dt * (ally.animal ? 5.2 : 4));
        ally.x += (destination.x - ally.x) / d * step; ally.z += (destination.z - ally.z) / d * step;
      }
      ally.object.position.set(ally.x, ally.variant === "drone" ? 1.8 : 0.55 + (ally.animal ? Math.abs(Math.sin(this.game.elapsed * 12)) * 0.15 : 0), ally.z);
      ally.object.rotation.y = Math.atan2(destination.x - ally.x, destination.z - ally.z);
      this.game.world.animateActor?.(ally.object, this.game.elapsed, d > range);
      if (target && d < range && ally.cooldown <= 0) {
        ally.cooldown = ally.animal ? 1.2 : 1;
        this.makeBolt([ally, target], ally.animal ? 0xffc75f : 0x65ed9c);
        this.hit(target, 1);
      }
    }
  }

  updateBrawl(dt) {
    const g = this.game;
    if (this.waveDelay > 0) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) { this.wave++; this.waveSpawned = 0; this.spawnDelay = 0; g.ui.message(`Wave ${this.wave} / 3 · zombie beach party!`, true); }
      return;
    }
    this.spawnDelay -= dt;
    if (this.waveSpawned < this.waves[this.wave - 1] && this.spawnDelay <= 0 && this.enemies().length < 10) {
      // Advance variants independently from kills so quick defeats cannot skip a type.
      const index = this.waves.slice(0, this.wave - 1).reduce((sum, count) => sum + count, 0) + this.waveSpawned;
      g.spawnEnemy(false, index, this.wave + 1);
      this.waveSpawned++; this.spawnDelay = Math.max(0.8, 1.7 - this.wave * 0.2);
    }
    if (this.waveSpawned >= this.waves[this.wave - 1] && !this.enemies().length) {
      if (this.wave === 3) return g.finish(true, "Zombie beach party stopped! Your repaired robot pals and tiny crab heroes saved the shore.");
      this.waveDelay = 7;
      this.addPickup("shield", { x: 0, z: 3 });
      this.addPickup(this.wave === 1 ? "arc" : "bubble", { x: -3, z: 4 });
      this.addPickup("freeze", { x: 3, z: 4 });
      g.ui.message("Wave clear! Seven seconds to loot and repair a new teammate.");
    }
  }

  objective() {
    if (!this.enabled) return null;
    // Optional equipment must not hide a required build, delivery or launch action.
    if (["prepare", "ready", "launch", "celebrate"].includes(this.game.phase) || this.game.goal && !this.game.goal.locked) return null;
    if (!["brawl", "expedition"].includes(this.game.stage.type) && !this.enemies().length) return null;
    if (!this.weapon || this.ammo <= 0) {
      const item = this.nearest(this.game.player, Infinity, this.pickups.filter(p => p.active && WEAPONS[p.type]));
      if (item) return { ...item, label: `Walk over ${WEAPONS[item.type].name}` };
    }
    if (this.game.stage.type === "brawl") {
      const target = this.nearest(this.game.player);
      return target ? { ...target, label: `${target.variant === "dog" ? "Zombie dog · dodge its pounce" : target.variant === "drone" ? "Zombie drone · dodge its dive" : "Tiny zombie bot"} · hold Fire` } : { x: 0, z: 3, label: `Next wave in ${Math.max(0, Math.ceil(this.waveDelay))}s · loot / repair` };
    }
    return null;
  }
}
