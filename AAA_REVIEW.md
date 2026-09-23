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
- Scenes are Draco-compressed: **17.6k–72.3k triangles per destination, 4.38 MB for all 17 journey GLBs** (previously 5.50 MB for primitive scenes of at most 16k triangles).
- Placement reads objective points, routes and spawns from `src/journey-data.js`. A solid prop that would block gameplay is skipped automatically.
- **127 collision footprints** are exported as glTF extras inside each GLB and loaded with the model. KAI, enemies, allies and BOLT no longer walk through scenery.
- `blender --background --python tools/blender/build_journey.py -- city reef` rebuilds only the named scenes.

**Characters** keep their geometry and rigs. Painted shells gain a lacquered clear coat (`KHR_materials_clearcoat`), and eyes and indicator lights export with emissive strength, so they catch bloom.

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

## 6. Remaining gates to AAA

1. **Character performance:** skeletal rigs with authored animation (anticipation, recoil, carry, repair, idle variety) instead of rigid pivots; facial expression for KAI and BOLT.
2. **Level design:** authored terrain with verticality, jump and traversal, interior spaces, and set pieces per destination. The navigation is still a flat 37 m disc.
3. **Encounters:** enemy variety with readable combinations, cover and flanking, and boss phases beyond one charge pattern.
4. **Audio:** composed adaptive music, recorded voice with subtitles, and authored foley in place of synthesis.
5. **Production validation:** profiling on integrated GPUs and real phones, observed first-time playtests (targets are in `STORY_PRODUCTION_PLAN.md`), gamepad support, remapping, text scaling and screen-reader menus.
6. **Content scale:** hours of content, localization, save sync and QA passes across devices.
