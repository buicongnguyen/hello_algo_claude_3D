# Robot Beach 3D: Signalbreak

A standalone Blender + Three.js successor to Robot Beach Adventures. KAI and BOLT find an unfinished atlas and leave Meridian City on a journey through the countryside, coast, deep ocean, open sea, sky, orbit and Moon—then return to Earth to share their discoveries.

[Play Signalbreak](https://buicongnguyen.github.io/hello_algo_claude_3D/) · [Discovery journey plan and logic review](./DISCOVERY_JOURNEY_PLAN.md) · [Long-term production roadmap](./DESIGN_REVIEW.md)

This is a playable browser-game foundation, with a documented roadmap toward a much higher production standard. It is not a finished AAA-scale game.

## Features

- Fifteen unique Blender environments, grouped into five chapters of three stages. Each destination has its own story, discovery and one primary activity.
- Spatial relay puzzles, reef rescues, artifact scanning, prebuilt-turret defense, a research-buoy escort, aerial duel, flight routes and a museum homecoming.
- Story mode removes campaign deadlines; Challenge mode keeps timed missions. Shield damage and boss rules matter in both modes.
- Character-attributed radio with manual Next / Skip, an ordered itinerary, exact-location briefings and a spoiler-safe discovery atlas. Departures show the discovery and next destination.
- Dive bubbles, sea-skimmers and temporary flight equipment distinguish travel without changing permanent inventory. Navigation uses a 3D scene with camera-relative planar controls, not six-axis swimming or flight simulation.
- Previous campaign medals are archived separately on the first upgrade. Paint, equipment, expedition scores and arcade best are preserved. The obsolete Warden checkpoint is retired.
- **Reef Expeditions:** Coral Cove Rescue, Neon Scrap Safari and Moonpool Parade—three open stages with rescue, software salvage and snail escort objectives.
- **Robot Workshop:** six paint schemes, three software programs and three Blender-modeled attachments. Discoveries persist through retries and browser reloads.
- Octopus ink helpers, starfish friends, NORI the escort snail and clam shield-repair stations.
- A camera-aligned survey radar showing KAI, enemies, loot, friends and the current objective.
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
- Hold `J` or the left mouse button on the game canvas — fire your equipped weapon (auto-aim)
- `Q` — unlimited close-range pulse, including when ammunition is empty
- `F` — use a Freeze Pop
- `R` — summon the crab crew with a Crab Whistle
- `Space` or `Shift` — dash / boost (press once; respects the dash cooldown)
- `E` or Enter — interact / repair a nearby downed robot for 2 scrap (maximum 3 robot teammates)
- `Escape` — pause

Space is deliberately a movement action, not another Use key or a fire button. Dash/boost works in every stage, including underwater and flight; jumping is not implemented because navigation and objectives currently use a fixed-height play plane. E remains the contextual action for scanning, carrying, relay rotation and repairs. While a visible menu or radio button has focus, Space / Enter activate that button without also triggering gameplay.

Walk over glowing items to pick them up. Touch players have a movement stick and labeled Fire, Pulse, Dash, Use, Freeze and Call buttons. Start with **Beach Brawl · Play now** for immediate fighting, or **Begin journey** for the story campaign.

In relay stages, `Q` / Pulse or `E` / Use rotates the nearest relay clockwise. Follow the cyan beam to the receiver; gray outputs are unpowered. You can set downstream relays first. Either green refuge accepts a carried reef friend. Scan gold-marked artifacts with `E` / Use. Stay within six metres of the research buoy; it waits if you fall behind. At the final museum terminal, use `E` to share the atlas.

Choose Story or Challenge in a campaign briefing. Both retain optional medals; Story's elapsed clock does not expire the mission. Arcade and expeditions keep their own limits. Completing the primary activity saves the stage immediately, before the skippable AURORA departure.

## Development and verification

Run `npm ci`, `npm test`, `npm run build`. Browser checks require installed Edge or Chrome: `npm run test:smoke` checks gameplay, fallback loading and restart resource stability; `npm run test:story` checks all fifteen environments, mobile layouts, new activities, story UI and save migration.

Set `BLENDER_BIN` to a Blender executable and run `npm run assets:journey` to regenerate the fifteen environment GLBs and two geology props. Their editable collections are in `assets/blender/discovery_environments.blend`; unhide the desired `ENV_*` collection. Static geometry is batched by material and the journey asset set is kept below 6 MB. `npm run assets:blender` rebuilds both original actors and journey assets.

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
