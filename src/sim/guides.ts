// Guides (docs/design/24_npcs_and_animals.md, "Interaction with animals", #310). An otter or a kingfisher that the beaver
// comes close to calls it and leads it to the nearest lily pads, waiting when the beaver falls behind and giving up when it
// is lost. There is no fishing in the game, so a guide leads to a food spot. Like a predator in a chase, a guide that leads
// holds state (`world.leader`) and is drawn from it. No three.js and no DOM here.
import { DAY_SECONDS } from './clock';
import { lilyPadsNear } from './lily';
import type { Animal, AnimalKind } from './animals';
import type { Terrain } from './terrain';
import type { WorldState } from './state';

export type GuideKind = Extract<AnimalKind, 'otter' | 'kingfisher'>;

export interface Leader {
  /** The id of the ambient animal it was, so that animal is not drawn twice. */
  id: string;
  kind: GuideKind;
  x: number;
  z: number;
  heading: number;
  /** The pads it leads to. */
  tx: number;
  tz: number;
  /** `world.time` it arrived at the pads, or null while it is on the way. */
  arrivedAt: number | null;
}

/** A guide calls the beaver from this close (metres), and looks for pads this far round it. */
export const CALL_RANGE = 8;
export const PAD_SEARCH = 90;
/** Metres per second it travels, and the gap behind which it waits for the beaver; past `LOST` it gives up. */
const SPEED: Record<GuideKind, number> = { otter: 8, kingfisher: 10 };
export const WAIT_GAP = 14;
export const LOST = 70;
/** It stays at the pads for this long (seconds) before going back to its life. */
const STAY = 15;
/** A guide that has led does not lead again for this long (clock seconds): one game day. */
export const LEAD_AGAIN = DAY_SECONDS;
/** It is at the pads when this close (metres). */
const ARRIVED = 2;

export const isGuide = (kind: AnimalKind): kind is GuideKind => kind === 'otter' || kind === 'kingfisher';

export type GuideEvent = { id: string; kind: GuideKind; what: 'called' | 'arrived' | 'lost' };

/** The nearest floating pad to a point, or null (none in winter). */
function nearestPads(t: Terrain, x: number, z: number, world: Pick<WorldState, 'clock' | 'picked'>): { x: number; z: number } | null {
  let best: { x: number; z: number } | null = null;
  let bestDist = Infinity;
  for (const p of lilyPadsNear(t, x, z, PAD_SEARCH, world.clock, world.picked)) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

/** One step of the leading. `animals` are the ambient ones around the beaver. Returns the new world and what happened. */
export function lead(world: WorldState, animals: readonly Animal[], dt: number, t: Terrain): { world: WorldState; events: GuideEvent[] } {
  const events: GuideEvent[] = [];
  const b = world.beaver;
  const l = world.leader;
  if (l) {
    const d = Math.hypot(l.x - b.x, l.z - b.z);
    const left = Math.hypot(l.tx - l.x, l.tz - l.z);
    if (l.arrivedAt !== null) {
      if (world.time - l.arrivedAt < STAY) return { world, events };
      return { world: { ...world, leader: null }, events };
    }
    if (d > LOST) {
      events.push({ id: l.id, kind: l.kind, what: 'lost' });
      return { world: { ...world, leader: null }, events };
    }
    if (left <= ARRIVED) {
      events.push({ id: l.id, kind: l.kind, what: 'arrived' });
      return { world: { ...world, leader: { ...l, arrivedAt: world.time } }, events };
    }
    // It waits for a beaver that falls behind, and goes on when it catches up.
    if (d > WAIT_GAP) return { world, events };
    const step = Math.min(left, SPEED[l.kind] * dt);
    const heading = Math.atan2(l.tx - l.x, l.tz - l.z);
    return { world: { ...world, leader: { ...l, x: l.x + Math.sin(heading) * step, z: l.z + Math.cos(heading) * step, heading } }, events };
  }
  for (const a of animals) {
    if (!isGuide(a.kind) || Math.hypot(a.x - b.x, a.z - b.z) > CALL_RANGE) continue;
    const ledAt = world.ledAt[a.id];
    if (ledAt !== undefined && world.clock - ledAt < LEAD_AGAIN) continue;
    const to = nearestPads(t, a.x, a.z, world);
    if (!to) continue;
    events.push({ id: a.id, kind: a.kind, what: 'called' });
    return { world: { ...world, leader: { id: a.id, kind: a.kind, x: a.x, z: a.z, heading: Math.atan2(to.x - a.x, to.z - a.z), tx: to.x, tz: to.z, arrivedAt: null }, ledAt: { ...world.ledAt, [a.id]: world.clock } }, events };
  }
  return { world, events };
}

/** The leader as an animal to draw: swimming or flying while it goes, still at the pads or while it waits. A kingfisher flies above the water. */
export function leaderAnimal(l: Leader, t: Terrain, world: Pick<WorldState, 'beaver'>): Animal {
  const surface = t.heightAt(l.x, l.z) + t.waterDepth(l.x, l.z);
  const waiting = l.arrivedAt !== null || Math.hypot(l.x - world.beaver.x, l.z - world.beaver.z) > WAIT_GAP;
  return { id: l.id, kind: l.kind, x: l.x, y: surface + (l.kind === 'kingfisher' ? 1.4 : 0), z: l.z, heading: l.heading, moving: !waiting };
}
