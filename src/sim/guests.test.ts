import { describe, expect, it } from 'vitest';
import { newGuest, stepGuest, type Shared } from './guests';
import { noIntent } from './buttons';
import { CHOP_TIME, noTrees, type TreeSource } from './trees';
import { WALK_SPEED } from './state';
import { flatTerrain, type Terrain } from './terrain';
import { damAt } from './dam';
import type { DamSpot } from './damSpots';
import { fallenLog } from './logs';
import { DAY_SECONDS, DAYS_PER_SEASON } from './clock';
import { lilyPadsNear } from './lily';

const ground = flatTerrain(0);
const shared: Shared = { felled: [], logs: [], clock: 0, dams: [], spots: [], rocksTaken: [], dropped: [], ground, picked: {}, stripped: {} };
const at = { x: 0, z: 0 };
const coat = { coat: 1, shade: 0 };
const tree = { id: 't1', x: 1, z: 0, wood: 4 };
const oneTree: TreeSource = {
  nearest: (_x, _z, _r, felled) => (felled.has('t1') ? null : tree),
  trunksNear: () => [],
};

describe('guest beavers', () => {
  it('walk where the intent points, at the walking speed, and face the way', () => {
    const g = newGuest('g1', at, ground, coat, undefined);
    const r = stepGuest(g, { ...noIntent(), move: { x: 1, z: 0 } }, 1, shared, ground, noTrees);
    expect(r.guest.beaver.x).toBeCloseTo(WALK_SPEED, 5);
    expect(r.guest.beaver.heading).toBeCloseTo(Math.PI / 2, 5);
    expect(r.guest.pace).toBe(1);
  });

  it('cannot move faster than the speed by pushing a long vector', () => {
    const g = newGuest('g1', at, ground, coat, undefined);
    const r = stepGuest(g, { ...noIntent(), move: { x: 50, z: 0 } }, 1, shared, ground, noTrees);
    expect(r.guest.beaver.x).toBeCloseTo(WALK_SPEED, 5);
  });

  it('slide round a trunk', () => {
    const g = newGuest('g1', at, ground, coat, undefined);
    const wall: TreeSource = { nearest: () => null, trunksNear: () => [{ x: 5, z: 0, radius: 1 }] };
    const r = stepGuest(g, { ...noIntent(), move: { x: 1, z: 0 } }, 1, shared, ground, wall);
    expect(r.guest.beaver.x).toBeLessThan(5);
  });

  it('gnaw a tree down standing still, and it is felled for all and lies as a log', () => {
    let g = newGuest('g1', at, ground, coat, undefined);
    let s = shared;
    const gnaw = { ...noIntent(), do: 'gnaw' as const };
    for (let t = 0; t < CHOP_TIME + 1; t += 0.5) {
      const r = stepGuest(g, gnaw, 0.5, s, ground, oneTree);
      g = r.guest;
      s = { ...s, felled: r.felled, logs: r.logs };
    }
    expect(s.felled).toEqual(['t1']);
    expect(s.logs).toHaveLength(1);
    expect(g.chop).toBeNull();
  });

  it('stop gnawing when they move', () => {
    let g = newGuest('g1', at, ground, coat, undefined);
    g = stepGuest(g, { ...noIntent(), do: 'gnaw' }, 1, shared, ground, oneTree).guest;
    expect(g.chop).not.toBeNull();
    g = stepGuest(g, { ...noIntent(), move: { x: 1, z: 0 }, do: 'gnaw' }, 0.1, shared, ground, oneTree).guest;
    expect(g.chop).toBeNull();
  });

  it('clean a look that is out of range', () => {
    const g = newGuest('g1', at, ground, coat, { hat: 99, scarf: -3, tail: 2, name: 'Pip' });
    expect(g.look).toMatchObject({ hat: 0, scarf: 0, tail: 2, name: 'Pip' });
  });

  describe('working on a dam', () => {
    const spot: DamSpot = { id: 'core:50:0', bed: { x: 50, z: 0 }, bedY: 0, flow: { x: 1, z: 0 }, maxCrest: 2, pondM2: 900 };
    const wet: Terrain = { heightAt: () => 0, isWater: () => false, waterDepth: () => 0.1 };
    const at50 = { x: 50, z: 0 };
    const work: Shared = { ...shared, spots: [spot] };

    it('scoops mud, carries it, and puts it on a dam at a spot', () => {
      let g = newGuest('g1', at50, wet, coat, undefined);
      g = stepGuest(g, { ...noIntent(), take: 'mud' }, 0.1, work, wet, noTrees).guest;
      expect(g.haul).toEqual({ kind: 'mud' });
      const r = stepGuest(g, { ...noIntent(), do: 'build' }, 0.1, work, wet, noTrees);
      expect(r.guest.haul).toBeNull();
      expect(damAt(r.dams, spot)?.mud).toBe(1);
    });

    it('keeps mud in the mouth away from a spot, and puts it down for later', () => {
      let g = newGuest('g1', { x: 0, z: 0 }, wet, coat, undefined);
      g = stepGuest(g, { ...noIntent(), take: 'mud' }, 0.1, work, wet, noTrees).guest;
      const r = stepGuest(g, { ...noIntent(), do: 'build' }, 0.1, work, wet, noTrees);
      expect(r.guest.haul).toEqual({ kind: 'mud' });
      expect(r.dams).toEqual([]);
      const d = stepGuest(r.guest, { ...noIntent(), take: 'drop' }, 0.1, work, wet, noTrees);
      expect(d.guest.haul).toBeNull();
      expect(d.dropped).toHaveLength(1);
      const back = stepGuest(d.guest, { ...noIntent(), take: 'item' }, 0.1, { ...work, dropped: d.dropped }, wet, noTrees);
      expect(back.guest.haul).toEqual({ kind: 'mud' });
      expect(back.dropped).toHaveLength(0);
    });

    it('drags a log and builds it into the dam', () => {
      const log = fallenLog(ground, 'log1', 49, 0, 0, 4);
      const withLog: Shared = { ...work, logs: [log] };
      let g = newGuest('g1', at50, ground, coat, undefined);
      g = stepGuest(g, { ...noIntent(), take: 'log' }, 0.1, withLog, ground, noTrees).guest;
      expect(g.drag).toBe('log1');
      const r = stepGuest(g, { ...noIntent(), do: 'build' }, 0.1, withLog, ground, noTrees);
      expect(r.logs).toHaveLength(0);
      expect(r.guest.drag).toBeNull();
      expect(damAt(r.dams, spot)?.wood).toBeGreaterThan(0);
    });

    it('cannot gnaw with the mouth full', () => {
      let g = newGuest('g1', at, wet, coat, undefined);
      g = stepGuest(g, { ...noIntent(), take: 'mud' }, 0.1, work, wet, oneTree).guest;
      const r = stepGuest(g, { ...noIntent(), do: 'gnaw' }, 0.1, work, wet, oneTree);
      expect(r.guest.chop).toBeNull();
    });
  });

  describe('food in the mouth (#663)', () => {
    it('picks up food a friend put on the ground, and puts it down again', () => {
      const lying = { id: 'drop:1', kind: 'branch' as const, at: 0, x: 0.5, z: 0 };
      const g = newGuest('g1', at, ground, coat, undefined);
      const got = stepGuest(g, { ...noIntent(), take: 'item' }, 0.1, { ...shared, dropped: [lying] }, ground, noTrees);
      expect(got.guest.carry).toBe('branch');
      expect(got.dropped).toHaveLength(0);
      const down = stepGuest(got.guest, { ...noIntent(), take: 'drop' }, 0.1, shared, ground, noTrees);
      expect(down.guest.carry).toBeNull();
      expect(down.dropped.map((d) => d.kind)).toEqual(['branch']);
    });

    it('takes a lily pad off the water, and the pad is gone for everyone', () => {
      const lake: Terrain = { heightAt: () => 0, isWater: () => true, waterDepth: () => 1.5 };
      const clock = DAY_SECONDS * DAYS_PER_SEASON * 1.5;
      const pad = lilyPadsNear(lake, 0, 0, 50, clock)[0]!;
      const g = newGuest('g1', { x: pad.x, z: pad.z }, lake, coat, undefined);
      const r = stepGuest(g, { ...noIntent(), take: 'pad' }, 0.1, { ...shared, clock, ground: lake }, lake, noTrees);
      expect(r.guest.carry).toBe('lily');
      expect(Object.keys(r.picked)).toContain(pad.id);
    });

    it('strips a branch off a log by it, until the log has none left', () => {
      const log = fallenLog(ground, 'log1', 0, 0, 0, 4);
      const g = newGuest('g1', { x: 0, z: 1 }, ground, coat, undefined);
      const r = stepGuest(g, { ...noIntent(), do: 'strip' }, 0.1, { ...shared, logs: [log] }, ground, noTrees);
      expect(r.guest.carry).toBe('branch');
      expect(r.stripped['log1']).toBe(1);
      const again = stepGuest({ ...g, carry: null }, { ...noIntent(), do: 'strip' }, 0.1, { ...shared, logs: [log], stripped: { log1: 99 } }, ground, noTrees);
      expect(again.guest.carry).toBeNull();
    });

    it('does not gnaw with food in the mouth', () => {
      const g = { ...newGuest('g1', at, ground, coat, undefined), carry: 'lily' as const };
      expect(stepGuest(g, { ...noIntent(), do: 'gnaw' }, 0.1, shared, ground, oneTree).guest.chop).toBeNull();
    });
  });
});
