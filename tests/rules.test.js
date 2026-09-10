import test from "node:test";
import assert from "node:assert/strict";
import { ALL_STAGES, CHAPTERS, TOTAL_STAGES, findStage } from "../src/missions.js";
import { applyHit, createProgress, isUnlocked, medalFor, recordResult, sequenceStep, stageKey } from "../src/rules.js";

test("campaign contains five chapters with three stages each", () => {
  assert.equal(CHAPTERS.length, 5);
  assert.equal(TOTAL_STAGES, 15);
  assert.equal(ALL_STAGES.length, 15);
  CHAPTERS.forEach(chapter => assert.equal(chapter.stages.length, 3));
});

test("stage metadata is unique, complete and logically consistent", () => {
  const ids = new Set();
  for (const item of ALL_STAGES) {
    assert.ok(item.stage.id && item.stage.name && item.stage.objective && item.stage.story);
    assert.ok(item.stage.time > 0 && item.stage.count > 0);
    if (["collect", "rescue", "sequence"].includes(item.stage.type)) assert.ok(item.stage.positions.length >= item.stage.count, `${item.stage.id} needs one readable position per target`);
    if (item.stage.type === "sequence") assert.equal(item.stage.labels.length, item.stage.count, `${item.stage.id} needs one label per signal node`);
    if (item.stage.type === "defense") assert.ok(item.stage.pads > 0 && item.stage.pads <= 3, `${item.stage.id} uses the three visible defense approaches`);
    if (item.stage.minShield) assert.ok(item.stage.minShield <= 3, `${item.stage.id} shield challenge exceeds the HUD capacity`);
    assert.equal(ids.has(item.stage.id), false, `duplicate ${item.stage.id}`);
    ids.add(item.stage.id);
  }
  assert.equal(findStage("signalbreak")?.chapter.id, "siege");
});

test("campaign unlocks strictly in story order", () => {
  let progress = createProgress();
  assert.equal(isUnlocked(progress, 0, 0), true);
  assert.equal(isUnlocked(progress, 0, 1), false);
  assert.equal(isUnlocked(progress, 1, 0), false);
  progress = recordResult(progress, CHAPTERS[0], CHAPTERS[0].stages[0], 20, false);
  assert.equal(isUnlocked(progress, 0, 1), true);
  progress = recordResult(progress, CHAPTERS[0], CHAPTERS[0].stages[1], 20, false);
  progress = recordResult(progress, CHAPTERS[0], CHAPTERS[0].stages[2], 20, false);
  assert.equal(isUnlocked(progress, 1, 0), true);
});

test("result recording is idempotent and preserves best medals and time", () => {
  const chapter = CHAPTERS[0];
  const stage = chapter.stages[0];
  let progress = recordResult(createProgress(), chapter, stage, 10, false);
  progress = recordResult(progress, chapter, stage, 50, true);
  assert.deepEqual(progress.completed, [stageKey(chapter.id, stage.id)]);
  assert.deepEqual(progress.results[stageKey(chapter.id, stage.id)], { medals: 3, bestTimeLeft: 50 });
});

test("medals have explicit completion, speed and challenge rules", () => {
  assert.equal(medalFor(0, 100, false), 1);
  assert.equal(medalFor(25, 100, false), 2);
  assert.equal(medalFor(1, 100, true), 2);
  assert.equal(medalFor(30, 100, true), 3);
});

test("shield hits respect invulnerability and never underflow", () => {
  assert.deepEqual(applyHit(3, 1), { shields: 3, invulnerable: 1, damaged: false });
  assert.deepEqual(applyHit(1, 0), { shields: 0, invulnerable: 1.25, damaged: true });
  assert.equal(applyHit(0, 0).shields, 0);
});

test("signal sequence advances only through the expected causal chain", () => {
  const expected = [0, 1, 2];
  assert.deepEqual(sequenceStep(expected, 0, 2), { index: 0, correct: false, complete: false });
  assert.deepEqual(sequenceStep(expected, 0, 0), { index: 1, correct: true, complete: false });
  assert.deepEqual(sequenceStep(expected, 2, 2), { index: 3, correct: true, complete: true });
});
