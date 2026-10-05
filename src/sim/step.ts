import type { Actions } from '../actions/actions';
import type { Terrain } from './terrain';
import { BREATH_MIN_START, BREATH_REFILL_TIME, BREATH_TIME, DIVE_SPEED, SLAP_COOLDOWN, SWIM_SPEED, WALK_SPEED, settle, type WorldState } from './state';

/** Advance the world by dt seconds. Pure: returns a new state. */
export function step(world: WorldState, actions: Actions, dt: number, terrain: Terrain): WorldState {
  let { x, z } = actions.move;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  const b = world.beaver;
  const speed = (b.mode === 'dive' ? DIVE_SPEED : b.mode === 'swim' ? SWIM_SPEED : WALK_SPEED) * world.speedMultiplier;
  const nx = b.x + x * speed * dt;
  const nz = b.z + z * speed * dt;
  const time = world.time + dt;
  // The tail slaps on land and at the surface, not under water, and not again during the cooldown.
  const canSlap = b.mode !== 'dive' && (!world.lastSlap || time - world.lastSlap.time >= SLAP_COOLDOWN);
  const lastSlap = actions.slap && canSlap ? { time, x: nx, z: nz } : world.lastSlap;
  // Out of breath, the beaver rises by itself and cannot dive until it has recovered a little. Nothing worse happens.
  const canDive = b.breath > 0 && (b.mode === 'dive' || b.breath >= BREATH_MIN_START);
  const settled = settle(terrain, nx, nz, b, actions.dive && canDive, dt);
  const breath =
    settled.mode === 'dive'
      ? Math.max(0, b.breath - dt / BREATH_TIME)
      : Math.min(1, b.breath + dt / BREATH_REFILL_TIME);
  return {
    ...world,
    time,
    lastSlap,
    beaver: {
      x: nx,
      z: nz,
      ...settled,
      breath,
      heading: len > 0 ? Math.atan2(x, z) : b.heading,
    },
  };
}
