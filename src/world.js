import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { dressRobot } from "./equipment.js";
import { createSurfaces, finishMaterial, coastalEnvironment, grassGeometry, groundCoverTexture } from "./surfaces.js";
import { buildDistrict } from "./districts.js";
import { JOURNEY_MODEL_NAMES, ENVIRONMENTS } from "./journey-data.js";
import { actorScale, cameraZoom, CAMERA_YAW, departureHeight, limbPhase, VICTORY_DURATION } from "./presentation.js";

const MODEL_NAMES = ["kai", "bolt", "rust_scout", "zombie_dog", "rust_drone", "lighthouse", "energy_cell", "turret", "rocket", "crab", "beacon", "palm", "octopus", "starfish", "snail", "clam", "coral_cluster", "reef_arch", "salvage_tower", "moon_mushroom", "software_disc", "prism_armor", "twin_thrusters", "halo_antenna", "starship"];

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
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.models = new Map();
    this.expectedModelCount = MODEL_NAMES.length + JOURNEY_MODEL_NAMES.length;
    this.assetResources = new Set();
    this.effects = [];
    this.effectPool = [];
    this.markers = [];
    this.cameraYaw = CAMERA_YAW;
    this.desiredCamera = new THREE.Vector3();
    this.desiredTarget = new THREE.Vector3();
    this.shared = new THREE.Group();
    this.mission = new THREE.Group();
    this.celebrationRoot = new THREE.Group();
    this.scene.add(this.shared, this.mission, this.celebrationRoot);
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
    let versions = {};
    const manifestAbort = new AbortController();
    const manifestTimeout = setTimeout(() => manifestAbort.abort(), 4000);
    try {
      const manifests = await Promise.all(["manifest.json", "journey-manifest.json"].map(async file => {
        try {
          const response = await fetch(`./models/${file}`, { cache: "no-cache", signal: manifestAbort.signal });
          return response.ok ? (await response.json()).assets : [];
        } catch { return []; }
      }));
      versions = Object.fromEntries(manifests.flat().map(asset => [asset.name, asset.sha256]));
    } catch { /* Unversioned fallback still works if the optional manifest is unavailable. */ }
    finally { clearTimeout(manifestTimeout); }
    this.failedModels = [];
    let loaded = 0;
    await Promise.all([...MODEL_NAMES, ...JOURNEY_MODEL_NAMES].map(async name => {
      try {
        const gltf = await loader.loadAsync(`./models/${name}.glb${versions[name] ? `?v=${encodeURIComponent(versions[name])}` : ""}`);
        this.models.set(name, gltf.scene);
      } catch {
        this.failedModels.push(name);
        this.models.set(name, this.fallback(name));
      }
      loaded += 1;
      onProgress(loaded / this.expectedModelCount, name);
    }));
    for (const model of this.models.values()) model.traverse(child => {
      if (child.geometry) this.assetResources.add(child.geometry);
      for (const material of child.material ? (Array.isArray(child.material) ? child.material : [child.material]) : []) {
        finishMaterial(material, this.surfaces);
        if (material.name.startsWith("Journey Water")) { material.normalMap = this.surfaces.water.normalMap; material.normalScale = new THREE.Vector2(.5,.5); }
        if (/^Journey (.*sand|.*silt|Regolith|Abyss basalt|.*paving|Limestone|Meadow)/i.test(material.name)) {
          material.map=this.surfaces.sand.map;material.normalMap=this.surfaces.sand.normalMap;material.normalScale.setScalar(.3);
        }
        if (material.name.startsWith("Journey Wood")) { material.map=this.surfaces.wood.map;material.normalMap=this.surfaces.wood.normalMap;material.normalScale.setScalar(.2); }
        this.assetResources.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) this.assetResources.add(value);
      }
    });
    this.pulseGeometry = new THREE.RingGeometry(0.75, 1, 32);
    this.assetResources.add(this.pulseGeometry);
    this.addLandmarks();
  }

  buildEnvironment() {
    this.surfaces = createSurfaces(this.renderer);
    for (const surface of Object.values(this.surfaces)) for (const texture of Object.values(surface)) this.assetResources.add(texture);
    this.environmentTarget = coastalEnvironment(this.renderer);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = .3;
    const hemi = new THREE.HemisphereLight(0xc5ecff, 0xb38957, .45);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xffe4bb, 2.2);
    this.sun.position.set(-12, 25, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.bias = -0.00015;
    this.sun.shadow.camera.left = -28;
    this.sun.shadow.camera.right = 28;
    this.sun.shadow.camera.top = 28;
    this.sun.shadow.camera.bottom = -28;
    this.scene.add(this.sun);

    const waterMat = new THREE.MeshStandardMaterial({ color: 0x168bc0, roughness: 0.24, metalness: 0.15, normalMap: this.surfaces.water.normalMap, normalScale: new THREE.Vector2(.65, .65) });
    this.water = new THREE.Mesh(new THREE.CircleGeometry(70, 64), waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -0.55;
    this.water.receiveShadow = true;
    this.shared.add(this.water);

    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(20, 23, 1.15, 64),
      new THREE.MeshStandardMaterial({ color: 0xf0c878, roughness: 0.94, ...this.surfaces.sand, normalScale: new THREE.Vector2(.2, .2) }),
    );
    island.position.y = -0.15;
    island.receiveShadow = true;
    this.shared.add(island);
    this.island = island;

    const inner = new THREE.Mesh(new THREE.CircleGeometry(18.5, 64), new THREE.MeshStandardMaterial({ color: 0xf6db91, roughness: 0.98, ...this.surfaces.sand, normalScale: new THREE.Vector2(.35, .35) }));
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.44;
    inner.receiveShadow = true;
    this.shared.add(inner);
    this.ground = inner;

    const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(11, 0.28, 3.2), new THREE.MeshStandardMaterial({ color: 0x806044, roughness: 0.9, ...this.surfaces.wood, normalScale: new THREE.Vector2(.3, .3) }));
    boardwalk.position.set(2, 0.65, -8.5);
    boardwalk.receiveShadow = true;
    this.shared.add(boardwalk);
    this.boardwalk = boardwalk;

    const cliff = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7.5, 2.2, 20, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x76604d, roughness: 1 }));
    cliff.position.set(22, -0.4, -11);
    cliff.rotation.y = -Math.PI / 2;
    cliff.receiveShadow = true;
    this.shared.add(cliff);

    const rockGeometry = new THREE.IcosahedronGeometry(1, 1);
    const rockPositions = rockGeometry.attributes.position;
    for (let i = 0; i < rockPositions.count; i++) {
      const x = rockPositions.getX(i), y = rockPositions.getY(i), z = rockPositions.getZ(i);
      const stretch = .9 + .12 * Math.sin(x * 11 + y * 7 + z * 13);
      rockPositions.setXYZ(i, x * stretch, y * stretch, z * stretch);
    }
    rockGeometry.computeVertexNormals();
    const rocks = new THREE.InstancedMesh(rockGeometry, new THREE.MeshStandardMaterial({ roughness: 1, ...this.surfaces.sand, normalScale: new THREE.Vector2(.3, .3) }), 34);
    const rock = new THREE.Object3D();
    for (let i = 0; i < 34; i += 1) {
      const angle = i * 2.399;
      const radius = 17 + (i % 3) * 1.3;
      rock.position.set(Math.cos(angle) * radius, 0.52, Math.sin(angle) * radius);
      const size = 0.22 + (i % 4) * 0.07;
      rock.scale.set(size, size * 0.55, size);
      rock.updateMatrix();
      rocks.setMatrixAt(i, rock.matrix);
      rocks.setColorAt(i, new THREE.Color(i % 2 ? 0xc3915e : 0xa87854));
    }
    this.shared.add(rocks);

    const foam = new THREE.Mesh(new THREE.RingGeometry(20.2, 21.3, 96), new THREE.MeshBasicMaterial({ color: 0xd0faf6, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    foam.rotation.x = -Math.PI / 2;
    foam.position.y = -0.48;
    this.shared.add(foam);
    this.foam = foam;

    // Low ground patches give each landmark an identity without hiding targets.
    const coverTexture = groundCoverTexture(); this.assetResources.add(coverTexture);
    const coverMaterial = new THREE.MeshStandardMaterial({ color: 0x718047, roughness: 1, map: coverTexture, transparent: true, depthWrite: false });
    for (const [x, z, radius] of [[-15, -2, 2.3], [15, 4, 2.4], [10, 13, 2.3], [-9, 14, 2.6], [13, -9, 2.8]]) {
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), coverMaterial);
      patch.rotation.x = -Math.PI / 2; patch.position.set(x, 0.45, z); this.shared.add(patch);
    }
    const grasses = new THREE.InstancedMesh(grassGeometry(), new THREE.MeshStandardMaterial({ color: 0x6b8242, roughness: 1, side: THREE.DoubleSide }), 70);
    for (let i = 0; i < 70; i++) {
      const angle = i * 2.399;
      const radius = 16.3 + (i % 4) * 0.5;
      rock.position.set(Math.cos(angle) * radius, 0.45, Math.sin(angle) * radius);
      rock.scale.setScalar(0.6 + (i % 3) * 0.3); rock.updateMatrix(); grasses.setMatrixAt(i, rock.matrix);
    }
    this.shared.add(grasses);
    const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.49, 0.055, 3.1), new THREE.MeshStandardMaterial({ color: 0xa27c58, roughness: .86, ...this.surfaces.wood, normalScale: new THREE.Vector2(.3, .3) }), 20);
    for (let i = 0; i < 20; i++) {
      rock.position.set(-3.1 + i * 0.53, 0.81, -8.5); rock.scale.setScalar(1); rock.updateMatrix(); planks.setMatrixAt(i, rock.matrix);
    }
    this.shared.add(planks);
    this.planks = planks;

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
    this.landmarks = new THREE.Group(); this.shared.add(this.landmarks);
    const light = this.createActor("lighthouse", { x: 15, z: -9 }, 0.82, this.landmarks);
    light.rotation.y = 0.35;
    const rocket = this.createActor("rocket", { x: -14, z: -9 }, 0.72, this.landmarks);
    this.rocket = rocket;
    rocket.rotation.y = -0.25;
    [[-16, -3], [-15, 5], [16, 5], [11, 13], [-8, 15]].forEach(([x, z], i) => {
      const palm = this.createActor("palm", { x, z }, 0.8 + (i % 2) * 0.14, this.landmarks);
      palm.rotation.y = i;
    });
    this.bolt = this.createActor("bolt", { x: -3, z: -4 }, 0.95, this.landmarks);
    this.obstacles = [{ x: 15, z: -9, radius: 1.1 }, { x: -14, z: -9, radius: 0.77 }, ...[[-16, -3], [-15, 5], [16, 5], [11, 13], [-8, 15]].map(([x, z]) => ({ x, z, radius: 0.25 }))];
    this.defaultObstacles = [...this.obstacles];
    this.mapLandmarks = this.defaultObstacles;

    const beamMat = new THREE.MeshBasicMaterial({ color: 0x8ef5ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    this.beamPivot = new THREE.Group();
    this.beamPivot.position.set(15, 0.55 + 6.72 * light.scale.y, -9);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.8, 20, 18, 1, true), beamMat);
    beam.rotation.x = -Math.PI / 2;
    beam.position.z = -10;
    this.beamPivot.add(beam);
    this.landmarks.add(this.beamPivot);
  }

  setScenario(theme) {
    this.scene.fog.density = .016;
    this.theme = theme;
    const palettes = {
      coral: [0x74dfdf, 0x76d8d2, 0xe9b3a8, 0xffccdf],
      scrapyard: [0x7b71ba, 0x9a8acc, 0x9380aa, 0xcbbdff],
      moonpool: [0x19294d, 0x334d78, 0x557b94, 0x99bfff],
    };
    const palette = palettes[theme] || [0x6fc8ef, 0x9bd9ee, 0xf6db91, 0xffe4bb];
    this.scene.background.setHex(palette[0]); this.scene.fog.color.setHex(palette[1]);
    this.ground.material.color.setHex(palette[2]); this.island.material.color.setHex(palette[2]);
    this.sun.color.setHex(palette[3]); this.sun.intensity = theme === "moonpool" ? 1.6 : 2.2;
    this.scene.environmentIntensity = theme === "moonpool" ? .16 : .3;
    if (this.landmarks) this.landmarks.visible = !theme;
    if (this.landmarks) for (const child of this.landmarks.children) child.visible = true;
    this.boardwalk.visible = this.planks.visible = !theme;
    this.obstacles = theme ? [] : [...(this.defaultObstacles || [])];
    this.mapLandmarks = [...this.obstacles];
    if (!theme) return;
    const model = theme === "coral" ? "coral_cluster" : theme === "scrapyard" ? "salvage_tower" : "moon_mushroom";
    // All decoration lives on the rim; required paths and pickups stay open.
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 + 0.12;
      const p = { x: Math.cos(angle) * 17.2, z: Math.sin(angle) * 17.2 };
      const object = this.createActor(model, p, 0.95 + i % 2 * 0.2);
      object.rotation.y = -angle;
      this.obstacles.push({ ...p, radius: 0.52 }); this.mapLandmarks.push(p);
    }
    for (const [x, z, radius] of [[-10, -1, 2.5], [7, -10, 2.5], [9, 9, 1.7]]) {
      const pool = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), new THREE.MeshStandardMaterial({ color: theme === "scrapyard" ? 0x705bc6 : 0x399cae, emissive: theme === "moonpool" ? 0x164f76 : 0x000000, roughness: 0.3 }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(x, 0.46, z); this.mission.add(pool);
    }
  }

  showRobotPreview(equipment) {
    this.clearMission();
    this.previewActor = this.createActor("kai", { x: 0, z: 0 }, 1.2, this.mission, { nativeScale: true });
    dressRobot(this, this.previewActor, equipment);
    this.previewActor.rotation.y = this.previewAngle ?? 0.4;
  }

  setDistrict(item) { buildDistrict(this, item); }

  startCelebration(equipment) {
    this.clearCelebration();
    this.mission.visible = false;
    this.landmarks.visible = this.boardwalk.visible = this.planks.visible = false;
    const ship = this.createActor("starship", { x: 0, y: 0.65, z: -1.5 }, 1, this.celebrationRoot);
    const hero = this.createActor("kai", { x: -2.1, z: 1.5 }, 0.94, this.celebrationRoot);
    dressRobot(this, hero, equipment);
    const dog = this.createActor("bolt", { x: 1.7, z: 0.4 }, 0.95, this.celebrationRoot);
    hero.rotation.y = -0.25; dog.rotation.y = 0.3;
    const exhaust = [];
    ship.traverse(child => { if (child.name.startsWith("Exhaust_")) exhaust.push(child); });
    this.celebration = { ship, hero, dog, exhaust, age: 0 };
  }

  clearCelebration() {
    this.celebration = null;
    for (const child of [...this.celebrationRoot.children]) this.release(child);
    this.mission.visible = true;
  }

  animateSeaLife(object, time, open = true) {
    if (!object.userData.seaJoints) {
      object.userData.seaJoints = [];
      object.traverse(child => { if (/^(Tentacle_|ClamLid)/.test(child.name)) object.userData.seaJoints.push(child); });
    }
    for (const joint of object.userData.seaJoints) {
      if (joint.name.startsWith("Tentacle")) joint.rotation.y = Math.sin(time * 2 + Number.parseInt(joint.name.split("_")[1])) * 0.15;
      else joint.rotation.x = open ? -0.65 + Math.sin(time * 1.5) * 0.08 : -0.08;
    }
  }

  fallback(name) {
    const group = new THREE.Group();
    if (name.startsWith("journey_") && ENVIRONMENTS[name.slice(8)]) {
      const environment = ENVIRONMENTS[name.slice(8)];
      group.name = `Journey_${environment.key}_Fallback`;
      const floor = new THREE.Mesh(new THREE.BoxGeometry(65,.5,65), new THREE.MeshStandardMaterial({color:environment.ground}));
      floor.position.y = ["sky","space"].includes(environment.kind) ? -6 : .15;
      group.add(floor);
      return group;
    }
    const color = name.includes("rust") ? 0xc54831 : name === "energy_cell" ? 0x25dff5 : 0xe6edf0;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.1, 5, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.45 }));
    body.position.y = 1;
    group.add(body);
    return group;
  }

  createActor(name, position, scale = 1, parent = this.mission, { nativeScale = false } = {}) {
    const source = this.models.get(name) || this.fallback(name);
    const object = source.clone(true);
    object.position.set(position.x, position.y ?? 0.55, position.z);
    object.scale.setScalar(actorScale(name, scale, nativeScale));
    object.traverse(child => {
      if (child.isMesh) {
        child.castShadow = this.settings.quality !== "low";
        child.receiveShadow = true;
      }
    });
    parent.add(object);
    object.userData.limbs = [];
    object.userData.quadruped = ["bolt", "zombie_dog"].includes(name);
    object.userData.tails = [];
    object.traverse(child => {
      if (/^(Hip|ShoulderPivot)_/.test(child.name)) object.userData.limbs.push(child);
      if (child.name.startsWith("TailPivot")) object.userData.tails.push(child);
    });
    return object;
  }

  animateActor(object, time, moving) {
    for (const limb of object.userData.limbs || []) {
      const dog = object.userData.quadruped;
      limb.rotation.x = moving ? Math.sin(time * (dog ? 9 : 11)) * (dog ? 0.35 : 0.42) * limbPhase(limb.name, dog) : 0;
    }
    for (const tail of object.userData.tails || []) tail.rotation.z = Math.sin(time * (moving ? 7 : 3)) * 0.3;
  }

  constrainPlayer(player) {
    for (const obstacle of this.obstacles || []) {
      const dx = player.x - obstacle.x;
      const dz = player.z - obstacle.z;
      const d = Math.hypot(dx, dz);
      const radius = obstacle.radius + player.radius;
      if (d < radius) {
        player.x = obstacle.x + (d ? dx / d : 1) * radius;
        player.z = obstacle.z + (d ? dz / d : 0) * radius;
      }
    }
  }

  label(parent, text, color, height) {
    const canvas = document.createElement("canvas");
    const compact = text.length < 4;
    canvas.width = compact ? 128 : 512; canvas.height = 96;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(4, 27, 43, .92)";
    ctx.roundRect(0, 0, canvas.width, 96, 22); ctx.fill();
    ctx.font = `bold ${compact ? 56 : 30}px Segoe UI, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = `#${new THREE.Color(color).getHexString()}`;
    ctx.fillText(text, canvas.width / 2, 48, canvas.width - 24);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false }));
    sprite.position.y = height;
    sprite.scale.set(compact ? 1.05 : 4.4, compact ? 0.79 : 0.83, 1);
    sprite.renderOrder = 5;
    parent.add(sprite);
    return sprite;
  }

  createMarker(position, color = 0xffd166, radius = 1.2) {
    const group = new THREE.Group();
    // Keep the objective footprint, but remove the heavy ring and tall light wall.
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.065, 6, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.98 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.62;
    group.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, radius * 0.24, 2.3, 12, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false }));
    beam.position.y = 1.78;
    group.add(beam);
    group.position.set(position.x, position.y || 0, position.z);
    group.userData.ring = ring;
    this.mission.add(group);
    this.markers.push(group);
    return group;
  }

  createRoute(points, color = 0x65e5ff, { beam = false } = {}) {
    if (beam) {
      const group = new THREE.Group();
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        const strip = new THREE.Mesh(new THREE.BoxGeometry(.13, .035, Math.hypot(b.x - a.x, b.z - a.z)), new THREE.MeshBasicMaterial({ color }));
        strip.position.set((a.x + b.x) / 2, .78, (a.z + b.z) / 2);
        strip.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); group.add(strip);
      }
      this.mission.add(group); return group;
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(point => new THREE.Vector3(point.x, 0.72, point.z)));
    const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color, dashSize: 0.45, gapSize: 0.28, transparent: true, opacity: 0.68 }));
    line.computeLineDistances();
    this.mission.add(line);
    return line;
  }

  pulse(position, radius, color = 0x65e5ff) {
    if (this.effects.length >= 24) return null;
    const mesh = this.effectPool.pop() || new THREE.Mesh(this.pulseGeometry, new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    mesh.material.color.set(color);
    mesh.material.opacity = 0.95;
    mesh.scale.setScalar(0.1);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(position.x, 0.72, position.z);
    mesh.userData.effect = { age: 0, duration: 0.55, radius };
    this.mission.add(mesh);
    this.effects.push(mesh);
    return mesh;
  }

  clearMission() {
    this.clearCelebration();
    if (this.journeyRoot) this.release(this.journeyRoot);
    this.journeyRoot = this.journeyCompanion = this.journeyParticles = this.journeyPlanet = this.journeyEnvironment = null;
    this.shared.visible = true;
    this.previewActor = null;
    for (const mesh of this.effects) { mesh.removeFromParent(); this.effectPool.push(mesh); }
    this.effects.length = 0;
    for (const child of [...this.mission.children]) this.release(child);
    this.markers.length = 0;
    if (this.rocket) this.rocket.position.y = 0.55;
    if (this.ground) this.setScenario(null);
  }

  release(object) {
    object.removeFromParent();
    const disposable = new Set();
    object.traverse(child => {
      if (child.geometry && !this.assetResources.has(child.geometry)) disposable.add(child.geometry);
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) if (material && !this.assetResources.has(material)) {
        disposable.add(material);
        for (const value of Object.values(material)) {
          if (value?.isTexture && !this.assetResources.has(value)) disposable.add(value);
        }
      }
    });
    for (const resource of disposable) resource.dispose();
  }

  setCampaign(progress) {
    const fragments = Math.floor(progress.completed.length / 3);
    if (this.beamPivot) this.beamPivot.children[0].material.opacity = 0.06 + fragments * 0.04;
    this.friendAwake = progress.completed.includes("signal:wake");
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
    if (!reducedMotion) this.surfaces.water.normalMap.offset.set(this.clock * .007, this.clock * .003);
    if (this.foam) this.foam.scale.setScalar(1 + Math.sin(this.clock * 0.65) * 0.012);
    this.water.material.color.setHSL(0.55 + Math.sin(this.clock * 0.15) * 0.012, 0.73, 0.42);
    if (this.beamPivot) this.beamPivot.rotation.y += dt * 0.22;
    for (const marker of this.markers) if (marker.visible && !reducedMotion) {
      marker.userData.ring.rotation.z += dt * 0.8;
      marker.userData.ring.material.opacity = 0.83 + Math.sin(this.clock * 4) * 0.12;
    }
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
        const object = this.effects[index];
        const effect = object.userData.effect;
        effect.age += dt;
        const amount = Math.min(1, effect.age / effect.duration);
        object.scale.setScalar((0.1 + amount * 0.9) * effect.radius);
        object.material.opacity = 1 - amount;
        if (amount >= 1) { object.removeFromParent(); this.effects.splice(index, 1); this.effectPool.push(object); }
    }
    const bolt = this.journeyCompanion || this.bolt;
    if (bolt && focus && this.friendAwake) {
      const d = Math.hypot(focus.x - bolt.position.x, focus.z - bolt.position.z);
      if (d > 2.8) {
        bolt.rotation.y = Math.atan2(focus.x - bolt.position.x, focus.z - bolt.position.z);
        bolt.position.x += (focus.x - bolt.position.x) / d * Math.min(d - 2.8, dt * 4.2);
        bolt.position.z += (focus.z - bolt.position.z) / d * Math.min(d - 2.8, dt * 4.2);
        bolt.position.y = 0.55 + Math.abs(Math.sin(this.clock * 9)) * 0.06;
      }
      this.animateActor(bolt, this.clock, d > 2.8);
    } else if (bolt && !focus) bolt.position.lerp(new THREE.Vector3(-3, 0.55, -4), 1 - Math.exp(-dt * 2));
    if (this.journeyParticles && !reducedMotion) this.journeyParticles.position.y = Math.sin(this.clock*.3)*.25;
    if (this.journeyPlanet && !reducedMotion) this.journeyPlanet.rotation.y += dt*.015;
    if (this.celebration) {
      const c = this.celebration;
      c.age = Math.min(VICTORY_DURATION, c.age + dt);
      c.ship.position.y = departureHeight(c.age, reducedMotion);
      for (const flame of c.exhaust) {
        flame.visible = c.age > 0.65;
        flame.scale.z = reducedMotion ? 0.5 : 0.65 + Math.min(1, c.age / 2);
      }
      this.animateActor(c.dog, reducedMotion ? 0 : this.clock, false);
      const zoom = this.camera.aspect < 1 ? 1.55 : 1;
      const rise = reducedMotion ? 0 : Math.min(8, c.ship.position.y) * 0.28;
      this.camera.position.lerp(this.desiredCamera.set(7 * zoom, 6.5 * zoom + rise, 11 * zoom), reducedMotion ? 1 : 1 - Math.exp(-dt * 5));
      this.cameraTarget.lerp(this.desiredTarget.set(0, 1.6 + rise, 0), reducedMotion ? 1 : 1 - Math.exp(-dt * 5));
      this.camera.lookAt(this.cameraTarget);
    } else if (this.previewActor) {
      this.previewActor.rotation.y += reducedMotion ? 0 : dt * 0.25;
      this.camera.position.lerp(innerWidth < 620 ? this.desiredCamera.set(6, 4.8, 9.5) : this.desiredCamera.set(4.5, 3.8, 7), 1 - Math.exp(-dt * 7));
      this.cameraTarget.lerp(innerWidth < 620 ? this.desiredTarget.set(0, 0.65, 0) : this.desiredTarget.set(-1.2, 1.8, 0.7), 1 - Math.exp(-dt * 7));
      this.camera.lookAt(this.cameraTarget);
    } else if (focus) {
      const zoom = cameraZoom(this.camera.aspect);
      const height = this.journeyEnvironment?.kind === "moon" ? 6.5 : 10;
      const desired = this.desiredCamera.set(focus.x + 9.5 * zoom, 0.8 + height * zoom, focus.z - 1.5 + 15 * zoom);
      const target = this.desiredTarget.set(focus.x, 0.8, focus.z - 1.5);
      const damping = reducedMotion ? 1 : 1 - Math.exp(-dt * 4.5);
      this.camera.position.lerp(desired, damping);
      this.cameraTarget.lerp(target, damping);
      this.camera.lookAt(this.cameraTarget);
    } else {
      const orbit = reducedMotion ? 0.72 : 0.72 + Math.sin(this.clock * 0.07) * 0.09;
      const desired = this.desiredCamera.set(Math.cos(orbit) * 22, 12.5, Math.sin(orbit) * 22);
      this.camera.position.lerp(desired, 1 - Math.exp(-dt * 1.8));
      this.cameraTarget.lerp(this.desiredTarget.set(0, 1, -1), 1 - Math.exp(-dt * 1.8));
      this.camera.lookAt(this.cameraTarget);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
