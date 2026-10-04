import type { Actions } from '../actions/actions';
import type { Terrain } from './terrain';
import { SWIM_SPEED, WALK_SPEED, settle, type WorldState } from './state';

/** Advance the world by dt seconds. Pure: returns a new state. */
export function step(world: WorldState, actions: Actions, dt: number, terrain: Terrain): WorldState {
  let { x, z } = actions.move;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  const b = world.beaver;
  const speed = (b.mode === 'swim' ? SWIM_SPEED : WALK_SPEED) * world.speedMultiplier;
  const nx = b.x + x * speed * dt;
  const nz = b.z + z * speed * dt;
  return {
    ...world,
    time: world.time + dt,
    beaver: {
      x: nx,
      z: nz,
      ...settle(terrain, nx, nz, b.mode),
      heading: len > 0 ? Math.atan2(x, z) : b.heading,
    },
  };
}
