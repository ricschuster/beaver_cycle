import { describe, expect, it } from 'vitest';
import { WOOD_TREES, newlyWon } from './achievements';

const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `t${i}`);

describe('wood achievement', () => {
  it('is not won below 30 trees', () => {
    expect(newlyWon({ felled: ids(WOOD_TREES - 1), achievements: [] })).toEqual([]);
  });
  it('is won at 30 trees', () => {
    expect(newlyWon({ felled: ids(WOOD_TREES), achievements: [] })).toEqual(['wood']);
  });
  it('is won only once', () => {
    expect(newlyWon({ felled: ids(WOOD_TREES + 5), achievements: ['wood'] })).toEqual([]);
  });
});
