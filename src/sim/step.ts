import { LODGE_CLOCK_RATE } from './clock';
import type { Actions } from '../actions/actions';
import type { Terrain } from './terrain';
import { LODGE_REACH, addWood, lodgeComplete, lodgeSite, nearLodge } from './lodge';
import { DRAG_SPEED, GRAB_REACH, climbLift, dragged, fallenLog, logLength, nearestLog, pushFloating, type Log } from './logs';
import { BEAVER_RADIUS, MAX_TRUNK, CHOP_REACH, CHOP_TIME, avoidTrunks, noTrees, type TreeSource } from './trees';
import { BREATH_MIN_START, BREATH_REFILL_TIME, BREATH_TIME, DIVE_SPEED, SLAP_COOLDOWN, SWIM_SPEED, WALK_SPEED, settle, type BeaverState, type WorldState } from './state';

/** The longest stretch of a move, in metres, checked for bumps in one go. */
const SWEEP_STEP = 0.4;

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
  // The move is swept in short steps so a fast beaver cannot jump through a trunk or over a floating log. Trunks
  // stop the beaver, which slides round them, and it shoves floating logs out of its way.
  const total = { x: x * speed * dt, z: z * speed * dt };
  const n = Math.max(1, Math.ceil(Math.hypot(total.x, total.z) / SWEEP_STEP));
  const trunks = trees.trunksNear(b.x + total.x / 2, b.z + total.z / 2, Math.hypot(total.x, total.z) / 2 + 2 * BEAVER_RADIUS + MAX_TRUNK, new Set(world.felled));
  let p = { x: b.x, z: b.z };
  let pushed = world.logs;
  for (let i = 0; i < n; i++) {
    p = avoidTrunks(p.x + total.x / n, p.z + total.z / n, trunks);
    pushed = pushFloating(terrain, pushed, p.x, p.z, b.mode === 'dive', world.drag);
  }
  const { x: nx, z: nz } = p;
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
  // On land the beaver climbs over a log that lies in its way; in water it pushes floating ones aside.
  const lift = settled.mode === 'walk' ? climbLift(world.logs, nx, nz, world.drag) : 0;
  const after = { ...b, x: nx, z: nz, ...settled, y: settled.y + lift, breath, heading };
  const built = build({ ...world, logs: pushed }, after, actions, terrain);
  const { chop, felled, logs, drag } = work(built, after, actions, dt, len > 0, trees, terrain);
  return {
    ...world,
    time,
    chop,
    felled,
    logs,
    drag,
    lodge: built.lodge,
    inLodge: built.inLodge,
    clock: world.clock + dt * (world.inLodge ? LODGE_CLOCK_RATE : 1),
    lastSlap,
    beaver: after,
  };
}

/**
 * The build button, one action for what is at hand. Dragging a log: put it on the lodge, which starts a new one at
 * a spot in shallow water ahead of the beaver if there is none yet. Not dragging, near a whole lodge: go in or out.
 * Walking away from the lodge leaves it. A log that cannot be placed stays in the beaver's mouth.
 */
function build(world: WorldState, b: BeaverState, actions: Actions, terrain: Terrain): WorldState {
  let { lodge, logs, drag, inLodge } = world;
  if (inLodge && lodge && !nearLodge(lodge, b.x, b.z, LODGE_REACH + 1)) inLodge = false;
  if (actions.build && b.mode !== 'dive') {
    const log = drag ? logs.find((l) => l.id === drag) : undefined;
    if (log) {
      const target = lodge ?? lodgeSite(terrain, b.x, b.z, b.heading);
      if (target && !lodgeComplete(target) && nearLodge(target, b.x, b.z)) {
        lodge = addWood(target, log);
        logs = logs.filter((l) => l.id !== log.id);
        drag = null;
      }
    } else if (lodgeComplete(lodge) && nearLodge(lodge, b.x, b.z)) {
      inLodge = !inLodge;
    }
  }
  return { ...world, lodge, logs, drag, inLodge };
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
