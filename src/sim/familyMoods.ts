// How the other beaver families meet the player (docs/design/27_families_and_dialog.md, #342). A family has one trust toward
// the beaver, 0 to 1, kept in `world.trust` by the family id, the same record as the animals (moods.ts). The mood follows from
// it and shows in where the family's beavers swim: a wary family keeps away, a curious one sends its kits to look. A gift put
// down near them is taken and raises trust, and a tail slap lowers it. Like `react` for the animals, `reactFamilies` places each
// beaver for the frame from where it would be anyway, so no path is stored. Nothing is ever lost here: a wary family is shy,
// never hostile (Q2). No three.js and no DOM.
import { SLAP_STARTLE, SLAP_TRUST, FEED_TRUST, moodOf, withTrust, type Mood } from './moods';
import type { NeighbourBeaver } from './neighbours';
import type { Terrain } from './terrain';
import type { WorldState } from './state';

/** A family the beaver has not met trusts it this much (wary). */
export const FAMILY_START_TRUST = 0.1;
/** A wary family's beavers keep this far from the beaver (metres), as long as they stay in the water. */
export const FAMILY_KEEP_AWAY = 12;
/** A curious family's kits come to look from this far, and stop this close (metres). */
export const KIT_RANGE = 25;
export const KIT_CLOSE = 4;
/** A gift put down within this many metres of a family's beaver is taken. */
export const GIFT_REACH = 12;
/** The beaver is greeted by a family when it comes within this many metres of one of its beavers. */
export const GREET_RANGE = 20;

export const familyTrust = (world: Pick<WorldState, 'trust'>, family: string): number => world.trust[family] ?? FAMILY_START_TRUST;
export const familyMood = (world: Pick<WorldState, 'trust'>, family: string): Mood => moodOf(familyTrust(world, family));

const inWater = (t: Terrain, x: number, z: number): boolean => t.waterDepth(x, z) >= 0.3;

/** A beaver moved by its family's mood swims off: its errand's pose is dropped, though it keeps what it carries. */
function placed(n: NeighbourBeaver, x: number, z: number, heading: number, t: Terrain): NeighbourBeaver {
  return { ...n, x, z, heading, y: t.heightAt(x, z) + t.waterDepth(x, z) - 0.2, pace: 1, task: 'swim', mode: 'swim' };
}

/**
 * The beavers of the families as they stand for this frame given the family's mood. A wary family's beavers keep
 * `FAMILY_KEEP_AWAY` from the beaver, and a curious family's kits swim part of the way to a spot just short of it. A move that
 * would leave the water is not made, so the mood never sends a beaver onto land. A moved beaver's task becomes 'swim'.
 */
export function reactFamilies(beavers: readonly NeighbourBeaver[], world: Pick<WorldState, 'trust' | 'beaver'>, t: Terrain): NeighbourBeaver[] {
  const b = world.beaver;
  return beavers.map((n) => {
    const mood = familyMood(world, n.family);
    const dx = n.x - b.x;
    const dz = n.z - b.z;
    const d = Math.hypot(dx, dz);
    if (mood === 'wary' && d < FAMILY_KEEP_AWAY) {
      const heading = d > 0.01 ? Math.atan2(dx, dz) : n.heading;
      const x = b.x + Math.sin(heading) * FAMILY_KEEP_AWAY;
      const z = b.z + Math.cos(heading) * FAMILY_KEEP_AWAY;
      return inWater(t, x, z) ? placed(n, x, z, heading, t) : n;
    }
    if (mood === 'curious' && n.role === 'kit' && d > KIT_CLOSE && d < KIT_RANGE) {
      // Part of the way from where it would be to a spot just short of the beaver, more the nearer the beaver is.
      const k = 1 - d / KIT_RANGE;
      const x = n.x + (b.x + (dx / d) * KIT_CLOSE - n.x) * k;
      const z = n.z + (b.z + (dz / d) * KIT_CLOSE - n.z) * k;
      return inWater(t, x, z) ? placed(n, x, z, Math.atan2(-dx, -dz), t) : n;
    }
    return n;
  });
}

/** The families with a beaver within `range` of a point, nearest first (ids). */
function familiesNear(beavers: readonly NeighbourBeaver[], at: { x: number; z: number }, range: number): string[] {
  const nearest = new Map<string, number>();
  for (const n of beavers) {
    const d = Math.hypot(n.x - at.x, n.z - at.z);
    if (d <= range && d < (nearest.get(n.family) ?? Infinity)) nearest.set(n.family, d);
  }
  return [...nearest.entries()].sort((a, c) => a[1] - c[1]).map(([id]) => id);
}

/** The nearest family within greeting range of the beaver, or null. */
export const greetedBy = (beavers: readonly NeighbourBeaver[], world: Pick<WorldState, 'beaver'>): string | null => familiesNear(beavers, world.beaver, GREET_RANGE)[0] ?? null;

/**
 * Food the beaver put down (a branch or a lily pad lying on the ground) within `GIFT_REACH` of a family's beaver is taken by that
 * family, which trusts the beaver more. Returns the world and the ids of the families that took a gift.
 */
export function giftFamilies(world: WorldState, beavers: readonly NeighbourBeaver[]): { world: WorldState; thanked: string[] } {
  const thanked: string[] = [];
  let next = world;
  const left = [];
  for (const d of world.dropped) {
    const family = d.kind === 'branch' || d.kind === 'lily' ? familiesNear(beavers, d, GIFT_REACH)[0] : undefined;
    if (family) {
      thanked.push(family);
      next = withTrust(next, family, familyTrust(next, family) + FEED_TRUST);
    } else left.push(d);
  }
  return thanked.length > 0 ? { world: { ...next, dropped: left }, thanked } : { world, thanked };
}

/** A tail slap this step startles the families with a beaver within `SLAP_STARTLE`: they trust the beaver less. */
export function startleFamilies(world: WorldState, beavers: readonly NeighbourBeaver[]): WorldState {
  let next = world;
  for (const family of familiesNear(beavers, world.beaver, SLAP_STARTLE)) next = withTrust(next, family, familyTrust(next, family) - SLAP_TRUST);
  return next;
}
