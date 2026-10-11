// The first-steps coach (docs/design/25_first_steps_coach.md): the steps of each life stage, and how the world moves the coach from
// one to the next. Pure data and functions, no DOM, so the order and the wording are tested. The card that shows them is coach.ts.
import { damWhole, spotAt } from '../sim/dam';
import { stockTotal } from '../sim/food';
import { lodgeComplete } from '../sim/lodge';
import type { Stage } from '../sim/life';
import { mateOf } from '../sim/partners';
import type { WorldState } from '../sim/state';
import { placeWords } from '../sim/wayToPartner';

/** The touch button a step points at, by its element id suffix (`touch-do`), or null. */
export type CoachButton = 'dive' | 'slap' | 'take' | 'do' | null;

/** What the coach remembers between frames: the things a step needs that the world does not keep. */
export interface CoachState {
  /** The run of steps: one per life stage. */
  chapter: Stage;
  /** Index of the step shown. The chapter's length means the closing card. */
  step: number;
  /** How far the world (or a Next press) has taken the player. The shown step follows it, unless the player went back to read. */
  furthest: number;
  /** Game time and birth clock when the run began, to tell what happened since. */
  time0: number;
  bornAt: number;
  swam: boolean;
  dived: boolean;
  /** The beaver has been out of the lodge, and then back in it. */
  out: boolean;
  returned: boolean;
  /** The beaver slept: the clock jumped ahead in one frame. */
  slept: boolean;
  /** The clock at the last frame, to see a sleep jump. */
  lastClock: number;
}

export interface CoachStep {
  id: string;
  title: string;
  /** The line for touch and for keys. A line without a key name is used for both. */
  touch: string;
  keys: string;
  button: CoachButton;
  done(world: WorldState, state: CoachState): boolean;
}

/** The nearest free or started dam spot as the way from the player's view, or null when there is none. */
export function nearestRing(world: WorldState, facing: number = world.beaver.heading): string | null {
  let best: { dx: number; dz: number; d: number } | null = null;
  for (const s of world.spots) {
    const dx = s.bed.x - world.beaver.x;
    const dz = s.bed.z - world.beaver.z;
    const d = Math.hypot(dx, dz);
    if (best === null || d < best.d) best = { dx, dz, d };
  }
  return best === null ? null : placeWords(best.dx, best.dz, facing);
}

const started = (w: WorldState): boolean => w.dams.some((d) => d.wood + d.mud + d.rock > 0);

const SWIM: CoachStep = {
  id: 'swim',
  title: 'Go for a swim',
  touch: 'Swim around the pond. Push the stick to swim. Beavers love to swim!',
  keys: 'Swim around the pond. Press W A S D to swim. Beavers love to swim!',
  button: null,
  done: (_w, s) => s.swam,
};

const BABY: readonly CoachStep[] = [
  {
    id: 'leave',
    title: 'Swim out',
    touch: 'You are home in the lodge. Walk to the water hole in the floor and press Dive to swim out.',
    keys: 'You are home in the lodge. Press W A S D to walk to the water hole in the floor and press Space to swim out.',
    button: 'dive',
    done: (_w, s) => s.out,
  },
  SWIM,
  {
    id: 'dive',
    title: 'Dive under',
    touch: 'Hold the Dive button while you swim. Let go to come back up.',
    keys: 'Hold Space while you swim. Let go to come back up.',
    button: 'dive',
    done: (_w, s) => s.dived,
  },
  {
    id: 'slap',
    title: 'Slap your tail',
    touch: 'Press Slap at the water surface. Other animals hear it far away.',
    keys: 'Press T at the water surface. Other animals hear it far away.',
    button: 'slap',
    done: (w, s) => w.lastSlap !== null && w.lastSlap.time >= s.time0,
  },
  {
    id: 'home',
    title: 'Go home',
    touch: 'Swim to the lodge, hold Dive and swim in at the door. The door is under water.',
    keys: 'Swim to the lodge, hold Space and swim in at the door. The door is under water.',
    button: 'dive',
    done: (_w, s) => s.returned,
  },
  {
    id: 'sleep',
    title: 'Sleep and grow',
    touch: 'Walk to the nest, the soft spot in the lodge. A panel comes up. Tap Sleep until teenager.',
    keys: 'Walk to the nest, the soft spot in the lodge. A panel comes up. Pick Sleep until teenager.',
    button: null,
    done: (_w, s) => s.slept,
  },
];

const TEENAGER: readonly CoachStep[] = [
  {
    id: 'pad',
    title: 'Find a lily pad',
    touch: 'Swim out and find a lily pad on the water. Stand still next to it and press Take.',
    keys: 'Swim out and find a lily pad on the water. Stay next to it and press G.',
    button: 'take',
    done: (w) => w.carry !== null || w.eaten > 0 || stockTotal(w.store) > 0,
  },
  {
    id: 'eat',
    title: 'Have a snack',
    touch: 'Carry the food into the lodge, and press Eat inside.',
    keys: 'Carry the food into the lodge, and press E inside to eat.',
    button: 'do',
    done: (w) => w.eaten > 0,
  },
  {
    id: 'store',
    title: 'Fill the food store',
    touch: 'Bring another lily pad or a branch. Swim to the food store by the door and press Store. Tap a place to put the food in. It keeps food for winter.',
    keys: 'Bring another lily pad or a branch. Swim to the food store by the door and press E. Click a place to put the food in. It keeps food for winter.',
    button: 'do',
    done: (w) => stockTotal(w.store) > 0,
  },
  {
    id: 'gnaw',
    title: 'Gnaw a tree',
    touch: 'Walk to a tree on the bank and stand still. Press Gnaw until the tree falls.',
    keys: 'Walk to a tree on the bank and stand still. Press E until the tree falls.',
    button: 'do',
    done: (w) => w.felled.length > 0 || w.drag !== null,
  },
  {
    id: 'drag',
    title: 'Take the log',
    touch: 'Stand at the log and press Take to take it in your teeth.',
    keys: 'Stand at the log and press G to take it in your teeth.',
    button: 'take',
    done: (w) => w.drag !== null || started(w) || w.dams.length > 0,
  },
  {
    id: 'ring',
    title: 'Find a white ring',
    touch: 'Carry the log to a white ring on the ground near a stream.',
    keys: 'Carry the log to a white ring on the ground near a stream.',
    button: null,
    done: (w) => (w.drag !== null && spotAt(w.spots, w.beaver.x, w.beaver.z) !== null) || started(w),
  },
  {
    id: 'build',
    title: 'Start the dam',
    touch: 'You are in the ring. Press Build to put the log in the dam.',
    keys: 'You are in the ring. Press E to put the log in the dam.',
    button: 'do',
    done: (w) => started(w),
  },
  {
    id: 'fill',
    title: 'Finish the dam',
    touch: 'It needs mud and rocks too. Take mud at the water edge, or a rock, then press Build in the ring. The top left says what is missing.',
    keys: 'It needs mud and rocks too. Press G at the water edge for mud, or at a rock, then press E in the ring. The top left says what is missing.',
    button: 'do',
    done: (w) => w.dams.some((d) => damWhole(d)),
  },
  {
    id: 'pond',
    title: 'Watch the pond',
    touch: 'The water is backing up. Wait a moment and look at your new pond.',
    keys: 'The water is backing up. Wait a moment and look at your new pond.',
    button: null,
    done: (w) => w.ponds.length > 0,
  },
];

const ADULT: readonly CoachStep[] = [
  {
    id: 'partner',
    title: 'Find a lone beaver',
    touch: 'Mama says it is time for a family of your own. Find a lone beaver in another pond and swim near it. A message says which way to go, and sparkles show the way.',
    keys: 'Mama says it is time for a family of your own. Find a lone beaver in another pond and swim near it. A message says which way to go, and sparkles show the way.',
    button: null,
    done: (w) => w.partners.some((p) => p.state !== 'alone'),
  },
  {
    id: 'lodge',
    title: 'Start a lodge',
    touch: 'Drag a log to shallow water. Face the water and press Build. A lodge needs about ten pieces of wood, so bring more logs.',
    keys: 'Drag a log to shallow water. Face the water and press E. A lodge needs about ten pieces of wood, so bring more logs.',
    button: 'do',
    done: (w) => w.lodge !== null,
  },
  {
    id: 'lodge-finish',
    title: 'Finish the lodge',
    touch: 'Drag more logs to the lodge and press Build next to it. The top left says how much is missing.',
    keys: 'Drag more logs to the lodge and press E next to it. The top left says how much is missing.',
    button: 'do',
    done: (w) => lodgeComplete(w.lodge),
  },
  {
    id: 'moved-in',
    title: 'Your partner moves in',
    touch: 'Keep the lone beaver close. It moves into the lodge when it is whole.',
    keys: 'Keep the lone beaver close. It moves into the lodge when it is whole.',
    button: null,
    done: (w) => mateOf(w.partners) !== null,
  },
  {
    id: 'kit',
    title: 'Wait for a kit',
    touch: 'On the first day of spring a kit is born. Sleep on the nest to skip ahead. Keep the dam and the lodge mended.',
    keys: 'On the first day of spring a kit is born. Sleep on the nest to skip ahead. Keep the dam and the lodge mended.',
    button: null,
    done: (w, s) => w.bornAt !== s.bornAt,
  },
];

/** The steps of each life stage. The dam is the teenager's job: a baby cannot gnaw, drag or build, and a grown beaver has its own home to make. */
export const STEPS: Record<Stage, readonly CoachStep[]> = { baby: BABY, teenager: TEENAGER, adult: ADULT };

/** The steps of a stage. */
export const stepsOf = (chapter: Stage): readonly CoachStep[] => STEPS[chapter];

/** The closing words of each run, shown when its last step is done. */
export const COACH_DONE: Record<Stage, string> = {
  baby: 'You are ready to grow up! Sleep on the nest until you are a teenager. The ? button has more.',
  teenager: 'You built a dam and made a pond! A teenager also mends the lodge, the dam and the store. The ? button has more.',
  adult: 'You have a kit! Now you play the little one. The ? button has more.',
};

/** A clock jump in one frame bigger than this (game seconds) is a sleep. A frame moves it by a fraction of a second. */
export const SLEEP_JUMP = 20;

export function newCoach(world: WorldState, chapter: Stage): CoachState {
  return {
    chapter,
    step: 0,
    furthest: 0,
    time0: world.time,
    bornAt: world.bornAt,
    swam: false,
    dived: false,
    out: false,
    returned: false,
    slept: false,
    lastClock: world.clock,
  };
}

/** The coach after one frame: it notes what the beaver did, and moves past every step that is now done (unless the player went back to read). */
export function coachNext(world: WorldState, state: CoachState): CoachState {
  const b = world.beaver;
  const next: CoachState = {
    ...state,
    swam: state.swam || b.mode === 'swim' || b.mode === 'dive',
    dived: state.dived || b.mode === 'dive',
    out: state.out || !world.inLodge,
    returned: state.returned || (state.out && world.inLodge),
    slept: state.slept || world.clock - state.lastClock > SLEEP_JUMP,
    lastClock: world.clock,
  };
  const steps = stepsOf(next.chapter);
  let furthest = state.furthest;
  while (furthest < steps.length && steps[furthest]!.done(world, next)) furthest += 1;
  next.furthest = furthest;
  if (state.step >= state.furthest) next.step = furthest;
  return next;
}

/** One step on, which skips the step when the world has not done it. On the closing card it stays, and the card closes. */
export function coachForward(state: CoachState): CoachState {
  const length = stepsOf(state.chapter).length;
  if (state.step >= length) return state;
  const step = state.step + 1;
  return { ...state, step, furthest: Math.max(state.furthest, step) };
}

/** One step back, to read it again. The coach does not jump forward from there until the player comes back to the newest step. */
export function coachBack(state: CoachState): CoachState {
  return state.step > 0 ? { ...state, step: state.step - 1 } : state;
}

/** The text of a step: the line, with the way to the nearest ring in kid words added while the player looks for one. */
export function stepText(step: CoachStep, touch: boolean, world: WorldState, facing?: number): string {
  const line = touch ? step.touch : step.keys;
  if (step.id !== 'ring') return line;
  const ring = nearestRing(world, facing);
  return ring ? `${line} The nearest ring is ${ring}.` : line;
}
