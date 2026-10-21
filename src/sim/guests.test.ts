import { describe, expect, it } from 'vitest';
import { guestStage, newGuest, reborn, stepGuest, type Guest, type Shared } from './guests';
import { DOOR_DISTANCE, HOLE, INTERIOR_RADIUS, LODGE_WOOD, SOLID_RADIUS, doorPoint } from './lodge';
import { newWear } from './wear';
import type { PairLodge } from './pairLodge';
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
const shared: Shared = { felled: [], logs: [], clock: 0, dams: [], spots: [], rocksTaken: [], dropped: [], ground, picked: {}, stripped: {}, pairLodges: [], ponds: [], partner: null };
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

  describe('in the pair lodge (#666, note 48)', () => {
    const deep: Terrain = { heightAt: () => -3, isWater: () => true, waterDepth: () => 3 };
    const home: PairLodge = { x: 20, z: 0, base: 0, door: Math.PI / 2, wood: LODGE_WOOD, wear: newWear(0), players: ['g1', 'host'], wholeAt: 0 };
    const withHome: Shared = { ...shared, ground: deep, pairLodges: [home] };
    const diver = (g: ReturnType<typeof newGuest>) => ({ ...g, beaver: { ...g.beaver, ...doorPoint(home, DOOR_DISTANCE), y: -2.8, mode: 'dive' as const } });

    it('swims in at the door of a whole lodge and stands in the round room', () => {
      const g = diver(newGuest('g1', at, deep, coat, undefined));
      const r = stepGuest(g, { ...noIntent(), move: { x: -1, z: 0 }, dive: true }, 0.05, withHome, deep, noTrees);
      expect(r.guest.inside).toBe(true);
      expect(r.guest.beaver.mode).toBe('walk');
      expect(r.guest.beaver.y).toBe(home.base);
      expect(Math.hypot(r.guest.beaver.x - home.x, r.guest.beaver.z - home.z)).toBeLessThan(INTERIOR_RADIUS);
    });

    it('does not go in at a lodge that is not whole, is broken, or is another pair\'s', () => {
      const g = diver(newGuest('g1', at, deep, coat, undefined));
      const go = { ...noIntent(), move: { x: -1, z: 0 }, dive: true };
      expect(stepGuest(g, go, 0.05, { ...withHome, pairLodges: [{ ...home, wood: 4 }] }, deep, noTrees).guest.inside).toBe(false);
      expect(stepGuest(g, go, 0.05, { ...withHome, clock: 100 * DAY_SECONDS }, deep, noTrees).guest.inside).toBe(false);
      expect(stepGuest(g, go, 0.05, { ...withHome, pairLodges: [{ ...home, players: ['x', 'y'] }] }, deep, noTrees).guest.inside).toBe(false);
    });

    it('walks round the room, stays in it, and walks round the water hole', () => {
      let g: Guest = { ...newGuest('g1', at, deep, coat, undefined), inside: true, beaver: { x: home.x + 4, y: 0, z: home.z, mode: 'walk', heading: 0, breath: 1 } };
      for (let i = 0; i < 100; i++) g = stepGuest(g, { ...noIntent(), move: { x: 1, z: 0 } }, 0.1, withHome, deep, noTrees).guest;
      expect(Math.hypot(g.beaver.x - home.x, g.beaver.z - home.z)).toBeLessThanOrEqual(INTERIOR_RADIUS + 1e-6);
      let h: Guest = { ...g, beaver: { ...g.beaver, x: home.x + 3, z: home.z } };
      for (let i = 0; i < 100; i++) h = stepGuest(h, { ...noIntent(), move: { x: -1, z: 0 } }, 0.1, withHome, deep, noTrees).guest;
      expect(Math.hypot(h.beaver.x - home.x, h.beaver.z - home.z)).toBeGreaterThanOrEqual(HOLE.radius - 1e-6);
    });

    it('a press of Dive at the water hole goes out through the entrance, a held Dive or a press away from it does not', () => {
      const room: Guest = { ...newGuest('g1', at, deep, coat, undefined), inside: true, beaver: { x: home.x + 2, y: 0, z: home.z, mode: 'walk', heading: 0, breath: 1 } };
      const out = stepGuest(room, { ...noIntent(), diveTap: true }, 0.05, withHome, deep, noTrees).guest;
      expect(out.inside).toBe(false);
      expect(out.beaver.mode).toBe('dive');
      expect(Math.hypot(out.beaver.x - home.x, out.beaver.z - home.z)).toBeGreaterThan(SOLID_RADIUS);
      expect(stepGuest(room, { ...noIntent(), dive: true }, 0.05, withHome, deep, noTrees).guest.inside).toBe(true);
      const far = { ...room, beaver: { ...room.beaver, x: home.x + 5.5 } };
      expect(stepGuest(far, { ...noIntent(), diveTap: true }, 0.05, withHome, deep, noTrees).guest.inside).toBe(true);
    });

    it('does nothing with trees or logs inside the room', () => {
      const room = { ...newGuest('g1', at, deep, coat, undefined), inside: true, beaver: { x: home.x + 4, y: 0, z: home.z, mode: 'walk' as const, heading: 0, breath: 1 } };
      expect(stepGuest(room, { ...noIntent(), do: 'gnaw' }, 0.1, withHome, deep, oneTree).guest.chop).toBeNull();
    });

    it('is born a kit on its nest, small, and cannot gnaw or build until it is grown', () => {
      const kit = reborn(newGuest('g1', at, ground, coat, undefined), home, { coat: 3, shade: 0 }, 0);
      expect(kit).toMatchObject({ inside: true, bornAt: 0 });
      expect(kit.parents).toEqual([coat, { coat: 3, shade: 0 }]);
      expect(guestStage(kit, 0)).toBe('baby');
      expect(guestStage(kit, 61 * DAY_SECONDS)).toBe('adult');
      const out = { ...kit, inside: false, beaver: { ...kit.beaver, x: 0, y: 0, z: 0 } };
      expect(stepGuest(out, { ...noIntent(), do: 'gnaw' }, 0.1, shared, ground, oneTree).guest.chop).toBeNull();
      const slow = stepGuest(out, { ...noIntent(), move: { x: 1, z: 0 } }, 1, shared, ground, noTrees).guest;
      expect(slow.beaver.x).toBeLessThan(WALK_SPEED * 0.6);
    });
  });
});
