// The food store: a pile of branches and lily pads under the water beside the lodge door (16_food_store.md). The
// beaver strips branches off felled logs, carries one piece at a time in its mouth, and drops it at the store. In
// winter it takes a piece out and eats it inside the lodge. Plain data and pure functions, no three.js (ADR 0007).
import { DAY_SECONDS } from './clock';
import { DOOR_DISTANCE, DOOR_RUN, doorPoint, lodgeComplete, type Lodge } from './lodge';
import { distanceToLog, type Log } from './logs';
import { STORE_WORN_DAYS, condition, stageOf, type Wear } from './wear';

export type Food = 'branch' | 'lily';

/** The store's fixed places, `STORE_CAPACITY` of them: each holds one piece or is empty (null). The stash screen shows them in this order. */
export type Stock = readonly (Food | null)[];

/** Meals a piece gives when eaten: a branch is worth two lily pads (#155, 16_food_store.md). */
export const MEALS: Record<Food, number> = { branch: 2, lily: 1 };

/** Eating a lily pad speeds up swimming and diving by this factor, for `PAD_BOOST_TIME` clock seconds (#171, 16_food_store.md). */
export const PAD_BOOST = 1.3;
export const PAD_BOOST_TIME = 60;
/** Eating a branch makes the beaver fell a tree this much faster, for one game day ("well fed", #171). */
export const BRANCH_BOOST = 1.25;
export const BRANCH_BOOST_TIME = DAY_SECONDS;

const lasts = (since: number | null, clock: number, time: number): boolean => since !== null && clock >= since && clock - since < time;

/** Swim and dive speed factor from a lily pad eaten at `padAt`: 1 when it has worn off. */
export const padFactor = (padAt: number | null, clock: number): number => (lasts(padAt, clock, PAD_BOOST_TIME) ? PAD_BOOST : 1);
/** Felling speed factor from a branch eaten at `branchAt`: 1 when it has worn off. */
export const branchFactor = (branchAt: number | null, clock: number): number => (lasts(branchAt, clock, BRANCH_BOOST_TIME) ? BRANCH_BOOST : 1);

/**
 * Pieces the store holds: enough for a family of 7 through a winter and some more. A tuning number, not set by the
 * author. A worn store will hold less (15_build_and_repair.md).
 */
export const STORE_CAPACITY = 40;

export const emptyStock = (): Stock => Array.from({ length: STORE_CAPACITY }, () => null);
/** The store of a lodge the family left: Mama and Papa still live there and keep it full and whole. */
export const keptStock = (): Stock => Array.from({ length: STORE_CAPACITY }, () => 'branch' as const);
/** A worn store holds this share of the capacity, a broken one nothing until it is rebuilt (15_build_and_repair.md). */
export const WORN_CAPACITY_SHARE = 0.6;
/** How far from the lodge's centre the store lies: past the door, on the way out along the deep run. */
export const STORE_DISTANCE = DOOR_DISTANCE + DOOR_RUN * 0.5;
/** The store is a pile of this radius in metres. */
export const STORE_RADIUS = 1.4;
/** The beaver can drop in or take from the store within this many metres of its centre. */
export const STORE_REACH = 3.5;
/** How far the beaver reaches to strip a branch off a log, in metres from the nearest point on the log. */
export const STRIP_REACH = 2;

/** Pieces in the store. */
export function stockTotal(stock: Stock): number {
  return stock.filter((f) => f !== null).length;
}

/** Pieces of one kind in the store. */
export function stockOf(stock: Stock, food: Food): number {
  return stock.filter((f) => f === food).length;
}

/** Meals in the store: a branch is worth two, a lily pad one. */
export function stockMeals(stock: Stock): number {
  return stock.reduce((sum, f) => sum + (f ? MEALS[f] : 0), 0);
}

/** Where the store lies, or null before the lodge is whole. */
export function storeSpot(lodge: Lodge | null): { x: number; z: number } | null {
  return lodgeComplete(lodge) ? doorPoint(lodge, STORE_DISTANCE) : null;
}

/** Condition of the store at a game clock time, 0 broken to 1 new. */
export const storeCondition = (wear: Wear | undefined, clock: number): number => condition(wear, clock, STORE_WORN_DAYS);

/** Pieces the store holds at a condition: all of them when good, fewer when worn, none when broken. */
export function storeCapacity(level: number): number {
  const stage = stageOf(level);
  return stage === 'broken' ? 0 : stage === 'worn' ? Math.floor(STORE_CAPACITY * WORN_CAPACITY_SHARE) : STORE_CAPACITY;
}

/** How full the store is, 0 to 1. */
export function storeFill(stock: Stock): number {
  return Math.min(1, stockTotal(stock) / STORE_CAPACITY);
}

/** The store with the places from `capacity` on emptied: what a worn store loses, and a broken one (capacity 0) loses all of. Same store when nothing is lost. */
export function trimmed(stock: Stock, capacity: number): Stock {
  return stock.some((f, i) => f !== null && i >= capacity) ? stock.map((f, i) => (i < capacity ? f : null)) : stock;
}

/**
 * The store with its empty places filled with branches, in order, until all but `leave` of the first `capacity` places
 * are full. A test tool (the test menu), so the last piece can go in by hand and win the Pantry. Pieces already in stay.
 */
export function filledBut(stock: Stock, capacity: number, leave: number): Stock {
  let missing = Math.max(0, Math.min(capacity, stock.length) - leave - stockTotal(stock.slice(0, capacity)));
  return stock.map((f, i) => {
    if (f !== null || i >= capacity || missing === 0) return f;
    missing--;
    return 'branch';
  });
}

/**
 * One tap on a place of the stash screen. A filled place with an empty mouth gives its piece to the mouth, an empty
 * place takes the piece from a full mouth, and a filled place with a full mouth swaps the two. A place the store has
 * lost to wear (from `capacity` on) and an empty place with an empty mouth do nothing.
 */
export function tapped(stock: Stock, carry: Food | null, slot: number, capacity: number): { stock: Stock; carry: Food | null } {
  if (!Number.isInteger(slot) || slot < 0 || slot >= Math.min(capacity, stock.length)) return { stock, carry };
  const here = stock[slot] ?? null;
  if (here === null && carry === null) return { stock, carry };
  return { stock: stock.map((f, i) => (i === slot ? carry : f)), carry: here };
}

/** Pieces in the store of one kind as a share of the pieces, 0 to 1 (0 for an empty store): how much of the heap is lily pads. */
export function lilyShare(stock: Stock): number {
  const total = stockTotal(stock);
  return total === 0 ? 0 : stockOf(stock, 'lily') / total;
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
