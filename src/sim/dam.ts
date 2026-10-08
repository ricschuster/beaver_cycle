// The dam (docs/design/20_dams_and_ponds.md): at a dam spot the beaver places wood, mud, and rocks until the level 1 dam
// is whole. A whole dam wears (15_build_and_repair.md): it is mended by placing wood, mud, and rocks, and a broken one
// is rebuilt with the full set. Plain data and pure functions, no three.js (ADR 0007).
import { maxLevel, widthFactor, type DamSpot } from './damSpots';
import { DAM_WORN_DAYS, MEND_PER_WOOD, WORN_BELOW, condition, newWear, stageOf, type Wear } from './wear';

export interface Dam {
  /** The `DamSpot.id` it stands at. */
  spot: string;
  /** Wood units placed, a long log is 2. */
  wood: number;
  mud: number;
  rock: number;
  /** The level it is built to or held at, 1 to 3. Missing means level 1. Wood, mud, and rock count toward the cost of this level. */
  level?: 1 | 2 | 3;
  /** Share of the table price this dam costs, from the length of the wall at its spot (`widthFactor`). Missing means 1. */
  scale?: number;
  /** Set when the dam is whole. Missing means it is not whole yet, or never wears (a test dam). */
  wear?: Wear;
  /** True from the mend that began while the dam was worn until it is new again, so the repair stays marked all the way up to 1. */
  repairing?: boolean;
}

export interface Cost {
  wood: number;
  mud: number;
  rock: number;
}

/** What a dam of each level holds in all, the starting numbers of design note 20 (wood / mud / rock), to tune on a tablet. */
export const LEVEL_COST: readonly Cost[] = [
  { wood: 8, mud: 4, rock: 2 },
  { wood: 14, mud: 8, rock: 5 },
  { wood: 22, mud: 12, rock: 9 },
];
export const LEVEL1_COST: Cost = LEVEL_COST[0]!;

export const levelOf = (dam: Dam | undefined): 1 | 2 | 3 => dam?.level ?? 1;
/** A table cost at a scale: each material rounded, at least 1. */
const scaled = (c: Cost, scale: number): Cost => ({ wood: Math.max(1, Math.round(c.wood * scale)), mud: Math.max(1, Math.round(c.mud * scale)), rock: Math.max(1, Math.round(c.rock * scale)) });
/** The cost of the level a dam is built to, and of the level below it (nothing for level 1), at the dam's scale. */
export const costOf = (dam: Dam | undefined): Cost => scaled(LEVEL_COST[levelOf(dam) - 1]!, dam?.scale ?? 1);
const costBelow = (dam: Dam | undefined): Cost => (levelOf(dam) > 1 ? scaled(LEVEL_COST[levelOf(dam) - 2]!, dam?.scale ?? 1) : { wood: 0, mud: 0, rock: 0 });

/** Condition one wood unit mends on this dam: a long wall takes more to mend, a short one less. */
export const mendPerWood = (dam: Dam | undefined): number => MEND_PER_WOOD / (dam?.scale ?? 1);

/** The beaver can place at a spot within this many metres of its bed point: the radius of the ring. */
export const SPOT_REACH = 5;

/** Condition a mud or a rock mends on a whole dam: mud counts as a unit of wood, a rock as two (wood is the cheap one). */
export const MEND_PER_MUD = MEND_PER_WOOD;
export const MEND_PER_ROCK = 2 * MEND_PER_WOOD;

export const newDam = (spot: string, scale = 1): Dam => ({ spot, wood: 0, mud: 0, rock: 0, ...(scale !== 1 ? { scale } : {}) });

/** What a dam still needs. */
export function needs(dam: Dam | undefined, cost: Cost = costOf(dam)): Cost {
  return {
    wood: Math.max(0, cost.wood - (dam?.wood ?? 0)),
    mud: Math.max(0, cost.mud - (dam?.mud ?? 0)),
    rock: Math.max(0, cost.rock - (dam?.rock ?? 0)),
  };
}

export function damWhole(dam: Dam | undefined, cost: Cost = costOf(dam)): boolean {
  const n = needs(dam, cost);
  return n.wood + n.mud + n.rock === 0;
}

/** How far along the dam is toward its level, 0 to 1, over all three materials. A raised dam counts from the level below. */
export function damProgress(dam: Dam | undefined): number {
  const cost = costOf(dam);
  const below = costBelow(dam);
  const sum = (c: Cost): number => c.wood + c.mud + c.rock;
  const n = needs(dam);
  return Math.max(0, Math.min(1, (sum(cost) - n.wood - n.mud - n.rock - sum(below)) / (sum(cost) - sum(below))));
}

/** Condition of a dam at a time, 0 to 1. A dam that is not whole or has no wear record counts as 1. */
export const damCondition = (dam: Dam | undefined, clock: number): number => condition(dam?.wear, clock, DAM_WORN_DAYS);

/** True while the dam is marked for repair: worn or broken, or mended part way from there and not yet new (the gold glow and the repair line). */
export const damNeedsRepair = (dam: Dam | undefined, clock: number): boolean =>
  !!dam?.wear && damWhole(dam) && (!!dam.repairing || damCondition(dam, clock) < WORN_BELOW);

/**
 * The dam as it stands once the next level is begun on it, or undefined when it cannot be raised: not whole, at the
 * biggest level the spot holds, worn or in the middle of a repair (a dam is raised once it is kept in good shape). The
 * dam is new again while it is raised, and wears again when the bigger level is whole.
 */
export function raised(dam: Dam | undefined, spot: DamSpot, clock: number): Dam | undefined {
  if (!dam || !damWhole(dam) || levelOf(dam) >= maxLevel(spot) || damNeedsRepair(dam, clock) || damCondition(dam, clock) < WORN_BELOW) return undefined;
  const { wear: _wear, repairing: _repairing, ...rest } = dam;
  const level = (levelOf(dam) + 1) as 2 | 3;
  // The price never falls with the level, so what is placed already is never more than the bigger level asks for.
  const scale = Math.max(dam.scale ?? 1, widthFactor(spot, level));
  const { scale: _scale, ...plain } = rest;
  return { ...plain, level, ...(scale !== 1 ? { scale } : {}) };
}

/** A broken dam is gone to its footings: it has to be built again with the full set, so it counts as one not started. */
export function settled(dam: Dam | undefined, clock: number, spot: DamSpot): Dam | undefined {
  if (!dam?.wear || stageOf(damCondition(dam, clock)) !== 'broken') return dam;
  return newDam(dam.spot, widthFactor(spot, 1));
}

/** Wood units (a long log is 2, mud 1, a rock 2) still needed to make a worn dam new, 0 for a dam that is not whole. */
export function damMendUnits(dam: Dam | undefined, clock: number): number {
  if (!dam?.wear || !damWhole(dam)) return 0;
  return Math.ceil((1 - damCondition(dam, clock)) / mendPerWood(dam) - 1e-9);
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
 * needs, and gets its wear record the moment it is whole. A whole dam takes any material as a mend. A good whole dam that
 * the spot can hold bigger is raised to the next level instead (it keeps what it has and takes more). A broken dam starts
 * again from nothing, at level 1. Same list when nothing could be placed. Without `clock` a dam never wears (tests).
 */
export function placed(dams: readonly Dam[], spot: DamSpot, add: Partial<Cost>, override?: Cost, clock?: number): Dam[] {
  const stored = damAt(dams, spot);
  let dam = (clock === undefined ? stored : settled(stored, clock, spot)) ?? newDam(spot.id, widthFactor(spot, 1));
  if (clock !== undefined && !override && (add.wood ?? 0) + (add.mud ?? 0) + (add.rock ?? 0) > 0) dam = raised(dam, spot, clock) ?? dam;
  const cost = override ?? costOf(dam);
  const rest = dams.filter((d) => d.spot !== spot.id);
  if (damWhole(dam, cost)) {
    const level = clock === undefined ? 1 : damCondition(dam, clock);
    const gain = ((add.wood ?? 0) * MEND_PER_WOOD + (add.mud ?? 0) * MEND_PER_MUD + (add.rock ?? 0) * MEND_PER_ROCK) / (dam.scale ?? 1);
    if (clock === undefined || !dam.wear || level >= 1 || gain === 0) return dams as Dam[];
    const next = Math.min(1, level + gain);
    const { repairing: _was, ...plain } = dam;
    // A dam mended from worn stays marked until it is new; a good one mended a little never was.
    return [...rest, { ...plain, ...(next < 1 && damNeedsRepair(dam, clock) ? { repairing: true } : {}), wear: { level: next, since: clock, mend: 0 } }];
  }
  const next: Dam = {
    spot: dam.spot,
    ...(dam.level ? { level: dam.level } : {}),
    ...(dam.scale ? { scale: dam.scale } : {}),
    wood: Math.min(cost.wood, dam.wood + (add.wood ?? 0)),
    mud: Math.min(cost.mud, dam.mud + (add.mud ?? 0)),
    rock: Math.min(cost.rock, dam.rock + (add.rock ?? 0)),
  };
  if (next.wood === dam.wood && next.mud === dam.mud && next.rock === dam.rock) return dams as Dam[];
  if (clock !== undefined && damWhole(next, cost)) next.wear = newWear(clock);
  return [...rest, next];
}
