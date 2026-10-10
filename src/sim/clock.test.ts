import { describe, expect, it } from 'vitest';
import { DAYS_PER_SEASON, DAYS_PER_YEAR, DAY_FRACTION, DAY_SECONDS, LODGE_CLOCK_RATE, START_CLOCK, dateAt, daylight, isNight, nextDawn, withSeason, withTimeOfDay } from './clock';
import { noActions } from '../actions/actions';
import { canSleep, createWorld, setInLodge, sleep } from './state';
import { step } from './step';
import { flatTerrain } from './terrain';

const flat = flatTerrain(0);

describe('game date', () => {
  it('starts in spring on day 1 of the season', () => {
    expect(dateAt(0)).toMatchObject({ season: 'spring', dayOfSeason: 1, year: 0, timeOfDay: 0 });
  });

  it('changes season every ten days and rolls over after a year', () => {
    expect(dateAt(DAYS_PER_SEASON * DAY_SECONDS).season).toBe('summer');
    expect(dateAt((3 * DAYS_PER_SEASON + 9) * DAY_SECONDS)).toMatchObject({ season: 'winter', dayOfSeason: 10 });
    expect(dateAt(DAYS_PER_YEAR * DAY_SECONDS)).toMatchObject({ season: 'spring', year: 1, dayOfSeason: 1 });
  });
});

describe('daylight', () => {
  it('is dark at night and bright at midday', () => {
    expect(daylight(0.9)).toBe(0);
    expect(daylight(DAY_FRACTION / 2)).toBe(1);
  });

  it('ramps up at dawn and down at dusk', () => {
    expect(daylight(0)).toBe(0);
    expect(daylight(0.02)).toBeGreaterThan(0);
    expect(daylight(0.02)).toBeLessThan(1);
    expect(daylight(DAY_FRACTION + 0.02)).toBeGreaterThan(0);
    expect(daylight(DAY_FRACTION + 0.02)).toBeLessThan(1);
  });

  it('marks the dark part of the day as night', () => {
    expect(isNight(DAY_SECONDS * 0.3)).toBe(false);
    expect(isNight(DAY_SECONDS * 0.8)).toBe(true);
  });
});

describe('world clock', () => {
  it('starts a little after dawn and runs at full rate outside', () => {
    const w = step(createWorld(flat), noActions(), 10, flat);
    expect(w.clock).toBeCloseTo(START_CLOCK + 10);
  });

  it('runs at half rate in the lodge', () => {
    const w = step(setInLodge(createWorld(flat), true), noActions(), 10, flat);
    expect(w.clock).toBeCloseTo(START_CLOCK + 10 * LODGE_CLOCK_RATE);
  });

  it('is not scaled by the test speed multiplier', () => {
    const w0 = { ...createWorld(flat), speedMultiplier: 20 };
    expect(step(w0, noActions(), 1, flat).clock).toBeCloseTo(START_CLOCK + 1);
  });

  it('can sleep only in the lodge and at night', () => {
    const night = { ...createWorld(flat), clock: DAY_SECONDS * 0.8 };
    expect(canSleep(night)).toBe(false);
    expect(canSleep(setInLodge(night, true))).toBe(true);
    expect(canSleep(setInLodge({ ...night, clock: DAY_SECONDS * 0.3 }, true))).toBe(false);
  });

  it('sleeps through the night to the next dawn, only in the lodge at night', () => {
    const night = { ...createWorld(flat), clock: DAY_SECONDS * 0.8 };
    expect(sleep(night)).toBe(night);
    const slept = sleep(setInLodge(night, true));
    expect(slept.clock).toBe(DAY_SECONDS);
    expect(slept.clock).toBe(nextDawn(night.clock));
    const day = setInLodge({ ...createWorld(flat), clock: DAY_SECONDS * 0.3 }, true);
    expect(sleep(day)).toBe(day);
  });
});

describe('test menu clock moves', () => {
  it('moves to a time of day on the same day', () => {
    const c = withTimeOfDay(DAY_SECONDS * 3.2, 0.5);
    expect(dateAt(c)).toMatchObject({ day: 3, timeOfDay: 0.5 });
  });

  it('moves to the start of a season in the same year, keeping the time of day', () => {
    const c = withSeason((DAYS_PER_YEAR + 5.3) * DAY_SECONDS, 'autumn');
    expect(dateAt(c)).toMatchObject({ season: 'autumn', dayOfSeason: 1, year: 1 });
    expect(dateAt(c).timeOfDay).toBeCloseTo(0.3);
  });

  it('moves to a day in the middle of a season, and never past its last day', () => {
    expect(dateAt(withSeason(5.3 * DAY_SECONDS, 'winter', DAYS_PER_SEASON / 2))).toMatchObject({ season: 'winter', dayOfSeason: DAYS_PER_SEASON / 2 + 1 });
    expect(dateAt(withSeason(5.3 * DAY_SECONDS, 'winter', 99))).toMatchObject({ season: 'winter', dayOfSeason: DAYS_PER_SEASON });
  });
});
