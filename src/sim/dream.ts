// The dream (docs/design/29_dream_candy_land.md): candy land, made new each night from a seed, with sweets on the path and in the
// chocolate river and a group of marshmallow beavers to play tag and hide and seek with. Its own small world: it never reads or
// changes the waking game's state. Pure, no DOM, no three.js. The ground and the props are laid out in dreamLand.ts.
import { t } from '../i18n';
import {
  BED_RADIUS,
  HILL_WIDTH,
  PROP_RADIUS,
  clamp,
  innerOf,
  landRise,
  lineDistance,
  makeLand,
  mixSeed,
  nearestOnLine,
  riverDistance,
  riverFrame,
  rngFrom,
  wanderSpots,
  withProps,
} from './dreamLand';

export { PROP_RADIUS };

export interface DreamPoint {
  x: number;
  z: number;
}

/** The chocolate's surface height. Land is above it, the river bed below. */
export const CHOCOLATE_LEVEL = 0;

/** Which dream: candy land, or the veggie garden (docs/design/50_veggie_garden_dream.md). The player picks at bedtime (Q85). */
export type DreamTheme = 'candy' | 'veggie';

export type PropKind =
  | 'lollipop'
  | 'gumdrop'
  | 'candyCane'
  | 'cupcake'
  | 'iceCream'
  | 'marshmallowRock'
  | 'cottonCandy'
  | 'cottonBush'
  | 'lettuceTree'
  | 'broccoliTree'
  | 'leek'
  | 'cabbage'
  | 'pumpkin'
  | 'radish'
  | 'beanPole';

export interface DreamProp {
  id: string;
  kind: PropKind;
  x: number;
  z: number;
  /** Scale, about 0.6 to 1.6. */
  size: number;
  /** Turn about the vertical axis, radians. */
  yaw: number;
  /** An index into `CANDY_COLOURS`. */
  colour: number;
  /** A marshmallow beaver can hide behind it. */
  hide: boolean;
}

/** A lily pad of white chocolate floats on the chocolate and is eaten when the beaver swims up (wish 7). */
export type SweetKind = 'drop' | 'swirl' | 'star' | 'lily';

export interface Sweet {
  id: string;
  kind: SweetKind;
  x: number;
  z: number;
  /** An index into `CANDY_COLOURS`. */
  colour: number;
  /** In the chocolate (it floats) or on land. */
  floating: boolean;
  taken: boolean;
}

/** A round pond of chocolate beside the river (wish 8): its middle and its radius at the surface, metres. */
export interface DreamPond {
  x: number;
  z: number;
  r: number;
}

/** A garden bed of the veggie dream (Q88): its middle, `BED_RADIUS` across. */
export interface DreamBed {
  x: number;
  z: number;
}

export interface DreamLand {
  seed: number;
  /** Candy land when missing. */
  theme?: DreamTheme;
  /** The garden beds of the veggie dream, where plants are grown with watering cans. */
  beds?: DreamBed[];
  /** The land is the square -half..half on x and z. Candy hills rise at its edges. 80 for candy land, 120 for the veggie garden. */
  half: number;
  /** The little path, from the start to the river bank, as points about 2 m apart. */
  path: DreamPoint[];
  /** The centre line of the chocolate river, as points about 2 m apart, crossing the land from edge to edge. */
  river: DreamPoint[];
  /** Full width of the chocolate at its surface, metres. */
  riverWidth: number;
  /** Where the beaver wakes up in the dream, at the start of the path, facing along it. */
  start: DreamPoint & { heading: number };
  props: DreamProp[];
  /** The golden beaver statue (wish 10): a long speed boost to whoever touches it. New place each night. */
  statue: DreamPoint;
  /** Two or three more ponds to play in, each with lily pads and a marshmallow beaver. */
  ponds: DreamPond[];
}

export type DreamMode = 'walk' | 'swim';

export interface DreamBeaver {
  x: number;
  /** Height of the feet: the ground on land, the chocolate surface afloat, more while hopping. */
  y: number;
  z: number;
  /** Facing, radians, 0 along +z, as in the waking game. */
  heading: number;
  /** Ground speed now, metres per second (the model's pace). */
  speed: number;
  mode: DreamMode;
  /** Dream time of the last hop or leap, or null. */
  hopAt: number | null;
  /** Dream time of the last tail slap, or null. */
  slapAt: number | null;
  /** The last hop was a leap out of the chocolate (`LEAP_TIME`, `LEAP_HEIGHT`), not a hop on land. */
  leap?: boolean;
}

/** `count`, `seek` and `home` are for hide and seek with the player hiding: counting at the base, looking, and back at the base. */
export type MallowState = 'wander' | 'greet' | 'follow' | 'chase' | 'flee' | 'hide' | 'hidden' | 'found' | 'count' | 'seek' | 'home' | 'water';

/** The vegetables a veggie beaver can be, given out in this order (Q86). */
export type VegKind = 'pea' | 'carrot' | 'tomato' | 'radish' | 'pumpkin';
export const VEGS: readonly VegKind[] = ['pea', 'carrot', 'tomato', 'radish', 'pumpkin'];
/** Their names, given out in this order from the first until the garden is full (Q86). */
export const VEG_NAMES: readonly string[] = ['Veggie', 'Spice', 'Planty', 'Cabbagey', 'Kale', 'Lettuce'];

export interface Mallow extends DreamBeaver {
  id: string;
  name: string;
  /** In the veggie garden: the vegetable this beaver is. */
  veg?: VegKind;
  /** Growing a plant: it carries a full watering can, and has watered its plant this many times. */
  can?: boolean;
  watered?: number;
  /** An index into `MALLOW_COLOURS`. */
  colour: number;
  state: MallowState;
  /** The prop it hides behind in hide and seek. */
  hideAt?: string;
  /** Dream time of its last giggle, or null. */
  giggleAt: number | null;
  /** It has said hello to the player this dream. */
  met: boolean;
  /** Where it is headed: a wander spot, or its hiding place. */
  goal?: DreamPoint;
  /** Dream time its pause, hello, wait, or pop out ends. */
  until?: number;
  /** Dream time of its next happy hop, jink, or giggle. */
  nextAt?: number;
  /** Which way it dodges while fleeing in tag, -1 to 1. */
  jink?: number;
  /** A seeker: the prop it is going to look behind, and the props it has looked behind this round. */
  peek?: string;
  looked?: string[];
}

export type DreamGame =
  | { kind: 'none' }
  /** `it` is 'player' or a mallow id. `ends` is the dream time the round ends. `catches` counts every catch either way. */
  | {
      kind: 'tag';
      it: string;
      players: string[];
      /** Dream time the one who is it now became it. */
      since: number;
      ends: number;
      catches: number;
      /** Dream time from which the one who is it may catch: no tag-backs straight away. */
      calm?: number;
      /** Who a marshmallow beaver that is it chases: 'player' or a mallow id. */
      chase?: string;
      /** Dream time the player left the chocolate, while out of it. */
      dryAt?: number;
    }
  /** Play on land asks first: does the player hide or seek? `with` is the marshmallow beaver Play was pressed by. */
  | { kind: 'choose'; with: string }
  /** Counting: the player counts to ten while the hiders run off. Seeking: until all are found. */
  | { kind: 'seek'; phase: 'counting' | 'seeking'; until: number; hiders: string[]; found: string[] }
  /**
   * The player hides. Counting: the seekers count to ten at `base` while the player runs off. Seeking: they look until all
   * have found the player or `until`, a minute on. `found` is the seekers that have found the player.
   */
  | { kind: 'hide'; phase: 'counting' | 'seeking'; until: number; base: DreamPoint; seekers: string[]; found: string[] }
  /** Growing plants in the garden beds: the player and some veggie beavers water one each; the first to full size, else the biggest at `ends`, wins. `can` is the player's can being full. */
  | { kind: 'grow'; ends: number; can: boolean };

/** A plant in a garden bed: its stage from 0 (a seed) to `GROW_STAGES`. `owner` is 'player' or a veggie beaver's id. */
export interface Plant {
  bed: number;
  owner: string;
  stage: number;
}

/** A cotton candy boat on the chocolate river (wish 1, Q80): Do gets in or out, the stick steers. `heading` is the way its bow points. */
export interface DreamBoat {
  id: string;
  x: number;
  z: number;
  heading: number;
}

/** A candy dam across the chocolate or a candy lodge on land, raised log by log (wish 6). `heading` is the way across the dam. */
export interface DreamBuild {
  kind: 'dam' | 'lodge';
  x: number;
  z: number;
  heading: number;
  /** Candy logs put on so far. It is whole at `DAM_LOGS` or `LODGE_LOGS`. */
  logs: number;
}

export interface DreamState {
  land: DreamLand;
  /** Seconds since the dream began. */
  time: number;
  beaver: DreamBeaver;
  mallows: Mallow[];
  sweets: Sweet[];
  /** Sweets collected this dream. */
  count: number;
  /** Dream time the sugar rush from a star ends. */
  rushUntil: number;
  /** The statue has been touched this dream. */
  statueTouched?: boolean;
  /** The beaver carries a candy log from a tree it chopped. */
  carrying?: boolean;
  /** The candy dam and lodge begun or finished this dream, one of each at most. They do not stay for other dreams (Q81). */
  builds?: DreamBuild[];
  /** The cotton candy boats on the river, the one the beaver is in following it (candy land only). */
  boats?: DreamBoat[];
  /** The id of the boat the beaver is in, while it rides. */
  aboard?: string;
  /** The plants of the last garden game this dream, grown or not (the veggie garden). */
  plants?: Plant[];
  game: DreamGame;
  /** The seeded random source's state, carried from step to step so the same inputs give the same dream. */
  rng?: number;
}

/** What the player wants this frame. `move` is on the ground plane, already turned to the view (`relativeToView`). */
export interface DreamInput {
  move: { x: number; z: number };
  /** The Dive control went down this frame: hop or leap. */
  hop: boolean;
  /** The Slap control went down this frame: splash. */
  slap: boolean;
  /** The Build control went down this frame: start a game with the nearest marshmallow beaver. */
  play: boolean;
  /** The player picked this frame, while asked: hide or seek. */
  pick?: 'hide' | 'seek';
}

export type DreamEvent =
  | { what: 'sweet'; kind: SweetKind; x: number; z: number }
  | { what: 'rush' }
  /** A candy tree came down and the beaver has its log. */
  | { what: 'chop'; x: number; z: number }
  /** A log went on the dam or the lodge; `done` when that was the last. */
  | { what: 'build'; kind: 'dam' | 'lodge'; logs: number; done: boolean; x: number; z: number }
  /** The golden beaver statue was touched: a long rush. */
  | { what: 'statue'; x: number; z: number }
  /** The beaver got into a boat, or out of it onto the bank. */
  | { what: 'board'; x: number; z: number }
  | { what: 'leave'; x: number; z: number }
  | { what: 'greet'; who: string }
  | { what: 'splash'; x: number; z: number }
  | { what: 'tagStart'; it: string }
  /** `it` is who is it now ('player' or a name), `by` who caught whom. */
  | { what: 'caught'; it: string; by: string }
  | { what: 'tagEnd'; catches: number }
  | { what: 'seekStart'; hiders: number }
  | { what: 'seekGo' }
  | { what: 'giggle'; who: string; x: number; z: number }
  | { what: 'found'; who: string; left: number }
  | { what: 'seekEnd' }
  | { what: 'hideStart'; seekers: number }
  | { what: 'hideGo' }
  /** A seeker found the hiding player; `left` are still looking. */
  | { what: 'spotted'; who: string; left: number }
  /** The player's hiding is over: `found` of the `seekers` found them. */
  | { what: 'hideEnd'; found: number; seekers: number }
  | { what: 'shower'; count: number }
  /** The veggie garden: a game of growing plants began with `friends` beavers; someone filled a can; someone watered a plant to `stage`; it ended with `winner` ('player' or a name). */
  | { what: 'growStart'; friends: number }
  | { what: 'fill'; who: string; x: number; z: number }
  | { what: 'water'; who: string; stage: number; x: number; z: number }
  | { what: 'growEnd'; winner: string };

/** Pastel coats for the marshmallow beavers: fur, darker fur for legs and ears, and belly, as in `COATS` of the beaver model. */
export const MALLOW_COLOURS: readonly { fur: number; dark: number; belly: number }[] = [
  { fur: 0xf7c6d9, dark: 0xe79ab8, belly: 0xfde6ee },
  { fur: 0xbfeedd, dark: 0x8fd6bd, belly: 0xe4f8f0 },
  { fur: 0xfbefa8, dark: 0xeed872, belly: 0xfff8d6 },
  { fur: 0xc3dcf7, dark: 0x93bce8, belly: 0xe5f0fc },
  { fur: 0xdccbf3, dark: 0xb9a1e3, belly: 0xefe6fa },
  { fur: 0xfbd5bb, dark: 0xf0b48c, belly: 0xfdebdd },
  { fur: 0xfaf7f2, dark: 0xe6dfd4, belly: 0xffffff },
];

/** Bright candy colours for props and sweets. */
export const CANDY_COLOURS: readonly number[] = [0xff6fa8, 0x7fd6ff, 0xffd84d, 0x9be36b, 0xc08bff, 0xff9f5a, 0xffffff];

/** The colour of the chocolate river. */
export const CHOCOLATE = 0x6b3b1f;


/** The beaver walks and swims at these speeds (m/s). A star's sugar rush makes it this much faster for this many seconds. */
export const WALK_SPEED = 4;
export const SWIM_SPEED = 3.5;
export const RUSH = 1.6;
export const RUSH_TIME = 6;
/** Chocolate deeper than this is swum; a swimmer walks again where it is shallower than `SWIM_OUT` (metres). */
const SWIM_IN = 0.35;
const SWIM_OUT = 0.25;
/** A hop on land and a leap out of the chocolate: seconds in the air, and height at the top (metres). */
export const HOP_TIME = 0.6;
export const HOP_HEIGHT = 0.7;
export const LEAP_TIME = 0.9;
export const LEAP_HEIGHT = 1.1;
/** Turning, radians per second, for the beaver and for a marshmallow beaver. */
const TURN = 9;
const MALLOW_TURN = 6;
const SLAP_COOLDOWN = 0.4;
/** The beaver stays this far inside the edge of the land; the hills slow it on the way out. */
const EDGE = 3;
/** Half the beaver's body, for bumping into props (metres). */
const BODY = 0.35;
/** A sweet this close (metres, across the ground) is taken. A star counts this many. */
const TAKE_REACH = 1.0;
const STAR_COUNT = 5;
/** A white chocolate lily pad counts this many, and a pond or the river carries them (wish 7). */
const LILY_COUNT = 2;
const LILIES_PER_POND = 4;
/** The golden beaver statue gives a rush this long (seconds), and is touched from this close (metres). */
export const STATUE_RUSH_TIME = 20;
/** Growing plants: stages to full size, how long a game lasts, how close a bed or the river's edge must be, and how many beavers join (Q88). */
export const GROW_STAGES = 6;
export const GROW_TIME = 150;
const BED_REACH = 2.4;
const GROW_FRIENDS = 3;
const WATER_PAUSE = 1.2;
const STATUE_REACH = 1.4;
/** A boat goes this fast (m/s, a little quicker than swimming), needs this much chocolate under it, and is boarded from this close to it (metres). */
export const BOAT_SPEED = 4.6;
const BOAT_DEPTH = 0.5;
const BOAT_REACH = 2.6;
/** The boat's floor stands this high over the chocolate, and a beaver gets out onto land this far from the boat at most. */
export const BOAT_LIFT = 0.18;
const LEAVE_REACH = 4.5;
const BOAT_COUNT = 3;
/** Marshmallow beavers amble at these speeds (m/s), and say hello the first time the player is this close (metres). */
const MALLOW_WALK = 1.6;
const MALLOW_SWIM = 2;
const GREET_REACH = 6;
const GREET_TIME = 2;
/** The Build control starts a game with a marshmallow beaver this close (metres). */
const PROMPT_REACH = 4;
/** Tag: who joins, how long a round lasts, the speeds, and the catching (metres, seconds, m/s). */
const TAG_JOIN = 25;
export const TAG_TIME = 60;
const CHASE_SPEED = 3.1;
const FLEE_FROM_PLAYER = 3.0;
const FLEE_FROM_MALLOW = 2.7;
const FLEE_REACH = 9;
const CATCH_REACH = 1.1;
const NO_TAG_BACK = 2;
/** A new it stands this long before it chases, so the caught one gets away. */
const IT_WAIT = 1.2;
/** A marshmallow beaver that is it chases the player this share of the time, another player the rest. */
const CHASE_PLAYER = 0.7;
/** Out of the chocolate this long, the player ends the round. */
const DRY_END = 8;
/** A player of tag keeps to chocolate at least this deep. */
const WET = 0.45;
/** Hide and seek: who joins, the count, the run, how far the hiding places are, the giggles and the finding. */
const SEEK_JOIN = 35;
export const COUNT_TIME = 10;
const HIDE_SPEED = 3;
const HIDE_NEAR = 12;
const HIDE_FAR = 40;
const GIGGLE_MIN = 5;
const GIGGLE_SPREAD = 4;
const HEAR_REACH = 25;
const FIND_REACH = 2.5;
const POP_TIME = 0.8;
/** After the last is found, they follow the player this long before they wander off. */
const FOLLOW_AFTER = 4;
/**
 * Hiding from them: the choice closes when the player walks this far from the one asked, at most this many seek, they walk
 * a little slower than the player, and stop to look behind a prop this long. They see the player this near unless a hiding
 * prop is in the way, and find them anyway this near; now and then they go straight to the prop nearest the player. Near
 * the player they giggle. The seeking lasts a minute.
 */
const CHOOSE_REACH = 8;
const SEEKERS = 4;
export const SEEK_SPEED = 3.2;
const PEEK_TIME = 1;
export const SEE_REACH = 7;
const SPOT_REACH = 1.8;
const HUNCH = 0.2;
const LOOK_FAR = 50;
const NEAR_GIGGLE = 10;
export const HIDE_TIME = 60;
/** Sweets in the shower at the end of a game. */
export const SHOWER = 12;

const TAU = Math.PI * 2;
const NAMES = ['Puff', 'Fluffy', 'Squish', 'Mallow', 'Pillow', 'Sugar', 'Cloud', 'Toffee', 'Bounce', 'Dumpling', 'Nougat', 'Button', 'Fudge', 'Sprinkle', 'Cocoa', 'Velvet'];

const dist2 = (a: DreamPoint, b: DreamPoint): number => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const ease = (v: number, want: number, dt: number, rate: number): number => v + (want - v) * Math.min(1, dt * rate);

function turnToward(h: number, target: number, max: number): number {
  const d = ((((target - h + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  if (Math.abs(d) <= max) return target;
  const n = h + Math.sign(d) * max;
  return n > Math.PI ? n - TAU : n < -Math.PI ? n + TAU : n;
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/** How high a hop or leap lifts the feet at a dream time (metres), 0 when not in the air. */
export function hopLift(b: Pick<DreamBeaver, 'hopAt' | 'leap'>, time: number): number {
  if (b.hopAt === null) return 0;
  const p = (time - b.hopAt) / (b.leap ? LEAP_TIME : HOP_TIME);
  return p <= 0 || p >= 1 ? 0 : 4 * (b.leap ? LEAP_HEIGHT : HOP_HEIGHT) * p * (1 - p);
}

const hopping = (b: Pick<DreamBeaver, 'hopAt' | 'leap'>, time: number): boolean =>
  b.hopAt !== null && time - b.hopAt < (b.leap ? LEAP_TIME : HOP_TIME);

function modeAt(land: DreamLand, x: number, z: number, was: DreamMode): DreamMode {
  const d = chocolateDepth(land, x, z);
  return d > SWIM_IN || (was === 'swim' && d > SWIM_OUT) ? 'swim' : 'walk';
}

const baseY = (land: DreamLand, x: number, z: number, mode: DreamMode): number =>
  mode === 'swim' ? CHOCOLATE_LEVEL : dreamHeight(land, x, z);

/** Mode and height for where a beaver now is, hop included. */
function settle<T extends DreamBeaver>(land: DreamLand, b: T, time: number): T {
  const mode = modeAt(land, b.x, b.z, b.mode);
  return { ...b, mode, y: baseY(land, b.x, b.z, mode) + hopLift(b, time) };
}

/**
 * Dams and lodges kept from earlier dreams (Q81, #708) set into this night's land. The land is new, so the river is somewhere
 * else: a dam goes across the river at the point nearest where it stood, and a lodge stays where it stood, or on the nearest dry
 * clear ground when the new land has a river or a prop there.
 */
export function keptInLand(land: DreamLand, kept: readonly DreamBuild[]): DreamBuild[] {
  const placed: DreamBuild[] = [];
  for (const k of kept) {
    if (k.kind === 'dam') {
      let at = 0;
      land.river.forEach((p, i) => {
        if (dist2(p, k) < dist2(land.river[at]!, k)) at = i;
      });
      const here = land.river[at]!;
      const a = land.river[Math.max(0, at - 1)]!;
      const b = land.river[Math.min(land.river.length - 1, at + 1)]!;
      placed.push({ ...k, x: here.x, z: here.z, heading: Math.atan2(-(b.z - a.z), b.x - a.x) });
      continue;
    }
    const fits = (x: number, z: number): boolean =>
      Math.abs(x) < innerOf(land.half) &&
      Math.abs(z) < innerOf(land.half) &&
      riverDistance(land, x, z) - land.riverWidth / 2 > LODGE_CLEAR + BANK_GAP &&
      dreamHeight(land, x, z) > CHOCOLATE_LEVEL + 0.3 &&
      clearOfProps(land, x, z, LODGE_CLEAR);
    let spot: DreamPoint | null = fits(k.x, k.z) ? { x: k.x, z: k.z } : null;
    for (let r = 3; r <= 60 && !spot; r += 3) {
      for (let i = 0; i < 12 && !spot; i++) {
        const x = k.x + Math.sin((i / 12) * TAU) * r;
        const z = k.z + Math.cos((i / 12) * TAU) * r;
        if (fits(x, z)) spot = { x, z };
      }
    }
    placed.push({ ...k, ...(spot ?? { x: k.x, z: k.z }) });
  }
  return placed;
}

/** A new dream from a seed (any integer). The same seed makes the same dream. `kept` are the dams and lodges the player kept. */
export function newDream(seed: number, kept: readonly DreamBuild[] = [], theme: DreamTheme = 'candy'): DreamState {
  const land = makeLand(seed, theme);
  const rand = rngFrom(mixSeed(seed, 3)).next;
  const sweets = makeSweets(land, rand);
  const mallows = makeMallows(land, rand);
  const { x, z, heading } = land.start;
  const beaver: DreamBeaver = { x, y: dreamHeight(land, x, z), z, heading, speed: 0, mode: 'walk', hopAt: null, slapAt: null };
  const dream: DreamState = { land, time: 0, beaver, mallows, sweets, count: 0, rushUntil: 0, game: { kind: 'none' }, rng: mixSeed(seed, 4) };
  if (theme === 'candy') dream.boats = makeBoats(land);
  // The veggie garden has no chopping or building, so nothing is kept for it.
  return kept.length > 0 && theme === 'candy' ? { ...dream, builds: keptInLand(land, kept) } : dream;
}

/**
 * Three cotton candy boats moored on the river: the first by where the path meets it, so the beaver finds it at once, the others
 * further along, each on the side nearer the bank, pointing downstream.
 */
function makeBoats(land: DreamLand): DreamBoat[] {
  const inner = innerOf(land.half) - 4;
  const ok = land.river.map((p, i) => ({ p, i })).filter(({ p }) => Math.abs(p.x) < inner && Math.abs(p.z) < inner);
  if (ok.length === 0) return [];
  const end = land.path[land.path.length - 1]!;
  let first = ok[0]!;
  for (const o of ok) if (dist2(o.p, end) < dist2(first.p, end)) first = o;
  const picks = [first];
  for (const at of [0.2, 0.8]) {
    const guess = ok[Math.floor((ok.length - 1) * at)]!;
    if (picks.every((o) => dist2(o.p, guess.p) > 20 * 20)) picks.push(guess);
  }
  return picks.slice(0, BOAT_COUNT).map(({ p, i }, n) => {
    const a = land.river[Math.max(0, i - 1)]!;
    const b = land.river[Math.min(land.river.length - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = -(b.z - a.z) / len;
    const nz = (b.x - a.x) / len;
    const toward = n === 0 ? Math.sign((end.x - p.x) * nx + (end.z - p.z) * nz) || 1 : n % 2 === 0 ? 1 : -1;
    const off = (land.riverWidth / 2) * 0.45 * toward;
    return { id: `b${n}`, x: p.x + nx * off, z: p.z + nz * off, heading: Math.atan2(b.x - a.x, b.z - a.z) };
  });
}

const clearOfProps = (land: DreamLand, x: number, z: number, gap: number): boolean =>
  land.props.every((p) => (p.x - x) ** 2 + (p.z - z) ** 2 > (PROP_RADIUS[p.kind] * p.size + gap) ** 2);

/** About 40 to 60 sweets: along the path a little off it, floating down the river, and over the land; a few are stars. */
function makeSweets(land: DreamLand, rand: () => number): Sweet[] {
  const w2 = land.riverWidth / 2;
  const inner = innerOf(land.half);
  const more = (land.half / 80) ** 2;
  const spots: DreamPoint[] = [];
  const across = (line: readonly DreamPoint[], i: number): DreamPoint => {
    const a = line[Math.max(0, i - 1)]!;
    const b = line[Math.min(line.length - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: -(b.z - a.z) / len, z: (b.x - a.x) / len };
  };
  for (let i = 2; i < land.path.length - 1; i += 2) {
    const p = land.path[i]!;
    const n = across(land.path, i);
    const off = (rand() < 0.5 ? -1 : 1) * (0.4 + rand());
    const s = { x: p.x + n.x * off, z: p.z + n.z * off };
    if (clearOfProps(land, s.x, s.z, 0.6)) spots.push(s);
  }
  for (let i = 0; i < land.river.length; i += 4) {
    const p = land.river[i]!;
    if (Math.abs(p.x) > inner - 2 || Math.abs(p.z) > inner - 2) continue;
    const n = across(land.river, i);
    const off = (rand() * 2 - 1) * w2 * 0.5;
    spots.push({ x: p.x + n.x * off, z: p.z + n.z * off });
  }
  const want = Math.round((40 + Math.floor(rand() * 21)) * more);
  for (let attempt = 0; attempt < 2000 * more && spots.length < want; attempt++) {
    const x = (rand() * 2 - 1) * (inner - 2);
    const z = (rand() * 2 - 1) * (inner - 2);
    if (riverDistance(land, x, z) < w2 + 1 || !clearOfProps(land, x, z, 0.6) || nearPond(land, x, z, 1)) continue;
    if (spots.some((q) => dist2(q, { x, z }) < 9)) continue;
    spots.push({ x, z });
  }
  const stars = new Set(shuffle(spots.map((_, i) => i), rand).slice(0, 3 + Math.floor(rand() * 3)));
  const made: Sweet[] = spots.map((p, i) => ({
    id: `s${i}`,
    kind: stars.has(i) ? 'star' : rand() < 0.6 ? 'drop' : 'swirl',
    x: p.x,
    z: p.z,
    colour: Math.floor(rand() * CANDY_COLOURS.length),
    floating: chocolateDepth(land, p.x, p.z) > 0.05,
    taken: false,
  }));
  return [...made, ...makeLilies(land, rand, made.length)];
}

/** Whether a point is in a pond or within `gap` metres of its edge. */
export const nearPond = (land: DreamLand, x: number, z: number, gap: number): boolean => land.ponds.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + gap);

/** White chocolate lily pads: a few in each pond, and some on the river where the beaver swims. */
function makeLilies(land: DreamLand, rand: () => number, from: number): Sweet[] {
  const spots: DreamPoint[] = [];
  const inner = innerOf(land.half);
  for (const o of land.ponds) {
    for (let i = 0; i < LILIES_PER_POND; i++) {
      const a = ((i + rand() * 0.6) / LILIES_PER_POND) * TAU;
      const r = o.r * (0.2 + rand() * 0.5);
      spots.push({ x: o.x + Math.sin(a) * r, z: o.z + Math.cos(a) * r });
    }
  }
  for (let i = 3; i < land.river.length; i += 5) {
    const p = land.river[i]!;
    if (Math.abs(p.x) > inner - 2 || Math.abs(p.z) > inner - 2) continue;
    const { out } = riverFrame(land, p.x + 0.3, p.z + 0.3);
    const off = (rand() * 2 - 1) * land.riverWidth * 0.3;
    spots.push({ x: p.x + out.x * off, z: p.z + out.z * off });
  }
  return spots
    .filter((p) => chocolateDepth(land, p.x, p.z) > 0.2)
    .map((p, i) => ({ id: `s${from + i}`, kind: 'lily' as const, x: p.x, z: p.z, colour: 0, floating: true, taken: false }));
}

/** One marshmallow beaver in each coat, with its own name: three on land by the end of the path, the rest in the river. */
function makeMallows(land: DreamLand, rand: () => number): Mallow[] {
  const w2 = land.riverWidth / 2;
  const veggie = land.theme === 'veggie';
  // Veggie beavers are given out in order from the first: five vegetables and six names, round again (Q86).
  const names = veggie ? [...VEG_NAMES] : shuffle([...NAMES], rand);
  const colours = veggie ? VEG_NAMES.map((_, i) => i) : shuffle(MALLOW_COLOURS.map((_, i) => i), rand);
  const count = veggie ? VEG_NAMES.length : MALLOW_COLOURS.length;
  const end = land.path[land.path.length - 1]!;
  const places: DreamPoint[] = [];
  const free = (p: DreamPoint, gap: number): boolean =>
    Math.abs(p.x) < innerOf(land.half) - 2 && Math.abs(p.z) < innerOf(land.half) - 2 && places.every((q) => dist2(p, q) > gap * gap) && clearOfProps(land, p.x, p.z, 0.8);
  for (let attempt = 0; attempt < 300 && places.length < 3; attempt++) {
    const a = rand() * TAU;
    const r = 3 + rand() * 7;
    const p = { x: end.x + Math.sin(a) * r, z: end.z + Math.cos(a) * r };
    if (riverDistance(land, p.x, p.z) < w2 + 1 || lineDistance(land.path, p.x, p.z) < 1.2) continue;
    if (free(p, 3)) places.push(p);
  }
  for (const o of land.ponds) {
    if (places.length >= count) break;
    const p = { x: o.x + (rand() * 2 - 1) * o.r * 0.3, z: o.z + (rand() * 2 - 1) * o.r * 0.3 };
    if (free(p, 3)) places.push(p);
  }
  let near = 0;
  land.river.forEach((p, i) => {
    if (dist2(p, end) < dist2(land.river[near]!, end)) near = i;
  });
  for (let attempt = 0; attempt < 600 && places.length < count; attempt++) {
    const i = places.length < 5 ? near + (rand() < 0.5 ? -1 : 1) * (3 + Math.floor(rand() * 7)) : Math.floor(rand() * land.river.length);
    const c = land.river[i];
    if (!c) continue;
    const { out } = riverFrame(land, c.x + 0.3, c.z + 0.3);
    const off = (rand() * 2 - 1) * w2 * 0.35;
    const p = { x: c.x + out.x * off, z: c.z + out.z * off };
    if (free(p, 5)) places.push(p);
  }
  while (places.length < count) places.push({ x: end.x + places.length, z: end.z });
  return places.map((p, k) => {
    const mode: DreamMode = chocolateDepth(land, p.x, p.z) > SWIM_IN ? 'swim' : 'walk';
    return {
      id: `m${k}`,
      name: names[k]!,
      colour: colours[k]!,
      ...(veggie ? { veg: VEGS[k % VEGS.length]! } : {}),
      x: p.x,
      y: baseY(land, p.x, p.z, mode),
      z: p.z,
      heading: rand() * TAU - Math.PI,
      speed: 0,
      mode,
      hopAt: null,
      slapAt: null,
      state: 'wander',
      giggleAt: null,
      met: false,
    };
  });
}

/** Ground height at a point: above `CHOCOLATE_LEVEL` on land, below it in the river channel, rising in the hills at the edges. */
export function dreamHeight(land: DreamLand, x: number, z: number): number {
  return CHOCOLATE_LEVEL + landRise(land, x, z);
}

/** How deep the chocolate is at a point, 0 on land. */
export function chocolateDepth(land: DreamLand, x: number, z: number): number {
  return Math.max(0, CHOCOLATE_LEVEL - dreamHeight(land, x, z));
}

/** One step of the dream: the beaver, sweets, marshmallow beavers and the games. Returns the new state and what happened. */
export function stepDream(state: DreamState, input: DreamInput, dt: number): { state: DreamState; events: DreamEvent[] } {
  const events: DreamEvent[] = [];
  const rng = rngFrom(state.rng ?? mixSeed(state.land.seed, 4));
  const rand = rng.next;
  const time = state.time + dt;
  let s: DreamState = { ...state, time, beaver: moveBeaver(state, input, time, dt, events) };
  s = collect(s, events);
  s = touchStatue(s, events);
  s = carryBoat(s);
  if (input.play && s.game.kind === 'none') {
    if (bedAt(s) !== null) s = startGrow(s, events);
    else if (s.aboard || boatNear(s)) s = s.aboard ? leaveBoat(s, events) : boardBoat(s, events);
    else s = playmate(s) ? startGame(s, rand, events) : work(s, events);
  }
  else if (input.play && s.game.kind === 'grow') s = tend(s, s.game, events);
  if (s.game.kind === 'choose') s = chooseRules(s, s.game, input.pick, rand, events);
  s = { ...s, mallows: stepMallows(s, rand, dt, events) };
  if (s.game.kind === 'tag') s = tagRules(s, s.game, rand, events);
  else if (s.game.kind === 'seek') s = seekRules(s, s.game, rand, events);
  else if (s.game.kind === 'hide') s = hideRules(s, s.game, rand, events);
  else if (s.game.kind === 'grow') s = growRules(s, s.game, events);
  return { state: { ...s, rng: rng.state() }, events };
}

/** The hills slow the part of a move that heads out to the edge. */
function outward(pos: number, v: number, half: number): number {
  const t = clamp((Math.abs(pos) - (half - HILL_WIDTH)) / HILL_WIDTH, 0, 1);
  return t > 0 && Math.sign(v) === Math.sign(pos) ? v * (1 - 0.85 * t) : v;
}

/** The beaver slides round the props it bumps into. */
function pastProps(land: DreamLand, x: number, z: number): DreamPoint {
  for (const p of land.props) {
    const r = PROP_RADIUS[p.kind] * p.size + BODY;
    const dx = x - p.x;
    const dz = z - p.z;
    if (Math.abs(dx) >= r || Math.abs(dz) >= r) continue;
    const d = Math.hypot(dx, dz);
    if (d >= r) continue;
    if (d < 1e-6) x = p.x + r;
    else {
      x = p.x + (dx / d) * r;
      z = p.z + (dz / d) * r;
    }
  }
  return { x, z };
}

/** The boat the beaver rides: it steers with the stick on the chocolate, and stops where the river gets shallow. */
function sail(s: DreamState, input: DreamInput, time: number, dt: number, events: DreamEvent[]): DreamBeaver {
  const b = s.beaver;
  const land = s.land;
  const len = Math.hypot(input.move.x, input.move.z);
  const steer = len > 0.05;
  const rush = time < s.rushUntil ? RUSH : 1;
  const heading = steer ? turnToward(b.heading, Math.atan2(input.move.x, input.move.z), TURN * dt) : b.heading;
  const speed = ease(b.speed, steer ? BOAT_SPEED * Math.min(1, len) * rush : 0, dt, 4);
  const lim = land.half - EDGE;
  const afloat = (x: number, z: number): boolean => Math.abs(x) <= lim && Math.abs(z) <= lim && chocolateDepth(land, x, z) >= BOAT_DEPTH;
  const vx = Math.sin(heading) * speed;
  const vz = Math.cos(heading) * speed;
  let x = b.x;
  let z = b.z;
  // Along the bank it slides: try the whole move, then each axis alone.
  if (afloat(x + vx * dt, z + vz * dt)) {
    x += vx * dt;
    z += vz * dt;
  } else if (afloat(x + vx * dt, z)) x += vx * dt;
  else if (afloat(x, z + vz * dt)) z += vz * dt;
  let slapAt = b.slapAt;
  if (input.slap && (slapAt === null || time - slapAt >= SLAP_COOLDOWN)) {
    slapAt = time;
    events.push({ what: 'splash', x, z });
  }
  return { ...b, x, z, heading, speed: Math.hypot(x - b.x, z - b.z) / Math.max(dt, 1e-6), mode: 'swim', y: CHOCOLATE_LEVEL + BOAT_LIFT, hopAt: null, slapAt, leap: false };
}

function moveBeaver(s: DreamState, input: DreamInput, time: number, dt: number, events: DreamEvent[]): DreamBeaver {
  if (s.aboard) return sail(s, input, time, dt, events);
  const b = s.beaver;
  const land = s.land;
  const len = Math.hypot(input.move.x, input.move.z);
  const steer = len > 0.05;
  const rush = time < s.rushUntil ? RUSH : 1;
  // A leap out of the chocolate keeps going forward, like a dolphin's.
  const leaping = b.leap === true && hopping(b, time);
  let want = steer ? (b.mode === 'swim' ? SWIM_SPEED : WALK_SPEED) * Math.min(1, len) * rush : 0;
  if (leaping) want = Math.max(want, SWIM_SPEED * rush);
  const heading = steer ? turnToward(b.heading, Math.atan2(input.move.x, input.move.z), TURN * dt) : b.heading;
  const speed = ease(b.speed, want, dt, 6);
  const ux = steer ? input.move.x / len : Math.sin(heading);
  const uz = steer ? input.move.z / len : Math.cos(heading);
  const lim = land.half - EDGE;
  const vx = outward(b.x, ux * speed, land.half);
  const vz = outward(b.z, uz * speed, land.half);
  const p = pastProps(land, clamp(b.x + vx * dt, -lim, lim), clamp(b.z + vz * dt, -lim, lim));
  const mode = modeAt(land, p.x, p.z, b.mode);
  let hopAt = b.hopAt;
  let leap = b.leap;
  if (input.hop && !hopping(b, time)) {
    hopAt = time;
    leap = mode === 'swim';
  }
  let slapAt = b.slapAt;
  if (input.slap && (slapAt === null || time - slapAt >= SLAP_COOLDOWN)) {
    slapAt = time;
    const bank = riverDistance(land, p.x, p.z) < land.riverWidth / 2 + 1.5;
    if (mode === 'swim' || bank) events.push({ what: 'splash', x: p.x, z: p.z });
  }
  const after = { ...b, x: p.x, z: p.z, heading, speed: Math.hypot(vx, vz), mode, hopAt, slapAt, leap };
  return { ...after, y: baseY(land, p.x, p.z, mode) + hopLift(after, time) };
}

/** Candy logs a dam and a lodge take, and the trees that can be chopped (the lollipop and the cotton candy tree). */
export const DAM_LOGS = 3;
export const LODGE_LOGS = 4;
const CHOPPABLE: readonly PropKind[] = ['lollipop', 'cottonCandy'];
/** The veggie garden has plants to grow instead of trees to chop. */
const choppable = (land: DreamLand): readonly PropKind[] => (land.theme === 'veggie' ? [] : CHOPPABLE);
/** A tree is chopped from this close to its trunk's edge, and a dam is raised from this close to the chocolate's edge (metres). */
const CHOP_REACH = 1.6;
const DAM_REACH = 2.5;
/** A lodge needs this much clear ground (metres from its middle) and stands this far ahead of the beaver. */
const LODGE_CLEAR = 2.2;
const LODGE_AHEAD = 2;

const builtOf = (s: DreamState, kind: DreamBuild['kind']): DreamBuild | undefined => s.builds?.find((b) => b.kind === kind);
const need = (kind: DreamBuild['kind']): number => (kind === 'dam' ? DAM_LOGS : LODGE_LOGS);

/** The tree the beaver would chop: the nearest choppable one within reach. */
function treeAt(s: DreamState): DreamProp | null {
  let best: DreamProp | null = null;
  let bestD = Infinity;
  for (const p of s.land.props) {
    if (!choppable(s.land).includes(p.kind)) continue;
    const reach = PROP_RADIUS[p.kind] * p.size + BODY + CHOP_REACH;
    const d = dist2(p, s.beaver);
    if (d < reach * reach && d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

/** Where a log would go now, or null: on the dam when by the chocolate, else on the lodge a step ahead on clear land. */
function buildSpot(s: DreamState): DreamBuild | null {
  const b = s.beaver;
  const land = s.land;
  const bank = riverDistance(land, b.x, b.z) - land.riverWidth / 2;
  if (bank < DAM_REACH) {
    const dam = builtOf(s, 'dam');
    if (dam) return dam.logs < DAM_LOGS ? dam : null;
    const { out } = riverFrame(land, b.x, b.z);
    const d = riverDistance(land, b.x, b.z);
    return { kind: 'dam', x: b.x - out.x * d, z: b.z - out.z * d, heading: Math.atan2(out.x, out.z), logs: 0 };
  }
  const lodge = builtOf(s, 'lodge');
  if (lodge) return lodge.logs < LODGE_LOGS && dist2(lodge, b) < 6 * 6 ? lodge : null;
  const x = b.x + Math.sin(b.heading) * LODGE_AHEAD;
  const z = b.z + Math.cos(b.heading) * LODGE_AHEAD;
  const dry = riverDistance(land, x, z) - land.riverWidth / 2 > LODGE_CLEAR + BANK_GAP && dreamHeight(land, x, z) > CHOCOLATE_LEVEL + 0.3;
  return dry && clearOfProps(land, x, z, LODGE_CLEAR) ? { kind: 'lodge', x, z, heading: b.heading, logs: 0 } : null;
}
const BANK_GAP = 1;

/** What the Do control would do now when no marshmallow beaver is near, for the prompt, or null. */
export function workPrompt(state: DreamState): string | null {
  if (state.game.kind !== 'none') return null;
  if (state.carrying) {
    const spot = buildSpot(state);
    if (!spot) return null;
    return t(spot.logs === 0 ? (spot.kind === 'dam' ? 'dream.startDam' : 'dream.startLodge') : spot.kind === 'dam' ? 'dream.addDam' : 'dream.addLodge');
  }
  return treeAt(state) ? t('dream.chop') : null;
}

/** Do with no one to play with: chop a tree for a log, or put the log on the dam or the lodge. Nothing wears and nothing is saved. */
function work(s: DreamState, events: DreamEvent[]): DreamState {
  if (s.game.kind !== 'none') return s;
  if (!s.carrying) {
    const tree = treeAt(s);
    if (!tree) return s;
    events.push({ what: 'chop', x: tree.x, z: tree.z });
    return { ...s, land: withProps(s.land, s.land.props.filter((p) => p.id !== tree.id)), carrying: true };
  }
  const spot = buildSpot(s);
  if (!spot) return s;
  const raised = { ...spot, logs: spot.logs + 1 };
  const builds = [...(s.builds ?? []).filter((b) => b.kind !== spot.kind), raised];
  events.push({ what: 'build', kind: spot.kind, logs: raised.logs, done: raised.logs >= need(spot.kind), x: spot.x, z: spot.z });
  return { ...s, carrying: false, builds };
}

/** The boat nearest the beaver and within reach of it, when the beaver is not in one, or null. */
function boatNear(s: DreamState): DreamBoat | null {
  if (s.aboard) return null;
  let best: DreamBoat | null = null;
  let bestD = BOAT_REACH * BOAT_REACH;
  for (const boat of s.boats ?? []) {
    const d = dist2(boat, s.beaver);
    if (d < bestD) {
      best = boat;
      bestD = d;
    }
  }
  return best;
}

/** The boat the beaver is in goes where the beaver goes. */
function carryBoat(s: DreamState): DreamState {
  if (!s.aboard) return s;
  const b = s.beaver;
  return { ...s, boats: (s.boats ?? []).map((boat) => (boat.id === s.aboard ? { ...boat, x: b.x, z: b.z, heading: b.heading } : boat)) };
}

/** Do next to a boat: climb in. The beaver stands in the boat, facing the way the bow points. */
function boardBoat(s: DreamState, events: DreamEvent[]): DreamState {
  const boat = boatNear(s);
  if (!boat) return s;
  events.push({ what: 'board', x: boat.x, z: boat.z });
  const beaver: DreamBeaver = { ...s.beaver, x: boat.x, z: boat.z, heading: boat.heading, speed: 0, mode: 'swim', y: CHOCOLATE_LEVEL + BOAT_LIFT, hopAt: null, leap: false };
  return { ...s, aboard: boat.id, beaver };
}

/** The nearest dry, clear spot to climb out onto, preferring the way the boat points, or null when no bank is near. */
function landingSpot(s: DreamState): DreamPoint | null {
  const b = s.beaver;
  const land = s.land;
  const lim = land.half - EDGE;
  for (let r = 1.8; r <= LEAVE_REACH; r += 0.9) {
    for (let i = 0; i < 16; i++) {
      // Straight ahead first, then to either side, then behind.
      const turn = Math.ceil(i / 2) * (i % 2 === 0 ? 1 : -1) * (TAU / 16);
      const a = b.heading + turn;
      const x = b.x + Math.sin(a) * r;
      const z = b.z + Math.cos(a) * r;
      if (Math.abs(x) > lim || Math.abs(z) > lim) continue;
      if (chocolateDepth(land, x, z) > SWIM_OUT * 0.8 || !clearOfProps(land, x, z, BODY + 0.2)) continue;
      return { x, z };
    }
  }
  return null;
}

/** Do in a boat: step out onto the bank, if one is near. The boat stays where it floats. */
function leaveBoat(s: DreamState, events: DreamEvent[]): DreamState {
  const spot = landingSpot(s);
  if (!spot) return s;
  events.push({ what: 'leave', x: spot.x, z: spot.z });
  const b = s.beaver;
  const heading = Math.atan2(spot.x - b.x, spot.z - b.z);
  const beaver: DreamBeaver = { ...b, x: spot.x, z: spot.z, heading, speed: 0, mode: 'walk', y: dreamHeight(s.land, spot.x, spot.z), hopAt: s.time, leap: false };
  return { ...s, aboard: undefined, beaver };
}

/** What Do would do about a boat now, for the prompt, or null: get in when next to one, get out when a bank is near. */
function boatPrompt(s: DreamState): string | null {
  if (s.aboard) return landingSpot(s) ? t('dream.leaveBoat') : null;
  return boatNear(s) ? t('dream.boardBoat') : null;
}

/** Touching the golden beaver statue starts a long sugar rush, once a dream. */
function touchStatue(s: DreamState, events: DreamEvent[]): DreamState {
  if (s.statueTouched || dist2(s.land.statue, s.beaver) >= STATUE_REACH * STATUE_REACH) return s;
  events.push({ what: 'statue', x: s.land.statue.x, z: s.land.statue.z });
  return { ...s, statueTouched: true, rushUntil: s.time + STATUE_RUSH_TIME };
}

/** Sweets the beaver touches are taken; a star starts a sugar rush. */
function collect(s: DreamState, events: DreamEvent[]): DreamState {
  const b = s.beaver;
  if (!s.sweets.some((w) => !w.taken && dist2(w, b) < TAKE_REACH * TAKE_REACH)) return s;
  let count = s.count;
  let rushUntil = s.rushUntil;
  const sweets = s.sweets.map((w) => {
    if (w.taken || dist2(w, b) >= TAKE_REACH * TAKE_REACH) return w;
    events.push({ what: 'sweet', kind: w.kind, x: w.x, z: w.z });
    count += w.kind === 'star' ? STAR_COUNT : w.kind === 'lily' ? LILY_COUNT : 1;
    if (w.kind === 'star') {
      rushUntil = s.time + RUSH_TIME;
      events.push({ what: 'rush' });
    }
    return { ...w, taken: true };
  });
  return { ...s, sweets, count, rushUntil };
}

/** The marshmallow beaver the Build control would play with: the nearest within reach. */
function playmate(s: DreamState): Mallow | null {
  let best: Mallow | null = null;
  let bestD = PROMPT_REACH * PROMPT_REACH;
  for (const m of s.mallows) {
    const d = dist2(m, s.beaver);
    if (d < bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

const inChocolate = (s: DreamState): boolean => chocolateDepth(s.land, s.beaver.x, s.beaver.z) > 0.15;

/** What the Build control would start now, for the prompt, such as "Play tag with Puff", or null when nothing. */
export function playPrompt(state: DreamState): string | null {
  if (state.game.kind === 'grow') return tendPrompt(state, state.game);
  if (state.game.kind !== 'none') return null;
  if (bedAt(state) !== null) return t('dream.startGrow');
  if (state.aboard || boatNear(state)) return boatPrompt(state);
  const m = playmate(state);
  if (!m) return workPrompt(state);
  return inChocolate(state) ? t('dream.playTag', { name: m.name }) : t('dream.playSeek', { name: m.name });
}

/** The marshmallow beaver's name while the player is asked to hide or seek, else null. */
export function hideOrSeek(state: DreamState): string | null {
  const g = state.game;
  return g.kind === 'choose' ? state.mallows.find((m) => m.id === g.with)?.name ?? null : null;
}

/** In the chocolate Play starts tag. On land it asks first whether the player hides or seeks. */
function startGame(s: DreamState, rand: () => number, events: DreamEvent[]): DreamState {
  const chosen = playmate(s);
  if (!chosen) return s;
  return inChocolate(s) ? startTag(s, chosen, rand, events) : { ...s, game: { kind: 'choose', with: chosen.id } };
}

/** The player's pick starts the game; walking off, or the one asked being gone, drops the question. */
function chooseRules(s: DreamState, g: Extract<DreamGame, { kind: 'choose' }>, pick: DreamInput['pick'], rand: () => number, events: DreamEvent[]): DreamState {
  const chosen = s.mallows.find((m) => m.id === g.with);
  if (!chosen || dist2(chosen, s.beaver) > CHOOSE_REACH * CHOOSE_REACH) return { ...s, game: { kind: 'none' } };
  if (pick === 'seek') {
    const started = startSeek(s, chosen, rand, events);
    return started.game.kind === 'seek' ? started : { ...s, game: { kind: 'none' } };
  }
  if (pick === 'hide') return startHide(s, chosen, events);
  return s;
}

const backToWander = (m: Mallow): Mallow => ({
  ...m,
  state: 'wander',
  goal: undefined,
  until: undefined,
  nextAt: undefined,
  jink: undefined,
  hideAt: undefined,
  peek: undefined,
  looked: undefined,
  can: undefined,
  watered: undefined,
});

function startTag(s: DreamState, chosen: Mallow, rand: () => number, events: DreamEvent[]): DreamState {
  const t = s.time;
  const players = [chosen.id, ...s.mallows.filter((m) => m !== chosen && dist2(m, s.beaver) < TAG_JOIN * TAG_JOIN).map((m) => m.id)];
  const mallows = s.mallows.map((m): Mallow => {
    if (m === chosen) return { ...backToWander(m), state: 'chase', met: true, until: t + IT_WAIT, hopAt: t, leap: m.mode === 'swim' };
    if (!players.includes(m.id)) return m;
    return { ...backToWander(m), state: 'flee', met: true, jink: rand() < 0.5 ? -1 : 1 };
  });
  events.push({ what: 'tagStart', it: chosen.name });
  return { ...s, mallows, game: { kind: 'tag', it: chosen.id, players, since: t, ends: t + TAG_TIME, catches: 0, calm: t + NO_TAG_BACK, chase: 'player' } };
}

function startSeek(s: DreamState, chosen: Mallow, rand: () => number, events: DreamEvent[]): DreamState {
  const joining = [chosen, ...s.mallows.filter((m) => m !== chosen && dist2(m, s.beaver) < SEEK_JOIN * SEEK_JOIN)];
  const places = hidingPlaces(s.land, joining, s.beaver, rand);
  const hiders = joining.filter((m) => places.has(m.id)).map((m) => m.id);
  if (hiders.length === 0) return s;
  const mallows = s.mallows.map((m): Mallow => {
    const at = places.get(m.id);
    return at ? { ...backToWander(m), state: 'hide', met: true, hideAt: at.prop, goal: at.spot } : m;
  });
  events.push({ what: 'seekStart', hiders: hiders.length });
  return { ...s, mallows, game: { kind: 'seek', phase: 'counting', until: s.time + COUNT_TIME, hiders, found: [] } };
}

/** A distinct hiding place for each hider: behind a hiding prop 12 to 40 m from the player, on the side away from them. */
function hidingPlaces(land: DreamLand, hiders: readonly Mallow[], from: DreamPoint, rand: () => number): Map<string, { prop: string; spot: DreamPoint }> {
  const w2 = land.riverWidth / 2;
  const behind = (p: DreamProp): DreamPoint | null => {
    const d = Math.hypot(p.x - from.x, p.z - from.z) || 1;
    const dx = (p.x - from.x) / d;
    const dz = (p.z - from.z) / d;
    const r = Math.max(0.5, PROP_RADIUS[p.kind] * p.size) + 0.6;
    for (const turn of [0, 0.6, -0.6, 1.2, -1.2]) {
      const q = { x: p.x + (dx * Math.cos(turn) - dz * Math.sin(turn)) * r, z: p.z + (dx * Math.sin(turn) + dz * Math.cos(turn)) * r };
      if (Math.abs(q.x) < innerOf(land.half) && Math.abs(q.z) < innerOf(land.half) && riverDistance(land, q.x, q.z) > w2 + 0.5) return q;
    }
    return null;
  };
  // The places wanted, then farther or nearer ones, then any prop, so each hider finds one.
  const tiers: ((p: DreamProp, d: number) => boolean)[] = [
    (p, d) => p.hide && d >= HIDE_NEAR && d <= HIDE_FAR,
    (p, d) => p.hide && d >= HIDE_NEAR && d <= 60,
    (p, d) => p.hide && d >= 6,
    (p, d) => p.size >= 1 && p.kind !== 'candyCane' && d >= 6,
    () => true,
  ];
  const used = new Set<string>();
  const out = new Map<string, { prop: string; spot: DreamPoint }>();
  for (const m of hiders) {
    for (const ok of tiers) {
      let best: { prop: string; spot: DreamPoint } | null = null;
      let bestScore = Infinity;
      for (const p of land.props) {
        if (used.has(p.id) || !ok(p, Math.hypot(p.x - from.x, p.z - from.z))) continue;
        // Mostly the place nearest the hider, so it gets there during the count.
        const score = Math.hypot(p.x - m.x, p.z - m.z) + rand() * 10;
        if (score >= bestScore) continue;
        const spot = behind(p);
        if (!spot) continue;
        best = { prop: p.id, spot };
        bestScore = score;
      }
      if (best) {
        used.add(best.prop);
        out.set(m.id, best);
        break;
      }
    }
  }
  return out;
}

/** A marshmallow beaver goes along (dx, dz) at up to `want` m/s, turning smoothly; `wet` keeps one in the chocolate. */
function go(s: DreamState, m: Mallow, dx: number, dz: number, want: number, dt: number, wet = false): Mallow {
  const land = s.land;
  const len = Math.hypot(dx, dz);
  const moving = len > 1e-3 && want > 0.05;
  const heading = moving ? turnToward(m.heading, Math.atan2(dx, dz), MALLOW_TURN * dt) : m.heading;
  const speed = ease(m.speed, moving ? want : 0, dt, 4);
  const ux = moving ? dx / len : Math.sin(heading);
  const uz = moving ? dz / len : Math.cos(heading);
  let p = { x: m.x + ux * speed * dt, z: m.z + uz * speed * dt };
  if (wet) p = keepWet(land, m.x, m.z, p.x, p.z);
  const inner = innerOf(land.half);
  return settle(land, { ...m, x: clamp(p.x, -inner, inner), z: clamp(p.z, -inner, inner), heading, speed }, s.time);
}

const stand = (s: DreamState, m: Mallow, dt: number, wet = false): Mallow => go(s, m, 0, 0, 0, dt, wet);

function face(s: DreamState, m: Mallow, p: DreamPoint, dt: number): Mallow {
  const still = stand(s, m, dt);
  return { ...still, heading: turnToward(m.heading, Math.atan2(p.x - m.x, p.z - m.z), MALLOW_TURN * dt) };
}

/** A step that would leave the deep chocolate slides along the river instead, a little inward, or stops. */
function keepWet(land: DreamLand, ox: number, oz: number, nx: number, nz: number): DreamPoint {
  if (chocolateDepth(land, ox, oz) < WET || chocolateDepth(land, nx, nz) >= WET) return { x: nx, z: nz };
  const { out, along } = riverFrame(land, ox, oz);
  const k = (nx - ox) * along.x + (nz - oz) * along.z;
  const p = { x: ox + along.x * k - out.x * Math.abs(k) * 0.3, z: oz + along.z * k - out.z * Math.abs(k) * 0.3 };
  return chocolateDepth(land, p.x, p.z) >= WET ? p : { x: ox, z: oz };
}

const amble = (m: Mallow): number => (m.mode === 'swim' ? MALLOW_SWIM : MALLOW_WALK);

function stepMallows(s: DreamState, rand: () => number, dt: number, events: DreamEvent[]): Mallow[] {
  const slots = new Map<string, number>();
  for (const m of s.mallows) if (m.state === 'follow' || m.state === 'found') slots.set(m.id, slots.size);
  const moved = s.mallows.map((m) => stepMallow(s, m, rand, dt, events, slots.get(m.id) ?? 0));
  return apart(moved, innerOf(s.land.half));
}

/** Marshmallow beavers on the move nudge each other apart a little (not one that is it, so it can catch). */
function apart(mallows: Mallow[], inner: number): Mallow[] {
  const GAP = 1.2;
  const push = mallows.map(() => ({ x: 0, z: 0 }));
  const free = (m: Mallow): boolean => m.state !== 'hidden' && m.state !== 'hide' && m.state !== 'chase';
  let any = false;
  for (let i = 0; i < mallows.length; i++) {
    for (let j = i + 1; j < mallows.length; j++) {
      const a = mallows[i]!;
      const b = mallows[j]!;
      if (!free(a) || !free(b)) continue;
      const d2 = dist2(a, b);
      if (d2 >= GAP * GAP) continue;
      const d = Math.sqrt(d2);
      const ux = d > 1e-6 ? (a.x - b.x) / d : 1;
      const uz = d > 1e-6 ? (a.z - b.z) / d : 0;
      const k = (GAP - d) / 4;
      push[i]!.x += ux * k;
      push[i]!.z += uz * k;
      push[j]!.x -= ux * k;
      push[j]!.z -= uz * k;
      any = true;
    }
  }
  if (!any) return mallows;
  return mallows.map((m, i) => {
    const p = push[i]!;
    return p.x === 0 && p.z === 0 ? m : { ...m, x: clamp(m.x + p.x, -inner, inner), z: clamp(m.z + p.z, -inner, inner) };
  });
}

function stepMallow(s: DreamState, m: Mallow, rand: () => number, dt: number, events: DreamEvent[], slot: number): Mallow {
  const b = s.beaver;
  const t = s.time;
  switch (m.state) {
    case 'wander':
      return wander(s, m, rand, dt, events);
    case 'greet': {
      // It comes up to say hello, hops, and goes back to its wandering.
      const moved = dist2(m, b) > 2.2 * 2.2 ? go(s, m, b.x - m.x, b.z - m.z, amble(m), dt) : face(s, m, b, dt);
      return m.until === undefined || t >= m.until ? backToWander({ ...moved, met: true }) : moved;
    }
    case 'chase':
      return chase(s, m, rand, dt);
    case 'flee':
      return flee(s, m, rand, dt);
    case 'hide': {
      const g = m.goal ?? m;
      const d = Math.sqrt(dist2(m, g));
      if (d < 0.3) {
        const prop = s.land.props.find((p) => p.id === m.hideAt);
        const heading = prop ? Math.atan2(prop.x - g.x, prop.z - g.z) : m.heading;
        return settle(s.land, { ...m, x: g.x, z: g.z, speed: 0, heading, state: 'hidden', nextAt: undefined }, t);
      }
      return go(s, m, g.x - m.x, g.z - m.z, Math.min(HIDE_SPEED, 0.5 + d * 3), dt);
    }
    case 'hidden': {
      // Giggles now and then once the seeking has begun, heard only by a player near enough.
      const g = s.game;
      if (g.kind !== 'seek' || g.phase !== 'seeking') return m;
      if (m.nextAt === undefined) return { ...m, nextAt: t + GIGGLE_MIN + rand() * GIGGLE_SPREAD };
      if (t < m.nextAt) return m;
      const next = { ...m, nextAt: t + GIGGLE_MIN + rand() * GIGGLE_SPREAD };
      if (dist2(m, b) > HEAR_REACH * HEAR_REACH) return next;
      events.push({ what: 'giggle', who: m.name, x: m.x, z: m.z });
      return { ...next, giggleAt: t };
    }
    case 'count':
    case 'home': {
      // At the base: counting with their faces to it, or back after finding the player and watching them.
      const g = m.goal ?? m;
      const d = Math.sqrt(dist2(m, g));
      if (d > 0.4) return go(s, m, g.x - m.x, g.z - m.z, Math.min(HIDE_SPEED, 0.5 + d * 3), dt);
      const game = s.game;
      return face(s, m, m.state === 'count' && game.kind === 'hide' ? game.base : b, dt);
    }
    case 'seek':
      return seek(s, m, rand, dt, events);
    case 'water':
      return water(s, m, rand, dt, events);
    case 'found': {
      const faced = face(s, m, b, dt);
      return m.until === undefined || t >= m.until ? { ...faced, state: 'follow', until: undefined } : faced;
    }
    case 'follow': {
      if (m.until !== undefined && t >= m.until) return backToWander(m);
      // A loose group behind the player, two by two.
      const row = Math.floor(slot / 2);
      const back = 2.2 + row * 0.9;
      const side = (slot % 2 === 0 ? -1 : 1) * (0.8 + row * 0.2);
      const h = b.heading;
      const tx = b.x - Math.sin(h) * back + Math.cos(h) * side;
      const tz = b.z - Math.cos(h) * back - Math.sin(h) * side;
      const d = Math.hypot(tx - m.x, tz - m.z);
      return d < 0.4 ? face(s, m, b, dt) : go(s, m, tx - m.x, tz - m.z, Math.min(7, 0.8 + d * 1.5), dt);
    }
  }
}

/** A wander spot 4 to 16 m off, or the nearest one when none is. */
function pickSpot(land: DreamLand, m: Mallow, rand: () => number): DreamPoint {
  const spots = wanderSpots(land);
  const near = spots.filter((p) => {
    const d = dist2(p, m);
    return d > 16 && d < 256;
  });
  if (near.length > 0) return near[Math.floor(rand() * near.length)]!;
  let best = spots[0] ?? { x: 0, z: 0 };
  for (const p of spots) if (dist2(p, m) < dist2(best, m)) best = p;
  return best;
}

function wander(s: DreamState, m: Mallow, rand: () => number, dt: number, events: DreamEvent[]): Mallow {
  const b = s.beaver;
  const t = s.time;
  // The one asked waits for the answer, looking at the player.
  if (s.game.kind === 'choose' && s.game.with === m.id) return face(s, { ...m, met: true }, b, dt);
  if (!m.met && dist2(m, b) < GREET_REACH * GREET_REACH) {
    events.push({ what: 'greet', who: m.name });
    return settle(s.land, { ...m, state: 'greet', met: true, until: t + GREET_TIME, hopAt: t, leap: m.mode === 'swim', goal: undefined }, t);
  }
  let next = m;
  // Happy hops now and then.
  if (next.nextAt === undefined) next = { ...next, nextAt: t + 3 + rand() * 6 };
  else if (t >= next.nextAt && !hopping(next, t)) next = { ...next, hopAt: t, leap: next.mode === 'swim', nextAt: t + 4 + rand() * 7 };
  const goal = next.goal;
  if (!goal) {
    if (next.until !== undefined && t < next.until) return stand(s, next, dt);
    return stand(s, { ...next, goal: pickSpot(s.land, next, rand), until: undefined }, dt);
  }
  const d = Math.sqrt(dist2(next, goal));
  if (d < 0.6) return stand(s, { ...next, goal: undefined, until: t + 1.5 + rand() * 3 }, dt);
  return go(s, next, goal.x - next.x, goal.z - next.z, Math.min(amble(next), 0.3 + d * 1.5), dt);
}

/** The bed the beaver stands at, for starting a game of growing, or null. A game needs a veggie beaver to play with. */
function bedAt(s: DreamState): number | null {
  const beds = s.land.beds;
  if (!beds || s.mallows.length === 0) return null;
  let best: number | null = null;
  let bestD = BED_REACH * BED_REACH;
  beds.forEach((bed, i) => {
    const d = dist2(bed, s.beaver);
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

/** The nearest dry spot on the river bank to a bed, where a can is filled. */
export function bankSpot(land: DreamLand, bed: DreamPoint): DreamPoint {
  const near = nearestOnLine(land.river, bed.x, bed.z);
  const away = Math.hypot(bed.x - near.x, bed.z - near.z) || 1;
  const d = land.riverWidth / 2 + 0.9;
  return { x: near.x + ((bed.x - near.x) / away) * d, z: near.z + ((bed.z - near.z) / away) * d };
}

const onBank = (s: DreamState): boolean => riverDistance(s.land, s.beaver.x, s.beaver.z) - s.land.riverWidth / 2 < DAM_REACH;

/** The bed of the player's plant. */
const ownBed = (s: DreamState): DreamPoint | null => {
  const mine = s.plants?.find((p) => p.owner === 'player');
  return mine ? s.land.beds?.[mine.bed] ?? null : null;
};

/** What the Do control does in a game of growing now, for the prompt: fill the can at the river, or water the plant at its bed. */
function tendPrompt(s: DreamState, g: Extract<DreamGame, { kind: 'grow' }>): string | null {
  const bed = ownBed(s);
  if (g.can) return bed && dist2(bed, s.beaver) < BED_REACH * BED_REACH ? t('dream.waterPlant') : null;
  return onBank(s) ? t('dream.fillCan') : null;
}

function tend(s: DreamState, g: Extract<DreamGame, { kind: 'grow' }>, events: DreamEvent[]): DreamState {
  const bed = ownBed(s);
  const b = s.beaver;
  if (g.can) {
    if (!bed || dist2(bed, b) >= BED_REACH * BED_REACH) return s;
    const plants = (s.plants ?? []).map((p) => (p.owner === 'player' ? { ...p, stage: Math.min(GROW_STAGES, p.stage + 1) } : p));
    events.push({ what: 'water', who: 'player', stage: plants.find((p) => p.owner === 'player')!.stage, x: bed.x, z: bed.z });
    return { ...s, plants, game: { ...g, can: false } };
  }
  if (!onBank(s)) return s;
  events.push({ what: 'fill', who: 'player', x: b.x, z: b.z });
  return { ...s, game: { ...g, can: true } };
}

/** Do at a bed: the player and the nearest veggie beavers (up to three) each get a bed and a seed, and the beavers go for their cans. */
function startGrow(s: DreamState, events: DreamEvent[]): DreamState {
  const beds = s.land.beds ?? [];
  const mine = bedAt(s);
  if (mine === null) return s;
  const friends = [...s.mallows].sort((p, q) => dist2(p, s.beaver) - dist2(q, s.beaver)).slice(0, Math.min(GROW_FRIENDS, beds.length - 1));
  const free = beds.map((_, i) => i).filter((i) => i !== mine);
  const plants: Plant[] = [{ bed: mine, owner: 'player', stage: 0 }, ...friends.map((m, k) => ({ bed: free[k]!, owner: m.id, stage: 0 }))];
  const mallows = s.mallows.map((m): Mallow => (friends.includes(m) ? { ...backToWander(m), state: 'water', met: true, watered: 0, can: false } : m));
  events.push({ what: 'growStart', friends: friends.length });
  return { ...s, plants, mallows, game: { kind: 'grow', ends: s.time + GROW_TIME, can: false } };
}

/** How fast a veggie beaver carries its can (m/s): a little different for each, a little under the player. */
const paceOf = (m: Mallow): number => 1.8 + (Number(m.id.slice(1)) % 3) * 0.3;

/** A veggie beaver in the game: to the river for a can, back to its bed to water the plant, a pause, and again. */
function water(s: DreamState, m: Mallow, rand: () => number, dt: number, events: DreamEvent[]): Mallow {
  const t = s.time;
  const plant = s.plants?.find((p) => p.owner === m.id);
  const bed = plant ? s.land.beds?.[plant.bed] : undefined;
  if (!bed || s.game.kind !== 'grow') return stand(s, m, dt);
  if (m.until !== undefined && t < m.until) return stand(s, m, dt);
  const goal = m.can ? bed : bankSpot(s.land, bed);
  const d = Math.hypot(goal.x - m.x, goal.z - m.z);
  if (d > (m.can ? 1.3 : 0.6)) return go(s, { ...m, until: undefined }, goal.x - m.x, goal.z - m.z, Math.min(paceOf(m), 0.4 + d * 2), dt);
  if (!m.can) {
    events.push({ what: 'fill', who: m.name, x: m.x, z: m.z });
    return stand(s, { ...m, can: true, until: t + WATER_PAUSE }, dt);
  }
  const watered = (m.watered ?? 0) + 1;
  events.push({ what: 'water', who: m.name, stage: watered, x: bed.x, z: bed.z });
  return stand(s, { ...m, can: false, watered, hopAt: t, leap: false, until: t + WATER_PAUSE + rand() * 1.5 }, dt);
}

/** Who has the biggest plant: the player, or the veggie beaver's id. The player wins a tie. */
function biggest(plants: readonly Plant[]): Plant | undefined {
  return plants.reduce<Plant | undefined>((best, p) => (!best || p.stage > best.stage ? p : best), undefined);
}

/** The beavers' plants grow as they water; the game ends when one is full, or when the time is up. */
function growRules(s: DreamState, g: Extract<DreamGame, { kind: 'grow' }>, events: DreamEvent[]): DreamState {
  const plants = (s.plants ?? []).map((p) => (p.owner === 'player' ? p : { ...p, stage: Math.min(GROW_STAGES, s.mallows.find((m) => m.id === p.owner)?.watered ?? p.stage) }));
  const top = biggest(plants);
  const full = plants.find((p) => p.stage >= GROW_STAGES);
  if (!full && s.time < g.ends) return { ...s, plants };
  const winner = full ?? top;
  const name = !winner || winner.owner === 'player' ? 'player' : s.mallows.find((m) => m.id === winner.owner)?.name ?? winner.owner;
  events.push({ what: 'growEnd', winner: name });
  const t = s.time;
  const mallows = s.mallows.map((m): Mallow => {
    if (m.state !== 'water') return m;
    const won = winner?.owner === m.id;
    return { ...backToWander(m), ...(won ? { hopAt: t, leap: false } : {}) };
  });
  return { ...s, plants, mallows, game: { kind: 'none' } };
}

/** Where the one a marshmallow beaver that is it chases is now. */
function quarry(s: DreamState, g: Extract<DreamGame, { kind: 'tag' }>): DreamPoint {
  const id = g.chase ?? 'player';
  return id === 'player' ? s.beaver : s.mallows.find((m) => m.id === id) ?? s.beaver;
}

function chase(s: DreamState, m: Mallow, rand: () => number, dt: number): Mallow {
  const g = s.game;
  if (g.kind !== 'tag') return backToWander(m);
  const t = s.time;
  const q = quarry(s, g);
  // A new it stands a moment first, so the one it caught gets away.
  if (m.until !== undefined && t < m.until) return face(s, m, q, dt);
  let next = m;
  if (dist2(m, q) < 9 && !hopping(m, t) && (m.nextAt === undefined || t >= m.nextAt) && rand() < 0.5) {
    next = { ...m, hopAt: t, leap: m.mode === 'swim', nextAt: t + 2 };
  }
  return go(s, next, q.x - m.x, q.z - m.z, CHASE_SPEED, dt, true);
}

function flee(s: DreamState, m: Mallow, rand: () => number, dt: number): Mallow {
  const g = s.game;
  if (g.kind !== 'tag') return backToWander(m);
  const land = s.land;
  const t = s.time;
  const b = s.beaver;
  let next = m;
  if (next.nextAt === undefined || t >= next.nextAt) {
    // A dodge the other way every second or so.
    const was = next.jink ?? 1;
    next = { ...next, jink: -Math.sign(was || 1) * (0.4 + rand() * 0.6), nextAt: t + 0.7 + rand() };
  }
  if (chocolateDepth(land, m.x, m.z) < WET) {
    const { out } = riverFrame(land, m.x, m.z);
    return go(s, next, -out.x, -out.z, CHASE_SPEED, dt);
  }
  const it = g.it === 'player' ? b : s.mallows.find((o) => o.id === g.it) ?? b;
  const dx = m.x - it.x;
  const dz = m.z - it.z;
  const d = Math.hypot(dx, dz) || 1;
  if (d < FLEE_REACH) {
    // Mostly along the river, away from whoever is it, with a dodge to one side, and now and then a leap.
    const { along } = riverFrame(land, m.x, m.z);
    const way = dx * along.x + dz * along.z >= 0 ? 1 : -1;
    const vx = along.x * way + (dx / d) * 0.5;
    const vz = along.z * way + (dz / d) * 0.5;
    const a = (next.jink ?? 0) * 0.7;
    const speed = g.it === 'player' ? FLEE_FROM_PLAYER : g.chase === m.id ? FLEE_FROM_MALLOW : FLEE_FROM_MALLOW + 0.2;
    if (d < 3.5 && !hopping(next, t) && rand() < dt * 0.8) next = { ...next, hopAt: t, leap: true };
    return go(s, next, vx * Math.cos(a) + vz * Math.sin(a), -vx * Math.sin(a) + vz * Math.cos(a), speed, dt, true);
  }
  // Out of reach it keeps near the player, so the game goes on round them.
  if (dist2(m, b) > 100) return go(s, next, b.x - m.x, b.z - m.z, 1.5, dt, true);
  return stand(s, next, dt, true);
}

function tagRules(s: DreamState, g: Extract<DreamGame, { kind: 'tag' }>, rand: () => number, events: DreamEvent[]): DreamState {
  const t = s.time;
  const b = s.beaver;
  let game = g;
  let mallows = s.mallows;
  const named = (id: string): string => (id === 'player' ? 'player' : mallows.find((m) => m.id === id)?.name ?? id);
  if (t >= (g.calm ?? 0)) {
    let caught: string | null = null;
    if (g.it === 'player') caught = mallows.find((m) => g.players.includes(m.id) && dist2(m, b) < CATCH_REACH * CATCH_REACH)?.id ?? null;
    else {
      const it = mallows.find((m) => m.id === g.it);
      if (it && dist2(it, quarry(s, g)) < CATCH_REACH * CATCH_REACH) caught = g.chase ?? 'player';
    }
    if (caught) {
      const by = named(g.it);
      const chase = caught === 'player' ? undefined : pickQuarry(g.players, caught, g.it, rand);
      game = { ...g, it: caught, since: t, calm: t + NO_TAG_BACK, catches: g.catches + 1, chase };
      mallows = mallows.map((m): Mallow => {
        if (m.id === caught) return { ...m, state: 'chase', until: t + IT_WAIT, hopAt: t, leap: m.mode === 'swim' };
        if (m.id === g.it) return { ...m, state: 'flee', until: undefined, nextAt: undefined };
        return m;
      });
      events.push({ what: 'caught', it: named(caught), by });
    }
  }
  // Out of the chocolate too long, the player has gone off to do something else: the round ends.
  const dryAt = chocolateDepth(s.land, b.x, b.z) <= 0 ? game.dryAt ?? t : undefined;
  game = { ...game, dryAt };
  if (t < game.ends && (dryAt === undefined || t - dryAt <= DRY_END)) return { ...s, game, mallows };
  events.push({ what: 'tagEnd', catches: game.catches });
  const players = new Set(game.players);
  return shower({ ...s, game: { kind: 'none' }, mallows: mallows.map((m) => (players.has(m.id) ? backToWander(m) : m)) }, rand, events, true);
}

/** Who a new marshmallow it chases: mostly the player, else another player, not the one that just caught it if it can help it. */
function pickQuarry(players: readonly string[], it: string, was: string, rand: () => number): string {
  if (rand() < CHASE_PLAYER) return 'player';
  let others = players.filter((id) => id !== it && id !== was);
  if (others.length === 0) others = players.filter((id) => id !== it);
  return others.length === 0 ? 'player' : others[Math.floor(rand() * others.length)]!;
}

function seekRules(s: DreamState, g: Extract<DreamGame, { kind: 'seek' }>, rand: () => number, events: DreamEvent[]): DreamState {
  const t = s.time;
  const b = s.beaver;
  if (g.phase === 'counting') {
    if (t < g.until) return s;
    events.push({ what: 'seekGo' });
    return { ...s, game: { ...g, phase: 'seeking', until: t } };
  }
  // Walking up to a hider, or touching its prop, finds it. One still running to its place can be caught out too.
  let found = g.found;
  const mallows = s.mallows.map((m): Mallow => {
    if ((m.state !== 'hidden' && m.state !== 'hide') || !g.hiders.includes(m.id)) return m;
    const prop = s.land.props.find((p) => p.id === m.hideAt);
    const near = dist2(m, b) < FIND_REACH * FIND_REACH;
    const touch = m.state === 'hidden' && prop !== undefined && dist2(prop, b) < (PROP_RADIUS[prop.kind] * prop.size + BODY + 0.8) ** 2;
    if (!near && !touch) return m;
    found = [...found, m.id];
    events.push({ what: 'found', who: m.name, left: g.hiders.length - found.length });
    return { ...m, state: 'found', hopAt: t, leap: false, until: t + POP_TIME, hideAt: undefined, goal: undefined };
  });
  if (found === g.found) return s;
  if (found.length < g.hiders.length) return { ...s, mallows, game: { ...g, found } };
  events.push({ what: 'seekEnd' });
  const freed = mallows.map((m): Mallow => (found.includes(m.id) ? { ...m, state: 'follow', until: t + FOLLOW_AFTER } : m));
  return shower({ ...s, mallows: freed, game: { kind: 'none' } }, rand, events, false);
}

/** The player hides: the one asked and the nearest others within 35 m, four at most, gather where the player stands and count to ten. */
function startHide(s: DreamState, chosen: Mallow, events: DreamEvent[]): DreamState {
  const b = s.beaver;
  const others = s.mallows.filter((m) => m !== chosen && dist2(m, b) < SEEK_JOIN * SEEK_JOIN).sort((p, q) => dist2(p, b) - dist2(q, b));
  const seekers = [chosen, ...others].slice(0, SEEKERS).map((m) => m.id);
  const base = { x: b.x, z: b.z };
  const mallows = s.mallows.map((m): Mallow => {
    const k = seekers.indexOf(m.id);
    return k < 0 ? m : { ...backToWander(m), state: 'count', met: true, goal: ring(base, k, seekers.length, innerOf(s.land.half)) };
  });
  events.push({ what: 'hideStart', seekers: seekers.length });
  return { ...s, mallows, game: { kind: 'hide', phase: 'counting', until: s.time + COUNT_TIME, base, seekers, found: [] } };
}

/** A seeker's place at the base, on a small ring round it. */
function ring(base: DreamPoint, k: number, n: number, inner: number): DreamPoint {
  const a = (k / Math.max(1, n)) * TAU;
  return { x: clamp(base.x + Math.sin(a) * 1.6, -inner, inner), z: clamp(base.z + Math.cos(a) * 1.6, -inner, inner) };
}

/** A seeker sees the player: right next to them, or near with no hiding prop in between. */
function sees(land: DreamLand, m: DreamPoint, b: DreamPoint): boolean {
  const d2 = dist2(m, b);
  if (d2 < SPOT_REACH * SPOT_REACH) return true;
  if (d2 > SEE_REACH * SEE_REACH) return false;
  const dx = b.x - m.x;
  const dz = b.z - m.z;
  return !land.props.some((p) => {
    if (!p.hide) return false;
    const r = Math.max(0.6, PROP_RADIUS[p.kind] * p.size) + 0.2;
    const k = clamp(((p.x - m.x) * dx + (p.z - m.z) * dz) / d2, 0, 1);
    return (m.x + dx * k - p.x) ** 2 + (m.z + dz * k - p.z) ** 2 < r * r;
  });
}

/** A seeker goes from hiding prop to hiding prop and looks behind each a moment. Near the player it giggles. */
function seek(s: DreamState, m: Mallow, rand: () => number, dt: number, events: DreamEvent[]): Mallow {
  const g = s.game;
  if (g.kind !== 'hide') return backToWander(m);
  const t = s.time;
  let next = m;
  if (dist2(m, s.beaver) < NEAR_GIGGLE * NEAR_GIGGLE && (m.nextAt === undefined || t >= m.nextAt)) {
    events.push({ what: 'giggle', who: m.name, x: m.x, z: m.z });
    next = { ...next, giggleAt: t, nextAt: t + 2 + rand() * 2 };
  }
  if (next.until !== undefined) {
    const prop = s.land.props.find((p) => p.id === next.peek);
    if (t < next.until) return prop ? face(s, next, prop, dt) : stand(s, next, dt);
    next = { ...next, until: undefined, goal: undefined, peek: undefined, looked: [...(next.looked ?? []), ...(next.peek ? [next.peek] : [])] };
  }
  if (!next.goal) {
    const look = lookNext(s, g, next, rand);
    if (!look) return stand(s, next, dt);
    next = { ...next, peek: look.prop, goal: look.spot, looked: look.again ? [] : next.looked };
  }
  const goal = next.goal!;
  const d = Math.sqrt(dist2(next, goal));
  if (d < 0.5) return stand(s, { ...next, until: t + PEEK_TIME }, dt);
  return go(s, next, goal.x - next.x, goal.z - next.z, Math.min(SEEK_SPEED, 0.5 + d * 3), dt);
}

/**
 * The next prop a seeker looks behind, from the hiding props within 50 m of the base that no other seeker is going to: now
 * and then the one nearest the player, else mostly a near one it has not looked behind yet. When it has looked behind them
 * all it starts again (`again`). It looks from beside the prop, a quarter turn round from where it comes.
 */
function lookNext(s: DreamState, g: Extract<DreamGame, { kind: 'hide' }>, m: Mallow, rand: () => number): { prop: string; spot: DreamPoint; again: boolean } | null {
  const others = new Set(s.mallows.flatMap((o) => (o.id !== m.id && o.state === 'seek' && o.peek ? [o.peek] : [])));
  const all = s.land.props.filter((p) => p.hide && dist2(p, g.base) < LOOK_FAR * LOOK_FAR && !others.has(p.id));
  if (all.length === 0) return null;
  const looked = new Set(m.looked ?? []);
  let open = all.filter((p) => !looked.has(p.id));
  const again = open.length === 0;
  if (again) open = all;
  let pick = open[0]!;
  if (rand() < HUNCH) {
    for (const p of open) if (dist2(p, s.beaver) < dist2(pick, s.beaver)) pick = p;
  } else {
    let best = Infinity;
    for (const p of open) {
      const score = Math.sqrt(dist2(p, m)) + rand() * 12;
      if (score < best) {
        best = score;
        pick = p;
      }
    }
  }
  const r = Math.max(0.5, PROP_RADIUS[pick.kind] * pick.size) + 1.2;
  const a = Math.atan2(m.x - pick.x, m.z - pick.z) + ((rand() < 0.5 ? 1 : -1) * Math.PI) / 2;
  const inner = innerOf(s.land.half);
  const spot = { x: clamp(pick.x + Math.sin(a) * r, -inner, inner), z: clamp(pick.z + Math.cos(a) * r, -inner, inner) };
  return { prop: pick.id, spot, again };
}

function hideRules(s: DreamState, g: Extract<DreamGame, { kind: 'hide' }>, rand: () => number, events: DreamEvent[]): DreamState {
  const t = s.time;
  if (g.phase === 'counting') {
    if (t < g.until) return s;
    events.push({ what: 'hideGo' });
    const mallows = s.mallows.map((m): Mallow => (g.seekers.includes(m.id) ? { ...backToWander(m), state: 'seek', looked: [] } : m));
    return { ...s, mallows, game: { ...g, phase: 'seeking', until: t + HIDE_TIME } };
  }
  // A seeker that sees the player has found them: it giggles, cheers with a hop, and goes back to the base.
  let found = g.found;
  const mallows = s.mallows.map((m): Mallow => {
    if (m.state !== 'seek' || !g.seekers.includes(m.id) || !sees(s.land, m, s.beaver)) return m;
    found = [...found, m.id];
    events.push({ what: 'spotted', who: m.name, left: g.seekers.length - found.length });
    const home = ring(g.base, g.seekers.indexOf(m.id), g.seekers.length, innerOf(s.land.half));
    return { ...backToWander(m), state: 'home', hopAt: t, leap: false, giggleAt: t, goal: home };
  });
  if (found.length < g.seekers.length && t < g.until) return found === g.found ? s : { ...s, mallows, game: { ...g, found } };
  // All have found the player, or the minute is up: sweets either way.
  events.push({ what: 'hideEnd', found: found.length, seekers: g.seekers.length });
  const done = mallows.map((m): Mallow => (g.seekers.includes(m.id) ? { ...backToWander(m), state: 'follow', until: t + FOLLOW_AFTER } : m));
  return shower({ ...s, mallows: done, game: { kind: 'none' } }, rand, events, false);
}

/** A shower of sweets round the player at the end of a game: floating after tag, on land after hide and seek. */
function shower(s: DreamState, rand: () => number, events: DreamEvent[], wet: boolean): DreamState {
  const b = s.beaver;
  const land = s.land;
  const inner = innerOf(land.half);
  const added: Sweet[] = [];
  for (let i = 0; i < SHOWER; i++) {
    let x = b.x;
    let z = b.z;
    for (let k = 0; k < 6; k++) {
      const a = ((i + rand()) / SHOWER) * TAU;
      const r = 2 + rand() * 4.5;
      x = clamp(b.x + Math.sin(a) * r, -inner, inner);
      z = clamp(b.z + Math.cos(a) * r, -inner, inner);
      if (chocolateDepth(land, x, z) > 0.05 === wet) break;
    }
    added.push({
      id: `s${s.sweets.length + i}`,
      kind: rand() < 0.6 ? 'drop' : 'swirl',
      x,
      z,
      colour: Math.floor(rand() * CANDY_COLOURS.length),
      floating: chocolateDepth(land, x, z) > 0.05,
      taken: false,
    });
  }
  events.push({ what: 'shower', count: SHOWER });
  return { ...s, sweets: [...s.sweets, ...added] };
}
