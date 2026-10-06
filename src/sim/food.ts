// The food store: a pile of branches and lily pads under the water beside the lodge door (16_food_store.md). The
// beaver strips branches off felled logs, carries one piece at a time in its mouth, and drops it at the store. In
// winter it takes a piece out and eats it inside the lodge. Plain data and pure functions, no three.js (ADR 0007).
import { DOOR_DISTANCE, DOOR_RUN, doorPoint, lodgeComplete, type Lodge } from './lodge';
import { distanceToLog, type Log } from './logs';

export type Food = 'branch' | 'lily';

/** Pieces in the store, by kind. */
export type Stock = Record<Food, number>;

export const emptyStock = (): Stock => ({ branch: 0, lily: 0 });

/**
 * Pieces the store holds: enough for a family of 7 through a winter and some more. A tuning number, not set by the
 * author. A worn store will hold less (15_build_and_repair.md).
 */
export const STORE_CAPACITY = 40;
/** How far from the lodge's centre the store lies: past the door, on the way out along the deep run. */
export const STORE_DISTANCE = DOOR_DISTANCE + DOOR_RUN * 0.5;
/** The store is a pile of this radius in metres. */
export const STORE_RADIUS = 1.4;
/** The beaver can drop in or take from the store within this many metres of its centre. */
export const STORE_REACH = 3.5;
/** How far the beaver reaches to strip a branch off a log, in metres from the nearest point on the log. */
export const STRIP_REACH = 2;

export function stockTotal(stock: Stock): number {
  return stock.branch + stock.lily;
}

/** Where the store lies, or null before the lodge is whole. */
export function storeSpot(lodge: Lodge | null): { x: number; z: number } | null {
  return lodgeComplete(lodge) ? doorPoint(lodge, STORE_DISTANCE) : null;
}

/** How full the store is, 0 to 1. */
export function storeFill(stock: Stock): number {
  return Math.min(1, stockTotal(stock) / STORE_CAPACITY);
}

/** True when a point is within reach of the store. */
export function atStore(lodge: Lodge | null, x: number, z: number): boolean {
  const s = storeSpot(lodge);
  return s !== null && Math.hypot(x - s.x, z - s.z) <= STORE_REACH;
}

/** Branches a log gives: one a metre of its length, so a big tree gives more. */
export function branchesOf(log: Pick<Log, 'length'>): number {
  return Math.floor(log.length);
}

/** The log nearest a point, within strip reach, that still has a branch left, or null. */
export function strippable(logs: readonly Log[], taken: Readonly<Record<string, number>>, x: number, z: number): Log | null {
  let best: Log | null = null;
  let bestDist = STRIP_REACH;
  for (const log of logs) {
    if ((taken[log.id] ?? 0) >= branchesOf(log)) continue;
    const d = distanceToLog(log, x, z);
    if (d <= bestDist) {
      best = log;
      bestDist = d;
    }
  }
  return best;
}

/** The piece taken out of a store: branches first, lily pads after. Null when it is empty. */
export function pieceFrom(stock: Stock): Food | null {
  return stock.branch > 0 ? 'branch' : stock.lily > 0 ? 'lily' : null;
}

/** The store with a piece added, or the same store when it is full. */
export function stored(stock: Stock, food: Food): Stock {
  return stockTotal(stock) >= STORE_CAPACITY ? stock : { ...stock, [food]: stock[food] + 1 };
}

/** The store with a piece taken out. */
export function taken(stock: Stock, food: Food): Stock {
  return { ...stock, [food]: Math.max(0, stock[food] - 1) };
}
