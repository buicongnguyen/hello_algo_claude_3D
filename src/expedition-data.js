const chapter = { id: "expeditions", number: "✧", icon: "✧", name: "Reef Expeditions", stages: [] };
export const EXPEDITIONS = [
  { id: "coral", name: "Coral Cove Rescue", theme: "coral", mode: "rescue", time: 210, count: 3, patrols: 8, color: "#ff89c7", icon: "🐙", difficulty: "Easy · rescue + combat", reward: "Turbo OS + Prism Armor",
    story: "The reef band is missing its musicians! Carry three little friends out of the robot patrol zone. An octopus DJ will help with an inky encore.",
    objective: "Carry 3 friends to the green sanctuary with E / Use. Stop 8 patrol bots, then activate the exit.",
    dialogue: ["Green diamonds are friends. Carry them to the sanctuary—one at a time.", "Gold map diamonds are discoveries. Keep every disc or part you find, even if you retry."] },
  { id: "scrapyard", name: "Neon Scrap Safari", theme: "scrapyard", mode: "salvage", time: 210, count: 3, patrols: 10, color: "#a695ff", icon: "💿", difficulty: "Medium · explore + upgrade", reward: "3 software discs + Twin Thrusters",
    story: "Someone filed the robot software under 'old dance music'. Recover three glowing CDs from the neon salvage yard and build KAI a brighter future.",
    objective: "Pick up 3 software discs and stop 10 patrol bots. Use the uplink to finish. The gold backpack is a permanent thruster upgrade.",
    dialogue: ["CDs install software. A new disc replaces the current program, but all programs stay in your workshop.", "The pink clam can patch a missing shield. It needs time to recharge."] },
  { id: "moonpool", name: "Moonpool Parade", theme: "moonpool", mode: "escort", time: 240, count: 3, patrols: 12, color: "#68dfd3", icon: "🐌", difficulty: "Medium · escort + defend", reward: "Frost OS + Halo Antenna",
    story: "NORI the snail has the festival speakers, but absolutely no sense of urgency. Walk beside the world's slowest parade and keep the zombie dancers out of its way.",
    objective: "Stay within 6 m of NORI to escort it through 3 flags. Clear nearby bots when it stops. Defeat all 12 attackers, then use the finish beacon.",
    dialogue: ["NORI waits if you stray too far or a robot blocks the route. The snail cannot be hurt.", "Watch the small map: white arrow is you, green is a friend, red is a bot, and the gold star is your objective."] },
].map((stage, stageIndex) => ({ chapter, chapterIndex: 0, stageIndex, stage: { ...stage, type: "expedition" } }));
