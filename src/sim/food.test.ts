import { FOOD_ROT, MUD_DRY } from './haul';
import { describe, expect, it } from 'vitest';
import { noIntent, type Intent } from './buttons';
import { BRANCH_BOOST, BRANCH_BOOST_TIME, PAD_BOOST, PAD_BOOST_TIME, STORE_CAPACITY, STORE_DISTANCE, branchFactor, branchesOf, emptyStock, lilyShare, padFactor, stockMeals, stockOf, stockTotal, storeFill, storeSpot, tapped, trimmed, type Food, type Stock } from './food';
import { LOG_ROT } from './logs';
import { LODGE_WOOD } from './lodge';
import type { Log } from './logs';
import { createWorld, type WorldState } from './state';
import { step } from './step';
import type { Terrain } from './terrain';

/** Dry land for z < 0, then a lake that is deep from z = 3 (as in lodge.test.ts). */
const shore: Terrain = { heightAt: () => 0, isWater: (_x, z) => z >= 0, waterDepth: (_x, z) => Math.max(0, z * 0.5) };

const press = (a: Partial<Intent>): Intent => ({ ...noIntent(), ...a });
const log = (id: string, length: number, z = -2): Log => ({ id, x: 0, y: 0, z, heading: 0, length, floating: false });

/** A whole lodge facing deep water, and the beaver on dry land at z = -1 with a log lying in reach. */
function world(): WorldState {
  const w = createWorld(shore, 0, -1);
  return { ...w, lodge: { x: 0, z: 2, base: 1, door: 0, wood: LODGE_WOOD }, logs: [log('a', 4)] };
}

/** The same beaver at the store, swimming on the surface. */
function atTheStore(w: WorldState): WorldState {
  const s = storeSpot(w.lodge)!;
  return { ...w, beaver: { ...w.beaver, x: s.x, z: s.z, y: 3, mode: 'swim' }, logs: [] };
}

describe('the store', () => {
  it('lies past the door once the lodge is whole, in deep water', () => {
    const w = world();
    const s = storeSpot(w.lodge)!;
    expect(s.z).toBeCloseTo(2 + STORE_DISTANCE);
    expect(shore.waterDepth(s.x, s.z)).toBeGreaterThan(1.2);
    expect(storeSpot({ ...w.lodge!, wood: LODGE_WOOD - 1 })).toBeNull();
    expect(storeSpot(null)).toBeNull();
  });

  it('has fixed places, and says how full it is and how many meals it holds', () => {
    expect(emptyStock()).toHaveLength(STORE_CAPACITY);
    const s: Stock = emptyStock().map((_, i) => (i < 3 ? 'branch' : i < 5 ? 'lily' : null));
    expect(stockTotal(s)).toBe(5);
    expect(stockOf(s, 'lily')).toBe(2);
    expect(stockMeals(s)).toBe(8);
    expect(storeFill(s)).toBeCloseTo(5 / STORE_CAPACITY);
    expect(lilyShare(s)).toBeCloseTo(0.4);
    expect(lilyShare(emptyStock())).toBe(0);
  });

  it('is trimmed to the places a worn store keeps, and not otherwise', () => {
    const s: Stock = emptyStock().map(() => 'branch' as Food);
    expect(stockTotal(trimmed(s, 10))).toBe(10);
    expect(trimmed(s, STORE_CAPACITY)).toBe(s);
    expect(stockTotal(trimmed(s, 0))).toBe(0);
  });
});

describe('tapping a place', () => {
  const some: Stock = emptyStock().map((_, i) => (i === 2 ? 'branch' : i === 3 ? 'lily' : null));

  it('takes a piece with an empty mouth, puts one in an empty place, and swaps two', () => {
    const take = tapped(some, null, 2, STORE_CAPACITY);
    expect(take.carry).toBe('branch');
    expect(take.stock[2]).toBeNull();
    const put = tapped(some, 'lily', 5, STORE_CAPACITY);
    expect(put.carry).toBeNull();
    expect(put.stock[5]).toBe('lily');
    const swap = tapped(some, 'lily', 2, STORE_CAPACITY);
    expect(swap.carry).toBe('branch');
    expect(swap.stock[2]).toBe('lily');
  });

  it('does nothing for an empty place with an empty mouth, a lost place, or a place that is not there', () => {
    expect(tapped(some, null, 7, STORE_CAPACITY)).toEqual({ stock: some, carry: null });
    expect(tapped(some, 'branch', 30, 24)).toEqual({ stock: some, carry: 'branch' });
    expect(tapped(some, 'branch', -1, STORE_CAPACITY)).toEqual({ stock: some, carry: 'branch' });
    expect(tapped(some, 'branch', STORE_CAPACITY, STORE_CAPACITY)).toEqual({ stock: some, carry: 'branch' });
    expect(tapped(some, 'branch', 1.5, STORE_CAPACITY)).toEqual({ stock: some, carry: 'branch' });
  });
});

describe('stripping branches', () => {
  it('puts a branch in the mouth, one a metre of log, until the log has none left', () => {
    let w = world();
    expect(branchesOf(w.logs[0]!)).toBe(4);
    w = step(w, press({ do: 'strip' }), 0.1, shore);
    expect(w.carry).toBe('branch');
    expect(w.stripped['a']).toBe(1);
    // the mouth is full: another press takes nothing more
    w = step(w, press({ do: 'strip' }), 0.1, shore);
    expect(w.stripped['a']).toBe(1);
    const spent = { ...world(), stripped: { a: 4 } };
    expect(step(spent, press({ do: 'strip' }), 0.1, shore).carry).toBeNull();
  });

  it('needs a log within reach, and cannot be done while dragging one', () => {
    const far = { ...world(), logs: [log('a', 4, -10)] };
    expect(step(far, press({ do: 'strip' }), 0.1, shore).carry).toBeNull();
    const drag = { ...world(), drag: 'a' };
    expect(step(drag, press({ do: 'strip' }), 0.1, shore).carry).toBeNull();
  });

  it('does not take hold of a log while a piece is in the mouth, but puts the piece down', () => {
    const w = step({ ...world(), carry: 'branch' }, press({ take: 'drop' }), 0.1, shore);
    expect(w.drag).toBeNull();
    expect(w.carry).toBeNull();
    expect(w.dropped).toMatchObject([{ kind: 'branch' }]);
  });

  it('picks a dropped piece up again with Gnaw', () => {
    const down = step({ ...world(), carry: 'lily' }, press({ take: 'drop' }), 0.1, shore);
    const up = step(down, press({ take: 'item' }), 0.1, shore);
    expect(up.carry).toBe('lily');
    expect(up.dropped).toEqual([]);
  });

  it('rots away after two days, mud dries after four, and a rock stays', () => {
    const at = world().clock;
    const lying = (kind: 'branch' | 'mud' | 'rock') => ({ id: kind, kind, at, x: 50, z: 50 });
    const w = { ...world(), dropped: [lying('branch'), lying('mud'), lying('rock')] };
    const kinds = (clock: number) => step({ ...w, clock }, press({}), 0.1, shore).dropped.map((d) => d.kind);
    expect(kinds(at + FOOD_ROT - 1)).toEqual(['branch', 'mud', 'rock']);
    expect(kinds(at + FOOD_ROT)).toEqual(['mud', 'rock']);
    expect(kinds(at + MUD_DRY)).toEqual(['rock']);
  });
});

describe('a log', () => {
  it('rots away a year after it fell, unless it is being dragged', () => {
    const old = { ...log('a', 4), at: 0 };
    const w = { ...world(), logs: [old], clock: LOG_ROT - 1 };
    expect(step(w, press({}), 0.1, shore).logs).toHaveLength(1);
    expect(step({ ...w, clock: LOG_ROT }, press({}), 0.1, shore).logs).toHaveLength(0);
    expect(step({ ...w, clock: LOG_ROT, drag: 'a' }, press({}), 0.1, shore).logs).toHaveLength(1);
  });
});

describe('the stash', () => {
  it('opens with Build at the store, with a piece in the mouth or without, and only at the store', () => {
    const w = { ...world(), carry: 'branch' as const };
    expect(step(w, press({ do: 'store' }), 0.1, shore).stashOpen).toBe(false);
    const at = step(atTheStore(w), press({ do: 'store' }), 0.1, shore);
    expect(at.stashOpen).toBe(true);
    expect(at.carry).toBe('branch');
    expect(step(atTheStore(world()), press({ do: 'store' }), 0.1, shore).stashOpen).toBe(true);
    expect(step(atTheStore(world()), press({ take: 'log' }), 0.1, shore).stashOpen).toBe(false);
  });

  it('moves pieces by taps, and keeps the beaver still while it is open', () => {
    let w = step(atTheStore({ ...world(), carry: 'branch' as const }), press({ do: 'store' }), 0.1, shore);
    const at = { x: w.beaver.x, z: w.beaver.z };
    w = step(w, press({ stashTap: 4, move: { x: 1, z: 0 } }), 0.1, shore);
    expect(w.store[4]).toBe('branch');
    expect(w.carry).toBeNull();
    expect({ x: w.beaver.x, z: w.beaver.z }).toEqual(at);
    w = step(w, press({ stashTap: 4 }), 0.1, shore);
    expect(w.carry).toBe('branch');
    expect(w.store[4]).toBeNull();
    expect(step(w, press({ stashClose: true }), 0.1, shore).stashOpen).toBe(false);
  });

  it('ignores a tap while it is shut', () => {
    const closed = atTheStore(world());
    expect(step(closed, press({ stashTap: 0 }), 0.1, shore).store).toEqual(closed.store);
  });

  it('shows a lost place as unusable: a tap on it does nothing', () => {
    const w = { ...atTheStore({ ...world(), carry: 'lily' as const }), stashOpen: true, storeWear: { level: 0.3, since: 0, mend: 0 } };
    expect(step(w, press({ stashTap: 39 }), 0.1, shore).carry).toBe('lily');
  });
});

describe('eating', () => {
  it('eats the piece inside the lodge, and not outside it', () => {
    const w = { ...world(), carry: 'branch' as const };
    const outside = step(w, press({ do: 'eat' }), 0.1, shore);
    expect(outside.eaten).toBe(0);
    const inside = step({ ...w, inLodge: true, beaver: { ...w.beaver, x: 0, z: 2 + 3 } }, press({ do: 'eat' }), 0.1, shore);
    expect(inside.carry).toBeNull();
    expect(inside.eaten).toBe(1);
  });

  it('gives a pad a swim boost and a branch a felling boost, which wear off', () => {
    const inLodge = (carry: 'branch' | 'lily') => ({ ...world(), carry, inLodge: true, clock: 1000, beaver: { ...world().beaver, x: 0, z: 5 } });
    const pad = step(inLodge('lily'), press({ do: 'eat' }), 0.1, shore);
    expect(pad.padAt).toBe(1000);
    expect(pad.branchAt).toBeNull();
    const branch = step(inLodge('branch'), press({ do: 'eat' }), 0.1, shore);
    expect(branch.branchAt).toBe(1000);
    expect(branch.padAt).toBeNull();
    expect(padFactor(1000, 1000 + PAD_BOOST_TIME - 1)).toBe(PAD_BOOST);
    expect(padFactor(1000, 1000 + PAD_BOOST_TIME)).toBe(1);
    expect(padFactor(null, 1000)).toBe(1);
    expect(branchFactor(1000, 1000 + BRANCH_BOOST_TIME - 1)).toBe(BRANCH_BOOST);
    expect(branchFactor(1000, 1000 + BRANCH_BOOST_TIME)).toBe(1);
  });

  it('swims faster for a minute after a pad, but walks at the same speed', () => {
    const go = (padAt: number | null, z: number): number => {
      const w = { ...world(), padAt, clock: 1000, beaver: { ...world().beaver, x: 0, z, mode: z >= 0 ? ('swim' as const) : ('walk' as const) } };
      return step(w, press({ move: { x: 1, z: 0 } }), 1, shore).beaver.x;
    };
    expect(go(1000, 5)).toBeCloseTo(go(null, 5) * PAD_BOOST, 5);
    expect(go(1000, -5)).toBeCloseTo(go(null, -5), 5);
  });

  it('carries the piece into the lodge', () => {
    // the piece in the mouth stays there through the swim in
    const w = { ...world(), carry: 'branch' as const, inLodge: true };
    expect(step(w, noIntent(), 0.1, shore).carry).toBe('branch');
  });
});
