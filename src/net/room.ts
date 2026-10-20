// The host's side of a shared valley, without the socket (ADR 0014, #678): who is in, what each guest wants, and the state to send.
// The plugin or a test feeds it messages and gives it a way to send text; it never touches the network itself.
import type { Intent } from '../sim/buttons';
import { newGuest, stepGuest, type Guest } from '../sim/guests';
import type { Log } from '../sim/logs';
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

interface Seat {
  guest: Guest;
  intent: Intent;
  heard: number;
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

  guests(): Guest[] {
    return [...this.seats.values()].map((s) => s.guest);
  }

  /** A text message from a connection. `now` is real seconds, `host` is where the host beaver stands. */
  receive(id: string, text: string, now: number, host: { x: number; z: number }, terrain: Terrain): void {
    const m = readToHost(text);
    if (!m) return;
    if (m.t === 'ping') return this.reply(id, { t: 'pong', ts: m.ts });
    if (m.t === 'hello') {
      if (this.seats.has(id) || !this.strangers.has(id)) return;
      if (this.seats.size >= MAX_GUESTS) return;
      this.strangers.delete(id);
      const n = this.seats.size + 1;
      const at = { x: host.x + SPAWN_OFFSET * n, z: host.z + SPAWN_OFFSET };
      this.seats.set(id, { guest: newGuest(id, at, terrain, m.coat, m.look), intent: { move: { x: 0, z: 0 } }, heard: now });
      return this.reply(id, { t: 'welcome', id });
    }
    const seat = this.seats.get(id);
    if (seat) {
      seat.intent = intentOf(m);
      seat.heard = now;
    }
  }

  /** Every guest advanced by `dt`. Returns the world with the trees they felled and the logs that lie where those stood. */
  step(world: WorldState, dt: number, now: number, terrain: Terrain, trees: TreeSource): WorldState {
    let felled: readonly string[] = world.felled;
    let logs: readonly Log[] = world.logs;
    const solids = [world.lodge, ...world.formerHomes, ...world.neighbours.map((n) => n.lodge)].flatMap((l) => (l ? [{ x: l.x, z: l.z, radius: 4 }] : []));
    for (const seat of this.seats.values()) {
      const intent = now - seat.heard > SILENT_AFTER ? { move: { x: 0, z: 0 } } : seat.intent;
      const r = stepGuest(seat.guest, intent, dt, { felled, logs, clock: world.clock }, terrain, trees, solids);
      seat.guest = r.guest;
      felled = r.felled;
      logs = r.logs;
    }
    return felled === world.felled && logs === world.logs ? world : { ...world, felled: [...felled], logs: [...logs] };
  }

  /** What every guest is sent: the shared world and every beaver in it, the host's first. */
  snapshot(world: WorldState): Snapshot {
    const b = world.beaver;
    const hostView: BeaverView = { id: 'host', coat: world.coat, look: world.look, x: b.x, y: b.y, z: b.z, mode: b.mode, heading: b.heading, pace: 0, chopping: world.chop !== null };
    return { clock: world.clock, felled: world.felled, logs: world.logs, beavers: [hostView, ...this.guests().map(viewOfGuest)] };
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
