// The messages between a host and its guests (ADR 0014, docs/design/42_multiplayer.md). JSON text over a WebSocket. A guest
// sends what its player wants (`Intent`, trimmed to what the host runs for a guest) and the host answers with the state of the
// shared world. Everything that comes off the wire is checked here, since a friend's tablet is not trusted to be well made.
import type { Dam } from '../sim/dam';
import type { Coat } from '../sim/family';
import { guestStage, type Guest } from '../sim/guests';
import type { Food } from '../sim/food';
import type { Dropped } from '../sim/haul';
import type { Log } from '../sim/logs';
import type { Lodge } from '../sim/lodge';
import type { PairLodge } from '../sim/pairLodge';
import { cleanLook, type Look } from '../sim/look';
import type { Intent } from '../sim/buttons';
import type { HideGame, Role } from './hideGame';
import type { Goal } from './sleepCheck';
import type { DreamWire } from './dreamWire';
import type { DreamInput, DreamTheme } from '../sim/dream';
import { isAnswer, isQuestion, type AnswerId, type QuestionId, type Say } from './says';

/** The presses of Do and Take a guest's beaver can do so far: gnaw, build or mend a dam, hand food to a friend, strip a branch off a log, ask a friend to be partners or say yes; let go, put down, take a log, a pad, a rock, mud, or a piece put down. */
export type GuestDo = 'gnaw' | 'build' | 'mend' | 'give' | 'strip' | 'partner' | 'eat' | 'store';
export type GuestTake = 'let-go' | 'drop' | 'item' | 'log' | 'pad' | 'rock' | 'mud';
const DOS: readonly string[] = ['gnaw', 'build', 'mend', 'give', 'strip', 'partner', 'eat', 'store'];
const TAKES: readonly string[] = ['let-go', 'drop', 'item', 'log', 'pad', 'rock', 'mud'];

/** The port the host listens on. */
export const PORT = 8765;
/** The host sends state this many times a second, and a guest sends its intent as often. */
export const SEND_HZ = 20;

export type ToHost = { t: 'hello'; coat: Coat; look: Look; key?: string } | { t: 'intent'; x: number; z: number; dive: boolean; diveTap?: boolean; gnaw: boolean; do?: GuestDo; take?: GuestTake } | { t: 'look'; coat: Coat; look: Look } | { t: 'sleep'; g: Goal; dream?: boolean; theme?: DreamTheme } | { t: 'sleep'; a: 'yes' | 'no' | 'wake' } | { t: 'dream'; input: DreamInput } | { t: 'say'; q?: QuestionId; a?: AnswerId } | { t: 'hide'; r?: Role; a?: AnswerId; to?: string } | { t: 'ping'; ts: number };

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
  /** Pads picked and branches stripped, so a guest's Take and Do read the same as the host's. */
  picked?: Record<string, number>;
  stripped?: Record<string, number>;
  /** The dams of the host's world and the host's lodge: a guest draws them and works out the ponds from the dams. */
  dams?: Dam[];
  lodge?: Lodge | null;
  /** The lodges pairs build together (#666). */
  pairLodges?: PairLodge[];
  /** Players who asked another to be partners and wait for a yes, as [from, to], and the pairs who said yes (#666). */
  asks?: [string, string][];
  pairs?: [string, string][];
  /** Partners who asked to stop being partners and wait for the other's press, as [from, to] (note 48, Q4). */
  stops?: [string, string][];
  /** The questions players put to friends close by, and the answers (#667). */
  says?: Say[];
  /** The game of hide and seek that runs, with the seconds left of its phase (#664). */
  hide?: HideView;
  /** The players who are dreaming now, so the others can be told (#665). */
  dreaming?: string[];
  /** The players who are asleep, a dream included, and the skip that waits for the friends' yes (#661, #665). */
  asleep?: string[];
  skip?: SkipView;
  /** The dream this player is in, run by the host, for the player to draw (#665). Only a dreamer is sent it. */
  dream?: DreamWire;
}

/** A sleeper's skip of the clock, as the friends see it: who asked, where it ends, who is asked, and the seconds left. */
export interface SkipView {
  from: string;
  goal: Goal;
  waiting: string[];
  left: number;
}

export type HideView = HideGame & { left: number };

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
  /** Food in the mouth. */
  carry?: Food | null;
  /** False for a host beaver that is not yet an adult, and so cannot be a partner (absent means grown). */
  grown?: boolean;
  /** True while the beaver is in the round room of its pair lodge, so only a tablet in that room draws it (#666). */
  inside?: boolean;
  /** The clock a kit of a pair lodge was born at, and the coats of its two parents (note 48); absent for a beaver that has always been grown. */
  bornAt?: number;
  parents?: [Coat, Coat];
  /** The lodge of its starting family, the room it is in while `inside` and it has no pair lodge (note 42). */
  home?: Lodge;
}

export type ToGuest = { t: 'welcome'; id: string } | { t: 'state'; snapshot: Snapshot } | { t: 'pong'; ts: number };

/** A guest's own key, kept on its tablet, so the host knows it again after a break (#666): 8 to 24 lower case letters and digits. */
const KEY = /^[a-z0-9]{8,24}$/;

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
  if (m.t === 'hello') return { t: 'hello', coat: coatOf(m.coat), look: cleanLook(m.look as Partial<Look>), ...(typeof m.key === 'string' && KEY.test(m.key) ? { key: m.key } : {}) };
  if (m.t === 'look') return { t: 'look', coat: coatOf(m.coat), look: cleanLook(m.look as Partial<Look>) };
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
    return { t: 'intent', x, z, dive: m.dive === true, ...(m.diveTap === true ? { diveTap: true } : {}), gnaw: m.gnaw === true, ...(act ? { do: act } : {}), ...(take ? { take } : {}) };
  }
  if (m.t === 'sleep') {
    if (m.a === 'yes' || m.a === 'no' || m.a === 'wake') return { t: 'sleep', a: m.a };
    return m.g === 'night' || m.g === 'season' ? { t: 'sleep', g: m.g, ...(m.dream === true ? { dream: true, ...(m.theme === 'veggie' ? { theme: 'veggie' as const } : {}) } : {}) } : null;
  }
  if (m.t === 'dream') {
    const i = (m.input ?? {}) as Partial<DreamInput> & { move?: { x?: unknown; z?: unknown } };
    let x = num(i.move?.x, -1, 1);
    let z = num(i.move?.z, -1, 1);
    const l = Math.hypot(x, z);
    if (l > 1) {
      x /= l;
      z /= l;
    }
    return { t: 'dream', input: { move: { x, z }, hop: i.hop === true, slap: i.slap === true, play: i.play === true, ...(i.pick === 'hide' || i.pick === 'seek' ? { pick: i.pick } : {}) } };
  }
  if (m.t === 'say') return isQuestion(m.q) ? { t: 'say', q: m.q } : isAnswer(m.a) ? { t: 'say', a: m.a } : null;
  if (m.t === 'hide') {
    const to = typeof m.to === 'string' && m.to.length <= 40 ? m.to : undefined;
    if (m.r === 'hide' || m.r === 'seek') return { t: 'hide', r: m.r, ...(to ? { to } : {}) };
    return isAnswer(m.a) ? { t: 'hide', a: m.a } : null;
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
  return { move: { x: m.x, z: m.z }, dive: m.dive, diveTap: m.diveTap === true, do: m.do ?? (m.gnaw ? 'gnaw' : null), take: m.take ?? null };
}

/** A guest as the others see it. */
export function viewOfGuest(g: Guest, clock = 0): BeaverView {
  const b = g.beaver;
  return { id: g.id, coat: g.coat, look: g.look, x: b.x, y: b.y, z: b.z, mode: b.mode, heading: b.heading, pace: g.pace, chopping: g.chop !== null, haul: g.haul?.kind ?? null, carry: g.carry, drag: g.drag, grown: guestStage(g, clock) === 'adult', ...(g.inside ? { inside: true } : {}), ...(g.inside && g.homeLodge ? { home: g.homeLodge } : {}), ...(g.bornAt !== null ? { bornAt: g.bornAt, ...(g.parents ? { parents: g.parents } : {}) } : {}) };
}
