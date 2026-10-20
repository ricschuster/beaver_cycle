// Other beaver families of the valley (docs/design/24_npcs_and_animals.md, slice 2). A family is a whole lodge on a pond, a
// mama and a papa, and the kits of the last two springs. Like the parents of a former home they keep the lodge up, so
// nothing of theirs wears. Where each beaver is and how old is a pure function of the clock, so a sleep or a long
// skip needs no catch-up and only the beavers near the player are ever worked out. No three.js and no DOM here.
import { nameOf } from './names';
import { DAY_SECONDS, DAYS_PER_YEAR, isNight } from './clock';
import { COAT_COUNT, kitCoat, pondParts, type Coat } from './family';
import { lifeAt, STAGE_RULES, type Stage } from './life';
import { LODGE_WOOD, findSite, type Lodge } from './lodge';
import { routineAt, type RoutineMember } from './routines';
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

/**
 * What a beaver of a family is doing this moment (`routines.ts`): swimming or walking somewhere, resting, eating, gnawing a
 * branch on the bank, carrying a load, patting it onto the dam, the lodge or the store, grooming, or playing. Sleep is not
 * listed: a sleeper is in the lodge and not drawn.
 */
export type NeighbourTask = 'swim' | 'rest' | 'eat' | 'gnaw' | 'carry' | 'build' | 'groom' | 'play';

/**
 * The errand a beaver is on, the reason for its task: mending the dam, filling the winter food store, patting mud on the
 * lodge, eating, watching or calling the kits (for a kit: keeping by its parent), playing, or resting.
 */
export type NeighbourErrand = 'dam' | 'store' | 'lodge' | 'food' | 'kits' | 'play' | 'rest';

/** What a beaver holds in its mouth or paws. */
export type NeighbourCarry = 'branch' | 'lily' | 'mud' | null;

export interface NeighbourBeaver {
  id: string;
  /** The beaver's own name (`names.ts`). */
  name: string;
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
  /** The errand the task is part of: its reason. */
  errand: NeighbourErrand;
  carry: NeighbourCarry;
  /** Walking on the bank or swimming. Missing means swimming. */
  mode?: 'walk' | 'swim';
  /** Size of the model against an adult. */
  scale: number;
  /** Hat, scarf, and tail of a friend's beaver (`guests.ts`); the families have none. */
  look?: { hat: number; scarf: number; tail: number };
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

/** The four other families of a new game (note 42): lodges 50 to 200 m from the home, at least this far from it and from each other. */
export const START_FAMILIES = 4;
const START_APART = 50;
const START_RINGS = [90, 130, 170, 210];

/**
 * The families beside the player's home at the start of a game, so five lodges stand close together and a late friend can take a
 * free one. Sites are looked for on rings round the home in eight directions, nearest ring first, the same every time. Fewer than
 * four come back where the water allows no more. They age with the clock like the other families (`neighboursAt`).
 */
export function startFamilies(ground: Terrain, home: { x: number; z: number }): Neighbour[] {
  const out: Neighbour[] = [];
  const key = Math.round(home.x * 3 + home.z * 7);
  for (const r of START_RINGS) {
    for (let i = 0; i < 8 && out.length < START_FAMILIES; i++) {
      const a = ((i + (hash(r, key) % 8) / 8) * Math.PI) / 4;
      const lodge = findSite(ground, home.x + Math.sin(a) * r, home.z + Math.cos(a) * r, 40);
      if (!lodge || pondParts(lodge, ground).length < MIN_PARTS) continue;
      const apart = (o: { x: number; z: number }): boolean => Math.hypot(o.x - lodge.x, o.z - lodge.z) >= START_APART;
      if (!apart(home) || !out.every((o) => apart(o.lodge))) continue;
      const n = out.length;
      out.push({
        id: `family:start:${n}`,
        lodge: { ...lodge, wood: LODGE_WOOD },
        parents: [{ coat: hash(n, key + 22) % COAT_COUNT, shade: 0 }, { coat: hash(n, key + 23) % COAT_COUNT, shade: 0 }],
        seed: hash(n, key + 24),
      });
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

/** The beavers of the families at a clock value: those awake, each on its errand (`routines.ts`). At night everyone sleeps in the lodge. */
export function neighboursAt(families: readonly Neighbour[], clock: number, ground: Terrain): NeighbourBeaver[] {
  if (families.length === 0 || isNight(clock)) return [];
  const out: NeighbourBeaver[] = [];
  for (const n of families) {
    const parts = pondParts(n.lodge, ground);
    if (parts.length === 0) continue;
    const members: (RoutineMember & { coat: Coat })[] = [
      { id: `${n.id}:mama`, role: 'mama', stage: 'adult', coat: n.parents[0] },
      { id: `${n.id}:papa`, role: 'papa', stage: 'adult', coat: n.parents[1] },
    ];
    const year = Math.floor(clock / (DAYS_PER_YEAR * DAY_SECONDS));
    // The litter of last spring is still young; the one before it has grown up and gone.
    for (const y of [year - 1, year]) {
      for (const kit of litter(n, y)) {
        const life = lifeAt(clock, kit.bornAt);
        if (kit.bornAt > clock || life.stage === 'adult' || life.ageDays > KIT_SEASON * 2) continue;
        members.push({ id: kit.id, role: 'kit', stage: life.stage, coat: kit.coat });
      }
    }
    // The family's dam is not on the map, so its papa mends a stretch of the bank, where the dam would be.
    const doing = routineAt({ lodge: n.lodge, seed: n.seed, parts, dam: 'shore' }, members, clock, ground);
    members.forEach((m, i) => {
      const d = doing[i]!;
      out.push({ id: m.id, name: nameOf(m.id), family: n.id, role: m.role, stage: m.stage, coat: m.coat, x: d.x, y: d.y, z: d.z, heading: d.heading, pace: d.pace, task: d.task, errand: d.errand, carry: d.carry, mode: d.mode, scale: STAGE_RULES[m.stage].scale });
    });
  }
  return out;
}
