import * as THREE from "three";

// Procedural Earth: sphere-sampled noise avoids texture seams; textures are generated once per page.
function hash(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const lerp = (a, b, t) => a + (b - a) * t;
  const corner = (dx, dy, dz) => hash(ix + dx, iy + dy, iz + dz);
  return lerp(
    lerp(lerp(corner(0, 0, 0), corner(1, 0, 0), u), lerp(corner(0, 1, 0), corner(1, 1, 0), u), v),
    lerp(lerp(corner(0, 0, 1), corner(1, 0, 1), u), lerp(corner(0, 1, 1), corner(1, 1, 1), u), v), w);
}

export function fbm(x, y, z, octaves = 5) {
  let total = 0, amplitude = .5, frequency = 1;
  for (let i = 0; i < octaves; i++) {
    total += amplitude * noise(x * frequency, y * frequency, z * frequency);
    amplitude *= .5; frequency *= 2.07;
  }
  return total;
}

function sphereTexture(width, height, shade) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const lat = (y / (height - 1) - .5) * Math.PI;
    for (let x = 0; x < width; x++) {
      const lon = x / width * Math.PI * 2;
      const nx = Math.cos(lat) * Math.cos(lon), ny = Math.sin(lat), nz = Math.cos(lat) * Math.sin(lon);
      data.set(shade(nx, ny, nz, lat), (y * width + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

let cache = null;
export function earthTextures() {
  if (cache) return cache;
  const surface = sphereTexture(512, 256, (x, y, z, lat) => {
    const land = fbm(x * 1.7 + 11, y * 1.7, z * 1.7) + .08 * fbm(x * 6, y * 6, z * 6);
    const ice = Math.abs(lat) > 1.2 + .1 * Math.sin(x * 9);
    if (ice) return [236, 244, 250, 255];
    if (land < .53) {
      const depth = Math.max(0, Math.min(1, (.53 - land) * 5));
      return [Math.round(24 + 20 * (1 - depth)), Math.round(92 + 40 * (1 - depth)), Math.round(170 + 30 * (1 - depth)), 255];
    }
    const dry = Math.max(0, Math.min(1, (1 - Math.abs(lat) * 1.6) * 1.3 - .35 + fbm(x * 4, y * 4, z * 4 + 5) * .4));
    const high = Math.max(0, Math.min(1, (land - .6) * 6));
    const r = 70 + 110 * dry + 40 * high, g = 130 + 20 * dry - 10 * high, b = 64 + 20 * dry + 40 * high;
    return [Math.round(r), Math.round(g), Math.round(b), 255];
  });
  const clouds = sphereTexture(256, 128, (x, y, z) => {
    const n = fbm(x * 3 + 40, y * 5, z * 3, 5);
    const alpha = Math.max(0, Math.min(1, (n - .5) * 3.2));
    return [255, 255, 255, Math.round(alpha * 235)];
  });
  cache = { surface, clouds };
  return cache;
}

const atmosphereVertex = /* glsl */`
  varying vec3 vNormal; varying vec3 vView;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;
const atmosphereFragment = /* glsl */`
  uniform vec3 glow; varying vec3 vNormal; varying vec3 vView;
  void main() {
    float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.0);
    gl_FragColor = vec4(glow * rim * 1.6, rim);
  }`;

export function createEarth(world, radius) {
  const textures = earthTextures();
  for (const texture of Object.values(textures)) world.assetResources.add(texture);
  const earth = new THREE.Group();
  earth.name = "Earth";
  const surface = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), new THREE.MeshStandardMaterial({ map: textures.surface, roughness: .75, metalness: 0, emissive: 0x0a2a50, emissiveIntensity: .25 }));
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.012, 64, 32), new THREE.MeshStandardMaterial({ map: textures.clouds, transparent: true, depthWrite: false, roughness: 1 }));
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.06, 64, 32), new THREE.ShaderMaterial({
    uniforms: { glow: { value: new THREE.Color(0x6fb8ff) } }, vertexShader: atmosphereVertex, fragmentShader: atmosphereFragment,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
  }));
  earth.add(surface, clouds, atmosphere);
  earth.userData.clouds = clouds;
  return earth;
}
