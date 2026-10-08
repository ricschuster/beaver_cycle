// The dam (docs/design/20_dams_and_ponds.md): at a dam spot the beaver places wood, mud, and rocks until the level 1 dam
// is whole. A whole dam wears (15_build_and_repair.md): it is mended by placing wood, mud, and rocks, and a broken one
// is rebuilt with the full set. Plain data and pure functions, no three.js (ADR 0007).
import type { DamSpot } from './damSpots';
import { DAM_WORN_DAYS, MEND_PER_WOOD, condition, newWear, stageOf, type Wear } from './wear';

export interface Dam {
  /** The `DamSpot.id` it stands at. */
  spot: string;
  /** Wood units placed, a long log is 2. */
  wood: number;
  mud: number;
  rock: number;
  /** Set when the dam is whole. Missing means it is not whole yet, or never wears (a test dam). */
  wear?: Wear;
}

export interface Cost {
  wood: number;
  mud: number;
  rock: number;
}

/** Level 1 costs, the starting numbers of design note 20 (wood / mud / rock), to tune on a tablet. */
export const LEVEL1_COST: Cost = { wood: 8, mud: 4, rock: 2 };

/** The beaver can place at a spot within this many metres of its bed point: the radius of the ring. */
export const SPOT_REACH = 5;

/** Condition a mud or a rock mends on a whole dam: mud counts as a unit of wood, a rock as two (wood is the cheap one). */
export const MEND_PER_MUD = MEND_PER_WOOD;
export const MEND_PER_ROCK = 2 * MEND_PER_WOOD;

export const newDam = (spot: string): Dam => ({ spot, wood: 0, mud: 0, rock: 0 });

/** What a dam still needs. */
export function needs(dam: Dam | undefined, cost: Cost = LEVEL1_COST): Cost {
  return {
    wood: Math.max(0, cost.wood - (dam?.wood ?? 0)),
    mud: Math.max(0, cost.mud - (dam?.mud ?? 0)),
    rock: Math.max(0, cost.rock - (dam?.rock ?? 0)),
  };
}

export function damWhole(dam: Dam | undefined, cost: Cost = LEVEL1_COST): boolean {
  const n = needs(dam, cost);
  return n.wood + n.mud + n.rock === 0;
}

/** How far along the dam is, 0 to 1, over all three materials. */
export function damProgress(dam: Dam | undefined, cost: Cost = LEVEL1_COST): number {
  const total = cost.wood + cost.mud + cost.rock;
  const n = needs(dam, cost);
  return (total - n.wood - n.mud - n.rock) / total;
}

/** Condition of a dam at a time, 0 to 1. A dam that is not whole or has no wear record counts as 1. */
export const damCondition = (dam: Dam | undefined, clock: number): number => condition(dam?.wear, clock, DAM_WORN_DAYS);

/** A broken dam is gone to its footings: it has to be built again with the full set, so it counts as one not started. */
export function settled(dam: Dam | undefined, clock: number): Dam | undefined {
  if (!dam?.wear || stageOf(damCondition(dam, clock)) !== 'broken') return dam;
  return newDam(dam.spot);
}

/** Wood units (a long log is 2, mud 1, a rock 2) still needed to make a worn dam new, 0 for a dam that is not whole. */
export function damMendUnits(dam: Dam | undefined, clock: number): number {
  if (!dam?.wear || !damWhole(dam)) return 0;
  return Math.ceil((1 - damCondition(dam, clock)) / MEND_PER_WOOD - 1e-9);
}

/** The dam spot within reach of a point, nearest first, or null. */
export function spotAt(spots: readonly DamSpot[], x: number, z: number): DamSpot | null {
  let best: DamSpot | null = null;
  let bestDist = SPOT_REACH;
  for (const s of spots) {
    const d = Math.hypot(s.bed.x - x, s.bed.z - z);
    if (d <= bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

/** The dam at a spot, or undefined before it is started. */
export const damAt = (dams: readonly Dam[], spot: DamSpot): Dam | undefined => dams.find((d) => d.spot === spot.id);

/**
 * The dams with `add` placed at a spot, started if need be. A dam still being built takes each material up to what it
 * needs, and gets its wear record the moment it is whole. A whole dam takes any material as a mend. A broken dam starts
 * again from nothing. Same list when nothing could be placed. Without `clock` a dam never wears (tests).
 */
export function placed(dams: readonly Dam[], spot: DamSpot, add: Partial<Cost>, cost: Cost = LEVEL1_COST, clock?: number): Dam[] {
  const stored = damAt(dams, spot);
  const dam = (clock === undefined ? stored : settled(stored, clock)) ?? newDam(spot.id);
  const rest = dams.filter((d) => d.spot !== spot.id);
  if (damWhole(dam, cost)) {
    const level = clock === undefined ? 1 : damCondition(dam, clock);
    const gain = (add.wood ?? 0) * MEND_PER_WOOD + (add.mud ?? 0) * MEND_PER_MUD + (add.rock ?? 0) * MEND_PER_ROCK;
    if (clock === undefined || !dam.wear || level >= 1 || gain === 0) return dams as Dam[];
    return [...rest, { ...dam, wear: { level: Math.min(1, level + gain), since: clock, mend: 0 } }];
  }
  const next: Dam = {
    spot: dam.spot,
    wood: Math.min(cost.wood, dam.wood + (add.wood ?? 0)),
    mud: Math.min(cost.mud, dam.mud + (add.mud ?? 0)),
    rock: Math.min(cost.rock, dam.rock + (add.rock ?? 0)),
  };
  if (next.wood === dam.wood && next.mud === dam.mud && next.rock === dam.rock) return dams as Dam[];
  if (clock !== undefined && damWhole(next, cost)) next.wear = newWear(clock);
  return [...rest, next];
}
