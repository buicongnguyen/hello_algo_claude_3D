# Compact models and clearer 3D detail

## Problem and scope

The previous follow camera magnified the already large actors on narrow screens. Large sea creatures, chunky pickup rings and five-metre light columns crowded the action. Faceted normals and self-shadow stripes made the models look rough even in the Workshop.

This update changes presentation, not the campaign or equipment rules. All 24 model types, all stages, animals, equipment and objectives remain available.

## Implemented changes

- KAI is 18% smaller in gameplay. Bots are 10% smaller, dogs 14–22%, drones 18%, sea creatures 28–33%, pickups about 25–28%, and scenery 14–20%.
- The follow camera is 14% farther out on wide screens and gradually reaches 50% farther out on narrow portrait screens. Its horizontal angle is unchanged, so movement, guidance arrows and the minimap still agree.
- Workshop previews retain their larger inspection scale. Attached armor, thrusters and antennas inherit KAI's scale exactly once; loose parts use compact pickup scale.
- Objective rings retain their meaningful footprint but use thinner tubing. Light columns are shorter and fainter. Nearby loot captions and weapon-crate rings are smaller.
- Blender models have smooth curved surfaces and weighted panel normals. Robots gain separate eyes, visor frames, smiles, vents, panel fasteners, elbow collars, knee guards and boot stripes. Dogs gain paws, noses and back panels; friendly BOLT has floppy ears. Drones gain guards and a camera lens.
- Octopuses gain suckers, cheeks and eye highlights; starfish gain freckles and smiles; NORI has a real raised shell spiral; clams have shell ribs and a pearl seat. Software CDs are thin discs with a center hole and colored data sectors rather than thick donuts.
- Armor and thrusters have contrasting insets, vents, collars and gauges. Lighthouse and rocket details include portholes, seams and railings; mushrooms and salvage crates have additional surface accents.
- Shadow bias removes the distracting striped self-shadow artifacts.
- Projectile target heights and carried objects follow actual model scale. Pickups and combat ranges, damage, timers and progression are unchanged. Landmark collision footprints track the smaller scenery.

## Performance safeguards

Static pieces are joined in Blender by material and rigid parent. Animation pivots, tentacles, clam hinges and rotors remain separate. Exported GLBs total approximately 1.46 MB, essentially unchanged from the previous assets, with 42,588 triangles across the entire 24-model library. Per-asset tests cap size, triangles and mesh counts. Existing low-quality rendering and bounded combat pools remain intact.

## Review and verification

- Unit tests cover compact proportions, smooth aspect-dependent camera framing, unchanged yaw, zero-height placement, attachment scale inheritance and asset budgets.
- Browser tests cover real Blender loading, the 15-stage campaign, combat, expeditions, equipment persistence, touch controls, portrait framing and resource stability across repeated scene changes.
- Verified: 38 unit tests pass; production build and browser smoke pass. Portrait KAI measures about 67 pixels tall at 390 × 844. Repeated expedition/Workshop cycles remain at 178 cached geometries and 3 textures without growth (previous baseline: 222 geometries, 3 textures).
- Visual captures compare desktop, portrait and landscape gameplay plus close-up Workshop previews. Inspect creature faces and shell details at close range without enlarging them in gameplay.
- Review fixes include maintaining the lighthouse beam's lens height after scaling, preserving rotor pivots during batching, correcting CD surface winding, and keeping coordinate-only arc paths supported.

Regenerate with `npm run assets:blender`, then run `npm test`, `npm run build`, `npm run test:smoke` and `npm run test:visual`. GitHub Pages deploys the tested `main` branch through the existing SSH Git remote and Actions workflow.
