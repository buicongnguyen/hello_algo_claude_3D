import { ALL_STAGES, CHAPTERS } from "./missions.js";
import { normalizeEquipment } from "./equipment.js";

export const SAVE_VERSION = 1;

export function stageKey(chapterId, stageId) {
  return `${chapterId}:${stageId}`;
}

export function createProgress(raw = {}) {
  if (!raw || typeof raw !== "object") raw = {};
  const migrate = raw.version === SAVE_VERSION && raw.campaignRevision !== 2;
  const archive = migrate ? {completed:raw.completed,results:raw.results} : raw.previousCampaign;
  return {
    version: SAVE_VERSION,
    campaignRevision: 2,
    previousCampaign: archive && Array.isArray(archive.completed) ? { completed:[...new Set(archive.completed.filter(value=>typeof value==="string"))], results:archive.results && typeof archive.results==="object" ? {...archive.results} : {} } : null,
    brawlBest: Number.isFinite(raw.brawlBest) ? Math.max(0, raw.brawlBest) : 0,
    equipment: normalizeEquipment(raw.equipment),
    expeditionResults: Object.fromEntries(["coral", "scrapyard", "moonpool"].filter(id => Number.isFinite(raw.expeditionResults?.[id]) && raw.expeditionResults[id] >= 0).map(id => [id, raw.expeditionResults[id]])),
    completed: !migrate && Array.isArray(raw.completed) ? [...new Set(raw.completed.filter(value => typeof value === "string"))] : [],
    results: !migrate && raw.results && typeof raw.results === "object" ? { ...raw.results } : {},
    settings: { quality: "auto", reducedMotion: false, ...(raw.settings || {}), campaignMode: raw.settings?.campaignMode === "challenge" ? "challenge" : "story" },
    checkpoint: migrate ? null : normalizeCheckpoint(raw.checkpoint, raw.completed),
  };
}

export function normalizeCheckpoint(raw, completed = []) {
  if (!raw || raw.stage !== "siege:signalbreak" || !Array.isArray(completed) || !completed.includes("siege:core")) return null;
  if (!["story", "challenge"].includes(raw.mode)) return null;
  if (!Number.isInteger(raw.coreHealth) || raw.coreHealth < 1 || raw.coreHealth > 5) return null;
  if (!Number.isFinite(raw.time) || raw.time < 0 || raw.time > 180 || raw.mode === "challenge" && raw.time <= 0) return null;
  if (!Number.isFinite(raw.elapsed) || raw.elapsed < 0 || raw.elapsed > 86400) return null;
  const metrics = {};
  for (const key of ["damageTaken", "recruited", "calls", "frozenEnemies"]) metrics[key] = Number.isFinite(raw.metrics?.[key]) ? Math.max(0, Math.min(100000, Math.floor(raw.metrics[key]))) : 0;
  return { stage: raw.stage, mode: raw.mode, coreHealth: raw.coreHealth, time: raw.time, elapsed: raw.elapsed, metrics };
}

export function availableCheckpoint(progress) {
  const checkpoint = normalizeCheckpoint(progress.checkpoint, progress.completed);
  return checkpoint?.mode === progress.settings.campaignMode ? checkpoint : null;
}

export function earnedUpgrades(progress) {
  const earned = chapter => progress.completed.includes(stageKey(chapter.id, chapter.stages.at(-1).id));
  return {
    pulseRadius: earned(CHAPTERS[0]) ? 4.1 : 3.45,
    maxShields: earned(CHAPTERS[1]) ? 4 : 3,
    pulseDamage: earned(CHAPTERS[2]) ? 2 : 1,
    dashDuration: earned(CHAPTERS[3]) ? 0.55 : 0.36,
    dashRecharge: earned(CHAPTERS[3]) ? 1.8 : 2.5,
    freeRoam: earned(CHAPTERS[4]),
  };
}

export function isUnlocked(progress, chapterIndex, stageIndex) {
  if (chapterIndex === 0 && stageIndex === 0) return true;
  if (stageIndex > 0) {
    const chapter = CHAPTERS[chapterIndex];
    return progress.completed.includes(stageKey(chapter.id, chapter.stages[stageIndex - 1].id));
  }
  const previous = CHAPTERS[chapterIndex - 1];
  const last = previous?.stages.at(-1);
  return Boolean(last && progress.completed.includes(stageKey(previous.id, last.id)));
}

export function recordResult(progress, chapter, stage, secondsLeft, challengeComplete = false) {
  const next = createProgress(progress);
  const key = stageKey(chapter.id, stage.id);
  if (!next.completed.includes(key)) next.completed.push(key);
  const medal = medalFor(secondsLeft, stage.time, challengeComplete);
  const previous = next.results[key] || { medals: 0, bestTimeLeft: 0 };
  next.results[key] = { medals: Math.max(previous.medals, medal), bestTimeLeft: Math.max(previous.bestTimeLeft, Math.round(secondsLeft)) };
  return next;
}

export function medalFor(secondsLeft, totalTime, challengeComplete) {
  let medals = 1;
  if (secondsLeft >= totalTime * 0.25) medals += 1;
  if (challengeComplete) medals += 1;
  return medals;
}

export function applyHit(shields, invulnerable) {
  if (invulnerable > 0) return { shields, invulnerable, damaged: false };
  return { shields: Math.max(0, shields - 1), invulnerable: 1.25, damaged: true };
}

export function sequenceStep(expected, index, actual) {
  if (expected[index] !== actual) return { index, correct: false, complete: false };
  const next = index + 1;
  return { index: next, correct: true, complete: next >= expected.length };
}

export function nextIncomplete(progress) {
  return ALL_STAGES.find(item => isUnlocked(progress, item.chapterIndex, item.stageIndex) && !progress.completed.includes(stageKey(item.chapter.id, item.stage.id))) || ALL_STAGES[0];
}
