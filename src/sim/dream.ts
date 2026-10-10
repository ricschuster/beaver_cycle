// The dream (docs/design/29_dream_candy_land.md): candy land, made new each night from a seed, with sweets on the path and in the
// chocolate river and a group of marshmallow beavers to play tag and hide and seek with. Its own small world: it never reads or
// changes the waking game's state. Pure, no DOM, no three.js.

export interface DreamPoint {
  x: number;
  z: number;
}

/** The chocolate's surface height. Land is above it, the river bed below. */
export const CHOCOLATE_LEVEL = 0;

export type PropKind = 'lollipop' | 'gumdrop' | 'candyCane' | 'cupcake' | 'iceCream' | 'marshmallowRock';

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

export type SweetKind = 'drop' | 'swirl' | 'star';

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

export interface DreamLand {
  seed: number;
  /** The land is the square -half..half on x and z. Candy hills rise at its edges. */
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
}

export type MallowState = 'wander' | 'greet' | 'follow' | 'chase' | 'flee' | 'hide' | 'hidden' | 'found';

export interface Mallow extends DreamBeaver {
  id: string;
  name: string;
  /** An index into `MALLOW_COLOURS`. */
  colour: number;
  state: MallowState;
  /** The prop it hides behind in hide and seek. */
  hideAt?: string;
  /** Dream time of its last giggle, or null. */
  giggleAt: number | null;
  /** It has said hello to the player this dream. */
  met: boolean;
}

export type DreamGame =
  | { kind: 'none' }
  /** `it` is 'player' or a mallow id. `ends` is the dream time the round ends. `catches` counts every catch either way. */
  | { kind: 'tag'; it: string; players: string[]; since: number; ends: number; catches: number }
  /** Counting: the player counts to ten while the hiders run off. Seeking: until all are found. */
  | { kind: 'seek'; phase: 'counting' | 'seeking'; until: number; hiders: string[]; found: string[] };

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
  game: DreamGame;
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
}

export type DreamEvent =
  | { what: 'sweet'; kind: SweetKind; x: number; z: number }
  | { what: 'rush' }
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
  | { what: 'shower'; count: number };

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

/** A new dream from a seed (any integer). The same seed makes the same dream. */
export function newDream(seed: number): DreamState {
  void seed;
  throw new Error('dream: not built yet');
}

/** Ground height at a point: above `CHOCOLATE_LEVEL` on land, below it in the river channel, rising in the hills at the edges. */
export function dreamHeight(land: DreamLand, x: number, z: number): number {
  void land;
  void x;
  void z;
  return CHOCOLATE_LEVEL + 1;
}

/** How deep the chocolate is at a point, 0 on land. */
export function chocolateDepth(land: DreamLand, x: number, z: number): number {
  return Math.max(0, CHOCOLATE_LEVEL - dreamHeight(land, x, z));
}

/** One step of the dream: the beaver, sweets, marshmallow beavers and the games. Returns the new state and what happened. */
export function stepDream(state: DreamState, input: DreamInput, dt: number): { state: DreamState; events: DreamEvent[] } {
  void input;
  void dt;
  return { state, events: [] };
}

/** What the Build control would start now, for the prompt, such as "Play tag with Puff", or null when nothing. */
export function playPrompt(state: DreamState): string | null {
  void state;
  return null;
}
