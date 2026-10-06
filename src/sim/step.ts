import { LODGE_CLOCK_RATE } from './clock';
import type { Actions } from '../actions/actions';
import type { Terrain } from './terrain';
import { DRAG_SPEED, GRAB_REACH, dragged, fallenLog, logLength, nearestLog, type Log } from './logs';
import { CHOP_REACH, CHOP_TIME, noTrees, type TreeSource } from './trees';
import { BREATH_MIN_START, BREATH_REFILL_TIME, BREATH_TIME, DIVE_SPEED, SLAP_COOLDOWN, SWIM_SPEED, WALK_SPEED, settle, type BeaverState, type WorldState } from './state';

/** Advance the world by dt seconds. Pure: returns a new state. */
export function step(world: WorldState, actions: Actions, dt: number, terrain: Terrain, trees: TreeSource = noTrees): WorldState {
  let { x, z } = actions.move;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  const b = world.beaver;
  const speed = (b.mode === 'dive' ? DIVE_SPEED : b.mode === 'swim' ? SWIM_SPEED : WALK_SPEED) * world.speedMultiplier * (world.drag ? DRAG_SPEED : 1);
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
  const heading = len > 0 ? Math.atan2(x, z) : b.heading;
  const after = { ...b, x: nx, z: nz, ...settled, breath, heading };
  const { chop, felled, logs, drag } = work(world, after, actions, dt, len > 0, trees, terrain);
  return {
    ...world,
    time,
    chop,
    felled,
    logs,
    drag,
    clock: world.clock + dt * (world.inLodge ? LODGE_CLOCK_RATE : 1),
    lastSlap,
    beaver: after,
  };
}

/**
 * The beaver's work with trees and logs. Gnawing: a press near a tree starts it, standing still for CHOP_TIME
 * fells the tree and it falls away from the beaver as a log. Moving, swimming, or dragging stop it. Nothing is
 * lost by stopping, the tree stands. Dragging: a press takes the end of a log in reach, one at a time, and
 * another press (or diving) lets go. A log lies where it is left, and floats where the water is deep.
 */
function work(world: WorldState, b: BeaverState, actions: Actions, dt: number, moving: boolean, trees: TreeSource, terrain: Terrain) {
  const { felled } = world;
  let { chop, logs, drag } = world;
  if (drag && b.mode === 'dive') drag = null;
  if (actions.grab) {
    if (drag) drag = null;
    else if (b.mode !== 'dive') {
      const log = nearestLog(logs, b.x, b.z, GRAB_REACH);
      if (log) {
        drag = log.id;
        chop = null;
      }
    }
  }
  if (drag) {
    logs = logs.map((l) => (l.id === drag ? dragged(terrain, l, b.x, b.z, b.heading, dt) : l));
    return { chop: null, felled, logs, drag };
  }
  if (chop && (moving || b.mode !== 'walk')) chop = null;
  if (!chop && actions.chop && !moving && b.mode === 'walk') {
    const t = trees.nearest(b.x, b.z, CHOP_REACH, new Set(felled));
    if (t) chop = { id: t.id, x: t.x, z: t.z, wood: t.wood, progress: 0 };
  } else if (chop) {
    chop = { ...chop, progress: chop.progress + dt };
  }
  if (!chop || chop.progress < CHOP_TIME) return { chop, felled, logs, drag };
  const fell = Math.atan2(chop.x - b.x, chop.z - b.z);
  const log: Log = fallenLog(terrain, chop.id, chop.x, chop.z, fell, logLength(chop.wood));
  return { chop: null, felled: [...felled, chop.id], logs: [...logs, log], drag };
}
