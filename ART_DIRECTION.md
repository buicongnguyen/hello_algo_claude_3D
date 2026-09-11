# Signalbreak — crafted 3D art pass

## Evaluation and target

The previous assets read as primitives rather than manufactured robots or living coastal shapes. Large uniform highlights, bright emission, straight dog legs, rectangular palm leaves and flat untextured terrain reinforce the toy-block appearance. Adding polygon subdivisions alone would not fix this.

Target: a coherent, detailed **stylized coastal science-fiction** game. AAA is a production benchmark, not a claim this browser project can honestly meet in one pass. Keep friendly characters, readable enemy colors, compact gameplay scale, existing equipment and all stages.

## Implementation plan

1. Author shaped Blender hulls with tapered profile sections. Give KAI a helmet, recessed optical face, layered chest, service fasteners, gripper hands, shin armor and rubber soles. Preserve Torso paint lookup and all limb pivots.
2. Give BOLT and hostile dogs a contoured ribcage, shaped head/muzzle, joint axles, bent mechanical legs, visible hydraulic rods and separated paw toes. Preserve diagonal gait, tail, height and footprint.
3. Shape natural assets: curved palm trunk, individual tapered leaflets, continuous octopus arms, domed starfish, fluted clam shell, branching coral. Preserve creature animation pivots and interaction locations.
4. Give AURORA swept wings, hull seams, non-emissive canopy glazing and engine hardware. Preserve the saved/skippable stage-clear sequence.
5. Separate painted shell, rubber, steel, glass and organic material response. Add restrained shared procedural micro-surface maps in Three.js; generate once, not per actor or frame. Use prefiltered environment lighting so metal and glass can reflect their surroundings.
6. Add sand grains, wood grain and water ripples without external texture downloads, transparency-heavy post-processing or new gameplay obstacles.

## Logic and performance review before implementation

- No changes to collision radii, actor scales, controls, difficulty, saves or stage unlocks.
- Armor uses original authored coordinates; preserve helmet/head height so the halo still fits.
- Parent/material batching must retain animated joints and independently rotating drone rotors.
- Shared textures/environment live for the World lifetime. Releasing a painted clone must not dispose shared surface maps.
- Keep emissions on functional indicators, not entire hands or cockpit glass.
- Increase the complete GLB budget from 2 MB to at most 4 MB for actual silhouette detail; target at most 12,000 triangles and 40 batched meshes per asset. No blanket subdivision of every small fastener.
- Existing low-quality mode keeps capped resolution and disables dynamic shadows. New lighting must work in that mode too.

## Acceptance checks

- Blender export succeeds for all 25 assets; hashes, byte counts, mesh and triangle budgets validated.
- Real GLBs preserve paintable Torso, dog hips/tail, octopus arms and clam hinge.
- Desktop close-ups show construction detail and believable material differences; gameplay and portrait screenshots remain readable.
- Unit, production build and browser smoke pass, including combat, equipment, saved stage victory, fallback model loading and repeated scene/resource cycles.
- Review changed code for ownership, geometry normals, animation hierarchy and visibility regressions; fix findings before SSH push and GitHub Pages deployment.

## Delivery record

Implemented the Blender shape pass, PBR finish separation, prefiltered coastal reflection environment, shared micro-surfaces, irregular ground cover and instanced grass blades. Existing compact scales, equipment coordinates, controls, saves and stage rules are unchanged.

Review corrections:

- Lighthouse bands now follow the tower taper instead of being buried inside its hull.
- Starfish facial details are ray-cast onto the subdivided shell; octopus markings follow the mantle surface instead of floating above it.
- Static palm leaflets flatten into four material batches while animal animation joints remain separate.
- Painted-clone disposal preserves shared normal maps; private textures are disposed across all material map slots. Imported material textures are registered as shared too.
- The Blender command now returns failure on Python exceptions instead of potentially reporting success with stale exports.
- Software-rendered browser input checks wait for actual simulation progress instead of assuming a short wall-clock sleep contains a rendered frame.

Asset measurements: **25 GLBs, 2,505,720 bytes total, 80,432 triangles across the complete library, at most 10,340 triangles / 22 meshes in any one model**. Shared surface pixel buffers use 512 KiB before mipmaps, plus a 16 KiB ground-cover texture and one prefiltered environment map. No external image downloads or frame-by-frame texture generation.

Verification: 54 unit tests and the production build pass. Desktop, portrait, workshop, sea-life and coastal-model captures were inspected. The first mission measured approximately 164 draw calls / 134,000 rendered triangles; the isolated coastal-model inspection measured 45 calls / 43,724 triangles. These are rendering-cost checks, **not a hardware FPS benchmark**.

The complete browser smoke suite passes: versioned real models, all campaign setups, combat, touch controls, expeditions, equipment recoloring and attachment, saved/reduced-motion/skippable departures, reload persistence and missing-manifest fallback. Repeated scene cycles remained stable at 164 geometries / 11 textures for restart/combat, 198 / 11 after expeditions and 208 / 11 after stage celebrations. The independent fallback check closes the prior test page to avoid competing software-rendered WebGL contexts.

Release process: commit the reviewed source and generated Blender assets, fast-forward the existing public repository, push `main` over its existing SSH remote, await the GitHub Pages workflow, then run the same smoke suite against the public URL. Public deployment status is verified after the commit; it is not assumed from a successful push.

## Remaining distance to AAA production

This remains a stylized browser game. A full AAA art pipeline would additionally need artist-directed high-resolution sculpts and baked detail maps, authored terrain and architecture, skeletal animation, a richer effects library and broad real-device GPU profiling. This pass improves the actual shipped geometry and rendering without claiming that larger production effort is complete.
