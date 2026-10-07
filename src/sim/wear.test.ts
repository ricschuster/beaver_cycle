import { describe, expect, it } from 'vitest';
import { noActions } from '../actions/actions';
import { DAY_SECONDS, DAYS_PER_SEASON } from './clock';
import { STORE_CAPACITY, storeCapacity, storeCondition, stored, emptyStock } from './food';
import { LODGE_WOOD, lodgeCondition, type Lodge } from './lodge';
import type { Log } from './logs';
import { createWorld, type WorldState } from './state';
import { step } from './step';
import { flatTerrain } from './terrain';
import { BROKEN_BELOW, LODGE_WORN_DAYS, MEND_PER_WOOD, STORE_REBUILD_WOOD, STORE_WORN_DAYS, WORN_BELOW, mended, newWear, stageOf } from './wear';

const flat = flatTerrain(0);
const day = (n: number): number => n * DAY_SECONDS;
const log = (id: string, length: number): Log => ({ id, x: 0, y: 0, z: 0, heading: 0, length, floating: false });

/** A whole lodge at (0, 2) and its store, both new at clock 0, and a beaver at the lodge dragging a log. */
function world(clock: number, length = 4): WorldState {
  const lodge: Lodge = { x: 0, z: 2, base: 0, door: 0, wood: LODGE_WOOD, wear: newWear(0) };
  const w = createWorld(flat, 0, 0);
  return { ...w, clock, lodge, storeWear: newWear(0), logs: [log('a', length)], drag: 'a' };
}

describe('wear over days', () => {
  it('stays new for a structure with no record', () => {
    expect(lodgeCondition({ x: 0, z: 0, base: 0, door: 0, wood: LODGE_WOOD }, day(500))).toBe(1);
  });

  it('wears the lodge to worn after a year and the store after two seasons', () => {
    const w = world(0);
    expect(lodgeCondition(w.lodge!, day(LODGE_WORN_DAYS))).toBeCloseTo(WORN_BELOW);
    expect(storeCondition(w.storeWear, day(2 * DAYS_PER_SEASON))).toBeCloseTo(WORN_BELOW);
    expect(lodgeCondition(w.lodge!, day(10))).toBeGreaterThan(0.85);
  });

  it('never goes below broken at zero', () => {
    expect(storeCondition(newWear(0), day(1000))).toBe(0);
  });

  it('ages across a clock jump, as sleep or a season change does', () => {
    expect(storeCondition(newWear(0), day(40))).toBeLessThan(storeCondition(newWear(0), day(10)));
  });
});

describe('stages', () => {
  it('follows the thresholds', () => {
    expect(stageOf(0.9)).toBe('good');
    expect(stageOf(WORN_BELOW)).toBe('good');
    expect(stageOf(WORN_BELOW - 0.01)).toBe('worn');
    expect(stageOf(BROKEN_BELOW)).toBe('worn');
    expect(stageOf(BROKEN_BELOW - 0.01)).toBe('broken');
  });
});

describe('mending', () => {
  it('tops a worn piece up by the wood placed', () => {
    const worn = { level: 0.4, since: 0, mend: 0 };
    const after = mended(worn, 0, 20, 2, 4);
    expect(after.level).toBeCloseTo(0.4 + 2 * MEND_PER_WOOD);
  });

  it('never goes past new', () => {
    expect(mended({ level: 0.95, since: 0, mend: 0 }, 0, 20, 2, 4).level).toBe(1);
  });

  it('needs the full set to rebuild a broken piece', () => {
    let wear = { level: 0.05, since: 0, mend: 0 };
    wear = mended(wear, 0, 20, 2, STORE_REBUILD_WOOD);
    expect(stageOf(wear.level)).toBe('broken');
    expect(wear.mend).toBe(2);
    wear = mended(wear, 0, 20, 2, STORE_REBUILD_WOOD);
    expect(wear.level).toBe(1);
    expect(wear.mend).toBe(0);
  });
});

describe('repair by placing a log', () => {
  it('mends a worn lodge and uses up the log', () => {
    const clock = day(LODGE_WORN_DAYS); // worn
    const before = lodgeCondition(world(clock).lodge!, clock);
    const after = step(world(clock), { ...noActions(), build: true }, 0, flat);
    expect(lodgeCondition(after.lodge!, clock)).toBeCloseTo(before + 0.1 * 1);
    expect(after.logs).toHaveLength(0);
    expect(after.drag).toBeNull();
  });

  it('keeps the log when the lodge is as good as new', () => {
    const after = step(world(0), { ...noActions(), build: true }, 0, flat);
    expect(after.logs).toHaveLength(1);
    expect(after.drag).toBe('a');
  });

  it('mends the store when the beaver stands at it and the lodge is fine', () => {
    const w = world(day(2 * DAYS_PER_SEASON));
    // Stand at the store, far enough from the lodge's centre that only the store is in reach.
    const at = { ...w, lodge: { ...w.lodge!, wear: newWear(w.clock) }, beaver: { ...w.beaver, x: 0, z: 2 + 7.9 } };
    const before = storeCondition(at.storeWear, at.clock);
    const after = step(at, { ...noActions(), build: true }, 0, flat);
    expect(storeCondition(after.storeWear, at.clock)).toBeGreaterThan(before);
    expect(after.logs).toHaveLength(0);
  });

  it('a new lodge starts to wear from the moment it is whole', () => {
    const lodge: Lodge = { x: 0, z: 2, base: 0, door: 0, wood: LODGE_WOOD - 2 };
    const w = { ...createWorld(flat, 0, 0), clock: day(3), lodge, logs: [log('a', 6)], drag: 'a' };
    const after = step(w, { ...noActions(), build: true }, 0, flat);
    expect(after.lodge!.wear).toEqual(newWear(day(3)));
    expect(after.storeWear).toEqual(newWear(day(3)));
  });
});

describe('effects', () => {
  it('a worn store holds less and a broken one nothing', () => {
    expect(storeCapacity(1)).toBe(STORE_CAPACITY);
    expect(storeCapacity(0.3)).toBeLessThan(STORE_CAPACITY);
    expect(storeCapacity(0.3)).toBeGreaterThan(0);
    expect(storeCapacity(0.05)).toBe(0);
    expect(stored(emptyStock(), 'branch', 0)).toEqual(emptyStock());
  });

  it('a broken store loses what it held', () => {
    const w = { ...world(day(STORE_WORN_DAYS * 2)), drag: null, store: { ...emptyStock(), branch: 5 } };
    expect(step(w, noActions(), 0, flat).store).toEqual(emptyStock());
    const fresh = { ...w, clock: 0 };
    expect(step(fresh, noActions(), 0, flat).store.branch).toBe(5);
  });
});
