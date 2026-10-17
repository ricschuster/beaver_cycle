// Scent mounds and the visitor they bring (#583, docs/design/35_scent_mounds_and_visitors.md). A beaver pats a load of mud
// into a mound on the bank by its lodge, and the next morning a beaver of the valley comes to sniff it. It stays near the mound
// for good. Where the visitor is follows from the mound and the clock alone, so nothing of it is saved but the mounds and the
// ones the player has welcomed. No three.js and no DOM here.
import { DAY_SECONDS, isNight } from './clock';
import { COAT_COUNT } from './family';
import { lodgeComplete } from './lodge';
import { nameOf } from './names';
import type { NeighbourBeaver } from './neighbours';
import type { Terrain } from './terrain';
import type { WorldState } from './state';

/** A mound the beaver made: where, and the game clock it was made at. */
export interface ScentMound {
  id: string;
  x: number;
  z: number;
  madeAt: number;
}

/** A lodge has at most this many mounds, each at least `SCENT_APART` metres from the others and within `SCENT_NEAR_LODGE` of the lodge. First guesses. */
export const SCENT_MAX = 3;
export const SCENT_APART = 6;
export const SCENT_NEAR_LODGE = 30;
/** The visitor comes this early after dawn on the day after the mound was made, as a part of the day (10 to 30 per cent). */
const ARRIVE_FROM = 0.1;
const ARRIVE_SPREAD = 0.2;
/** The visitor walks in from this far (metres) over this long (seconds), and then stands this far from the mound. */
const APPROACH = 20;
export const WALK_IN = 12;
const STAND = 1.6;
/** Standing this close to the visitor (metres) welcomes it. */
export const WELCOME_DISTANCE = 7;
/** Ground with more water than this (metres) is not walked on. */
const DRY = 0.3;

function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

const hashOf = (m: ScentMound): number => hash(Math.round(m.x * 10), Math.round(m.z * 10));

/** True when the beaver can pat a scent mound here: mud in the mouth, on the bank near its whole lodge, with room for another, away from the others. */
export function canMark(world: Pick<WorldState, 'lodge' | 'haul' | 'scents' | 'inLodge' | 'beaver'>): boolean {
  const { lodge, beaver: b } = world;
  if (world.haul?.kind !== 'mud' || world.inLodge || b.mode !== 'walk' || !lodgeComplete(lodge)) return false;
  if (world.scents.length >= SCENT_MAX || Math.hypot(b.x - lodge.x, b.z - lodge.z) > SCENT_NEAR_LODGE) return false;
  return world.scents.every((m) => Math.hypot(m.x - b.x, m.z - b.z) >= SCENT_APART);
}

/** The mound a press of Mark makes where the beaver stands. */
export const newMound = (b: { x: number; z: number }, time: number, clock: number): ScentMound => ({ id: `scent:${time.toFixed(3)}`, x: b.x, z: b.z, madeAt: clock });

/** When the visitor of a mound comes: the morning after it was made, a little after dawn. */
export const arrivesAt = (m: ScentMound): number => (Math.floor(m.madeAt / DAY_SECONDS) + 1 + ARRIVE_FROM + (ARRIVE_SPREAD * (hashOf(m) % 100)) / 100) * DAY_SECONDS;

/** The way the visitor comes: the first of eight bearings, from one the mound's place picks, where the ground is dry from the mound out to where it starts. Null when none is. */
function bearing(m: ScentMound, ground: Terrain): number | null {
  const first = hashOf(m) % 8;
  for (let k = 0; k < 8; k++) {
    const a = ((first + k) * Math.PI) / 4;
    const dry = [STAND, APPROACH / 2, APPROACH].every((r) => ground.waterDepth(m.x + Math.sin(a) * r, m.z + Math.cos(a) * r) < DRY);
    if (dry) return a;
  }
  return null;
}

/**
 * The visitor of a mound as drawn by day, or null before it comes and at night (it sleeps then). It walks in over `WALK_IN` seconds
 * and then stands by the mound, sniffing it, and grooms once welcomed. Its coat, name and sex follow from the mound.
 */
export function visitorAt(m: ScentMound, welcomed: readonly string[], clock: number, ground: Terrain): NeighbourBeaver | null {
  const t = clock - arrivesAt(m);
  if (t < 0 || isNight(clock)) return null;
  const h = hashOf(m);
  const a = bearing(m, ground);
  const walking = a !== null && t < WALK_IN;
  const r = a === null ? 0 : walking ? APPROACH + (STAND - APPROACH) * (t / WALK_IN) : STAND;
  const x = m.x + (a === null ? 0 : Math.sin(a) * r);
  const z = m.z + (a === null ? 0 : Math.cos(a) * r);
  const id = `visitor:${m.id}`;
  return {
    id,
    name: nameOf(id),
    family: id,
    role: h % 2 === 0 ? 'papa' : 'mama',
    stage: 'adult',
    coat: { coat: h % COAT_COUNT, shade: 0 },
    x,
    y: ground.heightAt(x, z),
    z,
    heading: a === null ? 0 : Math.atan2(-Math.sin(a), -Math.cos(a)),
    pace: walking ? 1 : 0,
    task: walking ? 'swim' : welcomed.includes(m.id) ? 'groom' : 'rest',
    errand: 'rest',
    carry: null,
    mode: 'walk',
    scale: 1,
  };
}

/** The visitors to draw now, one for each mound whose beaver has come. */
export const visitorsAt = (scents: readonly ScentMound[], welcomed: readonly string[], clock: number, ground: Terrain): NeighbourBeaver[] =>
  scents.flatMap((m) => visitorAt(m, welcomed, clock, ground) ?? []);

/** The list of welcomed mounds, with those whose visitor has come and stands by its mound, with the beaver near, added. The same list when none is. */
export function welcomeNear(welcomed: string[], scents: readonly ScentMound[], b: { x: number; z: number }, clock: number, ground: Terrain): string[] {
  const more = scents
    .filter((m) => !welcomed.includes(m.id))
    .filter((m) => {
      const v = visitorAt(m, welcomed, clock, ground);
      return v !== null && v.pace === 0 && Math.hypot(v.x - b.x, v.z - b.z) <= WELCOME_DISTANCE;
    })
    .map((m) => m.id);
  return more.length ? [...welcomed, ...more] : welcomed;
}
