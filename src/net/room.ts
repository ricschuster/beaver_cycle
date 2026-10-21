// The host's side of a shared valley, without the socket (ADR 0014, #678): who is in, what each guest wants, and the state to send.
// The plugin or a test feeds it messages and gives it a way to send text; it never touches the network itself.
import type { Intent } from '../sim/buttons';
import { newGuest, stepGuest, type Guest } from '../sim/guests';
import type { Dam } from '../sim/dam';
import type { Dropped } from '../sim/haul';
import type { Picked } from '../sim/lily';
import type { Log } from '../sim/logs';
import { GIVE_REACH } from '../sim/familyMoods';
import { withPonds } from '../sim/pond';
import type { Terrain } from '../sim/terrain';
import type { TreeSource } from '../sim/trees';
import type { WorldState } from '../sim/state';
import { asked, askersOf, drop, expire, noPairing, partnerOf, press, type Pairing } from './pairs';
import { stageAt } from '../sim/life';
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
}

export class Room {
  private seats = new Map<string, Seat>();
  /** Connections that have not yet said hello. */
  private strangers = new Set<string>();
  /** Who asked whom to be partners, and who said yes (#666). */
  private pairing: Pairing = noPairing();
  constructor(private readonly send: (to: string, text: string) => void) {}

  /** A connection opened: it waits for its hello. */
  open(id: string): void {
    this.strangers.add(id);
  }

  leave(id: string): void {
    this.strangers.delete(id);
    this.seats.delete(id);
    this.pairing = drop(this.pairing, id);
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
      const at = home !== null ? { x: homes[home]!.x + HOME_OFFSET, z: homes[home]!.z } : { x: host.x + SPAWN_OFFSET * n, z: host.z + SPAWN_OFFSET };
      this.seats.set(id, { guest: newGuest(id, at, terrain, m.coat, m.look), intent: { move: { x: 0, z: 0 } }, heard: now, home, family: home !== null ? homes[home]!.id ?? null : null });
      return this.reply(id, { t: 'welcome', id });
    }
    const seat = this.seats.get(id);
    if (seat) {
      seat.intent = intentOf(m);
      seat.heard = now;
    }
  }

  /** Every guest advanced by `dt`. Returns the world with what they changed: trees felled, the logs, the dams they built, the rocks taken. */
  step(world: WorldState, dt: number, now: number, ground: Terrain, trees: TreeSource): WorldState {
    let { felled, logs, dams, rocksTaken, dropped, picked, stripped }: { felled: readonly string[]; logs: readonly Log[]; dams: readonly Dam[]; rocksTaken: readonly string[]; dropped: readonly Dropped[]; picked: Picked; stripped: Readonly<Record<string, number>> } = world;
    const terrain = withPonds(ground, world.ponds);
    const solids = [world.lodge, ...world.formerHomes, ...world.neighbours.map((n) => n.lodge)].flatMap((l) => (l ? [{ x: l.x, z: l.z, radius: 4 }] : []));
    let hostCarry = world.carry;
    this.pairing = expire(this.pairing, now);
    const hostAdult = stageAt(world.clock, world.bornAt) === 'adult';
    for (const seat of this.seats.values()) {
      const intent = now - seat.heard > SILENT_AFTER ? { move: { x: 0, z: 0 } } : seat.intent;
      if (intent.do === 'give' && seat.guest.carry) {
        // Food handed to the host or another guest whose mouth is empty (#663).
        const to = this.taker(seat.guest.id, seat.guest.beaver, world.beaver, hostCarry === null && world.haul === null && world.drag === null);
        if (to === 'host') hostCarry = seat.guest.carry;
        else if (to) to.carry = seat.guest.carry;
        if (to) seat.guest = { ...seat.guest, carry: null };
      }
      if (intent.do === 'partner') {
        const to = this.partnerNear(seat.guest.id, seat.guest.beaver, world.beaver, hostAdult);
        if (to) this.ask(seat.guest.id, to, now);
      }
      const r = stepGuest(seat.guest, intent, dt, { felled, logs, clock: world.clock, dams, spots: world.spots, rocksTaken, dropped, ground, picked, stripped }, terrain, trees, solids);
      seat.guest = r.guest;
      // A press arrives once: the next step must not repeat it.
      seat.intent = { ...seat.intent, do: seat.intent.do === 'gnaw' ? 'gnaw' : null, take: null };
      ({ felled, logs, dams, rocksTaken, dropped, picked, stripped } = r);
    }
    const same = felled === world.felled && logs === world.logs && dams === world.dams && rocksTaken === world.rocksTaken && dropped === world.dropped && picked === world.picked && stripped === world.stripped;
    if (hostCarry !== world.carry) world = { ...world, carry: hostCarry };
    return same ? world : { ...world, felled: [...felled], logs: [...logs], dams: [...dams], rocksTaken: [...rocksTaken], dropped: [...dropped], picked, stripped: { ...stripped } };
  }

  /**
   * Who can be handed food by the one at `from`: the host when its mouth is empty, else the nearest guest within `GIVE_REACH` with an
   * empty mouth (not `except`). Null when there is none.
   */
  private taker(except: string, from: { x: number; z: number }, host: { x: number; z: number }, hostEmpty: boolean): 'host' | Guest | null {
    let best: 'host' | Guest | null = hostEmpty && Math.hypot(host.x - from.x, host.z - from.z) <= GIVE_REACH ? 'host' : null;
    let bestD = best ? Math.hypot(host.x - from.x, host.z - from.z) : GIVE_REACH;
    for (const s of this.seats.values()) {
      const g = s.guest;
      const d = Math.hypot(g.beaver.x - from.x, g.beaver.z - from.z);
      if (g.id !== except && !g.carry && !g.haul && d <= bestD) {
        best = g;
        bestD = d;
      }
    }
    return best;
  }

  /**
   * The player `from` can ask to be partners, or say yes to: the nearest friend within `GIVE_REACH`, when both are adults with no
   * partner yet (guests are all grown, the host only when `hostAdult`). `at` is where `from` stands.
   */
  partnerNear(from: string, at: { x: number; z: number }, host: { x: number; z: number }, hostAdult: boolean): string | null {
    if ((from === 'host' && !hostAdult) || partnerOf(this.pairing, from)) return null;
    const dist = (p: { x: number; z: number }) => Math.hypot(p.x - at.x, p.z - at.z);
    let best: string | null = from !== 'host' && hostAdult && dist(host) <= GIVE_REACH && !partnerOf(this.pairing, 'host') ? 'host' : null;
    let bestD = best ? dist(host) : GIVE_REACH;
    for (const s of this.seats.values()) {
      const d = dist(s.guest.beaver);
      if (s.guest.id !== from && !partnerOf(this.pairing, s.guest.id) && d <= bestD) {
        best = s.guest.id;
        bestD = d;
      }
    }
    return best;
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
  guestTaker(at: { x: number; z: number }): Guest | null {
    const to = this.taker('host', at, at, false);
    return to && to !== 'host' ? to : null;
  }

  /** The host's food goes into the mouth of `to`. Returns the world with the host's mouth empty. */
  hand(world: WorldState, to: Guest): WorldState {
    to.carry = world.carry;
    return { ...world, carry: null };
  }

  /** What every guest is sent: the shared world and every beaver in it, the host's first. */
  snapshot(world: WorldState): Snapshot {
    const b = world.beaver;
    const hostView: BeaverView = { id: 'host', coat: world.coat, look: world.look, x: b.x, y: b.y, z: b.z, mode: b.mode, heading: b.heading, pace: 0, chopping: world.chop !== null, carry: world.carry, haul: world.haul?.kind ?? null, grown: stageAt(world.clock, world.bornAt) === 'adult' };
    return { clock: world.clock, felled: world.felled, logs: world.logs, beavers: [hostView, ...this.guests().map(viewOfGuest)], played: this.played(), dams: world.dams, lodge: world.lodge, rocksTaken: world.rocksTaken, dropped: world.dropped, picked: world.picked, stripped: world.stripped, asks: this.pairing.asks.map((a) => [a.from, a.to]), pairs: this.pairing.pairs.map(([a, b]) => [a, b]) };
  }

  /** Sends the state to every guest that has said hello. */
  broadcast(world: WorldState): void {
    const text = JSON.stringify({ t: 'state', snapshot: this.snapshot(world) } satisfies ToGuest);
    for (const id of this.seats.keys()) this.send(id, text);
  }

  private reply(id: string, m: ToGuest): void {
    this.send(id, JSON.stringify(m));
  }
}
