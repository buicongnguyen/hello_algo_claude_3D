# Reef Expeditions: stages, robot customization and navigation

## Goal

Turn the single-arena combat update into a small replayable expedition collection. Each new stage needs a different action loop, a recognizable Blender-authored setting, friendly sea life and useful equipment to discover. Preserve the existing campaign and Beach Brawl.

## Three playable scenarios

| Stage | Setting | Required actions | Discoveries |
| --- | --- | --- | --- |
| Coral Cove Rescue | Pink branching coral, turquoise tide pools, a reef arch | Fight patrols, carry three stranded creatures to a sanctuary, activate the exit | Turbo OS disc, Prism Armor; octopus and starfish |
| Neon Scrap Safari | Violet ground, bright modular salvage towers and glowing machinery | Recover three software discs while defeating a finite patrol; activate the uplink | All three software choices, Twin Thrusters; clam repair station |
| Moonpool Parade | Blue moonlight, luminous mushrooms and shell clusters | Stay near a giant snail to escort it through three checkpoints; defeat finite attackers; signal the finish | Frost OS, Halo Antenna; snail, octopus and clam |

All three are available from a new Expeditions menu. They have independent best scores and completion badges, not campaign unlock side effects. No endless enemy spawning or objectives hidden behind random drops.

## Equipment and color

- Six free paint schemes make the robot immediately more colorful.
- One software slot: Turbo OS (+12% movement), Overclock OS (18% faster weapon recharge), Frost OS (one starting Freeze Pop).
- Three independent physical slots: Prism Armor (+1 maximum shield), Twin Thrusters (20% shorter dash recharge), Halo Antenna (+0.5 pulse radius).
- Pickups unlock and automatically install their item, with a visible model change for physical parts. A workshop allows equipping/unequipping owned items and previewing paint and attachments on the actual 3D robot.
- Unlocks persist when picked up, even if a run fails. Repeat pickups cannot stack stats, manufacture shield refills or duplicate parts. Existing saves migrate to empty equipment ownership and a default cyan finish.
- Software choices replace each other rather than multiplying indefinitely. Equipment is earned by exploration, not by purchases or arbitrary menus.

## Animals with purpose

- Octopus: rescued friend and expedition helper; slows nearby hostile robots with an ink effect.
- Starfish: rescued friend; a bright, distinct silhouette.
- Snail: slow escort target that waits when the player strays too far or enemies crowd it; no off-screen automatic failure.
- Clam: clearly marked repair station with a finite cooldown; heals only when a shield is missing.
- Existing crab summons and repaired robot teammates remain available.

## World and minimap

Blender generates four animal models, three modular scenery kits, a software disc and three robot attachments. Three.js places these authored assets, changes sky/ground/light colors by stage, and resets the world when leaving a scenario. Scenery avoids mandatory pickup and escort routes. Keep silhouettes low and fighting areas open.

The small map shows the entire island, the player's heading, hostile robots, active pickups, friends, landmarks and the current objective. Its orientation matches camera-relative controls. It updates with the existing 10 Hz HUD budget, not a second 3D renderer. An accessible legend explains marker colors and shapes.

## Logic review before release

1. Each objective has a finite, reachable completion condition and explicit feedback.
2. Rescue interaction wins priority over repairing a nearby robot when carrying a friend.
3. Escort cannot complete while attackers remain; it waits rather than silently failing when abandoned.
4. Upgrade stats are recomputed from baseline; repeated equip, pickup or restart cannot stack bonuses.
5. Only owned items can be equipped; unknown saved IDs are discarded.
6. Additions do not modify campaign completion or the old Brawl score.
7. All unique scenery, equipment, labels and helper effects are released on restart; cached Blender geometry stays shared.
8. Minimap markers use logical world positions and exclude disabled enemies and collected loot.
9. Touch controls, minimap and mission HUD must remain visible without overlapping controls on portrait and short landscape screens.

## Execution and verification

1. Implement data catalogs and normalized persistent equipment.
2. Build/export Blender models and add stage theming and the workshop preview.
3. Implement rescue, salvage and escort controllers with equipment discoveries.
4. Integrate HUD, expedition menu, workshop and minimap.
5. Add deterministic action-path, migration, equipment, map and lifecycle tests; retain the fifteen-stage and three-wave regression suites.
6. Build and visually inspect desktop and phone captures; exercise actual keyboard/touch controls in browser smoke tests.
7. Review/fix results, commit the exact tested source, push via the existing Git SSH remote, verify Pages deployment and test the public URL.

## Scope limits

Three additional handcrafted scenarios, not a procedural open world. Animals use lightweight scripted movement and interactions, not a full ecology simulation. No multiplayer, purchases, realistic violence or external asset services. Hardware frame-rate claims require real-device measurements; enforce resource limits and restart stability instead.

## Implemented review findings

- Required rescue, salvage and escort actions have priority over optional repairs and loot hints; an empty weapon still guides players to ammunition when they are not carrying a friend.
- The exit checks both the scenario task and the finite patrol count. Entering a stage does not award a completion or any equipment.
- NORI follows three fixed checkpoints at 1.45 units/second, waits beyond 6 units from KAI, and waits when a hostile is within 3.5 units. The snail is never damaged off screen.
- A clam only consumes its 16-second repair cooldown when it actually restores a missing shield. Octopus ink slows nearby hostiles for 4 seconds with an 8-second cooldown.
- Each expedition caps live hostiles at 6. Existing limits of 6 repairable bodies, 3 recruited robots, 3 summoned crabs, 18 combat pickups and 28 projectiles/beams remain in effect. Scenery uses eight rim modules per stage, outside objective routes.
- The phone mission counter now has a full-width row so long task descriptions cannot wrap behind equipment controls. The portrait workshop camera leaves room for the head and the scrolling loadout panel. Single-digit world labels use compact textures with large glyphs.
- Selecting a backpack in the workshop turns the preview to show the back; other slots return to a front view.
- Browser restart checks include all three themed scenes and the workshop. Repeated cycles retain the same GPU geometry and texture counts after cleanup.

## Local verification results

- 34 automated tests passed, including completion paths for all fifteen original campaign stages, all Brawl waves, and each expedition.
- Production build passed. The runtime has no additional package dependencies.
- Blender exported 24 models in total, including the twelve new animals, scenery modules and equipment assets. The editable source scene is included.
- Browser tests verified real model loading, keyboard and touch firing, software/part pickup, visible armor attachment, paint changes, unequipping, reload persistence, phone minimap/control separation and all three scenario setups.
- Repeated expedition/workshop cycles returned to 222 cached geometries and 3 textures after cleanup, with no increase between cycles. This is a resource-stability check, not a hardware frame-rate benchmark.
- Desktop, portrait and short-landscape captures were inspected; phone counter and preview framing issues were corrected before publishing.
