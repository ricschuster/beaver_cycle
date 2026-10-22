// A dream on the wire (#665, docs/design/51_dream_together.md). The host runs the dream; a guest that dreams gets it in its snapshot and
// draws it. The land and the sweets come from the seed on both sides (`newDream` is the same code), so the wire carries only what
// moves: the beavers, the marshmallows, the sweets taken or added, and the games. Pure, no DOM.
import { newDream, type DreamBeaver, type DreamEvent, type DreamInput, type DreamLook, type DreamBoat, type DreamBuild, type DreamFriend, type DreamGame, type DreamState, type DreamTheme, type Mallow, type Plant, type Sweet } from '../sim/dream';

const TAU = Math.PI * 2;

export interface DreamWire {
  seed: number;
  theme: DreamTheme;
  /** The player whose dream it is: its beaver is `beaver`. */
  owner: string;
  time: number;
  beaver: DreamBeaver;
  look?: DreamLook;
  friends?: DreamFriend[];
  mallows: Mallow[];
  /** Ids of sweets taken, and sweets that came after the dream began (a shower). */
  taken: string[];
  added?: Sweet[];
  count: number;
  rushUntil: number;
  statueTouched?: boolean;
  carrying?: boolean;
  builds?: DreamBuild[];
  boats?: DreamBoat[];
  aboard?: string;
  plants?: Plant[];
  game: DreamGame;
  /** What happened in the dream since the last snapshot this guest was sent (sparkles, sounds). */
  events?: DreamEvent[];
}

export const wireOf = (s: DreamState, owner: string, theme: DreamTheme): DreamWire => {
  const base = new Set(baseOf(s.land.seed, theme).sweets.map((w) => w.id));
  const added = s.sweets.filter((w) => !base.has(w.id));
  return {
    seed: s.land.seed,
    theme,
    owner,
    time: s.time,
    beaver: s.beaver,
    ...(s.look ? { look: s.look } : {}),
    ...(s.friends ? { friends: s.friends } : {}),
    mallows: s.mallows,
    taken: s.sweets.filter((w) => w.taken).map((w) => w.id),
    ...(added.length ? { added } : {}),
    count: s.count,
    rushUntil: s.rushUntil,
    ...(s.statueTouched ? { statueTouched: true } : {}),
    ...(s.carrying ? { carrying: true } : {}),
    ...(s.builds ? { builds: s.builds } : {}),
    ...(s.boats ? { boats: s.boats } : {}),
    ...(s.aboard !== undefined ? { aboard: s.aboard } : {}),
    ...(s.plants ? { plants: s.plants } : {}),
    game: s.game,
  };
};

// A guest draws one dream at a time, so it keeps the land of the last seed it was sent.
let cached: { seed: number; theme: DreamTheme; state: DreamState } | null = null;
function baseOf(seed: number, theme: DreamTheme): DreamState {
  if (!cached || cached.seed !== seed || cached.theme !== theme) cached = { seed, theme, state: newDream(seed, [], theme) };
  return cached.state;
}

/** The dream as the guest draws it. The land is the host's, made again from the seed. */
export function dreamOf(w: DreamWire): DreamState {
  const base = baseOf(w.seed, w.theme);
  const taken = new Set(w.taken);
  return {
    ...base,
    time: w.time,
    beaver: w.beaver,
    ...(w.look ? { look: w.look } : {}),
    ...(w.friends ? { friends: w.friends } : {}),
    mallows: w.mallows,
    sweets: [...base.sweets, ...(w.added ?? [])].map((s) => (taken.has(s.id) ? { ...s, taken: true } : s)),
    count: w.count,
    rushUntil: w.rushUntil,
    ...(w.statueTouched ? { statueTouched: true } : {}),
    ...(w.carrying ? { carrying: true } : {}),
    ...(w.builds ? { builds: w.builds } : {}),
    ...(w.boats ? { boats: w.boats } : {}),
    ...(w.aboard !== undefined ? { aboard: w.aboard } : {}),
    ...(w.plants ? { plants: w.plants } : {}),
    game: w.game,
  };
}

/**
 * The dream between two snapshots: positions and headings a share `k` (0 to 1) of the way from `from` to `to`, so a guest that gets
 * 20 snapshots a second draws a smooth walk. Everything else is `to`'s. A new land (another seed) is not blended.
 */
export function blendDream(from: DreamState | null, to: DreamState, k: number): DreamState {
  if (!from || from.land !== to.land || k >= 1) return to;
  const f = Math.max(0, k);
  const turn = (a: number, b: number): number => a + ((((b - a) % TAU) + 3 * Math.PI) % TAU - Math.PI) * f;
  const move = <T extends DreamBeaver>(a: T | undefined, b: T): T => (a ? { ...b, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, heading: turn(a.heading, b.heading) } : b);
  const byId = <T extends { id: string }>(list: readonly T[] | undefined, id: string): T | undefined => list?.find((o) => o.id === id);
  return {
    ...to,
    beaver: move(from.beaver, to.beaver),
    ...(to.friends ? { friends: to.friends.map((o) => { const a = byId(from.friends, o.id); return a ? { ...o, beaver: move(a.beaver, o.beaver) } : o; }) } : {}),
    mallows: to.mallows.map((m) => move(byId(from.mallows, m.id), m)),
    ...(to.boats ? { boats: to.boats.map((o) => { const a = byId(from.boats, o.id); return a ? { ...o, x: a.x + (o.x - a.x) * f, z: a.z + (o.z - a.z) * f, heading: turn(a.heading, o.heading) } : o; }) } : {}),
  };
}

/** Two inputs of one player before a send: the stick is the newer one, a press stays until it has been sent. */
export function mergeInput(old: DreamInput | null, next: DreamInput): DreamInput {
  if (!old) return next;
  return { move: next.move, hop: old.hop || next.hop, slap: old.slap || next.slap, play: old.play || next.play, pick: next.pick ?? old.pick };
}
