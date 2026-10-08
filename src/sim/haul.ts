// Mud and rocks for the dam (15_build_and_repair.md, 20_dams_and_ponds.md). The beaver carries one at a time in its
// mouth, like food. Mud is scooped from the wet bank or the shallows. Rocks are not stored in the world: each is worked
// out from a grid cell and the terrain, as the lily pads are, so the same rocks lie in the same places every time. A
// rock taken is noted by id. Plain data and pure functions, no three.js (ADR 0007).
import type { Terrain } from './terrain';

/** What the beaver holds in its mouth besides food: mud, or the rock with this id (so putting it down returns it). */
export type Haul = { kind: 'mud' } | { kind: 'rock'; id: string };

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

const wet = (terrain: Terrain, x: number, z: number): boolean => terrain.waterDepth(x, z) > WET;

/** True where a rock makes sense (Q76): on a stream bed or a bank, or on steep stony ground. Not on a lake floor, and not on flat open ground. */
export function rockGround(terrain: Terrain, x: number, z: number): boolean {
  const depth = terrain.waterDepth(x, z);
  if (depth > ROCK_MAX_DEPTH) return false;
  if (depth > WET) return true;
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
