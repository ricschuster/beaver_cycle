// Trees felled, the log being dragged, and how far a gnaw has got, top left under the clock. DOM only.
import { STORE_CAPACITY, atStore, pieceFrom, stockTotal, strippable } from '../sim/food';
import { lodgeComplete, type SiteProblem } from '../sim/lodge';
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
  store: { total: number; capacity: number } | null;
  hint: 'strip' | 'store' | 'take' | 'eat' | null;
}

const HINT_TEXT: Record<NonNullable<FoodInfo['hint']>, string> = {
  strip: 'press Gnaw to strip a branch',
  store: 'press Build to put it in the store',
  take: 'press Drag to take a piece from the store',
  eat: 'press Gnaw to eat it',
};

/** ", carrying a branch", ", store 12 of 40", and the hint, to add to the line. Empty when there is nothing to say. */
export function formatFood(food: FoodInfo | null): string {
  if (!food) return '';
  const parts: string[] = [];
  if (food.carry) parts.push(food.carry === 'branch' ? 'carrying a branch' : 'carrying a lily pad');
  if (food.store) parts.push(`store ${food.store.total} of ${food.store.capacity}`);
  if (food.hint) parts.push(HINT_TEXT[food.hint]);
  return parts.length ? `, ${parts.join(', ')}` : '';
}

/** The food line for a world: the store once the lodge is whole, the piece in the mouth, and what a press would do here. */
export function foodInfoOf(world: WorldState): FoodInfo | null {
  const { lodge, beaver: b, carry, store } = world;
  const whole = lodgeComplete(lodge);
  let hint: FoodInfo['hint'] = null;
  if (world.inLodge) {
    if (carry) hint = 'eat';
  } else if (whole && atStore(lodge, b.x, b.z) && (carry || pieceFrom(store)) && !world.drag) {
    hint = carry ? 'store' : 'take';
  } else if (!carry && !world.drag && !world.chop && b.mode !== 'dive' && strippable(world.logs, world.stripped, b.x, b.z)) {
    hint = 'strip';
  }
  if (!carry && !whole && !hint) return null;
  return { carry, store: whole ? { total: stockTotal(store), capacity: STORE_CAPACITY } : null, hint };
}

export interface CarryHud {
  /** `gnaw` is 0 to 1 while a tree is being gnawed, null otherwise. */
  set(felled: number, dragging: boolean, gnaw: number | null, lodge?: number | null, site?: LodgeSite, spot?: LodgeSpot, food?: FoodInfo | null): void;
}

/** "5 trees felled", then the lodge's progress once it is started, with ", dragging a log" or the gnaw progress in percent while either is going on. */
export function formatCarry(felled: number, dragging: boolean, gnaw: number | null, lodge: number | null = null, site: LodgeSite = null, spot: LodgeSpot = null, food: FoodInfo | null = null): string {
  if (spot) return SPOT_TEXT[spot] + formatFood(food);
  const lodgeText = lodge === null ? '' : lodge >= 1 ? ', lodge done' : `, lodge ${Math.floor(lodge * 100)}%`;
  const base = `${felled} ${felled === 1 ? 'tree' : 'trees'} felled${lodgeText}`;
  if (dragging) return site ? `${base}, dragging a log, ${SITE_TEXT[site]}` : `${base}, dragging a log`;
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
    set(felled, dragging, gnaw, lodge = null, site = null, spot = null, food = null) {
      const text = formatCarry(felled, dragging, gnaw, lodge, site, spot, food);
      if (text !== shown) {
        shown = text;
        root.textContent = text;
      }
    },
  };
}
