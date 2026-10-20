import { describe, expect, it } from 'vitest';
import { Room, MAX_GUESTS } from './room';
import { applySnapshot, othersOf } from './view';
import { createWorld } from '../sim/state';
import { flatTerrain } from '../sim/terrain';
import { CHOP_TIME, type TreeSource } from '../sim/trees';

const ground = flatTerrain(0);
const hello = JSON.stringify({ t: 'hello', coat: { coat: 2, shade: 0 }, look: { hat: 1, name: 'Pip' } });
const intent = (o: object): string => JSON.stringify({ t: 'intent', x: 0, z: 0, dive: false, gnaw: false, ...o });
const oneTree: TreeSource = { nearest: (_x, _z, _r, f) => (f.has('t1') ? null : { id: 't1', x: 5, z: 4, wood: 4 }), trunksNear: () => [] };
const world = createWorld(ground, 0, 0);
const host = { x: 0, z: 0 };

function joined() {
  const sent: [string, string][] = [];
  const room = new Room((to, text) => sent.push([to, text]));
  room.open('g1');
  room.receive('g1', hello, 0, host, ground);
  return { room, sent };
}

describe('the room', () => {
  it('welcomes a guest after its hello and puts it near the host', () => {
    const { room, sent } = joined();
    expect(JSON.parse(sent[0]![1])).toEqual({ t: 'welcome', id: 'g1' });
    expect(room.guests()).toHaveLength(1);
    expect(Math.hypot(room.guests()[0]!.beaver.x, room.guests()[0]!.beaver.z)).toBeGreaterThan(1);
  });

  it('gives each guest a free lodge of its own, then the host\'s side', () => {
    const room = new Room(() => undefined);
    const homes = [{ x: 100, z: 0, id: 'family:start:0' }, { x: 0, z: 100, id: 'family:start:1' }];
    for (const id of ['a', 'b', 'c']) {
      room.open(id);
      room.receive(id, hello, 0, host, ground, homes);
    }
    const near = (g: { beaver: { x: number; z: number } }, h: { x: number; z: number }) => Math.hypot(g.beaver.x - h.x, g.beaver.z - h.z) < 20;
    const [a, b, c] = room.guests();
    expect(near(a!, homes[0]!)).toBe(true);
    expect(near(b!, homes[1]!)).toBe(true);
    expect(near(c!, host)).toBe(true);
    expect(room.played()).toEqual(['family:start:0', 'family:start:1']);
    expect(room.snapshot(world).played).toEqual(room.played());
    room.leave('a');
    expect(room.played()).toEqual(['family:start:1']);
    room.open('d');
    room.receive('d', hello, 0, host, ground, homes);
    expect(near(room.guests().find((g) => g.id === 'd')!, homes[0]!)).toBe(true);
  });

  it('ignores an intent before the hello, a second hello, and nonsense', () => {
    const sent: string[] = [];
    const room = new Room((_t, text) => sent.push(text));
    room.open('g1');
    room.receive('g1', intent({ x: 1 }), 0, host, ground);
    room.receive('g1', 'garbage', 0, host, ground);
    expect(room.guests()).toHaveLength(0);
    room.receive('g1', hello, 0, host, ground);
    room.receive('g1', hello, 0, host, ground);
    expect(room.guests()).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });

  it('keeps to the number of friends', () => {
    const room = new Room(() => undefined);
    for (let i = 0; i <= MAX_GUESTS; i++) {
      room.open(`g${i}`);
      room.receive(`g${i}`, hello, 0, host, ground);
    }
    expect(room.guests()).toHaveLength(MAX_GUESTS);
  });

  it('moves a guest by its intent and stops it when it falls silent', () => {
    const { room } = joined();
    const x0 = room.guests()[0]!.beaver.x;
    room.receive('g1', intent({ x: 1 }), 0, host, ground);
    room.step(world, 0.5, 0.5, ground, oneTree);
    const x1 = room.guests()[0]!.beaver.x;
    expect(x1).toBeGreaterThan(x0);
    room.step(world, 0.5, 10, ground, oneTree);
    expect(room.guests()[0]!.beaver.x).toBe(x1);
  });

  it('fells a tree a guest gnaws, for the world', () => {
    const { room } = joined();
    // Walk the guest to the tree's side, then gnaw standing still.
    room.guests()[0]!.beaver.x = 4;
    room.guests()[0]!.beaver.z = 4;
    room.receive('g1', intent({ gnaw: true }), 0, host, ground);
    let w = world;
    for (let t = 0; t < CHOP_TIME + 1; t += 0.5) w = room.step(w, 0.5, t * 0.1, ground, oneTree);
    expect(w.felled).toEqual(['t1']);
    expect(w.logs).toHaveLength(1);
  });

  it('sends the state to guests, and a guest view follows it', () => {
    const { room, sent } = joined();
    sent.length = 0;
    room.broadcast({ ...world, clock: 123 });
    expect(sent).toHaveLength(1);
    const snap = JSON.parse(sent[0]![1]).snapshot;
    const mine = applySnapshot(createWorld(ground, 50, 50), snap, 'g1');
    expect(mine.clock).toBe(123);
    expect(mine.beaver.x).toBeCloseTo(room.guests()[0]!.beaver.x, 5);
    const others = othersOf(snap, 'g1');
    expect(others.map((o) => o.id)).toEqual(['friend:host']);
  });
});
