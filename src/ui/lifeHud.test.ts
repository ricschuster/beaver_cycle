import { describe, expect, it } from 'vitest';
import { formatLife } from './lifeHud';

describe('life hud', () => {
  it('names the stage and the days lived', () => {
    expect(formatLife({ stage: 'baby', ageDays: 12, progress: 0.4, daysLeft: 18 })).toBe('Baby, 12 days old');
    expect(formatLife({ stage: 'adult', ageDays: 80, progress: 0, daysLeft: Infinity })).toBe('Adult, 80 days old');
  });
});
