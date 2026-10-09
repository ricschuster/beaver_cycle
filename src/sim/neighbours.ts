// Other beaver families of the valley (docs/design/24_npcs_and_animals.md, slice 2). A family is a whole lodge on a pond, a
// mama and a papa, and the kits of the last two springs. Like the parents of a former home they keep the lodge up, so
// nothing of theirs wears. Where each beaver is and how old is a pure function of the clock, so a sleep or a long
// skip needs no catch-up and only the beavers near the player are ever worked out. No three.js and no DOM here.
import { DAY_SECONDS, DAYS_PER_YEAR, isNight } from './clock';
import { COAT_COUNT, kitCoat, pondPlace, pondParts, type Coat } from './family';
import { lifeAt, STAGE_RULES, type Stage } from './life';
import { LODGE_WOOD, findSite, type Lodge } from './lodge';
import type { Terrain } from './terrain';

export interface Neighbour {
  id: string;
  /** The whole lodge the family lives in. It never wears. */
  lodge: Lodge;
  /** Mama's and Papa's coats. */
  parents: readonly [Coat, Coat];
  /** Fixes the litters and their coats. */
  seed: number;
}

/** What a neighbour beaver is doing. Sleep is not listed: a sleeper is in the lodge and not drawn. More tasks come with the next slice. */
export type NeighbourTask = 'swim' | 'rest';

export interface NeighbourBeaver {
  id: string;
  family: string;
  role: 'mama' | 'papa' | 'kit';
  stage: Stage;
  coat: Coat;
  x: number;
  y: number;
  z: number;
  heading: number;
  /** 0 resting, 1 on the move. */
  pace: number;
  task: NeighbourTask;
  /** Size of the model against an adult. */
  scale: number;
}

/** A family lodge is at least this far from the home (metres), and from the other families. */
export const NEIGHBOUR_MIN_FROM_HOME = 120;
export const NEIGHBOUR_MIN_APART = 150;
/** The pond round the lodge must have this many parts to swim in (see `pondParts`). */
const MIN_PARTS = 4;
/** Kits in a litter: one to three. A litter is born on the first day of each year (the first day of spring, note 23). */
const MAX_LITTER = 3;
/** A kit grows into an adult after the baby and teenager stages, and then leaves the family. */
const KIT_SEASON = DAYS_PER_YEAR;

function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

/** The ground is cut into cells this wide (metres); a cell may hold one family. */
export const FAMILY_CELL = 400;
/** A cell is looked at once the player is within this many metres of its middle, where the fine tiles are loaded (ADR 0006). */
export const GROW_REACH = 450;
/** How far from the middle of a cell the lodge may stand (metres). */
const SITE_RADIUS = 200;
/** One cell in this many hosts a family. */
const HOST_ONE_IN = 2;

/**
 * Families on the ponds and shores of the valley, found as the player comes near. Far tiles are not loaded (ADR 0006), so the water
 * cannot be read from the start; and what is read later is the same every time. A cell hosts a family if its hash says so and a lodge
 * can stand within 200 m of its middle, with water round it wide enough to swim in, far enough from the home and from the other
 * families. `tried` holds the cells already looked at, so each is read once. Returns `families` itself when nothing was added.
 */
export function growNeighbours(families: readonly Neighbour[], ground: Terrain, at: { x: number; z: number }, home: { x: number; z: number }, tried: Set<string>): readonly Neighbour[] {
  let out = families;
  const r = Math.ceil(GROW_REACH / FAMILY_CELL);
  const c0x = Math.floor(at.x / FAMILY_CELL);
  const c0z = Math.floor(at.z / FAMILY_CELL);
  const key = Math.round(home.x * 3 + home.z * 7);
  for (let cz = c0z - r; cz <= c0z + r; cz++) {
    for (let cx = c0x - r; cx <= c0x + r; cx++) {
      const id = `${cx}:${cz}`;
      const mx = (cx + 0.5) * FAMILY_CELL;
      const mz = (cz + 0.5) * FAMILY_CELL;
      if (tried.has(id) || Math.hypot(mx - at.x, mz - at.z) > GROW_REACH) continue;
      tried.add(id);
      if (hash(cx, cz + key) % HOST_ONE_IN !== 0) continue;
      const lodge = findSite(ground, mx, mz, SITE_RADIUS);
      if (!lodge || pondParts(lodge, ground).length < MIN_PARTS) continue;
      const apart = (o: { x: number; z: number }, min: number): boolean => Math.hypot(o.x - lodge.x, o.z - lodge.z) >= min;
      if (!apart(home, NEIGHBOUR_MIN_FROM_HOME) || !out.every((o) => apart(o.lodge, NEIGHBOUR_MIN_APART))) continue;
      out = [
        ...out,
        {
          id: `family:${id}`,
          lodge: { ...lodge, wood: LODGE_WOOD },
          parents: [{ coat: hash(cx, cz + key + 12) % COAT_COUNT, shade: 0 }, { coat: hash(cx, cz + key + 13) % COAT_COUNT, shade: 0 }],
          seed: hash(cx, cz + key + 14),
        },
      ];
    }
  }
  return out;
}

/** The kits of the litter born in year `year`: how many, and when they were born (game seconds). */
function litter(n: Neighbour, year: number): { id: string; bornAt: number; coat: Coat }[] {
  const size = 1 + (hash(n.seed, year) % MAX_LITTER);
  const bornAt = year * DAYS_PER_YEAR * DAY_SECONDS;
  return Array.from({ length: size }, (_, k) => ({ id: `${n.id}:kit:${year}:${k}`, bornAt, coat: kitCoat(n.parents, hash(n.seed, year * 8 + k + 100)) }));
}

/** The beavers of the families at a clock value: those awake and in the pond. At night everyone sleeps in the lodge. */
export function neighboursAt(families: readonly Neighbour[], clock: number, ground: Terrain): NeighbourBeaver[] {
  if (families.length === 0 || isNight(clock)) return [];
  const out: NeighbourBeaver[] = [];
  for (const n of families) {
    const parts = pondParts(n.lodge, ground);
    if (parts.length === 0) continue;
    const place = (i: number) => pondPlace(n.lodge, parts, ground, clock, i);
    const adult = (role: 'mama' | 'papa', i: number): NeighbourBeaver => {
      const p = place(i);
      return { id: `${n.id}:${role}`, family: n.id, role, stage: 'adult', coat: n.parents[i]!, x: p.x, y: p.y, z: p.z, heading: p.heading, pace: p.pace, task: p.pace > 0 ? 'swim' : 'rest', scale: STAGE_RULES.adult.scale };
    };
    out.push(adult('mama', 0), adult('papa', 1));
    const year = Math.floor(clock / (DAYS_PER_YEAR * DAY_SECONDS));
    // The litter of last spring is still young; the one before it has grown up and gone.
    let slot = 2;
    for (const y of [year - 1, year]) {
      for (const kit of litter(n, y)) {
        const life = lifeAt(clock, kit.bornAt);
        if (kit.bornAt > clock || life.stage === 'adult' || life.ageDays > KIT_SEASON * 2) continue;
        const p = place(slot++);
        out.push({ id: kit.id, family: n.id, role: 'kit', stage: life.stage, coat: kit.coat, x: p.x, y: p.y, z: p.z, heading: p.heading, pace: p.pace, task: p.pace > 0 ? 'swim' : 'rest', scale: STAGE_RULES[life.stage].scale });
      }
    }
  }
  return out;
}
