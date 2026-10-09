import { describe, expect, it } from 'vitest';
import { DAY_SECONDS } from './clock';
import { createWorld, setClock, setStage, setInLodge, sleep } from './state';
import { flatTerrain } from './terrain';
import { BABY_DAYS, TEENAGER_DAYS, bornAtFor, lifeAt, stageAt, stageStart } from './life';

const d = (days: number) => days * DAY_SECONDS;

describe('life stages', () => {
  it('starts as a baby', () => {
    expect(lifeAt(d(5), d(5))).toMatchObject({ stage: 'baby', ageDays: 0, progress: 0 });
  });

  it('becomes a teenager after the baby days, and an adult after the teenager days', () => {
    expect(stageAt(d(BABY_DAYS) - 1, 0)).toBe('baby');
    expect(stageAt(d(BABY_DAYS), 0)).toBe('teenager');
    expect(stageAt(d(BABY_DAYS + TEENAGER_DAYS) - 1, 0)).toBe('teenager');
    expect(stageAt(d(BABY_DAYS + TEENAGER_DAYS), 0)).toBe('adult');
  });

  it('reports progress and days left within a stage', () => {
    const info = lifeAt(d(BABY_DAYS / 2), 0);
    expect(info.progress).toBeCloseTo(0.5);
    expect(info.daysLeft).toBeCloseTo(BABY_DAYS / 2);
    expect(lifeAt(d(1000), 0)).toMatchObject({ stage: 'adult', progress: 0, daysLeft: Infinity });
  });

  it('treats a clock before birth as age zero', () => {
    expect(lifeAt(0, d(3))).toMatchObject({ stage: 'baby', ageDays: 0 });
  });

  it('bornAtFor puts a beaver at the start of the stage', () => {
    for (const stage of ['baby', 'teenager', 'adult'] as const) {
      const clock = d(100);
      const bornAt = bornAtFor(clock, stage);
      expect(stageAt(clock, bornAt)).toBe(stage);
      expect(stageStart(bornAt, stage)).toBe(clock);
    }
  });
});

describe('life in the world', () => {
  const world = createWorld(flatTerrain(0));

  it('starts a new game as an adult', () => {
    expect(lifeAt(world.clock, world.bornAt).stage).toBe('adult');
  });

  it('setStage puts the beaver at the start of a stage', () => {
    const baby = setStage(world, 'baby');
    expect(lifeAt(baby.clock, baby.bornAt)).toMatchObject({ stage: 'baby', ageDays: 0 });
    expect(lifeAt(setStage(world, 'teenager').clock, setStage(world, 'teenager').bornAt).stage).toBe('teenager');
  });

  it('a test jump of the clock does not change the age', () => {
    const baby = setStage(world, 'baby');
    const jumped = setClock(baby, baby.clock + d(100));
    expect(lifeAt(jumped.clock, jumped.bornAt).stage).toBe('baby');
  });

  it('sleeping through the night ages the beaver', () => {
    const night = { ...setInLodge(setStage(world, 'baby'), true), clock: 0.8 * DAY_SECONDS };
    const woke = sleep(night);
    expect(woke.clock).toBeGreaterThan(night.clock);
    expect(lifeAt(woke.clock, woke.bornAt).progress).toBeGreaterThan(lifeAt(night.clock, night.bornAt).progress);
  });
});
