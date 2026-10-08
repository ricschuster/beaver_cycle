// The dam (docs/design/20_dams_and_ponds.md): at a dam spot the beaver places wood, mud, and rocks until the level 1 dam
// is whole. No pond yet. Plain data and pure functions, no three.js (ADR 0007).
import type { DamSpot } from './damSpots';

export interface Dam {
  /** The `DamSpot.id` it stands at. */
  spot: string;
  /** Wood units placed, a long log is 2. */
  wood: number;
  mud: number;
  rock: number;
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

/** The dams with `add` placed at a spot, started if need be. Each material stops at what the dam needs. Same list when nothing could be placed. */
export function placed(dams: readonly Dam[], spot: DamSpot, add: Partial<Cost>, cost: Cost = LEVEL1_COST): Dam[] {
  const dam = damAt(dams, spot) ?? newDam(spot.id);
  const next: Dam = {
    spot: dam.spot,
    wood: Math.min(cost.wood, dam.wood + (add.wood ?? 0)),
    mud: Math.min(cost.mud, dam.mud + (add.mud ?? 0)),
    rock: Math.min(cost.rock, dam.rock + (add.rock ?? 0)),
  };
  if (next.wood === dam.wood && next.mud === dam.mud && next.rock === dam.rock) return dams as Dam[];
  return [...dams.filter((d) => d.spot !== spot.id), next];
}
