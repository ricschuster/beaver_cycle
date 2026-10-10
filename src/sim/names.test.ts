import { describe, expect, it } from 'vitest';
import { NAMES, nameOf, pondName } from './names';

describe('names', () => {
  it('gives the same name for the same id, from the list', () => {
    expect(nameOf('family:1:2:mama')).toBe(nameOf('family:1:2:mama'));
    expect(NAMES).toContain(nameOf('family:1:2:papa'));
  });

  it('gives a family of several different names most of the time', () => {
    const ids = ['mama', 'papa', 'kit:1:0', 'kit:1:1', 'kit:2:0'].map((r) => `family:3:4:${r}`);
    expect(new Set(ids.map(nameOf)).size).toBeGreaterThanOrEqual(4);
  });

  it('has no repeats in the list', () => {
    expect(new Set(NAMES).size).toBe(NAMES.length);
  });

  it('names the pond for its side of the home (north is -z)', () => {
    expect(pondName({ x: 0, z: -100 }, { x: 0, z: 0 })).toBe('north pond');
    expect(pondName({ x: 100, z: 0 }, { x: 0, z: 0 })).toBe('east pond');
    expect(pondName({ x: -70, z: 70 }, { x: 0, z: 0 })).toBe('south-west pond');
  });
});
