import type { Actions } from '../actions/actions';
import { WALK_SPEED, type WorldState } from './state';

/** Advance the world by dt seconds. Pure: returns a new state. */
export function step(world: WorldState, actions: Actions, dt: number): WorldState {
  let { x, z } = actions.move;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  const b = world.beaver;
  return {
    time: world.time + dt,
    beaver: {
      x: b.x + x * WALK_SPEED * dt,
      z: b.z + z * WALK_SPEED * dt,
      heading: len > 0 ? Math.atan2(x, z) : b.heading,
    },
  };
}
