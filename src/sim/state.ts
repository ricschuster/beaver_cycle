// Simulation layer: game state and rules. No DOM, no three.js, no input, so
// another device can later drive or mirror it (ADR 0007).
import type { Escort } from './escort';
import type { Neighbour } from './neighbours';
import type { Leader } from './guides';
import type { Predator } from './predators';
import { START_CLOCK, nextDawn, nextSeasonStart, nextSpringStart, isNight } from './clock';
import { FIRST_PARENTS, coatOf, kitCoat, type Coat, type FormerHome } from './family';
import { bornAtFor, growUpDawn, stageAt, type Stage } from './life';
import { emptyStock, type Food, type Stock } from './food';
import { DOOR_DISTANCE, NEST, atNest, doorPoint, lodgeComplete, type Lodge } from './lodge';
import type { AchievementId } from './achievements';
import type { Dam } from './dam';
import type { DamSpot } from './damSpots';
import type { Dropped, Haul } from './haul';
import { mateOf, seedPartners, type Partner } from './partners';
import type { Pond } from './pond';
import type { ScentMound } from './scent';
import type { Met } from './talk';
import type { Log } from './logs';
import type { Terrain } from './terrain';
import type { Wear } from './wear';

export interface Journey {
  start: number;
  felled: number;
  inherited: string[];
}

export type BeaverMode = 'walk' | 'swim' | 'dive';

export interface BeaverState {
  x: number;
  /** Height of the feet in metres: the ground when walking, a little below the water surface when swimming, and deeper when diving. */
  y: number;
  z: number;
  mode: BeaverMode;
  /** Heading in radians, 0 faces +z. */
  heading: number;
  /** Breath left, 0 to 1. Drains under water, refills at the surface and on land. */
  breath: number;
}

/** A tail slap other beavers can hear: when and where it happened, in simulated time. */
export interface Slap {
  time: number;
  x: number;
  z: number;
}

export interface WorldState {
  /** Simulated seconds since the start. */
  time: number;
  /** Game clock in seconds from day 0 dawn. Runs at half rate in the lodge, and sleep skips it ahead. */
  clock: number;
  /** Clock value the player beaver was born at. Its life stage follows from the clock (`lifeAt`). */
  bornAt: number;
  /** The coat of the player beaver, from its parents' (`kitCoat`). */
  coat: Coat;
  /** The coats of Mama and Papa: the first family's, then the player beaver's and its partner's once a kit is born. */
  parentCoats: [Coat, Coat];
  /** Lives begun so far after the first, which the game announces. */
  generation: number;
  /** True while the beaver is in its lodge. Set by the build action near a whole lodge, and by the test toggle. */
  inLodge: boolean;
  beaver: BeaverState;
  /** The most recent tail slap, or null before the first. */
  lastSlap: Slap | null;
  /** The lodge, once its first log is placed, or null. One for now. */
  lodge: Lodge | null;
  /** Lodges the family has left (docs/design/23_leaving_and_next_baby.md). They stay solid, get old, and cannot be used. */
  formerHomes: FormerHome[];
  /** Other families of the valley, each with a whole lodge (`neighbours.ts`). Their lodges are solid. */
  neighbours: Neighbour[];
  /** The foxes and owls that have noticed the beaver and are in their meeting with it (`predators.ts`). */
  predators: Predator[];
  /** The clock the beaver was caught by a predator at, or null. It is slower while hurt, until a lily pad is eaten or a day passes. */
  hurtAt: number | null;
  /** The clock the beaver last ate a lily pad at, or null: it swims faster for a minute (`food.ts`). */
  padAt: number | null;
  /** The clock the beaver last ate a branch at, or null: it fells trees faster for a game day (`food.ts`). */
  branchAt: number | null;
  /** Winter drifts the player has dug a beaver out of, as `Stuck.id` (`escort.ts`). */
  rescued: string[];
  /** Family members the player rescued, who will show the way when asked (`escort.ts`). */
  guides: string[];
  /** The rescued beaver that is leading the player now, or null. Left out of the save. */
  escort: Escort | null;
  /** The otter or kingfisher leading the beaver to lily pads, or null (`guides.ts`). */
  leader: Leader | null;
  /** The clock each guide last led the beaver at, by animal id, so it does not lead again at once. */
  ledAt: Record<string, number>;
  /** What each beaver the player has talked to in this life remembers, by speaker id: how many talks, and when the last was (`talk.ts`). */
  met: Record<string, Met>;
  /** How much the animals the beaver has met trust it, 0 to 1, by animal id (`moods.ts`). Missing means the kind's starting trust. */
  trust: Record<string, number>;
  /** The clock each pond was first seen at, by dam spot: a pond is mature after a while (`pondGuests.ts`). */
  pondSince: Record<string, number>;
  /** Lone beavers about the valley, once the player beaver has left home (`partners.ts`). One may follow the player, and one live in the lodge. */
  partners: Partner[];
  /** Felled trees lying where they fell, and in water floating. */
  logs: Log[];
  /** The id of the log the beaver is dragging, or null. One at a time. */
  drag: string | null;
  /** Ids of the trees felled so far (`TreeRef.id`). Plain data, so a save keeps them. */
  felled: string[];
  /** The tree being gnawed and how many seconds are done, or null. Standing still is needed; moving stops it. */
  chop: { id: string; x: number; z: number; wood: number; progress: number } | null;
  /** The piece of food in the beaver's mouth, or null. A log being dragged and a piece in the mouth exclude each other. */
  carry: Food | null;
  /** Mud or a rock in the mouth, or null. Excludes food, and dragging a log (one thing at a time). */
  haul: Haul | null;
  /** Ids of the rocks picked up so far (`rocksNear`). A rock stays gone from where it lay. */
  rocksTaken: string[];
  /** Mud and rocks the beaver put down, where they lie. */
  dropped: Dropped[];
  /** The free dam spots of the play locations (`firstSpots`), set by the game. */
  spots: DamSpot[];
  /** Dams started or whole, one per spot. */
  dams: Dam[];
  /** The ponds the dams hold, worked out from `dams` and the ground when a dam's crest moves a step (`pondsAt`). */
  ponds: Pond[];
  /** The crest of each dam, by spot, the ponds were flooded at. */
  pondCrests: Record<string, number>;
  /** The food store beside the lodge door: what is in it. Usable once the lodge is whole. */
  store: Stock;
  /** True while the stash screen is open: the beaver stands still and the player moves pieces in and out of the store's places. */
  stashOpen: boolean;
  /** Wear of the food store, set when the lodge is whole. Missing means it never wears. */
  storeWear?: Wear;
  /** Branches stripped so far off each log, by log id, so a log runs out (`branchesOf`). */
  stripped: Record<string, number>;
  /** Lily pads picked, by pad id, with the year (`dateAt(clock).year`) they were picked: they grow back next year. */
  picked: Record<string, number>;
  /** Pieces eaten so far inside the lodge. Eating has no effect on the beaver yet (Q17), this only counts. */
  eaten: number;
  /** Ids of the achievements won so far (`achievements.ts`). They stay won. Each baby will start its own list later (Q40). */
  achievements: AchievementId[];
  /** Where this life's journey started (Q40): the clock then, the trees already felled, and the buildings earlier lives left (`inherited`: 'lodge', 'store', 'dam:<spot>'), which win nothing. */
  journey: Journey;
  /** Counters for achievements that need an event (`achievements.ts`): lily pads picked, pieces mended back to new, loads of mud and rock put on dams. */
  padsPicked: number;
  mended: number;
  hauled: number;
  /** More counters of this life (`achievements.ts`): tail slaps, pieces eaten, branches stripped, dives that ran the breath out, the play locations visited (by id), and whether the store was half full when winter began. */
  slaps: number;
  meals: number;
  branchesStripped: number;
  longDives: number;
  visited: string[];
  winterStocked: boolean;
  /** Still more of this life (`achievements.ts`): the kinds of animal fed, the kinds of pond guest seen on a pond of this life, the play locations with a home of this life (by id), a dream had, a winter in progress with the store never empty, and a whole such winter done. */
  fedKinds: string[];
  guestKinds: string[];
  homesIn: string[];
  dreamed: boolean;
  winterClean: boolean;
  longWinter: boolean;
  /** The scent mounds by the lodge, and the ids of those whose visitor the player has welcomed (`scent.ts`). Each life starts them again. */
  scents: ScentMound[];
  welcomed: string[];
  /** Test setting that scales movement speed (x1, x5, x20, x100). Not a game rule. */
  speedMultiplier: number;
}

// Speeds from docs/design/09_game_length_and_speed.md. Walk and swim were set by the author on desktop (2x the first values), still to tune on a tablet.
export const WALK_SPEED = 12;
export const SWIM_SPEED = 18;
/** Water this deep (metres) starts a swim; it ends below the lower depth, so the shore does not flicker. */
export const SWIM_ENTER_DEPTH = 0.6;
export const SWIM_EXIT_DEPTH = 0.4;
/** How far below the water surface a swimming beaver's feet hang, in metres. */
export const SWIM_SINK = 0.2;
/** Simulated seconds before the beaver can slap its tail again. */
export const SLAP_COOLDOWN = 1;
export const DIVE_SPEED = 14;
/** Metres per second the beaver sinks and rises. Not scaled by the test speed multiplier. */
export const DIVE_RATE = 2;
/** The beaver dives only in water at least this deep (metres), so there is room under it. */
export const DIVE_MIN_DEPTH = 1;
/** Feet height above the lake bed when diving along the bottom, in metres. */
export const DIVE_FLOOR = 0.15;

/** Simulated seconds of breath under water. A short time on purpose (Q24); the real beaver holds 15 minutes. Not set by the author yet. */
export const BREATH_TIME = 60;
/** Seconds to refill from empty at the surface or on land. */
export const BREATH_REFILL_TIME = 8;
/** An empty beaver must recover this much breath before it dives again, so it does not bob at the limit. */
export const BREATH_MIN_START = 0.2;

/**
 * Where the feet are and which mode the beaver is in at a point, given how it was
 * before. Walks on dry ground and in shallows, floats in deep water, and goes
 * down toward the bed while `dive` is held, up to the surface when it is not.
 */
export function settle(
  terrain: Terrain,
  x: number,
  z: number,
  before: { mode: BeaverMode; y: number },
  dive = false,
  dt = 0,
): { y: number; mode: BeaverMode } {
  const ground = terrain.heightAt(x, z);
  const depth = terrain.waterDepth(x, z);
  if (depth < (before.mode === 'walk' ? SWIM_ENTER_DEPTH : SWIM_EXIT_DEPTH)) return { y: ground, mode: 'walk' };
  const surface = ground + depth - SWIM_SINK;
  const floor = ground + DIVE_FLOOR;
  const from = before.mode === 'dive' ? before.y : surface;
  const target = dive && depth >= DIVE_MIN_DEPTH ? floor : surface;
  const reach = DIVE_RATE * dt;
  const y = Math.min(surface, Math.max(floor, from + Math.max(-reach, Math.min(reach, target - from))));
  return { y, mode: y < surface - 1e-6 ? 'dive' : 'swim' };
}

export function createWorld(terrain: Terrain, x = 0, z = 0): WorldState {
  const { y, mode } = settle(terrain, x, z, { mode: 'walk', y: 0 });
  return { time: 0, clock: START_CLOCK, bornAt: bornAtFor(START_CLOCK, 'adult'), coat: { coat: coatOf(START_CLOCK), shade: 0 }, parentCoats: [...FIRST_PARENTS], generation: 0, inLodge: false, beaver: { x, y, z, mode, heading: 0, breath: 1 }, lastSlap: null, lodge: null, formerHomes: [], neighbours: [], predators: [], hurtAt: null, padAt: null, branchAt: null, rescued: [], guides: [], escort: null, leader: null, ledAt: {}, met: {}, trust: {}, pondSince: {}, partners: [], logs: [], drag: null, felled: [], chop: null, carry: null, haul: null, rocksTaken: [], dropped: [], spots: [], dams: [], ponds: [], pondCrests: {}, store: emptyStock(), stashOpen: false, stripped: {}, picked: {}, eaten: 0, achievements: [], journey: { start: START_CLOCK, felled: 0, inherited: [] }, padsPicked: 0, mended: 0, hauled: 0, slaps: 0, meals: 0, branchesStripped: 0, longDives: 0, visited: [], winterStocked: false, fedKinds: [], guestKinds: [], homesIn: [], dreamed: false, winterClean: false, longWinter: false, scents: [], welcomed: [], speedMultiplier: 1 };
}

export function setSpeedMultiplier(world: WorldState, speedMultiplier: number): WorldState {
  return { ...world, speedMultiplier };
}

/** Put the beaver at a point, on the ground or on the water, keeping its heading. */
export function teleport(world: WorldState, terrain: Terrain, x: number, z: number): WorldState {
  return { ...world, beaver: { ...world.beaver, x, z, ...settle(terrain, x, z, { mode: 'walk', y: 0 }) } };
}

/** Test toggle until there is a lodge to enter: the clock runs at half speed while in. */
export function setInLodge(world: WorldState, inLodge: boolean): WorldState {
  return { ...world, inLodge };
}

/** The beaver can go to sleep only in its lodge, on the nest, and at night. */
export function canSleep(world: WorldState): boolean {
  return canRest(world) && isNight(world.clock);
}

/** The beaver can rest in its lodge, on the nest, at any hour. Resting lets it sleep ahead to a season or to growing up. */
export function canRest(world: WorldState): boolean {
  return world.inLodge && (!world.lodge || atNest(world.lodge, world.beaver.x, world.beaver.z));
}

/** Where a long sleep can end: the next season, or growing up (null for an adult, who has no next stage). */
export type SleepGoal = 'season' | 'grow';

/** Sleep ahead in the lodge to the dawn of a season or of growing up (Q47). Anything else leaves the world alone. */
export function sleepUntil(world: WorldState, goal: SleepGoal): WorldState {
  if (!canRest(world)) return world;
  const target = goal === 'season' ? nextSeasonStart(world.clock) : growUpDawn(world.clock, world.bornAt);
  return target !== null && target > world.clock ? { ...world, clock: target } : world;
}

/**
 * Sleep through the night: in the lodge at night, jump the clock to the next dawn. Otherwise nothing happens.
 * The dream (Q65) ends the same way, so both ways of sleeping wake the beaver here.
 */
export function sleep(world: WorldState): WorldState {
  if (!canSleep(world)) return world;
  return { ...world, clock: nextDawn(world.clock) };
}

/** Set the game clock directly. A test tool, like the speed multiplier. */
export function setClock(world: WorldState, clock: number): WorldState {
  // Age moves with the clock, so a test jump to another season or time does not make the beaver older or younger.
  return { ...world, clock, bornAt: world.bornAt + (clock - world.clock) };
}

/**
 * A new baby begins (Q34, Q40): a new list of achievements and counters, at the clock now. What stands is kept and gets old
 * (Q63), but it was not built in this life, so it wins nothing. Where the baby is born and who its family are come later. Nobody
 * has talked to the baby yet, so the beavers meet it afresh; a family's trust is kept, as it is for the whole family.
 */
export function newLife(world: WorldState): WorldState {
  const inherited = [...(world.lodge ? ['lodge'] : []), ...(world.storeWear ? ['store'] : []), ...world.dams.map((d) => `dam:${d.spot}`)];
  return {
    ...world,
    bornAt: world.clock,
    coat: kitCoat(world.parentCoats, world.clock),
    generation: world.generation + 1,
    achievements: [],
    met: {},
    journey: { start: world.clock, felled: world.felled.length, inherited },
    padsPicked: 0,
    mended: 0,
    hauled: 0,
    slaps: 0,
    meals: 0,
    branchesStripped: 0,
    longDives: 0,
    visited: [],
    winterStocked: false,
    fedKinds: [],
    guestKinds: [],
    homesIn: [],
    dreamed: false,
    winterClean: false,
    longWinter: false,
    scents: [],
    welcomed: [],
  };
}

/**
 * The grown beaver leaves home to start a family of its own (Q8, Q50). The lodge it grew up in stays and gets old (Q63),
 * with its food store, and the beaver has no home until it builds one. Without a lodge nothing changes. The lodge and store it
 * builds next are its own, so they stop counting as inherited (the Home and Pantry achievements can be won again).
 */
export function leaveHome(world: WorldState): WorldState {
  if (!world.lodge) return world;
  const b = world.beaver;
  // Out of the room, at the entrance, if the leaving came while the beaver was asleep inside.
  const out = world.inLodge ? { ...b, ...doorPoint(world.lodge, DOOR_DISTANCE), y: world.lodge.base, mode: 'walk' as const } : b;
  return { ...world, formerHomes: [...world.formerHomes, { ...world.lodge, wear: undefined, parents: world.parentCoats }], lodge: null, scents: [], store: emptyStock(), storeWear: undefined, stashOpen: false, inLodge: false, beaver: out, journey: { ...world.journey, inherited: world.journey.inherited.filter((i) => i !== 'lodge' && i !== 'store') } };
}

/** The lone beavers of the valley, put at the dam spots when the player beaver has left home. */
export function withPartners(world: WorldState, canLive?: (spot: DamSpot) => boolean): WorldState {
  return { ...world, partners: seedPartners(world.spots, world.formerHomes.at(-1) ?? world.beaver, canLive) };
}

/** A baby is born in the lodge, on its own nest (Q8, Q34). With no whole lodge the beaver stays where it is. */
export function intoLodge(world: WorldState): WorldState {
  const { lodge } = world;
  if (!lodgeComplete(lodge)) return world;
  return { ...world, inLodge: true, beaver: { ...world.beaver, x: lodge.x + NEST.x, z: lodge.z + NEST.z, y: lodge.base, mode: 'walk' } };
}

/** A kit is due on the first day of spring after the partner moved into a whole lodge (note 23). */
export function kitDue(world: Pick<WorldState, 'partners' | 'lodge' | 'clock' | 'bornAt'>): boolean {
  const mate = mateOf(world.partners);
  return mate !== null && mate.homeAt !== null && lodgeComplete(world.lodge) && world.clock >= nextSpringStart(mate.homeAt) && stageAt(world.clock, world.bornAt) === 'adult';
}

/**
 * A kit is born in the new lodge, and the player plays it (Q34, Q40, note 23). The grown beaver and its partner are now
 * Mama and Papa, in their own coats, and the kit has a slightly different shade of one of them. The lone beavers are done.
 */
export function birth(world: WorldState): WorldState {
  const mate = mateOf(world.partners);
  if (!mate) return world;
  const parents = [world.coat, { coat: mate.coat, shade: mate.shade }] as [Coat, Coat];
  return setStage(intoLodge(newLife({ ...world, parentCoats: parents, partners: [] })), 'baby');
}

/** Make the beaver just reach this life stage now. A test tool, and the ?stage= start. */
export function setStage(world: WorldState, stage: Stage): WorldState {
  return { ...world, bornAt: bornAtFor(world.clock, stage) };
}
