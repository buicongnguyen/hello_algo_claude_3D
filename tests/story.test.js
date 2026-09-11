import test from "node:test";
import assert from "node:assert/strict";
import { ALL_STAGES, BRAWL, findStage } from "../src/missions.js";
import { DISTRICTS, storyFor, journalEntries, isStoryMode } from "../src/story.js";
import { traceRelays, minimumRelayTurns } from "../src/relay.js";
import { createProgress, normalizeCheckpoint, availableCheckpoint } from "../src/rules.js";

test("every campaign stage has stakes, actionable beats, attributed dialogue and a consequence", () => {
  assert.equal(Object.keys(DISTRICTS).length, 5);
  for (const item of ALL_STAGES) {
    const narrative = storyFor(item);
    assert.ok(narrative.stakes && narrative.outcome && narrative.story);
    assert.ok(narrative.beats.length >= 2);
    assert.ok(narrative.dialogue.every(line => line.speaker && line.text));
  }
  assert.equal(storyFor(BRAWL), null);
  assert.deepEqual(journalEntries(createProgress(), ALL_STAGES), []);
  const entries = journalEntries(createProgress({ completed: ["signal:wake", "unknown:old"] }), ALL_STAGES);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, "Wake the Beach");
  assert.equal(entries[0].text, storyFor(findStage("wake")).outcome);
});

test("relay rays obey the nearest device and cannot power through it or through a loop", () => {
  const nodes = [{ x: 0, z: 0 }, { x: 5, z: 0 }, { x: 10, z: 0 }];
  const receiver = { x: 15, z: 0 };
  const broken = traceRelays(nodes, [1, 0, 1], receiver);
  assert.equal(broken.outputs[0].hit, 1);
  assert.deepEqual(broken.powered, [0, 1]);
  assert.equal(broken.receiverPowered, false);
  assert.equal(broken.complete, false);
  const loop = traceRelays(nodes, [1, 3, 1], receiver);
  assert.deepEqual(loop.powered, [0, 1]);
  assert.equal(loop.complete, false);
  assert.equal(traceRelays(nodes, [1, 1, 1], receiver).complete, true);
  const shortcut = traceRelays([{ x: 0, z: 0 }, { x: 5, z: 5 }], [1, 0], { x: 5, z: 0 });
  assert.equal(shortcut.receiverPowered, true);
  assert.equal(shortcut.complete, false, "every relay must be on the powered path");
});

test("authored relay puzzles start unsolved, are solvable, and publish an achievable optimum", () => {
  for (const id of ["trail", "core"]) {
    const stage = findStage(id).stage;
    assert.equal(traceRelays(stage.positions, stage.turns, stage.receiver).complete, false);
    assert.ok(minimumRelayTurns(stage) > 0 && minimumRelayTurns(stage) <= stage.count * 3);
    assert.equal(minimumRelayTurns(stage), minimumRelayTurns(stage), "cached result is stable");
  }
});

test("authored causeways and rescues fit the island and expose consistent counts", () => {
  for (const item of ALL_STAGES) {
    const stage = item.stage;
    if (stage.gatePositions) assert.equal(stage.gatePositions.length, stage.count);
    if (stage.positions) assert.equal(stage.positions.length, stage.count);
    for (const point of [...(stage.positions || []), ...(stage.gatePositions || []), ...(stage.shelters || [])]) {
      assert.ok(Math.hypot(point.x, point.z) < 18, `${stage.id} target outside clear play space`);
    }
  }
  assert.equal(findStage("everyone-home").stage.count, 4);
  assert.equal(findStage("storm").stage.minShield, null);
});

test("legacy saves acquire Story mode without changing equipment, progress or unlocks", () => {
  const progress = createProgress({ completed: ["signal:wake"], settings: { reducedMotion: true } });
  assert.equal(progress.settings.campaignMode, "story");
  assert.equal(progress.settings.reducedMotion, true);
  assert.deepEqual(progress.completed, ["signal:wake"]);
  assert.equal(isStoryMode(findStage("wake"), progress), true);
  assert.equal(isStoryMode(BRAWL, progress), false);
  assert.equal(isStoryMode(findStage("wake"), createProgress({ settings: { campaignMode: "challenge" } })), false);
});

test("persistent checkpoints reject unsafe values, wrong stages, locked finales and mismatched modes", () => {
  const valid = { stage: "siege:signalbreak", mode: "story", coreHealth: 3, time: 0, elapsed: 201, metrics: { damageTaken: 2, calls: -8, recruited: Infinity, frozenEnemies: 2.9 } };
  assert.equal(normalizeCheckpoint(valid, []), null);
  for (const patch of [{ stage: "signal:wake" }, { mode: "easy" }, { coreHealth: 0 }, { coreHealth: 6 }, { time: NaN }, { time: 181 }, { elapsed: Infinity }, { elapsed: -1 }, { mode: "challenge", time: 0 }]) {
    assert.equal(normalizeCheckpoint({ ...valid, ...patch }, ["siege:core"]), null);
  }
  const progress = createProgress({ completed: ["siege:core"], checkpoint: valid });
  assert.equal(availableCheckpoint(progress).coreHealth, 3);
  assert.deepEqual(progress.checkpoint.metrics, { damageTaken: 2, calls: 0, recruited: 0, frozenEnemies: 2 });
  progress.settings.campaignMode = "challenge";
  assert.equal(availableCheckpoint(progress), null);
});
