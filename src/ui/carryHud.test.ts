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
    const info = { carry: 'branch' as const, haul: null, dam: null, store: { total: 12, capacity: 40, meals: 18 }, repair: null, hint: 'store' as const };
    expect(formatCarry(2, false, null, 1, null, null, info)).toBe('2 trees felled, lodge done, carrying a branch, store 12 of 40, 18 meals, press Build to open the store');
    expect(formatCarry(2, false, null, null, null, 'nest', { carry: null, haul: null, dam: null, store: null, repair: null, hint: null })).toBe('in the lodge, on the nest');
  });

  it('has nothing to say before there is food or a lodge', () => {
    expect(foodInfoOf(createWorld(flatTerrain(0)), flatTerrain(0))).toBeNull();
  });

  it('shows the store once the lodge is whole, and eating inside', () => {
    const w = { ...createWorld(flatTerrain(0)), lodge };
    expect(foodInfoOf(w, flatTerrain(0))).toEqual({ carry: null, haul: null, dam: null, store: { total: 0, capacity: 40, meals: 0 }, repair: null, hint: null });
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

describe('dam line', () => {
  const spot = { id: 's', bed: { x: 0, z: 0 }, bedY: 0, flow: { x: 1, z: 0 }, maxCrest: 2, pondM2: 900 };
  it('shows what the dam at a spot needs, and offers Build for a piece it needs', () => {
    const w = { ...createWorld(flatTerrain(0)), spots: [spot], dams: [{ spot: 's', wood: 8, mud: 1, rock: 0 }], haul: { kind: 'mud' as const } };
    const info = foodInfoOf(w, flatTerrain(0))!;
    expect(info.dam).toMatchObject({ percent: 64, wood: 0, mud: 3, rock: 2, canAdd: true });
    expect(formatCarry(0, false, null, null, null, null, info)).toContain('dam 64%, needs 3 mud, 2 rocks, press Build to add it');
  });
  it('says done for a whole dam and shows nothing away from a spot', () => {
    const w = { ...createWorld(flatTerrain(0)), spots: [{ ...spot, maxCrest: 1 }], dams: [{ spot: 's', wood: 8, mud: 4, rock: 2 }] };
    expect(formatCarry(0, false, null, null, null, null, foodInfoOf(w, flatTerrain(0)))).toContain('dam done, as high as a dam can go here');
    expect(foodInfoOf({ ...w, beaver: { ...w.beaver, x: 50 } }, flatTerrain(0))).toBeNull();
  });
  it('says as high as a dam can go only at the top level of the spot', () => {
    const w = { ...createWorld(flatTerrain(0)), spots: [spot], dams: [{ spot: 's', level: 2 as const, wood: 14, mud: 8, rock: 5 }] };
    const mid = foodInfoOf(w, flatTerrain(0))!;
    expect(mid.dam).toMatchObject({ top: false, raise: true });
    expect(formatCarry(0, false, null, null, null, null, mid)).not.toContain('as high as');
    const top = foodInfoOf({ ...w, dams: [{ spot: 's', level: 3 as const, wood: 22, mud: 12, rock: 9 }] }, flatTerrain(0))!;
    expect(formatCarry(0, false, null, null, null, null, top)).toContain('dam level 3 done, as high as a dam can go here');
  });
  it('offers to raise a good whole dam, and counts a raise from the level below', () => {
    const w = { ...createWorld(flatTerrain(0)), spots: [spot], dams: [{ spot: 's', wood: 8, mud: 4, rock: 2 }], haul: { kind: 'rock' as const } };
    const info = foodInfoOf(w, flatTerrain(0))!;
    expect(info.dam).toMatchObject({ raise: true, whole: false, level: 2, percent: 0, wood: 6, mud: 4, rock: 3, canAdd: true });
    expect(formatCarry(0, false, null, null, null, null, info)).toContain('dam level 1 done, raise it to level 2: needs 6 wood, 4 mud, 3 rocks, press Build to add it');
    const part = { ...w, dams: [{ spot: 's', level: 2 as const, wood: 14, mud: 4, rock: 2 }], haul: null };
    expect(formatCarry(0, false, null, null, null, null, foodInfoOf(part, flatTerrain(0)))).toContain('dam level 2 46%, needs 4 mud, 3 rocks');
  });
  it('shows a worn dam as a repair that takes any material, and a broken one as built again', () => {
    const dams = [{ spot: 's', wood: 8, mud: 4, rock: 2, wear: newWear(0) }];
    const base = { ...createWorld(flatTerrain(0)), spots: [spot], dams, haul: { kind: 'rock' as const } };
    const worn = foodInfoOf({ ...base, clock: 12 * DAY_SECONDS }, flatTerrain(0))!; // condition 0.4
    expect(worn.repair).toEqual({ what: 'dam', percent: 40, wood: 6, broken: false });
    expect(worn.dam).toMatchObject({ whole: true, canAdd: true });
    const text = formatCarry(0, false, null, null, null, null, worn);
    expect(text).toContain('dam worn 40%, needs 6 units (a long log is 2, mud 1, a rock 2)');
    expect(text).not.toContain('dam done, as high as a dam can go here');
    const mended = [{ ...dams[0]!, repairing: true, wear: { level: 0.6, since: 12 * DAY_SECONDS, mend: 0 } }];
    const part = foodInfoOf({ ...base, dams: mended, clock: 12 * DAY_SECONDS }, flatTerrain(0))!; // good again, not new
    expect(part.repair).toEqual({ what: 'dam', percent: 60, wood: 4, broken: false });
    const broken = foodInfoOf({ ...base, clock: 18 * DAY_SECONDS }, flatTerrain(0))!;
    expect(broken.repair).toMatchObject({ what: 'dam', broken: true });
    expect(broken.dam).toMatchObject({ whole: false, percent: 0 });
    expect(formatCarry(0, false, null, null, null, null, broken)).toContain('dam broken, build it again, dam 0%, needs 8 wood, 4 mud, 2 rocks');
  });
});
