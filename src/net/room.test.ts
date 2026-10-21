import { describe, expect, it } from 'vitest';
import { Room, MAX_GUESTS } from './room';
import { applySnapshot, friendTaker, othersOf, pairingOf, partnerCandidate } from './view';
import { createWorld, leaveHome } from '../sim/state';
import { DOOR_DISTANCE, LODGE_WOOD, SOLID_RADIUS, doorPoint } from '../sim/lodge';
import { newWear } from '../sim/wear';
import { DAY_SECONDS, nextSpringStart } from '../sim/clock';
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
});
