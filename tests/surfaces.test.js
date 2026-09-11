import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { surfacePixels, createSurfaces, finishMaterial, grassGeometry, groundCoverTexture } from "../src/surfaces.js";
import { World } from "../src/world.js";

test("procedural finishes are deterministic with normalized tangent-space normals", () => {
  for (const kind of ["sand", "wood", "metal", "water"]) {
    const a = surfacePixels(kind), b = surfacePixels(kind);
    assert.deepEqual(a, b);
    assert.equal(a.normal.length, 128 * 128 * 4);
    assert.ok(new Set(a.color).size > 6);
    for (let i = 0; i < a.normal.length; i += 4) {
      const n = [a.normal[i], a.normal[i + 1], a.normal[i + 2]].map(v => v / 255 * 2 - 1);
      assert.ok(Math.abs(Math.hypot(...n) - 1) < .015);
      assert.equal(a.normal[i + 3], 255);
    }
  }
  assert.throws(() => surfacePixels("missing"));
});

test("coastal vegetation uses a tiny blade mesh and soft transparent patch edges", () => {
  const geometry = grassGeometry();
  assert.equal(geometry.attributes.position.count, 45);
  geometry.computeBoundingBox();
  assert.equal(geometry.boundingBox.min.y, 0);
  assert.ok(geometry.boundingBox.max.y < .6);
  const texture = groundCoverTexture(), { data, width, height } = texture.image;
  for (let x = 0; x < width; x++) {
    assert.equal(data[x * 4 + 3], 0);
    assert.equal(data[((height - 1) * width + x) * 4 + 3], 0);
  }
  assert.ok(data[(32 * width + 32) * 4 + 3] > 0);
  geometry.dispose(); texture.dispose();
});

test("surface textures share bounded mipmapped data and material finishing is idempotent", () => {
  const surfaces = createSurfaces({ capabilities: { getMaxAnisotropy: () => 16 } });
  const material = new THREE.MeshStandardMaterial({ name: "Ceramic White" });
  finishMaterial(material, surfaces);
  const normal = material.normalMap;
  finishMaterial(material, surfaces);
  assert.equal(material.normalMap, normal);
  assert.equal(material.normalMap, surfaces.metal.normalMap);
  assert.equal(normal.colorSpace, THREE.NoColorSpace);
  assert.equal(normal.anisotropy, 4);
  let bytes = 0;
  for (const surface of Object.values(surfaces)) for (const texture of Object.values(surface)) {
    bytes += texture.image.data.byteLength;
    assert.equal(texture.wrapS, THREE.RepeatWrapping);
    assert.ok(texture.generateMipmaps);
    texture.dispose();
  }
  assert.ok(bytes <= 524288);
});

test("releasing a painted actor preserves shared finishes and disposes private maps", () => {
  const shared = new THREE.Texture(), privateMap = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ normalMap: shared, map: privateMap });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  const disposed = [];
  for (const [name, resource] of [["shared", shared], ["private", privateMap], ["material", material], ["geometry", mesh.geometry]]) {
    resource.addEventListener("dispose", () => disposed.push(name));
  }
  World.prototype.release.call({ assetResources: new Set([shared]) }, mesh);
  assert.deepEqual(disposed.sort(), ["geometry", "material", "private"]);
});
