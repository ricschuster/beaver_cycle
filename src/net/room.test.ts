import { describe, expect, it } from 'vitest';
import { Room, MAX_GUESTS, HELLO_WITHIN, MAX_STRANGERS } from './room';
import { applySnapshot, friendNearby, friendTaker, othersOf, pairingOf, partnerCandidate, saysOf } from './view';
import { createWorld, leaveHome } from '../sim/state';
import { DOOR_DISTANCE, LODGE_WOOD, NEST_SPOTS, SOLID_RADIUS, doorPoint } from '../sim/lodge';
import { newWear } from '../sim/wear';
import { storeSpot } from '../sim/food';
import { DAY_SECONDS, isNight, nextSpringStart } from '../sim/clock';
import { guestStage } from '../sim/guests';
import { stageAt } from '../sim/life';
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
  it('takes the coat and look a guest picks on its look card', () => {
    const { room } = joined();
    room.receive('g1', JSON.stringify({ t: 'look', coat: { coat: 3, shade: 1 }, look: { hat: 2, name: 'Kit' } }), 1, host, ground);
    const mine = room.snapshot(world).beavers.find((b) => b.id !== 'host')!;
    expect(mine.coat).toEqual({ coat: 3, shade: 1 });
    expect(mine.look.name).toBe('Kit');
  });

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

  it('puts a guest on its nest in its family lodge, as old as the host, and shows its tablet the room', () => {
    const room = new Room(() => undefined);
    const lodge = { x: 100, z: 0, base: 0, door: Math.PI / 2, wood: LODGE_WOOD };
    const parents: [{ coat: number; shade: number }, { coat: number; shade: number }] = [{ coat: 1, shade: 0 }, { coat: 2, shade: 0 }];
    const homes = [{ x: 100, z: 0, id: 'family:start:0', lodge, parents }];
    const born = 5 * DAY_SECONDS;
    room.open('a');
    room.receive('a', hello, 0, host, ground, homes, born);
    const g = room.guests()[0]!;
    expect(g.inside).toBe(true);
    expect(g.bornAt).toBe(born);
    expect(Math.hypot(g.beaver.x - lodge.x, g.beaver.z - lodge.z)).toBeLessThan(5);
    expect(guestStage(g, born + 2 * DAY_SECONDS)).toBe('baby');
    const w = { ...world, clock: born + DAY_SECONDS };
    const snap = room.snapshot(w);
    const mine = snap.beavers.find((b) => b.id === 'a')!;
    expect(mine.inside).toBe(true);
    expect(mine.grown).toBe(false);
    const seen = applySnapshot(createWorld(ground, 0, 0), snap, 'a');
    expect(seen.inLodge).toBe(true);
    expect(seen.lodge).toEqual(lodge);
    // It stays in the room across a step.
    room.step(w, 0.1, 1, ground, { nearest: () => null, trunksNear: () => [] });
    expect(room.guests()[0]!.inside).toBe(true);
  });

  it('lets a guest swim back into its family lodge, though the family lodge is solid round it for the host', () => {
    const room = new Room(() => undefined);
    const lodge = { x: 100, z: 0, base: 0, door: Math.PI / 2, wood: LODGE_WOOD };
    const homes = [{ x: 100, z: 0, id: 'family:start:0', lodge, parents: [{ coat: 1, shade: 0 }, { coat: 2, shade: 0 }] as [{ coat: number; shade: number }, { coat: number; shade: number }] }];
    room.open('a');
    room.receive('a', hello, 0, host, ground, homes, 5 * DAY_SECONDS);
    const g = room.guests()[0]!;
    const d = doorPoint(lodge, DOOR_DISTANCE + 1.6);
    g.inside = false;
    g.beaver.x = d.x;
    g.beaver.z = d.z;
    g.beaver.mode = 'dive';
    const w = { ...world, clock: 5 * DAY_SECONDS, neighbours: [{ id: 'family:start:0', lodge, parents: homes[0]!.parents, seed: 1 }] };
    for (let i = 0; i < 40; i++) {
      room.receive('a', intent({ x: -1, z: 0, dive: true }), i, host, ground);
      room.step(w, 0.05, i, ground, oneTree);
    }
    expect(room.guests()[0]!.inside).toBe(true);
  });

  it('puts a guest out of its family lodge when it grows up, and it no longer lives there', () => {
    const room = new Room(() => undefined);
    const lodge = { x: 100, z: 0, base: 0, door: Math.PI / 2, wood: LODGE_WOOD };
    const homes = [{ x: 100, z: 0, id: 'family:start:0', lodge, parents: [{ coat: 1, shade: 0 }, { coat: 2, shade: 0 }] as [{ coat: number; shade: number }, { coat: number; shade: number }] }];
    const born = 5 * DAY_SECONDS;
    room.open('a');
    room.receive('a', hello, 0, host, ground, homes, born);
    const tree = { nearest: () => null, trunksNear: () => [] };
    room.step({ ...world, clock: born + DAY_SECONDS }, 0.1, 1, ground, tree);
    expect(room.guests()[0]!.inside).toBe(true);
    const grown = born + 400 * DAY_SECONDS;
    expect(guestStage(room.guests()[0]!, grown)).toBe('adult');
    room.step({ ...world, clock: grown }, 0.1, 2, ground, tree);
    const g = room.guests()[0]!;
    expect(g.inside).toBe(false);
    expect(g.homeLodge).toBeNull();
    expect(Math.hypot(g.beaver.x - lodge.x, g.beaver.z - lodge.z)).toBeGreaterThan(SOLID_RADIUS);
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

  it('sends the dams and the host lodge, and a guest view takes them', () => {
    const { room, sent } = joined();
    sent.length = 0;
    const dams = [{ spot: 's1', wood: 3, mud: 1, rock: 0 }];
    room.broadcast({ ...world, dams });
    const snap = JSON.parse(sent[0]![1]).snapshot;
    const mine = applySnapshot(createWorld(ground, 50, 50), snap, 'g1');
    expect(mine.dams).toEqual(dams);
    expect(mine.lodge).toBeNull();
  });

  describe('gifts (#663)', () => {
    const two = () => {
      const room = new Room(() => undefined);
      for (const id of ['a', 'b']) {
        room.open(id);
        room.receive(id, hello, 0, host, ground);
      }
      return room;
    };

    describe('the store and eating', () => {
      const lodge = { x: 40, z: 0, base: 0, door: Math.PI / 2, wood: LODGE_WOOD, wear: newWear(0), players: ['host', 'g1'] as [string, string], wholeAt: 0 };
      const homeWorld = { ...world, lodge, storeWear: newWear(0), store: world.store.map(() => null) };
      const at = storeSpot(lodge)!;

      it('puts a guest\'s piece into the first free place of the store, and takes one out with an empty mouth', () => {
        const room = two();
        const [a] = room.guests();
        a!.carry = 'lily';
        a!.beaver = { ...a!.beaver, x: at.x, z: at.z };
        room.receive('a', intent({ do: 'store' }), 0, host, ground);
        const put = room.step(homeWorld, 0.05, 0, ground, oneTree);
        expect(put.store[0]).toBe('lily');
        expect(room.guests()[0]!.carry).toBeNull();
        room.receive('a', intent({ do: 'store' }), 0.1, host, ground);
        const took = room.step(put, 0.05, 0.1, ground, oneTree);
        expect(took.store[0]).toBeNull();
        expect(room.guests()[0]!.carry).toBe('lily');
      });

      it('does nothing away from the store', () => {
        const room = two();
        room.guests()[0]!.carry = 'lily';
        room.receive('a', intent({ do: 'store' }), 0, host, ground);
        const after = room.step(homeWorld, 0.05, 0, ground, oneTree);
        expect(after.store[0]).toBeNull();
        expect(room.guests()[0]!.carry).toBe('lily');
      });

      it('eats the piece in the mouth inside a room, and counts it', () => {
        const room = two();
        room.guests()[0]!.carry = 'branch';
        room.guests()[0]!.inside = true;
        room.ask('host', 'a', 0);
        room.ask('a', 'host', 0);
        room.receive('a', intent({ do: 'eat' }), 0, host, ground);
        const after = room.step({ ...homeWorld, pairLodges: [{ ...lodge, players: ['host', 'a'] }], pairWith: 'a' }, 0.05, 0, ground, oneTree);
        expect(room.guests()[0]!.carry).toBeNull();
        expect(after.eaten).toBe(homeWorld.eaten + 1);
      });
    });

    it('hands a guest\'s food to the host when its mouth is empty and it stands close', () => {
      const room = two();
      const [a] = room.guests();
      a!.carry = 'lily';
      a!.beaver = { ...a!.beaver, x: 1, z: 0 };
      room.receive('a', intent({ do: 'give' }), 0, host, ground);
      const after = room.step({ ...world, beaver: { ...world.beaver, x: 0, z: 0 } }, 0.05, 0, ground, oneTree);
      expect(after.carry).toBe('lily');
      expect(room.guests()[0]!.carry).toBeNull();
    });

    it('keeps the food when the host\'s mouth is full and nobody else is close', () => {
      const room = two();
      const [a, b] = room.guests();
      a!.carry = 'lily';
      a!.beaver = { ...a!.beaver, x: 1, z: 0 };
      b!.beaver = { ...b!.beaver, x: 100, z: 100 };
      room.receive('a', intent({ do: 'give' }), 0, host, ground);
      const after = room.step({ ...world, carry: 'branch', beaver: { ...world.beaver, x: 0, z: 0 } }, 0.05, 0, ground, oneTree);
      expect(after.carry).toBe('branch');
      expect(room.guests()[0]!.carry).toBe('lily');
    });

    it('hands the host\'s food to the nearest guest with an empty mouth', () => {
      const room = two();
      const [a, b] = room.guests();
      a!.beaver = { ...a!.beaver, x: 2, z: 0 };
      b!.beaver = { ...b!.beaver, x: 1, z: 0 };
      b!.carry = 'branch';
      const to = room.guestTaker({ x: 0, z: 0 });
      expect(to?.id).toBe('a');
      const w = room.hand({ ...world, carry: 'lily' }, to!);
      expect(w.carry).toBeNull();
      expect(room.guests()[0]!.carry).toBe('lily');
    });

    it('tells every guest what each beaver holds', () => {
      const room = two();
      room.guests()[0]!.carry = 'lily';
      const views = room.snapshot({ ...world, carry: 'branch' }).beavers;
      expect(views.map((v) => v.carry ?? null)).toEqual(['branch', 'lily', null]);
    });

    it('finds a friend with an empty mouth from a snapshot, but not oneself', () => {
      const room = two();
      room.guests()[0]!.carry = 'lily';
      const snap = room.snapshot(world);
      const near = { x: snap.beavers[0]!.x, z: snap.beavers[0]!.z };
      expect(friendTaker(snap, 'a', near)?.id).toBe('host');
      expect(friendTaker(snap, 'host', near)?.id).not.toBe('a');
    });

    it('shares the pads picked and the branches stripped with every guest', () => {
      const room = two();
      const snap = room.snapshot({ ...world, picked: { 'lily:1:1': 3 }, stripped: { log1: 2 } });
      expect(snap.picked).toEqual({ 'lily:1:1': 3 });
      expect(applySnapshot(world, snap, 'a').stripped).toEqual({ log1: 2 });
    });
  });

  describe('partners between players (#666)', () => {
    const near = () => {
      const { room } = joined();
      room.guests()[0]!.beaver.x = 1;
      room.guests()[0]!.beaver.z = 0;
      return room;
    };
    const baby = { ...world, bornAt: world.clock };

    it('asks the friend close by and pairs when the friend presses back', () => {
      const room = near();
      const to = room.partnerNear('host', host, host, true);
      expect(to).toBe('g1');
      room.ask('host', to!, 0);
      expect(room.askers('g1')).toEqual(['host']);
      expect(pairingOf(room.snapshot(world), 'g1').askedBy).toEqual(['host']);
      room.receive('g1', intent({ do: 'partner' }), 1, host, ground);
      room.step(world, 0.05, 1, ground, oneTree);
      expect(room.partner('g1')).toBe('host');
      expect(pairingOf(room.snapshot(world), 'host').partner).toBe('g1');
    });

    it('a guest asks the host, and the host presses back', () => {
      const room = near();
      room.receive('g1', intent({ do: 'partner' }), 1, host, ground);
      room.step(world, 0.05, 1, ground, oneTree);
      expect(room.asking('g1', 'host')).toBe(true);
      room.ask('host', 'g1', 2);
      expect(room.partner('host')).toBe('g1');
    });

    it('does not offer a friend out of reach, a host that is not grown, or a taken one', () => {
      const { room } = joined();
      expect(room.partnerNear('host', host, host, true)).toBeNull();
      const close = near();
      expect(close.partnerNear('host', host, host, false)).toBeNull();
      close.ask('host', 'g1', 0);
      close.ask('g1', 'host', 0);
      // A taken friend is not offered, but the partner is, for the press that asks to stop (Q4).
      expect(close.partnerNear('host', host, host, true)).toBe('g1');
      const third = close;
      third.open('g2');
      third.receive('g2', hello, 0, host, ground);
      expect(third.partnerNear('g2', third.guests()[1]!.beaver, host, true)).toBeNull();
    });

    it('does not let a guest ask a host that is still a baby', () => {
      const room = near();
      room.receive('g1', intent({ do: 'partner' }), 1, host, ground);
      room.step(baby, 0.05, 1, ground, oneTree);
      expect(room.asking('g1', 'host')).toBe(false);
    });

    it('keeps the pair when a guest leaves, and knows the guest again by its key', () => {
      const room = new Room(() => undefined);
      const keyed = JSON.stringify({ t: 'hello', coat: { coat: 2, shade: 0 }, look: { name: 'Pip' }, key: 'abcdefgh12' });
      room.open('c1');
      room.receive('c1', keyed, 0, host, ground);
      expect(room.guests()[0]!.id).toBe('g-abcdefgh12');
      room.ask('host', 'g-abcdefgh12', 0);
      room.ask('g-abcdefgh12', 'host', 0);
      room.leave('c1');
      expect(room.partner('host')).toBe('g-abcdefgh12');
      room.open('c2');
      room.receive('c2', keyed, 5, host, ground);
      expect(room.guests()[0]!.id).toBe('g-abcdefgh12');
      expect(room.partner('g-abcdefgh12')).toBe('host');
    });

    it('a second tablet with the same key does not take the first one\'s place', () => {
      const room = new Room(() => undefined);
      const keyed = JSON.stringify({ t: 'hello', coat: { coat: 2, shade: 0 }, look: {}, key: 'abcdefgh12' });
      for (const c of ['c1', 'c2']) {
        room.open(c);
        room.receive(c, keyed, 0, host, ground);
      }
      expect(room.guests().map((g) => g.id)).toEqual(['g-abcdefgh12', 'c2']);
    });

    it('the pair builds a lodge together: the host starts it, the guest finishes it, and the host\'s own lodge becomes a former home', () => {
      const wet = { ...ground, waterDepth: () => 0.5, heightAt: () => -0.5 } as typeof ground;
      const room = near();
      room.ask('host', 'g1', 0);
      room.ask('g1', 'host', 0);
      const withLodge = { ...world, lodge: { x: 50, z: 50, base: 0, door: 0, wood: 10 } };
      let w = room.step(withLodge, 0.05, 1, wet, oneTree);
      expect(w.lodge).toBeNull();
      expect(w.formerHomes).toHaveLength(1);
      expect(w.pairWith).toBe('g1');
      const log = { id: 'l1', x: 0, y: 0, z: 0, length: 6 } as never;
      w = { ...w, logs: [log], drag: 'l1', pairLodges: [{ x: 0, z: 3, base: 0, door: 0, wood: 8, players: ['host', 'g1'] }] };
      const g = room.guests()[0]!;
      g.beaver.x = 0;
      g.beaver.z = 0;
      g.drag = 'l1';
      room.receive('g1', intent({ do: 'build' }), 2, host, wet);
      w = room.step(w, 0.05, 2, wet, oneTree);
      expect(w.pairLodges[0]!.wood).toBe(10);
      expect(w.pairLodges[0]!.wear).toBeDefined();
      expect(room.snapshot(w).pairLodges).toHaveLength(1);
    });

    it('a guest finds the friend to ask from the snapshot', () => {
      const room = near();
      const snap = room.snapshot(world);
      expect(partnerCandidate(snap, 'g1', { x: 1, z: 0 })?.id).toBe('host');
      expect(partnerCandidate(room.snapshot(baby), 'g1', { x: 1, z: 0 })).toBeNull();
      room.ask('host', 'g1', 0);
      room.ask('g1', 'host', 0);
      // With a partner only the partner is offered, close by (Q4).
      expect(partnerCandidate(room.snapshot(world), 'g1', { x: 1, z: 0 })?.id).toBe('host');
      expect(partnerCandidate(room.snapshot(world), 'g1', { x: 30, z: 0 })).toBeNull();
    });

    describe('the pair lodge, stopping, and the kits (note 48)', () => {
      const lodge = { x: 40, z: 0, base: 0, door: Math.PI / 2, wood: LODGE_WOOD, wear: newWear(0), players: ['host', 'g1'] as [string, string], wholeAt: 0 };
      const paired = () => {
        const room = near();
        room.ask('host', 'g1', 0);
        room.ask('g1', 'host', 0);
        return room;
      };

      it('two partners press at each other to stop, and a whole lodge is a former home of both', () => {
        const room = paired();
        const w = { ...world, pairLodges: [lodge], lodge, pairWith: 'g1' };
        room.ask('host', 'g1', 1);
        expect(pairingOf(room.snapshot(w), 'g1').stopBy).toBe(true);
        expect(pairingOf(room.snapshot(w), 'host').stopping).toBe(true);
        expect(room.partner('host')).toBe('g1');
        const stopped = room.step(w, 0.05, 1, ground, oneTree);
        expect(stopped.pairLodges).toHaveLength(1);
        room.ask('g1', 'host', 2);
        expect(room.partner('host')).toBeNull();
        const after = room.step(stopped, 0.05, 2, ground, oneTree);
        expect(after.pairLodges).toEqual([]);
        expect(after.formerHomes.map((h) => h.x)).toEqual([40]);
        expect(after.lodge).toBeNull();
      });

      it('lets a guest reach the door when the host lives in the pair lodge', () => {
        const room = paired();
        const g = room.guests()[0]!;
        const d = doorPoint(lodge, DOOR_DISTANCE + 2.5);
        g.beaver.x = d.x;
        g.beaver.z = d.z;
        g.beaver.mode = 'dive';
        // The host's own lodge is the pair lodge: its old round solid must not keep the guest from the door.
        const w = { ...world, pairLodges: [lodge], lodge, pairWith: 'g1' };
        for (let i = 0; i < 40; i++) {
          room.receive('g1', intent({ x: -1, z: 0, dive: true }), i, { x: 0, z: 0 }, ground);
          room.step(w, 0.05, i, ground, oneTree);
        }
        expect(room.guests()[0]!.inside).toBe(true);
      });

      it('puts a guest that is in the room out at the entrance when the pair stops', () => {
        const room = paired();
        const g = room.guests()[0]!;
        g.inside = true;
        g.beaver.x = lodge.x + 2;
        g.beaver.z = lodge.z;
        room.ask('host', 'g1', 1);
        room.ask('g1', 'host', 2);
        room.step({ ...world, pairLodges: [lodge] }, 0.05, 2, ground, oneTree);
        const out = room.guests()[0]!;
        expect(out.inside).toBe(false);
        expect(Math.hypot(out.beaver.x - lodge.x, out.beaver.z - lodge.z)).toBeGreaterThan(SOLID_RADIUS);
      });

      it('an unfinished lodge is dropped when the pair stops', () => {
        const room = paired();
        room.ask('host', 'g1', 1);
        room.ask('g1', 'host', 2);
        const after = room.step({ ...world, pairLodges: [{ ...lodge, wood: 4, wholeAt: undefined }] }, 0.05, 2, ground, oneTree);
        expect(after.pairLodges).toEqual([]);
        expect(after.formerHomes).toEqual([]);
      });

      it('on the first spring after the lodge is whole each partner gets a kit, born on a nest of it', () => {
        const room = paired();
        const spring = nextSpringStart(0) + 10;
        const w = room.step({ ...world, clock: spring, pairLodges: [lodge], lodge, pairWith: 'g1' }, 0.05, 1, ground, oneTree);
        expect(w.generation).toBe(1);
        expect(stageAt(w.clock, w.bornAt)).toBe('baby');
        expect(w.inLodge).toBe(true);
        expect(w.parentCoats[1]).toEqual({ coat: 2, shade: 0 });
        expect(w.pairLodges[0]!.kitsAt).toBe(w.clock);
        expect(w.pairWith).toBeNull();
        expect(room.partner('host')).toBeNull();
        const g = room.guests()[0]!;
        expect(g.inside).toBe(true);
        expect(g.bornAt).toBe(w.clock);
        expect(guestStage(g, w.clock)).toBe('baby');
        const view = room.snapshot(w).beavers.find((b) => b.id === 'g1')!;
        expect(view).toMatchObject({ inside: true, grown: false, bornAt: w.clock });
        expect(view.parents).toHaveLength(2);
        // A lodge with kits is no pair any more, so a restart does not bring the pair back.
        const again = new Room(() => undefined);
        again.restorePairs(w.pairLodges);
        expect(again.partner('host')).toBeNull();
      });

      it('waits for the spring, and for a partner that is away', () => {
        const room = paired();
        const early = room.step({ ...world, clock: nextSpringStart(0) - 5, pairLodges: [lodge], lodge, pairWith: 'g1' }, 0.05, 1, ground, oneTree);
        expect(early.generation).toBe(0);
        room.leave('g1');
        const away = room.step({ ...world, clock: nextSpringStart(0) + 5, pairLodges: [lodge], lodge, pairWith: 'g1' }, 0.05, 2, ground, oneTree);
        expect(away.generation).toBe(0);
        expect(away.pairLodges[0]!.kitsAt).toBeUndefined();
      });

      it('two guests as partners get their own lodge and kits without the host', () => {
        const room = new Room(() => undefined);
        for (const id of ['a', 'b']) {
          room.open(id);
          room.receive(id, hello, 0, host, ground);
        }
        room.ask('a', 'b', 0);
        room.ask('b', 'a', 0);
        const own = { ...lodge, players: ['a', 'b'] as [string, string] };
        const w = room.step({ ...world, clock: nextSpringStart(0) + 5, pairLodges: [own] }, 0.05, 1, ground, oneTree);
        expect(w.generation).toBe(0);
        expect(w.pairLodges[0]!.kitsAt).toBeDefined();
        expect(room.guests().every((g) => g.inside && g.bornAt !== null)).toBe(true);
        expect(room.guests().map((g) => g.beaver.z).every((z) => Number.isFinite(z))).toBe(true);
        expect(room.partner('a')).toBeNull();
      });

      it('lets the kits\' lodge go when they have grown up', () => {
        const room = paired();
        const born = nextSpringStart(0) + 10;
        const w = room.step({ ...world, clock: born, pairLodges: [lodge], lodge, pairWith: 'g1' }, 0.05, 1, ground, oneTree);
        const grown = born + 61 * DAY_SECONDS;
        // The host's own leaving is leaveHome; the guest is put out of the room then.
        const left = room.step(leaveHome({ ...w, clock: grown }), 0.05, 2, ground, oneTree);
        expect(left.pairLodges).toEqual([]);
        expect(left.formerHomes).toHaveLength(1);
        expect(room.guests()[0]!.inside).toBe(false);
      });
    });
  });

  describe('talk between players (#667)', () => {
    const near = () => {
      const { room } = joined();
      room.guests()[0]!.beaver.x = 1;
      room.guests()[0]!.beaver.z = 0;
      return room;
    };

    it('a guest puts a question to the host and the host answers', () => {
      const room = near();
      room.receive('g1', JSON.stringify({ t: 'say', q: 'swim' }), 1, host, ground);
      room.step(world, 0.05, 1, ground, oneTree);
      expect(saysOf(room.snapshot(world), 'host').asked.map((k) => [k.from, k.q])).toEqual([['g1', 'swim']]);
      room.answer('host', 'yes', 2);
      expect(saysOf(room.snapshot(world), 'g1').answers.map((k) => k.a)).toEqual(['yes']);
      expect(saysOf(room.snapshot(world), 'host').asked).toEqual([]);
    });

    it('the host puts a question to a guest, who answers through the socket', () => {
      const room = near();
      const to = room.friendNear('host', host, host);
      expect(to).toBe('g1');
      room.say('host', to!, 'play', 1);
      expect(saysOf(room.snapshot(world), 'g1').asked).toHaveLength(1);
      room.receive('g1', JSON.stringify({ t: 'say', a: 'later' }), 2, host, ground);
      expect(saysOf(room.snapshot(world), 'host').answers.map((k) => k.a)).toEqual(['later']);
    });

    it('asks no one out of reach, and ignores ids it does not know', () => {
      const { room } = joined();
      expect(room.friendNear('host', host, host)).toBeNull();
      room.receive('g1', JSON.stringify({ t: 'say', q: 'hack' }), 1, host, ground);
      room.receive('g1', JSON.stringify({ t: 'say', a: 'maybe' }), 1, host, ground);
      room.step(world, 0.05, 1, ground, oneTree);
      expect(room.snapshot(world).says).toEqual([]);
    });

    it('a question nobody is near to hear is dropped, and one that waits too long ends', () => {
      const { room } = joined();
      room.receive('g1', JSON.stringify({ t: 'say', q: 'work' }), 1, host, ground);
      room.step(world, 0.05, 1, ground, oneTree);
      expect(room.snapshot(world).says).toEqual([]);
      room.guests()[0]!.beaver.x = 1;
      room.guests()[0]!.beaver.z = 0;
      room.receive('g1', JSON.stringify({ t: 'say', q: 'work' }), 2, host, ground);
      room.step(world, 0.05, 2, ground, oneTree);
      expect(room.snapshot(world).says).toHaveLength(1);
      room.step(world, 0.05, 40, ground, oneTree);
      expect(room.snapshot(world).says).toEqual([]);
    });

    it('a guest that leaves takes its questions with it', () => {
      const room = near();
      room.say('host', 'g1', 'swim', 1);
      room.leave('g1');
      expect(room.snapshot(world).says).toEqual([]);
    });

    it('a tablet finds the friend close by in its snapshot', () => {
      const room = near();
      const snap = room.snapshot(world);
      expect(friendNearby(snap, 'host', host)?.id).toBe('g1');
      expect(friendNearby(snap, 'g1', { x: 50, z: 50 })).toBeNull();
    });
  });

  describe('hide and seek (#664)', () => {
    const msg = (o: object): string => JSON.stringify({ t: 'hide', ...o });

    it('a guest hides, the host says yes, and the guest cannot move while the host counts', () => {
      const { room } = joined();
      room.receive('g1', msg({ r: 'seek' }), 1, host, ground);
      // The host is within the note and says yes; both stand close.
      room.answerHide('host', 'yes');
      let w = room.step(world, 0.1, 2, ground, oneTree);
      expect(room.snapshot(w, undefined, 2).hide?.phase).toBe('count');
      expect(room.snapshot(w, undefined, 2).hide?.roles).toEqual({ g1: 'seek', host: 'hide' });
      room.receive('g1', intent({ x: 1 }), 2.1, host, ground);
      const before = room.guests()[0]!.beaver.x;
      w = room.step(w, 1, 2.2, ground, oneTree);
      expect(room.guests()[0]!.beaver.x).toBe(before);
      // After the count it moves again.
      room.receive('g1', intent({ x: 1 }), 13, host, ground);
      w = room.step(w, 0.5, 13, ground, oneTree);
      room.receive('g1', intent({ x: 1 }), 13.1, host, ground);
      room.step(w, 0.5, 13.2, ground, oneTree);
      expect(room.guests()[0]!.beaver.x).toBeGreaterThan(before);
    });

    it('a seeker is not sent the hider it has not found, and the host sees it hidden', () => {
      const { room, sent } = joined();
      room.receive('g1', msg({ r: 'seek' }), 1, host, ground);
      room.answerHide('host', 'yes');
      const w = room.step(world, 0.1, 2, ground, oneTree);
      sent.length = 0;
      room.broadcast(w, 2);
      const state = JSON.parse(sent.at(-1)![1]).snapshot;
      expect(state.beavers.map((b: { id: string }) => b.id)).toEqual(['g1']);
      expect(room.hiddenFromHost()).toEqual([]);
      expect(room.snapshot(w).beavers).toHaveLength(2);
    });

    it('the host asks a guest by a Yes to play, and a not now ends the game', () => {
      const { room } = joined();
      room.startHide('host', 'hide', 1, host, 'g1');
      expect(room.snapshot(world, undefined, 1).hide?.yes).toEqual(['g1']);
      const { room: other } = joined();
      other.startHide('host', 'hide', 1, host);
      other.answerHide('g1', 'later');
      expect(other.snapshot(world).hide).toBeUndefined();
    });

    it('a guest that leaves drops out of the game', () => {
      const { room } = joined();
      room.startHide('host', 'seek', 1, host);
      room.leave('g1');
      expect(room.snapshot(world).hide).toBeUndefined();
    });
  });
  describe('sleeping together (#661, #665)', () => {
    const night = (() => {
      let c = 0;
      while (!isNight(c)) c += 600;
      return c;
    })();
    const sleepers = () => {
      const { room } = joined();
      return room;
    };
    const send = (room: Room, m: object, now = 1) => room.receive('g1', JSON.stringify(m), now, host, ground);

    it('tells the guests who is dreaming, and stops when they wake', () => {
      const room = sleepers();
      expect(room.snapshot(world).dreaming).toBeUndefined();
      room.lie('host', 'night', true, 0);
      expect(room.snapshot(world).dreaming).toEqual(['host']);
      expect(room.snapshot(world).asleep).toEqual(['host']);
      room.wake('host', 1);
      expect(room.snapshot(world).dreaming).toBeUndefined();
      expect(room.snapshot(world).asleep).toBeUndefined();
    });

    it('forgets a guest that leaves while it dreams', () => {
      const room = sleepers();
      room.lie('g1', 'night', true, 0);
      room.leave('g1');
      expect(room.snapshot(world).dreaming).toBeUndefined();
    });

    it('asks the friends, and moves the clock for all on their yes', () => {
      const room = sleepers();
      room.lie('host', 'night', false, 0);
      expect(room.snapshot(world, undefined, 2).skip).toEqual({ from: 'host', goal: 'night', waiting: ['g1'], left: 28 });
      send(room, { t: 'sleep', a: 'yes' });
      expect(room.sleepNews('host')).toBe('go');
      expect(room.sleepNews('host')).toBeNull();
      const after = room.step({ ...world, clock: night }, 0.05, 3, ground, oneTree);
      expect(after.clock).toBeGreaterThan(night);
      expect(isNight(after.clock)).toBe(false);
      expect(room.snapshot(after).asleep).toBeUndefined();
    });

    it('wakes the asker and leaves the clock when a friend says no', () => {
      const room = sleepers();
      room.lie('host', 'night', false, 0);
      send(room, { t: 'sleep', a: 'no' });
      expect(room.sleepNews('host')).toBe('stop');
      const after = room.step({ ...world, clock: night }, 0.05, 2, ground, oneTree);
      expect(after.clock).toBe(night);
      expect(room.asleep('host')).toBe(false);
    });

    it('lets a host that dreams dream on when a friend says no', () => {
      const room = sleepers();
      room.lie('host', 'night', true, 0);
      send(room, { t: 'sleep', a: 'no' });
      expect(room.sleepNews('host')).toBe('stop');
      expect(room.asleep('host')).toBe(true);
    });

    it('takes no answer in time as a no', () => {
      const room = sleepers();
      room.lie('host', 'night', false, 0);
      room.step({ ...world, clock: night }, 0.05, 31, ground, oneTree);
      expect(room.sleepNews('host')).toBe('stop');
    });

    it('lets a lone host skip at once', () => {
      const room = new Room(() => undefined);
      room.lie('host', 'night', false, 0);
      expect(room.sleepNews('host')).toBe('go');
      expect(room.step({ ...world, clock: night }, 0.05, 1, ground, oneTree).clock).toBeGreaterThan(night);
    });

    it('puts a guest to bed only on a nest of its own pair lodge at night', () => {
      const room = sleepers();
      const lodge = { x: 40, z: 0, base: 0, door: Math.PI / 2, wood: LODGE_WOOD, wear: newWear(0), players: ['host', 'g1'] as [string, string], wholeAt: 0 };
      const w = { ...world, clock: night, pairLodges: [lodge], lodge };
      send(room, { t: 'sleep', g: 'night' });
      room.step(w, 0.05, 1, ground, oneTree);
      expect(room.asleep('g1')).toBe(false);
      const g = room.guests()[0]!;
      Object.assign(g, { inside: true, beaver: { ...g.beaver, x: lodge.x + NEST_SPOTS[1]!.x, z: lodge.z + NEST_SPOTS[1]!.z } });
      send(room, { t: 'sleep', g: 'night', dream: true });
      room.step(w, 0.05, 2, ground, oneTree);
      expect(room.asleep('g1')).toBe(true);
      expect(room.snapshot(w).dreaming).toEqual(['g1']);
      send(room, { t: 'sleep', a: 'wake' });
      expect(room.asleep('g1')).toBe(false);
    });
  });

  describe('the dream the host runs for guests (#665)', () => {
    const twoGuests = () => {
      const { room } = joined();
      room.open('g2');
      room.receive('g2', hello, 0, host, ground);
      return room;
    };
    const stick = (room: Room, id: string, x: number, z: number, more: object = {}) => room.receive(id, JSON.stringify({ t: 'dream', input: { move: { x, z }, hop: false, slap: false, play: false, ...more } }), 1, host, ground);
    const frames = (room: Room, n: number) => {
      for (let i = 0; i < n; i++) room.step(world, 1 / 30, 1 + i / 30, ground, oneTree);
    };

    it('opens with the first guest to dream and steers its beaver by its input', () => {
      const room = twoGuests();
      expect(room.dreamState()).toBeNull();
      room.lie('g1', 'dream', true, 0);
      frames(room, 1);
      const first = room.dreamState()!;
      expect(first).not.toBeNull();
      stick(room, 'g1', 0, 1);
      frames(room, 60);
      expect(room.dreamState()!.beaver.z - first.beaver.z).toBeGreaterThan(2);
    });

    it('takes a later sleeper as a friend and sends the dream only to dreamers', () => {
      const room = twoGuests();
      room.lie('g1', 'dream', true, 0);
      room.lie('g2', 'dream', true, 0);
      frames(room, 2);
      expect(room.dreamState()!.friends!.map((f) => f.id)).toEqual(['g2']);
      stick(room, 'g2', 1, 0);
      frames(room, 30);
      const f = room.dreamState()!.friends![0]!;
      expect(f.beaver.x).toBeGreaterThan(room.dreamState()!.land.start.x + 1);
      expect(room.snapshot(world, 'g1', 1).dream?.owner).toBe('g1');
      expect(room.snapshot(world, 'g2', 1).dream?.friends).toHaveLength(1);
      expect(room.snapshot(world, undefined, 1).dream).toBeUndefined();
      room.wake('g1', 2);
      expect(room.snapshot(world, 'g1', 2).dream).toBeUndefined();
    });

    it('sends a guest the news of the dream with its snapshot, once', () => {
      const { room, sent } = joined();
      room.lie('g1', 'dream', true, 0);
      frames(room, 1);
      // A guest standing on a sweet makes news (a sweet event) for the next snapshot.
      const sweet = room.dreamState()!.sweets.find((w) => !w.floating && w.kind === 'drop')!;
      const dream = (room as unknown as { dream: { state: { beaver: { x: number; z: number } } } }).dream;
      dream.state.beaver.x = sweet.x;
      dream.state.beaver.z = sweet.z;
      frames(room, 1);
      sent.length = 0;
      room.broadcast(world, 1);
      const first = JSON.parse(sent.find(([to]) => to === 'g1')![1]).snapshot.dream;
      expect(first.events.some((e: { what: string }) => e.what === 'sweet')).toBe(true);
      sent.length = 0;
      room.broadcast(world, 2);
      expect(JSON.parse(sent.find(([to]) => to === 'g1')![1]).snapshot.dream.events).toBeUndefined();
    });

    it('keeps a press until a step has used it, and ignores the input of a guest that does not dream', () => {
      const room = twoGuests();
      stick(room, 'g1', 0, 1, { hop: true });
      room.lie('g1', 'dream', true, 0);
      frames(room, 1);
      expect(room.dreamState()!.beaver.hopAt).toBeNull();
      stick(room, 'g1', 0, 0, { hop: true });
      stick(room, 'g1', 0, 0);
      frames(room, 1);
      expect(room.dreamState()!.beaver.hopAt).not.toBeNull();
    });

    it('goes on for a friend when the dreamer wakes, and ends with the last one', () => {
      const room = twoGuests();
      room.lie('g1', 'dream', true, 0);
      room.lie('g2', 'dream', true, 0);
      frames(room, 2);
      const before = room.dreamState()!.friends![0]!.beaver;
      room.wake('g1', 1);
      frames(room, 1);
      const after = room.dreamState()!;
      expect(room.snapshot(world, 'g2', 1).dream?.owner).toBe('g2');
      expect(after.friends).toBeUndefined();
      expect(Math.hypot(after.beaver.x - before.x, after.beaver.z - before.z)).toBeLessThan(0.5);
      room.wake('g2', 2);
      frames(room, 1);
      expect(room.dreamState()).toBeNull();
    });

    it('puts the host in the same dream, as a friend of the guest who dreamed first', () => {
      const room = twoGuests();
      room.lie('g1', 'dream', true, 0);
      frames(room, 1);
      room.lie('host', 'dream', true, 0);
      frames(room, 1);
      expect(room.dreamInfo()!.owner).toBe('g1');
      expect(room.dreamState()!.friends!.map((f) => f.id)).toEqual(['host']);
      room.steer('host', { move: { x: 1, z: 0 }, hop: false, slap: false, play: false });
      const x = room.dreamState()!.friends![0]!.beaver.x;
      frames(room, 5);
      expect(room.dreamState()!.friends![0]!.beaver.x).not.toBe(x);
      expect(room.takeDreamEvents()).toBeInstanceOf(Array);
    });

    it('opens the host dream for a guest who dreams after it, with the hosts theme and seed', () => {
      const room = twoGuests();
      room.lie('host', 'dream', true, 0, { theme: 'veggie', seed: 42 });
      frames(room, 1);
      expect(room.dreamInfo()).toEqual({ owner: 'host', seed: 42, theme: 'veggie' });
      room.lie('g1', 'dream', true, 0, { theme: 'candy' });
      frames(room, 1);
      expect(room.dreamInfo()!.theme).toBe('veggie');
      expect(room.snapshot(world, 'g1', 1).dream).toMatchObject({ owner: 'host', theme: 'veggie', seed: 42 });
      room.wake('host', 1);
      frames(room, 1);
      expect(room.dreamInfo()!.owner).toBe('g1');
    });

    it('takes the hat and scarf of each dreamer into the dream', () => {
      const room = twoGuests();
      room.lie('host', 'dream', true, 0);
      room.lie('g1', 'dream', true, 0);
      frames(room, 1);
      expect(room.dreamState()!.look).toEqual({ hat: world.look.hat, scarf: world.look.scarf });
      expect(room.dreamState()!.friends![0]!.look).toBeDefined();
    });

    it('opens a veggie dream when the guest asks for one', () => {
      const room = twoGuests();
      room.lie('g1', 'dream', true, 0, { theme: 'veggie' });
      frames(room, 1);
      expect(room.dreamInfo()!.theme).toBe('veggie');
    });

    it('ends when a dreaming guest leaves', () => {
      const room = twoGuests();
      room.lie('g1', 'dream', true, 0);
      frames(room, 1);
      room.leave('g1');
      frames(room, 1);
      expect(room.dreamState()).toBeNull();
    });
  });
});

describe('a connection that does not say hello (#785)', () => {
  const trees: TreeSource = { nearest: () => null, trunksNear: () => [] };

  it('is forgotten after a while, so a hello that comes much later is ignored', () => {
    const room = new Room(() => undefined);
    room.open('s', 10);
    room.step(world, 0.1, 10 + HELLO_WITHIN + 1, ground, trees);
    room.receive('s', hello, 10 + HELLO_WITHIN + 1, host, ground);
    expect(room.guests()).toHaveLength(0);
  });

  it('still takes a hello inside the time, whatever the steps in between', () => {
    const room = new Room(() => undefined);
    room.open('s', 10);
    room.step(world, 0.1, 10 + HELLO_WITHIN, ground, trees);
    room.receive('s', hello, 10 + HELLO_WITHIN, host, ground);
    expect(room.guests()).toHaveLength(1);
  });

  it('forgets an old stranger when a new connection opens', () => {
    const room = new Room(() => undefined);
    room.open('old', 0);
    room.open('new', HELLO_WITHIN + 1);
    room.receive('old', hello, HELLO_WITHIN + 1, host, ground);
    room.receive('new', hello, HELLO_WITHIN + 1, host, ground);
    expect(room.guests().map((g) => g.id)).toEqual(['new']);
  });

  it('holds only so many strangers, and the oldest make way for the newest', () => {
    const room = new Room(() => undefined);
    for (let i = 0; i <= MAX_STRANGERS; i++) room.open(`s${i}`, i);
    room.receive('s0', hello, MAX_STRANGERS, host, ground);
    expect(room.guests()).toHaveLength(0);
    room.receive(`s${MAX_STRANGERS}`, hello, MAX_STRANGERS, host, ground);
    expect(room.guests()).toHaveLength(1);
  });

  it('forgets a connection that closes, as before', () => {
    const room = new Room(() => undefined);
    room.open('s', 0);
    room.leave('s');
    room.receive('s', hello, 1, host, ground);
    expect(room.guests()).toHaveLength(0);
  });
});

describe('a jump of the clock (test tool)', () => {
  const lodge = { x: 100, z: 0, base: 0, door: Math.PI / 2, wood: LODGE_WOOD };
  const parents: [{ coat: number; shade: number }, { coat: number; shade: number }] = [{ coat: 1, shade: 0 }, { coat: 2, shade: 0 }];
  const homes = [{ x: 100, z: 0, id: 'family:start:0', lodge, parents }];

  it('leaves a kit guest as old as it was, and a grown guest grown', () => {
    const room = new Room(() => undefined);
    const born = 5 * DAY_SECONDS;
    room.open('a');
    room.receive('a', hello, 0, host, ground, homes, born);
    room.open('b');
    room.receive('b', hello, 0, host, ground);
    const clock = born + DAY_SECONDS;
    const stage = (id: string, at: number) => guestStage(room.guests().find((g) => g.id === id)!, at);
    const before = stage('a', clock);
    const jump = 40 * DAY_SECONDS;
    room.shiftAges(jump);
    expect(stage('a', clock + jump)).toBe(before);
    expect(room.guests().find((g) => g.id === 'a')!.bornAt).toBe(born + jump);
    expect(room.guests().find((g) => g.id === 'b')!.bornAt).toBeNull();
  });
});
