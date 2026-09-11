# Signalbreak: story and stage production pass

## Honest production target

Build a coherent, expressive coastal action-adventure, not fifteen unrelated minigames. This pass is executable scope for the existing browser game. It does not certify AAA quality, replace a full studio production, or substitute automated tests for observed player testing.

## Story bible

**Promise:** a small maintenance robot brings a frightened island community back together. Repair is the central verb, including in combat.

KAI believes a good repair starts with listening. BOLT is an eager rescue dog whose practical advice sometimes becomes a joke. LUMA, the lighthouse, used to trust the Warden to protect everyone. The Warden is running an obsolete isolation protocol: stop every signal, close every route, keep everyone “safe.” Its actions strand the very community it protects. It is not secretly evil and cannot be repaired simply by shooting it.

Five recovered network functions supply the dramatic spine: **listen → shelter → cooperate → reconnect → trust**. AURORA is a courier starship: each stage-ending flight carries repair data between districts, explaining why it launches repeatedly while KAI stays on the island. The festival is the payoff for a restored community, not an arbitrary rocket score screen.

## Fifteen-stage campaign

| District / chapter | Stage 1: teach | Stage 2: complicate | Stage 3: payoff |
| --- | --- | --- | --- |
| Breakwater Marina | Wake BOLT through a safe cell-recovery lesson | Rotate actual relay outputs; follow the visible powered beam | Reboot the patrol and restore public communications |
| Tidal Gardens | Learn to carry friends into shelter | Choose between two shelters while reading surge routes | Rescue a smaller, authored group and shut down the isolation beacon |
| Salvage Commons | Prepare a defense without a timer | Cover three approaches with a supported firing line | Defeat the Captain's charge protocol; recover the Warden's order log |
| Windward Causeway | Follow a designed serpentine gate route | Recover scattered courier cargo on a different route | Survive a storm crossing, with a readable safe route and optional clean-run challenge |
| LUMA Watch | Restore the backup network under patrol pressure | Route all recovered functions into the lighthouse receiver | Defend the core, checkpoint, expose the Warden, install its repaired protocol, then launch the festival signal |

## Shipped scope for this pass

1. Rewrite stage setup, character-specific radio lines and stage consequences. Give every stage a location, a narrative question and a concrete payoff. Show completed memories in a spoiler-safe journal.
2. Replace both sequence-copying missions with spatial relay puzzles: quarter-turn outputs, visible power propagation, recoverable mistakes, no forced activation order.
3. Author chapter scenery and route layouts using the existing Blender asset library. Keep important paths clear and keep environment ownership within the current mission lifecycle.
4. Add two-shelter rescue choices and authored gate positions; avoid replacing interesting decisions with bigger counts.
5. Make Story mode the default: no mandatory campaign deadline, with visible elapsed time and optional par-time medals. Retain Challenge mode and independently timed arcade/expedition play.
6. Add a persistent checkpoint before the Warden. Retry/reload restores encounter state and core integrity; refill the player's shield and starter weapon consistently. Never award completion for reaching a checkpoint.
7. Require a free, explicit repair interaction after the Warden fight before the finale launch can succeed.
8. Add readable briefing plans, correct speaker attribution, manual radio advance, stage-specific departure messages and chapter consequences on the map.

## Logic review before implementation

- Keep stage IDs stable: old completions, paint, gear and unlocks remain valid.
- Puzzle power depends on current geometry/orientation, not interaction history. Unpowered relays may be rotated. A receiver must actually receive power to win.
- A pulse turns only the nearest relay, avoiding accidental multi-turns where ranges overlap. E / Use performs the same action at close range.
- Either rescue shelter accepts a carried friend exactly once; guidance selects the nearest. Minimap shows both safe destinations.
- Story mode removes only the deadline, not shield failure, boss rules or core damage. Challenges stay optional; hidden time limits must not survive in victory validation.
- Checkpoints validate stage, mode, bounds and prerequisite completion. They preserve damage/core history so retries cannot manufacture a perfect medal. Mode changes cannot reuse an incompatible checkpoint.
- The Warden repair is free and cannot require consumable scrap. All reinforcements must be gone before repair is offered.
- Stage setup, pause, restart, defeat, win, replay and reload must cancel stale UI state. Story journal reveals only completed-stage outcomes.
- Reuse compact Blender models; batch low-cost scenery; dispose chapter-specific geometry/materials during scene changes.

## Verification and remaining production work

Automate all fifteen action paths, wrong puzzle turns, alternate shelters, both clock modes, checkpoint migration/reload, final repair ordering and resource stability. Inspect desktop/portrait briefing, map, journal, district scenes and finale. Build and run the live browser suite after release.

AAA readiness remains an external production gate: first-time-player observation, representative hardware profiling, bespoke character animation, authored audio/music, cinematics, terrain art and accessibility testing. Proposed playtest targets: 4/5 players find the next action without coaching; all can explain the relay and boss rules; no repeated unfair-death reports. These are targets, not achieved measurements.

## Review and delivery results

Implemented the story bible, authored stage overrides, five Blender-library district compositions, spatial relay puzzles, alternate shelters, causeway layouts, Story / Challenge modes, checkpointed finale, explicit free Warden repair and journal / briefing / departure UI.

Review fixes:

- Removed duplicate legacy story and dialogue from the gameplay catalog, so authored narrative has one source of truth.
- Replaced the remaining deadline language in Story mode and made the free repair part of the finale objective.
- Kept core integrity and damage history in the checkpoint. Reload does not upgrade a damaged run into a perfect one. Encounter retries reset temporary combat objects and pickups, while persistent equipment remains equipped; they are not arbitrary mid-fight snapshots.
- Moved added tall scenery away from the foreground after a screenshot exposed KAI being hidden behind a palm.
- Strengthened powered beams and offset relay arrows beyond their beacon heads.
- Kept the mission launch footer visible while phone briefings scroll. Preserved Enter / Space activation for focused radio controls.

Verification before release:

- `npm test`: 64 passing tests, including all fifteen objective action paths.
- `npm run test:smoke`: passed campaign, combat, expeditions, workshop, input, saved departures, fallback loading and repeated-scene resource checks. Restart and combat cycles stayed at 173 geometries / 11 textures; expedition and victory cycles also remained stable.
- `npm run test:story`: passed on both the development server and production preview. Verified all five districts, both modes, native keyboard radio controls, relay actions, journal filtering, checkpoint reload, free Warden repair and saved finale. Desktop and portrait screenshots are in `test-results/story-production`.
- The five district samples used 150–237 draw calls and at most 166,918 rendered triangles. These are checked scenes, not a universal maximum or an FPS claim.
- `npm run build`: passed without size warnings. The 131 kB application entry and 622 kB Three.js vendor chunk are separate, allowing the engine to stay cached across narrative updates (approximately 44 kB and 157 kB gzip).
- `git diff --check`: clean. Existing 25 Blender exports are reused unchanged.

Release procedure: fast-forward the reviewed branch into the existing clean `main`, push the public repository through its configured SSH remote, wait for the Pages workflow, then run both browser suites against the public URL. A successful push alone is not deployment verification.

## Roadmap beyond this release: production gates, not labels

### Gate 1 — prove a ten-minute vertical slice

Use Breakwater Marina as the benchmark. The opening must teach move / pulse with BOLT, then demand spatial reasoning at the relays, then combine combat and repair at the beacon. Keep every story interruption skippable; never require a player to remember dialogue to understand a critical action. Observe at least five first-time players on keyboard and touch. Record where each stops, takes damage without understanding why, or asks what to do. Revise the layout before making more scenery.

Acceptance targets: at least four players finish without coaching, understand the beam rule, identify friend / hostile / pickup by silhouette, and describe why they are reopening the network. These measurements have not been gathered yet.

### Gate 2 — bespoke district art and encounter spaces

- **Marina:** build a harbor quay kit, repair shack, cable trench, battery dock and crane. Introduce small adjacent spaces through open sightlines, not unexplained teleportation.
- **Gardens:** create tidal terraces with explicit ramps, two visibly raised shelters, tide channels and readable hazard crossings. A future terrain system must align meshes, collision and navigation before height becomes gameplay.
- **Commons:** replace decorative salvage stacks with a workshop courtyard, three visually distinct approaches, breakable cover and a Captain arena. Preview enemy lanes before each wave.
- **Causeway:** build connected pier modules, supports, cargo anchors and wind gates. Establish edge protection and recoverable fall behavior before introducing jumps or moving platforms.
- **Watch:** author a lighthouse service yard, relay hall and repair court. Stage the Warden reveal with a clear entrance, protected retry point and readable charge lanes. Show the reopened districts in the festival epilogue.

Blender deliverables per kit: source collection, metric scale, named pivots, collision proxy, UVs, consistent texel density and near / far variants. Bake high-detail forms into bounded PBR maps; do not ship sculpt-resolution meshes. Validate exports for missing textures, nonuniform transforms and transparent-material cost. The current release reuses existing Blender assets; these bespoke kits are future work, not claimed completed assets.

### Gate 3 — character performance and combat depth

Author KAI anticipation / recoil / carry / install-repair animations, BOLT run / sniff / shake / assist cycles, distinct dog pounce and drone dive silhouettes, and a Warden repair performance. Maintain the visible telegraph → commitment → recovery rule. Add enemy combinations only when each attack remains readable without a crowded HUD. Prototype cover, enemy flanks and an octopus ink / freeze / repair combo in one arena before spreading them across the campaign.

The Warden's emotional turn needs an acted exchange, not just an outcome paragraph. Commission voice performances and localized subtitles with timing, speaker attribution and replay. Compose district ambience and music that reacts to patrol pressure, recovery and the finale; retain independent volume controls and a silent-play path.

### Gate 4 — production-wide validation

Profile representative integrated-GPU laptops, desktop GPUs and actual phones; software-renderer automation is not a performance benchmark. Target stable frame pacing before raising art density. The present automated guardrails are 450 draw calls / 400,000 rendered triangles in checked campaign scenes, bounded reusable effects and no growth after mission/replay cycles. Set measured per-device frame and memory budgets during profiling rather than claiming an unmeasured FPS.

Add gamepad support, remappable controls, configurable text size, non-color relay cues, subtitle background options and screen-reader-accessible menus. Test save migration, disabled storage, interrupted loads, offline recovery, device rotation, long sessions and every retry boundary. Keep combat accessibility options separate from competitive scores if difficulty is expanded.

Only call the game production-ready after observed playtests, art / animation / sound review, hardware profiling and full release QA meet agreed acceptance criteria. Full AAA production quality remains a larger multidisciplinary effort; this release establishes a more coherent playable foundation.
