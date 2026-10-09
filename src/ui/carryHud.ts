// Trees felled, the log being dragged, and how far a gnaw has got, top left under the clock. DOM only.
import { atStore, storeCapacity, storeCondition, stockMeals, stockTotal, strippable } from '../sim/food';
import { WOOD_TREES } from '../sim/achievements';
import { maxLevel } from '../sim/damSpots';
import { damAt, damCondition, damMendUnits, damNeedsRepair, damProgress, damWhole, levelOf, needs, raised, settled, spotAt } from '../sim/dam';
import { canScoopMud, reachableDropped, reachableRock } from '../sim/haul';
import { reachablePad } from '../sim/lily';
import type { Terrain } from '../sim/terrain';
import { LODGE_WOOD, lodgeComplete, lodgeCondition, nearLodge, type SiteProblem } from '../sim/lodge';
import { LODGE_WORN_DAYS, STORE_REBUILD_WOOD, STORE_WORN_DAYS, needsRepair, stageOf, woodToMend } from '../sim/wear';
import type { WorldState } from '../sim/state';

/** What the spot ahead is for a new lodge while dragging a log with no lodge yet: fine, a problem, or null when it does not apply. */
export type LodgeSite = 'ok' | SiteProblem | null;

const SITE_TEXT: Record<'ok' | SiteProblem, string> = {
  ok: 'press Build to start the lodge here',
  dry: 'no lodge spot, face the water',
  deep: 'no lodge spot, too deep',
  far: 'no lodge spot, no deep water near',
};

/** Where the beaver is in the lodge: next to the water hole, on the nest, elsewhere in the room, or not in the lodge (null). */
export type LodgeSpot = 'hole' | 'nest' | 'room' | null;

const SPOT_TEXT: Record<'hole' | 'nest' | 'room', string> = {
  hole: 'in the lodge, press Build to dive out through the water hole',
  nest: 'in the lodge, on the nest',
  room: 'in the lodge, the water hole is the way out',
};

/** The food in play: the piece in the mouth, the store once the lodge is whole (null before), and what a press would do here. */
export interface FoodInfo {
  carry: 'branch' | 'lily' | null;
  /** Mud or a rock in the mouth, for the dam. */
  haul: 'mud' | 'rock' | null;
  store: { total: number; capacity: number; meals: number } | null;
  /** The dam spot within reach: how far the dam is and what it still needs. `level` is the one it is built to, and `raise` is true for a whole dam that can be raised to it, `top` is true for a whole dam at the biggest level the spot holds, so `wood`, `mud`, and `rock` are what the raise needs. */
  dam: { percent: number; wood: number; mud: number; rock: number; whole: boolean; canAdd: boolean; level: number; raise: boolean; top: boolean } | null;
  /** The lodge or store within reach that needs repair: its condition in percent and the wood units still needed. */
  repair: { what: 'lodge' | 'store' | 'dam'; percent: number; wood: number; broken: boolean } | null;
  hint: 'pick' | 'strip' | 'branch' | 'lily' | 'rock' | 'mud' | 'store' | 'eat' | null;
}

const HINT_TEXT: Record<NonNullable<FoodInfo['hint']>, string> = {
  pick: 'press Gnaw to pick a lily pad',
  strip: 'press Gnaw to strip a branch',
  branch: 'press Gnaw to pick up the branch',
  lily: 'press Gnaw to pick up the lily pad',
  rock: 'press Gnaw to pick up a rock',
  mud: 'press Gnaw to scoop mud',
  store: 'press Build to open the store',
  eat: 'press Gnaw to eat it',
};

/** "dam 40%, needs 4 wood, 2 mud, 1 rock", with "press Build to add it" when the mouth or the drag has something it needs. */
export function formatDam(d: NonNullable<FoodInfo['dam']>): string {
  if (d.whole) return `${d.level > 1 ? `dam level ${d.level} done` : 'dam done'}${d.top ? ', as high as a dam can go here' : ''}`;
  const list = [d.wood && `${d.wood} wood`, d.mud && `${d.mud} mud`, d.rock && `${d.rock} ${d.rock === 1 ? 'rock' : 'rocks'}`].filter(Boolean).join(', ');
  const add = d.canAdd ? ', press Build to add it' : '';
  if (d.raise) return `dam level ${d.level - 1} done, raise it to level ${d.level}: needs ${list}${add}`;
  return `dam${d.level > 1 ? ` level ${d.level}` : ''} ${d.percent}%, needs ${list}${add}`;
}

/** "store worn 25%, needs 6 wood (a long log is 2)", or "broken" for a piece that has to be rebuilt. */
export function formatRepair(r: NonNullable<FoodInfo['repair']>): string {
  // A dam takes wood, mud, and rocks alike. A broken one is built again, which the dam line says.
  if (r.what === 'dam') return r.broken ? 'dam broken, build it again' : `dam worn ${r.percent}%, needs ${r.wood} units (a long log is 2, mud 1, a rock 2)`;
  const state = r.broken ? `${r.what} broken` : `${r.what} worn ${r.percent}%`;
  return `${state}, needs ${r.wood} wood (a long log is 2)`;
}

/** ", carrying a branch", ", store 12 of 40", and the hint, to add to the line. Empty when there is nothing to say. */
export function formatFood(food: FoodInfo | null): string {
  if (!food) return '';
  const parts: string[] = [];
  if (food.carry) parts.push(food.carry === 'branch' ? 'carrying a branch' : 'carrying a lily pad');
  if (food.haul) parts.push(food.haul === 'mud' ? 'carrying mud, press Drag to put it down' : 'carrying a rock, press Drag to put it down');
  if (food.store) parts.push(`store ${food.store.total} of ${food.store.capacity}, ${food.store.meals} ${food.store.meals === 1 ? 'meal' : 'meals'}`);
  // A worn dam is whole, so its repair line says it all. A broken one shows both: that it broke and what it needs again.
  if (food.repair) parts.push(formatRepair(food.repair));
  if (food.dam && !(food.repair?.what === 'dam' && !food.repair.broken)) parts.push(formatDam(food.dam));
  if (food.hint) parts.push(HINT_TEXT[food.hint]);
  return parts.length ? `, ${parts.join(', ')}` : '';
}

/** The worse of the lodge and the store that is in reach and needs repair, or null. */
function repairInfoOf(world: WorldState): FoodInfo['repair'] {
  const { lodge, beaver: b } = world;
  if (!lodgeComplete(lodge)) return null;
  const lodgeLevel = lodgeCondition(lodge, world.clock);
  const storeLevel = storeCondition(world.storeWear, world.clock);
  const lodgeNeeds = nearLodge(lodge, b.x, b.z) && needsRepair(lodgeLevel);
  const storeNeeds = atStore(lodge, b.x, b.z) && needsRepair(storeLevel);
  const info = (what: 'lodge' | 'store', level: number, wood: number): NonNullable<FoodInfo['repair']> => ({ what, percent: Math.round(level * 100), wood, broken: stageOf(level) === 'broken' });
  if (lodgeNeeds && (!storeNeeds || lodgeLevel <= storeLevel)) return info('lodge', lodgeLevel, woodToMend(lodge.wear, world.clock, LODGE_WORN_DAYS, LODGE_WOOD));
  if (storeNeeds) return info('store', storeLevel, woodToMend(world.storeWear, world.clock, STORE_WORN_DAYS, STORE_REBUILD_WOOD));
  return null;
}

/** The food line for a world: the store once the lodge is whole, the piece in the mouth, and what a press would do here. */
export function foodInfoOf(world: WorldState, terrain: Terrain, ground: Terrain = terrain): FoodInfo | null {
  const { lodge, beaver: b, carry, haul, store } = world;
  const whole = lodgeComplete(lodge);
  let hint: FoodInfo['hint'] = null;
  if (world.inLodge) {
    if (carry) hint = 'eat';
  } else if (whole && atStore(lodge, b.x, b.z) && !world.drag && !haul) {
    hint = 'store';
  } else if (!carry && !haul && !world.drag && !world.chop && b.mode === 'walk' && reachableDropped(world.dropped, b.x, b.z)) {
    hint = reachableDropped(world.dropped, b.x, b.z)!.kind;
  } else if (!carry && !haul && !world.drag && !world.chop && b.mode !== 'dive' && reachablePad(ground, b.x, b.z, world.clock, world.picked)) {
    hint = 'pick';
  } else if (!carry && !haul && !world.drag && !world.chop && b.mode !== 'dive' && strippable(world.logs, world.stripped, b.x, b.z)) {
    hint = 'strip';
  } else if (!carry && !haul && !world.drag && !world.chop && b.mode === 'walk') {
    if (reachableRock(terrain, b.x, b.z, world.rocksTaken)) hint = 'rock';
    else if (canScoopMud(terrain, b.x, b.z, b.heading)) hint = 'mud';
  }
  const lodgeRepair = whole && !world.inLodge ? repairInfoOf(world) : null;
  const spot = world.inLodge ? null : spotAt(world.spots, b.x, b.z);
  const stored = spot ? damAt(world.dams, spot) : undefined;
  const dam = spot ? settled(stored, world.clock, spot) : stored;
  // A good whole dam that the spot can hold bigger shows what raising it needs.
  const up = spot ? raised(dam, spot, world.clock) : undefined;
  const need = needs(up ?? dam);
  const log = world.drag ? world.logs.find((l) => l.id === world.drag) : undefined;
  const mendable = damMendUnits(dam, world.clock) > 0;
  const canAdd = mendable ? !!haul || !!log : (haul?.kind === 'mud' && need.mud > 0) || (haul?.kind === 'rock' && need.rock > 0) || (!!log && need.wood > 0);
  const level = damCondition(stored, world.clock);
  const damRepair: FoodInfo['repair'] = damNeedsRepair(stored, world.clock) ? { what: 'dam', percent: Math.round(level * 100), wood: damMendUnits(dam, world.clock), broken: stageOf(level) === 'broken' } : null;
  const damInfo: FoodInfo['dam'] = spot ? { percent: Math.round(damProgress(up ?? dam) * 100), ...need, whole: damWhole(dam) && !up, canAdd, level: levelOf(up ?? dam), raise: !!up, top: damWhole(dam) && !up && levelOf(dam) >= maxLevel(spot) } : null;
  if (!carry && !haul && !whole && !hint && !damInfo) return null;
  const capacity = storeCapacity(storeCondition(world.storeWear, world.clock));
  return { carry, haul: haul?.kind ?? null, dam: damInfo, store: whole ? { total: stockTotal(store), capacity, meals: stockMeals(store) } : null, repair: lodgeRepair ?? damRepair, hint };
}

export interface CarryHud {
  /** `gnaw` is 0 to 1 while a tree is being gnawed, null otherwise. */
  set(felled: number, dragging: boolean, gnaw: number | null, lodge?: number | null, site?: LodgeSite, spot?: LodgeSpot, food?: FoodInfo | null, wood?: boolean): void;
}

/** "5 of 30 trees felled" (the count toward the wood achievement, then "31 trees felled, wood achievement" once won), then the lodge's progress once it is started, with ", dragging a log" or the gnaw progress in percent while either is going on. */
export function formatCarry(felled: number, dragging: boolean, gnaw: number | null, lodge: number | null = null, site: LodgeSite = null, spot: LodgeSpot = null, food: FoodInfo | null = null, wood = false): string {
  if (spot) return SPOT_TEXT[spot] + formatFood(food);
  const lodgeText = lodge === null ? '' : lodge >= 1 ? ', lodge done' : `, lodge ${Math.floor(lodge * 100)}%`;
  const base = `${wood ? `${felled} ${felled === 1 ? 'tree' : 'trees'} felled, wood achievement` : `${felled} of ${WOOD_TREES} trees felled`}${lodgeText}`;
  if (dragging) return (site ? `${base}, dragging a log, ${SITE_TEXT[site]}` : `${base}, dragging a log`) + (food?.repair ? `, ${formatRepair(food.repair)}, press Build to add it` : '') + (food?.dam && !(food.repair?.what === 'dam' && !food.repair.broken) ? `, ${formatDam(food.dam)}` : '');
  return (gnaw === null ? base : `${base}, gnawing ${Math.floor(Math.min(1, gnaw) * 100)}%`) + formatFood(food);
}

export function createCarryHud(parent: HTMLElement): CarryHud {
  const root = document.createElement('div');
  root.id = 'carry-hud';
  root.setAttribute('role', 'status');
  root.style.cssText =
    'position:fixed;top:44px;left:8px;z-index:5;padding:6px 10px;border-radius:8px;background:rgba(0,0,0,.45);' +
    'color:#fff;font:14px system-ui,sans-serif;pointer-events:none';
  parent.appendChild(root);
  let shown = '';
  return {
    set(felled, dragging, gnaw, lodge = null, site = null, spot = null, food = null, wood = false) {
      const text = formatCarry(felled, dragging, gnaw, lodge, site, spot, food, wood);
      if (text !== shown) {
        shown = text;
        root.textContent = text;
      }
    },
  };
}
