import { JOURNEY } from "./journey-data.js";
export const DISTRICTS = {
 signal: { name: "The First Horizon", theme: "City → countryside → coast", restored: "The atlas has a route, a frequency and a reason to dive." },
 tide: { name: "Below the Blue", theme: "Living reef → research wreck → abyss", restored: "The ocean has become a world of friends, history and light." },
 defense: { name: "Beyond the Shore", theme: "Research platform → open ocean → storm clouds", restored: "A quiet upper-air corridor opens the way beyond the sea." },
 skyway: { name: "Leaving Earth", theme: "High atmosphere → orbital station → Moon", restored: "The first lunar footprints begin a new page of the atlas." },
 siege: { name: "The Long Way Home", theme: "Lunar crater → observatory → Earth", restored: "The complete atlas is home, where everyone can discover it." },
};
export const STAGE_STORY = Object.fromEntries(JOURNEY.map(stage => [stage.id, stage]));
export function storyFor(item) { return DISTRICTS[item?.chapter?.id] && item.stage.type !== "roam" ? item.stage : null; }
export function journalEntries(progress, stages) { return stages.filter(item => progress.completed.includes(`${item.chapter.id}:${item.stage.id}`)).map(item => ({title:item.stage.name, district:item.stage.location || DISTRICTS[item.chapter.id].name, text:item.stage.outcome, discovery:item.stage.discovery})); }
export function isStoryMode(item, progress) { return Boolean(storyFor(item)) && progress.settings.campaignMode !== "challenge"; }
