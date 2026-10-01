import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Per-asset triangle ceilings, sized by how big each asset is on a 390x844 phone (the
// lightweight-game-objects budget table), about 8% above what tools/blender/build_assets.py
// produces today. Raise one only on purpose, with the on-screen reason next to it.
const TRIANGLE_BUDGET = {
  // Hero: ~60-150 px in play, ~300-400 px in the workshop close-up. Built at 3,340.
  kai: 3650,
  // Enemies and friends, ~60-150 px: aim for 3,000 or less.
  rust_scout: 3050, // 2,780: same robot builder as KAI, without the close-up bevels
  bolt: 3250, // 2,980: floppy ears keep two bevel segments
  zombie_dog: 3050, // 2,804
  rust_drone: 1850, // 1,712
  octopus: 2950, // 2,692
  clam: 2400, // 2,192
  snail: 2050, // 1,872
  starfish: 950, // 864
  crab: 900, // 808
  // Scenery and landmarks, ~100-300 px.
  palm: 2200, // 2,022 (was 10,340)
  lighthouse: 1650, // 1,528
  rocket: 1150, // 1,044
  starship: 3450, // 3,172: the celebration close-up
  reef_arch: 1100, // 996
  coral_cluster: 950, // 860
  salvage_tower: 800, // 720
  moon_mushroom: 1600, // 1,464
  turret: 520, // 468
  beacon: 460, // 424
  // Pickups and attachments, ~16-120 px.
  energy_cell: 250, // 220
  software_disc: 700, // 648
  prism_armor: 450, // 396
  twin_thrusters: 720, // 660
  halo_antenna: 420, // 376
};

const manifest = JSON.parse(readFileSync(new URL("../public/models/manifest.json", import.meta.url)));

test("every exported asset has a triangle budget sized for its on-screen size", () => {
  assert.deepEqual(manifest.assets.map(asset => asset.name).sort(), Object.keys(TRIANGLE_BUDGET).sort());
  for (const asset of manifest.assets) {
    assert.ok(asset.triangles <= TRIANGLE_BUDGET[asset.name], `${asset.name}: ${asset.triangles} triangles > budget ${TRIANGLE_BUDGET[asset.name]}`);
  }
});

test("the whole gameplay model set stays light", () => {
  const triangles = manifest.assets.reduce((sum, asset) => sum + asset.triangles, 0);
  const bytes = manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0);
  assert.ok(triangles <= 40_000, `total triangles ${triangles}`); // 37,042 (was 80,432)
  assert.ok(bytes <= 1_650_000, `total bytes ${bytes}`); // 1,473,276 (was 2,510,676)
});
