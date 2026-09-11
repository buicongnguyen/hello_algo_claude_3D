import { DISTRICTS } from "./story.js";
import { JOURNEY } from "./journey-data.js";
export const CHAPTERS = [
 { id:"signal", icon:"⌂", color:"#65e5ff", reward:"Wide Pulse" },
 { id:"tide", icon:"≋", color:"#56aaff", reward:"Impact Shield" },
 { id:"defense", icon:"↟", color:"#ff765f", reward:"Charged Pulse" },
 { id:"skyway", icon:"✧", color:"#ffd166", reward:"Long Dash" },
 { id:"siege", icon:"☾", color:"#bf8cff", reward:"Free Roam" },
].map((chapter,index) => ({...chapter,number:index+1,name:DISTRICTS[chapter.id].name,summary:DISTRICTS[chapter.id].theme,stages:JOURNEY.slice(index*3,index*3+3)}));
export const ALL_STAGES = CHAPTERS.flatMap((chapter,chapterIndex) => chapter.stages.map((stage,stageIndex) => ({chapter,stage,chapterIndex,stageIndex})));
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
