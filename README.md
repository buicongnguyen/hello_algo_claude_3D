# Robot Beach 3D: Signalbreak

A standalone Blender + Three.js successor to Robot Beach Adventures. Explore one connected low-poly island as KAI, recover five Aurora fragments, rescue beach friends, build defenses, race the skyway and relight the lighthouse.

## Features

- Five story chapters and fifteen missions.
- One consistent control scheme across collection, signal puzzles, rescue, defense, racing and boss encounters.
- Blender-authored GLB characters and landmarks with procedural fallbacks.
- Persistent campaign progress, medals and chapter upgrades.
- Keyboard and touch controls, reduced motion and adaptive quality.
- Responsive UI designed for desktop and mobile.

## Controls

- `WASD` or arrows — move
- `Q` or Space — pulse
- `Shift` — dash
- `E` or Enter — interact
- `Escape` — pause

## Development

```powershell
npm install
npm run assets:blender
npm run dev
```

The Blender asset generator expects the local Blender 4.5.3 LTS executable recorded in `package.json`. To use another Blender installation, run it directly:

```powershell
& "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" --background --python tools/blender/build_assets.py
```

## Verification

```powershell
npm test
npm run build
npm run test:smoke
```

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for the design evaluation, campaign structure, Blender pipeline, architecture, testing strategy and definition of done.
