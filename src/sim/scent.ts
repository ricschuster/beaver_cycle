// Scent mounds and the visitor they bring (#583, docs/design/35_scent_mounds_and_visitors.md). A beaver pats a load of mud
// into a mound on the bank by its lodge, and the next morning a beaver of the valley comes to sniff it. It stays near the mound
// for good. Where the visitor is follows from the mound and the clock alone, so nothing of it is saved but the mounds and the
// ones the player has welcomed. No three.js and no DOM here.
import { DAY_SECONDS, isNight } from './clock';
import { COAT_COUNT, pondParts } from './family';
import { LODGE_WOOD, findSite, lodgeComplete } from './lodge';
import { nameOf } from './names';
import type { Neighbour, NeighbourBeaver } from './neighbours';
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
/** The visitor stays this many days after it came, and then walks off. A mound dries and is gone after `MOUND_DAYS`. */
export const VISIT_DAYS = 3;
export const MOUND_DAYS = 4;
/** A welcomed visitor moves in on a pond within this far of its mound (metres), at least this far from the beaver's lodge and from other families. */
const SETTLE_RADIUS = 80;
const SETTLE_FROM_LODGE = 50;
const SETTLE_FROM_FAMILIES = 100;
/** The pond must have this many parts to swim in (see `pondParts`). */
const SETTLE_PARTS = 4;
/** A welcomed visitor, and the family it founds, trust the player this much from the start (curious, note 27). */
export const WELCOME_TRUST = 0.7;
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

/** When the visitor of a mound walks off again. */
export const departsAt = (m: ScentMound): number => arrivesAt(m) + VISIT_DAYS * DAY_SECONDS;

/** The family a welcomed visitor founds is named for its mound. */
export const settledId = (m: Pick<ScentMound, 'id'>): string => `settled:${m.id}`;

/** True once a mound has dried out: a few days after it was made. */
export const dried = (m: ScentMound, clock: number): boolean => clock - m.madeAt > MOUND_DAYS * DAY_SECONDS;

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
  const gone = clock - departsAt(m);
  if (t < 0 || gone > WALK_IN || isNight(clock)) return null;
  const h = hashOf(m);
  const a = bearing(m, ground);
  const arriving = a !== null && t < WALK_IN;
  const leaving = a !== null && gone > 0;
  const walking = arriving || leaving;
  const r = a === null ? 0 : arriving ? APPROACH + (STAND - APPROACH) * (t / WALK_IN) : leaving ? STAND + (APPROACH - STAND) * (gone / WALK_IN) : STAND;
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
    heading: a === null ? 0 : leaving ? Math.atan2(Math.sin(a), Math.cos(a)) : Math.atan2(-Math.sin(a), -Math.cos(a)),
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

/** The mounds that have not dried, and those of a welcomed visitor whose family has not settled yet. The same list when none is gone. */
export function keepMounds(scents: ScentMound[], welcomed: readonly string[], families: readonly Pick<Neighbour, 'id'>[], clock: number): ScentMound[] {
  const keep = (m: ScentMound): boolean => !dried(m, clock) || (welcomed.includes(m.id) && !families.some((f) => f.id === settledId(m)) && clock < departsAt(m) + WALK_IN + DAY_SECONDS * 30);
  return scents.every(keep) ? scents : scents.filter(keep);
}

/**
 * The family a welcomed visitor founds once it has walked off: a whole lodge on a pond near its mound, with the visitor as mama
 * or papa. Null when the pond is not found (the visitor just leaves).
 */
export function settleFamily(m: ScentMound, ground: Terrain, home: { x: number; z: number }, families: readonly Neighbour[]): Neighbour | null {
  const site = findSite(ground, m.x, m.z, SETTLE_RADIUS);
  if (!site || pondParts(site, ground).length < SETTLE_PARTS) return null;
  const apart = (o: { x: number; z: number }, min: number): boolean => Math.hypot(o.x - site.x, o.z - site.z) >= min;
  if (!apart(home, SETTLE_FROM_LODGE) || !families.every((f) => apart(f.lodge, SETTLE_FROM_FAMILIES))) return null;
  const h = hashOf(m);
  const mine = { coat: h % COAT_COUNT, shade: 0 };
  const mate = { coat: hash(h, 7) % COAT_COUNT, shade: 0 };
  return { id: settledId(m), lodge: { ...site, wood: LODGE_WOOD }, parents: h % 2 === 0 ? [mate, mine] : [mine, mate], seed: hash(h, 11) };
}
