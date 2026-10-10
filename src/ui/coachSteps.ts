// The first-steps coach (docs/design/25_first_steps_coach.md): the steps, and how the world moves the coach from one to the
// next. Pure data and functions, no DOM, so the order and the wording are tested. The card that shows them is coach.ts.
import { damWhole, spotAt } from '../sim/dam';
import type { WorldState } from '../sim/state';

/** The touch button a step points at, by its element id suffix (`touch-chop`), or null. */
export type CoachButton = 'dive' | 'slap' | 'chop' | 'grab' | 'build' | null;

/** What the coach remembers between frames: the things a step needs that the world does not keep. */
export interface CoachState {
  /** Index into STEPS. STEPS.length means all done. */
  step: number;
  start: { x: number; z: number };
  moved: boolean;
  swam: boolean;
  dived: boolean;
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

/** How far the beaver walks (metres) to count as having moved. */
export const MOVE_DONE = 8;

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] as const;

/** The nearest free or started dam spot as compass words and metres to the nearest 10, or null when there is none. North is -z. */
export function nearestRing(world: WorldState): { direction: string; metres: number } | null {
  let best: { dx: number; dz: number; d: number } | null = null;
  for (const s of world.spots) {
    const dx = s.bed.x - world.beaver.x;
    const dz = s.bed.z - world.beaver.z;
    const d = Math.hypot(dx, dz);
    if (best === null || d < best.d) best = { dx, dz, d };
  }
  if (best === null) return null;
  const bearing = (Math.atan2(best.dx, -best.dz) + 2 * Math.PI) % (2 * Math.PI);
  return { direction: COMPASS[Math.round(bearing / (Math.PI / 4)) % 8] ?? 'north', metres: Math.round(best.d / 10) * 10 };
}

const started = (w: WorldState): boolean => w.dams.some((d) => d.wood + d.mud + d.rock > 0);

export const STEPS: readonly CoachStep[] = [
  {
    id: 'move',
    title: 'Walk around',
    touch: 'Push the stick on the left to walk. Drag the empty screen to turn the view.',
    keys: 'Press W A S D to walk. Drag the mouse to turn the view.',
    button: null,
    done: (_w, s) => s.moved,
  },
  {
    id: 'swim',
    title: 'Go for a swim',
    touch: 'Walk into the water. Beavers love to swim!',
    keys: 'Walk into the water. Beavers love to swim!',
    button: null,
    done: (_w, s) => s.swam,
  },
  {
    id: 'dive',
    title: 'Dive under',
    touch: 'Hold the Dive button while you swim. Let go to come back up.',
    keys: 'Hold Space while you swim. Let go to come back up.',
    button: 'dive',
    done: (_w, s) => s.dived,
  },
  {
    id: 'gnaw',
    title: 'Gnaw a tree',
    touch: 'Walk to a tree on the bank and stand still. Press Gnaw until the tree falls.',
    keys: 'Walk to a tree on the bank and stand still. Press E until the tree falls.',
    button: 'chop',
    done: (w) => w.felled.length > 0 || w.drag !== null,
  },
  {
    id: 'drag',
    title: 'Take the log',
    touch: 'Stand at the log and press Drag to take it in your teeth.',
    keys: 'Stand at the log and press G to take it in your teeth.',
    button: 'grab',
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
    keys: 'You are in the ring. Press B to put the log in the dam.',
    button: 'build',
    done: (w) => started(w),
  },
  {
    id: 'fill',
    title: 'Finish the dam',
    touch: 'It needs mud and rocks too. Gnaw mud at the water edge, or a rock, then press Build in the ring. The top left says what is missing.',
    keys: 'It needs mud and rocks too. Press E at the water edge for mud, or at a rock, then press B in the ring. The top left says what is missing.',
    button: 'build',
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

/** The closing words, shown when the last step is done. */
export const COACH_DONE = 'You built a dam and made a pond! Next, build a lodge. Drag a log to shallow water, face the water and press Build. The ? button has more.';

export function newCoach(world: WorldState): CoachState {
  return { step: 0, start: { x: world.beaver.x, z: world.beaver.z }, moved: false, swam: false, dived: false };
}

/** The coach after one frame: it notes what the beaver did, and moves past every step that is now done. */
export function coachNext(world: WorldState, state: CoachState): CoachState {
  const b = world.beaver;
  const next: CoachState = {
    ...state,
    moved: state.moved || Math.hypot(b.x - state.start.x, b.z - state.start.z) >= MOVE_DONE,
    swam: state.swam || b.mode === 'swim' || b.mode === 'dive',
    dived: state.dived || b.mode === 'dive',
  };
  while (next.step < STEPS.length && STEPS[next.step]!.done(world, next)) next.step += 1;
  return next;
}

/** The text of a step: the line, with the way to the nearest ring added while the player looks for one. */
export function stepText(step: CoachStep, touch: boolean, world: WorldState): string {
  const line = touch ? step.touch : step.keys;
  if (step.id !== 'ring') return line;
  const ring = nearestRing(world);
  return ring ? `${line} The nearest ring is about ${ring.metres} m to the ${ring.direction}.` : line;
}
