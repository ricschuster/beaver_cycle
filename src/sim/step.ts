import type { Actions } from '../actions/actions';
import type { Terrain } from './terrain';
import { WALK_SPEED, type WorldState } from './state';

/** Advance the world by dt seconds. Pure: returns a new state. */
export function step(world: WorldState, actions: Actions, dt: number, terrain: Terrain): WorldState {
  let { x, z } = actions.move;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  const b = world.beaver;
  const nx = b.x + x * WALK_SPEED * dt;
  const nz = b.z + z * WALK_SPEED * dt;
  return {
    time: world.time + dt,
    beaver: {
      x: nx,
      y: terrain.heightAt(nx, nz),
      z: nz,
      heading: len > 0 ? Math.atan2(x, z) : b.heading,
    },
  };
}
