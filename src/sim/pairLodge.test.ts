import { describe, expect, it } from 'vitest';
import { LODGE_WOOD } from './lodge';
import { pairLodgeOf, placeLog, releaseLodge, type PairLodge } from './pairLodge';
import { flatTerrain } from './terrain';

// Shallow water everywhere with deep water round, so a lodge can start where the beaver stands.
const lake = { ...flatTerrain(0), waterDepth: (x: number, z: number) => (Math.hypot(x, z) < 2.5 ? 0.5 : 2), heightAt: () => -0.5 } as ReturnType<typeof flatTerrain>;
const at = { x: -3, z: 0, heading: Math.PI / 2 };
const long = { length: 6 };
const players: [string, string] = ['host', 'g1'];

describe('the lodge of a pair', () => {
  it('starts with the first log, ahead of the beaver, for both players', () => {
    const r = placeLog([], players, at, long, lake, [], 0);
    expect(r.used).toBe(true);
    expect(r.lodges).toHaveLength(1);
    expect(pairLodgeOf(r.lodges, 'g1')).toBe(r.lodges[0]);
    expect(pairLodgeOf(r.lodges, 'host')).toBe(r.lodges[0]);
    expect(pairLodgeOf(r.lodges, 'g2')).toBeNull();
  });

  it('either one adds wood until it is whole, and a whole lodge is new', () => {
    let lodges: readonly PairLodge[] = [];
    for (let i = 0; i < LODGE_WOOD / 2; i++) {
      const who: [string, string] = i % 2 ? ['g1', 'host'] : players;
      const r = placeLog(lodges, who, at, long, lake, [], 5);
      expect(r.used).toBe(true);
      lodges = r.lodges;
    }
    expect(lodges).toHaveLength(1);
    expect(lodges[0]!.wood).toBe(LODGE_WOOD);
    expect(lodges[0]!.wear?.level).toBe(1);
  });

  it('keeps a log that is not near the lodge, and a whole new lodge needs no more logs', () => {
    const first = placeLog([], players, at, long, lake, [], 0).lodges;
    expect(placeLog(first, players, { x: 40, z: 0, heading: 0 }, long, lake, [], 0).used).toBe(false);
    let full = first;
    for (let i = 0; i < 5; i++) full = placeLog(full, players, at, long, lake, [], 0).lodges;
    expect(placeLog(full, players, at, long, lake, [], 0).used).toBe(false);
  });

  it('a worn lodge is mended by a log, and a released lodge leaves the list', () => {
    let full = placeLog([], players, at, long, lake, [], 0).lodges;
    for (let i = 0; i < 4; i++) full = placeLog(full, players, at, long, lake, [], 0).lodges;
    const worn = [{ ...full[0]!, wear: { level: 0.4, since: 0, mend: 0 } }];
    const r = placeLog(worn, players, at, long, lake, [], 0);
    expect(r.used).toBe(true);
    expect(r.lodges[0]!.wear!.level).toBeGreaterThan(0.4);
    const out = releaseLodge(r.lodges, 'g1');
    expect(out.lodges).toEqual([]);
    expect(out.released).toBe(r.lodges[0]);
  });
});
