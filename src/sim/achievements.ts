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

export type AchievementId = 'wood' | 'home' | 'firstDam' | 'highDam' | 'pioneer' | 'pantry' | 'gardener' | 'handy' | 'hauler' | 'year' | 'mate' | 'kits' | 'guide' | 'grownUp' | 'visitHome' | 'handDown' | 'neighbour' | 'rescuer' | 'generations' | 'diver' | 'explorer' | 'tailSlap' | 'wellFed' | 'stripper' | 'winterStore' | 'manyDams' | 'bigPond' | 'fixerUpper' | 'animalFriend' | 'pondLife' | 'homesFar' | 'sweetDreams' | 'longWinter';

/** The order they are listed and shown in. */
export const ACHIEVEMENT_IDS: readonly AchievementId[] = ['wood', 'home', 'firstDam', 'highDam', 'pioneer', 'pantry', 'gardener', 'handy', 'hauler', 'year', 'mate', 'kits', 'guide', 'grownUp', 'visitHome', 'handDown', 'neighbour', 'rescuer', 'generations', 'diver', 'explorer', 'tailSlap', 'wellFed', 'stripper', 'winterStore', 'manyDams', 'bigPond', 'fixerUpper', 'animalFriend', 'pondLife', 'homesFar', 'sweetDreams', 'longWinter'];

/** Trees to fell for the wood achievement (Q39). */
export const WOOD_TREES = 30;
/** Lily pads to pick for the water gardener. */
export const GARDENER_PADS = 20;
/** Loads of mud and rock put on dams for the hauler. */
export const HAULER_LOADS = 30;
/** Pieces mended back to new for the handy beaver. */
export const HANDY_MENDS = 1;
/** Families to talk to for the good neighbour. */
export const NEIGHBOUR_FAMILIES = 3;
/** Stuck beavers to dig out for the rescuer. */
export const RESCUER_DIGS = 5;
/** The generation (lives begun after the first) that wins the long line. 5 and 10 wait for tiers (#569). */
export const LINE_GENERATION = 3;
/** Tail slaps for the tail slapper. */
export const SLAP_COUNT = 10;
/** Pieces eaten for the well fed beaver. */
export const WELL_FED_MEALS = 25;
/** Branches stripped off logs for the stripper. */
export const STRIPPER_BRANCHES = 50;
/** Whole dams of this life standing at once for many dams. */
export const MANY_DAMS = 3;
/** Square metres a dam's pond must flood for the big pond (the scanned sites run from 200 to 2300, half below 900). */
export const BIG_POND_M2 = 1500;
/** The play locations the explorer visits (the `location` anchors of the tile index), and how close counts as a visit, in metres. */
export const EXPLORER_PLACES: readonly string[] = ['core', 'north', 'south', 'east-oedseen', 'vorderer-springbach', 'hinterer-springbach'];
export const VISIT_RADIUS = 200;
/** Pieces mended for the fixer-upper. */
export const FIXER_MENDS = 10;
/** The animals that eat what the beaver puts down (`moods.ts`), all of which the animal friend feeds. */
export const FRIEND_KINDS: readonly string[] = ['deer', 'duck'];
/** The guests of a mature pond (`pondGuests.ts`), all of which the pond life needs, and how near the beaver must be to see one, in metres. */
export const POND_KINDS: readonly string[] = ['duck', 'frog'];
export const GUEST_RADIUS = 40;

type Facts = Pick<WorldState, 'felled' | 'achievements' | 'lodge' | 'dams' | 'spots' | 'store' | 'padsPicked' | 'mended' | 'hauled' | 'clock' | 'journey' | 'partners' | 'bornAt' | 'rescued' | 'generation' | 'formerHomes' | 'parentCoats' | 'met' | 'ponds' | 'slaps' | 'meals' | 'branchesStripped' | 'longDives' | 'visited' | 'winterStocked' | 'fedKinds' | 'guestKinds' | 'homesIn' | 'dreamed' | 'longWinter'>;

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

/** The family a beaver of the valley belongs to, from its id (`family:cx:cz:mama`, `family:cx:cz:kit:year:k`), or null for any other talk. */
const familyOfId = (id: string): string | null => (id.startsWith('family:') ? id.split(':').slice(0, 3).join(':') : null);

/** Families of the valley the player talked to in this life (`met` starts again with each life). */
export const familiesMet = (w: Pick<WorldState, 'met'>): number => new Set(Object.keys(w.met).map(familyOfId).filter((f) => f !== null)).size;

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
  neighbour: (w) => familiesMet(w) >= NEIGHBOUR_FAMILIES,
  rescuer: (w) => rescuesThisLife(w) >= RESCUER_DIGS,
  // Each life starts its list again, so the life at this generation wins it on its first step.
  generations: (w) => w.generation >= LINE_GENERATION,
  // A dive that ran the whole breath out (`BREATH_TIME` under water; the beaver then rises by itself).
  diver: (w) => w.longDives >= 1,
  explorer: (w) => EXPLORER_PLACES.every((id) => w.visited.includes(id)),
  tailSlap: (w) => w.slaps >= SLAP_COUNT,
  wellFed: (w) => w.meals >= WELL_FED_MEALS,
  stripper: (w) => w.branchesStripped >= STRIPPER_BRANCHES,
  winterStore: (w) => w.winterStocked,
  manyDams: (w) => w.dams.filter((d) => damWhole(d) && mine(w, `dam:${d.spot}`)).length >= MANY_DAMS,
  bigPond: (w) => w.ponds.some((p) => p.area >= BIG_POND_M2 && mine(w, `dam:${p.spot}`)),
  fixerUpper: (w) => w.mended >= FIXER_MENDS,
  animalFriend: (w) => FRIEND_KINDS.every((k) => w.fedKinds.includes(k)),
  pondLife: (w) => POND_KINDS.every((k) => w.guestKinds.includes(k)),
  homesFar: (w) => EXPLORER_PLACES.every((id) => w.homesIn.includes(id)),
  sweetDreams: (w) => w.dreamed,
  longWinter: (w) => w.longWinter,
};

/** The ids of the play locations the beaver is at (within `VISIT_RADIUS`), added to those already visited. The same array when nothing is new. */
export function visitPlaces(visited: string[], x: number, z: number, places: readonly { id: string; x: number; z: number }[]): string[] {
  const here = places.filter((a) => !visited.includes(a.id) && Math.hypot(a.x - x, a.z - z) <= VISIT_RADIUS).map((a) => a.id);
  return here.length ? [...visited, ...here] : visited;
}

/** The kinds of animal fed in a step, added to those already fed. The same array when nothing is new. */
export function noteFed(fed: string[], kinds: readonly string[]): string[] {
  const more = kinds.filter((k, i) => FRIEND_KINDS.includes(k) && !fed.includes(k) && kinds.indexOf(k) === i);
  return more.length ? [...fed, ...more] : fed;
}

/**
 * The kinds of pond guest the beaver is near (within `GUEST_RADIUS`) on a pond of this life, added to those already seen. A guest's
 * id is `pond:<dam spot>:<kind><n>` (`pondGuests.ts`); the ponds of dams a parent built (`inherited`) do not count.
 */
export function seeGuests(seen: string[], guests: readonly { id: string; kind: string; x: number; z: number }[], x: number, z: number, inherited: readonly string[]): string[] {
  const more: string[] = [];
  for (const g of guests) {
    if (!POND_KINDS.includes(g.kind) || seen.includes(g.kind) || more.includes(g.kind)) continue;
    if (inherited.includes(`dam:${g.id.slice('pond:'.length, g.id.lastIndexOf(':'))}`) || Math.hypot(g.x - x, g.z - z) > GUEST_RADIUS) continue;
    more.push(g.kind);
  }
  return more.length ? [...seen, ...more] : seen;
}

/**
 * The play locations with a home of this life, added to those known: the whole dams and the finished lodge, each counted for the
 * location nearest to it. The same array when nothing is new.
 */
export function noteHomes(homesIn: string[], w: Pick<WorldState, 'dams' | 'spots' | 'lodge' | 'journey'>, places: readonly { id: string; x: number; z: number }[]): string[] {
  if (places.length === 0) return homesIn;
  const near = (x: number, z: number): string => places.reduce((a, b) => (Math.hypot(b.x - x, b.z - z) < Math.hypot(a.x - x, a.z - z) ? b : a)).id;
  const at: string[] = [];
  if (lodgeComplete(w.lodge) && !w.journey.inherited.includes('lodge') && w.lodge) at.push(near(w.lodge.x, w.lodge.z));
  for (const d of w.dams) {
    const spot = w.spots.find((s) => s.id === d.spot);
    if (spot && damWhole(d) && !w.journey.inherited.includes(`dam:${d.spot}`)) at.push(near(spot.bed.x, spot.bed.z));
  }
  const more = [...new Set(at)].filter((id) => !homesIn.includes(id));
  return more.length ? [...homesIn, ...more] : homesIn;
}

const sumOf = (r: Record<string, number>): number => Object.values(r).reduce((a, b) => a + b, 0);

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
  // Winter begins with the store at least half full: the step that crosses into winter looks (a sleep can cross it in one jump).
  const intoWinter = dateAt(before.clock).season !== 'winter' && dateAt(after.clock).season === 'winter';
  const outOfWinter = dateAt(before.clock).season === 'winter' && dateAt(after.clock).season !== 'winter';
  const inWinter = dateAt(after.clock).season === 'winter';
  // A winter in the lodge of this life with a store that is never empty: it starts clean on the step in, an empty store spoils it,
  // and it is won on the step out (a sleep that jumps over the whole winter does not count).
  const clean = (before.winterClean || intoWinter) && inWinter && lodgeComplete(after.lodge) && mine(after, 'lodge') && stockTotal(after.store) > 0;
  const counted: WorldState = {
    ...after,
    padsPicked: before.padsPicked + padsBetween(before.picked, after.picked),
    mended: before.mended + mendsBetween(before, after),
    slaps: before.slaps + (after.lastSlap && after.lastSlap !== before.lastSlap ? 1 : 0),
    meals: before.meals + Math.max(0, after.eaten - before.eaten),
    branchesStripped: before.branchesStripped + Math.max(0, sumOf(after.stripped) - sumOf(before.stripped)),
    longDives: before.longDives + (before.beaver.mode === 'dive' && before.beaver.breath > 0 && after.beaver.breath <= 0 ? 1 : 0),
    winterStocked: before.winterStocked || (intoWinter && lodgeComplete(after.lodge) && stockTotal(after.store) >= STORE_CAPACITY / 2 && mine(after, 'store')),
    winterClean: clean,
    longWinter: before.longWinter || (outOfWinter && before.winterClean),
  };
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
  neighbour: `Good neighbour achievement: you talked to ${NEIGHBOUR_FAMILIES} families`,
  rescuer: `Rescuer achievement: ${RESCUER_DIGS} beavers dug out`,
  generations: 'Long line achievement: three kits down the family line',
  diver: 'Diver achievement: a whole breath under water',
  explorer: 'Explorer achievement: all six places of the valley',
  tailSlap: `Tail slapper achievement: ${SLAP_COUNT} slaps`,
  wellFed: `Well fed achievement: ${WELL_FED_MEALS} meals eaten`,
  stripper: `Stripper achievement: ${STRIPPER_BRANCHES} branches stripped`,
  winterStore: 'Winter store achievement: a store half full as winter begins',
  manyDams: `Many dams achievement: ${MANY_DAMS} dams standing`,
  bigPond: 'Big pond achievement: a pond as big as a meadow',
  fixerUpper: `Fixer-upper achievement: ${FIXER_MENDS} pieces mended`,
  animalFriend: 'Animal friend achievement: a deer and a duck ate from your paw',
  pondLife: 'Pond life achievement: ducks and frogs on your pond',
  homesFar: 'Homes far and wide achievement: a home in all six places',
  sweetDreams: 'Sweet dreams achievement: your first dream',
  longWinter: 'Long winter achievement: a winter with food to the end',
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
  neighbour: 'Good neighbour',
  rescuer: 'Rescuer',
  generations: 'Long line',
  diver: 'Diver',
  explorer: 'Explorer',
  tailSlap: 'Tail slapper',
  wellFed: 'Well fed',
  stripper: 'Stripper',
  winterStore: 'Winter store',
  manyDams: 'Many dams',
  bigPond: 'Big pond',
  fixerUpper: 'Fixer-upper',
  animalFriend: 'Animal friend',
  pondLife: 'Pond life',
  homesFar: 'Homes far and wide',
  sweetDreams: 'Sweet dreams',
  longWinter: 'Long winter',
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
  neighbour: `Talk to beavers of ${NEIGHBOUR_FAMILIES} different families.`,
  rescuer: `Dig out ${RESCUER_DIGS} stuck beavers.`,
  generations: 'Play the kit of the kit of the kit of the first beaver.',
  diver: 'Dive and stay under water until you have to come up for air.',
  explorer: 'Visit all six places of the valley.',
  tailSlap: `Slap your tail ${SLAP_COUNT} times.`,
  wellFed: `Eat ${WELL_FED_MEALS} pieces of food.`,
  stripper: `Strip ${STRIPPER_BRANCHES} branches off logs.`,
  winterStore: 'Have your food store at least half full on the first day of winter.',
  manyDams: `Have ${MANY_DAMS} whole dams standing at the same time.`,
  bigPond: 'Make a big pond with one of your dams.',
  fixerUpper: `Mend ${FIXER_MENDS} worn pieces until they are as good as new.`,
  animalFriend: 'Put down a branch or a lily pad for a deer, and one for a duck. They eat it.',
  pondLife: 'Make a pond that is old enough for ducks and frogs. Go and see both.',
  homesFar: 'Have a lodge or a whole dam of yours in each of the six places of the valley.',
  sweetDreams: 'Sleep at night and have a dream.',
  longWinter: 'Live through a whole winter in your lodge and never let your food store run empty.',
};

/** The rows for the Things I did card: the line (as `achievementLines`) and the hint to show on a tap. */
export function achievementRows(world: Pick<WorldState, 'achievements' | 'felled' | 'padsPicked' | 'hauled' | 'journey' | 'met' | 'rescued' | 'slaps' | 'meals' | 'branchesStripped' | 'visited' | 'mended' | 'fedKinds' | 'guestKinds' | 'homesIn'>): { line: string; hint: string }[] {
  const lines = achievementLines(world);
  return ACHIEVEMENT_IDS.map((id, i) => ({ line: lines[i] ?? '', hint: ACHIEVEMENT_HINT[id] }));
}

/** The list for the test menu: one line per achievement, with a mark for won and the count where there is one. */
export function achievementLines(world: Pick<WorldState, 'achievements' | 'felled' | 'padsPicked' | 'hauled' | 'journey' | 'met' | 'rescued' | 'slaps' | 'meals' | 'branchesStripped' | 'visited' | 'mended' | 'fedKinds' | 'guestKinds' | 'homesIn'>): string[] {
  const count = (id: AchievementId): string => {
    if (world.achievements.includes(id)) return '';
    if (id === 'wood') return ` ${treesThisLife(world)}/${WOOD_TREES}`;
    if (id === 'gardener') return ` ${world.padsPicked}/${GARDENER_PADS}`;
    if (id === 'hauler') return ` ${world.hauled}/${HAULER_LOADS}`;
    if (id === 'neighbour') return ` ${Math.min(familiesMet(world), NEIGHBOUR_FAMILIES)}/${NEIGHBOUR_FAMILIES}`;
    if (id === 'rescuer') return ` ${Math.min(rescuesThisLife(world), RESCUER_DIGS)}/${RESCUER_DIGS}`;
    if (id === 'tailSlap') return ` ${Math.min(world.slaps, SLAP_COUNT)}/${SLAP_COUNT}`;
    if (id === 'wellFed') return ` ${Math.min(world.meals, WELL_FED_MEALS)}/${WELL_FED_MEALS}`;
    if (id === 'stripper') return ` ${Math.min(world.branchesStripped, STRIPPER_BRANCHES)}/${STRIPPER_BRANCHES}`;
    if (id === 'fixerUpper') return ` ${Math.min(world.mended, FIXER_MENDS)}/${FIXER_MENDS}`;
    if (id === 'animalFriend') return ` ${FRIEND_KINDS.filter((k) => world.fedKinds.includes(k)).length}/${FRIEND_KINDS.length}`;
    if (id === 'pondLife') return ` ${POND_KINDS.filter((k) => world.guestKinds.includes(k)).length}/${POND_KINDS.length}`;
    if (id === 'homesFar') return ` ${EXPLORER_PLACES.filter((p) => world.homesIn.includes(p)).length}/${EXPLORER_PLACES.length}`;
    if (id === 'explorer') return ` ${EXPLORER_PLACES.filter((p) => world.visited.includes(p)).length}/${EXPLORER_PLACES.length}`;
    return '';
  };
  return ACHIEVEMENT_IDS.map((id) => `${world.achievements.includes(id) ? '[x]' : '[ ]'} ${ACHIEVEMENT_NAME[id]}${count(id)}`);
}
