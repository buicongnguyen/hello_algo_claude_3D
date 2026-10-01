// Bake per moving part (after the smooth-dense-scenes skill). Robots and props are exported with
// one mesh per material, and each mesh is a draw call per pass (view, shadow, silhouette).
// Here every pivot's direct mesh children are merged into ONE mesh whose material properties
// live in the vertices: colour, roughness, metalness, normal-map strength, clearcoat and glow.
// A patched standard/physical material reads them, so the look and the lighting stay the same.
// Merging never crosses a node, so limbs, tails, rotors and lids keep animating. Parts the game
// addresses by name, the paint system's recolourable materials and see-through or textured
// parts stay as they are. Flashes and tints still work: they change the merged mesh's (cloned)
// material colour and emissive, which multiply or add on top of the per-vertex values.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Nodes the code finds by name (paint inspection, attachments, rotors, exhaust flames, joints).
const KEEP_NODE = /^(Torso$|Prism_Armor|Rotor|Exhaust_|Tentacle_|ClamLid|KAI_Robot)/;
// The paint system recolours these per robot, so they stay their own materials.
const KEEP_MATERIAL = /^(Ceramic White|Aurora Cyan)/;

export function bakeable(mesh, { paintable = true } = {}) {
  const m = mesh.material;
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh || Array.isArray(m) || mesh.children.length || KEEP_NODE.test(mesh.name)) return false;
  if (!m?.isMeshStandardMaterial || m.transparent || m.map || m.vertexColors || m.alphaTest > 0 || m.alphaMap || m.emissiveMap || m.roughnessMap || m.metalnessMap) return false;
  if (m.sheen || m.transmission || m.iridescence || m.anisotropy) return false;
  return !paintable || !KEEP_MATERIAL.test(m.name || "");
}

// Parts merge when they share side and shading. Normal maps are shared textures (surfaces.js):
// parts without one join the family of the (single) map in use, at strength 0.
function families(meshes) {
  const out = new Map();
  for (const mesh of meshes) {
    const key = `${mesh.material.side}|${mesh.material.flatShading}`;
    (out.get(key) ?? out.set(key, []).get(key)).push(mesh);
  }
  const result = [];
  for (const list of out.values()) {
    const maps = [...new Set(list.map(m => m.material.normalMap).filter(Boolean))];
    if (maps.length <= 1) { result.push(list); continue; }
    for (const map of maps) result.push(list.filter(m => m.material.normalMap === map || (!m.material.normalMap && map === maps[0])));
  }
  return result;
}

function piece(mesh, normalMap) {
  const source = mesh.geometry, m = mesh.material, geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", source.attributes.position.clone());
  if (source.attributes.normal) geometry.setAttribute("normal", source.attributes.normal.clone());
  const count = source.attributes.position.count;
  geometry.setAttribute("uv", source.attributes.uv ? source.attributes.uv.clone() : new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  if (source.index) geometry.setIndex(source.index.clone());
  geometry.applyMatrix4(mesh.matrix);
  const color = new Float32Array(count * 3), pbr = new Float32Array(count * 4), glow = new Float32Array(count * 3);
  const strength = m.normalMap === normalMap && normalMap ? (m.normalScale?.x ?? 1) : 0;
  const e = m.emissive ?? new THREE.Color(0), k = m.emissiveIntensity ?? 0;
  for (let i = 0; i < count; i++) {
    color[i * 3] = m.color.r; color[i * 3 + 1] = m.color.g; color[i * 3 + 2] = m.color.b; // linear, like material.color
    pbr[i * 4] = m.roughness; pbr[i * 4 + 1] = m.metalness; pbr[i * 4 + 2] = strength; pbr[i * 4 + 3] = m.clearcoat ?? 0;
    glow[i * 3] = e.r * k; glow[i * 3 + 1] = e.g * k; glow[i * 3 + 2] = e.b * k;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(color, 3));
  geometry.setAttribute("aPbr", new THREE.BufferAttribute(pbr, 4));
  geometry.setAttribute("aGlow", new THREE.BufferAttribute(glow, 3));
  return geometry;
}

// The merged material: per-vertex roughness, metalness, normal strength, clearcoat and glow.
function bakedMaterial(list) {
  const physical = list.find(m => m.material.isMeshPhysicalMaterial && m.material.clearcoat > 0)?.material;
  const base = physical ?? list.find(m => m.material.normalMap)?.material ?? list[0].material, material = base.clone();
  material.name = `Baked ${[...new Set(list.map(m => m.material.name))].slice(0, 4).join(" + ")}`;
  material.color.set(0xffffff);
  material.vertexColors = true;
  material.roughness = 1; material.metalness = 1;
  material.emissive = new THREE.Color(0); material.emissiveIntensity = 1;
  if (physical) { material.clearcoat = 1; material.clearcoatRoughness = physical.clearcoatRoughness; }
  material.normalScale = new THREE.Vector2(1, 1);
  const normalChunk = THREE.ShaderChunk.normal_fragment_maps.replace("mapN.xy *= normalScale;", "mapN.xy *= normalScale * vPbr.z;");
  const physicalChunk = THREE.ShaderChunk.lights_physical_fragment.replace("material.clearcoat = clearcoat;", "material.clearcoat = clearcoat * vPbr.w;");
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 aPbr; attribute vec3 aGlow; varying vec4 vPbr; varying vec3 vGlow;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPbr = aPbr; vGlow = aGlow;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec4 vPbr; varying vec3 vGlow;")
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor *= vPbr.x;")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor *= vPbr.y;")
      .replace("#include <normal_fragment_maps>", normalChunk)
      .replace("#include <lights_physical_fragment>", physicalChunk)
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow;");
  };
  material.customProgramCacheKey = () => `baked-part:${physical ? "physical" : "standard"}`;
  material.userData.baked = true;
  return material;
}

// Returns {before, after} mesh counts. `register` receives every new geometry and material.
// paintable: the model is recoloured by the paint system (KAI and its gear), so its
// Ceramic White / Aurora Cyan parts must stay separate materials.
export function bakeModel(root, { paintable = true, register = () => {} } = {}) {
  let before = 0, after = 0;
  root.traverse(o => { if (o.isMesh) before++; });
  const nodes = [];
  root.traverse(node => nodes.push(node));
  for (const node of nodes) {
    let index = 0;
    for (const list of families(node.children.filter(child => bakeable(child, { paintable })))) {
      if (list.length < 2) continue;
      const normalMap = list.find(m => m.material.normalMap)?.material.normalMap ?? null;
      const pieces = list.map(mesh => piece(mesh, normalMap));
      // mergeGeometries needs all-indexed or all-non-indexed parts.
      const merged = mergeGeometries(pieces.every(g => g.index) ? pieces : pieces.map(g => g.index ? g.toNonIndexed() : g));
      pieces.forEach(g => g.dispose());
      if (!merged) continue;
      const material = bakedMaterial(list);
      const mesh = new THREE.Mesh(merged, material);
      // Prefixed, so name lookups for pivots (Hip_, ShoulderPivot_, TailPivot, Rotor, Exhaust_,
      // Tentacle_) never pick up the merged mesh inside a pivot and animate it twice.
      mesh.name = `baked_${node.name || "part"}_${index++}`;
      mesh.castShadow = list.some(m => m.castShadow); mesh.receiveShadow = true;
      for (const part of list) part.removeFromParent();
      node.add(mesh);
      register(merged, material);
    }
  }
  root.traverse(o => { if (o.isMesh) after++; });
  return { before, after };
}
