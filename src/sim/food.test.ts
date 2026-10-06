import { describe, expect, it } from 'vitest';
import { noActions, type Actions } from '../actions/actions';
import { STORE_CAPACITY, STORE_DISTANCE, branchesOf, emptyStock, pieceFrom, stockTotal, storeFill, storeSpot, stored } from './food';
import { LODGE_WOOD } from './lodge';
import type { Log } from './logs';
import { createWorld, type WorldState } from './state';
import { step } from './step';
import type { Terrain } from './terrain';

/** Dry land for z < 0, then a lake that is deep from z = 3 (as in lodge.test.ts). */
const shore: Terrain = { heightAt: () => 0, isWater: (_x, z) => z >= 0, waterDepth: (_x, z) => Math.max(0, z * 0.5) };

const press = (a: Partial<Actions>): Actions => ({ ...noActions(), ...a });
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

  it('holds at most its capacity and says how full it is', () => {
    let s = emptyStock();
    for (let i = 0; i < STORE_CAPACITY + 5; i++) s = stored(s, i % 2 ? 'lily' : 'branch');
    expect(stockTotal(s)).toBe(STORE_CAPACITY);
    expect(storeFill(s)).toBe(1);
    expect(pieceFrom(emptyStock())).toBeNull();
    expect(pieceFrom({ branch: 0, lily: 2 })).toBe('lily');
    expect(pieceFrom({ branch: 1, lily: 2 })).toBe('branch');
  });
});

describe('stripping branches', () => {
  it('puts a branch in the mouth, one a metre of log, until the log has none left', () => {
    let w = world();
    expect(branchesOf(w.logs[0]!)).toBe(4);
    w = step(w, press({ chop: true }), 0.1, shore);
    expect(w.carry).toBe('branch');
    expect(w.stripped['a']).toBe(1);
    // the mouth is full: another press takes nothing more
    w = step(w, press({ chop: true }), 0.1, shore);
    expect(w.stripped['a']).toBe(1);
    const spent = { ...world(), stripped: { a: 4 } };
    expect(step(spent, press({ chop: true }), 0.1, shore).carry).toBeNull();
  });

  it('needs a log within reach, and cannot be done while dragging one', () => {
    const far = { ...world(), logs: [log('a', 4, -10)] };
    expect(step(far, press({ chop: true }), 0.1, shore).carry).toBeNull();
    const drag = { ...world(), drag: 'a' };
    expect(step(drag, press({ chop: true }), 0.1, shore).carry).toBeNull();
  });

  it('does not take hold of a log while a piece is in the mouth', () => {
    const w = step({ ...world(), carry: 'branch' }, press({ grab: true }), 0.1, shore);
    expect(w.drag).toBeNull();
  });
});

describe('storing and eating', () => {
  it('drops the piece in at the store, and only at the store', () => {
    const w = { ...world(), carry: 'branch' as const };
    const away = step(w, press({ build: true }), 0.1, shore);
    expect(away.carry).toBe('branch');
    expect(away.store.branch).toBe(0);
    const at = step(atTheStore(w), press({ build: true }), 0.1, shore);
    expect(at.carry).toBeNull();
    expect(at.store.branch).toBe(1);
  });

  it('keeps the piece in the mouth when the store is full', () => {
    const w = atTheStore({ ...world(), carry: 'branch', store: { branch: STORE_CAPACITY, lily: 0 } });
    const after = step(w, press({ build: true }), 0.1, shore);
    expect(after.carry).toBe('branch');
    expect(after.store.branch).toBe(STORE_CAPACITY);
  });

  it('takes a piece out at the store when the mouth is empty', () => {
    const w = atTheStore({ ...world(), store: { branch: 2, lily: 1 } });
    const after = step(w, press({ grab: true }), 0.1, shore);
    expect(after.carry).toBe('branch');
    expect(after.store.branch).toBe(1);
    // a full mouth takes nothing more
    expect(step(after, press({ grab: true }), 0.1, shore).store.branch).toBe(1);
    // an empty store gives nothing
    expect(step(atTheStore(world()), press({ grab: true }), 0.1, shore).carry).toBeNull();
  });

  it('eats the piece inside the lodge, and not outside it', () => {
    const w = { ...world(), carry: 'branch' as const };
    const outside = step(w, press({ chop: true }), 0.1, shore);
    expect(outside.eaten).toBe(0);
    const inside = step({ ...w, inLodge: true, beaver: { ...w.beaver, x: 0, z: 2 + 3 } }, press({ chop: true }), 0.1, shore);
    expect(inside.carry).toBeNull();
    expect(inside.eaten).toBe(1);
  });

  it('carries the piece into the lodge', () => {
    // the piece in the mouth stays there through the swim in
    const w = { ...world(), carry: 'branch' as const, inLodge: true };
    expect(step(w, noActions(), 0.1, shore).carry).toBe('branch');
  });
});
