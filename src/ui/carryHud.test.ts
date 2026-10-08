import { describe, expect, it } from 'vitest';
import { LODGE_WOOD } from '../sim/lodge';
import { DAY_SECONDS } from '../sim/clock';
import { newWear } from '../sim/wear';
import { createWorld } from '../sim/state';
import { flatTerrain } from '../sim/terrain';
import { formatCarry, foodInfoOf } from './carryHud';

describe('carry hud', () => {
  it('shows the trees felled', () => {
    expect(formatCarry(5, false, null)).toBe('5 trees felled');
    expect(formatCarry(1, false, null)).toBe('1 tree felled');
  });

  it('shows the gnaw progress', () => {
    expect(formatCarry(0, false, 0.5)).toBe('0 trees felled, gnawing 50%');
  });

  it('says when a log is being dragged', () => {
    expect(formatCarry(2, true, null)).toBe('2 trees felled, dragging a log');
  });

  it('shows the lodge once it is started', () => {
    expect(formatCarry(1, false, null, 0.4)).toBe('1 tree felled, lodge 40%');
    expect(formatCarry(1, false, null, 1)).toBe('1 tree felled, lodge done');
  });

  it('says whether the spot ahead takes a lodge while dragging', () => {
    expect(formatCarry(1, true, null, null, 'ok')).toBe('1 tree felled, dragging a log, press Build to start the lodge here');
    expect(formatCarry(1, true, null, null, 'deep')).toBe('1 tree felled, dragging a log, no lodge spot, too deep');
    expect(formatCarry(1, true, null, null, null)).toBe('1 tree felled, dragging a log');
  });

  it('says what the lodge room offers while inside', () => {
    expect(formatCarry(1, false, null, 1, null, 'hole')).toBe('in the lodge, press Build to dive out through the water hole');
    expect(formatCarry(1, false, null, 1, null, 'room')).toBe('in the lodge, the water hole is the way out');
    expect(formatCarry(1, false, null, 1, null, null)).toBe('1 tree felled, lodge done');
  });
});

describe('food line', () => {
  const lodge = { x: 0, z: 0, base: 0, door: 0, wood: LODGE_WOOD };

  it('says what is in the mouth, the store, and what a press does', () => {
    const info = { carry: 'branch' as const, haul: null, store: { total: 12, capacity: 40, meals: 18 }, repair: null, hint: 'store' as const };
    expect(formatCarry(2, false, null, 1, null, null, info)).toBe('2 trees felled, lodge done, carrying a branch, store 12 of 40, 18 meals, press Build to open the store');
    expect(formatCarry(2, false, null, null, null, 'nest', { carry: null, haul: null, store: null, repair: null, hint: null })).toBe('in the lodge, on the nest');
  });

  it('has nothing to say before there is food or a lodge', () => {
    expect(foodInfoOf(createWorld(flatTerrain(0)), flatTerrain(0))).toBeNull();
  });

  it('shows the store once the lodge is whole, and eating inside', () => {
    const w = { ...createWorld(flatTerrain(0)), lodge };
    expect(foodInfoOf(w, flatTerrain(0))).toEqual({ carry: null, haul: null, store: { total: 0, capacity: 40, meals: 0 }, repair: null, hint: null });
    expect(foodInfoOf({ ...w, carry: 'branch', inLodge: true }, flatTerrain(0))!.hint).toBe('eat');
  });

  it('shows the worn store, its real capacity, and the wood still needed', () => {
    const clock = 30 * DAY_SECONDS; // 30 days: the store is at 0.25
    const w = { ...createWorld(flatTerrain(0)), lodge, clock, storeWear: newWear(0), beaver: { ...createWorld(flatTerrain(0)).beaver, x: 0, z: 7.9 } };
    const info = foodInfoOf(w, flatTerrain(0))!;
    expect(info.store!.capacity).toBe(24);
    expect(info.repair).toEqual({ what: 'store', percent: 25, wood: 8, broken: false });
    expect(formatCarry(0, true, null, 1, null, null, info)).toBe('0 trees felled, lodge done, dragging a log, store worn 25%, needs 8 wood (a long log is 2), press Build to add it');
  });
});
