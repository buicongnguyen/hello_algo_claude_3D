# Signalbreak — a journey of discovery

## Evaluation and design decision

The former campaign changed district palettes but repeatedly placed the player on the same circular beach. Several stages also asked for a collection, a fight and a switch in succession. That made locations feel interchangeable and endings feel arbitrary.

Replace that structure with **one headline activity and one unique environment per stage**. Keep familiar controls and reusable rules, but never repeat a story paragraph, discovery or scene composition. A completed activity finishes the stage automatically; travel happens in the transition, not as another objective.

KAI finds an incomplete exploration atlas in the city. BOLT joins the expedition. Each discovery provides a clue or equipment needed to reach the next destination. The mystery is an old Earth–Moon research network, not fifteen unrelated emergencies. At the end, they return to Earth to share what they learned.

## Route and fifteen stages

| # | Stage / location | One activity | Discovery and reason to travel onward |
|---|---|---|---|
| 1 | City of First Light / dawn city plaza | Recover three atlas batteries | The atlas points to a countryside transmitter |
| 2 | The Windmill Message / rural farm | Route the irrigation transmitter's signal | A coastal survey station answers |
| 3 | Footprints in the Sand / sunset beach | Reboot the damaged beach patrol | A dive log reveals a living reef below |
| 4 | The Breathing Garden / shallow reef | Carry three trapped sea friends to shelter | An octopus identifies an old research wreck |
| 5 | The Sleeping Wreck / submerged ship | Scan three research artifacts | The wreck recorded a light in the abyss |
| 6 | Lanterns of the Deep / volcanic trench | Follow six illuminated dive gates | A thermal current gives a safe route back up |
| 7 | The Floating Observatory / sea platform | Defend the observatory's receiver | Weather data identifies a crossing to the launch buoy |
| 8 | Across the Blue / open-ocean atolls | Escort the research buoy | Its navigation rig enables atmospheric travel |
| 9 | Guardian of the Clouds / storm flight zone | Reboot one charging sky guardian | The guardian opens a safe upper-atmosphere corridor |
| 10 | Above the Weather / golden cloud sea | Fly through seven ascent gates | The final gate leads to an orbital dock |
| 11 | The Quiet Orbit / space station exterior | Recover five drifting navigation cells | A lunar landing chart survives inside them |
| 12 | A World Without Footprints / lunar landing plain | Survey three geological formations | The formations point toward an abandoned crater station |
| 13 | The Far-Side Crater / lunar excavation | Recover three observatory power cells | The observatory can now answer Earth |
| 14 | A Message Across Space / Moon observatory | Align the Earth–Moon relay | The first complete atlas transmission reaches home |
| 15 | Everything We Brought Home / Earth festival square | Deliver the discovery atlas to the museum | The journey ends with a shared exhibition and homecoming |

## Implementation

1. Give each stage its own scene key, title, story, radio exchange, activity label, discovery and destination. Retain the five-chapter / three-stage organization as route segments, not shared backgrounds.
2. Build fifteen compact Blender scene collections and GLB exports: city architecture, barn/windmill/crops, coast, layered coral, ribbed wreck, abyss vents, research pontoon, ocean atolls, storm clouds, high-cloud corridor, orbital docking ring, lunar plain, terraced crater, observatory and festival city. Batch static geometry by material; keep tall scenery behind clear action space. Preserve the existing character assets.
3. Replace the old shared island during campaign play. Underwater scenes have suspended particles and seabed silhouettes; flight scenes have clouds or stars below/behind the actors; lunar scenes have a black sky and Earth above the horizon. Restore the old scenery for arcade, workshop and expeditions.
4. Add scan, escort and homecoming activity handlers. Collection/combat finish at their count, rescue at the last delivery, defense uses prebuilt turrets, races at the last gate, puzzles at receiver connection. No surprise secondary beacon or boss phase.
5. Give underwater, ocean and sky travel visible automatic equipment. Controls stay camera-relative on a navigable 3D plane; this is not a new six-axis flight or swimming simulator. Visual movement never changes collision height or hides an objective.
6. Make the mission map an ordered travel itinerary. Briefing and HUD show the exact location and single activity. Show each discovery and the next destination after completion. Keep the journal spoiler-safe.
7. Preserve paint, equipment, expedition scores and arcade best. Archive old campaign medals separately when migrating to the discovery campaign, so new stories do not appear already completed. Explain this on the title screen. Discard only the obsolete in-flight finale checkpoint; its compound encounter no longer exists in this campaign.

## Logic review and acceptance

- Every scene key and discovery is unique; adjacent activities differ. All required positions are within playable bounds, with no buildings occupying a required route.
- Scan works only near an unscanned target, records it once, and never consumes ammo. Escort waits when KAI is too far away and cannot finish off-screen. A moving beacon is not accidentally collectible loot.
- Required combat cannot depend on ammo: pulse remains unlimited. Boss shields keep their warning/commit/recovery rule. Defense has no hidden build phase.
- One activity completing means exactly one save and one transition. Damage/deadline checks retain precedence; Story mode remains deadline-free.
- Old saves remain recoverable through an archive; migration is idempotent. Replay never installs temporary travel equipment into the permanent inventory.
- Environment geometry is owned by the scene cache; per-run effects are disposed on restart. All fifteen environments have a low draw-call budget and content-versioned URLs, including an offline/procedural fallback.
- Verify all fifteen playable action paths, scan/escort edge cases, save migration, map order, every environment, desktop/phone UI, repeated-scene memory stability and the production build. Inspect actual screenshots, not just palette values.

## Delivery record

Implemented: all fifteen destinations, activities, story consequences, itinerary, journal and save migration. Blender source includes fifteen environment collections and two new geological sample props. Original characters, equipment, Brawl and three expeditions remain available.

Review fixes: automatic collection/combat completion; prebuilt defense setup; nearby, one-time scans; an escort that waits; retired checkpoint UI; stage-appropriate challenge/failure text; safe geology-model fallbacks; distinct storm/high-cloud compositions; visible space scenery; surface detail; and aligned phone itinerary cards.

Verification: 71 automated tests pass, including action-based completion of all fifteen new stages and preserved regression coverage for legacy compound activities. Production build passes. Edge/Chromium browser checks cover all fifteen scenes, new interactions, journal, migration, desktop/phone briefing and ending layouts. The full gameplay smoke test passes, including keyboard input, all 42 Blender models, Workshop, expeditions, Brawl, skippable victories and stable geometry/texture counts across repeated restarts. Render snapshots remained below 260 draw calls and 83,000 triangles per stage at the tested starting views; these are scene budgets, not hardware FPS guarantees.

The additional environment/prop downloads remain below 6 MB. This is a coherent stylized discovery adventure, not a claim of full AAA production quality. More elaborate animation, authored terrain traversal, deeper encounters and six-axis travel remain future production work.
