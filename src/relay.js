export const DIRECTIONS = [{ x: 0, z: -1, name: "north" }, { x: 1, z: 0, name: "east" }, { x: 0, z: 1, name: "south" }, { x: -1, z: 0, name: "west" }];

// Rays stop at the nearest device. A downstream relay never receives power through a nearer one.
export function traceRelays(positions, turns, receiver) {
  const outputs = positions.map((from, index) => {
    const direction = DIRECTIONS[turns[index] % 4];
    let hit = null, range = Infinity;
    for (const [id, point] of [...positions.map((p, i) => [i, p]), ["receiver", receiver]]) {
      if (id === index) continue;
      const dx = point.x - from.x, dz = point.z - from.z;
      const forward = dx * direction.x + dz * direction.z;
      const sideways = Math.abs(dx * direction.z - dz * direction.x);
      if (forward > .01 && sideways < .1 && forward < range) { range = forward; hit = id; }
    }
    return { from, to: hit === null ? { x: from.x + direction.x * 5, z: from.z + direction.z * 5 } : hit === "receiver" ? receiver : positions[hit], hit, powered: false };
  });
  const powered = new Set();
  let current = 0, receiverPowered = false;
  while (typeof current === "number" && !powered.has(current)) {
    powered.add(current); outputs[current].powered = true;
    const hit = outputs[current].hit;
    if (hit === "receiver") { receiverPowered = true; break; }
    current = hit;
  }
  return { outputs, powered: [...powered], receiverPowered, complete: receiverPowered && powered.size === positions.length };
}

// The completing orientation that needs the fewest further clockwise quarter-turns from `turns`.
export function solveRelays(positions, turns, receiver) {
  let best = null;
  for (let state = 0; state < 4 ** positions.length; state++) {
    const candidate = positions.map((_, i) => Math.floor(state / 4 ** i) % 4);
    if (!traceRelays(positions, candidate, receiver).complete) continue;
    const cost = candidate.reduce((sum, value, i) => sum + (value - turns[i] + 4) % 4, 0);
    if (!best || cost < best.cost) best = { turns: candidate, cost };
  }
  return best;
}

const minimumCache = new WeakMap();
export function minimumRelayTurns(stage) {
  if (!minimumCache.has(stage)) minimumCache.set(stage, solveRelays(stage.positions, stage.turns, stage.receiver)?.cost ?? Infinity);
  return minimumCache.get(stage);
}
