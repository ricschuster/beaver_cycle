// Predators (docs/design/24_npcs_and_animals.md, slice 3): the fox, the owl, the lynx, the wolf, and the bear. An ambient animal of those kinds becomes a
// predator when it notices a beaver on land, and from then on it holds state (`world.predators`) until it walks off or
// the beaver is out of reach. Notice, chase, caught, hurt. Nothing here can end a life: being caught costs what the
// beaver carries and some speed, until a lily pad is eaten. No three.js and no DOM here.
import { ANIMAL_RADIUS, type Animal, type AnimalKind } from './animals';
import { DAY_SECONDS } from './clock';
import { putDown } from './haul';
import type { Terrain } from './terrain';
import type { WorldState } from './state';

export type PredatorKind = Extract<AnimalKind, 'fox' | 'owl' | 'lynx' | 'wolf' | 'bear'>;

/**
 * Where a predator is in its meeting with the beaver. `warn`: it has noticed the beaver and gives a sign (the owl calls, the
 * fox freezes) before it comes. `chase`: it runs or swoops at the beaver. `off`: it walks or flies away, and leaves the beaver alone.
 */
export type PredatorPhase = 'warn' | 'chase' | 'off';

export interface Predator {
  /** The id of the ambient animal it was (the cell), so that animal is not drawn twice. */
  id: string;
  kind: PredatorKind;
  x: number;
  z: number;
  /** Height above the ground in metres: an owl in flight is above it. */
  lift: number;
  /** Radians, the way it faces (atan2(dx, dz)). */
  heading: number;
  phase: PredatorPhase;
  /** Simulated time (`world.time`) the phase began. */
  since: number;
}

interface Rules {
  /** Metres within which it notices a beaver on land. */
  notice: number;
  /** Seconds of the sign before it comes. */
  warn: number;
  /** Metres per second in the chase and when going off. */
  chase: number;
  off: number;
  /** Seconds after which it gives up a chase. */
  giveUp: number;
  /** Metres per second it creeps toward the beaver while it gives its sign (the lynx stalks). */
  stalk: number;
  /** True when only a slap from the water's edge scares it: the lynx does not mind a beaver that is far from the water. */
  slapNeedsWater: boolean;
}

export const RULES: Record<PredatorKind, Rules> = {
  // The fox is a nuisance: it comes at a trot, a little slower than a walking adult, so it only catches a beaver that stands about.
  fox: { notice: 22, warn: 0.8, chase: 10, off: 4, giveUp: 10, stalk: 0, slapNeedsWater: false },
  // The owl gives a clear sign, then is fast, but it swoops once from a height and does not follow far.
  owl: { notice: 30, warn: 2.5, chase: 20, off: 8, giveUp: 5, stalk: 0, slapNeedsWater: false },
  // The lynx stalks: it creeps closer while it watches, then rushes, faster than a beaver, for a short way. Only the water saves the beaver.
  lynx: { notice: 26, warn: 3, chase: 16, off: 6, giveUp: 4, stalk: 2.5, slapNeedsWater: true },
  // The wolf stalks like the lynx but is slower, so a beaver with a start can reach the water. Only the water saves it, as from the lynx.
  wolf: { notice: 28, warn: 3, chase: 12, off: 6, giveUp: 6, stalk: 1.5, slapNeedsWater: true },
  // The bear is big and slow. It cannot catch a beaver that keeps moving, and it walks off when slapped at.
  bear: { notice: 20, warn: 2.5, chase: 5, off: 3, giveUp: 6, stalk: 0, slapNeedsWater: false },
};

/** The owl swoops from this height (metres) down to the beaver. */
const OWL_HEIGHT = 7;
/** Reached this close (metres), the beaver is caught. */
export const CATCH_DISTANCE = 1.2;
/** A tail slap within this many metres of a fox or an owl scares it off. */
export const SLAP_SCARE = 30;
/** A beaver this close (metres) to water is at the water's edge: a slap from there scares the lynx. */
const EDGE = 4;
/** A predator that is going off is forgotten after this many seconds, or once it is out of the animals' radius. */
const OFF_MAX = 180;
/** A hurt beaver is this part as fast (walking and swimming). */
export const HURT_SPEED = 0.6;
/** A hurt beaver mends by itself after this long (clock seconds) if no lily pad is eaten: one game day. */
export const HURT_TIME = DAY_SECONDS;

export function isPredator(kind: AnimalKind): kind is PredatorKind {
  return kind === 'fox' || kind === 'owl' || kind === 'lynx' || kind === 'wolf' || kind === 'bear';
}

/** True when water lies within a few metres of the beaver, on the bank or at a pond's edge. */
function atWaterEdge(b: { x: number; z: number }, ground: Terrain): boolean {
  return [[0, 0], [EDGE, 0], [-EDGE, 0], [0, EDGE], [0, -EDGE]].some(([dx, dz]) => ground.waterDepth(b.x + dx!, b.z + dz!) >= 0.4);
}

/** True while the beaver is hurt (`world.hurtAt` is the clock it was caught at). */
export function isHurt(hurtAt: number | null, clock: number): boolean {
  return hurtAt !== null && clock - hurtAt < HURT_TIME;
}

/** Speed factor from being hurt: 1 when well. */
export function hurtFactor(hurtAt: number | null, clock: number): number {
  return isHurt(hurtAt, clock) ? HURT_SPEED : 1;
}

/** What a predator did to the beaver this step, for the game to tell the player. */
export type PredatorEvent = { id: string; kind: PredatorKind; what: 'noticed' | 'caught' | 'scared' };

function toward(from: { x: number; z: number }, to: { x: number; z: number }): { d: number; heading: number } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return { d: Math.hypot(dx, dz), heading: Math.atan2(dx, dz) };
}

/** The beaver can be noticed and chased: it is on land and not in its lodge. In deep water or the lodge it is safe (Q69). */
export function exposed(world: WorldState): boolean {
  return world.beaver.mode === 'walk' && !world.inLodge;
}

function atEnd(p: Predator, to: Partial<Predator>): Predator {
  return { ...p, ...to };
}

/** Moves a predator `step` metres along `heading`, keeping an animal on the ground on dry land (it stops at the water's edge). */
function moved(p: Predator, heading: number, step: number, ground: Terrain): { x: number; z: number; blocked: boolean } {
  const x = p.x + Math.sin(heading) * step;
  const z = p.z + Math.cos(heading) * step;
  if (p.kind !== 'owl' && ground.waterDepth(x, z) >= 0.4) return { x: p.x, z: p.z, blocked: true };
  return { x, z, blocked: false };
}

/**
 * Meets the beaver with the predators for dt seconds, after the world has stepped. `animals` are the ambient animals around
 * the beaver (nearest first): a fox or owl among them that is close enough notices a beaver on land and becomes a predator.
 * `slapped` is true on the step the beaver slapped its tail. Pure: returns the new world and what happened.
 */
export function meetPredators(world: WorldState, animals: readonly Animal[], slapped: boolean, dt: number, ground: Terrain): { world: WorldState; events: PredatorEvent[] } {
  const events: PredatorEvent[] = [];
  const b = world.beaver;
  const safe = !exposed(world);
  let caught = false;
  const predators: Predator[] = [];
  for (const p of world.predators) {
    const rules = RULES[p.kind];
    const { d, heading } = toward(p, b);
    const age = world.time - p.since;
    // Out of the animals' reach: forgotten, and the ambient animal takes its place again.
    if (d > ANIMAL_RADIUS * 1.2) continue;
    if (p.phase === 'off') {
      if (age > OFF_MAX || d > ANIMAL_RADIUS) continue;
      const m = moved(p, heading + Math.PI, rules.off * dt, ground);
      predators.push(atEnd(p, { x: m.x, z: m.z, heading: heading + Math.PI, lift: p.kind === 'owl' ? Math.min(OWL_HEIGHT, p.lift + dt * 3) : 0 }));
      continue;
    }
    const scared = slapped && d <= SLAP_SCARE && (!rules.slapNeedsWater || atWaterEdge(b, ground));
    if (scared) {
      events.push({ id: p.id, kind: p.kind, what: 'scared' });
      predators.push(atEnd(p, { phase: 'off', since: world.time }));
      continue;
    }
    if (p.phase === 'warn') {
      // The beaver got away, or the sign is over and the predator comes.
      if (safe || d > rules.notice * 1.5) continue;
      if (age >= rules.warn) predators.push(atEnd(p, { phase: 'chase', since: world.time, heading, lift: p.kind === 'owl' ? OWL_HEIGHT : 0 }));
      // The owl climbs to its swooping height while it calls, so it does not jump up when the chase begins.
      else {
        // The lynx creeps closer while it watches, but not into the water.
        const m = rules.stalk > 0 ? moved(p, heading, rules.stalk * dt, ground) : { x: p.x, z: p.z };
        predators.push(atEnd(p, { x: m.x, z: m.z, heading, lift: p.kind === 'owl' ? 0.4 + (OWL_HEIGHT - 0.4) * (age / rules.warn) : 0 }));
      }
      continue;
    }
    // Chase: the beaver in the water or the lodge is out of reach, and the predator gives up after a time.
    if (safe || age > rules.giveUp) {
      predators.push(atEnd(p, { phase: 'off', since: world.time }));
      continue;
    }
    if (d <= CATCH_DISTANCE + rules.chase * dt) {
      caught = true;
      events.push({ id: p.id, kind: p.kind, what: 'caught' });
      predators.push(atEnd(p, { x: b.x, z: b.z, phase: 'off', since: world.time, lift: 0 }));
      continue;
    }
    const m = moved(p, heading, rules.chase * dt, ground);
    // A fox, lynx, wolf or bear stopped by the water has lost the beaver. An owl comes down along the way as it nears.
    if (m.blocked) {
      predators.push(atEnd(p, { phase: 'off', since: world.time }));
      continue;
    }
    predators.push(atEnd(p, { x: m.x, z: m.z, heading, lift: p.kind === 'owl' ? Math.max(0.4, Math.min(OWL_HEIGHT, d * 0.35)) : 0 }));
  }
  // New notices: an ambient fox or owl close enough to a beaver on land, not yet a predator.
  if (!safe) {
    const taken = new Set(predators.map((p) => p.id));
    for (const a of animals) {
      if (!isPredator(a.kind) || taken.has(a.id)) continue;
      const { d, heading } = toward(a, b);
      if (d > RULES[a.kind].notice) continue;
      events.push({ id: a.id, kind: a.kind, what: 'noticed' });
      predators.push({ id: a.id, kind: a.kind, x: a.x, z: a.z, lift: a.kind === 'owl' ? 0.4 : 0, heading, phase: 'warn', since: world.time });
    }
  }
  const same = predators.length === world.predators.length && predators.every((p, i) => p === world.predators[i]);
  let next: WorldState = same ? world : { ...world, predators };
  if (caught) next = caughtBy(next);
  return { world: next, events };
}

/** The beaver is caught: it lets go of what it carries or drags and is hurt. */
function caughtBy(world: WorldState): WorldState {
  const b = world.beaver;
  let dropped = world.dropped;
  if (world.carry) dropped = [...dropped, putDown({ kind: world.carry }, b.x, b.z, b.heading, world.time, world.clock)];
  else if (world.haul) dropped = [...dropped, putDown(world.haul, b.x, b.z, b.heading, world.time, world.clock)];
  return { ...world, carry: null, haul: null, drag: null, chop: null, dropped, hurtAt: world.clock };
}

/** The predators as animals to draw: moving while they chase or go off, still while they give their sign. Height is the ground plus the lift. */
export function predatorAnimals(predators: readonly Predator[], ground: Terrain): Animal[] {
  return predators.map((p) => ({ id: p.id, kind: p.kind, x: p.x, y: ground.heightAt(p.x, p.z) + p.lift, z: p.z, heading: p.heading, moving: p.phase !== 'warn' || RULES[p.kind].stalk > 0 }));
}
