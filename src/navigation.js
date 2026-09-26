import { PLAY_RADIUS } from "./presentation.js";

const CELL = .75, CLEARANCE = .04;
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const grids = new WeakMap(), routes = new WeakMap();
const EMPTY = [];

// Test the whole swept circle, not just its endpoint, so diagonals cannot cut through props.
export function clearPath(from, to, obstacles = EMPTY, radius = .9) {
  const dx = to.x - from.x, dz = to.z - from.z, length2 = dx * dx + dz * dz;
  for (const obstacle of obstacles) {
    const r = obstacle.radius + radius;
    if (obstacle.x + r < Math.min(from.x, to.x) || obstacle.x - r > Math.max(from.x, to.x)
      || obstacle.z + r < Math.min(from.z, to.z) || obstacle.z - r > Math.max(from.z, to.z)) continue;
    const t = length2 ? Math.max(0, Math.min(1, ((obstacle.x - from.x) * dx + (obstacle.z - from.z) * dz) / length2)) : 0;
    if (Math.hypot(from.x + t * dx - obstacle.x, from.z + t * dz - obstacle.z) < r - 1e-6) return false;
  }
  return true;
}

class MinHeap {
  items = [];
  push(item) {
    let i = this.items.length;
    this.items.push(item);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].rank <= item.rank) break;
      this.items[i] = this.items[parent]; i = parent;
    }
    this.items[i] = item;
  }
  pop() {
    const first = this.items[0], last = this.items.pop();
    if (!this.items.length) return first;
    let i = 0;
    while (i * 2 + 1 < this.items.length) {
      let child = i * 2 + 1;
      if (child + 1 < this.items.length && this.items[child + 1].rank < this.items[child].rank) child++;
      if (last.rank <= this.items[child].rank) break;
      this.items[i] = this.items[child]; i = child;
    }
    this.items[i] = last;
    return first;
  }
}

function gridFor(obstacles, radius, limit) {
  let profiles = grids.get(obstacles);
  if (!profiles) { profiles = new Map(); grids.set(obstacles, profiles); }
  const key = `${radius}:${limit}`;
  if (profiles.has(key)) return profiles.get(key);
  const half = Math.ceil(limit / CELL), width = half * 2 + 1;
  const nodes = Array.from({ length: width * width }, (_, i) => ({ x: (i % width - half) * CELL, z: (Math.floor(i / width) - half) * CELL }));
  const valid = nodes.map(p => Math.hypot(p.x, p.z) <= limit && clearPath(p, p, obstacles, radius + CLEARANCE));
  const grid = { nodes, valid, width, half, edges: new Map(), obstacles, radius, limit };
  profiles.set(key, grid);
  return grid;
}

function neighbors(grid, id) {
  if (grid.edges.has(id)) return grid.edges.get(id);
  const result = [], col = id % grid.width, row = Math.floor(id / grid.width);
  for (const [dx, dz] of DIRECTIONS) {
    const x = col + dx, z = row + dz, next = z * grid.width + x;
    if (x < 0 || z < 0 || x >= grid.width || z >= grid.width || !grid.valid[next]) continue;
    if (clearPath(grid.nodes[id], grid.nodes[next], grid.obstacles, grid.radius + CLEARANCE)) result.push(next);
  }
  grid.edges.set(id, result);
  return result;
}

function nearbyNodes(grid, point) {
  const col = Math.round(point.x / CELL) + grid.half, row = Math.round(point.z / CELL) + grid.half, result = [];
  // Several connectors let an actor at a prop's edge join the grid without teleporting.
  for (let z = Math.max(0, row - 2); z <= Math.min(grid.width - 1, row + 2); z++) {
    for (let x = Math.max(0, col - 2); x <= Math.min(grid.width - 1, col + 2); x++) {
      const id = z * grid.width + x;
      if (grid.valid[id] && clearPath(point, grid.nodes[id], grid.obstacles, grid.radius)) result.push(id);
    }
  }
  return result;
}

function findRoute(from, target, obstacles, radius, limit) {
  const grid = gridFor(obstacles, radius, limit);
  const goals = new Set(nearbyNodes(grid, target));
  if (!goals.size) return [];
  const costs = new Float64Array(grid.nodes.length).fill(Infinity), previous = new Int32Array(grid.nodes.length).fill(-1);
  const closed = new Uint8Array(grid.nodes.length), open = new MinHeap();
  const estimate = id => Math.hypot(grid.nodes[id].x - target.x, grid.nodes[id].z - target.z);
  for (const id of nearbyNodes(grid, from)) {
    costs[id] = Math.hypot(grid.nodes[id].x - from.x, grid.nodes[id].z - from.z);
    open.push({ id, rank: costs[id] + estimate(id) });
  }
  while (open.items.length) {
    const { id } = open.pop();
    if (closed[id]) continue;
    if (goals.has(id)) {
      const path = [{ x: target.x, z: target.z }];
      for (let node = id; node !== -1; node = previous[node]) path.push(grid.nodes[node]);
      return path.reverse();
    }
    closed[id] = 1;
    for (const next of neighbors(grid, id)) {
      if (closed[next]) continue;
      const cost = costs[id] + Math.hypot(grid.nodes[next].x - grid.nodes[id].x, grid.nodes[next].z - grid.nodes[id].z);
      if (cost >= costs[next]) continue;
      costs[next] = cost; previous[next] = id;
      open.push({ id: next, rank: cost + estimate(next) });
    }
  }
  return [];
}

// Obstacles are immutable for a stage. Grids/edges are shared by agents of the same radius;
// per-agent routes are reused until the target moves, the route is blocked, or its budget expires.
export function moveAgent(agent, target, step, obstacles = EMPTY, limit = PLAY_RADIUS - .5) {
  if (step <= 0) return;
  const radius = agent.radius ?? .9, length = Math.hypot(target.x, target.z);
  const destination = length > limit ? { x: target.x * limit / length, z: target.z * limit / length } : target;
  let next = destination;
  if (!clearPath(agent, destination, obstacles, radius)) {
    let route = routes.get(agent);
    if (route) route.budget -= step;
    if (!route || route.obstacles !== obstacles || route.radius !== radius || route.limit !== limit || route.budget <= 0
      || Math.hypot(route.target.x - destination.x, route.target.z - destination.z) > 1.5
      || route.points.length && !clearPath(agent, route.points[0], obstacles, radius)) {
      route = { obstacles, radius, limit, target: { x: destination.x, z: destination.z }, budget: 3,
        points: findRoute(agent, destination, obstacles, radius, limit) };
      routes.set(agent, route);
    }
    while (route.points.length && Math.hypot(agent.x - route.points[0].x, agent.z - route.points[0].z) < .01) route.points.shift();
    if (!route.points.length) return; // No safe path: wait for the target to move, never clip through scenery.
    // Smooth only visible corners; preserve the swept-circle clearance of every step.
    for (let i = route.points.length - 1; i > 0; i--) {
      if (clearPath(agent, route.points[i], obstacles, radius)) { route.points.splice(0, i); break; }
    }
    next = route.points[0];
  } else routes.delete(agent);
  const dx = next.x - agent.x, dz = next.z - agent.z, distance = Math.hypot(dx, dz);
  if (!distance) return;
  const amount = Math.min(step, distance) / distance;
  agent.x += dx * amount; agent.z += dz * amount;
}
