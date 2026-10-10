// How the animals meet the player (docs/design/24_npcs_and_animals.md, "Interaction with animals", #306 to #310). An
// animal has a trust toward the beaver, 0 to 1, kept in `world.trust` by animal id; the mood (wary, calm, curious) follows
// from it and shows in where the animal stands. Nothing here moves an animal for good: `react` places each animal for
// the frame from where it would be anyway, so it is a pure function of the world and needs no stored path.
// Read: deer bolt from a predator. Feed: food put down near a deer or duck is eaten and raises trust. A tail slap
// startles the animals near. A fox may sniff at the store at night. No three.js and no DOM here.
import { hash, type Animal, type AnimalKind } from './animals';
import { dateAt, isNight } from './clock';
import { stockTotal, storeSpot } from './food';
import { isPredator } from './predators';
import type { Terrain } from './terrain';
import type { WorldState } from './state';

export type Mood = 'wary' | 'calm' | 'curious';

/** The animals that have a mood. Predators do not (they have the chase rules), and neither does the owl. */
const MOODY: ReadonlySet<AnimalKind> = new Set<AnimalKind>(['deer', 'duck', 'heron', 'frog']);

/** Trust a kind starts with: deer and herons shy, ducks and frogs at ease. */
const START_TRUST: Partial<Record<AnimalKind, number>> = { deer: 0.1, duck: 0.35, heron: 0.1, frog: 0.5 };

/** Below this trust an animal is wary, from `CURIOUS_FROM` up curious, between calm. */
export const WARY_BELOW = 0.3;
export const CURIOUS_FROM = 0.7;

/** How far a wary animal keeps from the beaver, metres. A curious or calm one does not keep away. */
const KEEP_AWAY: Partial<Record<AnimalKind, number>> = { deer: 14, duck: 9, heron: 18, frog: 4 };
/** A curious deer or duck comes to look from this far, and stops this close (metres). */
export const CURIOUS_RANGE = 30;
export const CURIOUS_CLOSE = 5;
/** Deer bolt from a predator closer than this to them, to this far from it (metres). */
export const BOLT_RANGE = 32;
const BOLT_AWAY = 36;
/** Food put down within this many metres of a deer or duck is eaten, and raises its trust by `FEED_TRUST`. */
export const FEED_REACH = 16;
export const FEED_TRUST = 0.3;
/** A tail slap within this many metres startles the animals, who lose `SLAP_TRUST`. */
export const SLAP_STARTLE = 30;
export const SLAP_TRUST = 0.25;
/** A fox goes to the store at night when its home is this close to it (metres), on some days. */
const STORE_FOX_RANGE = 120;
const STORE_FOX_DAYS = 0.6;
/** A fox at the store stands this far from its centre. */
const STORE_FOX_AT = 2.8;

export const isMoody = (kind: AnimalKind): boolean => MOODY.has(kind);

/** Trust of an animal in [0, 1], or of its kind when the beaver has not met it. */
export function trustOf(world: Pick<WorldState, 'trust'>, a: Pick<Animal, 'id' | 'kind'>): number {
  return world.trust[a.id] ?? START_TRUST[a.kind] ?? 0.5;
}

export function moodOf(trust: number): Mood {
  return trust < WARY_BELOW ? 'wary' : trust >= CURIOUS_FROM ? 'curious' : 'calm';
}

export const moodOfAnimal = (world: Pick<WorldState, 'trust'>, a: Pick<Animal, 'id' | 'kind'>): Mood => moodOf(trustOf(world, a));

/** True when the animal stands where its kind belongs: ducks and frogs on water, the others on dry land. */
function belongs(kind: AnimalKind, t: Terrain, x: number, z: number): boolean {
  const water = t.waterDepth(x, z) >= 0.3;
  return kind === 'duck' || kind === 'frog' ? water : !water;
}

function placed(a: Animal, x: number, z: number, heading: number, moving: boolean, t: Terrain): Animal {
  const ground = t.heightAt(x, z);
  const y = a.kind === 'duck' || a.kind === 'frog' ? ground + t.waterDepth(x, z) : ground;
  return { ...a, x, y, z, heading, moving };
}

/** Moves the animal along the line from a point so it is at least `min` metres from it, if that stays on its kind's ground. */
function pushedFrom(a: Animal, from: { x: number; z: number }, min: number, t: Terrain): Animal {
  const dx = a.x - from.x;
  const dz = a.z - from.z;
  const d = Math.hypot(dx, dz);
  if (d >= min) return a;
  const heading = d > 0.01 ? Math.atan2(dx, dz) : a.heading;
  const x = from.x + Math.sin(heading) * min;
  const z = from.z + Math.cos(heading) * min;
  if (!belongs(a.kind, t, x, z)) return { ...a, heading, moving: true };
  return placed(a, x, z, heading, true, t);
}

/**
 * The animals as they stand for this frame given their mood and the predators about. A deer within `BOLT_RANGE` of a
 * predator bolts away from it (so bolting deer mean a predator is near). A wary animal keeps its distance from the beaver, a
 * calm one lets it come close, and a curious deer or duck comes to look.
 */
export function react(animals: readonly Animal[], world: Pick<WorldState, 'trust' | 'beaver'>, t: Terrain): Animal[] {
  const threats = animals.filter((a) => isPredator(a.kind));
  const b = world.beaver;
  return animals.map((a) => {
    if (!isMoody(a.kind)) return a;
    let out = a;
    if (a.kind === 'deer') {
      for (const p of threats) if (Math.hypot(a.x - p.x, a.z - p.z) < BOLT_RANGE) out = pushedFrom(out, p, BOLT_AWAY, t);
    }
    const mood = moodOfAnimal(world, a);
    const away = KEEP_AWAY[a.kind];
    if (mood === 'wary' && away) return pushedFrom(out, b, away, t);
    if (mood === 'curious' && (a.kind === 'deer' || a.kind === 'duck')) {
      const dx = b.x - out.x;
      const dz = b.z - out.z;
      const d = Math.hypot(dx, dz);
      if (d >= CURIOUS_RANGE || d <= CURIOUS_CLOSE) return out;
      // Part of the way from where it would be to a spot just short of the beaver, more the nearer the beaver is.
      const k = 1 - d / CURIOUS_RANGE;
      const stop = { x: b.x - (dx / d) * CURIOUS_CLOSE, z: b.z - (dz / d) * CURIOUS_CLOSE };
      const x = out.x + (stop.x - out.x) * k;
      const z = out.z + (stop.z - out.z) * k;
      if (!belongs(out.kind, t, x, z)) return out;
      return placed(out, x, z, Math.atan2(dx, dz), d > CURIOUS_CLOSE + 4, t);
    }
    return out;
  });
}

/** A deer near the beaver that is bolting from a predator, or null. The game tells the player once, so the sign can be read. */
export function boltingDeer(animals: readonly Animal[], world: Pick<WorldState, 'beaver'>): Animal | null {
  const threats = animals.filter((a) => isPredator(a.kind));
  const b = world.beaver;
  return animals.find((a) => a.kind === 'deer' && Math.hypot(a.x - b.x, a.z - b.z) < 60 && threats.some((p) => Math.hypot(a.x - p.x, a.z - p.z) < BOLT_AWAY + 1)) ?? null;
}

const withTrust = (world: WorldState, id: string, trust: number): WorldState => ({ ...world, trust: { ...world.trust, [id]: Math.max(0, Math.min(1, trust)) } });

/** A tail slap this step startles the moody animals within `SLAP_STARTLE`: they trust the beaver less. */
export function startle(world: WorldState, animals: readonly Animal[]): WorldState {
  let next = world;
  for (const a of animals) {
    if (!isMoody(a.kind) || Math.hypot(a.x - world.beaver.x, a.z - world.beaver.z) > SLAP_STARTLE) continue;
    next = withTrust(next, a.id, trustOf(next, a) - SLAP_TRUST);
  }
  return next;
}

/** What eats what: a deer takes a branch or a lily pad, a duck a lily pad. */
const EATS: Partial<Record<AnimalKind, readonly string[]>> = { deer: ['branch', 'lily'], duck: ['lily'] };

/**
 * Food the beaver put down (a branch or a lily pad lying on the ground) within `FEED_REACH` of a deer or duck is eaten by the
 * nearest one that takes it, which trusts the beaver more. Returns the world and the animals that fed.
 */
export function feedAnimals(world: WorldState, animals: readonly Animal[]): { world: WorldState; fed: Animal[] } {
  const fed: Animal[] = [];
  let next = world;
  const left = [];
  for (const d of world.dropped) {
    let best: Animal | null = null;
    let bestDist = FEED_REACH;
    if (d.kind === 'branch' || d.kind === 'lily') {
      for (const a of animals) {
        if (!EATS[a.kind]?.includes(d.kind)) continue;
        const dist = Math.hypot(a.x - d.x, a.z - d.z);
        if (dist <= bestDist) {
          best = a;
          bestDist = dist;
        }
      }
    }
    if (best) {
      fed.push(best);
      next = withTrust(next, best.id, trustOf(next, best) + FEED_TRUST);
    } else left.push(d);
  }
  return fed.length > 0 ? { world: { ...next, dropped: left }, fed } : { world, fed };
}

/** True when a fox of this id goes to the store on this game day: some nights, and never one that was scared off it. */
function visitsStore(world: Pick<WorldState, 'trust' | 'clock'>, id: string): boolean {
  if ((world.trust[id] ?? 1) <= 0) return false;
  const [cx, cz] = id.split(':').map(Number);
  return hash(cx ?? 0, cz ?? 0, 100 + dateAt(world.clock).day) < STORE_FOX_DAYS;
}

/** The point a fox sniffs at, the store, or null when it is day, the store holds nothing, or the lodge is not whole. */
export function storeFoxSpot(world: WorldState): { x: number; z: number } | null {
  if (!isNight(world.clock) || stockTotal(world.store) === 0) return null;
  return storeSpot(world.lodge);
}

/** The foxes that sniff at the store at night are moved there, standing and facing it. */
export function foxesAtStore(animals: readonly Animal[], world: WorldState, t: Terrain): Animal[] {
  const store = storeFoxSpot(world);
  if (!store) return animals as Animal[];
  return animals.map((a) => {
    if (a.kind !== 'fox' || Math.hypot(a.x - store.x, a.z - store.z) > STORE_FOX_RANGE || !visitsStore(world, a.id)) return a;
    return placed(a, store.x + STORE_FOX_AT, store.z, -Math.PI / 2, false, t);
  });
}

/** True when a point is at the store, where a fox sniffs. */
export function atStore(world: WorldState, p: { x: number; z: number }): boolean {
  const store = storeFoxSpot(world);
  return store !== null && Math.hypot(p.x - store.x, p.z - store.z) <= STORE_FOX_AT + 6;
}

/** A fox scared off the store does not come back: its trust is 0 (a wary fox). */
export function banishFox(world: WorldState, id: string): WorldState {
  return withTrust(world, id, 0);
}
