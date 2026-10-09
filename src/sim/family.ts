// The family: Mama and Papa (docs/design/22_life_stages.md). Like age, where they are is a pure function of the clock and
// the lodge, so there is no state to save and no second counter. They live in the lodge while the player beaver is a baby
// or a teenager, and move about the pond from one part to another (Q60, Q61).

import { DAY_SECONDS } from './clock';
import { NEST_SPOTS, SOLID_RADIUS, lodgeComplete, type Lodge } from './lodge';
import { stageAt } from './life';
import type { Terrain } from './terrain';

/** 'mama' and 'papa' for the home family; those of a lodge the family left carry its place, such as 'mama@120,40'. */
export type ParentId = string;

/** Coats within beaver browns (Q59, Q14). An index into the renderer's palette, so the sim keeps plain data. */
export const COAT_COUNT = 5;

function mix(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

/** The coat of the beaver born at this clock value: every baby has its own colour (Q59). */
export function coatOf(bornAt: number): number {
  return mix(Math.round(bornAt), 1) % COAT_COUNT;
}

/** A coat: a base colour from the palette and a shade of it, -1 darker to 1 lighter (note 23, Q59). */
export interface Coat {
  coat: number;
  shade: number;
}

/** The first family's coats. Papa's is another than Mama's. */
export const FIRST_PARENTS: readonly [Coat, Coat] = [{ coat: 1, shade: 0 }, { coat: 3, shade: 0 }];

/** The largest step in shade from a parent to its kit. */
const SHADE_STEP = 0.5;

/** The coat of a kit: that of one of the parents, picked by chance, in a slightly different shade (note 23). */
export function kitCoat(parents: readonly [Coat, Coat], seed: number): Coat {
  const from = parents[mix(Math.round(seed), 2) % 2]!;
  const step = ((mix(Math.round(seed), 3) % 2001) - 1000) / 1000;
  return { coat: from.coat, shade: Math.max(-1, Math.min(1, from.shade + step * SHADE_STEP)) };
}

export interface Parent {
  id: ParentId;
  coat: Coat;
  x: number;
  z: number;
  /** Height of the feet. */
  y: number;
  heading: number;
  /** Walking on the nest, or swimming in the pond. */
  mode: 'walk' | 'swim';
  /** 0 resting, 1 on the move, for the legs. */
  pace: number;
  inside: boolean;
}

/** Game seconds a parent stays in one part of the pond before moving to another. About 3 hours of a day. */
export const STAY = DAY_SECONDS / 8;
/** Share of a stay spent swimming to the next part. */
const TRAVEL = 0.3;
/** Parents keep to water between these distances from the lodge, in metres, and at least this deep. */
const NEAR = 6;
const FAR = 26;
const MIN_DEPTH = 0.8;
/** A parent swims at least this far (metres) outside the dome. */
const CLEAR = 1;

/** Parts of the pond a parent can be in: the deep water round the lodge, found by a fixed look at the ground. */
export function pondParts(lodge: Lodge, terrain: Terrain): { x: number; z: number }[] {
  const parts: { x: number; z: number }[] = [];
  for (const r of [NEAR + 2, 14, FAR]) {
    const count = Math.round(r / 2.5);
    for (let i = 0; i < count; i++) {
      const a = (i * 2 * Math.PI) / count;
      const x = lodge.x + Math.sin(a) * r;
      const z = lodge.z + Math.cos(a) * r;
      if (terrain.waterDepth(x, z) >= MIN_DEPTH) parts.push({ x, z });
    }
  }
  return parts;
}

/** The two parents' places at a clock value, or none while the player beaver is grown or the lodge is not whole. */
export function parentsAt(lodge: Lodge | null, bornAt: number, clock: number, inLodge: boolean, terrain: Terrain, coats: readonly [Coat, Coat] = FIRST_PARENTS): Parent[] {
  if (stageAt(clock, bornAt) === 'adult') return [];
  return familyAt(lodge, clock, inLodge, terrain, coats, ['mama', 'papa']);
}

/**
 * The parents of a lodge the family left (Q60, Q61). They stay in the pond, and are met again outside, moving about
 * it like the parents of a young player.
 */
export function formerParentsAt(homes: readonly FormerHome[], clock: number, terrain: Terrain): Parent[] {
  return homes.flatMap((h) => familyAt(h, clock, false, terrain, h.parents, [`mama@${Math.round(h.x)},${Math.round(h.z)}`, `papa@${Math.round(h.x)},${Math.round(h.z)}`]));
}

/** A lodge the family has left, and who still lives in the pond: the coats of the two parents. */
export interface FormerHome extends Lodge {
  parents: readonly [Coat, Coat];
}

/** The two parents of a whole lodge, wherever they are at a clock value. */
function familyAt(lodge: Lodge | null, clock: number, inLodge: boolean, terrain: Terrain, coats: readonly [Coat, Coat], ids: [ParentId, ParentId]): Parent[] {
  if (!lodgeComplete(lodge)) return [];
  if (inLodge) {
    return ids.map((id, i) => {
      const nest = NEST_SPOTS[i + 1]!;
      const x = lodge.x + nest.x;
      const z = lodge.z + nest.z;
      // Lying on the nest with the head toward the middle of the room.
      return { id, coat: coats[i]!, x, z, y: lodge.base, heading: Math.atan2(-nest.x, -nest.z), mode: 'walk' as const, pace: 0, inside: true };
    });
  }
  const parts = pondParts(lodge, terrain);
  if (parts.length === 0) return [];
  return ids.map((id, i) => {
    const slot = Math.floor(clock / STAY);
    const pick = (s: number) => parts[mix(s * 2 + i, Math.round(lodge.x * 7 + lodge.z)) % parts.length]!;
    const from = pick(slot - 1);
    const to = pick(slot);
    const t = Math.min(1, ((clock / STAY) % 1) / TRAVEL);
    const ease = t * t * (3 - 2 * t);
    let x = from.x + (to.x - from.x) * ease;
    let z = from.z + (to.z - from.z) * ease;
    // A straight line between two parts may run through the dome, which is solid: swim round it.
    const away = Math.hypot(x - lodge.x, z - lodge.z);
    if (away < SOLID_RADIUS + CLEAR) {
      const dx = away > 1e-6 ? (x - lodge.x) / away : 1;
      const dz = away > 1e-6 ? (z - lodge.z) / away : 0;
      x = lodge.x + dx * (SOLID_RADIUS + CLEAR);
      z = lodge.z + dz * (SOLID_RADIUS + CLEAR);
    }
    const moving = t < 1 && (from.x !== to.x || from.z !== to.z);
    const heading = moving ? Math.atan2(to.x - from.x, to.z - from.z) : Math.atan2(lodge.x - x, lodge.z - z) + (i === 0 ? 0.6 : -0.6);
    const y = terrain.heightAt(x, z) + terrain.waterDepth(x, z) - 0.2;
    return { id, coat: coats[i]!, x, z, y, heading, mode: 'swim' as const, pace: moving ? 1 : 0, inside: false };
  });
}
