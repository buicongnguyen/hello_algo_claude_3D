import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { actorScale, actorHeight, cameraZoom, CAMERA_YAW, MODEL_SCALE, departureHeight, limbPhase } from "../src/presentation.js";
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
  assert.ok(manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0) < 4_000_000);
  assert.ok(manifest.assets.find(asset => asset.name === "palm").meshes <= 4, "static leaflets must batch by material");
  for (const asset of manifest.assets) {
    assert.ok(asset.triangles > 0 && asset.triangles <= 12000, `${asset.name}: triangle budget`);
    assert.ok(asset.meshes <= 40, `${asset.name}: rigid-part batching`);
    const bytes = readFileSync(new URL(`../public/models/${asset.file}`, import.meta.url));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(bytes.toString("utf8", 0, 4), "glTF");
    assert.equal(asset.sha256, createHash("sha256").update(bytes).digest("hex").slice(0, 16));
  }
});

test("quadrupeds trot diagonally and departure motion is bounded", () => {
  assert.equal(limbPhase("Hip_L_F", true), limbPhase("Hip_R_B", true));
  assert.equal(limbPhase("Hip_R_F", true), limbPhase("Hip_L_B", true));
  assert.notEqual(limbPhase("Hip_R_F", true), limbPhase("Hip_L_F", true));
  assert.equal(departureHeight(0), 0.65);
  assert.ok(departureHeight(3) > departureHeight(2));
  assert.equal(departureHeight(100), departureHeight(4.4));
  assert.ok(departureHeight(4.4, true) < 3.2);
});

test("real Blender dogs have taller canine proportions and named joints", async () => {
  for (const name of ["bolt", "zombie_dog"]) {
    const bytes = readFileSync(new URL(`../public/models/${name}.glb`, import.meta.url));
    const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
    assert.ok(size.y > 1.8 && size.z > size.x * 2, `${name}: ${size.toArray()}`);
    const joints = []; scene.traverse(child => { if (child.name.startsWith("Hip_")) joints.push(child); });
    assert.equal(joints.length, 4);
    assert.ok(joints.some(joint => joint.name.includes("_L_B")));
    assert.ok(scene.getObjectByName("TailPivot") || scene.getObjectByName("TailPivot001"));
  }
});
