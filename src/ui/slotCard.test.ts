import { describe, expect, it } from 'vitest';
import { bornAtFor } from '../sim/life';
import { slotDetails } from './slotCard';

describe('slotDetails', () => {
  it('says the life stage, the generation counted from 1 and when it was played', () => {
    const info = { slot: 2, kind: 'used' as const, name: 'Maple', savedAt: 0, clock: 100_000, bornAt: bornAtFor(100_000, 'teenager'), generation: 1 };
    expect(slotDetails(info, '3 hours ago')).toBe('Teenager, generation 2, last played 3 hours ago');
  });
});
