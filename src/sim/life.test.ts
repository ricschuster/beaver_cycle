import { describe, expect, it } from 'vitest';
import { DAY_SECONDS } from './clock';
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
