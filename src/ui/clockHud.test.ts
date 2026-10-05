import { describe, expect, it } from 'vitest';
import { DAY_SECONDS } from '../sim/clock';
import { formatClock } from './clockHud';

describe('clock hud', () => {
  it('names season, day and part of the day', () => {
    expect(formatClock(DAY_SECONDS * 0.05)).toBe('Spring, day 1, morning');
    expect(formatClock(DAY_SECONDS * (11 + 0.8))).toBe('Summer, day 2, night');
  });
});
