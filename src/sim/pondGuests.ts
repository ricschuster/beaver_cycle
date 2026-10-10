// Ducks and frogs that share a mature pond (docs/design/24_npcs_and_animals.md, #309). A pond is mature when it has held
// water for `MATURE_DAYS` game days (`world.pondSince`). Then a few ducks float on it and a few frogs sit at its edge, set
// from the pond's dam spot and the pond's own shape, so every visit gives the same guests. They go when the pond drains.
// No three.js and no DOM here.
import { hash, isAbout, placeAt, type Animal, type Home } from './animals';
import { DAY_SECONDS } from './clock';
import { POND_CELL, type Pond } from './pond';
import type { WorldState } from './state';

/** Game days a pond holds water before ducks and frogs come. A tuning number. */
export const MATURE_DAYS = 2;
/** Ducks and frogs are drawn for ponds this near the beaver (metres), measured from the pond's middle. */
const NEAR = 220;
/** How far a duck swims and a frog hops about its spot (metres). */
const DUCK_RADIUS = 3;
const FROG_RADIUS = 0.8;
/** A duck floats where the water is at least this deep (metres), a frog sits where it is shallower and the bank is near. */
const DUCK_DEPTH = 0.6;

interface Guest {
  id: string;
  home: Home;
  radius: number;
  /** Where the water is at its spot, for the height. */
  level: number;
}

const cache = new WeakMap<Pond, Guest[]>();

/** A number from a dam spot id, to seed the hash. */
function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h;
}

/** The ducks and frogs of a pond, each on its own spot of the water. Worked out once per pond shape. */
function guestsOf(p: Pond): Guest[] {
  const cached = cache.get(p);
  if (cached) return cached;
  const open: number[] = [];
  const edge: number[] = [];
  const at = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < p.n && j < p.n && p.flooded[j * p.n + i] === 1;
  for (let j = 1; j < p.n - 1; j++) {
    for (let i = 1; i < p.n - 1; i++) {
      if (!at(i, j)) continue;
      const depth = p.level - p.heights[j * p.n + i]!;
      const wet = at(i - 1, j) && at(i + 1, j) && at(i, j - 1) && at(i, j + 1);
      if (wet && depth >= DUCK_DEPTH && at(i - 2, j) && at(i + 2, j) && at(i, j - 2) && at(i, j + 2)) open.push(j * p.n + i);
      else if (!wet) edge.push(j * p.n + i);
    }
  }
  const seed = seedOf(p.spot);
  const guests: Guest[] = [];
  const ducks = open.length === 0 ? 0 : Math.min(4, 1 + Math.floor(p.area / 500));
  const frogs = edge.length === 0 ? 0 : Math.min(5, 2 + Math.floor(p.area / 400));
  const add = (kind: 'duck' | 'frog', cells: number[], k: number, radius: number): void => {
    const cell = cells[Math.floor(hash(seed, k, 7) * cells.length)]!;
    const x = p.x0 + (cell % p.n) * POND_CELL;
    const z = p.z0 + Math.floor(cell / p.n) * POND_CELL;
    guests.push({ id: `pond:${p.spot}:${kind}${k}`, home: { kind, x, z, phase: hash(seed, k, 8) * Math.PI * 2, luck: hash(seed, k, 9) }, radius, level: p.level });
  };
  for (let k = 0; k < ducks; k++) add('duck', open, k, DUCK_RADIUS);
  for (let k = 0; k < frogs; k++) add('frog', edge, 10 + k, FROG_RADIUS);
  cache.set(p, guests);
  return guests;
}

/** True when a pond has held water long enough. */
export function matureAt(pondSince: Record<string, number>, spot: string, clock: number): boolean {
  const since = pondSince[spot];
  return since !== undefined && clock - since >= MATURE_DAYS * DAY_SECONDS;
}

/** Notes when each pond was first seen, and forgets ponds that have drained, so a pond that comes back starts young. */
export function trackPonds(world: WorldState): WorldState {
  const now = new Set(world.ponds.map((p) => p.spot));
  const since = world.pondSince;
  const missing = world.ponds.some((p) => since[p.spot] === undefined);
  const gone = Object.keys(since).some((s) => !now.has(s));
  if (!missing && !gone) return world;
  const next: Record<string, number> = {};
  for (const p of world.ponds) next[p.spot] = since[p.spot] ?? world.clock;
  return { ...world, pondSince: next };
}

/** The ducks and frogs on the mature ponds near a point, at a clock time. */
export function pondGuests(world: Pick<WorldState, 'ponds' | 'pondSince' | 'clock'>, x: number, z: number): Animal[] {
  const out: Animal[] = [];
  for (const p of world.ponds) {
    if (!matureAt(world.pondSince, p.spot, world.clock)) continue;
    const mx = p.x0 + (p.n * POND_CELL) / 2;
    const mz = p.z0 + (p.n * POND_CELL) / 2;
    if (Math.hypot(mx - x, mz - z) > NEAR + (p.n * POND_CELL) / 2) continue;
    for (const g of guestsOf(p)) {
      if (!isAbout(g.home, world.clock)) continue;
      const q = placeAt(g.home, world.clock, g.radius);
      if (Math.hypot(q.x - x, q.z - z) > NEAR) continue;
      out.push({ id: g.id, kind: g.home.kind, x: q.x, y: g.level, z: q.z, heading: q.heading, moving: q.moving });
    }
  }
  return out;
}
