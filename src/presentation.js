// Visual proportions only: objective distances, timers and pickup ranges stay unchanged.
export const MODEL_SCALE = Object.freeze({
  kai: 0.82, bolt: 0.78, rust_scout: 0.9, zombie_dog: 0.86, rust_drone: 0.82,
  lighthouse: 0.86, rocket: 0.86, palm: 0.82, turret: 0.8, beacon: 0.8,
  energy_cell: 0.76, crab: 0.72, octopus: 0.72, starfish: 0.67, snail: 0.68, clam: 0.7,
  coral_cluster: 0.8, reef_arch: 0.8, salvage_tower: 0.8, moon_mushroom: 0.8,
  software_disc: 0.74, prism_armor: 0.72, twin_thrusters: 0.72, halo_antenna: 0.72,
  starship: 0.85,
});

export function actorScale(name, scale = 1, nativeScale = false) {
  // Attachments are already in the robot's coordinate system. Never shrink twice.
  return scale * (nativeScale ? 1 : MODEL_SCALE[name] ?? 1);
}

export const CAMERA_YAW = Math.atan2(9.5, 15);

export function cameraZoom(aspect) {
  // Widen narrow screens gradually; retain a readable hero in landscape.
  return 1.14 + 0.36 * Math.max(0, Math.min(1, (1 - aspect) / 0.54));
}

export function actorHeight(object, localHeight) {
  return object.position.y + object.scale.y * localHeight;
}

export const VICTORY_DURATION = 4.4;
export function departureHeight(age, reducedMotion = false) {
  const t = Math.max(0, Math.min(VICTORY_DURATION, age) - 1.1);
  return 0.65 + (reducedMotion ? Math.min(2.5, t) : t * t * 1.8);
}

export function limbPhase(name, quadruped = false) {
  const side = name.includes("_L") ? 1 : -1;
  return side * (quadruped && name.includes("_B") ? -1 : 1) * (name.startsWith("Shoulder") ? -1 : 1);
}
