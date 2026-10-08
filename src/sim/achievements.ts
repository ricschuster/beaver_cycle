// Achievements (Q38 to Q40, design note 21). Each is a rule over the world, checked every step. Plain data, so a save keeps
// what is won. A win stays won. Counters that need an event (pads picked, pieces mended, loads hauled) are kept in the world.
import { STORE_CAPACITY, stockTotal, storeCondition } from './food';
import { damCondition, damWhole, levelOf, type Dam } from './dam';
import { maxLevel } from './damSpots';
import { lodgeComplete, lodgeCondition } from './lodge';
import { DAY_SECONDS, DAYS_PER_YEAR, START_CLOCK } from './clock';
import type { WorldState } from './state';

export type AchievementId = 'wood' | 'home' | 'firstDam' | 'highDam' | 'pioneer' | 'pantry' | 'gardener' | 'handy' | 'hauler' | 'year';

/** The order they are listed and shown in. */
export const ACHIEVEMENT_IDS: readonly AchievementId[] = ['wood', 'home', 'firstDam', 'highDam', 'pioneer', 'pantry', 'gardener', 'handy', 'hauler', 'year'];

/** Trees to fell for the wood achievement (Q39). */
export const WOOD_TREES = 30;
/** Lily pads to pick for the water gardener. */
export const GARDENER_PADS = 20;
/** Loads of mud and rock put on dams for the hauler. */
export const HAULER_LOADS = 30;
/** Pieces mended back to new for the handy beaver. */
export const HANDY_MENDS = 1;

type Facts = Pick<WorldState, 'felled' | 'achievements' | 'lodge' | 'dams' | 'spots' | 'store' | 'padsPicked' | 'mended' | 'hauled' | 'clock'>;

const RULES: Record<AchievementId, (w: Facts) => boolean> = {
  wood: (w) => w.felled.length >= WOOD_TREES,
  home: (w) => lodgeComplete(w.lodge),
  firstDam: (w) => w.dams.some((d) => damWhole(d)),
  highDam: (w) =>
    w.dams.some((d) => {
      const spot = w.spots.find((s) => s.id === d.spot);
      return !!spot && maxLevel(spot) >= 2 && levelOf(d) >= maxLevel(spot) && damWhole(d);
    }),
  pioneer: (w) => w.dams.some((d) => w.spots.find((s) => s.id === d.spot)?.found === true),
  pantry: (w) => stockTotal(w.store) === STORE_CAPACITY,
  gardener: (w) => w.padsPicked >= GARDENER_PADS,
  handy: (w) => w.mended >= HANDY_MENDS,
  hauler: (w) => w.hauled >= HAULER_LOADS,
  year: (w) => w.clock - START_CLOCK >= DAYS_PER_YEAR * DAY_SECONDS,
};

/** The achievements the world has now won that it did not have yet, in the order to show them. */
export function newlyWon(world: Facts): AchievementId[] {
  return ACHIEVEMENT_IDS.filter((id) => !world.achievements.includes(id) && RULES[id](world));
}

/** Pieces that were worn before and are new again after: the dams, the lodge, and the store. Each counts once per mend. */
export function mendsBetween(before: Pick<WorldState, 'dams' | 'lodge' | 'storeWear' | 'clock'>, after: Pick<WorldState, 'dams' | 'lodge' | 'storeWear' | 'clock'>): number {
  // Wear falls a little every tick, so "new" is within a thousandth of 1, and "worn" is a hundredth below it.
  const back = (was: number, now: number): number => (was < 0.99 && now >= 0.999 ? 1 : 0);
  let n = 0;
  for (const d of after.dams) {
    const was = before.dams.find((b: Dam) => b.spot === d.spot);
    if (was?.wear && d.wear) n += back(damCondition(was, before.clock), damCondition(d, after.clock));
  }
  if (before.lodge?.wear && after.lodge?.wear) n += back(lodgeCondition(before.lodge, before.clock), lodgeCondition(after.lodge, after.clock));
  if (before.storeWear && after.storeWear) n += back(storeCondition(before.storeWear, before.clock), storeCondition(after.storeWear, after.clock));
  return n;
}

/** Pads picked between two states: each entry of `picked` that is new or changed (a pad that grew back and was picked again). */
export function padsBetween(before: Record<string, number>, after: Record<string, number>): number {
  let n = 0;
  for (const [id, year] of Object.entries(after)) if (before[id] !== year) n++;
  return n;
}

/** The state with its counters and achievements brought up to date from what changed in a step. */
export function tally(before: WorldState, after: WorldState): WorldState {
  const counted = { ...after, padsPicked: before.padsPicked + padsBetween(before.picked, after.picked), mended: before.mended + mendsBetween(before, after) };
  const won = newlyWon({ ...counted, achievements: before.achievements });
  return { ...counted, achievements: won.length ? [...before.achievements, ...won] : before.achievements };
}

/** The words shown when an achievement is won. */
export const ACHIEVEMENT_TEXT: Record<AchievementId, string> = {
  wood: `Wood achievement: ${WOOD_TREES} trees felled`,
  home: 'Home achievement: a lodge of your own',
  firstDam: 'First dam achievement: the stream holds water',
  highDam: 'Higher dam achievement: as high as it goes here',
  pioneer: 'Pioneer achievement: a new pond opens a new spot',
  pantry: 'Pantry achievement: the store is full',
  gardener: `Water gardener achievement: ${GARDENER_PADS} lily pads`,
  handy: 'Handy beaver achievement: mended and good as new',
  hauler: `Hauler achievement: ${HAULER_LOADS} loads on the dams`,
  year: 'A full year achievement: all four seasons',
};

/** The names for the list in the test menu. */
export const ACHIEVEMENT_NAME: Record<AchievementId, string> = {
  wood: 'Wood',
  home: 'Home',
  firstDam: 'First dam',
  highDam: 'Higher dam',
  pioneer: 'Pioneer',
  pantry: 'Pantry',
  gardener: 'Water gardener',
  handy: 'Handy beaver',
  hauler: 'Hauler',
  year: 'A full year',
};

/** The list for the test menu: one line per achievement, with a mark for won and the count where there is one. */
export function achievementLines(world: Pick<WorldState, 'achievements' | 'felled' | 'padsPicked' | 'hauled'>): string[] {
  const count = (id: AchievementId): string => {
    if (world.achievements.includes(id)) return '';
    if (id === 'wood') return ` ${world.felled.length}/${WOOD_TREES}`;
    if (id === 'gardener') return ` ${world.padsPicked}/${GARDENER_PADS}`;
    if (id === 'hauler') return ` ${world.hauled}/${HAULER_LOADS}`;
    return '';
  };
  return ACHIEVEMENT_IDS.map((id) => `${world.achievements.includes(id) ? '[x]' : '[ ]'} ${ACHIEVEMENT_NAME[id]}${count(id)}`);
}
