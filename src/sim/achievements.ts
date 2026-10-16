// Achievements (Q38 to Q40, design note 21). Each is a rule over the world, checked every step. Plain data, so a save keeps
// what is won. A win stays won. Counters that need an event (pads picked, pieces mended, loads hauled) are kept in the world.
// Each life has its own journey (Q40): `newLife` starts the list and the counters again, and what earlier lives built does not count.
// The family ones (a mate, kits, a guide) are the author's own list (Q38). Growing up, Visit home and Hand down are three more of
// the family list in #220 that the game can see.
import { STORE_CAPACITY, stockTotal, storeCondition } from './food';
import { damCondition, damWhole, levelOf, type Dam } from './dam';
import { maxLevel } from './damSpots';
import { lodgeComplete, lodgeCondition } from './lodge';
import { formerParentIds, type Coat } from './family';
import { stageAt } from './life';
import { DAY_SECONDS, DAYS_PER_YEAR, dateAt } from './clock';
import { mateOf } from './partners';
import { kitDue, type WorldState } from './state';

export type AchievementId = 'wood' | 'home' | 'firstDam' | 'highDam' | 'pioneer' | 'pantry' | 'gardener' | 'handy' | 'hauler' | 'year' | 'mate' | 'kits' | 'guide' | 'grownUp' | 'visitHome' | 'handDown';

/** The order they are listed and shown in. */
export const ACHIEVEMENT_IDS: readonly AchievementId[] = ['wood', 'home', 'firstDam', 'highDam', 'pioneer', 'pantry', 'gardener', 'handy', 'hauler', 'year', 'mate', 'kits', 'guide', 'grownUp', 'visitHome', 'handDown'];

/** Trees to fell for the wood achievement (Q39). */
export const WOOD_TREES = 30;
/** Lily pads to pick for the water gardener. */
export const GARDENER_PADS = 20;
/** Loads of mud and rock put on dams for the hauler. */
export const HAULER_LOADS = 30;
/** Pieces mended back to new for the handy beaver. */
export const HANDY_MENDS = 1;

type Facts = Pick<WorldState, 'felled' | 'achievements' | 'lodge' | 'dams' | 'spots' | 'store' | 'padsPicked' | 'mended' | 'hauled' | 'clock' | 'journey' | 'partners' | 'bornAt' | 'rescued' | 'formerHomes' | 'parentCoats' | 'met'>;

/** Trees felled in this life. */
export const treesThisLife = (w: Pick<WorldState, 'felled' | 'journey'>): number => w.felled.length - w.journey.felled;

/**
 * Stuck beavers this life dug out. A rescue's id ends in the year of its winter (`escort.ts`), and a kit is born on the first
 * day of spring, so a rescue in the year the life started or later is its own (the same reading as the talk's "You dug me out").
 */
export const rescuesThisLife = (w: Pick<WorldState, 'rescued' | 'journey'>): number => {
  const start = dateAt(w.journey.start).year;
  return w.rescued.filter((id) => Number(id.slice(id.lastIndexOf(':') + 1)) >= start).length;
};

const mine = (w: Facts, id: string): boolean => !w.journey.inherited.includes(id);

const sameCoat = (a: Coat, b: Coat): boolean => a.coat === b.coat && a.shade === b.shade;

/**
 * This life talked to Mama or Papa at the home it grew up in, after it left (Q60). That home is the former home whose parents
 * are this life's parents; its parents have their own ids (`formerParentIds`), so a talk while still at home does not count.
 */
export const visitedHome = (w: Pick<WorldState, 'formerHomes' | 'parentCoats' | 'met'>): boolean =>
  w.formerHomes.some((h) => sameCoat(h.parents[0], w.parentCoats[0]) && sameCoat(h.parents[1], w.parentCoats[1]) && formerParentIds(h).some((id) => w.met[id] !== undefined));

const RULES: Record<AchievementId, (w: Facts) => boolean> = {
  wood: (w) => treesThisLife(w) >= WOOD_TREES,
  home: (w) => lodgeComplete(w.lodge) && mine(w, 'lodge'),
  firstDam: (w) => w.dams.some((d) => damWhole(d) && mine(w, `dam:${d.spot}`)),
  highDam: (w) =>
    w.dams.some((d) => {
      const spot = w.spots.find((s) => s.id === d.spot);
      return mine(w, `dam:${d.spot}`) && !!spot && maxLevel(spot) >= 2 && levelOf(d) >= maxLevel(spot) && damWhole(d);
    }),
  pioneer: (w) => w.dams.some((d) => mine(w, `dam:${d.spot}`) && w.spots.find((s) => s.id === d.spot)?.found === true),
  pantry: (w) => stockTotal(w.store) === STORE_CAPACITY && mine(w, 'store'),
  gardener: (w) => w.padsPicked >= GARDENER_PADS,
  handy: (w) => w.mended >= HANDY_MENDS,
  hauler: (w) => w.hauled >= HAULER_LOADS,
  year: (w) => w.clock - w.journey.start >= DAYS_PER_YEAR * DAY_SECONDS,
  // A partner lives in the lodge. A kit's life starts with no partners, so it finds its own.
  mate: (w) => mateOf(w.partners) !== null,
  // The kit is due: the step that wins this holds the birth one step (`step.ts`), so the toast shows before the kit's own list starts.
  kits: (w) => kitDue(w),
  guide: (w) => rescuesThisLife(w) >= 1,
  // This life began as a baby and is a teenager now (or grown).
  grownUp: (w) => stageAt(w.journey.start, w.bornAt) === 'baby' && stageAt(w.clock, w.bornAt) !== 'baby',
  visitHome: (w) => visitedHome(w),
  // The kit is due, so the kit gets the lodge, and a dam this life built stands (whole, or raised, which needs it whole first).
  handDown: (w) => kitDue(w) && w.dams.some((d) => mine(w, `dam:${d.spot}`) && (damWhole(d) || levelOf(d) > 1)),
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
  mate: 'Mate achievement: a partner lives in your lodge',
  kits: 'Kits achievement: a kit of your own',
  guide: 'Guide achievement: a beaver you dug out shows the way',
  grownUp: 'Growing up achievement: from baby to teenager',
  visitHome: 'Visit home achievement: you met your family again',
  handDown: 'Hand down achievement: your kit gets your lodge and dam',
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
  mate: 'Mate',
  kits: 'Kits',
  guide: 'Guide',
  grownUp: 'Growing up',
  visitHome: 'Visit home',
  handDown: 'Hand down',
};

/** How to win each one, for the Things I did card (#557). Short sentences for kids from 8; a number is the constant the rule uses. */
export const ACHIEVEMENT_HINT: Record<AchievementId, string> = {
  wood: `Gnaw down ${WOOD_TREES} trees.`,
  home: 'Build a lodge of your own.',
  firstDam: 'Build a dam so the stream holds water.',
  highDam: 'Build a dam up to the highest level it can reach in its spot.',
  pioneer: 'Make a pond that opens a new place for a dam. Then build a dam there.',
  pantry: 'Fill your food store.',
  gardener: `Pick ${GARDENER_PADS} lily pads.`,
  handy: 'Mend something that is worn, until it is as good as new.',
  hauler: `Carry ${HAULER_LOADS} loads of mud and rocks to your dams.`,
  year: 'Play through all four seasons.',
  mate: 'Get a partner to live in your lodge.',
  kits: 'Raise a kit of your own.',
  guide: 'Dig out a stuck beaver. It will show you the way.',
  grownUp: 'Grow from a baby to a teenager.',
  visitHome: 'Go back and meet your family again.',
  handDown: 'Let your kit take over your lodge and dam.',
};

/** The rows for the Things I did card: the line (as `achievementLines`) and the hint to show on a tap. */
export function achievementRows(world: Pick<WorldState, 'achievements' | 'felled' | 'padsPicked' | 'hauled' | 'journey'>): { line: string; hint: string }[] {
  const lines = achievementLines(world);
  return ACHIEVEMENT_IDS.map((id, i) => ({ line: lines[i] ?? '', hint: ACHIEVEMENT_HINT[id] }));
}

/** The list for the test menu: one line per achievement, with a mark for won and the count where there is one. */
export function achievementLines(world: Pick<WorldState, 'achievements' | 'felled' | 'padsPicked' | 'hauled' | 'journey'>): string[] {
  const count = (id: AchievementId): string => {
    if (world.achievements.includes(id)) return '';
    if (id === 'wood') return ` ${treesThisLife(world)}/${WOOD_TREES}`;
    if (id === 'gardener') return ` ${world.padsPicked}/${GARDENER_PADS}`;
    if (id === 'hauler') return ` ${world.hauled}/${HAULER_LOADS}`;
    return '';
  };
  return ACHIEVEMENT_IDS.map((id) => `${world.achievements.includes(id) ? '[x]' : '[ ]'} ${ACHIEVEMENT_NAME[id]}${count(id)}`);
}
