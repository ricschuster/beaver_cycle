// What the player's beaver is doing, for its poses (#105). The sim keeps almost none of this as state: a build, a repair,
// or a meal happens in one step, so this watches the world from frame to frame and notices them. It reads the world and
// never changes it. Plain data, no three.js.
import type { Food } from '../sim/food';
import type { NeighbourTask } from '../sim/neighbours';
import type { WorldState } from '../sim/state';

/** Poses that last as long as the work does, and poses that play once. */
export type LoopKind = 'gnaw' | 'dig' | 'drag';
export type ShotKind = 'build' | 'eat' | 'pick' | 'groom';
export type ActionKind = LoopKind | ShotKind;

/** An action and its age in sim seconds. `food` is what is being eaten, which has left the mouth by then. */
export interface BeaverAction {
  kind: ActionKind;
  age: number;
  food?: Food | null;
}

/** Seconds each one-off pose plays. */
export const SHOT_SECONDS: Record<ShotKind, number> = { build: 1.1, eat: 2.4, pick: 0.6, groom: 3.2 };
/** Seconds of standing still, with nothing to do, before the beaver grooms, and the least time from one groom to the next. */
export const GROOM_AFTER = 8;
export const GROOM_EVERY = 30;

export type Watched = Pick<WorldState, 'time' | 'chop' | 'drag' | 'logs' | 'carry' | 'haul' | 'hauled' | 'eaten'>;

export interface ActionWatcher {
  /** The action to show now. `digging` is true while the player digs at a drift, `still` while the beaver stands. */
  next(world: Watched, digging: boolean, still: boolean): BeaverAction | null;
}

export function createActionWatcher(): ActionWatcher {
  let prev: Watched | null = null;
  let shot: { kind: ShotKind; at: number; food?: Food | null } | null = null;
  let loop: { kind: LoopKind; at: number } | null = null;
  let stillSince: number | null = null;
  let lastGroom = -Infinity;

  return {
    next(world, digging, still) {
      const t = world.time;
      const was = prev;
      prev = world;
      if (was && t >= was.time) {
        if (world.eaten > was.eaten) shot = { kind: 'eat', at: t, food: was.carry };
        else if ((was.drag && !world.drag && !world.logs.some((l) => l.id === was.drag)) || world.hauled > was.hauled) shot = { kind: 'build', at: t };
        else if (!was.carry && !was.haul && (world.carry || world.haul)) shot = { kind: 'pick', at: t };
      }
      if (shot && (t < shot.at || t - shot.at >= SHOT_SECONDS[shot.kind])) shot = null;
      // Grooming stops as soon as the beaver moves off.
      if (shot?.kind === 'groom' && !still) shot = null;

      const busy = digging || world.chop !== null || world.drag !== null;
      const idle = still && !busy && !world.carry && !world.haul && !shot;
      stillSince = idle ? stillSince ?? t : null;
      if (stillSince !== null && t - stillSince >= GROOM_AFTER && t - lastGroom >= GROOM_EVERY) {
        shot = { kind: 'groom', at: t };
        lastGroom = t;
      }
      if (shot) return { kind: shot.kind, age: t - shot.at, food: shot.food };

      const kind: LoopKind | null = digging ? 'dig' : world.chop ? 'gnaw' : world.drag ? 'drag' : null;
      if (!kind) {
        loop = null;
        return null;
      }
      if (loop?.kind !== kind) loop = { kind, at: t };
      return { kind, age: t - loop.at };
    },
  };
}

/** A number from a beaver's id, the same each time, to spread out the grooms of the beavers the player does not steer. */
export function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  return h;
}

/** Seconds from one start to the next of a pose a beaver at work repeats: the pose and a short pause. */
const REPEAT: Record<'build' | 'eat' | 'groom', number> = { build: SHOT_SECONDS.build + 0.5, eat: SHOT_SECONDS.eat + 0.8, groom: SHOT_SECONDS.groom + 1.5 };

/**
 * The pose for a task of a beaver on an errand (`routines.ts`): gnawing goes on, and patting, eating, and grooming repeat with
 * a pause between. The time and the seed say where in its own cycle each beaver is, so no memory is needed. Null for a task
 * with no pose of its own (swimming, carrying, resting, playing).
 */
export function taskAction(task: NeighbourTask | undefined, time: number, seed: number): BeaverAction | null {
  if (task === 'gnaw') return { kind: 'gnaw', age: time + seed };
  if (task !== 'build' && task !== 'eat' && task !== 'groom') return null;
  const every = REPEAT[task];
  const age = (((time + seed * 1.3) % every) + every) % every;
  return age < SHOT_SECONDS[task] ? { kind: task, age } : null;
}

/**
 * A groom now and then for a beaver the player does not steer (Mama, Papa, a partner), while it stands still. It needs no
 * memory: the time and the seed say where in its own cycle each beaver is, so they do not all groom together.
 */
export function idleGroom(time: number, still: boolean, seed: number): BeaverAction | null {
  if (!still) return null;
  const every = GROOM_EVERY + (seed % 13);
  const age = (((time + seed * 3.7) % every) + every) % every;
  return age < SHOT_SECONDS.groom ? { kind: 'groom', age } : null;
}
