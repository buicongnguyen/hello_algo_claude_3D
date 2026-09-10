import { ALL_STAGES, CHAPTERS } from "./missions.js";

export const SAVE_VERSION = 1;

export function stageKey(chapterId, stageId) {
  return `${chapterId}:${stageId}`;
}

export function createProgress(raw = {}) {
  return {
    version: SAVE_VERSION,
    completed: Array.isArray(raw.completed) ? [...new Set(raw.completed.filter(value => typeof value === "string"))] : [],
    results: raw.results && typeof raw.results === "object" ? { ...raw.results } : {},
    settings: { quality: "auto", reducedMotion: false, ...(raw.settings || {}) },
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
