export const PAINTS = {
  lagoon: { name: "Lagoon blue", shell: 0x26bed9, accent: 0xffcb52 },
  sunset: { name: "Sunset coral", shell: 0xff766f, accent: 0x63f6ed },
  orchid: { name: "Cosmic orchid", shell: 0xaf73ff, accent: 0xffd955 },
  lime: { name: "Lime fizz", shell: 0x9ae45d, accent: 0xed79ff },
  candy: { name: "Candy pink", shell: 0xff83cf, accent: 0x70ecff },
  gold: { name: "Solar gold", shell: 0xffc34b, accent: 0x78a7ff },
};

export const EQUIPMENT = {
  turbo: { name: "Turbo OS", slot: "software", model: "software_disc", color: 0x65edac, description: "Move 12% faster", found: "Coral Cove or Neon Scrap Safari" },
  overclock: { name: "Overclock OS", slot: "software", model: "software_disc", color: 0xff93df, description: "Weapons recharge 18% faster", found: "Neon Scrap Safari" },
  frost: { name: "Frost OS", slot: "software", model: "software_disc", color: 0x76ddff, description: "Begin combat with one Freeze Pop", found: "Neon Scrap Safari or Moonpool Parade" },
  armor: { name: "Prism Armor", slot: "body", model: "prism_armor", color: 0xc295ff, description: "+1 maximum shield", found: "Coral Cove Rescue" },
  thrusters: { name: "Twin Thrusters", slot: "back", model: "twin_thrusters", color: 0xffb958, description: "Dash recharges 20% faster", found: "Neon Scrap Safari" },
  antenna: { name: "Halo Antenna", slot: "head", model: "halo_antenna", color: 0xff86bf, description: "+0.5 pulse range", found: "Moonpool Parade" },
};

export function normalizeEquipment(raw = {}) {
  if (!raw || typeof raw !== "object") raw = {};
  const owned = [...new Set((Array.isArray(raw.owned) ? raw.owned : []).filter(id => typeof id === "string" && Object.hasOwn(EQUIPMENT, id)))];
  const equipped = {};
  for (const slot of ["software", "body", "back", "head"]) {
    const id = raw.equipped?.[slot];
    equipped[slot] = owned.includes(id) && EQUIPMENT[id].slot === slot ? id : null;
  }
  return { owned, equipped, paint: typeof raw.paint === "string" && Object.hasOwn(PAINTS, raw.paint) ? raw.paint : "lagoon" };
}

export function equipItem(equipment, id) {
  if (!Object.hasOwn(EQUIPMENT, id) || !equipment.owned.includes(id)) return false;
  equipment.equipped[EQUIPMENT[id].slot] = id;
  return true;
}

export function equipmentStats(base, equipment, arcade = false) {
  const e = equipment.equipped;
  return { ...base, maxShields: Math.max(arcade ? 5 : 3, base.maxShields) + (e.body === "armor" ? 1 : 0),
    dashRecharge: base.dashRecharge * (e.back === "thrusters" ? 0.8 : 1),
    pulseRadius: base.pulseRadius + (e.head === "antenna" ? 0.5 : 0),
    moveSpeed: 6.3 * (e.software === "turbo" ? 1.12 : 1),
    fireRate: e.software === "overclock" ? 0.82 : 1 };
}

export function dressRobot(world, actor, equipment) {
  const paint = PAINTS[equipment.paint] || PAINTS.lagoon;
  // Clone just once: the cached Blender material must never be recolored globally.
  actor.traverse(child => {
    if (!child.isMesh || !child.material?.name) return;
    const name = child.material.name;
    if (!name.startsWith("Ceramic White") && !name.startsWith("Aurora Cyan")) return;
    if (!child.userData.ownedPaint) { child.material = child.material.clone(); child.userData.ownedPaint = true; }
    const color = name.startsWith("Ceramic") ? paint.shell : paint.accent;
    child.material.color.setHex(color);
    if (name.startsWith("Aurora") && child.material.emissive) child.material.emissive.setHex(color);
  });
  for (const part of actor.userData.attachments || []) world.release(part);
  actor.userData.attachments = [];
  for (const slot of ["body", "back", "head"]) {
    const data = EQUIPMENT[equipment.equipped[slot]];
    if (!data) continue;
    const part = world.createActor(data.model, { x: 0, z: 0 }, 1, actor, { nativeScale: true });
    part.position.set(0, 0, 0);
    part.userData.equipmentSlot = slot;
    actor.userData.attachments.push(part);
  }
}
