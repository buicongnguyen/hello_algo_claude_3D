# Robot Beach 3D: Signalbreak

A standalone Blender + Three.js successor to Robot Beach Adventures. Play KAI, a maintenance robot reconnecting five coastal districts after the Warden's obsolete storm protocol locks the community apart. Rescue friends, restore communications and repair the rule behind the blackout.

[Play Signalbreak](https://buicongnguyen.github.io/hello_algo_claude_3D/) · [Design reassessment and production roadmap](./DESIGN_REVIEW.md)

This is a playable browser-game foundation, with a documented roadmap toward a much higher production standard. It is not a finished AAA-scale game.

## Features

- Five authored district palettes and fifteen story missions: Breakwater Marina, Tidal Gardens, Salvage Commons, Windward Causeway and LUMA Watch.
- Spatial relay puzzles with visible power propagation, two-shelter rescue choices and authored causeway routes.
- Story mode removes campaign deadlines; Challenge mode keeps timed missions. Shields, core damage and boss rules matter in both modes.
- Character-attributed radio with manual Next / Skip, actionable briefings, chapter consequences and a spoiler-safe story journal.
- A saved Warden checkpoint preserves core integrity and damage history. The finale requires a nearby, free protocol repair before the festival launch.
- **Reef Expeditions:** Coral Cove Rescue, Neon Scrap Safari and Moonpool Parade—three open stages with rescue, software salvage and snail escort objectives.
- **Robot Workshop:** six paint schemes, three software programs and three Blender-modeled attachments. Discoveries persist through retries and browser reloads.
- Octopus ink helpers, starfish friends, NORI the escort snail and clam shield-repair stations.
- A camera-aligned island minimap showing KAI, enemies, loot, friends, landmarks and the objective.
- **Beach Brawl:** an immediately available three-wave zombie robot beach party, independent of campaign unlocks.
- Bubble Blaster and chaining Arc Fork pickups; tiny zombie bots, pouncing robot dogs and diving drones.
- Freeze Pops, a summoned crab crew, and scrap-funded repairs that turn defeated robots into teammates.
- One consistent control scheme across collection, signal puzzles, rescue, defense, racing and boss encounters.
- Blender-authored GLB characters and landmarks with procedural fallbacks.
- Shaped robot armor, gripper hands, canine hydraulic legs, swept starship wings, curved palm leaflets and fluted seashells. Distinct metal/rubber/glass finishes, outdoor reflections and shared sand/wood/water micro-surfaces.
- Persistent campaign progress, medals and chapter upgrades.
- Keyboard and touch controls, reduced motion and adaptive quality.
- Responsive UI designed for desktop and mobile.
- Camera-relative movement, target compass, numbered world labels and persistent chapter upgrades on replay.
- Slimmer KAI and taller canine robot dogs with articulated diagonal trotting and tail animation.
- A Blender-built AURORA starship takes off after every victory, with a skippable congratulations sequence and current-run results.
- Optional field challenges encourage animal helpers, repairs, clean play and crowd control. Campaign challenges award the third medal; arcade/expedition challenges add 500 points on victory.
- Progress is recorded before departure, current medals are separated from best medals, and story victories can lead directly to the next briefing.
- BOLT companion following, the original festival rocket and unlocked free roam.

## Controls

- `WASD` or arrows — move
- Hold Space, `J`, or the left mouse button on the island — fire your equipped weapon (auto-aim)
- `Q` — unlimited close-range pulse, including when ammunition is empty
- `F` — use a Freeze Pop
- `R` — summon the crab crew with a Crab Whistle
- `Shift` — dash
- `E` or Enter — interact / repair a nearby downed robot for 2 scrap (maximum 3 robot teammates)
- `Escape` — pause

Walk over glowing items to pick them up. Touch players have a movement stick and labeled Fire, Pulse, Dash, Use, Freeze and Call buttons. Start with **Beach Brawl · Play now** for immediate fighting, or **Begin journey** for the story campaign.

In relay stages, `Q` / Pulse or `E` / Use rotates the nearest relay clockwise. Follow the cyan beam to the receiver; gray outputs are unpowered. You can set downstream relays first. On rescue stages with two green shelters, either accepts a carried friend. The final Warden repair uses `E` / Use and costs **no scrap**.

Choose Story or Challenge in a campaign briefing. Both retain optional medals; Story's elapsed clock does not expire the mission. Arcade and expeditions keep their own limits. The Warden checkpoint appears on the title screen after the core-defense wave; it only resumes in the mode where it was saved. Retrying keeps the saved core damage and restores a full shield and Bubble Blaster. Finale victory clears that checkpoint.

Choose **Reef Expeditions · New stages** to discover permanent equipment. Walk over CDs and parts to install them immediately, then use **Robot Workshop** between runs to change paint and choose your loadout. Only one software program is active at a time; physical parts occupy body, back and head slots. The clam repairs one missing shield with `E` / Use every 16 seconds. Stay within 6 m of NORI and clear robots within 3.5 m to keep the snail moving.

The minimap is oriented like your movement controls. White arrow = KAI, red circles = enemies, green diamonds = friends, gold diamonds = loot, star = current objective. Discovery ownership and expedition scores are independent of the original campaign; the campaign Reset button preserves them.

See [COMBAT_UPDATE.md](./COMBAT_UPDATE.md) for the combat design, balance rules, resource limits and verification.
See [EXPEDITIONS_PLAN.md](./EXPEDITIONS_PLAN.md) for the new scenarios, equipment rules, Blender asset plan and logic review.
See [VISUAL_CLARITY.md](./VISUAL_CLARITY.md) for compact model proportions, wider mobile framing, detailed Blender models and rendering safeguards.
See [STAGE_POLISH_PLAN.md](./STAGE_POLISH_PLAN.md) for the game evaluation, detailed implementation plan, logic review and verification of character design, optional challenges and stage endings.
See [ART_DIRECTION.md](./ART_DIRECTION.md) for the crafted-model art pass, realistic-material goals, review fixes and browser asset budgets.
See [STORY_PRODUCTION_PLAN.md](./STORY_PRODUCTION_PLAN.md) for the story bible, fifteen-stage redesign, implemented scope, logic review and remaining AAA production gates.

## Development

```powershell
npm install
npm run dev
```

The exported models are already included; Blender is only needed to regenerate assets. Use Blender 4.5 LTS on your PATH or set `BLENDER_BIN`:

```powershell
$env:BLENDER_BIN = "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
npm run assets:blender
```

## Verification

```powershell
npm test
npm run build
npm run test:smoke
npm run test:story
```

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for the design evaluation, campaign structure, Blender pipeline, architecture, testing strategy and definition of done.
