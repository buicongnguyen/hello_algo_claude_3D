import * as THREE from "three";

// Deterministic, tileable surface data. No downloads, per-frame baking or per-actor textures.
export function surfacePixels(kind, size = 128) {
  if (!["sand", "wood", "metal", "water"].includes(kind)) throw new Error(`Unknown surface: ${kind}`);
  const color = new Uint8Array(size * size * 4);
  const normal = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const noise = (x, y) => {
    let n = Math.imul(x + 17, 374761393) ^ Math.imul(y + 31, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
    const grain = noise(x, y);
    let h;
    if (kind === "wood") h = .5 + .23 * Math.sin(v * 11 + Math.sin(u) * 1.8) + .1 * Math.sin(v * 29 + Math.sin(u * 2)) + grain * .12;
    else if (kind === "water") h = .5 + .12 * Math.sin(u * 3 + Math.sin(v * 2)) + .10 * Math.cos(v * 5 + Math.sin(u * 2)) + .08 * Math.sin(u * 7 + v * 5) + .04 * Math.cos(u * 11 - v * 9);
    else if (kind === "sand") h = .55 + (grain - .5) * .35 + .06 * Math.sin(u * 2 + Math.sin(v * 3));
    else h = .7 + (grain - .5) * .10 + Math.sin(v * 35) * .035;
    height[y * size + x] = h;
    const index = (y * size + x) * 4;
    // Near-white modulation retains the authored material colors and equipment paints.
    const value = Math.round(255 * (kind === "wood" ? .55 + h * .4 : .79 + h * .2));
    color.set([value, value, value, 255], index);
  }
  const sample = (x, y) => height[((y + size) % size) * size + (x + size) % size];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (sample(x - 1, y) - sample(x + 1, y)) * 2;
    const dy = (sample(x, y - 1) - sample(x, y + 1)) * 2;
    const length = Math.hypot(dx, dy, 1);
    normal.set([Math.round((dx / length * .5 + .5) * 255), Math.round((dy / length * .5 + .5) * 255), Math.round((1 / length * .5 + .5) * 255), 255], (y * size + x) * 4);
  }
  return { color, normal, size };
}

export function createSurfaces(renderer) {
  const result = {};
  for (const kind of ["sand", "wood", "metal", "water"]) {
    const pixels = surfacePixels(kind);
    const make = (data, srgb = false) => {
      const texture = new THREE.DataTexture(data, pixels.size, pixels.size, THREE.RGBAFormat);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.needsUpdate = true;
      return texture;
    };
    const repeat = { sand: [24, 24], wood: [2, 2], metal: [3, 3], water: [12, 12] }[kind];
    result[kind] = { map: make(pixels.color, true), normalMap: make(pixels.normal) };
    for (const texture of Object.values(result[kind])) texture.repeat.set(...repeat);
  }
  return result;
}

export function finishMaterial(material, surfaces) {
  if (!material?.isMeshStandardMaterial || material.userData.surfaceFinished) return;
  material.userData.surfaceFinished = true;
  if (/^(Ceramic White|Rust Coral|Brushed Titanium|Joint Navy)/.test(material.name)) {
    material.normalMap = surfaces.metal.normalMap;
    material.normalScale.setScalar(material.name.startsWith("Joint") ? .22 : .1);
  }
}

export function grassGeometry() {
  const vertices = [];
  for (let i = 0; i < 5; i++) {
    const angle = i * 2.399, height = .35 + i * .055;
    const c = Math.cos(angle), s = Math.sin(angle);
    const transform = (x, y, z) => [x * c - z * s, y, x * s + z * c];
    const a = transform(-.045, 0, 0), b = transform(.045, 0, 0);
    const m = transform(.09, height * .6, 0), n = transform(.04, height * .6, 0);
    const tip = transform(.19, height, 0);
    vertices.push(...a, ...b, ...m, ...a, ...m, ...n, ...n, ...m, ...tip);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function groundCoverTexture() {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x / (size - 1) - .5) * 2, v = (y / (size - 1) - .5) * 2;
    const radius = Math.hypot(u, v), angle = Math.atan2(v, u);
    const edge = .83 + .09 * Math.sin(angle * 5) + .04 * Math.sin(angle * 9);
    const alpha = Math.max(0, Math.min(.48, (edge - radius) * 2));
    data.set([255, 255, 255, Math.round(alpha * 255)], (y * size + x) * 4);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
