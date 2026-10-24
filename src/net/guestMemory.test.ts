import { describe, expect, it } from 'vitest';
import { Room } from './room';
import { createWorld } from '../sim/state';
import { DAY_SECONDS } from '../sim/clock';
import { LODGE_WOOD } from '../sim/lodge';
import { guestStage, MAX_MEMORY, memoryOf, newGuest, remembered } from '../sim/guests';
import { flatTerrain } from '../sim/terrain';
import type { TreeSource } from '../sim/trees';
import { decodeSave, encodeSave } from '../persist/save';

const ground = flatTerrain(0);
const noTrees: TreeSource = { nearest: () => null, trunksNear: () => [] };
const host = { x: 0, z: 0 };
const lodge = { x: 100, z: 0, base: 0, door: Math.PI / 2, wood: LODGE_WOOD };
const parents: [{ coat: number; shade: number }, { coat: number; shade: number }] = [{ coat: 1, shade: 0 }, { coat: 2, shade: 0 }];
const homes = [{ x: 100, z: 0, id: 'family:start:0', lodge, parents }, { x: 0, z: 100, id: 'family:start:1', lodge: { ...lodge, x: 0, z: 100 }, parents }];
const born = 5 * DAY_SECONDS;
const keyed = (name: string, key = 'abcdefgh12'): string => JSON.stringify({ t: 'hello', coat: { coat: 2, shade: 0 }, look: { name }, key });
const at = (clock: number) => ({ ...createWorld(ground, 0, 0), clock });

/** A host that has seated a guest and stepped, so its records are in the world. */
function visit(name: string, list = at(born + DAY_SECONDS).guestMemory, key = 'abcdefgh12', hostHomes = homes) {
  const room = new Room(() => undefined);
  room.restoreMemory(list);
  let w = at(born + DAY_SECONDS);
  w = { ...w, guestMemory: list };
  room.step(w, 0.1, 0, ground, noTrees);
  room.open('c1');
  room.receive('c1', keyed(name, key), 0, host, ground, hostHomes, born);
  return { room, w };
}

function leaveAndSave(room: Room, w: ReturnType<typeof at>, now = 5) {
  let world = room.step(w, 0.1, now, ground, noTrees);
  room.leave('c1');
  world = room.step(world, 0.1, now + 0.1, ground, noTrees);
  return world;
}

describe('a guest the host remembers (note 52)', () => {
  it('comes back with its look and its age, in the lodge of its family', () => {
    const { room, w } = visit('Pip');
    const saved = leaveAndSave(room, w).guestMemory;
    expect(saved).toHaveLength(1);
    expect(saved[0]!.id).toBe('g-abcdefgh12');
    const again = visit('Other', saved);
    const g = again.room.guests()[0]!;
    expect(g.id).toBe('g-abcdefgh12');
    expect(g.look.name).toBe('Pip');
    expect(g.bornAt).toBe(born);
    expect(g.inside).toBe(true);
    expect(g.homeLodge).toEqual(lodge);
  });

  it('goes back to the family it belonged to even when another lodge is free first', () => {
    const { room, w } = visit('Pip', [], 'abcdefgh12', [homes[1]!, homes[0]!]);
    const saved = leaveAndSave(room, w).guestMemory;
    expect(saved[0]!.family).toBe('family:start:1');
    const again = visit('Pip', saved, 'abcdefgh12', [homes[0]!, homes[1]!]);
    expect(again.room.guests()[0]!.homeLodge!.z).toBe(100);
    expect(again.room.played()).toEqual(['family:start:1']);
  });

  it('keeps growing while it is away', () => {
    const { room, w } = visit('Pip');
    const saved = leaveAndSave(room, w).guestMemory;
    const again = visit('Pip', saved);
    expect(guestStage(again.room.guests()[0]!, born + DAY_SECONDS)).toBe('baby');
    expect(guestStage(again.room.guests()[0]!, born + 60 * DAY_SECONDS)).not.toBe('baby');
  });

  it('is not put back in a lodge it grew out of, and stands where it last stood', () => {
    const none = visit('Pip', [], 'abcdefgh12', []);
    const w = none.w;
    none.room.receive('c1', JSON.stringify({ t: 'intent', x: 1, z: 0, dive: false, gnaw: false }), 1, host, ground);
    let world = w;
    for (let i = 0; i < 30; i++) world = none.room.step(world, 0.5, 1 + i, ground, noTrees);
    const where = none.room.guests()[0]!.beaver;
    expect(where.x).toBeGreaterThan(10);
    const saved = leaveAndSave(none.room, world, 40).guestMemory;
    const grownAt = { ...at(born + 90 * DAY_SECONDS), guestMemory: saved };
    const room = new Room(() => undefined);
    room.restoreMemory(saved);
    room.step(grownAt, 0.1, 0, ground, noTrees);
    room.open('c2');
    room.receive('c2', keyed('x'), 0, host, ground, homes, born);
    const g = room.guests()[0]!;
    expect(Math.abs(g.beaver.x - where.x)).toBeLessThan(1);
    expect(g.look.name).toBe('Pip');
    expect(room.played()).toEqual([]);
  });

  it('a guest with no key is a newcomer each time and leaves no record', () => {
    const room = new Room(() => undefined);
    let w = at(born);
    room.step(w, 0.1, 0, ground, noTrees);
    room.open('c1');
    room.receive('c1', JSON.stringify({ t: 'hello', coat: { coat: 2, shade: 0 }, look: { name: 'Pip' } }), 0, host, ground, homes, born);
    w = room.step(w, 0.1, 2, ground, noTrees);
    room.leave('c1');
    expect(room.step(w, 0.1, 3, ground, noTrees).guestMemory).toEqual([]);
  });

  it('keeps the look a guest picked on its look card', () => {
    const { room, w } = visit('Pip');
    room.receive('c1', JSON.stringify({ t: 'look', coat: { coat: 3, shade: 1 }, look: { name: 'Kit' } }), 1, host, ground);
    const saved = leaveAndSave(room, w).guestMemory;
    expect(saved[0]!.look.name).toBe('Kit');
    expect(saved[0]!.coat).toEqual({ coat: 3, shade: 1 });
  });
});

describe('the save', () => {
  it('carries the records with the world, and a save with none loads as none', () => {
    const { room, w } = visit('Pip');
    const world = leaveAndSave(room, w);
    const coach = { on: false, stage: null, state: null };
    const back = decodeSave(encodeSave(world, coach, 1), at(0));
    expect(back?.world.guestMemory).toEqual(world.guestMemory);
    const old = JSON.parse(encodeSave(world, coach, 1));
    delete old.world.guestMemory;
    expect(decodeSave(JSON.stringify(old), at(0))?.world.guestMemory ?? []).toEqual([]);
  });
});

describe('the guest records', () => {
  const rec = (id: string, seenAt: number) => memoryOf(newGuest(id, { x: 0, z: 0 }, ground, { coat: 0, shade: 0 }, undefined), null, false, { x: 0, z: 0 }, seenAt);

  it('replaces a guest\'s older record', () => {
    const list = remembered(remembered([], rec('g-a', 1)), rec('g-a', 5));
    expect(list).toHaveLength(1);
    expect(list[0]!.seenAt).toBe(5);
  });

  it('forgets the longest unseen beyond the cap', () => {
    let list = remembered([], rec('g-0', 0));
    for (let i = 1; i <= MAX_MEMORY; i++) list = remembered(list, rec(`g-${i}`, i));
    expect(list).toHaveLength(MAX_MEMORY);
    expect(list.some((r) => r.id === 'g-0')).toBe(false);
  });
});
