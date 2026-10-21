import { describe, expect, it } from 'vitest';
import { doHere, takeHere, takeLabel, DO_LABEL } from './buttons';
import { DAY_SECONDS } from './clock';
import { LEVEL_COST, placed } from './dam';
import type { DamSpot } from './damSpots';
import { createWorld, type WorldState } from './state';
import { flatTerrain } from './terrain';
import { CHOP_REACH, noTrees, type TreeRef, type TreeSource } from './trees';

const flat = flatTerrain(0);
const none = { speaker: false, drift: false };
const oak: TreeRef = { id: 'a', x: 1, z: 0, wood: 2 };
const trees: TreeSource = {
  nearest: (x, z, reach, felled) => (!felled.has(oak.id) && Math.hypot(oak.x - x, oak.z - z) <= reach ? oak : null),
  trunksNear: () => [],
};
const world = (): WorldState => createWorld(flat, 0, 0);
const log = { id: 'l', x: 0.5, y: 0, z: 0, heading: 0, length: 4, floating: false };

describe('Do', () => {
  it('gnaws a tree in reach and does nothing in an empty meadow', () => {
    expect(doHere(world(), flat, trees, none)).toBe('gnaw');
    expect(oak.x).toBeLessThanOrEqual(CHOP_REACH);
    expect(doHere(world(), flat, noTrees, none)).toBeNull();
  });

  it('gives food to a beaver with an empty mouth close by, before it talks', () => {
    expect(doHere({ ...world(), carry: 'branch' }, flat, trees, { speaker: true, drift: false, taker: true })).toBe('give');
    expect(doHere(world(), flat, trees, { speaker: true, drift: false, taker: true })).toBe('talk');
  });

  it('talks to a friend who is a player, as a baby too, but gnaws first when a tree is in reach', () => {
    const mate = { speaker: false, drift: false, mate: true };
    expect(doHere(world(), flat, noTrees, mate)).toBe('talk');
    expect(doHere({ ...world(), bornAt: world().clock }, flat, noTrees, mate)).toBe('talk');
    expect(doHere({ ...world(), inLodge: true }, flat, noTrees, mate)).toBe('talk');
    expect(doHere(world(), flat, trees, mate)).toBe('gnaw');
    expect(doHere({ ...world(), logs: [log] }, flat, noTrees, mate)).toBe('strip');
  });

  it('talks before it gnaws, and digs before it talks', () => {
    expect(doHere(world(), flat, trees, { speaker: true, drift: false })).toBe('talk');
    expect(doHere(world(), flat, trees, { speaker: true, drift: true })).toBe('dig');
  });

  it('gnaws a tree with a partner following, and talks to the follower when there is no tree', () => {
    const follows = { speaker: true, following: true, drift: false };
    expect(doHere(world(), flat, trees, follows)).toBe('gnaw');
    expect(doHere(world(), flat, noTrees, follows)).toBe('talk');
  });

  it('strips a branch off a log by the beaver when there is no tree', () => {
    expect(doHere({ ...world(), logs: [log] }, flat, noTrees, none)).toBe('strip');
  });

  it('eats in the lodge with a piece in the mouth, else talks, else nothing', () => {
    const inside = { ...world(), inLodge: true };
    expect(doHere({ ...inside, carry: 'branch' }, flat, noTrees, none)).toBe('eat');
    expect(doHere(inside, flat, noTrees, { speaker: true, drift: false })).toBe('talk');
    expect(doHere(inside, flat, noTrees, none)).toBeNull();
  });

  it('does nothing else with a full mouth or while the stash is open', () => {
    expect(doHere({ ...world(), carry: 'branch' }, flat, trees, none)).toBeNull();
    expect(doHere({ ...world(), stashOpen: true }, flat, trees, none)).toBeNull();
  });

  it('builds when a log raises a good dam that has worn a little, and mends a worn one', () => {
    const spot: DamSpot = { id: 'core:0:0', bed: { x: 0, z: 0 }, bedY: 0, flow: { x: 1, z: 0 }, maxCrest: 2, pondM2: 900 };
    const dams = placed([], spot, LEVEL_COST[2]!, undefined, 0); // level 1, whole, new at clock 0
    const at = (clock: number): WorldState => ({ ...world(), clock, spots: [spot], dams, logs: [log], drag: 'l' });
    expect(doHere(at(2 * DAY_SECONDS), flat, noTrees, none)).toBe('build'); // 0.8: raised to level 2
    expect(doHere(at(12 * DAY_SECONDS), flat, noTrees, none)).toBe('mend'); // worn
  });

  it('has a word for every job', () => {
    expect(DO_LABEL.strip).toBe('Gnaw');
    expect(DO_LABEL.eat).toBe('Eat');
  });
});

describe('Take', () => {
  it('takes a log in reach, and lets go of it when dragging', () => {
    expect(takeHere({ ...world(), logs: [log] }, flat, flat)).toBe('log');
    expect(takeHere({ ...world(), logs: [log], drag: 'l' }, flat, flat)).toBe('let-go');
  });

  it('drops what is in the mouth, and reads Drop for it', () => {
    const t = takeHere({ ...world(), carry: 'branch' }, flat, flat);
    expect(t).toBe('drop');
    expect(takeLabel(t)).toBe('Drop');
    expect(takeLabel(null)).toBe('Take');
  });

  it('does nothing in the lodge or in an empty meadow', () => {
    expect(takeHere({ ...world(), inLodge: true, carry: 'branch' }, flat, flat)).toBeNull();
    expect(takeHere(world(), flat, flat)).toBeNull();
  });
});
