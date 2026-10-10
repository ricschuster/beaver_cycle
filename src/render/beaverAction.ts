// What the player's beaver is doing, for its poses (#105). The sim keeps almost none of this as state: a build, a repair,
// or a meal happens in one step, so this watches the world from frame to frame and notices them. It reads the world and
// never changes it. Plain data, no three.js.
import type { Food } from '../sim/food';
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
