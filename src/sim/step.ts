import { LODGE_CLOCK_RATE } from './clock';
import { noActions, type Actions } from '../actions/actions';
import type { Terrain } from './terrain';
import { atStore, storeCapacity, storeCondition, strippable, tapped, trimmed } from './food';
import { pickedPad, reachablePad } from './lily';
import { DOOR_DISTANCE, ENTER_DISTANCE, LODGE_WOOD, addWood, logWood, atDoor, atHole, clampInterior, doorPoint, holeSolid, lodgeComplete, lodgeCondition, checkSite, followPond, lodgeSolid, type Lodge, nearLodge, towardDoor } from './lodge';
import { damAt, placed, spotAt } from './dam';
import { refineNear, withNewSpots } from './newSpots';
import { lodgeGround, pondAt, pondsAt, withPonds, type Pond } from './pond';
import { canScoopMud, putDown, reachableDropped, reachableRock } from './haul';
import { DRAG_SPEED, GRAB_REACH, climbLift, dragged, fallenLog, logLength, nearestLog, pushFloating, type Log } from './logs';
import { BROKEN_BELOW, LODGE_WORN_DAYS, STORE_REBUILD_WOOD, STORE_WORN_DAYS, mended, newWear } from './wear';
import { BEAVER_RADIUS, MAX_TRUNK, CHOP_REACH, CHOP_TIME, avoidTrunks, noTrees, type TreeSource } from './trees';
import { BREATH_MIN_START, DIVE_FLOOR, BREATH_REFILL_TIME, BREATH_TIME, DIVE_SPEED, SLAP_COOLDOWN, SWIM_SPEED, WALK_SPEED, settle, type BeaverState, type WorldState } from './state';

/** The longest stretch of a move, in metres, checked for bumps in one go. */
const SWEEP_STEP = 0.4;

/**
 * Advance the world by dt seconds. Pure: returns a new state. While the stash screen is open the player's taps move
 * pieces between the mouth and the store's places and nothing else is done: the beaver stands still, though time goes on.
 */
export function step(world: WorldState, actions: Actions, dt: number, terrain: Terrain, trees: TreeSource = noTrees): WorldState {
  if (!world.stashOpen) return advance(world, actions, dt, terrain, trees);
  let { store, carry } = world;
  let stashOpen: boolean = world.stashOpen;
  if (actions.stashTap !== undefined) ({ stock: store, carry } = tapped(store, carry, actions.stashTap, storeCapacity(storeCondition(world.storeWear, world.clock))));
  if (actions.stashClose) stashOpen = false;
  return advance({ ...world, store, carry, stashOpen }, noActions(), dt, terrain, trees);
}

/** A lodge that could start ahead of the beaver, in the lake or in a pond that a level 2 dam holds; one in a pond is tagged with it. */
function newLodge(ground: Terrain, ponds: readonly Pond[], x: number, z: number, heading: number): Lodge | null {
  const site = checkSite(lodgeGround(ground, ponds), x, z, heading).lodge;
  if (!site || ground.waterDepth(site.x, site.z) > 0) return site;
  const pond = pondAt(ponds, site.x, site.z);
  return pond ? { ...site, pond: pond.spot } : site;
}

function advance(world: WorldState, actions: Actions, dt: number, ground: Terrain, trees: TreeSource): WorldState {
  // The ponds of the dams add water to the ground. Lily pads keep to the ground's own water (they come to ponds later).
  const terrain = withPonds(ground, world.ponds);
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
  // The lodge is solid from outside; inside it the beaver walks the round room, round the water hole, and meets no trees.
  const housed = world.inLodge && world.lodge !== null;
  const near = housed ? [] : trees.trunksNear(b.x + total.x / 2, b.z + total.z / 2, Math.hypot(total.x, total.z) / 2 + 2 * BEAVER_RADIUS + MAX_TRUNK, new Set(world.felled));
  const trunks = housed ? [holeSolid(world.lodge!)] : world.lodge ? [...near, lodgeSolid(world.lodge)] : near;
  let p = { x: b.x, z: b.z };
  let pushed = world.logs;
  for (let i = 0; i < n; i++) {
    p = avoidTrunks(p.x + total.x / n, p.z + total.z / n, trunks);
    pushed = pushFloating(terrain, pushed, p.x, p.z, b.mode === 'dive', world.drag);
  }
  if (housed) p = clampInterior(world.lodge!, p.x, p.z);
  const { x: nx, z: nz } = p;
  const time = world.time + dt;
  // The tail slaps on land and at the surface, not under water, and not again during the cooldown.
  const canSlap = b.mode !== 'dive' && (!world.lastSlap || time - world.lastSlap.time >= SLAP_COOLDOWN);
  const lastSlap = actions.slap && canSlap ? { time, x: nx, z: nz } : world.lastSlap;
  // Out of breath, the beaver rises by itself and cannot dive until it has recovered a little. Nothing worse happens.
  const canDive = b.breath > 0 && (b.mode === 'dive' || b.breath >= BREATH_MIN_START);
  const settled = housed ? { y: world.lodge!.base, mode: 'walk' as const } : settle(terrain, nx, nz, b, actions.dive && canDive, dt);
  const breath =
    settled.mode === 'dive'
      ? Math.max(0, b.breath - dt / BREATH_TIME)
      : Math.min(1, b.breath + dt / BREATH_REFILL_TIME);
  const heading = len > 0 ? Math.atan2(x, z) : b.heading;
  // On land the beaver climbs over a log that lies in its way; in water it pushes floating ones aside.
  const lift = settled.mode === 'walk' ? climbLift(world.logs, nx, nz, world.drag) : 0;
  const after = { ...b, x: nx, z: nz, ...settled, y: settled.y + lift, breath, heading };
  const { world: built, beaver } = build({ ...world, logs: pushed }, after, actions, { x, z }, terrain, ground);
  // With a piece in the mouth the beaver cannot grab a log, and in the lodge the gnaw button eats it instead.
  const eating = built.inLodge && world.carry !== null && !!actions.chop;
  // The same goes for mud or a rock in the mouth: it cannot gnaw a tree, and the grab button puts it down instead.
  const full = (world.carry !== null || world.haul !== null) && !world.drag;
  const workActions = { ...actions, chop: actions.chop && !eating && world.haul === null, grab: actions.grab && !full };
  const { chop, felled, logs, drag } = work(built, beaver, workActions, dt, len > 0, trees, terrain);
  const food = feed({ ...built, logs, drag, chop }, beaver, actions, eating, world.drag === null, terrain, ground);
  const prevPonds = { ponds: world.ponds, crests: world.pondCrests };
  const pondSet = pondsAt(prevPonds, built.dams, world.spots, ground, world.clock);
  // A pond that has just grown or sunk may open up new dam spots on the streams round it (design note 20).
  const found = pondSet === prevPonds ? world.spots : withNewSpots(world.spots, pondSet.ponds.filter((p) => prevPonds.crests[p.spot] !== p.crest), ground);
  const spots = refineNear(found, beaver.x, beaver.z, ground, built.dams);
  return {
    ...world,
    ...food,
    // A worn store loses the places it can no longer hold, and a broken one all of them: what was in them is gone (15_build_and_repair.md).
    store: trimmed(food.store, storeCapacity(storeCondition(built.storeWear, world.clock))),
    time,
    chop,
    felled,
    logs,
    drag,
    lodge: built.lodge ? followPond(built.lodge, pondSet.ponds, ground) : null,
    dams: built.dams,
    spots,
    ponds: pondSet.ponds,
    pondCrests: pondSet.crests,
    storeWear: built.storeWear,
    inLodge: built.inLodge,
    clock: world.clock + dt * (world.inLodge ? LODGE_CLOCK_RATE : 1),
    lastSlap,
    beaver,
  };
}

/**
 * The build button, one action for what is at hand. Dragging a log: put it on the lodge, which starts a new one at
 * a spot in shallow water ahead of the beaver if there is none yet. The lodge is solid, and its entrance is under
 * water: a diving beaver that swims at the entrance of a whole lodge goes in, into the round room. Inside, the
 * build button at the water hole dives out through the entrance. A log that cannot be placed stays in the
 * beaver's mouth.
 */
function build(world: WorldState, b: BeaverState, actions: Actions, move: { x: number; z: number }, terrain: Terrain, ground: Terrain): { world: WorldState; beaver: BeaverState } {
  let { lodge, logs, drag, inLodge, storeWear, dams, haul } = world;
  let beaver = b;
  if (inLodge && lodge) {
    if (actions.build && atHole(lodge, b.x, b.z)) {
      const out = doorPoint(lodge, DOOR_DISTANCE);
      inLodge = false;
      // Out of the hole the beaver is under water and rises by itself.
      beaver = { ...b, ...out, y: terrain.heightAt(out.x, out.z) + DIVE_FLOOR, mode: 'dive' };
    }
  } else if (lodgeComplete(lodge) && lodgeCondition(lodge, world.clock) >= BROKEN_BELOW && b.mode === 'dive' && atDoor(lodge, b.x, b.z) && towardDoor(lodge, move.x, move.z) < -0.3) {
    inLodge = true;
    beaver = { ...b, ...doorPoint(lodge, ENTER_DISTANCE), y: lodge.base, mode: 'walk' };
  } else if (actions.build && b.mode !== 'dive') {
    const log = drag ? logs.find((l) => l.id === drag) : undefined;
    const spot = spotAt(world.spots, b.x, b.z);
    if (spot && (haul || log)) {
      // At a dam spot the build button puts a log, mud, or a rock onto the dam: it builds a new one up to what it needs,
      // mends a worn one, and rebuilds a broken one. Anything it cannot use stays in the mouth.
      const add = log ? { wood: logWood(log) } : haul!.kind === 'mud' ? { mud: 1 } : { rock: 1 };
      const next = placed(dams, spot, add, undefined, world.clock);
      if (next !== dams) {
        dams = next;
        if (log) {
          logs = logs.filter((l) => l.id !== log.id);
          drag = null;
        } else {
          haul = null;
        }
        return { world: { ...world, lodge, logs, drag, inLodge, storeWear, dams, haul }, beaver };
      }
      if (haul) return { world: { ...world, lodge, logs, drag, inLodge, storeWear, dams, haul }, beaver };
    }
    const target = log ? lodge ?? newLodge(ground, world.ponds, b.x, b.z, b.heading) : null;
    if (log && target && !lodgeComplete(target) && nearLodge(target, b.x, b.z)) {
      lodge = addWood(target, log);
      // A whole lodge and its store are new from this moment.
      if (lodgeComplete(lodge)) {
        lodge = { ...lodge, wear: newWear(world.clock) };
        storeWear = newWear(world.clock);
      }
      logs = logs.filter((l) => l.id !== log.id);
      drag = null;
    } else if (log && lodgeComplete(lodge)) {
      // A whole lodge: the log mends whichever of the lodge and the store is in reach and in the worse state.
      const lodgeLevel = lodgeCondition(lodge, world.clock);
      const storeLevel = storeCondition(storeWear, world.clock);
      const wood = logWood(log);
      const mendLodge = nearLodge(lodge, b.x, b.z) && lodgeLevel < 1;
      const mendStore = atStore(lodge, b.x, b.z) && storeLevel < 1;
      if (mendLodge && (!mendStore || lodgeLevel <= storeLevel)) {
        lodge = { ...lodge, wear: mended(lodge.wear, world.clock, LODGE_WORN_DAYS, wood, LODGE_WOOD) };
      } else if (mendStore) {
        storeWear = mended(storeWear, world.clock, STORE_WORN_DAYS, wood, STORE_REBUILD_WOOD);
      }
      if (mendLodge || mendStore) {
        logs = logs.filter((l) => l.id !== log.id);
        drag = null;
      }
    }
  }
  return { world: { ...world, lodge, logs, drag, inLodge, storeWear, dams, haul }, beaver };
}

/**
 * The food. Gnawing next to a floating lily pad picks it into the mouth, and gnawing a log with no tree to gnaw
 * strips a branch into it. At the store the build button opens the stash screen (not on the frame it mends the store with
 * a log), where the player chooses what to put in or take out. Inside the lodge the gnaw button eats the piece.
 */
function feed(world: WorldState, b: BeaverState, actions: Actions, eating: boolean, wasFree: boolean, terrain: Terrain, ground: Terrain): Pick<WorldState, 'carry' | 'haul' | 'rocksTaken' | 'dropped' | 'store' | 'stashOpen' | 'stripped' | 'picked' | 'eaten'> {
  let { carry, haul, rocksTaken, dropped, store, stashOpen, stripped, picked, eaten } = world;
  if (eating) return { carry: null, haul, rocksTaken, dropped, store, stashOpen, stripped, picked, eaten: eaten + 1 };
  if (world.inLodge) return { carry, haul, rocksTaken, dropped, store, stashOpen, stripped, picked, eaten };
  if (haul && actions.grab) {
    // Put it down in front of the beaver. It lies there and can be picked up again.
    dropped = [...dropped, putDown(haul, b.x, b.z, b.heading, world.time)];
    haul = null;
  } else if (actions.build && wasFree && atStore(world.lodge, b.x, b.z) && !haul) {
    stashOpen = true;
  } else if (!carry && !haul && actions.chop && !world.chop && !world.drag && b.mode !== 'dive') {
    const pad = reachablePad(ground, b.x, b.z, world.clock, picked);
    const log = pad ? null : strippable(world.logs, stripped, b.x, b.z);
    if (pad) {
      picked = pickedPad(picked, pad, world.clock);
      carry = 'lily';
    } else if (log) {
      stripped = { ...stripped, [log.id]: (stripped[log.id] ?? 0) + 1 };
      carry = 'branch';
    } else if (b.mode === 'walk') {
      // Nothing to pick or strip: a piece put down, a rock in reach, or else mud from the wet ground at hand.
      const piece = reachableDropped(dropped, b.x, b.z);
      const rock = piece ? null : reachableRock(terrain, b.x, b.z, rocksTaken);
      if (piece) {
        dropped = dropped.filter((d) => d !== piece);
        haul = { kind: piece.kind };
      } else if (rock) {
        rocksTaken = [...rocksTaken, rock.id];
        haul = { kind: 'rock' };
      } else if (canScoopMud(terrain, b.x, b.z, b.heading)) {
        haul = { kind: 'mud' };
      }
    }
  }
  return { carry, haul, rocksTaken, dropped, store, stashOpen, stripped, picked, eaten };
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
