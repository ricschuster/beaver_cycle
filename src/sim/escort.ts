// A rescued beaver as a guide (docs/design/27_families_and_dialog.md, #346; Q20 to Q22, Q51, Q53). A beaver from a family the player
// knows is stuck in a snowdrift in winter. The player digs it out by gnawing next to the drift, and from then on that named beaver
// will show the way when asked: to a lone beaver, to a free dam spot, or home. While it leads it holds state (`world.escort`), like
// the otter and the kingfisher (guides.ts). It follows a beaver that keeps up, waits when the beaver falls behind, and gives up
// when it is lost. No three.js and no DOM.
import { dateAt } from './clock';
import { familyTrust } from './familyMoods';
import { withTrust, WARY_BELOW, FEED_TRUST } from './moods';
import type { Neighbour, NeighbourBeaver } from './neighbours';
import { nameOf } from './names';
import { partnerCue } from './partners';
import type { WorldState } from './state';
import type { Terrain } from './terrain';

/** A family member stuck in a snowdrift beside its pond. */
export interface Stuck {
  /** Unique for the winter: the member and the year. A rescued id is kept in `world.rescued`. */
  id: string;
  /** The member's own id, which names a guide in `world.guides`. */
  member: string;
  name: string;
  family: string;
  x: number;
  z: number;
}

/** The player digs from this close (metres), standing still, for this long (seconds of play). */
export const DIG_REACH = 3;
export const DIG_TIME = 4;
/** The player hears the call for help from this far (metres). */
export const HEAR_RANGE = 45;

function mix(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

const drifts = new Map<string, { x: number; z: number } | null>();

/** Dry ground 9 to 18 m from the lodge, the same every time (it is looked up once for each lodge and cached), or null. */
function driftSpot(n: Neighbour, ground: Terrain): { x: number; z: number } | null {
  const hit = drifts.get(n.id);
  if (hit !== undefined) return hit;
  let found: { x: number; z: number } | null = null;
  for (const r of [9, 12, 15, 18]) {
    for (let k = 0; k < 16 && !found; k++) {
      const a = ((k + (mix(n.seed, 7) % 16)) / 16) * Math.PI * 2;
      const x = n.lodge.x + Math.sin(a) * r;
      const z = n.lodge.z + Math.cos(a) * r;
      if (ground.waterDepth(x, z) <= 0) found = { x, z };
    }
    if (found) break;
  }
  drifts.set(n.id, found);
  return found;
}

/**
 * The beavers stuck now. Only in winter, only in some winters (one in two for each family), and only a family that does not
 * fear the player (its trust is not wary), so the stuck one is a named member of a family the player knows. A rescued one is gone.
 */
export function stuckNow(world: Pick<WorldState, 'neighbours' | 'trust' | 'clock' | 'rescued'>, ground: Terrain): Stuck[] {
  const date = dateAt(world.clock);
  if (date.season !== 'winter') return [];
  const out: Stuck[] = [];
  for (const n of world.neighbours) {
    if (familyTrust(world, n.id) < WARY_BELOW || mix(n.seed, date.year) % 2 !== 0) continue;
    const id = `${n.id}:stuck:${date.year}`;
    if (world.rescued.includes(id)) continue;
    const at = driftSpot(n, ground);
    if (!at) continue;
    const role = mix(n.seed, date.year + 50) % 2 === 0 ? 'papa' : 'mama';
    const member = `${n.id}:${role}`;
    out.push({ id, member, name: nameOf(member), family: n.id, x: at.x, z: at.z });
  }
  return out;
}

/**
 * The digging so far (seconds). Like felling, a press of Gnaw next to the drift starts it, and it grows while the player
 * stands still there. Moving away or walking starts it over. (The button gives a press, not a hold, on touch and keys.)
 */
export function digging(progress: number, stuck: Pick<Stuck, 'x' | 'z'> | null, b: { x: number; z: number }, pressed: boolean, moving: boolean, dt: number): number {
  if (!stuck || moving || Math.hypot(stuck.x - b.x, stuck.z - b.z) > DIG_REACH) return 0;
  return progress > 0 || pressed ? progress + dt : 0;
}

/** The nearest stuck beaver within `range` of a point, or null. */
export function nearestStuck(list: readonly Stuck[], at: { x: number; z: number }, range: number): Stuck | null {
  let best: Stuck | null = null;
  let bestDist = range;
  for (const s of list) {
    const d = Math.hypot(s.x - at.x, s.z - at.z);
    if (d <= bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

/** The beaver is free: the winter's drift is rescued, the member is a guide, and the family trusts the player more. */
export function rescue(world: WorldState, stuck: Stuck): WorldState {
  const freed: WorldState = { ...world, rescued: [...world.rescued, stuck.id], guides: world.guides.includes(stuck.member) ? world.guides : [...world.guides, stuck.member] };
  return withTrust(freed, stuck.family, familyTrust(freed, stuck.family) + FEED_TRUST);
}

/** A guide leading the player. */
export interface Escort {
  /** The member's id, which stands in for it in the pond while it leads. */
  id: string;
  name: string;
  family: string;
  x: number;
  z: number;
  heading: number;
  tx: number;
  tz: number;
  what: 'lone' | 'dam' | 'home';
  /** `world.time` it arrived, or null while it is on the way. */
  arrivedAt: number | null;
}

export type EscortEvent = { name: string; what: 'arrived' | 'lost' };

/** It leads at this speed (m/s), waits when the beaver is further behind than `WAIT_GAP`, and gives up past `LOST`. */
export const ESCORT_SPEED = 6;
export const WAIT_GAP = 14;
export const LOST = 70;
const ARRIVED = 2;
const STAY = 15;

/** Where to show the way, nearest first: a lone beaver for a player who has no mate, then a free dam spot, then home. Null when there is none. */
export function whereTo(world: WorldState): { x: number; z: number; what: Escort['what'] } | null {
  const b = world.beaver;
  const cue = partnerCue(world.partners, b);
  if (cue) return { x: cue.partner.x, z: cue.partner.z, what: 'lone' };
  let spot: { x: number; z: number } | null = null;
  let spotDist = Infinity;
  for (const s of world.spots) {
    if (world.dams.some((d) => d.spot === s.id)) continue;
    const d = Math.hypot(s.bed.x - b.x, s.bed.z - b.z);
    if (d < spotDist && d > 20) {
      spot = s.bed;
      spotDist = d;
    }
  }
  if (spot) return { x: spot.x, z: spot.z, what: 'dam' };
  return world.lodge ? { x: world.lodge.x, z: world.lodge.z, what: 'home' } : null;
}

/** Starts a guide at the beaver's place toward a goal. */
export function startEscort(from: { id: string; name: string; family: string; x: number; z: number }, to: { x: number; z: number; what: Escort['what'] }): Escort {
  return { id: from.id, name: from.name, family: from.family, x: from.x, z: from.z, heading: Math.atan2(to.x - from.x, to.z - from.z), tx: to.x, tz: to.z, what: to.what, arrivedAt: null };
}

/** One step of the leading. Returns the new world and what happened. */
export function stepEscort(world: WorldState, dt: number): { world: WorldState; events: EscortEvent[] } {
  const e = world.escort;
  if (!e) return { world, events: [] };
  const b = world.beaver;
  const d = Math.hypot(e.x - b.x, e.z - b.z);
  const left = Math.hypot(e.tx - e.x, e.tz - e.z);
  if (e.arrivedAt !== null) return world.time - e.arrivedAt < STAY ? { world, events: [] } : { world: { ...world, escort: null }, events: [] };
  if (d > LOST) return { world: { ...world, escort: null }, events: [{ name: e.name, what: 'lost' }] };
  if (left <= ARRIVED) return { world: { ...world, escort: { ...e, arrivedAt: world.time } }, events: [{ name: e.name, what: 'arrived' }] };
  if (d > WAIT_GAP) return { world, events: [] };
  const step = Math.min(left, ESCORT_SPEED * dt);
  const heading = Math.atan2(e.tx - e.x, e.tz - e.z);
  return { world: { ...world, escort: { ...e, x: e.x + Math.sin(heading) * step, z: e.z + Math.cos(heading) * step, heading } }, events: [] };
}

/** A member of a family drawn at a place: its coat from the family's parents, and the stage of an adult. */
function drawn(world: Pick<WorldState, 'neighbours'>, member: string, name: string, family: string, x: number, z: number, heading: number, pace: number, ground: Terrain, lower: number, scale: number): NeighbourBeaver | null {
  const n = world.neighbours.find((f) => f.id === family);
  if (!n) return null;
  const papa = member.endsWith(':papa');
  return { id: member, name, family, role: papa ? 'papa' : 'mama', stage: 'adult', coat: n.parents[papa ? 1 : 0], x, y: ground.heightAt(x, z) + ground.waterDepth(x, z) - lower, z, heading, pace, task: pace > 0 ? 'swim' : 'rest', errand: 'rest', carry: null, scale };
}

/** A stuck beaver as drawn: sunk in its drift, facing the pond. */
export function stuckBeaver(world: Pick<WorldState, 'neighbours'>, s: Stuck, ground: Terrain): NeighbourBeaver | null {
  const n = world.neighbours.find((f) => f.id === s.family);
  return drawn(world, s.member, s.name, s.family, s.x, s.z, n ? Math.atan2(n.lodge.x - s.x, n.lodge.z - s.z) : 0, 0, ground, 0.3, 0.85);
}

/** The guide that leads, as drawn. */
export function escortBeaver(world: Pick<WorldState, 'neighbours'>, e: Escort, ground: Terrain): NeighbourBeaver | null {
  return drawn(world, e.id, e.name, e.family, e.x, e.z, e.heading, e.arrivedAt === null ? 1 : 0, ground, 0.2, 1);
}
