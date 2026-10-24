// Guest beavers: the beavers of friends who joined this world (docs/design/42_multiplayer.md, ADR 0014, #678). The host runs
// them. A guest sends the plain Intent, the host steps the guest here on the host's ground, trees, and logs, and sends state back.
// A guest here walks, swims, dives, and gnaws trees; the rest of what a beaver does (carrying, building, a lodge of its own) comes
// piece by piece later. Every guest is a grown beaver at its own speed. No three.js and no DOM.
import { cleanLook, DEFAULT_LOOK, type Look } from './look';
import { kitCoat, type Coat } from './family';
import { STAGE_RULES, softEdge, stageAt, type Stage } from './life';
import { type Lodge, DOOR_DISTANCE, ENTER_DISTANCE, NEST_SPOTS, atDoor, atHole, clampInterior, doorPoint, holeSolid, lodgeComplete, lodgeCondition, towardDoor } from './lodge';
import { BROKEN_BELOW } from './wear';
import { placed, spotAt, type Dam } from './dam';
import type { DamSpot } from './damSpots';
import { pickedPad, reachablePad, type Picked } from './lily';
import { strippable, type Food } from './food';
import { canScoopMud, putDown, reachableDropped, reachableRock, type Dropped, type Haul } from './haul';
import { DRAG_SPEED, GRAB_REACH, dragged, fallenLog, logLength, nearestLog, type Log } from './logs';
import { logWood } from './lodge';
import { settle, DIVE_FLOOR, DIVE_MIN_DEPTH, SWIM_EXIT_DEPTH, BREATH_MIN_START, BREATH_REFILL_TIME, BREATH_TIME, DIVE_SPEED, SWIM_SPEED, WALK_SPEED, type BeaverState } from './state';
import { BEAVER_RADIUS, CHOP_REACH, CHOP_TIME, MAX_TRUNK, avoidTrunks, type TreeSource } from './trees';
import type { Intent } from './buttons';
import type { Terrain } from './terrain';
import { KIT_NEST, pairLodgeOf, placeLog, type PairLodge } from './pairLodge';
import type { Pond } from './pond';

export interface Guest {
  /** The id the host gave the connection. */
  id: string;
  coat: Coat;
  look: Look;
  beaver: BeaverState;
  /** The tree being gnawed and the seconds done, or null. */
  chop: { id: string; x: number; z: number; wood: number; progress: number } | null;
  /** Mud or a rock in the mouth. */
  haul: Haul | null;
  /** Food in the mouth, picked up where a friend put it down or handed over (#663). */
  carry: Food | null;
  /** The id of the log being dragged, or null. */
  drag: string | null;
  /** 0 standing, 1 on the move, for the legs. */
  pace: number;
  /** True while the guest is in the pair lodge it belongs to (#666): the round room, no trees, the way out through the water hole. */
  inside: boolean;
  /** The coats of its parents, the two old beavers, once it is a kit. */
  parents: [Coat, Coat] | null;
  /** The clock the guest was born at, once it is a kit of a pair lodge (note 48); null for a guest that has always been grown. */
  bornAt: number | null;
  /** The lodge of the starting family the guest lives in, once it has taken one (note 42); null when it stands by the host or has grown up. */
  homeLodge: Lodge | null;
}

/** The life stage of a guest: a grown beaver unless it was born as a kit. */
export const guestStage = (g: Pick<Guest, 'bornAt'>, clock: number): Stage => (g.bornAt === null ? 'adult' : stageAt(clock, g.bornAt));

/** What a guest's step may change in the shared world. */
export interface Shared {
  felled: readonly string[];
  logs: readonly Log[];
  clock: number;
  dams: readonly Dam[];
  spots: readonly DamSpot[];
  rocksTaken: readonly string[];
  dropped: readonly Dropped[];
  /** The bare ground, where lily pads grow (`terrain` has the ponds' water). */
  ground: Terrain;
  /** The pads picked and the branches stripped so far, as in the world. */
  picked: Picked;
  stripped: Readonly<Record<string, number>>;
  /** The lodges pairs build together, the ponds, and this guest's partner (an id) or null (#666). */
  pairLodges: readonly PairLodge[];
  ponds: readonly Pond[];
  partner: string | null;
}

/** The longest stretch of a move checked for bumps in one go (as in `step.ts`). */
const SWEEP_STEP = 0.4;

/** A guest in the round room of its lodge: it walks round the water hole, and a press of Dive at the hole takes it out through the entrance (as the host's does, `step.ts`). */
function inRoom(guest: Guest, home: Lodge, intent: Intent, dt: number, share: number, terrain: Terrain): Guest {
  const b = guest.beaver;
  let { x, z } = intent.move;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  const total = { x: x * share * WALK_SPEED * dt, z: z * share * WALK_SPEED * dt };
  const n = Math.max(1, Math.ceil(Math.hypot(total.x, total.z) / SWEEP_STEP));
  let p = { x: b.x, z: b.z };
  for (let i = 0; i < n; i++) p = avoidTrunks(p.x + total.x / n, p.z + total.z / n, [holeSolid(home)]);
  p = clampInterior(home, p.x, p.z);
  const inRoomAt: BeaverState = { x: p.x, z: p.z, y: home.base, mode: 'walk', heading: len > 0 ? Math.atan2(x, z) : b.heading, breath: 1 };
  if (intent.diveTap && atHole(home, b.x, b.z)) {
    // Out of the hole it is under water and rises by itself; when the pond is too low to dive in, it walks out over the mud.
    const out = doorPoint(home, DOOR_DISTANCE);
    const beaver: BeaverState = terrain.waterDepth(out.x, out.z) < DIVE_MIN_DEPTH
      ? { ...inRoomAt, ...out, y: terrain.heightAt(out.x, out.z) }
      : { ...inRoomAt, ...out, y: terrain.heightAt(out.x, out.z) + DIVE_FLOOR, mode: 'dive' };
    return { ...guest, beaver, inside: false, pace: 0 };
  }
  return { ...guest, beaver: inRoomAt, pace: len > 0 ? 1 : 0 };
}

/** A guest at a place, standing still. */
export function newGuest(id: string, at: { x: number; z: number }, terrain: Terrain, coat: Coat, look: Partial<Look> | undefined): Guest {
  const { y, mode } = settle(terrain, at.x, at.z, { mode: 'walk', y: 0 });
  return { id, coat, look: cleanLook(look) ?? DEFAULT_LOOK, beaver: { x: at.x, y, z: at.z, mode, heading: 0, breath: 1 }, chop: null, haul: null, carry: null, drag: null, pace: 0, inside: false, parents: null, bornAt: null, homeLodge: null };
}

/**
 * The guest at home in the lodge of a starting family (note 42): on its nest in the round room, born when the host was, so it is as
 * old as the host and grows up with the clock. Mama and Papa of the family are its parents.
 */
export function housed(guest: Guest, lodge: Lodge, bornAt: number | null, parents: [Coat, Coat] | null): Guest {
  const nest = NEST_SPOTS[KIT_NEST.guest]!;
  return { ...guest, homeLodge: lodge, bornAt, parents, inside: true, beaver: { x: lodge.x + nest.x, z: lodge.z + nest.z, y: lodge.base, mode: 'walk', heading: 0, breath: 1 } };
}

/** The lodge whose round room a guest is in or may go into: the one it and its partner built, else its family's. */
export const roomOf = (guest: Pick<Guest, 'id' | 'homeLodge'>, pairLodges: readonly PairLodge[]): Lodge | null => pairLodgeOf(pairLodges, guest.id) ?? guest.homeLodge;

/**
 * The guest as a kit of the pair lodge it and its partner built (note 48): born on its own nest in the room, small, in a coat of one
 * of its parents' in a shade of its own. The two old beavers are Mama and Papa of both kits.
 */
export function reborn(guest: Guest, lodge: PairLodge, partner: Coat, clock: number): Guest {
  const nest = NEST_SPOTS[KIT_NEST.guest]!;
  return { ...guest, bornAt: clock, parents: [guest.coat, partner], coat: kitCoat([guest.coat, partner], clock + 1), inside: true, chop: null, haul: null, carry: null, drag: null, pace: 0, beaver: { x: lodge.x + nest.x, z: lodge.z + nest.z, y: lodge.base, mode: 'walk', heading: 0, breath: 1 } };
}

/** The guest put outside the lodge it lived in, at its entrance, as when the pair stops or the room is closed. */
export function outside(guest: Guest, lodge: Lodge, terrain: Terrain): Guest {
  const at = doorPoint(lodge, DOOR_DISTANCE);
  const { y, mode } = settle(terrain, at.x, at.z, { mode: 'walk', y: 0 });
  return { ...guest, inside: false, beaver: { ...guest.beaver, x: at.x, z: at.z, y, mode } };
}

/**
 * One guest advanced by `dt` seconds on the host's ground. Returns the guest and the shared things its step changed: a tree it
 * gnawed through is felled for everyone and lies as a log. `solids` are the lodges and other things a beaver cannot walk through.
 */
export function stepGuest(guest: Guest, intent: Intent, dt: number, shared: Shared, terrain: Terrain, trees: TreeSource, solids: readonly { x: number; z: number; radius: number }[] = []): { guest: Guest; felled: readonly string[]; logs: readonly Log[]; dams: readonly Dam[]; rocksTaken: readonly string[]; dropped: readonly Dropped[]; picked: Picked; stripped: Readonly<Record<string, number>>; pairLodges: readonly PairLodge[] } {
  const b = guest.beaver;
  const rules = STAGE_RULES[guestStage(guest, shared.clock)];
  const pairHome = pairLodgeOf(shared.pairLodges, guest.id);
  const home = pairHome ?? guest.homeLodge;
  if (guest.inside && home && lodgeComplete(home)) {
    return { guest: inRoom(guest, home, intent, dt, rules.speed, terrain), felled: shared.felled, logs: shared.logs, dams: shared.dams, rocksTaken: shared.rocksTaken, dropped: shared.dropped, picked: shared.picked, stripped: shared.stripped, pairLodges: shared.pairLodges };
  }
  // A kit does not fell, build, or take, as the host's does not (`step.ts`).
  if (!rules.works) intent = { ...intent, do: null, take: null };
  let { x, z } = intent.move;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  const speed = rules.speed * (b.mode === 'dive' ? DIVE_SPEED : b.mode === 'swim' ? SWIM_SPEED : WALK_SPEED) * (guest.drag ? DRAG_SPEED : 1);
  const total = { x: x * speed * dt, z: z * speed * dt };
  const n = Math.max(1, Math.ceil(Math.hypot(total.x, total.z) / SWEEP_STEP));
  const near = trees.trunksNear(b.x + total.x / 2, b.z + total.z / 2, Math.hypot(total.x, total.z) / 2 + 2 * BEAVER_RADIUS + MAX_TRUNK, new Set(shared.felled));
  const trunks = [...near, ...solids];
  let p = { x: b.x, z: b.z };
  for (let i = 0; i < n; i++) p = avoidTrunks(p.x + total.x / n, p.z + total.z / n, trunks);
  // A kit stays near its lodge, and in the water, as the host's does (`step.ts`).
  if (home && guest.bornAt !== null && Number.isFinite(rules.range)) {
    const d = Math.hypot(p.x - home.x, p.z - home.z);
    const kept = softEdge(Math.hypot(b.x - home.x, b.z - home.z), d, rules.range);
    if (kept < d) p = { x: home.x + ((p.x - home.x) / d) * kept, z: home.z + ((p.z - home.z) / d) * kept };
  }
  if (rules.waterOnly && b.mode !== 'walk') {
    const wet = (q: { x: number; z: number }): boolean => terrain.waterDepth(q.x, q.z) >= SWIM_EXIT_DEPTH;
    if (!wet(p)) p = [{ x: p.x, z: b.z }, { x: b.x, z: p.z }].find(wet) ?? { x: b.x, z: b.z };
  }
  const canDive = b.breath > 0 && (b.mode === 'dive' || b.breath >= BREATH_MIN_START);
  const settled = settle(terrain, p.x, p.z, b, !!intent.dive && canDive, dt);
  const breath = settled.mode === 'dive' ? Math.max(0, b.breath - dt / BREATH_TIME) : Math.min(1, b.breath + dt / BREATH_REFILL_TIME);
  const beaver: BeaverState = { x: p.x, z: p.z, ...settled, heading: len > 0 ? Math.atan2(x, z) : b.heading, breath };
  // Take and Do, as for the host's beaver (`step.ts`): a log is dragged, mud or a rock is carried, and at a dam spot Do puts it on.
  let { haul, carry, drag } = guest;
  let { dams, rocksTaken, dropped, picked, stripped } = shared;
  let logs = shared.logs;
  let pairLodges = shared.pairLodges;
  if (drag && (beaver.mode === 'dive' || !logs.some((l) => l.id === drag))) drag = null;
  let chop = guest.chop;
  const take = intent.take;
  if (take === 'let-go') drag = null;
  else if (take === 'drop' && (haul || carry)) {
    dropped = [...dropped, putDown(haul ?? { kind: carry! }, beaver.x, beaver.z, beaver.heading, shared.clock, shared.clock)];
    haul = null;
    carry = null;
  } else if ((take || intent.do === 'strip') && !drag && !haul && !carry && beaver.mode !== 'dive') {
    // Take a pad off the water, or Do by a log strips a branch off it, as for the host (`step.ts`).
    const pad = take === 'pad' ? reachablePad(shared.ground, beaver.x, beaver.z, shared.clock, picked) : null;
    const strip = intent.do === 'strip' ? strippable(logs, stripped, beaver.x, beaver.z) : null;
    if (pad) {
      picked = pickedPad(picked, pad, shared.clock);
      carry = 'lily';
    } else if (strip) {
      stripped = { ...stripped, [strip.id]: (stripped[strip.id] ?? 0) + 1 };
      carry = 'branch';
    } else if (take === 'log') {
      const log = nearestLog(logs, beaver.x, beaver.z, GRAB_REACH);
      if (log) {
        drag = log.id;
        chop = null;
      }
    } else if (beaver.mode === 'walk') {
      const lying = take === 'item' ? reachableDropped(dropped, beaver.x, beaver.z) : null;
      const rock = take === 'rock' ? reachableRock(terrain, beaver.x, beaver.z, rocksTaken) : null;
      if (lying && (lying.kind === 'mud' || lying.kind === 'rock')) {
        dropped = dropped.filter((d) => d !== lying);
        haul = { kind: lying.kind };
      } else if (lying) {
        dropped = dropped.filter((d) => d !== lying);
        carry = lying.kind as Food;
      } else if (rock) {
        rocksTaken = [...rocksTaken, rock.id];
        haul = { kind: 'rock' };
      } else if (take === 'mud' && canScoopMud(terrain, beaver.x, beaver.z, beaver.heading)) haul = { kind: 'mud' };
    }
  }
  if (drag) logs = logs.map((l) => (l.id === drag ? dragged(terrain, l, beaver.x, beaver.z, beaver.heading, dt) : l));
  if ((intent.do === 'build' || intent.do === 'mend') && beaver.mode !== 'dive') {
    const log = drag ? logs.find((l) => l.id === drag) : undefined;
    const spot = spotAt(shared.spots, beaver.x, beaver.z);
    let onDam = false;
    if (spot && (haul || log)) {
      const add = log ? { wood: logWood(log) } : haul!.kind === 'mud' ? { mud: 1 } : { rock: 1 };
      const next = placed(dams, spot, add, undefined, shared.clock);
      if (next !== dams) {
        onDam = true;
        dams = next;
        if (log) {
          logs = logs.filter((l) => l.id !== log.id);
          drag = null;
        } else haul = null;
      }
    }
    const players = pairHome?.players ?? (shared.partner ? ([guest.id, shared.partner] as [string, string]) : null);
    if (!onDam && log && players) {
      // Paired, or a kit of the lodge the two built together: a log goes on it (#666).
      const r = placeLog(pairLodges, players, { x: beaver.x, z: beaver.z, heading: beaver.heading }, log, shared.ground, shared.ponds, shared.clock);
      if (r.used) {
        pairLodges = r.lodges;
        logs = logs.filter((l) => l.id !== log.id);
        drag = null;
      }
    }
  }
  // Gnawing needs standing still on land with the mouth empty; moving stops it. At CHOP_TIME seconds the tree is down and lies as a log.
  if (chop && (len > 0 || beaver.mode !== 'walk' || drag || haul || carry)) chop = null;
  if (!chop && intent.do === 'gnaw' && len === 0 && beaver.mode === 'walk' && !drag && !haul && !carry) {
    const t = trees.nearest(beaver.x, beaver.z, CHOP_REACH, new Set(shared.felled));
    if (t) chop = { id: t.id, x: t.x, z: t.z, wood: t.wood, progress: 0 };
  } else if (chop) chop = { ...chop, progress: chop.progress + dt };
  let felled = shared.felled;
  if (chop && chop.progress >= CHOP_TIME) {
    const fell = Math.atan2(chop.x - beaver.x, chop.z - beaver.z);
    logs = [...logs, fallenLog(terrain, chop.id, chop.x, chop.z, fell, logLength(chop.wood), shared.clock)];
    felled = [...felled, chop.id];
    chop = null;
  }
  // A diving beaver, or one on the mud, at the door of its whole lodge that swims toward it goes in, as the host's does.
  let inside = false;
  let housed = beaver;
  if (home && lodgeComplete(home) && lodgeCondition(home, shared.clock) >= BROKEN_BELOW && (b.mode === 'dive' || terrain.waterDepth(b.x, b.z) < DIVE_MIN_DEPTH) && atDoor(home, b.x, b.z) && towardDoor(home, x, z) < -0.3) {
    inside = true;
    housed = { ...beaver, ...doorPoint(home, ENTER_DISTANCE), y: home.base, mode: 'walk' };
    chop = null;
    haul = null;
    drag = null;
  }
  return { guest: { ...guest, beaver: housed, chop, haul, carry, drag, pace: len > 0 ? 1 : 0, inside }, felled, logs, dams, rocksTaken, dropped, picked, stripped, pairLodges };
}
