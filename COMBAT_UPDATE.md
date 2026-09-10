# Beach Brawl — combat expansion

## Evaluation and purpose

The existing game had a scenic island and a varied campaign, but many early actions were collection or interaction tasks. Its main attack was a short-range pulse; there was little choice of equipment, enemy behavior or team-building. Reaching the action required navigating story progression. Adding more scenery would not solve that lack of decisions.

This update adds an immediately playable arcade encounter and shares its combat systems with fighting missions. It keeps the fifteen-stage campaign and its saves intact. The intended tone is a silly, readable robot beach party, not horror or realistic violence. This is a browser-game expansion, not an AAA-production claim.

## Playable loop

1. Choose **Beach Brawl · Play now** without any campaign unlock requirement.
2. Walk over a glowing weapon crate; hold Fire to shoot the nearest hostile in range.
3. Keep moving, watch red attack warnings, and dash sideways away from a dog pounce or drone dive.
4. Collect Freeze Pops, Crab Whistles and shield patches. Decide whether to spend a consumable now or save it for a group.
5. Defeat hostile robots to earn scrap. Approach a downed robot and press Use to recruit it for 2 scrap.
6. Loot and repair during the seven-second breaks. Survive three waves and chase a better score.

### Story and humor

A broken dance update has turned the shore's maintenance robots into a zombie conga line. KAI uses bubbles, an absurd electric fork and a crab crew to stop the party. Defeated robots can be repaired into helpful friends. The win screen celebrates the resulting tiny team instead of framing the animals as enemies.

## Rules and balance

| System | Implemented behavior |
| --- | --- |
| Bubble Blaster | 36 shots per crate, 1 damage, 0.24-second firing interval, 14-unit targeting range; visible traveling bubbles |
| Arc Fork | 18 shots per crate, 2 damage, 0.6-second interval, 11-unit initial range; chains through at most 3 enemies with 4.5-unit links |
| Pulse | Q / Pulse remains unlimited, governed by the existing campaign recharge and range |
| Freeze Pop | F / Freeze targets a nearby enemy within 12 units, freezing its 5.5-unit neighborhood for 5 seconds; bosses freeze for only 1.5 seconds and retain their shield rules |
| Crab Whistle | R / Call brings 3 crab helpers for 14 seconds; another call refreshes their duration, not their population |
| Repair | Each defeated normal enemy awards 1 scrap once; E / Use spends 2 scrap on a nearby downed robot, with at most 3 permanent teammates per run |
| Supplies | Every third defeat drops a rotating supply; inter-wave breaks add a shield, weapon and Freeze Pop |
| Inventory | Up to 3 Freeze Pops and 3 whistles; full inventory or full shields leaves the pickup on the ground |
| Waves | 6 / 8 / 10 enemies with 2 / 3 / 4 health; successive spawn intervals of 1.5 / 1.3 / 1.1 seconds, with at most 10 active enemies |
| Run | 210-second limit, at least 5 starting shields, 4-second opening equipment window and 7-second inter-wave breaks |
| Score | 100 per defeated enemy + 200 per robot teammate + 50 per remaining shield + 10 per remaining whole second |

Weapon pickups replace/refill the currently equipped weapon. Fire auto-aims in the island plane, including flying robots; bubbles visibly rise toward drones. Shooting empty sky does not consume ammunition. Recruited robots do not take friendly fire, and enemies continue to target KAI or the mission objective: companions are offensive helpers, not invulnerable shields that absorb every attack.

Auto-aim skips shielded bosses rather than wasting ammunition on an invulnerable target. Optional weapon hints yield to mandatory build, delivery and launch objectives.

### Enemy identities

- **Tiny zombie bot:** small upright silhouette, slower approach, short 0.4-second warning before a close-range rush.
- **Zombie dog:** Blender-authored quadruped with pointed ears and animated hip pivots; faster approach, 0.65-second pounce warning, fixed-direction lunge and recovery window.
- **Zombie drone:** Blender-authored four-rotor silhouette; hovers above the sand, gives a 0.85-second warning, then dives along its committed line.
- **Existing bosses:** retain their shield / warning / charge / exposed cycle. Guns, helpers and freeze cannot bypass the shield.

Defense enemies still advance toward the relay along their assigned approaches; they do not abandon their objective to chase the player. Escaped enemies do not award scrap or become recruitable. Combat in collection missions cannot replace required energy-cell collection.

## UI and asset work

- Immediate arcade entry on the title screen; campaign remains separately available.
- Weapon, ammunition, consumables, scrap and teammate counts are visible in the combat HUD.
- Separate Fire, Pulse, Dash, Use, Freeze and Call controls on touch screens.
- Nearest-target compass names the current weapon pickup or enemy behavior.
- Glowing loot silhouettes remain visible at a distance, but only one nearby item caption appears at a time so text does not hide enemies.
- Red hostile health bars, cyan freeze cages and green teammate colors communicate state without relying on prose alone.
- Zombie dog and drone are exported from the editable Blender scene, bringing the shipped model set to twelve.

## Logic review and fixes

1. Use swept projectile collision so a fast bubble cannot skip a small target between frames.
2. Lock pounce/dive direction when the red warning appears; it cannot silently retarget during the rush.
3. Freeze interrupts a normal enemy's attack and removes its stale warning. Frozen enemies cannot damage KAI through contact.
4. Handle defeat only once; repairing changes faction rather than spawning a duplicate enemy. Recruit counts cannot advance objectives twice.
5. Count wave spawn types independently of kill timing; fast kills must not accidentally skip dogs or drones.
6. Stop simulation actions after a terminal result, including a ranged boss defeat.
7. Keep arcade score separate from campaign completion. Entering arcade cannot unlock story upgrades.
8. Clear held inputs on pause, restart, pointer cancellation and lost pointer capture so firing cannot remain stuck.
9. Do not consume ammunition when the projectile/effect budget is full.
10. Cap bodies and release their unique materials, labels and effects, while retaining shared Blender geometry.

## Performance constraints

- Maximum 10 active Brawl enemies, 6 repairable bodies, 3 repaired allies, 3 animal helpers and 18 allocated loot objects.
- Maximum 28 simultaneous bullets/beams; bubbles reuse a pool and short-lived beams are disposed.
- The existing pulse pool remains capped at 24 effects.
- Existing adaptive pixel ratio, quality settings and HUD update throttling remain in use.
- Mission restart releases run-specific geometry, materials and label textures. Cached Blender meshes remain shared.
- No extra runtime dependencies, external model downloads or continuous physics engine were added.

These are resource and logic guarantees, not a claim of a measured frame rate on every phone. Rendering speed still depends on browser, graphics hardware, resolution and quality settings.

## Verification

- Unit/integration tests cover all fifteen campaign completions, all three Brawl waves, weapons and ammunition, fixed attack warnings, freeze, boss shielding, repairs, friendly fire, animal expiry, resource caps and progress isolation.
- Browser smoke checks load all twelve Blender models, exercise keyboard and touch firing, cancel touch input, pause, verify mobile controls and compare GPU resource counts after repeated campaign and combat restarts.
- Visual captures cover desktop, portrait phone and short landscape layouts, including active enemies and crab helpers.
- Production build and GitHub Pages deployment use the existing SSH-backed repository and deployment workflow.

## Deliberate limits and future iteration

This release has one arcade arena and three finite waves, not endless survival or multiplayer. Helpers have simple follow-and-attack behavior; there is no inventory wheel, manual aim, pathfinding navmesh or persistent army. Combat balance needs hands-on player feedback beyond deterministic tests. The next useful additions would be an enemy with a clearly marked area attack, an optional wave-end choice of upgrade, and a crab rescue bonus objective—not a larger set of indistinguishable enemies.
