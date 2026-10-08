import { describe, expect, it } from 'vitest';
import { noActions } from '../actions/actions';
import { ACHIEVEMENT_IDS, ACHIEVEMENT_TEXT, GARDENER_PADS, HAULER_LOADS, WOOD_TREES, mendsBetween, newlyWon, padsBetween, tally } from './achievements';
import { DAY_SECONDS, DAYS_PER_YEAR, START_CLOCK } from './clock';
import { LEVEL1_COST, LEVEL_COST } from './dam';
import type { DamSpot } from './damSpots';
import { STORE_CAPACITY } from './food';
import { LODGE_WOOD } from './lodge';
import { createWorld, type WorldState } from './state';
import { step } from './step';
import type { Terrain } from './terrain';
import { newWear } from './wear';

const dry: Terrain = { heightAt: () => 0, isWater: () => false, waterDepth: () => 0 };
const spot: DamSpot = { id: 'core:50:0', bed: { x: 50, z: 0 }, bedY: 0, flow: { x: 1, z: 0 }, maxCrest: 2, pondM2: 900 };
const whole = { spot: spot.id, ...LEVEL1_COST };
const base = (): WorldState => ({ ...createWorld(dry, 52, 0), spots: [spot] });
const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `t${i}`);
const won = (w: WorldState) => newlyWon(w);

describe('the rules', () => {
  it('has a name and a toast for each', () => {
    for (const id of ACHIEVEMENT_IDS) expect(ACHIEVEMENT_TEXT[id].length).toBeGreaterThan(0);
  });
  it('wood: 30 trees', () => {
    expect(won({ ...base(), felled: ids(WOOD_TREES - 1) })).toEqual([]);
    expect(won({ ...base(), felled: ids(WOOD_TREES) })).toEqual(['wood']);
  });
  it('is won only once', () => {
    expect(won({ ...base(), felled: ids(WOOD_TREES + 5), achievements: ['wood'] })).toEqual([]);
  });
  it('home: a whole lodge', () => {
    const lodge = { x: 0, z: 0, heading: 0, base: 0, wood: LODGE_WOOD - 1 } as unknown as WorldState['lodge'];
    expect(won({ ...base(), lodge })).toEqual([]);
    expect(won({ ...base(), lodge: { ...lodge!, wood: LODGE_WOOD } })).toEqual(['home']);
  });
  it('first dam: a whole dam, not one half built', () => {
    expect(won({ ...base(), dams: [{ spot: spot.id, wood: 2, mud: 0, rock: 0 }] })).toEqual([]);
    expect(won({ ...base(), dams: [whole] })).toEqual(['firstDam']);
  });
  it('higher dam: whole at the top level of a spot that holds level 2 or more', () => {
    const w2 = { spot: spot.id, ...LEVEL_COST[1]!, level: 2 as const };
    expect(won({ ...base(), dams: [w2], spots: [{ ...spot, maxCrest: 1.5 }] })).toContain('highDam');
    expect(won({ ...base(), dams: [w2], spots: [spot] })).not.toContain('highDam');
    expect(won({ ...base(), dams: [whole], spots: [{ ...spot, maxCrest: 1 }] })).not.toContain('highDam');
  });
  it('pioneer: a dam at a spot a pond found', () => {
    const half = { spot: spot.id, wood: 1, mud: 0, rock: 0 };
    expect(won({ ...base(), dams: [half] })).toEqual([]);
    expect(won({ ...base(), dams: [half], spots: [{ ...spot, found: true }] })).toEqual(['pioneer']);
  });
  it('pantry: every place holds a piece', () => {
    const store = Array.from({ length: STORE_CAPACITY }, () => 'branch' as const);
    expect(won({ ...base(), store: store.map((p, i) => (i === 0 ? null : p)) })).toEqual([]);
    expect(won({ ...base(), store })).toEqual(['pantry']);
  });
  it('the counters: pads, mends, loads', () => {
    expect(won({ ...base(), padsPicked: GARDENER_PADS - 1 })).toEqual([]);
    expect(won({ ...base(), padsPicked: GARDENER_PADS })).toEqual(['gardener']);
    expect(won({ ...base(), mended: 1 })).toEqual(['handy']);
    expect(won({ ...base(), hauled: HAULER_LOADS })).toEqual(['hauler']);
  });
  it('a full year of game clock', () => {
    expect(won({ ...base(), clock: START_CLOCK + DAYS_PER_YEAR * DAY_SECONDS - 1 })).toEqual([]);
    expect(won({ ...base(), clock: START_CLOCK + DAYS_PER_YEAR * DAY_SECONDS })).toEqual(['year']);
  });
});

describe('the counts', () => {
  it('counts a pad picked, and one picked again after it grew back', () => {
    expect(padsBetween({}, { a: 0 })).toBe(1);
    expect(padsBetween({ a: 0 }, { a: 0 })).toBe(0);
    expect(padsBetween({ a: 0 }, { a: 1 })).toBe(1);
  });
  it('counts a dam mended from worn back to new, and not one built or only a little mended', () => {
    const at = (level: number, clock = 0) => ({ ...base(), clock, dams: [{ ...whole, wear: { level, since: 0, mend: 0 } }] });
    expect(mendsBetween(at(0.4), at(1))).toBe(1);
    expect(mendsBetween(at(0.4), at(0.6))).toBe(0);
    expect(mendsBetween(base(), at(1))).toBe(0);
    expect(mendsBetween({ ...base(), dams: [whole] }, at(1))).toBe(0);
  });
  it('tally records a win once and keeps the counters', () => {
    const before = { ...base(), felled: ids(WOOD_TREES - 1) };
    const after = tally(before, { ...before, felled: ids(WOOD_TREES) });
    expect(after.achievements).toEqual(['wood']);
    expect(tally(after, after).achievements).toEqual(['wood']);
  });
});

describe('in a step', () => {
  const build = { ...noActions(), build: true };
  it('counts a load of mud put on a dam, and wins the first dam when it completes', () => {
    const w0 = { ...base(), dams: [{ ...whole, mud: LEVEL1_COST.mud - 1 }], haul: { kind: 'mud' as const } };
    const w1 = step(w0, build, 0.1, dry);
    expect(w1.hauled).toBe(1);
    expect(w1.achievements).toEqual(['firstDam']);
  });
  it('does not count a load that was not used', () => {
    const w1 = step({ ...base(), spots: [], haul: { kind: 'mud' as const } }, build, 0.1, dry);
    expect(w1.hauled).toBe(0);
  });
  it('a mend back to new is the handy beaver', () => {
    const w0 = { ...base(), spots: [{ ...spot, maxCrest: 1 }], clock: 0, dams: [{ ...whole, wear: { level: 0.9, since: 0, mend: 0 } }], haul: { kind: 'rock' as const } };
    expect(step(w0, build, 0.1, dry).achievements).toContain('handy');
    expect(newWear(0).level).toBe(1);
  });
});

describe('the list', () => {
  it('marks what is won and counts what is counted', async () => {
    const { achievementLines } = await import('./achievements');
    const lines = achievementLines({ achievements: ['home'], felled: ids(12), padsPicked: 3, hauled: 0 });
    expect(lines[0]).toBe('[ ] Wood 12/30');
    expect(lines[1]).toBe('[x] Home');
    expect(lines).toContain('[ ] Water gardener 3/20');
    expect(lines).toHaveLength(10);
  });
});
