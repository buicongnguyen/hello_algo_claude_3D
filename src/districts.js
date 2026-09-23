import * as THREE from "three";
import { ENVIRONMENTS } from "./journey-data.js";
import { createEarth } from "./planet.js";

export function buildDistrict(world, item) {
  const environment = ENVIRONMENTS[item.stage.scene];
  if (!environment) return;
  world.journeyEnvironment = environment;
  world.shared.visible = false;
  world.applyAtmosphere(environment.key);
  // Blender exports a collision footprint for every solid prop that reaches into the play space.
  world.obstacles = (world.colliders.get("journey_" + environment.key) || []).map(([x, z, radius]) => ({ x, z, radius }));
  world.mapLandmarks = world.obstacles.filter(obstacle => obstacle.radius >= .6);
  const root = new THREE.Group(); root.name = "JourneyScene_" + environment.key;
  world.journeyRoot = root; world.scene.add(root);
  const scenery = world.createActor("journey_" + environment.key, { x:0, y:0, z:0 }, 1, root, {nativeScale:true});
  scenery.traverse(child => {
    if (!child.isMesh) return;
    const name = child.material?.name || "";
    // Emitters, water and clouds neither cast nor catch hard shadows; soft volumes would show facets.
    if (/^Journey (Glow|Water|Cloud)/.test(name)) child.castShadow = child.receiveShadow = false;
  });
  if (["underwater","space","moon"].includes(environment.kind)) {
    const count = environment.kind === "underwater" ? 100 : 200, positions = [];
    for (let i=0;i<count;i++) {
      const n = Math.sin(i*127.1+33)*43758.5453, r = n-Math.floor(n);
      positions.push(Math.sin(i*2.399)*(environment.kind==="underwater"?27:85), environment.kind==="underwater"?1+r*12:-50+r*100, Math.cos(i*2.399)*(environment.kind==="underwater"?27:85));
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    const particles = new THREE.Points(geometry,new THREE.PointsMaterial({color:0xcff7ff,size:environment.kind==="underwater"?.07:.12,transparent:true,opacity:.75,depthWrite:false,fog:false}));
    root.add(particles); world.journeyParticles = particles;
  }
  if (["space","moon"].includes(environment.kind) && environment.key !== "crater") {
    // In orbit the planet fills the lower horizon; from the Moon it hangs in the black sky.
    const orbit = environment.kind === "space";
    const earth = createEarth(world, orbit ? 100 : 9);
    if (orbit) earth.position.set(-10, -104, -96);
    else earth.position.set(-24, 12, -78);
    earth.rotation.set(.35, 2.2, .1);
    root.add(earth); world.journeyPlanet = earth;
  }
  if (environment.kind === "underwater") root.add(world.journeyRays = lightShafts(environment.key === "abyss" ? 0x3f6fd8 : 0xbff6ff, environment.key === "abyss" ? .05 : .11));
  world.journeyCompanion = world.createActor("bolt",{x:-3,z:7},.95,world.mission);
  fitTravelRig(world, world.journeyCompanion, environment.travel, true);
}

export function fitTravelRig(world, actor, mode, dog = false) {
  if (!mode || mode === "walk" || mode === "moon") return;
  if (mode === "dive") {
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(dog ? .7 : .64,18,12),new THREE.MeshStandardMaterial({color:0x9ceeff,transparent:true,opacity:.15,roughness:.1,depthWrite:false}));
    bubble.position.set(0,dog ? 1.4 : 2.05,dog ? .42 : 0); actor.add(bubble);
  } else if(mode === "float") {
    const board = new THREE.Mesh(new THREE.CapsuleGeometry(.65,1.8,4,10),new THREE.MeshStandardMaterial({color:0x246579,metalness:.5,roughness:.4}));
    board.rotation.x=Math.PI/2; board.scale.z=.2; board.position.set(0,.04,0); actor.add(board);
  } else {
    // Temporary flight equipment is visual and never changes permanent inventory.
    const jets=world.createActor("twin_thrusters",{x:0,y:0,z:0},1,actor,{nativeScale:true});
    jets.position.set(0,dog?-.2:0,dog?-.2:0);
  }
}

// Additive light shafts give underwater scenes depth; they never write depth or cast shadows.
export function lightShafts(color, opacity) {
  const group = new THREE.Group();
  group.name = "Light shafts";
  const geometry = new THREE.CylinderGeometry(1.2, 3.4, 26, 12, 4, true);
  const colors = [];
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) + 13) / 26;
    colors.push(1, 1, 1, Math.sin(Math.min(1, t * 1.25) * Math.PI) * .9);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  const material = new THREE.MeshBasicMaterial({ color, vertexColors: true, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  for (let i = 0; i < 9; i++) {
    const shaft = new THREE.Mesh(geometry, material);
    const angle = i * 2.399, radius = 4 + (i % 4) * 5.5;
    shaft.position.set(Math.cos(angle) * radius, 12, Math.sin(angle) * radius - 6);
    shaft.rotation.set(.18 + (i % 3) * .05, 0, .22 - (i % 2) * .1);
    shaft.scale.setScalar(.8 + (i % 3) * .25);
    shaft.userData.phase = i * 1.3;
    shaft.castShadow = shaft.receiveShadow = false;
    group.add(shaft);
  }
  return group;
}
