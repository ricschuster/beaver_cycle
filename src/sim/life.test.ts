import { describe, expect, it } from 'vitest';
import { DAY_SECONDS } from './clock';
import { createWorld, setClock, setStage, setInLodge, sleep } from './state';
import { flatTerrain } from './terrain';
import { step } from './step';
import { noActions } from '../actions/actions';
import { BABY_DAYS, STAGE_RULES, TEENAGER_DAYS, bornAtFor, lifeAt, stageAt, stageStart } from './life';

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

describe('stage rules', () => {
  const flat = flatTerrain(0);
  const fwd = { ...noActions(), move: { x: 0, z: 1 } };
  const run = (w: ReturnType<typeof createWorld>, a = fwd, secs = 1) => {
    for (let i = 0; i < secs * 10; i++) w = step(w, a, 0.1, flat);
    return w;
  };

  it('a baby walks slower than an adult, and a teenager in between', () => {
    const at = (stage: 'baby' | 'teenager' | 'adult') => run(setStage(createWorld(flat), stage)).beaver.z;
    expect(at('baby')).toBeLessThan(at('teenager'));
    expect(at('teenager')).toBeLessThan(at('adult'));
  });

  it('a baby cannot put down a load, an adult can', () => {
    const grab = { ...noActions(), grab: true };
    const load = { ...createWorld(flat), haul: { kind: 'mud' as const } };
    expect(step(setStage(load, 'baby'), grab, 0.1, flat).haul).not.toBeNull();
    expect(step(load, grab, 0.1, flat).haul).toBeNull();
  });

  it('a baby stays within range of its lodge', () => {
    const lodge = { x: 0, z: 0, base: 0, door: 0, wood: 99 };
    const baby = setStage({ ...createWorld(flat), lodge }, 'baby');
    const w = run(baby, fwd, 30);
    expect(Math.hypot(w.beaver.x, w.beaver.z)).toBeLessThanOrEqual(STAGE_RULES.baby.range + 1e-6);
    const adult = run({ ...createWorld(flat), lodge }, fwd, 30);
    expect(Math.hypot(adult.beaver.x, adult.beaver.z)).toBeGreaterThan(STAGE_RULES.baby.range);
  });
});
