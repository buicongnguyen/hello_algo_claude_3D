# Robot Beach 3D: Signalbreak

A standalone Blender + Three.js successor to Robot Beach Adventures. Explore one connected low-poly island as KAI, recover five Aurora fragments, rescue beach friends, build defenses, race the skyway and relight the lighthouse.

[Play Signalbreak](https://buicongnguyen.github.io/hello_algo_claude_3D/) · [Design reassessment and production roadmap](./DESIGN_REVIEW.md)

This is a playable browser-game foundation, with a documented roadmap toward a much higher production standard. It is not a finished AAA-scale game.

## Features

- Five story chapters and fifteen missions.
- One consistent control scheme across collection, signal puzzles, rescue, defense, racing and boss encounters.
- Blender-authored GLB characters and landmarks with procedural fallbacks.
- Persistent campaign progress, medals and chapter upgrades.
- Keyboard and touch controls, reduced motion and adaptive quality.
- Responsive UI designed for desktop and mobile.
- Camera-relative movement, target compass, numbered world labels and persistent chapter upgrades on replay.
- BOLT companion following, a visible rocket-launch ending and unlocked free roam.

## Controls

- `WASD` or arrows — move
- `Q` or Space — pulse
- `Shift` — dash
- `E` or Enter — interact
- `Escape` — pause

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
