import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_NAMES = ["kai", "bolt", "rust_scout", "lighthouse", "energy_cell", "turret", "rocket", "crab", "beacon", "palm"];

export class World {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x6fc8ef);
    this.scene.fog = new THREE.FogExp2(0x9bd9ee, 0.016);
    this.camera = new THREE.PerspectiveCamera(47, 1, 0.1, 160);
    this.camera.position.set(13, 16, 20);
    this.camera.lookAt(0, 0, 0);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.models = new Map();
    this.shared = new THREE.Group();
    this.mission = new THREE.Group();
    this.scene.add(this.shared, this.mission);
    this.cameraTarget = new THREE.Vector3();
    this.clock = 0;
    this.resize = this.resize.bind(this);
    window.addEventListener("resize", this.resize);
    this.setQuality(settings.quality || "auto");
  }

  async initialize(onProgress = () => {}) {
    this.buildEnvironment();
    this.setQuality(this.settings.quality || "auto");
    const loader = new GLTFLoader();
    let loaded = 0;
    await Promise.all(MODEL_NAMES.map(async name => {
      try {
        const gltf = await loader.loadAsync(`./models/${name}.glb`);
        this.models.set(name, gltf.scene);
      } catch {
        this.models.set(name, this.fallback(name));
      }
      loaded += 1;
      onProgress(loaded / MODEL_NAMES.length, name);
    }));
    this.addLandmarks();
  }

  buildEnvironment() {
    const hemi = new THREE.HemisphereLight(0xdaf5ff, 0x725236, 2.35);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d0, 4.2);
    this.sun.position.set(-12, 25, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -28;
    this.sun.shadow.camera.right = 28;
    this.sun.shadow.camera.top = 28;
    this.sun.shadow.camera.bottom = -28;
    this.scene.add(this.sun);

    const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x168bc0, roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.83 });
    this.water = new THREE.Mesh(new THREE.CircleGeometry(70, 64), waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -0.55;
    this.water.receiveShadow = true;
    this.shared.add(this.water);

    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(20, 23, 1.15, 64),
      new THREE.MeshStandardMaterial({ color: 0xf0c878, roughness: 0.94 }),
    );
    island.position.y = -0.15;
    island.receiveShadow = true;
    this.shared.add(island);

    const inner = new THREE.Mesh(new THREE.CircleGeometry(18.5, 64), new THREE.MeshStandardMaterial({ color: 0xf6db91, roughness: 0.98 }));
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.44;
    inner.receiveShadow = true;
    this.shared.add(inner);

    const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(11, 0.28, 3.2), new THREE.MeshStandardMaterial({ color: 0x9e6236, roughness: 0.9 }));
    boardwalk.position.set(2, 0.65, -8.5);
    boardwalk.receiveShadow = true;
    this.shared.add(boardwalk);

    const cliff = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7.5, 2.2, 20, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x76604d, roughness: 1 }));
    cliff.position.set(15, 0.65, -8);
    cliff.rotation.y = -Math.PI / 2;
    cliff.receiveShadow = true;
    this.shared.add(cliff);

    for (let i = 0; i < 34; i += 1) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + (i % 4) * 0.07, 0), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xc3915e : 0xa87854, roughness: 1 }));
      const angle = i * 2.399;
      const radius = 17 + (i % 3) * 1.3;
      rock.position.set(Math.cos(angle) * radius, 0.52, Math.sin(angle) * radius);
      rock.scale.y = 0.55;
      this.shared.add(rock);
    }

    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false });
    for (let i = 0; i < 7; i += 1) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 4; j += 1) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1.2 + j * 0.16, 10, 8), cloudMat);
        puff.position.set(j * 1.45, Math.sin(j) * 0.35, 0);
        cloud.add(puff);
      }
      cloud.position.set(-30 + i * 10, 15 + (i % 3) * 2, -25 - (i % 2) * 8);
      this.shared.add(cloud);
    }
  }

  addLandmarks() {
    const light = this.createActor("lighthouse", { x: 15, z: -9 }, 0.82, this.shared);
    light.rotation.y = 0.35;
    const rocket = this.createActor("rocket", { x: -14, z: -9 }, 0.72, this.shared);
    rocket.rotation.y = -0.25;
    [[-16, -3], [-15, 5], [16, 5], [11, 13], [-8, 15]].forEach(([x, z], i) => {
      const palm = this.createActor("palm", { x, z }, 0.8 + (i % 2) * 0.14, this.shared);
      palm.rotation.y = i;
    });
    this.bolt = this.createActor("bolt", { x: -3, z: -4 }, 0.95, this.shared);

    const beamMat = new THREE.MeshBasicMaterial({ color: 0x8ef5ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    this.beamPivot = new THREE.Group();
    this.beamPivot.position.set(15, 6.0, -9);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.8, 20, 18, 1, true), beamMat);
    beam.rotation.x = -Math.PI / 2;
    beam.position.z = -10;
    this.beamPivot.add(beam);
    this.shared.add(this.beamPivot);
  }

  fallback(name) {
    const group = new THREE.Group();
    const color = name.includes("rust") ? 0xc54831 : name === "energy_cell" ? 0x25dff5 : 0xe6edf0;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.1, 5, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.45 }));
    body.position.y = 1;
    group.add(body);
    return group;
  }

  createActor(name, position, scale = 1, parent = this.mission) {
    const source = this.models.get(name) || this.fallback(name);
    const object = source.clone(true);
    object.position.set(position.x, position.y || 0.55, position.z);
    object.scale.setScalar(scale);
    object.traverse(child => {
      if (child.isMesh) {
        child.castShadow = this.settings.quality !== "low";
        child.receiveShadow = true;
      }
    });
    parent.add(object);
    return object;
  }

  createMarker(position, color = 0xffd166, radius = 1.2) {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.15, 10, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.98 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.62;
    group.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, radius * 0.48, 5.2, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.21, depthWrite: false }));
    beam.position.y = 2.9;
    group.add(beam);
    group.position.set(position.x, position.y || 0, position.z);
    group.userData.ring = ring;
    this.mission.add(group);
    return group;
  }

  createRoute(points, color = 0x65e5ff) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(point => new THREE.Vector3(point.x, 0.72, point.z)));
    const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color, dashSize: 0.45, gapSize: 0.28, transparent: true, opacity: 0.68 }));
    line.computeLineDistances();
    this.mission.add(line);
    return line;
  }

  pulse(position, radius, color = 0x65e5ff) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.9, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(position.x, 0.72, position.z);
    mesh.userData.effect = { age: 0, duration: 0.55, radius };
    this.mission.add(mesh);
    return mesh;
  }

  clearMission() {
    this.mission.clear();
  }

  setQuality(value) {
    this.settings.quality = value;
    const low = value === "low" || (value === "auto" && innerWidth < 760);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.5));
    this.renderer.shadowMap.enabled = !low;
    if (this.sun) this.sun.castShadow = !low;
    this.resize();
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth || innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  update(dt, focus, reducedMotion = false) {
    this.clock += dt;
    this.water.position.y = -0.55 + Math.sin(this.clock * 0.7) * 0.06;
    this.water.material.color.setHSL(0.55 + Math.sin(this.clock * 0.15) * 0.012, 0.73, 0.42);
    if (this.beamPivot) this.beamPivot.rotation.y += dt * 0.22;
    this.mission.traverse(object => {
      if (object.userData.ring) {
        object.userData.ring.rotation.z += dt * 0.8;
        object.userData.ring.material.opacity = 0.65 + Math.sin(this.clock * 4) * 0.22;
      }
      if (object.userData.effect) {
        const effect = object.userData.effect;
        effect.age += dt;
        const amount = Math.min(1, effect.age / effect.duration);
        object.scale.setScalar(1 + amount * effect.radius);
        object.material.opacity = 1 - amount;
        if (amount >= 1) object.parent?.remove(object);
      }
    });
    if (focus) {
      const desired = new THREE.Vector3(focus.x + 9.5, 10.8, focus.z + 13.5);
      const target = new THREE.Vector3(focus.x, 0.8, focus.z - 1.5);
      const damping = reducedMotion ? 1 : 1 - Math.exp(-dt * 4.5);
      this.camera.position.lerp(desired, damping);
      this.cameraTarget.lerp(target, damping);
      this.camera.lookAt(this.cameraTarget);
    } else {
      const orbit = reducedMotion ? 0.72 : 0.72 + Math.sin(this.clock * 0.07) * 0.09;
      const desired = new THREE.Vector3(Math.cos(orbit) * 22, 12.5, Math.sin(orbit) * 22);
      this.camera.position.lerp(desired, 1 - Math.exp(-dt * 1.8));
      this.cameraTarget.lerp(new THREE.Vector3(0, 1, -1), 1 - Math.exp(-dt * 1.8));
      this.camera.lookAt(this.cameraTarget);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
