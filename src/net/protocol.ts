// The messages between a host and its guests (ADR 0014, docs/design/42_multiplayer.md). JSON text over a WebSocket. A guest
// sends what its player wants (`Intent`, trimmed to what the host runs for a guest) and the host answers with the state of the
// shared world. Everything that comes off the wire is checked here, since a friend's tablet is not trusted to be well made.
import type { Dam } from '../sim/dam';
import type { Coat } from '../sim/family';
import type { Guest } from '../sim/guests';
import type { Dropped } from '../sim/haul';
import type { Log } from '../sim/logs';
import type { Lodge } from '../sim/lodge';
import { cleanLook, type Look } from '../sim/look';
import type { Intent } from '../sim/buttons';

/** The presses of Do and Take a guest's beaver can do so far: gnaw, build or mend a dam; let go, put down, take a log, a rock, mud, or a piece put down. */
export type GuestDo = 'gnaw' | 'build' | 'mend';
export type GuestTake = 'let-go' | 'drop' | 'item' | 'log' | 'rock' | 'mud';
const DOS: readonly string[] = ['gnaw', 'build', 'mend'];
const TAKES: readonly string[] = ['let-go', 'drop', 'item', 'log', 'rock', 'mud'];

/** The port the host listens on. */
export const PORT = 8765;
/** The host sends state this many times a second, and a guest sends its intent as often. */
export const SEND_HZ = 20;

export type ToHost = { t: 'hello'; coat: Coat; look: Look } | { t: 'intent'; x: number; z: number; dive: boolean; gnaw: boolean; do?: GuestDo; take?: GuestTake } | { t: 'ping'; ts: number };

/** What every guest needs of the world to draw it: the clock, the trees down, the logs, and every beaver but its own host-side state. */
export interface Snapshot {
  clock: number;
  felled: string[];
  logs: Log[];
  /** The host's own beaver and the guests, in the shape the renderer draws. */
  beavers: BeaverView[];
  /** The starting families whose baby a player has taken, so each tablet leaves that kit out of the family. */
  played?: string[];
  /** Rocks taken and pieces put down, shared so each tablet's Take button reads the same as the host's. */
  rocksTaken?: string[];
  dropped?: Dropped[];
  /** The dams of the host's world and the host's lodge: a guest draws them and works out the ponds from the dams. */
  dams?: Dam[];
  lodge?: Lodge | null;
}

/** One beaver as the others see it. */
export interface BeaverView {
  id: string;
  coat: Coat;
  look: Look;
  x: number;
  y: number;
  z: number;
  mode: 'walk' | 'swim' | 'dive';
  heading: number;
  pace: number;
  chopping: boolean;
  /** What the beaver carries: mud or a rock in the mouth, the id of the log it drags. */
  haul?: 'mud' | 'rock' | null;
  drag?: string | null;
}

export type ToGuest = { t: 'welcome'; id: string } | { t: 'state'; snapshot: Snapshot } | { t: 'pong'; ts: number };

const num = (v: unknown, lo = -1e7, hi = 1e7): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0);

export function coatOf(v: unknown): Coat {
  const c = (v ?? {}) as Partial<Coat>;
  return { coat: Math.round(num(c.coat, 0, 4)), shade: num(c.shade, -1, 1) };
}

/** A message from a guest, or null when it is not one. A move is clamped to the unit circle. */
export function readToHost(text: string): ToHost | null {
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!m || typeof m !== 'object') return null;
  if (m.t === 'hello') return { t: 'hello', coat: coatOf(m.coat), look: cleanLook(m.look as Partial<Look>) };
  if (m.t === 'intent') {
    let x = num(m.x, -1, 1);
    let z = num(m.z, -1, 1);
    const l = Math.hypot(x, z);
    if (l > 1) {
      x /= l;
      z /= l;
    }
    const act = typeof m.do === 'string' && DOS.includes(m.do) ? (m.do as GuestDo) : undefined;
    const take = typeof m.take === 'string' && TAKES.includes(m.take) ? (m.take as GuestTake) : undefined;
    return { t: 'intent', x, z, dive: m.dive === true, gnaw: m.gnaw === true, ...(act ? { do: act } : {}), ...(take ? { take } : {}) };
  }
  if (m.t === 'ping') return { t: 'ping', ts: num(m.ts, 0, 1e15) };
  return null;
}

/** A message from the host, or null. The state is trusted in shape only (a guest has nothing to protect from its own host). */
export function readToGuest(text: string): ToGuest | null {
  try {
    const m = JSON.parse(text) as ToGuest;
    return m && (m.t === 'welcome' || m.t === 'state' || m.t === 'pong') ? m : null;
  } catch {
    return null;
  }
}

/** The intent a guest's message stands for, in the sim's own terms. */
export function intentOf(m: Extract<ToHost, { t: 'intent' }>): Intent {
  return { move: { x: m.x, z: m.z }, dive: m.dive, do: m.do ?? (m.gnaw ? 'gnaw' : null), take: m.take ?? null };
}

/** A guest as the others see it. */
export function viewOfGuest(g: Guest): BeaverView {
  const b = g.beaver;
  return { id: g.id, coat: g.coat, look: g.look, x: b.x, y: b.y, z: b.z, mode: b.mode, heading: b.heading, pace: g.pace, chopping: g.chop !== null, haul: g.haul?.kind ?? null, drag: g.drag };
}
