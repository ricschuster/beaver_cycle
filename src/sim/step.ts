import { LODGE_CLOCK_RATE } from './clock';
import type { Actions } from '../actions/actions';
import type { Terrain } from './terrain';
import { CARRY_MAX, CHOP_REACH, CHOP_TIME, noTrees, type TreeSource } from './trees';
import { BREATH_MIN_START, BREATH_REFILL_TIME, BREATH_TIME, DIVE_SPEED, SLAP_COOLDOWN, SWIM_SPEED, WALK_SPEED, settle, type WorldState } from './state';

/** Advance the world by dt seconds. Pure: returns a new state. */
export function step(world: WorldState, actions: Actions, dt: number, terrain: Terrain, trees: TreeSource = noTrees): WorldState {
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
  const { chop, felled, carry } = gnaw(world, actions, dt, len > 0, trees);
  return {
    ...world,
    time,
    chop,
    felled,
    carry,
    clock: world.clock + dt * (world.inLodge ? LODGE_CLOCK_RATE : 1),
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

/**
 * Gnawing: a press near a tree starts it, standing still for CHOP_TIME fells the tree and puts its logs in the
 * paws, up to what fits. Moving, swimming, or full paws stop it. Nothing is lost by stopping, the tree stands.
 */
function gnaw(world: WorldState, actions: Actions, dt: number, moving: boolean, trees: TreeSource) {
  const { beaver: b, felled, carry } = world;
  let chop = world.chop;
  if (chop && (moving || b.mode !== 'walk')) chop = null;
  if (!chop && actions.chop && !moving && b.mode === 'walk' && carry.wood < CARRY_MAX) {
    const t = trees.nearest(b.x, b.z, CHOP_REACH, new Set(felled));
    if (t) chop = { id: t.id, x: t.x, z: t.z, wood: t.wood, progress: 0 };
  } else if (chop) {
    chop = { ...chop, progress: chop.progress + dt };
  }
  if (!chop || chop.progress < CHOP_TIME) return { chop, felled, carry };
  return { chop: null, felled: [...felled, chop.id], carry: { wood: Math.min(CARRY_MAX, carry.wood + chop.wood) } };
}
