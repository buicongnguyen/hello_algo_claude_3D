# Robot Beach: design reassessment and quality roadmap

This review is based on the original 2D source (`game/data.js`, `game/game.js`, `game/logic.js` in the original repository), the first 3D implementation, and the revised 3D release. It distinguishes design judgments from verified defects. "AAA" is a production-quality aspiration, not a claim about this release's scope or finish.

## 1. What the original game gets right

The beach, friendly machines, animal cast and launch celebration make a recognizable world. Short sessions and a forgiving tone are good foundations. Rescuing a small creature, repairing a large machine and watching the rocket launch can share a satisfying theme: small acts restore a community.

The game should keep that identity. Photorealism, a huge empty map and realistic violence would not make this particular game better. A polished, expressive toy-like island is the stronger direction.

## 2. Problems supported by the 2D code

| Finding | Evidence | Player consequence | Redesign decision |
| --- | --- | --- | --- |
| The first lesson tests speed before understanding | All three launch stages have a 20-second timer; the final sequence grows to eight actions | Reading and locating objects consume the same clock as mastery | Start with an 85-second hands-on collection task; no countdown during defense preparation |
| Clue games often tell the answer directly | `objective` lists the same ordered IDs as `sequence`; `advanceSequence` only checks equality | Following instructions is presented as discovery; alternate sensible actions are rejected | Present these honestly as guided signal-routing lessons; visible numbered nodes and a route reinforce cause and effect |
| Wrong actions teach little | `handleSequenceAction` deducts two seconds and says the action was wrong | Failure supplies no explanation of the missing dependency | Explain which circuit node is unpowered; preserve completed links and avoid arbitrary time deductions |
| Difficulty often means more/faster objects | Chase goes from four to eight targets; relay from three to six deliveries; rescue from four to eight animals | Missions stretch repetition rather than add decisions | Add moving hazards, armored multi-hit scouts, a shielded charge boss, and a finale combining core defense with boss windows |
| Chapter order has no narrative dependency | `isStageUnlocked` opens stage one of every chapter | The finale can arrive before its setup; characters do not develop through action | Unlock story stages in order, preserve replay, and award persistent chapter abilities |
| Nine action types use several control interpretations | Sequence/defense are click-led; chase, kick, fetch, relay and slalom have distinct action meanings | Players repeatedly learn interfaces instead of learning a world | Four stable verbs throughout: move, pulse, dash, use |
| Completion chiefly changes a score record | `recordCompletion` stores completion and best score | Success has little visible effect on the world | BOLT wakes and follows; the lighthouse beam gains strength; the rocket visibly launches; free roam unlocks |

These are source-based design findings. They do not establish player enjoyment or an accessibility rating; that requires observed playtesting.

## 3. The revised game promise

**You are KAI, a little service robot trying to bring your beach community back together before the festival.** BOLT is your companion. LUMA is the lighthouse guide. The Rust Warden is a broken caretaker whose storm protocol treats shared energy as a danger. Its behavior creates the crisis; restoring its logic resolves the story.

The repeatable loop is: see a problem → choose a route → use a familiar tool → observe a clear result → earn a useful ability → revisit the world with more capability.

Five chapters remain, with three missions each. The first stage introduces a rule, the second combines it with pressure, and the third pays off the chapter. Chapters one and five include guided circuit tasks. They are intentionally simple in this release; they are not advertised as deep puzzle systems.

## 4. Release changes implemented after review

- Fixed the last rescue stage's unreachable final-beacon action. Its prompt and interaction now agree.
- Replaced world-axis movement with camera-relative movement. Dash commits to the last movement direction and works from a standstill.
- Added visible numbered signal/gate labels and a directional compass naming the current target, required verb and distance.
- Prevented walking through the lighthouse, rocket and palm trunks; moved obstructing cliff scenery away from mission targets.
- Added Blender pivot hierarchies and runtime walk cycles for KAI and Rust scouts. BOLT follows after its dock is repaired.
- Made upgrades depend on completed chapter finales, including an actual fourth shield. Replaying an early mission preserves earned tools.
- Gave defense explicit approach lines, symmetric pads, untimed preparation and a separate ready action. Later scouts need more hits and arrive faster.
- Preserved non-lethal reboots, charged-boss warnings and cyan vulnerability windows. The Warden summons limited reinforcements that threaten the core.
- Fixed collection counters, defense failure handling, expiration ordering, stuck touch input and paused input queues.
- Added a five-second rocket-launch payoff and unlocked a quiet free-roam mode after the campaign.
- Kept shield state visible on phones. Separated touch controls, navigation, prompts and dialogue; made short-screen dialogs scrollable.
- Added optional synthesized audio cues with no audio downloads.
- Pooled up to 24 pulse effects, disposed unique mission GPU resources, preserved cached GLB resources, instanced shoreline stones and reduced HUD updates to 10 Hz.
- Added tests for all 15 objective completion paths, important failure paths, upgrade persistence, control direction and resource disposal.

## 5. What a much higher production standard still requires

This release is a playable browser-game foundation. A AAA-level result would need substantial additional authored content, animation, audio and player testing. The following is a production backlog, not a list of shipped features.

### Milestone A — prove one excellent 10-minute chapter

1. Build a shoreline route with three distinct landmarks, safe camera corridors, optional shortcuts and return paths unlocked by rescue actions.
2. Replace instruction-copying puzzles with inspectable machinery: a lens changes beam direction, a reflector extends range, a relay requires a visible connection. Allow a player to understand failure without reading an answer list.
3. Give BOLT one player-commanded ability (mark a scent trail or hold a floor switch), taught through a low-risk encounter.
4. Author a signature enemy with three readable poses: intent, attack, recovery. Damage and immunity must match those poses exactly.
5. Add anticipation, contact, recoil, foot planting, hand interaction and recovery animations; compare motion at 30/60/120 FPS.
6. Observe at least five first-time players without coaching. Record where they stop, what they think the next action is, and why they fail. Fix the repeated misunderstandings before adding another chapter.

Acceptance targets: four of five players identify the first objective without help; all can explain how the boss becomes vulnerable; most finish the chapter in 8–15 minutes; no repeated reports of unclear damage or camera-obscured targets. These are future test targets, not measured results.

### Milestone B — deepen the campaign

- Give each chapter a distinct island area and an environmental consequence: restored tide gates, returning wildlife, reopened boardwalks, lit skyway, festival harbor.
- Rescue design: offer two routes with different travel/risk tradeoffs, readable surge timing, shelter checkpoints and a recoverable stumble rather than instant irreversible animal loss.
- Defense design: introduce clearly differentiated turret roles and a limited energy budget. Let players reposition before waves and inspect range. Avoid secretly changing identical-looking towers.
- Traversal design: momentum routes, generous gate volumes, optional risky shortcuts and an optional best-time ghost. Keep required story medals achievable without speedrunning.
- Finale design: combine two learned skills, then change one rule in a visible way. Add a checkpoint before the Warden and replayable cinematic controls.
- Write character-specific dialogue and quiet companionship moments. Explain the Warden's flawed protective reasoning before its defeat.

Acceptance targets: each mission introduces a new decision, a new combination or a story payoff; no chapter is just the previous chapter with bigger counts; every required rule is taught before it is tested under pressure.

### Milestone C — art, animation and audio production

- Commission an original silhouette/color bible, three scale sheets and material examples. Keep player, interactable and danger silhouettes distinct in grayscale.
- Replace generated placeholders with reviewed Blender models: clean pivots, sensible topology, rigged hands/feet, animation clips, collision proxies and LODs.
- Author terrain, coastal vegetation, waves, sky traffic and creature behavior. Restore the original banner's varied wildlife as purposeful scenery or characters; do not scatter every object into combat lanes.
- Add authored animation transitions and expressive companion reactions. Current procedural walk cycles are a first pass, not motion-capture-quality character animation.
- Produce spatial ambience, readable ability sounds, music layers and a finale theme. Include independent volume controls, subtitles and non-audio danger cues.
- Add restrained color grading and effects only after frame-time measurements justify their cost. Low settings retain every gameplay cue.

### Milestone D — reliability and release quality

- Playtest the complete campaign on representative low-end phones and integrated-GPU laptops. Measure CPU/GPU frame times, input latency, memory and thermal behavior over 20-minute runs.
- Target 60 FPS desktop and 30 FPS mobile, using measured device profiles; current automated software-rendered checks cannot certify those targets.
- Test controller support, remapping, scalable text, reduced flash, focus navigation and color-vision accessibility.
- Add save migration, recovery from WebGL context loss and resumable chapter checkpoints.
- Run full mission replays, failure/retry/reload scenarios and browser-specific tests in CI.

## 6. Scope and release honesty

Implemented now: one shared low-poly island, five chapters, 15 stages, guided circuits, rescues, turrets, races, two boss encounters, persistent upgrades, companion following, touch controls and an ending.

Not implemented now: open-world chapter zones, systemic beam puzzles, terrain pathfinding, cinematics with voiced actors, skinned hero animation, gamepad support, authored music, network multiplayer or a physically simulated tide. The tide ring is a visual countdown; moving red surge rings are the collision hazards.

The important next investment is a playtested vertical slice with authored encounters, not an unsupported claim that this small release already matches a large-studio game.
