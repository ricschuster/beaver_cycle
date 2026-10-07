// Wear: the lodge and the food store age on the game clock, and a worn one is mended by placing wood (15_build_and_repair.md).
// Condition is not stepped. It is a pure function of the clock, `level` at the time `since`, falling at a set rate per
// day, so a sleep, a season jump, or a generation away ages the building the same way. Plain data, no three.js (ADR 0007).
import { DAY_SECONDS, DAYS_PER_YEAR, DAYS_PER_SEASON } from './clock';

/** The state of one structure: its condition (0 broken to 1 new) at the game clock time `since`, and wood put in toward a rebuild. */
export interface Wear {
  level: number;
  since: number;
  /** Wood units placed since it broke. A broken piece is rebuilt with the full set, a worn one is topped up. */
  mend: number;
}

export type Stage = 'good' | 'worn' | 'broken';

/** Condition above this is good, down to `BROKEN_BELOW` worn, below that broken (the table in 15_build_and_repair.md). */
export const WORN_BELOW = 0.5;
export const BROKEN_BELOW = 0.15;

/** Days to fall from new to worn (0.5): the dam is about a season, the store two, the lodge a year. Tuning numbers. */
export const LODGE_WORN_DAYS = DAYS_PER_YEAR;
export const STORE_WORN_DAYS = 2 * DAYS_PER_SEASON;
/** Condition a wood unit mends on a worn piece (a long log is 2 units). */
export const MEND_PER_WOOD = 0.1;
/** Wood units to rebuild a broken piece: the lodge takes a whole lodge, the store a few logs. */
export const STORE_REBUILD_WOOD = 4;

export const newWear = (since: number): Wear => ({ level: 1, since, mend: 0 });

/** Condition at a time, 0 to 1. A structure with no wear record never wears. */
export function condition(wear: Wear | undefined, clock: number, wornDays: number): number {
  if (!wear) return 1;
  const days = Math.max(0, clock - wear.since) / DAY_SECONDS;
  return Math.max(0, wear.level - (days * WORN_BELOW) / wornDays);
}

export function stageOf(level: number): Stage {
  return level < BROKEN_BELOW ? 'broken' : level < WORN_BELOW ? 'worn' : 'good';
}

/**
 * The wear after placing `wood` units at the piece at time `clock`. A good or worn piece gains condition. A broken
 * one collects the wood until it has the `rebuildWood` full set, then it is new again.
 */
export function mended(wear: Wear | undefined, clock: number, wornDays: number, wood: number, rebuildWood: number): Wear {
  const level = condition(wear, clock, wornDays);
  if (stageOf(level) === 'broken') {
    const mend = (wear?.mend ?? 0) + wood;
    return mend >= rebuildWood ? newWear(clock) : { level, since: clock, mend };
  }
  return { level: Math.min(1, level + wood * MEND_PER_WOOD), since: clock, mend: 0 };
}

/** True when a piece shows the glowing circle: worn or broken. */
export const needsRepair = (level: number): boolean => level < WORN_BELOW;
