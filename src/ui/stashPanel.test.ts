import { describe, expect, it } from 'vitest';
import { STORE_CAPACITY, emptyStock, type Stock } from '../sim/food';
import { stashCells, stashSummary } from './stashPanel';

describe('the stash grid', () => {
  const stock: Stock = emptyStock().map((_, i) => (i === 0 ? 'branch' : i === 1 ? 'lily' : null));

  it('has a cell for every place, and marks the places a worn store has lost', () => {
    const cells = stashCells(stock, 24);
    expect(cells).toHaveLength(STORE_CAPACITY);
    expect(cells[0]).toEqual({ food: 'branch', lost: false });
    expect(cells[23]!.lost).toBe(false);
    expect(cells[24]!.lost).toBe(true);
    expect(stashCells(stock, 0).every((c) => c.lost)).toBe(true);
  });

  it('says the pieces, the places in use, and the meals', () => {
    expect(stashSummary(stock, STORE_CAPACITY)).toBe('2 of 40 places, 3 meals');
    expect(stashSummary(emptyStock(), 24)).toBe('0 of 24 places, 0 meals');
    expect(stashSummary(emptyStock(), 0)).toBe('the store is broken, rebuild it to use it');
  });
});
