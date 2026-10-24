// What a snapshot tells a player about a bed (#661): the question of a friend's bed, and a guest's own bed waiting for the host to
// settle it. Plain functions and a small tracker, so a test can check each case; main.ts only wires them to the sleep prompt.
import type { Goal } from './sleepCheck';
import type { Snapshot } from './protocol';

/** A friend's wish to skip the clock that this player is asked about, or null. A dream is not asked about. */
export function askedOf(snap: Pick<Snapshot, 'skip' | 'beavers'> | null | undefined, me: string): { name: string | null; goal: Exclude<Goal, 'dream'> } | null {
  const skip = snap?.skip;
  if (!skip || skip.goal === 'dream' || !skip.waiting.includes(me)) return null;
  return { name: snap?.beavers.find((b) => b.id === skip.from)?.look.name || null, goal: skip.goal };
}

/** How long a guest's bed may wait for the host to list it asleep before the guest gives up on it, in seconds. */
export const LYING_WAIT = 5;

/**
 * A guest's own bed waiting for the host: set when the guest sent its wish, until the host lists it asleep and then does not.
 * `settle` returns null while it waits, else whether the host ever listed the guest asleep (the sleep went through).
 */
export class GuestLying {
  private lying: { at: number; seen: boolean } | null = null;

  lie(now: number): void {
    this.lying = { at: now, seen: false };
  }

  clear(): void {
    this.lying = null;
  }

  settle(snap: Pick<Snapshot, 'asleep'> | null | undefined, me: string, now: number): { slept: boolean } | null {
    const l = this.lying;
    if (!l) return null;
    if (snap?.asleep?.includes(me)) {
      l.seen = true;
      return null;
    }
    if (snap && (l.seen || now - l.at > LYING_WAIT)) {
      this.lying = null;
      return { slept: l.seen };
    }
    return null;
  }
}
