// Ambient animals of the valley (docs/design/24_npcs_and_animals.md, slice 1). Nothing is stored: the ground is cut
// into square cells, and a cell's animal follows from the cell, so every device and every visit gives the same
// animals. Where an animal is at a time is a function of the clock (like `wear.ts`), so a sleep needs no catch-up.
// No threat and no interaction yet. No three.js and no DOM here.
import { COVER_FOREST, COVER_MEADOW, type Terrain } from './terrain';
import { dateAt, isNight } from './clock';

export type AnimalKind = 'deer' | 'fox' | 'duck' | 'heron' | 'owl' | 'lynx' | 'bear';

export interface Animal {
  /** Stable while the animal is near: the cell it belongs to. */
  id: string;
  kind: AnimalKind;
  x: number;
  /** Height to draw it at: the ground, or the water surface for a duck. */
  y: number;
  z: number;
  /** Radians, the way the animal faces (atan2(dx, dz), like the beaver's). */
  heading: number;
  /** True while it walks or paddles, false while it grazes, stands, or rests. */
  moving: boolean;
}

/** Side of a cell in metres. A cell holds at most one animal. */
export const CELL = 60;
/** Animals are made for cells within this many metres of the player. */
export const ANIMAL_RADIUS = 150;
/** The most animals alive at once, nearest first. A proposal: to settle by measuring on the tablet (note 24, question 3). */
export const MAX_ANIMALS = 40;
/** The cap when the frame rate has fallen (see `capFor`). */
export const MIN_ANIMALS = 16;

/** How wide each kind wanders around its home (metres) and how fast it moves along its path (radians per second). */
const WANDER: Record<AnimalKind, { radius: number; rate: number }> = {
  deer: { radius: 10, rate: 0.05 },
  fox: { radius: 14, rate: 0.12 },
  duck: { radius: 12, rate: 0.07 },
  heron: { radius: 1.5, rate: 0.03 },
  owl: { radius: 1, rate: 0.02 },
  lynx: { radius: 6, rate: 0.03 },
  bear: { radius: 8, rate: 0.04 },
};

/** Chance that a cell holds an animal at all, and the share of those that are each kind, for land and for water cells. */
const CHANCE = 0.55;

function hash(a: number, b: number, salt: number): number {
  let h = (Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(salt, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** An animal's fixed side: where it lives and how its path goes. */
interface Home {
  kind: AnimalKind;
  x: number;
  z: number;
  /** Phase of the path, so animals do not move in step. */
  phase: number;
  /** Where in [0, 1) the animal sits among its cell's neighbours when the season thins them out. */
  luck: number;
}

const RING = 8;
/** Spots tried in a cell for a kind. A shore is a narrow strip of a cell, so the heron needs many. */
const TRIES = 16;

/** True when a point suits the kind: deer and fox on dry land (meadow when the ground tells), duck on shallow water, heron on a shore. */
function suits(kind: AnimalKind, t: Terrain, x: number, z: number): boolean {
  const water = t.isWater(x, z);
  if (kind === 'duck') {
    const d = t.waterDepth(x, z);
    return water && d >= 0.4 && d <= 3;
  }
  if (water) return false;
  // An owl perches in the forest, and the lynx and the bear live there (anywhere dry where the ground has no land cover).
  if (kind === 'owl' || kind === 'lynx' || kind === 'bear') {
    const cover = t.coverAt?.(x, z);
    return cover === undefined || cover === COVER_FOREST;
  }
  if (kind === 'heron') {
    // On the bank with the water at its feet.
    return [[5, 0], [-5, 0], [0, 5], [0, -5], [3.5, 3.5], [-3.5, 3.5], [3.5, -3.5], [-3.5, -3.5]].some(([dx, dz]) => t.isWater(x + dx!, z + dz!));
  }
  const cover = t.coverAt?.(x, z);
  return cover === undefined || cover === COVER_MEADOW || kind === 'fox';
}

/** True when the whole path of the kind round its home suits it, so an animal never walks into the lake or a wood. */
function pathSuits(kind: AnimalKind, t: Terrain, x: number, z: number): boolean {
  if (!suits(kind, t, x, z)) return false;
  const r = WANDER[kind].radius;
  if (kind === 'heron' || kind === 'owl') return true;
  for (let i = 0; i < RING; i++) {
    const a = (i / RING) * Math.PI * 2;
    if (!suits(kind, t, x + Math.cos(a) * r, z + Math.sin(a) * r)) return false;
  }
  return true;
}

/** The home of the animal of a cell, or null when the cell holds none. */
export function homeOf(t: Terrain, cx: number, cz: number): Home | null {
  if (hash(cx, cz, 1) >= CHANCE) return null;
  const pick = hash(cx, cz, 2);
  // Which kinds the cell is tried with, in order: the first that has a spot wins.
  // The last seventh of cells are the forest's: mostly owls, then lynx, then bears.
  const wood = hash(cx, cz, 5);
  const woodKind: AnimalKind = wood < 0.7 ? 'owl' : wood < 0.85 ? 'lynx' : 'bear';
  const order: AnimalKind[] = pick < 0.35 ? ['deer', 'fox'] : pick < 0.5 ? ['fox', 'deer'] : pick < 0.8 ? ['duck', 'heron'] : pick < 0.93 ? ['heron', 'duck'] : [woodKind, 'fox'];
  for (const kind of order) {
    for (let i = 0; i < TRIES; i++) {
      const x = (cx + hash(cx, cz, 10 + i * 2)) * CELL;
      const z = (cz + hash(cx, cz, 11 + i * 2)) * CELL;
      if (pathSuits(kind, t, x, z)) return { kind, x, z, phase: hash(cx, cz, 3) * Math.PI * 2, luck: hash(cx, cz, 4) };
    }
  }
  return null;
}

/** The lynx comes out at this part of the day (dusk is at 0.625 less a little) and stays out through the night. */
const LYNX_FROM = 0.5;

/** Whether the animal is about at a clock time: the valley is quieter in winter, and deer and ducks rest at night. */
export function isAbout(home: Home, clock: number): boolean {
  const winter = dateAt(clock).season === 'winter';
  if (winter && (home.kind === 'duck' || home.kind === 'heron') && home.luck < 0.6) return false;
  if (winter && home.kind === 'deer' && home.luck < 0.2) return false;
  // The owl is about only at night, the lynx from dusk to dawn, and the bear from spring to autumn (it sleeps the winter through).
  if (home.kind === 'owl') return isNight(clock);
  if (home.kind === 'lynx') return dateAt(clock).timeOfDay >= LYNX_FROM;
  if (home.kind === 'bear') return !winter;
  if (isNight(clock) && (home.kind === 'duck' || home.kind === 'heron') && home.luck < 0.5) return false;
  return true;
}

function placeAt(home: Home, clock: number): { x: number; z: number; heading: number; moving: boolean } {
  const { radius, rate } = WANDER[home.kind];
  const a = clock * rate + home.phase;
  const x = home.x + Math.sin(a) * radius;
  const z = home.z + Math.sin(a * 2) * radius * 0.5;
  // The heading is the way the path runs.
  const dx = Math.cos(a) * radius;
  const dz = Math.cos(a * 2) * radius;
  // A part of each loop is spent grazing or standing, and the heron and owl stand.
  const moving = home.kind === 'heron' || home.kind === 'owl' ? false : Math.sin(a * 3.1 + home.phase) > -0.2;
  return { x, z, heading: Math.atan2(dx, dz), moving };
}

/** Fewer animals when the frame rate is low: `fps` is the measured frame rate, 45 or more keeps the full cap. */
export function capFor(fps: number): number {
  if (fps >= 45) return MAX_ANIMALS;
  if (fps <= 20) return MIN_ANIMALS;
  return Math.round(MIN_ANIMALS + ((fps - 20) / 25) * (MAX_ANIMALS - MIN_ANIMALS));
}

/** Makes the animals around a point from the cells, keeping the homes it has worked out for the cells near the player. */
export class AnimalField {
  private readonly homes = new Map<string, Home | null>();

  /** The animals within `radius` of (x, z) at a clock time, nearest first, at most `cap` of them. */
  near(t: Terrain, x: number, z: number, clock: number, cap = MAX_ANIMALS, radius = ANIMAL_RADIUS): Animal[] {
    const r = Math.ceil(radius / CELL);
    const c0x = Math.floor(x / CELL);
    const c0z = Math.floor(z / CELL);
    const found: { a: Animal; d: number }[] = [];
    for (let cz = c0z - r; cz <= c0z + r; cz++) {
      for (let cx = c0x - r; cx <= c0x + r; cx++) {
        const key = `${cx}:${cz}`;
        let home = this.homes.get(key);
        if (home === undefined) {
          home = homeOf(t, cx, cz);
          this.homes.set(key, home);
        }
        if (!home || !isAbout(home, clock)) continue;
        const p = placeAt(home, clock);
        const d = Math.hypot(p.x - x, p.z - z);
        if (d > radius) continue;
        const ground = t.heightAt(p.x, p.z);
        const y = home.kind === 'duck' ? ground + t.waterDepth(p.x, p.z) : ground;
        found.push({ a: { id: key, kind: home.kind, x: p.x, y, z: p.z, heading: p.heading, moving: p.moving }, d });
      }
    }
    found.sort((a, b) => a.d - b.d);
    return found.slice(0, cap).map((f) => f.a);
  }

  /** Forgets the homes of cells far from a point, so a long walk does not grow the cache for ever. */
  trim(x: number, z: number, radius = ANIMAL_RADIUS * 3): void {
    for (const key of this.homes.keys()) {
      const [cx, cz] = key.split(':').map(Number);
      if (Math.hypot((cx! + 0.5) * CELL - x, (cz! + 0.5) * CELL - z) > radius) this.homes.delete(key);
    }
  }
}
