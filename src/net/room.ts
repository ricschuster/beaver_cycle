// The host's side of a shared valley, without the socket (ADR 0014, #678): who is in, what each guest wants, and the state to send.
// The plugin or a test feeds it messages and gives it a way to send text; it never touches the network itself.
import type { Intent } from '../sim/buttons';
import { newGuest, stepGuest, type Guest } from '../sim/guests';
import type { Dam } from '../sim/dam';
import type { Dropped } from '../sim/haul';
import type { Log } from '../sim/logs';
import { withPonds } from '../sim/pond';
import type { Terrain } from '../sim/terrain';
import type { TreeSource } from '../sim/trees';
import type { WorldState } from '../sim/state';
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
  constructor(private readonly send: (to: string, text: string) => void) {}

  /** A connection opened: it waits for its hello. */
  open(id: string): void {
    this.strangers.add(id);
  }

  leave(id: string): void {
    this.strangers.delete(id);
    this.seats.delete(id);
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
    let { felled, logs, dams, rocksTaken, dropped }: { felled: readonly string[]; logs: readonly Log[]; dams: readonly Dam[]; rocksTaken: readonly string[]; dropped: readonly Dropped[] } = world;
    const terrain = withPonds(ground, world.ponds);
    const solids = [world.lodge, ...world.formerHomes, ...world.neighbours.map((n) => n.lodge)].flatMap((l) => (l ? [{ x: l.x, z: l.z, radius: 4 }] : []));
    for (const seat of this.seats.values()) {
      const intent = now - seat.heard > SILENT_AFTER ? { move: { x: 0, z: 0 } } : seat.intent;
      const r = stepGuest(seat.guest, intent, dt, { felled, logs, clock: world.clock, dams, spots: world.spots, rocksTaken, dropped }, terrain, trees, solids);
      seat.guest = r.guest;
      // A press arrives once: the next step must not repeat it.
      seat.intent = { ...seat.intent, do: seat.intent.do === 'gnaw' ? 'gnaw' : null, take: null };
      ({ felled, logs, dams, rocksTaken, dropped } = r);
    }
    const same = felled === world.felled && logs === world.logs && dams === world.dams && rocksTaken === world.rocksTaken && dropped === world.dropped;
    return same ? world : { ...world, felled: [...felled], logs: [...logs], dams: [...dams], rocksTaken: [...rocksTaken], dropped: [...dropped] };
  }

  /** What every guest is sent: the shared world and every beaver in it, the host's first. */
  snapshot(world: WorldState): Snapshot {
    const b = world.beaver;
    const hostView: BeaverView = { id: 'host', coat: world.coat, look: world.look, x: b.x, y: b.y, z: b.z, mode: b.mode, heading: b.heading, pace: 0, chopping: world.chop !== null };
    return { clock: world.clock, felled: world.felled, logs: world.logs, beavers: [hostView, ...this.guests().map(viewOfGuest)], played: this.played(), dams: world.dams, lodge: world.lodge, rocksTaken: world.rocksTaken, dropped: world.dropped };
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
