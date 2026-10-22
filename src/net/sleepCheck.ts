// Sleeping together (#665, #661, docs/design/42_multiplayer.md and 51_dream_together.md). Pure, so a test can check it without a socket
// or a valley. The host holds one check. The clock is shared, so a sleeper cannot skip it alone: night passes when everybody else
// said yes or is asleep too (Q91), and one no stops it (Q92). A sleeper whose skip is stopped just wakes, and the clock stays.
// A dream counts as asleep, but it ends only when its dreamer wakes: a dreamer stays in the dream when its skip goes or is stopped.
// A player is 'host' or the id the host gave a guest.

/** Where a sleep ends: the dawn, the next season, or growing up. A `dream` has no skip of its own (a dream outside the night, from the test menu). */
export type Goal = 'night' | 'season' | 'grow' | 'dream';

/** The friends wait this many real seconds to be asked, and no answer in that time is a no. */
export const ASK_TIME = 30;

export interface Sleeper {
  id: string;
  goal: Goal;
  dreaming: boolean;
}

export interface Ask {
  /** The sleeper whose skip waits, and where it ends. */
  from: string;
  goal: Goal;
  /** The friends who were awake when it began, and those of them who said yes. */
  awake: readonly string[];
  yes: readonly string[];
  /** When it began, in real seconds. */
  at: number;
}

export interface SleepCheck {
  asleep: readonly Sleeper[];
  ask: Ask | null;
}

/** What the check decided: `go` moves the clock for all (the sleepers in `woke` are told, the plain ones wake), `stop` ends the skip of the asker. */
export type Verdict = { t: 'go'; goal: Goal; woke: readonly string[] } | { t: 'stop'; from: string };

export const noSleep = (): SleepCheck => ({ asleep: [], ask: null });

export const isAsleep = (c: SleepCheck, id: string): boolean => c.asleep.some((s) => s.id === id);

/** The friends the ask still waits for: awake, here, and not yet yes. */
export const waitingFor = (c: SleepCheck, players: readonly string[]): string[] =>
  c.ask ? c.ask.awake.filter((id) => players.includes(id) && !isAsleep(c, id) && !c.ask!.yes.includes(id)) : [];

export interface Step {
  check: SleepCheck;
  verdict: Verdict | null;
}

/** The asker of a stopped skip wakes, unless it dreams: a dream goes on until its dreamer wakes. */
const stopped = (c: SleepCheck, from: string): SleepCheck => ({ asleep: c.asleep.filter((s) => s.id !== from || s.dreaming), ask: null });

/** A sleeper that wants a skip with nobody else to ask goes at once; the others are asked. */
function settle(c: SleepCheck, players: readonly string[], now: number): Step {
  const ask = c.ask;
  if (!ask) return { check: c, verdict: null };
  if (!isAsleep(c, ask.from)) return { check: { ...c, ask: null }, verdict: null };
  if (now - ask.at >= ASK_TIME) return { check: stopped(c, ask.from), verdict: { t: 'stop', from: ask.from } };
  if (waitingFor(c, players).length) return { check: c, verdict: null };
  return { check: { asleep: c.asleep.filter((s) => s.dreaming), ask: null }, verdict: { t: 'go', goal: ask.goal, woke: c.asleep.map((s) => s.id) } };
}

/**
 * `id` lies down to sleep (or dream) until `goal`. `players` is everyone in the room now. With nobody awake to ask the skip goes at
 * once. A player who lies down while a skip waits for them is a yes.
 */
export function lie(c: SleepCheck, id: string, goal: Goal, dreaming: boolean, players: readonly string[], now: number): Step {
  if (!players.includes(id)) return { check: c, verdict: null };
  const asleep = [...c.asleep.filter((s) => s.id !== id), { id, goal, dreaming }];
  const next = { ...c, asleep };
  if (goal === 'dream') return { check: next, verdict: null };
  // A skip already waits for others: this player lying down is one of the yes, unless it is the asker lying down again.
  if (c.ask && c.ask.from !== id) return settle(next, players, now);
  const awake = players.filter((p) => !asleep.some((s) => s.id === p));
  return settle({ asleep, ask: { from: id, goal, awake, yes: [], at: now } }, players, now);
}

/** A friend answers the ask. A no stops it and wakes the asker; a yes from the last one makes it go. */
export function answer(c: SleepCheck, id: string, yes: boolean, players: readonly string[], now: number): Step {
  const ask = c.ask;
  if (!ask || !ask.awake.includes(id) || isAsleep(c, id)) return { check: c, verdict: null };
  if (!yes) return { check: stopped(c, ask.from), verdict: { t: 'stop', from: ask.from } };
  return settle({ ...c, ask: { ...ask, yes: ask.yes.includes(id) ? ask.yes : [...ask.yes, id] } }, players, now);
}

/** A sleeper wakes alone. When it was the asker, the ask ends. A friend who still waits to be asked is not told. */
export function wake(c: SleepCheck, id: string, players: readonly string[], now: number): Step {
  const asleep = c.asleep.filter((s) => s.id !== id);
  if (asleep.length === c.asleep.length) return { check: c, verdict: null };
  return settle({ asleep, ask: c.ask?.from === id ? null : c.ask }, players, now);
}

/** A player left the room: it no longer sleeps and nobody waits for it. */
export function leave(c: SleepCheck, id: string, players: readonly string[], now: number): Step {
  const rest = players.filter((p) => p !== id);
  return settle({ asleep: c.asleep.filter((s) => s.id !== id), ask: c.ask?.from === id ? null : c.ask }, rest, now);
}

/** One tick: a friend that left is not waited for, and an ask that waited too long is a no. */
export const tick = (c: SleepCheck, players: readonly string[], now: number): Step => settle(c, players, now);
