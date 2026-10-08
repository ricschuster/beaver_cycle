import { describe, expect, it } from 'vitest';
import { shownShare } from './damView';

describe('shownShare', () => {
  it('shows every piece while the dam is good and a third when it is gone', () => {
    expect(shownShare(1)).toBe(1);
    expect(shownShare(0.5)).toBe(1);
    expect(shownShare(0)).toBeCloseTo(1 / 3);
    expect(shownShare(0.25)).toBeCloseTo(2 / 3);
  });
});
