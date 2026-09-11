import * as THREE from "three";
import { ENVIRONMENTS } from "./journey-data.js";

export function buildDistrict(world, item) {
  const environment = ENVIRONMENTS[item.stage.scene];
  if (!environment) return;
  world.journeyEnvironment = environment;
  world.shared.visible = false;
  world.scene.background.setHex(environment.sky);
  world.scene.fog.color.setHex(environment.fog); world.scene.fog.density = environment.density;
  world.sun.color.setHex(environment.kind === "underwater" ? 0x8dc8ff : environment.kind === "moon" ? 0xe7edff : 0xffe4c9);
  world.sun.intensity = ["underwater", "space"].includes(environment.kind) ? 1.6 : 2.2;
  world.scene.environmentIntensity = environment.kind === "underwater" ? .15 : .25;
  world.obstacles = []; world.mapLandmarks = [];
  const root = new THREE.Group(); root.name = "JourneyScene_" + environment.key;
  world.journeyRoot = root; world.scene.add(root);
  world.createActor("journey_" + environment.key, { x:0, y:0, z:0 }, 1, root, {nativeScale:true});
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
    const earth = new THREE.Group();
    if(environment.kind==="space") earth.position.set(-2,-9,-22);
    else earth.position.set(-20,5,-65);
    earth.add(new THREE.Mesh(new THREE.SphereGeometry(8,36,24),new THREE.MeshStandardMaterial({color:0x297bc5,roughness:1,emissive:0x073354,emissiveIntensity:.15})));
    const continents = [
      [[-165,62],[-130,70],[-65,50],[-82,10],[-110,25],[-125,48]],
      [[-80,10],[-48,-3],[-35,-20],[-70,-55],[-77,-15]],
      [[-18,34],[10,38],[48,12],[36,-28],[18,-35],[0,-5]],
      [[-10,38],[0,62],[45,70],[100,65],[145,45],[118,12],[80,5],[40,34]],
      [[112,-12],[149,-10],[154,-37],[116,-35]],
    ];
    const vertex = ([lon,lat]) => new THREE.Vector3(Math.cos(lat*Math.PI/180)*Math.sin(lon*Math.PI/180),Math.sin(lat*Math.PI/180),Math.cos(lat*Math.PI/180)*Math.cos(lon*Math.PI/180)).multiplyScalar(8.025);
    const green = new THREE.MeshStandardMaterial({color:0x5bad73,roughness:1,side:THREE.DoubleSide});
    // Subdivide along the sphere: large flat triangles would sink beneath the ocean mesh.
    const curvedTriangle=(vertices,a,b,c,depth=3)=>{
      if(!depth) {vertices.push(...a.toArray(),...b.toArray(),...c.toArray());return;}
      const ab=a.clone().add(b).normalize().multiplyScalar(8.025),bc=b.clone().add(c).normalize().multiplyScalar(8.025),ca=c.clone().add(a).normalize().multiplyScalar(8.025);
      curvedTriangle(vertices,a,ab,ca,depth-1);curvedTriangle(vertices,ab,b,bc,depth-1);
      curvedTriangle(vertices,ca,bc,c,depth-1);curvedTriangle(vertices,ab,bc,ca,depth-1);
    };
    for (const shape of continents) {
      const center = shape.reduce((a,p)=>[a[0]+p[0]/shape.length,a[1]+p[1]/shape.length],[0,0]);
      const vertices=[];
      for(let i=0;i<shape.length;i++) curvedTriangle(vertices,vertex(center),vertex(shape[i]),vertex(shape[(i+1)%shape.length]));
      const geometry=new THREE.BufferGeometry(); geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
      earth.add(new THREE.Mesh(geometry,green));
    }
    earth.rotation.y=.5; root.add(earth); world.journeyPlanet=earth;
  }
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
