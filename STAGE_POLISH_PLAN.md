# Stage polish: readable heroes, rewarding victories, purposeful play

## 1. Evaluation

The existing game has a functional 15-stage campaign, a three-wave arcade mode and three expeditions. Its strengths are accessible auto-aim, repairable enemies, colorful sea creatures, saved equipment and a small map. Keep those systems and every existing object/stage.

The main weaknesses found in the implementation are:

1. **Character identity:** BOLT's torso is 1.44 units wide but only 0.66 units long, with short straight legs. That reads as a squat box, not a dog. KAI's chest, head, shoulder pads and equipment compete for attention.
2. **Movement readability:** quadruped legs use the biped left/right swing rule. BOLT's follow behavior does not animate its legs. A rushing dog/drone can turn to face a moving player even though its attack continues along a previously committed direction.
3. **Weak endings:** only the campaign finale launches a rocket. Other victories jump to a generic popup, with little connection between the player's actions, the story and the reward.
4. **Misleading results:** campaign replays show stored best medals instead of medals earned in the current attempt. Arcade failure sends the player to the story map.
5. **Limited reasons to experiment:** gadgets and recruited teammates exist, but most missions do not explicitly encourage their use. Players need an optional goal, not more mandatory grinding.
6. **3D correctness and maintenance:** the boss can step past its charge destination; failed or stale model loads silently fall back to generic capsules. Updated GLBs need content-versioned URLs so returning players receive the new models.

This is an achievable browser-game polish pass, not a claim of AAA production quality. Larger terrain, branching story, bespoke enemy bosses and fully rigged animation would be separate future milestones.

## 2. Design decisions

### KAI: a concise explorer silhouette

- Narrow the torso and depth, slightly reduce the head, bring shoulders inward.
- Retain the recognizable visor, two eyes, antenna, articulated limbs and paint choices.
- Match armor, shoulder plates and backpack dimensions to the new torso. Never double-scale attachments.
- Keep the gameplay camera and compact model scale introduced previously.
- Keep contrast and a few deliberate vents/panels; do not add decorative geometry everywhere.

### BOLT and hostile dogs: recognizable quadrupeds

- Build a body longer front-to-back than side-to-side, with a chest, raised neck and projecting muzzle.
- Lengthen the legs and place front/rear pairs under the body rather than at its sides.
- Add paws, distinct ears, nose, collar, flank panels and a tail pivot.
- Friendly BOLT has cyan accents and a wagging tail; hostile dogs keep orange warning accents and pointed ears.
- Animate diagonal leg pairs in a trot. Keep the body grounded; do not simulate expensive skeletal physics.
- Animate BOLT while following. Preserve the warning → committed lunge → recovery attack pattern.

### Every victory: the AURORA starship departure

1. Finish the objective and validate the terminal outcome.
2. Freeze combat, the mission clock, hazards and held input immediately.
3. Calculate the current-run report and save progression exactly once, before animation.
4. Show a short congratulations overlay and a new Blender-built starship, with KAI and BOLT watching from the island.
5. Run a roughly four-second engine ignition and upward departure. Reuse simple meshes; no large particle system or new media downloads.
6. Show the stage-specific report, current medals/score, best result and optional challenge outcome.
7. Offer Next mission where applicable, Replay, or the appropriate map/expedition/arcade destination.

The presentation is skippable using a keyboard-focusable button. Reduced motion uses a restrained camera and smaller departure motion, without flashing. Failure shows retry guidance immediately and never launches the starship. Restart/exit cancels any pending report and clears cinematic objects. No timer callbacks may reopen an old result over a new mission.

The original festival rocket stays in the world; the final mission's launch objective now leads into the same completed-and-saved victory flow instead of a second, special delayed completion path.

### Optional field challenges

Display one concise optional challenge in briefing, pause information and the mission HUD. Completion is never required to pass a stage.

| Mode | Optional challenge | Purpose |
| --- | --- | --- |
| Collection / drifting cells | Finish with at least half the clock remaining | Learn routes and dash use |
| Signal sequence | Make no wrong activations | Reward causal order |
| Combat / arcade | Repair one downed robot into the team | Introduce friendship through repair |
| Rescue / defense / boss | Take no shield damage | Reward careful positioning, not healing exploits |
| Gate race | Finish with at least half the clock remaining | Encourage route mastery |
| Finale | Preserve all five core-integrity points | Keep the protection objective meaningful |
| Coral / Moonpool expeditions | Call the animal crew at least once | Encourage creature assistance |
| Scrap expedition | Successfully freeze at least three distinct enemies | Encourage crowd control |

For campaign stages, this is the clearly explained third medal; completion and the existing speed threshold remain the first two. For expeditions and arcade, a completed challenge gives a 500-point bonus only on victory. Existing best scores/medals are preserved. Counts must measure successful actions, not empty button presses, and freeze credit cannot be farmed repeatedly on one robot.

## 3. Technical implementation

- `tools/blender/build_assets.py`: revise robot/dog builders, attachment alignment, add `starship`, preserve named pivots, export a content hash per GLB. Continue material/rigid-parent batching.
- `src/presentation.js`: keep scale definitions centralized, add deterministic victory timing/flight helpers suitable for unit tests.
- `src/world.js`: load hashed asset URLs, quadruped/tail animation, BOLT follow animation, separate disposable celebration group and aspect-aware cinematic framing.
- `src/mission-report.js`: pure challenge selection/evaluation and run-report formatting. No renderer or save writes.
- `src/game.js`: run metrics, exactly-once victory/report state, correct current-versus-best medals, next-stage navigation, cancelable presentation, boss movement clamp.
- `src/combat.js`: successful call/recruit/freeze metrics and direction-locked attack visuals. Keep existing enemy/projectile/team caps.
- `src/ui.js`, `index.html`, `src/styles.css`: compact challenge readout, congratulations/skip overlay, responsive results and correct menu return paths.
- `src/sound.js`: short optional victory cue using the existing audio system.

## 4. Plan logic review

- **Do not delay earned progress until the movie ends.** Persist first; skipping, tab switching or reloading cannot erase a win.
- **Do not allow a win to turn into a loss mid-celebration.** Gameplay is stopped; only presentation advances.
- **Do not call finish twice.** Preserve the running guard; showing/skipping results does not recalculate or save again.
- **No stale callbacks.** Use an update-driven pending report; clear it in both `begin` and `stop`.
- **No objective gating by optional challenges.** Missing the bonus must still pass and unlock the next stage.
- **No historical medals presented as current.** Calculate the run separately from persistent personal bests.
- **No bonus farming.** Count distinct frozen enemies and actual successful recruitment/calls. Track damage taken rather than final shield count.
- **Model changes must match attachments and combat aim height.** Update the dog's target height and health-label clearance; leave attack ranges generous and unchanged.
- **No missing animated parts through batching.** Keep hip, tail and rotor pivots; all details under each rigid pivot may still share meshes.
- **No asset-cache surprise.** Derive GLB query versions from content, not size alone. Manifest failure must not prevent the fallback game from starting.
- **No expansion of hosting scope.** Reuse `git@github.com:buicongnguyen/hello_algo_claude_3D.git` and its public GitHub Pages workflow, not a new Sites host.

## 5. Verification and release gates

1. Run existing campaign, combat, expedition, persistence and resource tests.
2. Add tests for challenge reachability, duplicate freeze credit, current/best medals, win-once behavior, skip/restart safety, no gameplay during departure, failed stages, boss charge clamp and quadruped phase relationships.
3. Load all 25 real Blender models in a browser. Assert starship and dog pivots/bounds, attachment alignment and hashed model URLs.
4. Capture desktop/portrait/landscape victories, mid-flight ship, dog comparison and Workshop views. Check text does not cover the ship and controls remain usable.
5. Repeat victories/restarts; verify render resources stabilize. Asset budget: under 2 MB total GLBs, under 6,000 triangles and 30 meshes per asset unless explicitly justified and tested.
6. Review the diff for regressions, fix findings, rerun tests/build/smoke.
7. Commit tested source and Blender assets, fast-forward clean main, push over SSH, wait for GitHub Actions, then run smoke checks against the public URL.

## 6. Future improvements (not part of this release)

- A compact hub aboard AURORA with animal passengers reflecting rescued friends.
- Distinct stage layouts with ramps, bridges and height-aware navigation rather than merely changing decoration.
- Enemy teamwork, boss-specific silhouettes and encounters with alternate solutions.
- A save-aware story log, dialogue choices and additional music/animation authored for each chapter.

These require separate collision, camera, navigation and content validation; adding them blindly would undermine the correctness goals of this pass.

## 7. Implementation and post-code logic review

Implemented the scoped release above. No existing stage or object type was removed. The model library now has 25 types, including the AURORA departure ship.

| Review finding | Resolution / verification |
| --- | --- |
| Old finale deferred its save until after a special movie | One shared victory flow saves immediately for all 19 playable stages/modes; repeated finish/skip does not resave |
| A stale skip callback could otherwise reveal a previous result | Callback checks the pending report identity; begin/stop cancel it |
| Replay results mixed current and historical medals | Separate current-run medal calculation and best-medal display; regression test |
| Direct terminal calls could bypass timer/shield precedence | Final outcome guard turns expired/unshielded success requests into failure |
| Repeated freezes could farm the optional bonus | Per-enemy credit flag; only distinct enemies count |
| Healing could mask damage in a clean-run challenge | Track actual damaging hits instead of checking final shields |
| Dog/drone facing could contradict the committed attack line | Windup/rush use the locked attack direction |
| Boss could overshoot and oscillate across its target | Clamp charge travel to remaining distance and enter exposed state on arrival |
| New model proportions left the held weapon offset | Move the weapon inward; real GLB bounds tests validate taller canine proportions |
| A recent pickup sound could suppress the victory cue | Victory bypasses ordinary cue throttling |
| Storage failure could be mislabeled as a durable save | Overlay and report explicitly say session-only progress when local storage fails |
| Old and new GLBs could be mixed by browser caching | Manifest includes SHA-256-derived versions; browser checks require hashed URLs and zero fallback models |
| Cinematic clones might accumulate graphics resources | Repeated victory/skip/restart cycles stabilize at 189 cached geometries and 3 textures |

Local verification: 50 unit tests pass, including all 15 campaign action paths and three expedition objectives; production build passes; browser smoke covers 25 real models, controls, progress, equipment, frame sizing and stage departure. Visual captures cover desktop/portrait/landscape departures and reports, plus close-up robot/dog and Workshop inspection. Entire GLB library: 1,702,664 bytes and 50,108 triangles, with existing combat pool limits unchanged.

Remaining scope is deliberate: terrain remains a flat island with 3D models, not a height-aware platformer; dogs use articulated rigid-part animation rather than skeletal IK; the departure scene uses a compact staged view instead of a full boarding sequence. These are documented future design tasks, not hidden completed features.
