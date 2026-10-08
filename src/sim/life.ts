// Life stages of the player beaver (docs/design/22_life_stages.md).
// The stage is a pure function of the clock and the birth time, like dateAt, so there is no second counter.

import { DAY_SECONDS } from './clock';

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
