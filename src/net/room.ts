// The host's side of a shared valley, without the socket (ADR 0014, #678): who is in, what each guest wants, and the state to send.
// The plugin or a test feeds it messages and gives it a way to send text; it never touches the network itself.
import type { Intent } from '../sim/buttons';
import { guestStage, newGuest, outside, reborn, stepGuest, type Guest } from '../sim/guests';
import type { Dam } from '../sim/dam';
import type { Dropped } from '../sim/haul';
import type { Picked } from '../sim/lily';
import type { Log } from '../sim/logs';
import { GIVE_REACH } from '../sim/familyMoods';
import { withPonds } from '../sim/pond';
import type { Terrain } from '../sim/terrain';
import type { TreeSource } from '../sim/trees';
import type { WorldState } from '../sim/state';
import { asked, askersOf, dropAsks, expire, noPairing, partnerOf, press, restore, unpair, type Pairing } from './pairs';
import { stageAt } from '../sim/life';
import { atStore, storeCapacity, storeCondition, tapped } from '../sim/food';
import { leaveHome, pairBirth } from '../sim/state';
import { INTERIOR_RADIUS, lodgeComplete, lodgeSolid } from '../sim/lodge';
import { nextSpringStart } from '../sim/clock';
import { pairLodgeOf, type PairLodge } from '../sim/pairLodge';
import { answer, ask as askSay, drop as dropSays, expire as expireSays, noSays, type AnswerId, type QuestionId, type Says } from './says';
import { accept, decline, drop as dropHide, frozen, hiddenFrom, invite, noteTo, step as stepHide, timeLeft, type Blocker, type HideGame, type Role, type Spot } from './hideGame';
import { intentOf, readToHost, viewOfGuest, type BeaverView, type Snapshot, type ToGuest } from './protocol';

/** The most friends in one valley besides the host (note 42: up to four players at once). */
export const MAX_GUESTS = 3;
/** Where a new guest stands, in metres from the host beaver, until the five lodges give each a home of its own. */
const SPAWN_OFFSET = 4;
/** A guest whose last message is older than this many seconds stops its beaver. */
const SILENT_AFTER = 3;
/** How far from the middle of a free lodge a guest appears, outside its walls. */
const HOME_OFFSET = 6;

interface Seat {
  guest: Guest;
  intent: Intent;
  heard: number;
  /** The index in `homes` of the free lodge this guest took, or null when it stands by the host. */
  home: number | null;
  /** The family of that lodge, whose baby this guest plays. */
  family: string | null;
  /** A question this guest wants to put to the friend close by, until the next step finds who that is (#667). */
  say?: QuestionId;
}

export class Room {
  private seats = new Map<string, Seat>();
  /** Connections that have not yet said hello. */
  private strangers = new Set<string>();
  /** Who asked whom to be partners, and who said yes (#666). */
  private pairing: Pairing = noPairing();
  /** The questions put to friends and their answers (#667). */
  private says: Says = noSays();
  /** The game of hide and seek that runs, if any (#664). */
  private hide: HideGame | null = null;
  constructor(private readonly send: (to: string, text: string) => void) {}

  /** A connection opened: it waits for its hello. */
  open(id: string): void {
    this.strangers.add(id);
  }

  leave(id: string): void {
    this.strangers.delete(id);
    const seat = this.seats.get(id);
    this.seats.delete(id);
    if (seat) {
      this.pairing = dropAsks(this.pairing, seat.guest.id);
      this.says = dropSays(this.says, seat.guest.id);
      if (this.hide) this.hide = dropHide(this.hide, seat.guest.id);
    }
  }

  /** A host that starts again takes its pairs from the lodges already built (#666). */
  restorePairs(lodges: readonly PairLodge[]): void {
    this.pairing = restore(lodges);
  }

  /** The families whose baby a guest plays. */
  played(): string[] {
    return [...this.seats.values()].flatMap((s) => (s.family ? [s.family] : []));
  }

  guests(): Guest[] {
    return [...this.seats.values()].map((s) => s.guest);
  }

  /** A text message from a connection. `now` is real seconds, `host` is where the host beaver stands. */
  receive(id: string, text: string, now: number, host: { x: number; z: number }, terrain: Terrain, homes: readonly { x: number; z: number; id?: string }[] = []): void {
    const m = readToHost(text);
    if (!m) return;
    if (m.t === 'ping') return this.reply(id, { t: 'pong', ts: m.ts });
    if (m.t === 'hello') {
      if (this.seats.has(id) || !this.strangers.has(id)) return;
      if (this.seats.size >= MAX_GUESTS) return;
      this.strangers.delete(id);
      // The first free lodge of the five is the guest's home (note 42); with none left it stands by the host.
      const taken = new Set([...this.seats.values()].map((s) => s.home));
      const idx = homes.findIndex((_, i) => !taken.has(i));
      const home = idx >= 0 ? idx : null;
      const n = this.seats.size + 1;
      // A guest with a key of its own is the same player after a break (a pair and its lodge wait for it); else the connection is its id.
      const pid = m.key && ![...this.seats.values()].some((s) => s.guest.id === `g-${m.key}`) ? `g-${m.key}` : id;
      const at = home !== null ? { x: homes[home]!.x + HOME_OFFSET, z: homes[home]!.z } : { x: host.x + SPAWN_OFFSET * n, z: host.z + SPAWN_OFFSET };
      this.seats.set(id, { guest: newGuest(pid, at, terrain, m.coat, m.look), intent: { move: { x: 0, z: 0 } }, heard: now, home, family: home !== null ? homes[home]!.id ?? null : null });
      return this.reply(id, { t: 'welcome', id: pid });
    }
    const seat = this.seats.get(id);
    // A guest's look card, after it is reborn as a kit (#666): the new coat and look.
    if (seat && m.t === 'look') {
      seat.guest = { ...seat.guest, coat: m.coat, look: m.look };
      seat.heard = now;
    } else if (seat && m.t === 'say') {
      if (m.q) seat.say = m.q;
      else if (m.a) this.says = answer(this.says, seat.guest.id, m.a, now);
      seat.heard = now;
    } else if (seat && m.t === 'hide') {
      seat.heard = now;
      if (m.r) this.startHide(seat.guest.id, m.r, now, host, m.to);
      else if (m.a) this.answerHide(seat.guest.id, m.a);
    } else if (seat && m.t === 'intent') {
      seat.intent = intentOf(m);
      seat.heard = now;
    }
  }

  /** Every guest advanced by `dt`. Returns the world with what they changed: trees felled, the logs, the dams they built, the rocks taken. */
  step(world: WorldState, dt: number, now: number, ground: Terrain, trees: TreeSource): WorldState {
    let { felled, logs, dams, rocksTaken, dropped, picked, stripped }: { felled: readonly string[]; logs: readonly Log[]; dams: readonly Dam[]; rocksTaken: readonly string[]; dropped: readonly Dropped[]; picked: Picked; stripped: Readonly<Record<string, number>> } = world;
    const terrain = withPonds(ground, world.ponds);
    const solids = [
      // The host's lodge is the lodge of its pair once it has one, and that one is solid only as far as its dome (below), so a guest reaches the door.
      ...[world.lodge, ...world.formerHomes, ...world.neighbours.map((n) => n.lodge)].flatMap((l) => (l && !world.pairLodges.some((p) => p.x === l.x && p.z === l.z) ? [{ x: l.x, z: l.z, radius: 4 }] : [])),
      // A pair's lodge is solid to the dome, so the entrance is outside it (`lodgeSolid`).
      ...world.pairLodges.map(lodgeSolid),
    ];
    let hostCarry = world.carry;
    this.pairing = expire(this.pairing, now);
    this.says = expireSays(this.says, now);
    if (this.hide) {
      const r = stepHide(this.hide, this.spots(world), (a, b) => this.blockers(a, b, world, trees, solids), now);
      this.hide = r.game;
    }
    // The host paired: its own lodge becomes a former home (Q110, note 48), and its logs now go to the lodge of the pair.
    const hostPartner = partnerOf(this.pairing, 'host');
    if (hostPartner && !world.pairWith) world = leaveHome(world);
    if (hostPartner !== world.pairWith) world = { ...world, pairWith: hostPartner };
    world = this.endPairs(world, ground);
    world = this.kits(world);
    let pairLodges: readonly PairLodge[] = world.pairLodges;
    const hostAdult = stageAt(world.clock, world.bornAt) === 'adult';
    const hostInside = world.inLodge;
    for (const seat of this.seats.values()) {
      if (seat.say) {
        const to = this.friendNear(seat.guest.id, seat.guest.beaver, world.beaver, seat.guest.inside, hostInside);
        if (to) this.says = askSay(this.says, seat.guest.id, to, seat.say, now);
        seat.say = undefined;
      }
      const still = now - seat.heard > SILENT_AFTER || frozen(this.hide, seat.guest.id);
      const intent = still ? { move: { x: 0, z: 0 } } : seat.intent;
      if (intent.do === 'give' && seat.guest.carry) {
        // Food handed to the host or another guest whose mouth is empty (#663).
        const to = this.taker(seat.guest.id, seat.guest.beaver, world.beaver, hostCarry === null && world.haul === null && world.drag === null, seat.guest.inside, hostInside);
        if (to === 'host') hostCarry = seat.guest.carry;
        else if (to) to.carry = seat.guest.carry;
        if (to) seat.guest = { ...seat.guest, carry: null };
      }
      if (intent.do === 'eat' && seat.guest.inside && seat.guest.carry) {
        // The piece in the mouth is eaten in the room, as the host's is (`step.ts`).
        seat.guest = { ...seat.guest, carry: null };
        world = { ...world, eaten: world.eaten + 1 };
      }
      if (intent.do === 'store' && !seat.guest.inside && !seat.guest.haul && !seat.guest.drag && atStore(world.lodge, seat.guest.beaver.x, seat.guest.beaver.z)) {
        // No stash screen on a guest's tablet: a piece in the mouth goes into the first free place, an empty mouth takes the first piece.
        const capacity = storeCapacity(storeCondition(world.storeWear, world.clock));
        const slot = seat.guest.carry ? world.store.findIndex((f, i) => i < capacity && f === null) : world.store.findIndex((f, i) => i < capacity && f !== null);
        if (slot >= 0) {
          const r = tapped(world.store, seat.guest.carry, slot, capacity);
          world = { ...world, store: r.stock };
          seat.guest = { ...seat.guest, carry: r.carry };
        }
      }
      if (intent.do === 'partner') {
        const to = this.partnerNear(seat.guest.id, seat.guest.beaver, world.beaver, hostAdult, seat.guest.inside, hostInside, world.clock);
        if (to) this.ask(seat.guest.id, to, now);
      }
      const r = stepGuest(seat.guest, intent, dt, { felled, logs, clock: world.clock, dams, spots: world.spots, rocksTaken, dropped, ground, picked, stripped, pairLodges, ponds: world.ponds, partner: partnerOf(this.pairing, seat.guest.id) }, terrain, trees, solids);
      seat.guest = r.guest;
      // A press arrives once: the next step must not repeat it.
      seat.intent = { ...seat.intent, do: seat.intent.do === 'gnaw' ? 'gnaw' : null, take: null, diveTap: false };
      ({ felled, logs, dams, rocksTaken, dropped, picked, stripped, pairLodges } = r);
    }
    const same = felled === world.felled && logs === world.logs && dams === world.dams && rocksTaken === world.rocksTaken && dropped === world.dropped && picked === world.picked && stripped === world.stripped && pairLodges === world.pairLodges;
    if (hostCarry !== world.carry) world = { ...world, carry: hostCarry };
    return same ? world : { ...world, felled: [...felled], logs: [...logs], dams: [...dams], rocksTaken: [...rocksTaken], dropped: [...dropped], picked, stripped: { ...stripped }, pairLodges: [...pairLodges] };
  }

  /**
   * Who can be handed food by the one at `from`: the host when its mouth is empty, else the nearest guest within `GIVE_REACH` with an
   * empty mouth (not `except`). Only a beaver in the same place can: all in the valley, or all in the round room of a lodge. Null when there is none.
   */
  private taker(except: string, from: { x: number; z: number }, host: { x: number; z: number }, hostEmpty: boolean, fromInside = false, hostInside = false): 'host' | Guest | null {
    let best: 'host' | Guest | null = hostEmpty && hostInside === fromInside && Math.hypot(host.x - from.x, host.z - from.z) <= GIVE_REACH ? 'host' : null;
    let bestD = best ? Math.hypot(host.x - from.x, host.z - from.z) : GIVE_REACH;
    for (const s of this.seats.values()) {
      const g = s.guest;
      const d = Math.hypot(g.beaver.x - from.x, g.beaver.z - from.z);
      if (g.id !== except && g.inside === fromInside && !g.carry && !g.haul && d <= bestD) {
        best = g;
        bestD = d;
      }
    }
    return best;
  }

  /**
   * The player `from` can ask to be partners, or say yes to: the nearest friend within `GIVE_REACH`, when both are adults with no
   * partner yet. `at` is where `from` stands. A player with a partner gets the partner back when it is close, for the press that
   * asks to stop being partners (note 48, Q4).
   */
  partnerNear(from: string, at: { x: number; z: number }, host: { x: number; z: number }, hostAdult: boolean, fromInside = false, hostInside = false, clock = 0): string | null {
    const dist = (p: { x: number; z: number }) => Math.hypot(p.x - at.x, p.z - at.z);
    const mine = partnerOf(this.pairing, from);
    if (mine) {
      const g = mine === 'host' ? null : [...this.seats.values()].find((k) => k.guest.id === mine)?.guest;
      const there = mine === 'host' ? (hostInside === fromInside ? dist(host) : Infinity) : g && g.inside === fromInside ? dist(g.beaver) : Infinity;
      return there <= GIVE_REACH ? mine : null;
    }
    if (from === 'host' && !hostAdult) return null;
    const adult = (g: Guest) => guestStage(g, clock) === 'adult';
    const me = [...this.seats.values()].find((s) => s.guest.id === from)?.guest;
    if (me && !adult(me)) return null;
    let best: string | null = from !== 'host' && hostAdult && hostInside === fromInside && dist(host) <= GIVE_REACH && !partnerOf(this.pairing, 'host') ? 'host' : null;
    let bestD = best ? dist(host) : GIVE_REACH;
    for (const s of this.seats.values()) {
      const d = dist(s.guest.beaver);
      if (s.guest.id !== from && s.guest.inside === fromInside && adult(s.guest) && !partnerOf(this.pairing, s.guest.id) && d <= bestD) {
        best = s.guest.id;
        bestD = d;
      }
    }
    return best;
  }

  /** The player `from` can put a question to: the nearest other player within `GIVE_REACH` in the same place (the lodge room or outside). */
  friendNear(from: string, at: { x: number; z: number }, host: { x: number; z: number }, fromInside = false, hostInside = false): string | null {
    const dist = (p: { x: number; z: number }) => Math.hypot(p.x - at.x, p.z - at.z);
    let best: string | null = from !== 'host' && hostInside === fromInside && dist(host) <= GIVE_REACH ? 'host' : null;
    let bestD = best ? dist(host) : GIVE_REACH;
    for (const s of this.seats.values()) {
      const d = dist(s.guest.beaver);
      if (s.guest.id !== from && s.guest.inside === fromInside && d <= bestD) {
        best = s.guest.id;
        bestD = d;
      }
    }
    return best;
  }

  /** Everyone who is in the valley, where they stand: the players a game of hide and seek counts. */
  private spots(world: WorldState): Spot[] {
    return [...(world.inLodge ? [] : [{ id: 'host', x: world.beaver.x, z: world.beaver.z }]), ...[...this.seats.values()].filter((s) => !s.guest.inside).map((s) => ({ id: s.guest.id, x: s.guest.beaver.x, z: s.guest.beaver.z }))];
  }

  /** What two players could hide behind: the standing trees near the line between them, and the lodges. */
  private blockers(a: Spot, b: Spot, world: WorldState, trees: TreeSource, solids: readonly { x: number; z: number; radius: number }[]): Blocker[] {
    const felled = new Set(world.felled);
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const reach = Math.hypot(a.x - b.x, a.z - b.z) / 2 + 2;
    return [...trees.trunksNear(mx, mz, reach, felled).map((k) => ({ x: k.x, z: k.z, r: k.radius })), ...solids.filter((k) => Math.hypot(k.x - mx, k.z - mz) <= reach + k.radius).map((k) => ({ x: k.x, z: k.z, r: k.radius }))];
  }

  /** `from` asks the friends close by (or only `to`, who has said yes already) to play hide and seek, and takes `role`. */
  startHide(from: string, role: Role, now: number, host: { x: number; z: number }, to?: string): void {
    if (this.hide) return;
    const at = from === 'host' ? host : this.seats.get(this.idOf(from) ?? '')?.guest.beaver;
    if (!at) return;
    const others = [...(from === 'host' ? [] : [{ id: 'host', ...host }]), ...[...this.seats.values()].map((s) => ({ id: s.guest.id, x: s.guest.beaver.x, z: s.guest.beaver.z }))];
    const asker: Spot = { id: from, x: at.x, z: at.z };
    const g = invite(asker, role, to ? [to] : noteTo(asker, others), now);
    this.hide = g && to ? accept(g, to) : g;
  }

  /** The connection id of the guest with player id `pid`. */
  private idOf(pid: string): string | undefined {
    for (const [id, s] of this.seats) if (s.guest.id === pid) return id;
    return undefined;
  }

  /** A friend who was asked answers the invitation. */
  answerHide(id: string, a: AnswerId): void {
    if (!this.hide) return;
    this.hide = a === 'yes' ? accept(this.hide, id) : decline(this.hide, id);
    if (this.hide && this.hide.phase === 'invite' && this.hide.invited.length === 0) this.hide = null;
  }

  /** True while the host's own beaver has to stand still, counting. */
  hostFrozen(): boolean {
    return frozen(this.hide, 'host');
  }

  /** The players the host's own screen must leave out: hiders it has not found. */
  hiddenFromHost(): string[] {
    return hiddenFrom(this.hide, 'host');
  }

  /** `from` puts a question to `to`. */
  say(from: string, to: string, q: QuestionId, now: number): void {
    this.says = askSay(this.says, from, to, q, now);
  }

  /** `to` answers the latest question put to it. */
  answer(to: string, a: AnswerId, now: number): void {
    this.says = answer(this.says, to, a, now);
  }

  /**
   * A pair that has come apart (Q4) leaves its lodge as a former home of both: a whole one is kept, solid, and an unfinished one
   * is gone. The kits of a lodge, grown up, leave it the same way. Whoever was in the room is put out at the entrance.
   */
  private endPairs(world: WorldState, ground: Terrain): WorldState {
    const together = (l: PairLodge): boolean => this.pairing.pairs.some(([a, b]) => l.players.includes(a) && l.players.includes(b));
    const present = (id: string): Guest | undefined => [...this.seats.values()].find((s) => s.guest.id === id)?.guest;
    // A kit's lodge is left when every kit of it that is here has grown up (the host's own leaving is `leaveHome`).
    const grownUp = (l: PairLodge): boolean => l.players.every((id) => (id === 'host' ? world.lodge?.x !== l.x || world.lodge?.z !== l.z : (present(id) ? guestStage(present(id)!, world.clock) === 'adult' : false)));
    // A guest left in a room whose lodge is gone (the host left it as a grown beaver) is put out at the entrance of the former home.
    const terrain0 = withPonds(ground, world.ponds);
    for (const seat of this.seats.values()) {
      const g = seat.guest;
      if (!g.inside || pairLodgeOf(world.pairLodges, g.id)) continue;
      const old = world.formerHomes.find((h) => Math.hypot(g.beaver.x - h.x, g.beaver.z - h.z) <= INTERIOR_RADIUS + 1);
      seat.guest = old ? outside(g, old, terrain0) : { ...g, inside: false };
    }
    const ended = world.pairLodges.filter((l) => (l.kitsAt === undefined ? !together(l) : grownUp(l)));
    if (ended.length === 0) return world;
    const terrain = withPonds(ground, world.ponds);
    for (const l of ended) {
      for (const seat of this.seats.values()) if (seat.guest.inside && l.players.includes(seat.guest.id)) seat.guest = outside(seat.guest, l, terrain);
      if (l.players.includes('host') && world.lodge && world.lodge.x === l.x && world.lodge.z === l.z) world = leaveHome(world);
    }
    const left = ended.filter((l) => lodgeComplete(l) && !world.formerHomes.some((h) => h.x === l.x && h.z === l.z));
    return { ...world, pairLodges: world.pairLodges.filter((l) => !ended.includes(l)), formerHomes: [...world.formerHomes, ...left.map((l) => ({ ...l, wear: undefined, parents: l.parents ?? world.parentCoats }))] };
  }

  /**
   * On the first day of spring after a pair lodge was made whole, a kit is born to each of the two partners (Q5, note 48): each plays
   * its own, born on a nest of the lodge, and the two old beavers are their Mama and Papa. The pair is done then, and the lodge is the
   * kits' home. It waits while a partner is away (Q3), and for both to be grown.
   */
  private kits(world: WorldState): WorldState {
    for (const l of world.pairLodges) {
      if (l.kitsAt !== undefined || l.wholeAt === undefined || !lodgeComplete(l) || world.clock < nextSpringStart(l.wholeAt)) continue;
      const [a, b] = l.players;
      const seatOf = (id: string): Guest | null => (id === 'host' ? null : [...this.seats.values()].find((s) => s.guest.id === id)?.guest ?? null);
      const grown = (id: string): boolean => (id === 'host' ? stageAt(world.clock, world.bornAt) === 'adult' : seatOf(id) !== null && guestStage(seatOf(id)!, world.clock) === 'adult');
      if (!grown(a) || !grown(b) || !this.pairing.pairs.some(([x, y]) => [x, y].includes(a) && [x, y].includes(b))) continue;
      const coatOf = (id: string) => (id === 'host' ? world.coat : seatOf(id)!.coat);
      const parents: [typeof world.coat, typeof world.coat] = [coatOf(a), coatOf(b)];
      const home: PairLodge = { ...l, kitsAt: world.clock, parents };
      for (const id of l.players) {
        const other = coatOf(id === a ? b : a);
        if (id === 'host') world = pairBirth({ ...world, pairLodges: world.pairLodges.map((k) => (k === l ? home : k)) }, home, other);
        else for (const seat of this.seats.values()) if (seat.guest.id === id) seat.guest = reborn(seat.guest, home, other, world.clock);
      }
      this.pairing = unpair(this.pairing, a, b);
      return { ...world, pairLodges: world.pairLodges.map((k) => (k === l ? home : k)), pairWith: null };
    }
    return world;
  }

  /** `from` asks `to` to be partners, or says yes when `to` asked first. */
  ask(from: string, to: string, now: number): void {
    this.pairing = press(this.pairing, from, to, now);
  }

  /** The partner of a player, or null. */
  partner(id: string): string | null {
    return partnerOf(this.pairing, id);
  }

  /** Whether `to` waits for a yes from `from`. */
  asking(from: string, to: string): boolean {
    return asked(this.pairing, from, to);
  }

  /** The players who asked `id` and wait for a yes. */
  askers(id: string): string[] {
    return askersOf(this.pairing, id);
  }

  /** The guest the host's food can go to, or null: the nearest friend within `GIVE_REACH` with an empty mouth. */
  guestTaker(at: { x: number; z: number }, hostInside = false): Guest | null {
    const to = this.taker('host', at, at, false, hostInside, hostInside);
    return to && to !== 'host' ? to : null;
  }

  /** The host's food goes into the mouth of `to`. Returns the world with the host's mouth empty. */
  hand(world: WorldState, to: Guest): WorldState {
    to.carry = world.carry;
    return { ...world, carry: null };
  }

  /** What every guest is sent: the shared world and every beaver in it, the host's first. */
  snapshot(world: WorldState, forPlayer?: string, now = 0): Snapshot {
    const b = world.beaver;
    const hostView: BeaverView = { id: 'host', coat: world.coat, look: world.look, x: b.x, y: b.y, z: b.z, mode: b.mode, heading: b.heading, pace: 0, chopping: world.chop !== null, carry: world.carry, haul: world.haul?.kind ?? null, grown: stageAt(world.clock, world.bornAt) === 'adult', ...(world.inLodge ? { inside: true } : {}), ...(world.generation > 0 && world.lodge && pairLodgeOf(world.pairLodges, 'host') ? { bornAt: world.bornAt, parents: world.parentCoats } : {}) };
    return { clock: world.clock, felled: world.felled, logs: world.logs, beavers: [hostView, ...this.guests().map((g) => viewOfGuest(g, world.clock))].filter((v) => !forPlayer || !hiddenFrom(this.hide, forPlayer).includes(v.id)), played: this.played(), dams: world.dams, lodge: world.lodge, rocksTaken: world.rocksTaken, dropped: world.dropped, picked: world.picked, stripped: world.stripped, pairLodges: world.pairLodges, asks: this.pairing.asks.filter((a) => !a.stop).map((a) => [a.from, a.to]), stops: this.pairing.asks.filter((a) => a.stop).map((a) => [a.from, a.to]), pairs: this.pairing.pairs.map(([a, b]) => [a, b]), says: [...this.says.list], ...(this.hide ? { hide: { ...this.hide, left: timeLeft(this.hide, now) } } : {}) };
  }

  /** Sends the state to every guest that has said hello. */
  broadcast(world: WorldState, now = 0): void {
    const text = JSON.stringify({ t: 'state', snapshot: this.snapshot(world, undefined, now) } satisfies ToGuest);
    for (const [id, seat] of this.seats) {
      // A seeker is not told where the hiders it has not found are (#664).
      if (hiddenFrom(this.hide, seat.guest.id).length) this.send(id, JSON.stringify({ t: 'state', snapshot: this.snapshot(world, seat.guest.id, now) } satisfies ToGuest));
      else this.send(id, text);
    }
  }

  private reply(id: string, m: ToGuest): void {
    this.send(id, JSON.stringify(m));
  }
}
