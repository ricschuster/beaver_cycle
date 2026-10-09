// Life stages of the player beaver (docs/design/22_life_stages.md).
// The stage is a pure function of the clock and the birth time, like dateAt, so there is no second counter.

import { DAY_SECONDS, dateAt } from './clock';

export const STAGES = ['baby', 'teenager', 'adult'] as const;
export type Stage = (typeof STAGES)[number];

/** Days a baby stays a baby, and a teenager a teenager. A little under a 40 day year (author, 22_life_stages.md); to tune by playing. */
export const BABY_DAYS = 30;
export const TEENAGER_DAYS = 30;

export interface LifeInfo {
  stage: Stage;
  /** Whole days lived, from 0. */
  ageDays: number;
  /** How far through the current stage, 0 up to but not including 1. An adult stays at 0. */
  progress: number;
  /** Days left in this stage, or Infinity for an adult. */
  daysLeft: number;
}

/** The clock value at which a stage starts, for a beaver born at bornAt. */
export function stageStart(bornAt: number, stage: Stage): number {
  const days = stage === 'baby' ? 0 : stage === 'teenager' ? BABY_DAYS : BABY_DAYS + TEENAGER_DAYS;
  return bornAt + days * DAY_SECONDS;
}

/** The born time that puts a beaver at the start of this stage on this clock. Used by the test menu and ?stage=. */
export function bornAtFor(clock: number, stage: Stage): number {
  return clock - stageStart(0, stage);
}

export function lifeAt(clock: number, bornAt: number): LifeInfo {
  const days = Math.max(0, clock - bornAt) / DAY_SECONDS;
  const ageDays = Math.floor(days);
  if (days < BABY_DAYS) return { stage: 'baby', ageDays, progress: days / BABY_DAYS, daysLeft: BABY_DAYS - days };
  const t = days - BABY_DAYS;
  if (t < TEENAGER_DAYS) return { stage: 'teenager', ageDays, progress: t / TEENAGER_DAYS, daysLeft: TEENAGER_DAYS - t };
  return { stage: 'adult', ageDays, progress: 0, daysLeft: Infinity };
}

export function stageAt(clock: number, bornAt: number): Stage {
  return lifeAt(clock, bornAt).stage;
}

/** What a stage changes about play (docs/design/22_life_stages.md). First guesses, to tune by playing. */
export interface StageRules {
  /** Share of the adult walk, swim, and dive speed. */
  speed: number;
  /** Felling, hauling, gnawing food, building, and the stash. A baby only swims, eats, and plays. */
  works: boolean;
  /** How far from the lodge the beaver may go, in metres, or Infinity. A baby stays in the pond. */
  range: number;
  /** The beaver keeps to the water: it swims, and does not go ashore. A baby plays in the pond. */
  waterOnly: boolean;
  /** Size of the model against an adult. */
  scale: number;
}

export const STAGE_RULES: Record<Stage, StageRules> = {
  baby: { speed: 0.5, works: false, range: 60, waterOnly: true, scale: 0.45 },
  teenager: { speed: 0.85, works: true, range: Infinity, waterOnly: false, scale: 0.75 },
  adult: { speed: 1, works: true, range: Infinity, waterOnly: false, scale: 1 },
};

/** The dawn on or after the day the beaver grows into its next stage, or null for an adult. Sleeping until then is the skip (Q47). */
export function growUpDawn(clock: number, bornAt: number): number | null {
  const { stage } = lifeAt(clock, bornAt);
  if (stage === 'adult') return null;
  const end = stageStart(bornAt, stage === 'baby' ? 'teenager' : 'adult');
  const day = dateAt(end).day;
  return (end > day * DAY_SECONDS ? day + 1 : day) * DAY_SECONDS;
}

/** A young beaver slows down over the last metres before its range, as the parents call it back. */
export const CALL_BAND = 12;

/** True while the beaver is within the calling band of its range or past it. Not for a beaver with no range. */
export function isCalledBack(distance: number, range: number): boolean {
  return Number.isFinite(range) && distance > range - CALL_BAND;
}

/**
 * The distance from home after a step, given the one before. Outward steps shrink to nothing across the calling band, so
 * the edge is soft; steps toward home are not touched. Never past the range.
 */
export function softEdge(before: number, after: number, range: number): number {
  if (!Number.isFinite(range) || after <= before) return after;
  const start = range - CALL_BAND;
  if (after <= start) return after;
  const room = Math.max(0, Math.min(1, (range - Math.max(before, start)) / CALL_BAND));
  return Math.min(range, Math.max(before, start) + (after - Math.max(before, start)) * room);
}
