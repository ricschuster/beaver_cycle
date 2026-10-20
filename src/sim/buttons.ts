// The beaver's buttons (#341, docs/design/30_buttons.md): Take picks up or puts down, and Do does the thing at hand. What
// each one means is worked out here from the world as it is, so the button's label and what a press does never differ.
// The frame loop reads these for the labels and hands the word to `step` on a press.

import { text, tree } from '../i18n';
import { atStore, storeCondition, strippable } from './food';
import { reachablePad } from './lily';
import { checkSite, lodgeComplete, lodgeCondition, logWood, nearLodge, type Lodge } from './lodge';
import { damAt, damMendUnits, placed, raised, spotAt } from './dam';
import { lodgeGround, pondAt, type Pond } from './pond';
import { STAGE_RULES, stageAt } from './life';
import { canMark } from './scent';
import { canScoopMud, reachableDropped, reachableRock } from './haul';
import { GRAB_REACH, nearestLog, type Log } from './logs';
import { CHOP_REACH, type TreeSource } from './trees';
import type { Terrain } from './terrain';
import type { WorldState } from './state';

/** What Do does: eat, build or mend with what is carried, hand food to a beaver with an empty mouth, pat a scent mound with mud by the lodge, open the store, dig out a stuck beaver, talk, fell a tree, or strip a branch off a log. */
export type DoKind = 'eat' | 'build' | 'mend' | 'store' | 'dig' | 'give' | 'talk' | 'gnaw' | 'strip' | 'mark';
/** What Take does: let go of the log, put down what is in the mouth, or pick up something put down, a log, a lily pad, a rock, or mud. */
export type TakeKind = 'let-go' | 'drop' | 'item' | 'log' | 'pad' | 'rock' | 'mud';

/** The word on each button. A greyed out Do reads "Do". */
export const DO_LABEL = tree<Record<DoKind, string>>('btn');
export const takeLabel = (t: TakeKind | null): string => (t === 'let-go' || t === 'drop' ? text('btn.drop') : text('btn.take'));

/** What the player does this frame, for `step`: the move, the held dive, and the word each pressed button stands for. */
export interface Intent {
  /** Desired movement on the ground plane, each axis in -1..1, already turned to the view. */
  move: { x: number; z: number };
  /** Held to go under water. */
  dive?: boolean;
  /** True on the frame Dive goes down: at the water hole in the lodge it dives out. */
  diveTap?: boolean;
  /** True on the frame of a tail slap. */
  slap?: boolean;
  /** What a press of Do does this frame, or null when it was not pressed (or does nothing here). */
  do?: DoKind | null;
  /** What a press of Take does this frame, or null. */
  take?: TakeKind | null;
  /** The place of the stash screen tapped this frame (0 to 39). */
  stashTap?: number;
  /** True on the frame the stash screen closes. */
  stashClose?: boolean;
}

export const noIntent = (): Intent => ({ move: { x: 0, z: 0 } });

/** What is near the beaver that `step` does not know about: someone to talk to, and a drift with a beaver stuck in it. */
export interface Around {
  speaker: boolean;
  /** The nearest speaker is a partner who follows the player, who is always close, so Talk would hide Gnaw at every tree. */
  following?: boolean;
  drift: boolean;
  /** A beaver of a family with an empty mouth is close enough to be handed food (`takerNear`). */
  taker?: boolean;
}

/** A lodge that could start ahead of the beaver, in the lake or in a pond that a level 2 dam holds; one in a pond is tagged with it. */
export function newLodge(ground: Terrain, ponds: readonly Pond[], x: number, z: number, heading: number): Lodge | null {
  const site = checkSite(lodgeGround(ground, ponds), x, z, heading).lodge;
  if (!site || ground.waterDepth(site.x, site.z) > 0) return site;
  const pond = pondAt(ponds, site.x, site.z);
  return pond ? { ...site, pond: pond.spot } : site;
}

const works = (world: WorldState): boolean => STAGE_RULES[stageAt(world.clock, world.bornAt)].works;

/**
 * What a press of Take does here. `terrain` has the ponds' water, `ground` is the bare ground (lily pads keep to it).
 * Dragging, it lets go; with something in the mouth, it puts it down; else it takes the first in reach of: a piece put
 * down earlier, a log, a lily pad, a rock, mud. Nothing under water, in the lodge, or for a baby.
 */
export function takeHere(world: WorldState, terrain: Terrain, ground: Terrain): TakeKind | null {
  const b = world.beaver;
  if (world.inLodge || !works(world)) return null;
  if (world.drag) return 'let-go';
  if (world.carry || world.haul) return 'drop';
  if (b.mode === 'dive') return null;
  if (b.mode === 'walk' && reachableDropped(world.dropped, b.x, b.z)) return 'item';
  if (nearestLog(world.logs, b.x, b.z, GRAB_REACH)) return 'log';
  if (reachablePad(ground, b.x, b.z, world.clock, world.picked)) return 'pad';
  if (b.mode === 'walk' && reachableRock(terrain, b.x, b.z, world.rocksTaken)) return 'rock';
  if (b.mode === 'walk' && canScoopMud(terrain, b.x, b.z, b.heading)) return 'mud';
  return null;
}

/**
 * What the dragged log, or the mud or rock in the mouth, would go into here: a dam at this spot (build, or mend a worn
 * one), the lodge (build, a new one starts on a good spot ahead), or a worn lodge or store (mend). Null when it fits nowhere.
 */
export function placeHere(world: WorldState, ground: Terrain, log: Log | undefined): 'build' | 'mend' | null {
  const b = world.beaver;
  const spot = spotAt(world.spots, b.x, b.z);
  if (spot && (log || world.haul)) {
    const add = log ? { wood: logWood(log) } : world.haul!.kind === 'mud' ? { mud: 1 } : { rock: 1 };
    if (placed(world.dams, spot, add, undefined, world.clock) !== world.dams) {
      // A good whole dam that can go up a level is raised by the press, not mended, even when it has worn a little.
      const dam = damAt(world.dams, spot);
      return raised(dam, spot, world.clock) === undefined && damMendUnits(dam, world.clock) > 0 ? 'mend' : 'build';
    }
  }
  if (!log) return null;
  const target = world.lodge ?? newLodge(ground, world.ponds, b.x, b.z, b.heading);
  if (target && !lodgeComplete(target) && nearLodge(target, b.x, b.z)) return 'build';
  if (!lodgeComplete(world.lodge)) return null;
  const mendLodge = nearLodge(world.lodge, b.x, b.z) && lodgeCondition(world.lodge, world.clock) < 1;
  const mendStore = atStore(world.lodge, b.x, b.z) && storeCondition(world.storeWear, world.clock) < 1;
  return mendLodge || mendStore ? 'mend' : null;
}

// The felled trees as a set, kept while the list is the same, so asking every frame does not build a new one.
let felledOf: readonly string[] | null = null;
let felledSet: ReadonlySet<string> = new Set();
function felledAsSet(felled: readonly string[]): ReadonlySet<string> {
  if (felled !== felledOf) {
    felledOf = felled;
    felledSet = new Set(felled);
  }
  return felledSet;
}

/**
 * What a press of Do does here, the first that fits (design note 30): in the lodge eat, else talk; with a log, mud, or a
 * rock, build or mend, or with mud on the bank by the lodge, mark a scent mound; at the store, open it; by a drift, dig; by a beaver, talk; on land by a tree, gnaw; by a log, strip
 * a branch. A baby only eats and talks.
 */
export function doHere(world: WorldState, ground: Terrain, trees: TreeSource, around: Around): DoKind | null {
  const b = world.beaver;
  const grown = works(world);
  if (world.stashOpen) return null;
  if (world.inLodge) return world.carry ? 'eat' : around.speaker ? 'talk' : null;
  const log = world.drag ? world.logs.find((l) => l.id === world.drag) : undefined;
  if (log || world.haul) return grown && b.mode !== 'dive' ? placeHere(world, ground, log) ?? (canMark(world) ? 'mark' : null) : null;
  if (grown && b.mode !== 'dive' && lodgeComplete(world.lodge) && atStore(world.lodge, b.x, b.z)) return 'store';
  if (grown && around.drift && b.mode === 'walk') return 'dig';
  if (world.carry && around.taker) return 'give';
  if (around.speaker && !around.following) return 'talk';
  const work = grown && !world.carry && b.mode !== 'dive';
  if (work && b.mode === 'walk' && (world.chop || trees.nearest(b.x, b.z, CHOP_REACH, felledAsSet(world.felled)))) return 'gnaw';
  if (work && strippable(world.logs, world.stripped, b.x, b.z)) return 'strip';
  return around.speaker ? 'talk' : null;
}
