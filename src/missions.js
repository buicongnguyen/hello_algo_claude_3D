const p = (x, z) => ({ x, z });

export const CHAPTERS = [
  {
    id: "signal",
    number: 1,
    name: "The Broken Signal",
    icon: "⚡",
    color: "#65e5ff",
    summary: "Learn KAI's field tools and recover the marina fragment.",
    reward: "Wide Pulse",
    stages: [
      { id: "wake", name: "Wake the Beach", type: "collect", time: 85, count: 3, story: "LUMA's light is gone, and BOLT's charging dock is silent. Loose cells still glow along the shore.", objective: "Pulse three energy cells, then repair BOLT's dock.", target: "energy cells", positions: [p(-10, 5), p(1, 10), p(11, 2)], goal: p(-3, -4), dialogue: ["KAI, the Aurora Core has been scattered.", "Charge those cells with your pulse. BOLT can guide us once his dock is awake."] },
      { id: "trail", name: "Follow the Light", type: "sequence", time: 90, count: 3, story: "A reflection chain points toward the thief's escape route.", objective: "Scan the lens, pearl reflector and kite relay in that order.", labels: ["Loose lens", "Pearl reflector", "Kite relay"], positions: [p(12, -5), p(3, 7), p(-8, 1)], dialogue: ["Light leaves evidence.", "Start where the beacon broke, then follow each reflection."] },
      { id: "fragment", name: "First Fragment", type: "combat", time: 95, count: 4, story: "Rust scouts are circling the marina beacon with the first signal fragment.", objective: "Disable four Rust scouts and activate the marina beacon.", positions: [p(-8, 8), p(8, 8), p(10, -5), p(-5, -9)], goal: p(13, 6), dialogue: ["Those scouts are damaged, not evil.", "Pulse their red cores until they reboot blue."] },
    ],
  },
  {
    id: "tide",
    number: 2,
    name: "Friends Before the Tide",
    icon: "🌊",
    color: "#56aaff",
    summary: "Carry beach friends to high ground before the surge arrives.",
    reward: "Impact Shield",
    stages: [
      { id: "little-wave", name: "Little Wave", type: "rescue", time: 105, count: 3, tideRate: 0.035, story: "The tide-control grid is offline. Three little sea friends are stranded below the boardwalk.", objective: "Carry three beach friends to the green shelter.", positions: [p(-11, 7), p(0, 10), p(9, 5)], goal: p(13, -7), dialogue: ["The water is already moving.", "Carry one friend at a time. The shelter marker stays visible."] },
      { id: "split-current", name: "Split Current", type: "rescue", time: 110, count: 4, hazards: true, story: "The Warden's damaged storm protocol sends surge drones across the sand. Every friend still needs a safe way home.", objective: "Rescue four friends while avoiding the moving red surge rings.", positions: [p(-12, 8), p(-2, 11), p(8, 8), p(12, 1)], goal: p(-13, -7), dialogue: ["Red rings mark surge drones. Watch their movement before crossing.", "Carry one friend, dash through a gap, and use the green shelter."] },
      { id: "everyone-home", name: "Everyone Home", type: "rescue", time: 125, count: 6, tideRate: 0.052, story: "The second fragment is powering the rogue tide beacon.", objective: "Rescue six friends, then disable the tide beacon.", positions: [p(-13, 7), p(-7, 11), p(0, 8), p(6, 11), p(12, 6), p(8, -5)], goal: p(-12, -7), finalBeacon: p(12, -7), dialogue: ["This is the last safe window.", "Bring everyone home, then shut down that orange beacon."] },
    ],
  },
  {
    id: "defense",
    number: 3,
    name: "Reef Defense",
    icon: "🛡",
    color: "#ff765f",
    summary: "Build a readable defense line and protect the relay.",
    reward: "Charged Pulse",
    stages: [
      { id: "boardwalk", name: "Hold the Boardwalk", type: "defense", time: 105, count: 6, pads: 2, story: "Scouts are following the restored signal. Solar turrets can hold the boardwalk.", objective: "Place two turrets, then disable six incoming scouts.", dialogue: ["Gold rings are valid turret pads.", "Every basic turret has the same range and power."] },
      { id: "approaches", name: "Three Approaches", type: "defense", time: 120, count: 9, pads: 3, story: "Armored Rust scouts split across three routes. Their cores need three hits, so the defense line needs KAI's support.", objective: "Place three turrets and stop all nine scouts before they reach the relay.", dialogue: ["Red dashed paths show where scouts approach.", "These scouts need three hits. Pulse any that slip past a turret."] },
      { id: "captain", name: "Rust Captain", type: "boss", time: 135, count: 1, health: 12, pads: 3, story: "The Rust Captain carries the third fragment behind a charge shield.", objective: "Bait the captain's charge, then pulse its exposed core.", dialogue: ["Its shield drops after a missed charge.", "Dash sideways when the warning line turns bright."] },
    ],
  },
  {
    id: "skyway",
    number: 4,
    name: "Skyway Run",
    icon: "➤",
    color: "#ffd166",
    summary: "Use speed and route reading to catch the airborne fragment.",
    reward: "Long Dash",
    stages: [
      { id: "sprint", name: "Beacon Sprint", type: "race", time: 70, count: 6, story: "A wind drone is carrying the fourth fragment toward the cliffs.", objective: "Pass six numbered gates in order before time expires.", dialogue: ["The next gate shines gold.", "Dash on the straight sections; steer normally near turns."] },
      { id: "cargo", name: "Cargo in Motion", type: "race-collect", time: 85, count: 7, story: "The supply drone has scattered charged cells around the island. Their signals drift in the sea wind.", objective: "Find and pulse seven drifting energy cells.", dialogue: ["BOLT's compass tracks the nearest drifting cell.", "Your wide pulse can reach it before you do."] },
      { id: "storm", name: "Storm Slalom", type: "race", time: 95, count: 10, minShield: 2, hazards: true, story: "Storm gates close around the fragment. The shield must survive the run.", objective: "Complete ten gates with at least two shield charges.", dialogue: ["Red arcs cost one shield charge.", "A clean finish needs two blue diamonds remaining."] },
    ],
  },
  {
    id: "siege",
    number: 5,
    name: "Lighthouse Siege",
    icon: "✦",
    color: "#bf8cff",
    summary: "Restore the island network and face the Rust Warden.",
    reward: "Free Roam",
    stages: [
      { id: "dark-beach", name: "Dark Beach", type: "collect", time: 110, count: 3, enemies: 4, story: "The lighthouse's backup power is failing. Rust patrols are trying to lock away every remaining energy cell.", objective: "Pulse three backup cells, then repair the gold lighthouse relay.", positions: [p(-12, 8), p(2, 11), p(12, -3)], goal: p(13, 7), dialogue: ["The Warden thinks locking up our power will protect us from the storm.", "Recover all three cells. We must repair its protocol, too."] },
      { id: "core", name: "The Core Chamber", type: "sequence", time: 105, count: 3, story: "The recovered fragments must be routed by color and height.", objective: "Activate the low cyan, middle gold and high violet circuit nodes.", labels: ["Low cyan", "Middle gold", "High violet"], positions: [p(-7, 6), p(0, 0), p(8, -6)], dialogue: ["Energy climbs from sea level to the lens.", "Follow the circuit from low to high."] },
      { id: "signalbreak", name: "Signalbreak", type: "finale", time: 180, count: 6, health: 20, story: "The final fragment is inside the Warden. Its damaged storm protocol mistakes our repaired lighthouse for a threat. Reboot it and bring everyone to the festival.", objective: "Protect the core, reboot the Warden and its scouts, then launch the rocket.", dialogue: ["Protect the core. Orange means a charge warning; cyan means the core is exposed.", "The Warden calls more scouts between charges. Keep the lighthouse safe.", "Then meet me at the rocket. We finish this together."] },
    ],
  },
];

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
