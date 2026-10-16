import { describe, expect, it } from 'vitest';
import { gameQuery } from './devTools';

describe('gameQuery', () => {
  const search = '?stage=adult&dream=1&day=12&damsites=1&sound=0&touch=1&grain=0';

  it('keeps every parameter in a dev build', () => {
    const q = gameQuery(search, true);
    expect(q.get('stage')).toBe('adult');
    expect(q.get('dream')).toBe('1');
    expect(q.get('damsites')).toBe('1');
  });

  it('keeps only touch, sound and grain in a release build', () => {
    const q = gameQuery(search, false);
    expect([...q.keys()].sort()).toEqual(['grain', 'sound', 'touch']);
    expect(q.get('sound')).toBe('0');
    expect(q.has('stage')).toBe(false);
    expect(q.has('dream')).toBe(false);
  });

  it('is empty in a release build without parameters', () => {
    expect([...gameQuery('', false).keys()]).toEqual([]);
  });
});
