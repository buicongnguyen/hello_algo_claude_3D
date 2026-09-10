import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { actorScale, actorHeight, cameraZoom, CAMERA_YAW, MODEL_SCALE } from "../src/presentation.js";
import { World } from "../src/world.js";
import { dressRobot, normalizeEquipment } from "../src/equipment.js";

test("all gameplay models are smaller, with readable enemies and compact sea life", () => {
  for (const scale of Object.values(MODEL_SCALE)) assert.ok(scale >= 0.65 && scale < 1);
  assert.ok(actorScale("kai", 0.94) < 0.8);
  assert.ok(actorScale("snail", 1.35) < 1);
  assert.ok(actorScale("rust_scout", 0.56) >= 0.5);
  assert.equal(actorScale("unknown", 2), 2);
});

test("portrait view widens smoothly without rotating controls or minimap", () => {
  assert.equal(cameraZoom(16 / 9), 1.14);
  assert.equal(cameraZoom(390 / 844), 1.14 + 0.36 * ((1 - 390 / 844) / 0.54));
  assert.ok(cameraZoom(0.2) <= 1.5);
  for (const aspect of [0.4, 0.6, 0.8, 1, 2]) {
    const z = cameraZoom(aspect);
    assert.ok(Math.abs(Math.atan2(9.5 * z, 15 * z) - CAMERA_YAW) < 1e-12);
  }
});

test("equipment inherits KAI scale exactly once and workshop stays full detail", () => {
  const world = { models: new Map(), mission: new THREE.Group(), settings: {},
    fallback: () => new THREE.Group(), createActor: World.prototype.createActor,
    release: object => object.removeFromParent() };
  const hero = world.createActor("kai", { x: 0, y: 0, z: 0 }, 0.94);
  assert.equal(hero.position.y, 0);
  dressRobot(world, hero, normalizeEquipment({ owned: ["armor", "thrusters", "antenna"], equipped: { body: "armor", back: "thrusters", head: "antenna" } }));
  hero.updateMatrixWorld(true);
  for (const part of hero.userData.attachments) {
    assert.equal(part.scale.y, 1);
    assert.equal(part.getWorldScale(new THREE.Vector3()).y, hero.scale.y);
    assert.equal(part.position.y, 0);
  }
  assert.equal(actorScale("kai", 1.2, true), 1.2);
  assert.equal(actorHeight(hero, 1.18), hero.scale.y * 1.18);
});

test("detailed Blender exports stay within a browser asset budget", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/models/manifest.json", import.meta.url)));
  assert.equal(manifest.assets.length, Object.keys(MODEL_SCALE).length);
  assert.ok(manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0) < 2_000_000);
  for (const asset of manifest.assets) {
    assert.ok(asset.triangles > 0 && asset.triangles <= 6000, `${asset.name}: triangle budget`);
    assert.ok(asset.meshes <= 30, `${asset.name}: rigid-part batching`);
    const bytes = readFileSync(new URL(`../public/models/${asset.file}`, import.meta.url));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(bytes.toString("utf8", 0, 4), "glTF");
  }
});
