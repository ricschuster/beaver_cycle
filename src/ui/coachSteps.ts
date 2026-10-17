// The first-steps coach (docs/design/25_first_steps_coach.md): the steps of each life stage, and how the world moves the coach from
// one to the next. Pure data and functions, no DOM, so the order and the wording are tested. The card that shows them is coach.ts.
import { text, tree } from '../i18n';
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

/** The steps are made with getters for their words, so they follow the language set now (`coach.step.<id>.title`, `.touch`, `.keys`). */
function step(def: Omit<CoachStep, 'title' | 'touch' | 'keys'>): CoachStep {
  const words = (field: 'title' | 'touch' | 'keys') => ({ get: () => text(`coach.step.${def.id}.${field}`), enumerable: true });
  return Object.defineProperties({ ...def }, { title: words('title'), touch: words('touch'), keys: words('keys') }) as CoachStep;
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

const SWIM: CoachStep = step({
  id: 'swim',
  button: null,
  done: (_w, s) => s.swam,
});

const BABY: readonly CoachStep[] = [
  step({
    id: 'leave',
    button: 'dive',
    done: (_w, s) => s.out,
  }),
  SWIM,
  step({
    id: 'dive',
    button: 'dive',
    done: (_w, s) => s.dived,
  }),
  step({
    id: 'slap',
    button: 'slap',
    done: (w, s) => w.lastSlap !== null && w.lastSlap.time >= s.time0,
  }),
  step({
    id: 'home',
    button: 'dive',
    done: (_w, s) => s.returned,
  }),
  step({
    id: 'sleep',
    button: null,
    done: (_w, s) => s.slept,
  }),
];

const TEENAGER: readonly CoachStep[] = [
  step({
    id: 'pad',
    button: 'take',
    done: (w) => w.carry !== null || w.eaten > 0 || stockTotal(w.store) > 0,
  }),
  step({
    id: 'eat',
    button: 'do',
    done: (w) => w.eaten > 0,
  }),
  step({
    id: 'store',
    button: 'do',
    done: (w) => stockTotal(w.store) > 0,
  }),
  step({
    id: 'gnaw',
    button: 'do',
    done: (w) => w.felled.length > 0 || w.drag !== null,
  }),
  step({
    id: 'drag',
    button: 'take',
    done: (w) => w.drag !== null || started(w) || w.dams.length > 0,
  }),
  step({
    id: 'ring',
    button: null,
    done: (w) => (w.drag !== null && spotAt(w.spots, w.beaver.x, w.beaver.z) !== null) || started(w),
  }),
  step({
    id: 'build',
    button: 'do',
    done: (w) => started(w),
  }),
  step({
    id: 'fill',
    button: 'do',
    done: (w) => w.dams.some((d) => damWhole(d)),
  }),
  step({
    id: 'pond',
    button: null,
    done: (w) => w.ponds.length > 0,
  }),
];

const ADULT: readonly CoachStep[] = [
  step({
    id: 'partner',
    button: null,
    done: (w) => w.partners.some((p) => p.state !== 'alone'),
  }),
  step({
    id: 'lodge',
    button: 'do',
    done: (w) => w.lodge !== null,
  }),
  step({
    id: 'lodge-finish',
    button: 'do',
    done: (w) => lodgeComplete(w.lodge),
  }),
  step({
    id: 'moved-in',
    button: null,
    done: (w) => mateOf(w.partners) !== null,
  }),
  step({
    id: 'kit',
    button: null,
    done: (w, s) => w.bornAt !== s.bornAt,
  }),
];

/** The steps of each life stage. The dam is the teenager's job: a baby cannot gnaw, drag or build, and a grown beaver has its own home to make. */
export const STEPS: Record<Stage, readonly CoachStep[]> = { baby: BABY, teenager: TEENAGER, adult: ADULT };

/** The steps of a stage. */
export const stepsOf = (chapter: Stage): readonly CoachStep[] => STEPS[chapter];

/** The closing words of each run, shown when its last step is done. */
export const COACH_DONE = tree<Record<Stage, string>>('coach.done');

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
  return ring ? `${line} ${text('coach.ring', { where: ring })}` : line;
}
