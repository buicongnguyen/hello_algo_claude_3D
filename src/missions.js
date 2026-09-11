import { DISTRICTS, STAGE_STORY, STAGE_LAYOUTS } from "./story.js";

// Base gameplay settings. Narrative and authored layouts each have one source of truth.
export const CHAPTERS = [
  {
    "id": "signal",
    "number": 1,
    "name": "The Broken Signal",
    "icon": "⚡",
    "color": "#65e5ff",
    "reward": "Wide Pulse",
    "stages": [
      {
        "id": "wake",
        "name": "Wake the Beach",
        "type": "collect",
        "time": 85,
        "count": 3,
        "objective": "Pulse three energy cells, then repair BOLT's dock.",
        "target": "energy cells",
        "positions": [
          {
            "x": -10,
            "z": 5
          },
          {
            "x": 1,
            "z": 10
          },
          {
            "x": 11,
            "z": 2
          }
        ],
        "goal": {
          "x": -3,
          "z": -4
        }
      },
      {
        "id": "trail",
        "name": "Follow the Light",
        "time": 90
      },
      {
        "id": "fragment",
        "name": "First Fragment",
        "type": "combat",
        "time": 95,
        "count": 4,
        "objective": "Disable four Rust scouts and activate the marina beacon.",
        "positions": [
          {
            "x": -8,
            "z": 8
          },
          {
            "x": 8,
            "z": 8
          },
          {
            "x": 10,
            "z": -5
          },
          {
            "x": -5,
            "z": -9
          }
        ],
        "goal": {
          "x": 13,
          "z": 6
        }
      }
    ]
  },
  {
    "id": "tide",
    "number": 2,
    "name": "Friends Before the Tide",
    "icon": "🌊",
    "color": "#56aaff",
    "reward": "Impact Shield",
    "stages": [
      {
        "id": "little-wave",
        "name": "Little Wave",
        "type": "rescue",
        "time": 105,
        "count": 3,
        "tideRate": 0.035,
        "objective": "Carry three beach friends to the green shelter.",
        "positions": [
          {
            "x": -11,
            "z": 7
          },
          {
            "x": 0,
            "z": 10
          },
          {
            "x": 9,
            "z": 5
          }
        ],
        "goal": {
          "x": 13,
          "z": -7
        }
      },
      {
        "id": "split-current",
        "name": "Split Current",
        "type": "rescue",
        "time": 110,
        "count": 4,
        "hazards": true,
        "objective": "Rescue four friends while avoiding the moving red surge rings.",
        "positions": [
          {
            "x": -12,
            "z": 8
          },
          {
            "x": -2,
            "z": 11
          },
          {
            "x": 8,
            "z": 8
          },
          {
            "x": 12,
            "z": 1
          }
        ],
        "goal": {
          "x": -13,
          "z": -7
        }
      },
      {
        "id": "everyone-home",
        "name": "Everyone Home",
        "type": "rescue",
        "time": 125,
        "tideRate": 0.052,
        "goal": {
          "x": -12,
          "z": -7
        },
        "finalBeacon": {
          "x": 12,
          "z": -7
        }
      }
    ]
  },
  {
    "id": "defense",
    "number": 3,
    "name": "Reef Defense",
    "icon": "🛡",
    "color": "#ff765f",
    "reward": "Charged Pulse",
    "stages": [
      {
        "id": "boardwalk",
        "name": "Hold the Boardwalk",
        "type": "defense",
        "time": 105,
        "count": 6,
        "pads": 2,
        "objective": "Place two turrets, then disable six incoming scouts."
      },
      {
        "id": "approaches",
        "name": "Three Approaches",
        "type": "defense",
        "time": 120,
        "count": 9,
        "pads": 3,
        "objective": "Place three turrets and stop all nine scouts before they reach the relay."
      },
      {
        "id": "captain",
        "name": "Rust Captain",
        "type": "boss",
        "time": 135,
        "count": 1,
        "health": 12,
        "pads": 3,
        "objective": "Bait the captain's charge, then pulse its exposed core."
      }
    ]
  },
  {
    "id": "skyway",
    "number": 4,
    "name": "Skyway Run",
    "icon": "➤",
    "color": "#ffd166",
    "reward": "Long Dash",
    "stages": [
      {
        "id": "sprint",
        "name": "Beacon Sprint",
        "type": "race",
        "time": 70,
        "count": 6
      },
      {
        "id": "cargo",
        "name": "Cargo in Motion",
        "type": "race-collect",
        "time": 85
      },
      {
        "id": "storm",
        "name": "Storm Slalom",
        "type": "race",
        "time": 95,
        "hazards": true
      }
    ]
  },
  {
    "id": "siege",
    "number": 5,
    "name": "Lighthouse Siege",
    "icon": "✦",
    "color": "#bf8cff",
    "reward": "Free Roam",
    "stages": [
      {
        "id": "dark-beach",
        "name": "Dark Beach",
        "type": "collect",
        "time": 110,
        "count": 3,
        "enemies": 4,
        "objective": "Pulse three backup cells, then repair the gold lighthouse relay.",
        "positions": [
          {
            "x": -12,
            "z": 8
          },
          {
            "x": 2,
            "z": 11
          },
          {
            "x": 12,
            "z": -3
          }
        ],
        "goal": {
          "x": 13,
          "z": 7
        }
      },
      {
        "id": "core",
        "name": "The Core Chamber",
        "time": 105
      },
      {
        "id": "signalbreak",
        "name": "Signalbreak",
        "type": "finale",
        "time": 180,
        "count": 6,
        "health": 20
      }
    ]
  }
];

for (const chapter of CHAPTERS) {
  chapter.summary = `${DISTRICTS[chapter.id].name} · ${DISTRICTS[chapter.id].theme}.`;
  for (const stage of chapter.stages) Object.assign(stage, STAGE_STORY[stage.id], STAGE_LAYOUTS[stage.id]);
}
export const ALL_STAGES = CHAPTERS.flatMap((chapter, chapterIndex) => chapter.stages.map((stage, stageIndex) => ({ chapter, stage, chapterIndex, stageIndex })));
export const TOTAL_STAGES = ALL_STAGES.length;

export const BRAWL = {
  chapter: { id: "arcade", number: "★", icon: "⚔", name: "Beach Brawl", reward: "A tiny robot team", stages: [] },
  chapterIndex: 0, stageIndex: 0,
  stage: {
    id: "beach-brawl", name: "Zombie Beach Party", type: "brawl", time: 210, count: 24,
    story: "A bad dance update has turned the tiny beach bots into a zombie conga line. Grab a ridiculous weapon, call the crab crew and repair a few new best friends.",
    objective: "Beat 3 waves. Walk over loot; hold Fire / Space to shoot; F freezes, R calls crabs, E repairs downed bots for 2 scrap.",
    dialogue: ["A zombie beach party? Grab a glowing weapon crate!", "Freeze the rush, whistle for crabs, and fix a downed bot into your team."],
  },
};

export function getStage(chapterIndex, stageIndex) {
  const chapter = CHAPTERS[chapterIndex];
  return chapter?.stages[stageIndex] ? { chapter, stage: chapter.stages[stageIndex], chapterIndex, stageIndex } : null;
}

export function findStage(id) {
  return ALL_STAGES.find(item => item.stage.id === id) || null;
}
