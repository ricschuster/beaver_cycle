// Mud and rocks for the dam (15_build_and_repair.md, 20_dams_and_ponds.md). The beaver carries one at a time in its
// mouth, like food. Mud is scooped from the wet bank or the shallows. Rocks are not stored in the world: each is worked
// out from a grid cell and the terrain, as the lily pads are, so the same rocks lie in the same places every time. A
// rock taken is noted by id. Plain data and pure functions, no three.js (ADR 0007).
import { DAY_SECONDS } from './clock';
import type { Food } from './food';
import { COVER_MEADOW, type Terrain } from './terrain';

/** What the beaver holds in its mouth besides food: mud, or a rock. */
export interface Haul {
  kind: 'mud' | 'rock';
}

/** Mud, a rock, or a piece of food the beaver put down: it lies where it was dropped, and can be picked up again. */
export interface Dropped {
  id: string;
  kind: 'mud' | 'rock' | Food;
  /** The game clock when it was put down, for rotting. */
  at: number;
  x: number;
  z: number;
}

/** How far ahead of the beaver, in metres, a piece is put down: in front of its mouth. */
export const DROP_AHEAD = 0.8;

/** Food put down rots away after this many game seconds, and mud dries and crumbles after its own. Rocks stay. Tuning numbers. */
export const FOOD_ROT = 2 * DAY_SECONDS;
export const MUD_DRY = 4 * DAY_SECONDS;

/** True once a put down piece has rotted or dried away by `clock`. Rocks never do. */
export const rotted = (d: Dropped, clock: number): boolean => d.kind !== 'rock' && clock - d.at >= (d.kind === 'mud' ? MUD_DRY : FOOD_ROT);

/** The piece put down by a beaver at (x, z) facing `heading`, with an id made from the game time and the clock it was put down at. */
export function putDown(haul: Haul | { kind: Food }, x: number, z: number, heading: number, time: number, clock: number): Dropped {
  return { id: `drop:${time.toFixed(3)}`, kind: haul.kind, at: clock, x: x + Math.sin(heading) * DROP_AHEAD, z: z + Math.cos(heading) * DROP_AHEAD };
}

/** The nearest put down piece within reach of a point, or null. */
export function reachableDropped(dropped: readonly Dropped[], x: number, z: number): Dropped | null {
  let best: Dropped | null = null;
  let bestDist = ROCK_REACH;
  for (const d of dropped) {
    const dist = Math.hypot(d.x - x, d.z - z);
    if (dist <= bestDist) {
      best = d;
      bestDist = dist;
    }
  }
  return best;
}

/** A rock is looked for in cells of this many metres a side, at most one a cell. */
export const ROCK_CELL = 10;
/** The share of cells that hold a rock, if the ground there is right. A tuning number. */
export const ROCK_CHANCE = 0.4;
/** The beaver reaches a rock within this many metres of its centre. */
export const ROCK_REACH = 1.8;
/** Radius of a rock in metres, for drawing. */
export const ROCK_RADIUS = 0.45;
/** Rocks lie on the stream bed or the bank, so water deeper than this has none (a lake floor, a pond). */
export const ROCK_MAX_DEPTH = 0.4;
/** Ground this steep (rise over run) is stony: rocks lie on it away from water. */
export const ROCK_STEEP = 0.5;
/** How far from a rock the bank and slope checks look, in metres. */
const LOOK = 3;

/** How far ahead of the beaver mud is scooped, in metres: the bank or the shallows at the water's edge. */
export const MUD_REACH = 1.2;
/** Water this deep (metres) counts as wet. */
const WET = 0.02;
/** A stream is wet this far (metres) from its centre line: the channel is 1 to 3 m wide. */
export const STREAM_HALF_WIDTH = 1.5;

export interface Rock {
  id: string;
  x: number;
  z: number;
}

/** A number from 0 up to but not including 1, the same for the same cell and salt. */
function hash(cx: number, cz: number, salt: number): number {
  let h = (Math.imul(cx, 374761393) + Math.imul(cz, 668265263) + Math.imul(salt, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Wet ground: shallow lake water, or in a stream. */
const wet = (terrain: Terrain, x: number, z: number): boolean => terrain.waterDepth(x, z) > WET || (terrain.streamDistance?.(x, z) ?? Infinity) <= STREAM_HALF_WIDTH;

/** True where a rock makes sense (Q76): on a stream bed or a bank, or on steep stony ground. Not on a lake floor, not on flat open ground, and not on a dry meadow (the stream bed itself may cross one). */
export function rockGround(terrain: Terrain, x: number, z: number): boolean {
  const depth = terrain.waterDepth(x, z);
  if (depth > ROCK_MAX_DEPTH) return false;
  if (wet(terrain, x, z)) return true;
  if (terrain.coverAt?.(x, z) === COVER_MEADOW) return false;
  const h = terrain.heightAt(x, z);
  for (const [dx, dz] of [[LOOK, 0], [-LOOK, 0], [0, LOOK], [0, -LOOK]] as const) {
    if (wet(terrain, x + dx, z + dz)) return true;
    if (Math.abs(terrain.heightAt(x + dx, z + dz) - h) / LOOK > ROCK_STEEP) return true;
  }
  return false;
}

/** The rocks within `radius` metres of a point that are still lying there: not in `taken`. */
export function rocksNear(terrain: Terrain, x: number, z: number, radius: number, taken: readonly string[] = []): Rock[] {
  const gone = new Set(taken);
  const rocks: Rock[] = [];
  const cx0 = Math.floor((x - radius) / ROCK_CELL);
  const cx1 = Math.floor((x + radius) / ROCK_CELL);
  const cz0 = Math.floor((z - radius) / ROCK_CELL);
  const cz1 = Math.floor((z + radius) / ROCK_CELL);
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cz = cz0; cz <= cz1; cz++) {
      if (hash(cx, cz, 20) >= ROCK_CHANCE) continue;
      const rx = (cx + 0.1 + 0.8 * hash(cx, cz, 21)) * ROCK_CELL;
      const rz = (cz + 0.1 + 0.8 * hash(cx, cz, 22)) * ROCK_CELL;
      if (Math.hypot(rx - x, rz - z) > radius) continue;
      const id = `rock:${cx}:${cz}`;
      if (gone.has(id) || !rockGround(terrain, rx, rz)) continue;
      rocks.push({ id, x: rx, z: rz });
    }
  }
  return rocks;
}

/** The nearest rock within reach of a point, or null. */
export function reachableRock(terrain: Terrain, x: number, z: number, taken: readonly string[]): Rock | null {
  let best: Rock | null = null;
  let bestDist = ROCK_REACH;
  for (const rock of rocksNear(terrain, x, z, ROCK_REACH, taken)) {
    const d = Math.hypot(rock.x - x, rock.z - z);
    if (d <= bestDist) {
      best = rock;
      bestDist = d;
    }
  }
  return best;
}

/** True when the beaver at (x, z) facing `heading` can scoop mud: it stands in the shallows or the water's edge is just ahead. */
export function canScoopMud(terrain: Terrain, x: number, z: number, heading: number): boolean {
  return wet(terrain, x, z) || wet(terrain, x + Math.sin(heading) * MUD_REACH, z + Math.cos(heading) * MUD_REACH);
}
