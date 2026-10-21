import { describe, expect, it } from 'vitest';
import { noIntent, type Intent } from './buttons';
import { MEND_PER_WOOD } from './wear';
import { DAM_MEND_FACTOR, LEVEL_COST, LEVEL1_COST, costOf, damAt, damCondition, damMendUnits, damNeedsRepair, damProgress, damWhole, levelOf, needs, placed, raised, spotAt } from './dam';
import { widthFactor } from './damSpots';
import { DAY_SECONDS } from './clock';
import { newWear } from './wear';
import type { DamSpot } from './damSpots';
import { fallenLog } from './logs';
import { createWorld } from './state';
import { step } from './step';
import type { Terrain } from './terrain';

const dry: Terrain = { heightAt: () => 0, isWater: () => false, waterDepth: () => 0 };
const spot: DamSpot = { id: 'core:50:0', bed: { x: 50, z: 0 }, bedY: 0, flow: { x: 1, z: 0 }, maxCrest: 2, pondM2: 900 };
const small: DamSpot = { ...spot, maxCrest: 1 };
const build: Intent = { ...noIntent(), do: 'build' };

describe('dam materials', () => {
  it('start a dam at a spot and stop at what it needs', () => {
    let dams = placed([], spot, { wood: 2 });
    expect(damAt(dams, spot)).toEqual({ spot: spot.id, wood: 2, mud: 0, rock: 0 });
    dams = placed(dams, spot, { wood: 100, mud: 100, rock: 100 });
    expect(damAt(dams, spot)).toEqual({ spot: spot.id, ...LEVEL1_COST });
    expect(damWhole(damAt(dams, spot))).toBe(true);
    expect(placed(dams, spot, { wood: 1 })).toBe(dams);
  });

  it('count the progress over all three', () => {
    expect(damProgress(undefined)).toBe(0);
    expect(damProgress({ spot: 's', wood: 8, mud: 4, rock: 0 })).toBeCloseTo(12 / 14);
    expect(needs({ spot: 's', wood: 3, mud: 4, rock: 1 })).toEqual({ wood: 5, mud: 0, rock: 1 });
  });

  it('find the spot within reach only', () => {
    expect(spotAt([spot], 52, 1)).toBe(spot);
    expect(spotAt([spot], 60, 0)).toBeNull();
  });
});

describe('placing at a spot', () => {
  const at = { ...createWorld(dry, 52, 0), spots: [spot] };

  it('puts mud and a rock from the mouth onto the dam', () => {
    let w = step({ ...at, haul: { kind: 'mud' } }, build, 0.1, dry);
    expect(w.haul).toBeNull();
    expect(damAt(w.dams, spot)).toMatchObject({ mud: 1, rock: 0 });
    w = step({ ...w, haul: { kind: 'rock' } }, build, 0.1, dry);
    expect(damAt(w.dams, spot)).toMatchObject({ mud: 1, rock: 1 });
  });

  it('puts a dragged log on as wood, a long one counting two', () => {
    const log = fallenLog(dry, 't1', 52, 1, 0, 6);
    const w = step({ ...at, logs: [log], drag: log.id }, build, 0.1, dry);
    expect(w.logs).toEqual([]);
    expect(w.drag).toBeNull();
    expect(damAt(w.dams, spot)?.wood).toBe(2);
  });

  it('keeps what a dam no longer needs in the mouth', () => {
    const full = { ...at, spots: [small], dams: [{ spot: spot.id, wood: 8, mud: 4, rock: 2 }], haul: { kind: 'mud' as const } };
    const w = step(full, build, 0.1, dry);
    expect(w.haul).toEqual({ kind: 'mud' });
  });

  it('does nothing away from a spot, and a log there starts no dam', () => {
    const away = { ...createWorld(dry, 80, 0), spots: [spot], haul: { kind: 'mud' as const } };
    expect(step(away, build, 0.1, dry).dams).toEqual([]);
    expect(step(away, build, 0.1, dry).haul).toEqual({ kind: 'mud' });
  });
});

describe('dam wear', () => {
  const day = DAY_SECONDS;
  const wholeAt = (clock: number) => placed([], spot, LEVEL1_COST, undefined, clock);

  it('starts when the last piece goes on and falls with the days', () => {
    const part = placed([], spot, { wood: 8, mud: 4 }, undefined, 100);
    expect(damAt(part, spot)!.wear).toBeUndefined();
    const dams = placed(part, spot, { rock: 2 }, undefined, 100);
    expect(damAt(dams, spot)!.wear).toEqual(newWear(100));
    expect(damCondition(damAt(dams, spot), 100)).toBe(1);
    expect(damCondition(damAt(dams, spot), 100 + 10 * day)).toBeCloseTo(0.5);
    expect(damCondition(undefined, 1e9)).toBe(1);
  });

  it('is mended by wood, mud, and rocks, a rock being worth two', () => {
    const dams = wholeAt(0);
    const clock = 12 * day; // condition 0.4
    expect(damMendUnits(damAt(dams, spot), clock)).toBe(3); // half of the 6 a lodge would take (Q78)
    const wood = placed(dams, spot, { wood: 1 }, undefined, clock);
    expect(damCondition(damAt(wood, spot), clock)).toBeCloseTo(0.6);
    const rock = placed(dams, spot, { rock: 1 }, undefined, clock);
    expect(damCondition(damAt(rock, spot), clock)).toBeCloseTo(0.8);
    const mud = placed(dams, spot, { mud: 1 }, undefined, clock);
    expect(damCondition(damAt(mud, spot), clock)).toBeCloseTo(0.6);
    expect(damCondition(damAt(placed(dams, spot, { wood: 20 }, undefined, clock), spot), clock)).toBe(1);
  });

  it('stays marked for repair from worn all the way back up to new', () => {
    const dams = wholeAt(0);
    expect(damNeedsRepair(damAt(dams, spot), 9 * day)).toBe(false); // good
    const clock = 12 * day; // worn, 0.4
    expect(damNeedsRepair(damAt(dams, spot), clock)).toBe(true);
    const rock = placed(dams, spot, { rock: 1 }, undefined, clock); // 0.8: good again, but not new
    expect(damNeedsRepair(damAt(rock, spot), clock)).toBe(true);
    expect(damMendUnits(damAt(rock, spot), clock)).toBe(1);
    const more = placed(rock, spot, { mud: 1 }, undefined, clock); // 1 in one more piece would be 1.0; stay under it
    expect(damCondition(damAt(more, spot), clock)).toBeCloseTo(1);
    const done = more; // 1
    expect(damCondition(damAt(done, spot), clock)).toBe(1);
    expect(damNeedsRepair(damAt(done, spot), clock)).toBe(false);
    expect(damAt(done, spot)!.repairing).toBeUndefined();
  });

  it('is not marked when a good dam is mended a little', () => {
    const dams = placed(wholeAt(0), spot, { wood: 1 }, undefined, 5 * day); // condition 0.75, takes the wood
    expect(damNeedsRepair(damAt(dams, spot), 5 * day)).toBe(false);
  });

  it('takes nothing when it is new', () => {
    const dams = wholeAt(0);
    expect(placed(dams, small, { wood: 2 }, undefined, 0)).toBe(dams);
  });

  it('is mended, not built again, once broken', () => {
    const dams = wholeAt(0);
    const clock = 18 * day; // condition 0.1
    const mended = placed(dams, spot, { wood: 2 }, undefined, clock);
    const dam = damAt(mended, spot)!;
    expect(dam.wood).toBe(8);
    expect(damWhole(dam)).toBe(true);
    expect(damCondition(dam, clock)).toBeCloseTo(0.1 + 2 * DAM_MEND_FACTOR * MEND_PER_WOOD / (dam.scale ?? 1));
    expect(damNeedsRepair(dam, clock)).toBe(true);
  });

  it('is mended in the world by a dragged log at the build button', () => {
    const t = dry;
    const dams = wholeAt(0);
    const log = fallenLog(dry, 'l1', 52, 1, 0, 6);
    const world = { ...createWorld(t, 50, 0), spots: [spot], dams, logs: [log], drag: log.id, clock: 12 * day };
    const next = step(world, build, 0.1, t);
    expect(damCondition(damAt(next.dams, spot), next.clock)).toBeGreaterThan(damCondition(damAt(dams, spot), next.clock));
    expect(next.logs).toHaveLength(0);
    expect(next.drag).toBeNull();
  });
});

describe('dam levels', () => {
  const day = DAY_SECONDS;
  const level1 = () => placed([], spot, LEVEL_COST[2]!, undefined, 0);

  it('raises a good whole dam to the next level, keeping what it has', () => {
    const dams = level1();
    expect(levelOf(damAt(dams, spot))).toBe(1);
    const up = placed(dams, spot, { wood: 6 }, undefined, 2 * day);
    expect(damAt(up, spot)).toEqual({ spot: spot.id, level: 2, wood: 14, mud: 4, rock: 2 });
    expect(damWhole(damAt(up, spot))).toBe(false);
    expect(needs(damAt(up, spot))).toEqual({ wood: 0, mud: 4, rock: 3 });
    expect(damProgress(damAt(up, spot))).toBeCloseTo(6 / 13);
  });

  it('wears again as a new dam when the bigger level is whole', () => {
    let dams = placed(level1(), spot, { wood: 6 }, undefined, 2 * day);
    dams = placed(dams, spot, { mud: 4, rock: 3 }, undefined, 3 * day);
    const dam = damAt(dams, spot)!;
    expect(dam).toMatchObject({ level: 2, wood: 14, mud: 8, rock: 5, wear: newWear(3 * day) });
    expect(damCondition(dam, 3 * day)).toBe(1);
    expect(costOf(dam)).toEqual(LEVEL_COST[1]);
  });

  it('goes up to the level the spot holds and no further', () => {
    let dams = level1();
    for (let i = 0; i < 4; i++) dams = placed(dams, spot, LEVEL_COST[2]!, undefined, 0);
    expect(levelOf(damAt(dams, spot))).toBe(3);
    expect(damWhole(damAt(dams, spot))).toBe(true);
    expect(placed(dams, spot, { wood: 1 }, undefined, 0)).toBe(dams);
    const two: DamSpot = { ...spot, maxCrest: 1.5 };
    const second = placed(level1(), two, LEVEL_COST[2]!, undefined, 0);
    expect(levelOf(damAt(second, two))).toBe(2);
    expect(placed(second, two, { wood: 1 }, undefined, 0)).toBe(second);
  });

  it('is mended, not raised, once worn or in the middle of a repair', () => {
    const dams = level1();
    expect(raised(damAt(dams, spot), spot, 8 * day)).toBeDefined(); // 0.6, not worn yet
    expect(raised(damAt(dams, spot), spot, 12 * day)).toBeUndefined(); // worn
    const mended = placed(dams, spot, { rock: 1 }, undefined, 12 * day); // 0.6 and still marked
    expect(damNeedsRepair(damAt(mended, spot), 12 * day)).toBe(true);
    expect(raised(damAt(mended, spot), spot, 12 * day)).toBeUndefined();
    expect(levelOf(damAt(mended, spot))).toBe(1);
  });

  it('keeps its level when it breaks, and is mended from there', () => {
    const dams = placed(level1(), spot, LEVEL_COST[2]!, undefined, 0);
    expect(levelOf(damAt(dams, spot))).toBe(2);
    const mended = placed(dams, spot, { wood: 1 }, undefined, 40 * day);
    expect(levelOf(damAt(mended, spot))).toBe(2);
    expect(damCondition(damAt(mended, spot), 40 * day)).toBeGreaterThan(0);
  });

  it('never raises a dam without a clock (a test dam)', () => {
    const dams = placed([], spot, LEVEL_COST[2]!);
    expect(placed(dams, spot, { wood: 5 })).toBe(dams);
  });
});

describe('dam cost follows the length of the wall', () => {
  const day = DAY_SECONDS;
  const narrow: DamSpot = { ...spot, widths: [8, 10, 11] }; // half a typical wall, clamped up to 0.6
  const wide: DamSpot = { ...spot, widths: [40, 50, 55] }; // two and a half times a typical wall, clamped to 2
  const typical: DamSpot = { ...spot, widths: [16, 20, 22] };

  it('scales the table price by the length, clamped between 0.6 and 2', () => {
    expect(widthFactor(typical, 1)).toBe(1);
    expect(widthFactor(narrow, 1)).toBe(0.6);
    expect(widthFactor(wide, 2)).toBe(2);
    expect(widthFactor(spot, 3)).toBe(1); // length not known
    expect(widthFactor({ ...spot, widths: [20, null, 22] }, 2)).toBe(1);
  });

  it('asks a wide spot for more and a narrow one for less at level 1', () => {
    const cost = (s: DamSpot) => costOf(damAt(placed([], s, { wood: 1 }, undefined, 0), s));
    expect(cost(typical)).toEqual(LEVEL_COST[0]);
    expect(cost(wide)).toEqual({ wood: 16, mud: 8, rock: 4 });
    expect(cost(narrow)).toEqual({ wood: 5, mud: 2, rock: 1 });
    const done = placed([], narrow, LEVEL_COST[2]!, undefined, 0);
    expect(damWhole(damAt(done, narrow))).toBe(true);
    expect(damAt(done, narrow)).toMatchObject({ wood: 5, mud: 2, rock: 1, scale: 0.6 });
  });

  it('keeps the price from falling when raised, so nothing placed is lost', () => {
    const odd: DamSpot = { ...spot, widths: [40, 10, 22] };
    let dams = placed([], odd, LEVEL_COST[2]!, undefined, 0);
    expect(damAt(dams, odd)!.scale).toBe(2);
    dams = placed(dams, odd, { wood: 1 }, undefined, day);
    const up = damAt(dams, odd)!;
    expect(up).toMatchObject({ level: 2, scale: 2 });
    expect(damWhole(up)).toBe(false);
    expect(damProgress(up)).toBeGreaterThan(0);
    expect(damProgress(up)).toBeLessThan(0.2);
  });

  it('mends a long wall with more and a short one with less', () => {
    const mendUnits = (s: DamSpot) => damMendUnits(damAt(placed([], s, LEVEL_COST[2]!, undefined, 0), s), 5 * day);
    expect(mendUnits(typical)).toBe(2); // 0.75 to 1 at 0.2 a unit, rounded up
    expect(mendUnits(wide)).toBe(3);
    expect(mendUnits(narrow)).toBe(1);
    const worn = placed([], wide, LEVEL_COST[2]!, undefined, 0);
    const next = placed(worn, wide, { wood: 2 }, undefined, 15 * day); // condition 0.25 + 2 * 0.2 / 2
    expect(damCondition(damAt(next, wide), 15 * day)).toBeCloseTo(0.45);
  });

});
