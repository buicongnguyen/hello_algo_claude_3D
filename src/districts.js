import * as THREE from "three";
import { DISTRICTS } from "./story.js";

export function buildDistrict(world, item) {
  const district = DISTRICTS[item.chapter.id];
  if (!district) return;
  world.scene.background.setHex(district.sky); world.scene.fog.color.setHex(district.fog);
  world.ground.material.color.setHex(district.ground); world.island.material.color.setHex(district.ground);
  world.sun.color.setHex(district.sun);
  world.sun.intensity = item.chapter.id === "siege" ? 1.65 : 2.2;
  world.scene.environmentIntensity = item.chapter.id === "siege" ? .18 : .3;
  const marina = item.chapter.id === "signal", watch = item.chapter.id === "siege";
  world.landmarks.visible = true;
  for (const child of world.landmarks.children) child.visible = marina || watch || child === world.bolt;
  world.boardwalk.visible = world.planks.visible = marina || item.chapter.id === "defense";
  world.obstacles = marina || watch ? [...world.defaultObstacles] : [];
  world.mapLandmarks = [...world.obstacles];
  const root = new THREE.Group(); root.name = `District_${item.chapter.id}`; world.mission.add(root);
  for (let i = 0; i < 6; i++) {
    // Keep taller scenery behind the play space, not between the follow camera and KAI.
    const angle = (-170 + i * 35) * Math.PI / 180;
    const position = { x: Math.cos(angle) * 17.7, z: Math.sin(angle) * 17.7 };
    const prop = world.createActor(district.props[i % district.props.length], position, i % 2 ? .8 : 1.1, root);
    prop.rotation.y = -angle;
    world.obstacles.push({ ...position, radius: .55 }); world.mapLandmarks.push(position);
  }
  // Flat inset walkways preserve the game's single ground plane and collision rules.
  // They identify authored routes without introducing decorative walls into the combat lanes.
  const paths = item.stage.type === "relay" ? [[item.stage.source, ...item.stage.positions, item.stage.receiver]]
    : item.stage.gatePositions ? [[{ x: 0, z: 13 }, ...item.stage.gatePositions]]
    : item.chapter.id === "defense" ? [[{ x: -7, z: 13 }, { x: -7, z: -5 }, { x: 0, z: -11 }], [{ x: 7, z: 13 }, { x: 7, z: -5 }, { x: 0, z: -11 }]]
    : item.chapter.id === "tide" ? [[{ x: -12, z: 10 }, { x: -15, z: 0 }, { x: -12, z: -7 }], [{ x: 12, z: 10 }, { x: 15, z: 0 }, { x: 12, z: -7 }]]
    : [[{ x: -12, z: 8 }, { x: 0, z: 5 }, { x: 12, z: -6 }]];
  const material = new THREE.MeshStandardMaterial({ color: district.paving, roughness: .9, ...world.surfaces.wood, normalScale: new THREE.Vector2(.12, .12) });
  const segments = paths.flatMap(path => path.slice(1).map((b, i) => ({ a: path[i], b })));
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .018, 1), material, segments.length);
  const transform = new THREE.Object3D();
  segments.forEach(({ a, b }, i) => {
    transform.position.set((a.x + b.x) / 2, .46, (a.z + b.z) / 2);
    transform.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    transform.scale.set(item.chapter.id === "tide" ? 1.1 : 1.5, 1, Math.hypot(b.x - a.x, b.z - a.z));
    transform.updateMatrix(); tiles.setMatrixAt(i, transform.matrix);
  });
  tiles.receiveShadow = true; root.add(tiles);
  // A visible repair platform gives the finale a spatial center without blocking the approach.
  if (watch) {
    const court = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, .035, 48), new THREE.MeshStandardMaterial({ color: district.paving, roughness: .7, metalness: .25 }));
    court.position.set(0, .46, -6); court.receiveShadow = true; root.add(court);
  }
}
