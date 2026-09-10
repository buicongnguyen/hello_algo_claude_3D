# Robot Beach 3D: Signalbreak — Production Plan

Status: the first playable release is implemented. The sections below describe the intended direction; the implementation audit at the end identifies the actual shipped scope. See [DESIGN_REVIEW.md](./DESIGN_REVIEW.md) for the second evaluation of the original 2D game and the larger production-quality roadmap requested after the first build.

## 1. Product vision

Build a standalone 3D successor to **Robot Beach Adventures** using Blender-authored assets and Three.js. The new game keeps the original world—friendly robots, sea creatures, lighthouse, rocket, beach and playful machinery—but changes the experience from separate flat minigames into one connected action-adventure campaign.

The player is **KAI**, a beach-service robot. During the annual sky-launch festival, a damaged Rust Swarm steals the lighthouse's Aurora Core and scatters its five signal fragments across the island. Without the light, the tide-control beacons fail and the launch cannot happen. KAI, assisted by robot dog **BOLT**, must recover the fragments, protect beach friends and repair the lighthouse before the final storm.

Design pillars:

1. **Readable cause and effect** — every objective names the goal, the world visually marks the target, and actions produce immediate audio/visual feedback.
2. **One coherent control language** — move, pulse, dash and interact work throughout the campaign instead of each stage inventing unrelated controls.
3. **Friendly action** — enemies are disabled and reprogrammed, creatures are tagged or rescued, and combat remains playful.
4. **Short missions with progression** — each mission lasts roughly two to five minutes and unlocks a permanent upgrade or new mechanic.
5. **Performant 3D** — low-poly Blender assets, instancing, capped effects, adaptive quality and no required network assets at runtime.

## 2. Evaluation of the 2D game

### Strengths to preserve

- Distinctive joyful beach/robot theme.
- Seven recognizable activity types: clue chains, chase, defense, timing, delivery, rescue and mystery.
- Short objectives and immediate restart flow.
- Friendly tone and approachable visuals.
- Data-driven mission definitions and deterministic tests.

### Limitations to address

- Chapters feel like unrelated minigames rather than a story with rising stakes.
- The player relearns controls too often; some actions are arbitrary sequence memorization.
- Flat targets do not convey distance, danger direction or world geography.
- Progress is mostly completion counts; there are no meaningful abilities or loadout choices.
- Failure states can feel like timer punishment instead of a consequence the player predicted.
- The title, stage cards and HUD communicate information, but do not create a strong in-world identity.
- Static object scale makes important targets compete with decorative scenery.

### 3D redesign response

- Consolidate mechanics under movement, pulse, dash and interact.
- Turn sequence puzzles into spatial signal-routing and scanning tasks.
- Make threats visible in 3D lanes and use telegraphs before damage.
- Carry upgrades across chapters: wider pulse, longer dash, stronger shield and helper drone.
- Use a beach hub and mission portals to connect all activities.
- Separate decorative scale from interaction scale: important pickups, enemies and beacons use silhouettes, emissive materials, ground rings and distance labels.

## 3. Campaign structure

The release contains five chapters with three stages each. Stages reuse a shared island but change goals, hazards, enemy mixes and lighting.

### Chapter 1 — The Broken Signal

Purpose: teach movement, camera, pulse and interaction.

1. **Wake the Beach** — collect three loose energy cells and restart the dog dock.
2. **Follow the Light** — scan lens, pearl reflector and kite relay in a logical spatial chain.
3. **First Fragment** — disable four training drones and restore the marina beacon.

Reward: wider pulse radius.

### Chapter 2 — Friends Before the Tide

Purpose: teach carrying, safe zones and time pressure with visible consequences.

1. **Little Wave** — escort three creatures to the elevated shelter.
2. **Split Current** — rescue four creatures while avoiding surge lanes.
3. **Everyone Home** — rescue six creatures and recover the second fragment before high tide.

Reward: shield that absorbs one collision.

### Chapter 3 — Reef Defense

Purpose: combine preparation and action. Defenders always behave consistently.

1. **Hold the Boardwalk** — place two solar turrets, then help them disable six drones.
2. **Three Approaches** — cover three marked paths and defend the lighthouse relay.
3. **Rust Captain** — defeat an armored captain that exposes its core after charged attacks.

Reward: pulse damage upgrade.

### Chapter 4 — Skyway Run

Purpose: faster traversal and route choice.

1. **Beacon Sprint** — pass six wind gates before the timer expires.
2. **Cargo in Motion** — collect cells while following a moving supply drone.
3. **Storm Slalom** — complete ten gates with at least two shield charges.

Reward: longer dash and faster recharge.

### Chapter 5 — Lighthouse Siege

Purpose: use the complete move set in multi-part finales.

1. **Dark Beach** — reactivate three substations while patrols search the island.
2. **The Core Chamber** — route three colored signals in the correct physical circuit.
3. **Signalbreak** — defend the repaired core, disable the Rust Warden and launch the festival rocket.

Reward: campaign completion, free-roam mode and best-time replay.

## 4. Core gameplay systems

### Movement and camera

- WASD/arrow keys or touch stick move KAI relative to the camera.
- Camera uses a stable elevated follow angle with soft damping; this keeps navigation readable and avoids motion sickness.
- Dash moves in the current direction, briefly avoids collisions and has a visible recharge ring.
- World bounds and soft collision keep the player on the island.

### Pulse action

- Pulse is a radial non-lethal tool used to disable enemies, activate cells, scan clues and reveal hidden paths.
- A ground ring previews the radius. Cooldown is shown next to the reticle.
- Targets flash cyan when in range and display a clear hit response.
- Upgrades increase radius and power, not control complexity.

### Interaction

- The nearest valid object receives an outline and a short verb label: `E Repair`, `E Pick up`, `E Place turret`.
- Interaction is never used when pulse would be more intuitive.
- Carrying is limited to one item or creature; destination beacons stay visible through scenery.

### Enemies

- Scout: approaches and bumps, then pauses.
- Charger: displays a red line before a straight charge.
- Captain: shielded until a charge misses or a turret interrupts it.
- Warden: final boss alternating summon, beam and exposed-core phases.
- Enemies use simple steering and pooled effects. They become friendly blue robots when disabled.

### Rescue and tide

- Water level and shoreline foam visibly rise.
- Creature icons appear at the screen edge when off camera.
- Safe shelter is elevated, green and visible from the whole play space.
- A creature is only endangered when water is close; warning rings provide time to react.

### Defense

- Placement pads are explicit circular holograms; clicks outside pads do nothing.
- All basic turrets have the same range and damage. Later upgrade pads clearly show their variant before placement.
- Preparation pauses enemy spawning. The action phase starts only after the player confirms readiness.

### Progression and scoring

- Three medals per mission: completion, optional challenge and time target.
- Chapter rewards permanently improve one ability.
- Best medal and time are stored locally.
- Restart is immediate. Failure text explains the consequence and gives one useful tip.

## 5. UI and experience design

### Title and campaign hub

- Full-screen 3D beach vista with moving lighthouse beam and distant rocket.
- Compact title lockup, `Continue`, `New Journey`, `Missions`, `How to Play`.
- Chapter map uses five illustrated signal nodes connected along the shoreline.

### HUD

- Top-left: mission title and one-line objective.
- Top-center: objective progress with icons.
- Bottom-left: input hints that adapt to keyboard or touch.
- Bottom-center: pulse and dash cooldown rings.
- Top-right: shield, timer and pause.
- Temporary world markers replace long instruction paragraphs.

### Story presentation

- Short in-engine dialogue cards with portraits for KAI, BOLT, lighthouse AI LUMA and the Rust Warden.
- Dialogue never blocks movement after the opening line; it can be skipped.
- Mission start uses a two-second camera reveal and concise goal card.
- Chapter endings change the hub lighting as each fragment restores part of the lighthouse beam.

### Accessibility

- Keyboard and touch controls.
- Reduced motion setting disables camera shake and lowers effect movement.
- Quality selector: Auto, Low, High.
- Color-independent target shapes and icons.
- Pause menu includes objective reminder and restart.
- UI scales at 360 px mobile width without hiding mission-critical data.

## 6. Art and Blender pipeline

Blender 4.5 LTS authors the low-poly runtime assets. A deterministic Python generator under `tools/blender/` creates editable `.blend` source and exports optimized `.glb` files to `public/models/`.

Asset set:

- KAI player robot with separated head, body, arms, legs and pulse emitter.
- BOLT robot dog with body, head, tail and articulated legs.
- Rust scout/captain base with emissive eye and readable red/orange silhouette.
- Lighthouse with lens and beam anchor.
- Aurora energy cell, rescue creature, turret, signal beacon, palm, rock and rocket.

Art direction:

- Chunky rounded low-poly shapes; pale ceramic robots; navy mechanical joints.
- Cyan for friendly energy, coral for danger, gold for objectives, green for safety.
- No external textures in the first release; use compact PBR materials and vertex colors.
- Blender Z-up is exported through glTF to Three.js Y-up.
- Origins sit at ground contact. Model forward direction is documented and consistent.

Asset validation:

- Store generator version and triangle/object counts in `public/models/manifest.json`.
- Runtime falls back to procedural primitives if one GLB fails, so deployment remains playable.
- Keep each hero model under roughly 150 KB and the full model payload below 1.5 MB.

## 7. Technical architecture

### Stack

- Three.js for rendering, GLTFLoader, raycasting and scene graph.
- Vite for local development and static production builds.
- Plain ES modules to keep the project easy to inspect.
- Node test runner for deterministic gameplay rules.
- GitHub Actions and GitHub Pages for public deployment.

### Modules

- `src/main.js` — boot, scene, renderer and application lifecycle.
- `src/game.js` — mission state machine, entities, collision and update loop.
- `src/world.js` — island, lighting, water, landmarks and model factory.
- `src/input.js` — keyboard, pointer and touch abstraction.
- `src/ui.js` — screens, HUD, dialogue, pause and results.
- `src/missions.js` — five chapters / fifteen stage definitions.
- `src/rules.js` — pure scoring, unlock and mission-outcome helpers.
- `src/styles.css` — responsive visual system.

### State flow

`title → chapter map → briefing → playing → paused/result → chapter map`

Runtime owns one active mission. Loading a mission disposes mission-specific meshes, effects and listeners while retaining shared renderer, environment and cached Blender models.

### Performance budget

- 60 FPS target on desktop; 30 FPS minimum on mobile.
- One renderer and animation loop.
- Device pixel ratio capped at 1.5 high / 1.0 low.
- Shadows limited to the sun and important characters; low mode disables dynamic shadows.
- Instanced meshes for props, gates and repeated enemies.
- Object pools for pulse rings, projectiles and hit sparks.
- No per-frame DOM writes unless displayed values changed.

## 8. Testing and review gates

### Automated

- Mission catalog is exactly five chapters and fifteen stages.
- IDs are unique and objectives/rewards are complete.
- Progress unlocks stages in order and preserves best results.
- Scoring and medal thresholds are deterministic.
- Damage, shield and mission outcome rules cover boundary cases.
- Production build succeeds with no missing imports.
- Browser smoke test verifies title, mission launch, movement, pulse, pause, restart and responsive HUD.

### Visual/manual

- Inspect title, briefing, active mission and result at 1440×900, 844×390 and 390×844.
- Confirm target silhouettes and labels remain readable against sky, sand and water.
- Confirm camera does not clip below terrain or through the lighthouse.
- Confirm all interactable objects are at least 44 CSS pixels on touch devices or have an equivalent large world marker.
- Check reduced-motion and low-quality settings.

### Code review checklist

- No frame-dependent gameplay logic; all movement uses delta time.
- No duplicate animation loops or undisposed mission objects.
- No hidden lane-specific behavior without UI explanation.
- No objective text that contradicts completion logic.
- No collectible is counted more than once.
- Failure messages identify the actual failed condition.
- Page works from a GitHub Pages subpath.

## 9. Implementation sequence

1. Scaffold the independent Vite/Three.js repository and commit this plan.
2. Create the Blender generator, export assets and validate GLBs.
3. Build the shared island, camera, lighting, water and model loader.
4. Implement input, player movement, pulse, dash, interaction and collision.
5. Implement the five reusable mission archetypes and fifteen data-driven stages.
6. Add story briefings, progression, medals, settings, pause/results and touch UI.
7. Run rules tests, production build and browser smoke tests.
8. Review objective/logic consistency, performance and responsive visual hierarchy; fix findings.
9. Initialize the new Git repository, create a public GitHub repository, configure the SSH remote and GitHub Pages.
10. Commit, push, wait for deployment, and verify the public build.

## 10. Definition of done

- The new repository contains source, plan, Blender generator, editable `.blend`, exported `.glb`, tests and deployment workflow.
- A player can start from the title, complete representative collection, rescue, defense, race and finale missions, earn progress, pause/restart and continue after reload.
- The game uses actual Blender-exported models through GLTFLoader.
- Desktop and touch layouts are playable and important 3D targets are visually unambiguous.
- Tests and production build pass.
- The repository is public, pushed over SSH and the GitHub Pages URL serves the tested build.

## 11. Implementation audit and reviewed release scope

The release ships one shared 3D island and a menu-based mission map, not in-world mission portals. It has ten Blender-exported GLBs and editable Blender source. KAI and scout limbs use pivot-based walk animation. Repeated shoreline stones are instanced; animated actors remain scene objects. Pulse effects use a bounded reusable pool. Unique geometry, materials and label textures are disposed between missions while cached GLB resources are preserved.

All 15 mission objective paths have automated completion checks. The last rescue beacon, patrol/collection counters, relay failure, boss shielding, expiration ordering, earned upgrades, camera-relative movement and disposal behavior have regression coverage. These tests exercise rules and state transitions; they do not replace human balancing or a complete physical-device performance matrix.

The camera is an elevated damped follow camera. A compass names the current target and verb; signal nodes and race gates have floating labels. The pulse ring is a transient effect, not a permanent range preview. The game uses radial range tests rather than raycast aiming. Physical interactions use distance checks and simple obstacle circles rather than a physics engine.

Defense preparation is untimed. After every turret is placed, the player explicitly starts the wave. Turrets have consistent range/damage; the later wave uses tougher scouts. The Warden has a telegraphed charge, a cyan exposed-core window and limited reinforcement calls, rather than the full beam/summon phase set originally proposed.

The tide ring visualizes remaining mission time. Red moving surge rings damage KAI; individual creatures are not simulated drowning. Rescue means carrying one creature to a marked safe destination. BOLT accompanies KAI once its dock has been repaired. Chapter completion awards a larger pulse, a fourth shield, stronger pulse damage and a longer dash. These upgrades persist on replays. The ending animates the rocket launch, strengthens the lighthouse beam and unlocks untimed free roam.

Deferred production work is explicitly tracked in DESIGN_REVIEW.md: separate chapter environments, deeper beam-routing puzzles, companion commands, authored cutscenes, richer enemy tactics, polished rigs and animation, music, gamepad/remapping, terrain navigation, adaptive frame-time profiling and broad device playtesting. "Auto" quality currently chooses a resolution/shadow profile from viewport width; it does not continuously benchmark the GPU.
