# Robot Beach 3D: Signalbreak

A standalone Blender + Three.js successor to Robot Beach Adventures. Explore one connected low-poly island as KAI, recover five Aurora fragments, rescue beach friends, build defenses, race the skyway and relight the lighthouse.

[Play Signalbreak](https://buicongnguyen.github.io/hello_algo_claude_3D/) · [Design reassessment and production roadmap](./DESIGN_REVIEW.md)

This is a playable browser-game foundation, with a documented roadmap toward a much higher production standard. It is not a finished AAA-scale game.

## Features

- Five story chapters and fifteen missions.
- **Beach Brawl:** an immediately available three-wave zombie robot beach party, independent of campaign unlocks.
- Bubble Blaster and chaining Arc Fork pickups; tiny zombie bots, pouncing robot dogs and diving drones.
- Freeze Pops, a summoned crab crew, and scrap-funded repairs that turn defeated robots into teammates.
- One consistent control scheme across collection, signal puzzles, rescue, defense, racing and boss encounters.
- Blender-authored GLB characters and landmarks with procedural fallbacks.
- Persistent campaign progress, medals and chapter upgrades.
- Keyboard and touch controls, reduced motion and adaptive quality.
- Responsive UI designed for desktop and mobile.
- Camera-relative movement, target compass, numbered world labels and persistent chapter upgrades on replay.
- BOLT companion following, a visible rocket-launch ending and unlocked free roam.

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

See [COMBAT_UPDATE.md](./COMBAT_UPDATE.md) for the combat design, balance rules, resource limits and verification.

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
```

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for the design evaluation, campaign structure, Blender pipeline, architecture, testing strategy and definition of done.
