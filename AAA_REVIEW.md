# Signalbreak — AAA art and logic review

## Verdict

This pass moves Signalbreak from "primitive scenes with a flat renderer" to a coherent, lit and readable stylized game, and fixes every confirmed gameplay-logic defect found in a full review. It does **not** make the game an AAA production: that still needs skeletal animation, authored levels with verticality, voice and music, real-device profiling and observed playtests (see *Remaining gates*). Unreal Engine was not used: the game is a Three.js browser title deployed to GitHub Pages, and a port would be a rewrite rather than an improvement. Blender 4.5 LTS remains the asset pipeline.

## 1. Rendering

| Before | After |
|---|---|
| Flat `scene.background` colour, one gradient reflection map for every scene | Per-destination gradient sky dome with sun disc and stars; the same sky bakes each scene's reflection map (`src/sky.js`) |
| One sun direction, three sun colours and one hemisphere light for all scenes | 19 art-directed atmospheres: sun direction/colour, hemisphere, rim light, fog, exposure and bloom per destination (`src/atmosphere.js`) |
| Direct render, fixed 1024 shadow map over the whole island | HDR composer with 4× MSAA, half-resolution GTAO, bloom, tone mapping and a light grade; texel-snapped soft shadows that follow KAI (`src/render.js`) |
| `auto` quality: phone = no shadows | Quality tiers: desktop `high`, phone `medium`, software rasterizer `low` (auto-detected). Explicit choices are always respected. Quality never changes gameplay |

Extras: storm lightning flashes, underwater light shafts, and a procedural Earth with clouds and an atmosphere rim. In orbit the Earth fills the horizon; from the Moon it hangs in the sky (`src/planet.js`).

## 2. Blender assets

**Environments** were rebuilt with a new kit (`tools/blender/kit.py`, `props.py`, `build_journey.py`):

- Terrain is flat and walkable inside the 18.5 m play space and rises into hills, dunes, reef walls, trench cliffs, craters or terraces beyond it. There are no more floating slabs.
- Every corner carries a baked colour: tint × ambient occlusion × per-prop variation. Geometry is batched into one mesh per material, so a destination costs at most **16 draw calls**.
- The prop library includes buildings with framed and lit windows, awnings, signs and rooftop kit; streets with curbs and crosswalks; lamps, benches and cars; barns, silos, windmills and crops; palms, umbrellas, sandcastles and footprints; branching, brain and fan coral, kelp and anemones; a ribbed shipwreck; basalt columns, vents and bioluminescence; a research platform; atolls with shallow water; cloud decks; an orbital station; a lunar lander, rover and observatory; and the museum festival.
- Scenes are Draco-compressed: **18.8k–71.6k triangles per destination, 4.35 MB for all 17 journey GLBs** (previously 5.50 MB for primitive scenes of at most 16k triangles).
- Placement reads objective points, routes and spawns from `src/journey-data.js`. A solid prop that would block gameplay is skipped automatically.
- **127 collision footprints** are exported as glTF extras inside each GLB and loaded with the model. KAI, enemies, allies and BOLT no longer walk through scenery.
- `blender --background --python tools/blender/build_journey.py -- city reef` rebuilds only the named scenes.

**Characters** keep their geometry and rigs. Painted shells gain a lacquered clear coat (`KHR_materials_clearcoat`), and eyes and indicator lights export with emissive strength, so they catch bloom.

## 2b. Play-space boundary

- **Wider space:** `PLAY_RADIUS` in `src/presentation.js` (now 21 m, previously 18.5 m) is the one edge for KAI, enemies, the radar and the scenery. The old square clamp is gone.
- **Scenery follows the edge:** Blender scenes stay authored around the old edge. `build_journey.py` reads `PLAY_RADIUS` and moves rim dressing and terrain features outward. Each prop moves as one rigid piece; objectives and interior props never move.
- **Readable edge** (`src/boundary.js`):
  - A faint dashed ground ring is always visible.
  - A holographic fence lights up only within a few metres of KAI and brightens against the edge.
  - Both take each destination's rim tint.
- **Radar:** the minimap's dashed disc edge is the same boundary.
- **Always visible:**
  - Terrain on the camera side of each scene stays low, and tall trees, palms and cargo are kept off it.
  - Where scenery does hide KAI, a stencil-based x-ray silhouette shows the robot through it.
  - An automated line-of-sight check at 16 points on the edge of all 17 scenes passes. The one exception, standing directly behind a festival stall, is covered by the silhouette.
- **Rendering fix found while profiling:** MSAA now applies only to the scene render. It had also been applied to every post-processing target, which cost roughly half to two thirds of high-profile frame throughput.

## 3. Game feel and audio

- A pooled particle system (one draw call) drives hit sparks, defeat bursts, pickup and collect sparkles, gate bursts, dash puffs and footsteps: dust on land, bubbles underwater, jet sparks in flight.
- Hits trigger an enemy flash and knockback. Defeats and damage add hit-stop, trauma-based camera shake (disabled by Reduced motion) and a screen-edge damage flash.
- KAI turns smoothly, leans into movement and dashes, and keeps facing its target while firing.
- The audio rewrite (`src/sound.js`) adds a compressor bus, 13 synthesized cues and a procedural ambient bed per destination type. There are still no audio downloads.

## 4. Logic review — confirmed defects and fixes

Each fix has a regression test in `tests/review.test.js` or the updated suites.

| # | Defect | Fix |
|---|---|---|
| 1 | Relay compass could loop forever; a closed loop showed "3/3 links" | Guidance and progress follow the nearest completing orientation (`solveRelays`) |
| 2 | Pausing permanently discarded unread radio lines | Pause snapshots the dialogue; Resume restores it |
| 3 | The Floating Observatory defense won with no input | Turrets cover the flanks (5.5 m); the open centre lane needs KAI; scouts have 3 HP |
| 4 | A breach kept the wave running, drained KAI's shield and could double-hit | The first breach fails immediately with an actionable message; no shield drain |
| 5 | "Take no damage" medals were free in four stages with no damage source | Those stages use the speed challenge; the finale uses an optional four-exhibit lap |
| 6 | "Call the animal crew" +500 was free at t = 0 | A whistle is only spent, and counted, with a robot within 14 m |
| 7 | Free Roam showed the museum HUD and minimap colour on the island | Roam overrides scene, location and activity |
| 8 | Pressing E beside a battery said "Move closer" | Use collects a nearby battery; the prompt reads `E / Q · COLLECT BATTERY` |
| 9 | Dog and drone warning lines were shorter than the real pounce (5 m vs 6.6 m) | Lines use rush speed × duration |
| 10 | Crabs and allies attacked a shielded boss and overwrote the charge telegraph | Helpers ignore shielded bosses; only KAI's own hits explain the shield |
| 11 | Scenery had no collision | Blender-exported footprints; a test checks no objective, route or spawn is covered |
| 12 | BOLT did not follow in stage 1, although the story says it joins there | The journey companion always follows |
| 13 | Restoring a checkpoint into the homecoming stage would crash | Checkpoints only restore into `finale` stages |
| 14 | Boss tints lerped cumulatively and drifted over cycles | Tints blend from the authored colour |
| 15 | Flight rig stacked a second pair of thrusters on KAI | The rig is skipped when Twin Thrusters are equipped |
| 16 | Window blur did not pause; held Enter could auto-repeat into a result button; a clicked pause button kept focus | Blur pauses; repeated keys are blocked on modals; the HUD button releases focus |
| 17 | Touch prompts showed keyboard keys (`E / Q`); enabling sound mid-session stayed silent | Touch prompt mapping; the audio context starts when sound is enabled |

The review also noted by-design behaviours, left unchanged: Story mode keeps shield failure, and turrets and allies never take damage.

## 5. Verification

- `npm test`: **91 passing** (77 before; 14 new review tests). The environment budget test now allows ≤ 80k triangles and ≤ 20 material batches per destination, requires Draco, and keeps the 6 MB total. A new test proves no collider covers a spawn, objective, route point or exhibit; it caught a real overlap (fountain vs. exhibit), which was fixed.
- `npm run test:smoke` and `npm run test:story` pass. These run in software WebGL, so `auto` selects the low profile. The scene budget (shadow + main view) is unchanged; frame totals, including ambient occlusion and bloom, are checked separately. The harnesses now strip ANSI colour codes when waiting for Vite.
- GPU check, high profile, 1440×900, RTX 4080 SUPER:
  - All 15 stages hold 60 fps (the vsync cap).
  - Scene pass: 109–271 draw calls, 61k–172k triangles. Full frame: 229–554 draw calls, 120k–340k triangles.
  - Geometry and texture counts are identical across five restarts of each tested stage.
  - A 24-wave combat stress plateaus at the existing pool caps.
  - Phone portrait on the medium profile also holds 60 fps.
- These are rendering-cost checks on one machine, not a hardware FPS guarantee.

## 5b. Second review pass — logic, rendering, UI, pipeline and tests

A second review covered gameplay logic, rendering, UI and accessibility, and the Blender pipeline and tests. Every confirmed finding is fixed below.

**Gameplay**

| Defect | Fix |
|---|---|
| A player in the pocket between a rim prop and the edge froze every enemy (no route to a target inside an inflated footprint) | `reachablePoint` moves the destination to the nearest standable spot; A* falls back to the closest valid node (`src/navigation.js`) |
| KAI could be pushed into a prop by the edge clamp | Clamp, resolve props, clamp again |
| Summoned crabs could spawn or idle outside the boundary | Crabs and allies are clamped to the play space |
| Pulsing a shielded boss replaced the shield hint with "No pulse target" | The shield explanation stays |
| Defense scouts spawned onto KAI and hit before they were visible | KAI starts inside the line; new robots have a 0.8 s contact grace |
| A downed robot beside the clam or exit could not be repaired | Repair wins unless carrying, lifting a friend or finishing |

**Rendering**

- The x-ray silhouette is idempotent: weapon and equipment pickups re-dress KAI fully ghosted.
- Stencil state no longer leaks into cached model materials shared with BOLT and menus.
- Each ghost owns its material.
- Custom shaders (particles, fence, planet) are tone-mapped and colour-managed like the rest of the frame.
- Shadow maps update once per frame, not once per render pass.
- A lost and restored WebGL context rebuilds the environment.
- Quality changes free the shadow map and composer targets, and `auto` re-resolves on resize.
- The particle pool allocates nothing per frame.

**UI and accessibility**

- Messages are a top-level toast, so menu-time warnings (for example, failed model loads) are visible.
- The field manual takes focus. Escape closes it and returns focus.
- Escape resumes from the pause menu without re-pausing.
- Everything behind an open dialog is inert.
- Reduced motion defaults to the OS preference until the player chooses. The in-game setting also drives CSS, and the damage flash becomes a short, soft fade.
- Mouse clicks on Next/Skip don't keep focus.
- Taps within 300 ms of play starting are ignored, so they are not read as shots.
- Quality offers Medium, and saved settings are validated.
- Pausing suspends the radio instead of finishing it.
- Audio unlocks on the first gesture anywhere.

**Blender pipeline** (all 17 scenes rebuilt; collision footprints are unchanged)

- Rebuilds are byte-identical across Blender processes and between full and partial builds:
  - UV spheres are rebuilt in a canonical order.
  - Node names carry the scene key.
- Decals no longer z-fight after Draco quantization:
  - Plaza rings stack at 9 mm steps.
  - Crossing roads' sidewalks and the intersection patch are layered.
  - Orbit apron tiles are seamed annular sectors instead of overlapping boxes.
  - Countryside lane patches alternate heights.
- Rim props use `Scene.ground_y`, which is the terrain formula including camera-side clearance. Props floating more than 0.5 m on the camera side: abyss 38 → 0, reef 15 → 0, wreck 4 → 0, moon plain 2 → 0.
- Homecoming exhibits are kept clear automatically.
- Crater rims move with their crater.
- Scatter tests keep-clear at the pushed position.
- `npm run assets:journey -- city reef` forwards scene names. Builds use `--factory-startup` and have a timeout. A mistyped scene name fails. Models are staged and only replace `public/models` after every scene succeeds.

**Tests and CI**

- New regression tests:
  - Relay optimum checked against an independent breadth-first search (the old check compared the solver with itself).
  - Detour tests prove the prop really blocks the straight line.
  - One test for each gameplay fix.
  - Silhouette ownership.
  - Settings validation.
  - Input grace.
- The collision test reads the footprints from the GLB extras the runtime loads. It now also covers BOLT, pickups, the buoy, the defense relay and pads, and every race, escort, relay, homecoming and defense path segment.
- Browser suites:
  - They never leak a Vite server.
  - `capture.mjs` pins its port.
  - The touch-fire check waits for a real shot.
  - The phone and legacy-save pages report errors.
  - The fallback check fails both manifests.
- CI also runs on pull requests (without deploying), and a deploy in progress is never cancelled.

**Verification:**

- `npm test`: 107 passing.
- The production build is clean.
- Smoke and story browser suites pass against `vite preview` on an RTX 4080 SUPER (D3D11).
- A 16-check UI script passes: focus, inert state, Escape, reduced motion and Medium quality.
- In-game captures of the rebuilt city, orbit, abyss, reef, home, countryside and moon show no console errors and hold 60 fps.

## 5c. Light living details and lighter assets

This pass applies the `lightweight-game-objects` approach: put detail where the pixels are, keep colour in vertices and motion in maths, draw repeated things once, and measure. It measures first, then lightens what is heavy, then adds life that costs almost nothing.

**What the audit found** (phone size, 390×844):

- Tiny parts carried thousands of triangles:
  - Antenna and its light: 1,144 each on every robot.
  - Bark scars on a palm: 5,184.
  - Starfish, snail and mushroom freckles: 800–1,800.
  - Clam shells: 2,304 each.
- Robots drew 18–22 parts each.
- On the low tier, actors were 139 of 171 draw calls.
- On a weak-GPU proxy (SwiftShader), image-based lighting was the largest per-pixel cost. Turning it off took the low tier from 14.5 to 32.5 fps.

**Lighter existing items**

- **Triangle trim:** the 25 robot and prop assets went from **80,432 to 37,042 triangles (−54%)** and from 2.51 to 1.47 MB.
  - Silhouettes, every pivot, every material and every name the code relies on are unchanged.
  - `build_assets.py` now picks detail by on-screen size: bevel segments by part size, sphere detail 320 / 80 / 20 by size, and fewer sides on small cylinders and rings.
  - Eyes and light bulbs stay round.
  - A side-effect fix: Blender's bevel modifier wrote slightly different UVs on every run, so asset rebuilds were never byte-stable. Bevelled boxes now get a re-projected cube layout, and three full exports are byte-identical.
  - `tests/asset-budget.test.js` gives every asset a ceiling about 8% above its new count.

  | Asset | Triangles |
  |---|---|
  | KAI (hero, close-up in the Workshop) | 7,092 → 3,340 |
  | Rust Scout | 7,092 → 2,780 |
  | BOLT / zombie dog | 6,876 / 6,700 → 2,980 / 2,804 |
  | Palm | 10,340 → 2,022 |
  | Octopus | 6,472 → 2,692 |
  | Clam | 5,376 → 2,192 |
  | Starship | 7,300 → 3,172 |
  | Rust drone | 3,424 → 1,712 |
  | Software disc | 1,536 → 648 |
  | Salvage tower | 1,584 → 720 |
- **Low "toy" tier:** the low tier lights with the hemisphere alone, brightened by the sky's ambient share, instead of the sky reflection map. On SwiftShader at phone size:
  - beach: 8–10 → 18–20 fps;
  - reef: 12.5 → 21 fps.
- **Adaptive Auto quality** (`src/governor.js`, after Zoo Garden):
  - Three slow seconds while playing lower resolution in 15% steps to 0.7×, then the tier.
  - Fast seconds win resolution back.
  - The result is stored per device, not in the save. Choosing Auto again re-measures.
- **Island clouds:** 28 puffs are now one instanced mesh, one geometry and one draw call (previously 28 of each), drifting slowly.
- **Marker rings:** 480 → 256 triangles each.
- **Shadows:** parts under ~14 cm (eyes, buttons, antenna tips) no longer draw into the shadow map.

**New living details** (`src/life.js`, recipes in `src/life-data.js`)

| Destination | Life |
|---|---|
| City | pigeon flocks, butterflies, warm dawn dust, swaying trees |
| Countryside | swallows, butterflies, rising dandelion seeds, swaying crops and grass |
| Beach, platform, atolls, island | gulls (plus butterflies by the island palms) |
| Reef | clownfish, tangs and butterflyfish schools; rising bubbles; kelp and seagrass in the current |
| Wreck | a 56-fish sardine school, slow groupers, bubbles |
| Abyss | glowing lanternfish, pulsing jellyfish, bioluminescent plankton |
| Storm sky | rain |
| High sky | two V-formations of geese, wind motes |
| Moon | low regolith dust |
| Home festival | white doves, butterflies, fireflies, falling festival petals |
| Expedition pools | small fish just under each pool's surface, tinted toward the water (2.5D layering, no transparent pass) |

How it stays light:

- Each kind of creature is one `InstancedMesh` of a 10–66-triangle procedural mesh.
- Its swim, flap, flutter or pulse runs in the vertex shader. The phase is accumulated, so a calm-to-flee change never jumps.
- The CPU only steers:
  - capped turn rate, banking, leader-follow schools;
  - creatures dart away from KAI and part around the camera's line to KAI, so the hero is never hidden;
  - it allocates nothing and sleeps while a swarm is off screen.
- Motes are GPU-only points: one uniform per frame.
- Plant sway patches the scenery's own foliage material, so it adds no draw call. Bend depends on height above the terrain, read from an 81×81 height texture, so grass flexes and trunks barely move.
- A seeded RNG drives cosmetics, so gameplay randomness never shifts.
- Counts scale by tier (low 45%, medium 70%, high 100%). Portrait phones draw creatures 1.35× larger to keep them at 20–27 px.
- Reduced motion stills plants, hides motes and calms creatures.

**Before → after the whole pass.** SwiftShader as a weak-GPU proxy at 390×844, with the old and new builds alternated in the same session (two runs each):

| Stage, tier | Before (fps) | After (fps) | Triangles |
|---|---|---|---|
| Beach, low | 8.6 / 8.2 | **16.2 / 18.4** | 74k → 52k |
| Reef, low | 8.4 / 11.6 | **21.2 / 19.7** | 81k → 69k |
| Beach Brawl, medium | 3.4 / 3.4 | **3.8 / 4.0** | 121k → 47k |
| Beach, medium | 4.5 / 3.9 | 4.8 / 3.4 (noise) | 141k → 95k |

On this proxy, medium is bound by post-processing. A phone that cannot hold medium now steps down automatically to a low tier that is about twice as fast as before.

**Measured cost of the life:**

- Life adds 1–5 draw calls and about 1.5k triangles per destination.
- On SwiftShader, fps with and without life are within noise (4.8 vs 4.5; 4.8 vs 4.7; 3.5 vs 3.5).
- The life update costs 0.07–0.4 ms per frame with the CPU slowed 4×.
- Geometry, texture and shader-program counts are identical after four cycles through six destinations (236 / 34 / 50).
- Foliage sway visibly moves the reef's kelp, and stops entirely under reduced motion.

## 5d. Phone pass — fewer draws, no hitches, more life

This pass applies the `smooth-dense-scenes` approach: measure real WebGL draws (shadow and post passes included) on a 390×844 phone view with the CPU slowed 4×, find the real cost, fix it, and measure again.

**What the profile showed:**

- Most of the main-thread time was three.js's per-draw overhead: uniform uploads, buffer binds and matrix uploads.
- Combat stuttered: 20 frames over 50 ms in 2.5 s on the beach. The enemy pounce warning line created and disposed its own dashed-line material, so every telegraph recompiled that shader.
- In the phone tier's post chain, 4× MSAA was the largest per-pixel cost (+40–78% fps without it on SwiftShader). Bloom and grading cost little.

**Fixes:**

- **Bake per moving part** (`src/bake.js`). Each pivot's meshes merge into one, with colour, roughness, metalness, normal-map strength, clearcoat and glow stored per vertex. A patched standard/physical material reads them.
  - What stays separate: the paint system's recolourable materials (KAI and its gear only), see-through parts, and nodes the code finds by name.
  - Merged meshes are named `baked_*`, so pivot lookups (`Hip_`, `ShoulderPivot_`, `Rotor`, …) never animate them twice.
  - Mesh counts: Rust Scout 22 → 5, zombie dog 18 → 6, drone 14 → 9, octopus 21 → 10, starship 10 → 5, palm 4 → 1, KAI 22 → 15.
  - A frozen line-up of every model renders the same before and after: 48 of 840,000 pixels differ, against 27 between two captures of the same build.
- **Nearby-only shadows:** movers cast shadows within 16 m of KAI, and parts under ~14 cm never cast.
- **Shader warm-up:** while the title screen shows, every model and every short-lived effect material is compiled in the background, and the effect materials are kept alive. Neither a first fight nor a repeated telegraph compiles mid-play.
- **No MSAA on dense touch screens** (pixel ratio ≥ 2). A stair-step is about two physical pixels there. Bloom, grading and shadows stay.

**Measured** (real draws including shadow and post passes, phone view, medium tier, CPU ÷4):

| Stage | Draws before → after | Shadow casters |
|---|---|---|
| Beach combat | 279 → 148 | 153 → 61 |
| Beach Brawl | 182 → 116 | 63 → 29 |
| Reef | 200 → 134 | 117 → 48 |
| Home festival | 160 → 116 | 94 → 42 |
| Expedition | 256 → 148 | 149 → 59 |
| City | 160 → 106 | 100 → 43 |

Every stage is now within the comfortable phone budget of 200 draws.

Old and new builds alternated three times each:

| Stage | Build | Median frame (ms) | 95th percentile (ms) | Frames over 50 ms |
|---|---|---|---|---|
| Expedition | old | 10.1 | 29.3 | 6 in total |
| Expedition | new | 10.8 | 20.9 | 0 |
| Beach combat | old | 16.4 | 31.7 | — |
| Beach combat | new | 12.3 | 31.2 | — |

GPU memory stays flat across stage cycles: 155 geometries (previously 236, because baked parts share less), 34 textures and 68 programs.

**More living details, by scenario:**

| Scenario | Added |
|---|---|
| City plaza, countryside, beach, home island, festival plaza | birds that walk and peck: pigeons, sparrows, sandpipers, doves. They burst into flight when KAI comes within ~3.4 m, then land again, and walk around props using the journey collision footprints. |
| Reef and wreck | sea turtles and manta rays |
| Beach, platform, atolls, island | glints on the sea |
| Countryside | buzzing bees |
| Festival | rising sky lanterns |
| Ocean platform | flying fish skimming the swell |
| Orbit | twinkling station sparkles |

These are the same one-draw-call kinds as before. Wings fold while a bird walks, and the head nods while it pecks.

**Paint in the bake:**

- KAI's and its gear's paint-recolourable parts are now baked too. Each vertex carries a paint slot (fixed, shell or accent), and the merged material swaps in that robot's colours. The accent glow follows the accent colour.
- Paint colours live on each material instance, so the Workshop preview, KAI and the cached model paint independently.
- Draw counts:
  - KAI with armor, thrusters and antenna: 9 meshes (KAI alone was 22 before baking).
  - Real draws: beach combat 148 → 131, Beach Brawl 116 → 93, reef 134 → 111, city 106 → 83.
  - No frames over 50 ms; 95th percentile 13–21 ms at CPU ÷4.

**A bug found and fixed in this pass:** three's `Material.clone()` drops `onBeforeCompile` and `customProgramCacheKey`. The game clones materials per robot (hit flashes, tints, silhouettes, paint), so clones lost the bake patch. Robots rendered without their baked finishes and glow, which was visible in the build briefly deployed as c1dbde7.

- Baked materials now override `clone()` to keep the patch, and a unit test guards it.
- The frozen line-up check now goes through the game's real per-robot paths: enemies clone their materials, KAI gets its silhouette.
- Against the pre-bake build:
  - the broken build differed in 112,696 of 840,000 pixels;
  - the fixed build differs in 51 (same-build noise: 18).

## 6. Remaining gates to AAA

1. **Character performance:** skeletal rigs with authored animation (anticipation, recoil, carry, repair, idle variety) instead of rigid pivots; facial expression for KAI and BOLT.
2. **Level design:** authored terrain with verticality, jump and traversal, interior spaces, and set pieces per destination. The navigation is still a flat 37 m disc.
3. **Encounters:** enemy variety with readable combinations, cover and flanking, and boss phases beyond one charge pattern.
4. **Audio:** composed adaptive music, recorded voice with subtitles, and authored foley in place of synthesis.
5. **Production validation:** profiling on integrated GPUs and real phones, observed first-time playtests (targets are in `STORY_PRODUCTION_PLAN.md`), gamepad support, remapping, text scaling and screen-reader menus.
6. **Content scale:** hours of content, localization, save sync and QA passes across devices.
