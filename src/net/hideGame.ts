// Hide and seek between players (#664, docs/design/49_hide_and_seek_friends.md). Pure, so a test can check it without a socket or a
// valley. The host holds one game and steps it every tick. A player is 'host' or the id the host gave a guest. There is no score, no
// winner and no loser, and nothing in the waking game changes.

/** A hider is found within this many metres with nothing standing in the way (the dream's number). */
export const FIND_REACH = 7;
/** A hider is found within this many metres whatever stands in the way. */
export const FIND_CLOSE = 2;
/** The friends who said yes must be this close to the asker for the game to start. */
export const GATHER_REACH = 8;
/** A note goes to friends this close to the asker. */
export const NOTE_REACH = 60;
/** The invitation waits this many real seconds for the friends to walk over. */
export const INVITE_TIME = 30;
/** The seekers count to ten while the hiders run off. */
export const COUNT_TIME = 10;
/** The seeking lasts this many seconds at most. */
export const SEEK_TIME = 90;
/** The cheer after the round stays this many seconds. */
export const CHEER_TIME = 5;
/** A player that walks further than this from where the game started is out of it. */
export const PLAY_RADIUS = 80;

export type Role = 'hide' | 'seek';
export type Phase = 'invite' | 'count' | 'seek' | 'cheer';

export interface HideGame {
  phase: Phase;
  /** The player who asked, and the role they chose. */
  asker: string;
  role: Role;
  /** Where the asker stood when the note went out, which is where the game is played. */
  x: number;
  z: number;
  /** Friends asked, and those of them who said yes. */
  invited: readonly string[];
  yes: readonly string[];
  /** In the game, with their role, once the count starts. */
  roles: Readonly<Record<string, Role>>;
  /** Hiders that have been found. */
  found: readonly string[];
  /** When the phase began, in real seconds. */
  at: number;
}

/** Where a player stands. */
export interface Spot {
  id: string;
  x: number;
  z: number;
}

/** A thing a player can hide behind: a standing tree, a lodge, a rock. A felled tree is not one. */
export interface Blocker {
  x: number;
  z: number;
  r: number;
}

export type HideEvent = { t: 'found'; hider: string; seeker: string } | { t: 'start' } | { t: 'end' };

const dist = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z);

/** The friends a note reaches: those within NOTE_REACH of the asker. */
export const noteTo = (asker: Spot, others: readonly Spot[]): string[] => others.filter((o) => o.id !== asker.id && dist(asker, o) <= NOTE_REACH).map((o) => o.id);

/** `asker` asks `invited` to play and takes `role`; the first friend to say yes is the one who was asked, when only one is. */
export function invite(asker: Spot, role: Role, invited: readonly string[], now: number): HideGame | null {
  const list = invited.filter((id) => id !== asker.id);
  if (!list.length) return null;
  return { phase: 'invite', asker: asker.id, role, x: asker.x, z: asker.z, invited: list, yes: [], roles: {}, found: [], at: now };
}

/** A friend who was asked says yes. */
export function accept(g: HideGame, id: string): HideGame {
  return g.phase === 'invite' && g.invited.includes(id) && !g.yes.includes(id) ? { ...g, yes: [...g.yes, id] } : g;
}

/** A friend who was asked says not now. */
export function decline(g: HideGame, id: string): HideGame {
  return g.phase === 'invite' && g.invited.includes(id) ? { ...g, invited: g.invited.filter((k) => k !== id), yes: g.yes.filter((k) => k !== id) } : g;
}

/** True when nothing in `blockers` stands on the straight line between `a` and `b`. */
export function clearLine(a: { x: number; z: number }, b: { x: number; z: number }, blockers: readonly Blocker[]): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  for (const k of blockers) {
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((k.x - a.x) * dx + (k.z - a.z) * dz) / len2));
    if (Math.hypot(a.x + t * dx - k.x, a.z + t * dz - k.z) < k.r) return false;
  }
  return true;
}

const hidersOf = (g: HideGame): string[] => Object.keys(g.roles).filter((id) => g.roles[id] === 'hide');
const seekersOf = (g: HideGame): string[] => Object.keys(g.roles).filter((id) => g.roles[id] === 'seek');

const cheer = (g: HideGame, now: number): HideGame => ({ ...g, phase: 'cheer', at: now });

/**
 * One tick. `players` are everyone in the room now, `blockers` what stands near the game. Returns the game after the tick (null when
 * it is over) and what happened.
 */
export function step(g: HideGame, players: readonly Spot[], blockers: readonly Blocker[], now: number): { game: HideGame | null; events: HideEvent[] } {
  const events: HideEvent[] = [];
  const at = (id: string): Spot | undefined => players.find((p) => p.id === id);
  if (g.phase === 'invite') {
    const asker = at(g.asker);
    if (!asker) return { game: null, events };
    const here = g.yes.filter((id) => at(id));
    const near = here.filter((id) => dist(asker, at(id) as Spot) <= GATHER_REACH);
    const all = g.invited.length > 0 && near.length === g.invited.length;
    if (!all && now - g.at < INVITE_TIME) return { game: g, events };
    if (!near.length) return { game: null, events };
    const other: Role = g.role === 'hide' ? 'seek' : 'hide';
    const roles: Record<string, Role> = { [g.asker]: g.role };
    for (const id of near) roles[id] = other;
    events.push({ t: 'start' });
    return { game: { ...g, phase: 'count', x: asker.x, z: asker.z, roles, yes: near, at: now }, events };
  }
  if (g.phase === 'cheer') return now - g.at >= CHEER_TIME ? { game: null, events } : { game: g, events };

  // A player who left, or walked too far from where the game began, is out of it.
  const roles: Record<string, Role> = {};
  for (const id of Object.keys(g.roles)) {
    const p = at(id);
    if (p && dist(p, g) <= PLAY_RADIUS) roles[id] = g.roles[id] as Role;
  }
  let game: HideGame = Object.keys(roles).length === Object.keys(g.roles).length ? g : { ...g, roles, found: g.found.filter((id) => roles[id]) };
  const hiders = hidersOf(game);
  const seekers = seekersOf(game);
  if (!hiders.length || !seekers.length) {
    events.push({ t: 'end' });
    return { game: cheer(game, now), events };
  }
  if (game.phase === 'count') {
    if (now - game.at >= COUNT_TIME) game = { ...game, phase: 'seek', at: now };
    return { game, events };
  }
  // Seeking: a seeker finds a hider close by, or within reach with nothing in the way.
  const found = [...game.found];
  for (const h of hiders) {
    if (found.includes(h)) continue;
    const hp = at(h) as Spot;
    for (const s of seekers) {
      const sp = at(s) as Spot;
      const d = dist(sp, hp);
      if (d <= FIND_CLOSE || (d <= FIND_REACH && clearLine(sp, hp, blockers))) {
        found.push(h);
        events.push({ t: 'found', hider: h, seeker: s });
        break;
      }
    }
  }
  if (found.length !== game.found.length) game = { ...game, found };
  if (hiders.every((h) => found.includes(h)) || now - game.at >= SEEK_TIME) {
    events.push({ t: 'end' });
    return { game: cheer(game, now), events };
  }
  return { game, events };
}

/** A player leaves the room: the game goes on without them, or ends when it has no seeker or no hider left (the next step sees it). */
export function drop(g: HideGame, id: string): HideGame | null {
  if (g.phase === 'invite') {
    if (g.asker === id) return null;
    const invited = g.invited.filter((k) => k !== id);
    return invited.length ? { ...g, invited, yes: g.yes.filter((k) => k !== id) } : null;
  }
  const roles = { ...g.roles };
  delete roles[id];
  return { ...g, roles, found: g.found.filter((k) => k !== id) };
}

/** True while `id` has to stand still: a seeker counting to ten. */
export const frozen = (g: HideGame | null | undefined, id: string): boolean => !!g && g.phase === 'count' && g.roles[id] === 'seek';

/** The players `id` must not see: the hiders not yet found, for a seeker while the game runs. */
export function hiddenFrom(g: HideGame | null | undefined, id: string): string[] {
  if (!g || (g.phase !== 'count' && g.phase !== 'seek') || g.roles[id] !== 'seek') return [];
  return hidersOf(g).filter((h) => !g.found.includes(h));
}

/** Seconds left of the count or of the seeking, for the screen; 0 in the other phases. */
export function timeLeft(g: HideGame | null | undefined, now: number): number {
  if (!g) return 0;
  if (g.phase === 'count') return Math.max(0, COUNT_TIME - (now - g.at));
  if (g.phase === 'seek') return Math.max(0, SEEK_TIME - (now - g.at));
  return 0;
}
