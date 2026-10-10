// The first-steps coach (docs/design/25_first_steps_coach.md): a small card at the top left, under the status line, that gives one step at
// a time and points at the button to press. DOM only. The steps and their order are in coachSteps.ts.
import type { Stage } from '../sim/life';
import { COACH_DONE, coachBack, coachForward, coachNext, newCoach, stepText, stepsOf, type CoachState } from './coachSteps';
import type { WorldState } from '../sim/state';

/** The key that remembers the coach was finished or skipped. */
export const COACH_KEY = 'beaver-cycle.coached';

/** Whether to start the coach: not done before, not asked off with ?coach=0, and not in an automated browser (it would cover the tests). */
export function wantsCoach(done: boolean, query: URLSearchParams, automated: boolean): boolean {
  const asked = query.get('coach');
  if (asked === '1') return true;
  if (asked === '0') return false;
  return !done && !automated;
}

export interface Coach {
  /** Start the steps for a life stage from the beginning. */
  start(world: WorldState, chapter: Stage): void;
  /** Called every frame with the world: moves to the next step and redraws when something changed. */
  update(world: WorldState): void;
  active(): boolean;
}

export interface CoachOptions {
  touch: boolean;
  /** Called when the player closes the coach for good (Close, or the last card), so the caller can remember it and stop starting runs. */
  onClose(): void;
}

const BUTTON = 'min-height:44px;padding:6px 10px;border:0;border-radius:10px;font:16px system-ui,sans-serif;cursor:pointer;';
const PULSE = 'beaver-coach-pulse';

export function createCoach(parent: HTMLElement, opts: CoachOptions): Coach {
  const style = document.createElement('style');
  style.textContent = `@keyframes ${PULSE}{0%,100%{box-shadow:0 0 0 0 rgba(255,214,64,.9)}50%{box-shadow:0 0 0 14px rgba(255,214,64,0)}}` + `.${PULSE}{animation:${PULSE} 1.2s infinite;border-color:#ffd640 !important}`;
  const root = document.createElement('div');
  root.id = 'coach';
  root.setAttribute('role', 'status');
  root.style.cssText =
    'display:none;position:fixed;left:8px;top:84px;z-index:7;box-sizing:border-box;width:min(20rem,38vw);padding:10px 14px;' +
    'border-radius:14px;background:#f6f1e4;color:#2a1f0e;font:16px/1.4 system-ui,sans-serif;box-shadow:0 2px 12px rgba(0,0,0,.4)';
  const head = document.createElement('div');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:10px;font-weight:700;color:#2f6a30';
  const title = document.createElement('span');
  const count = document.createElement('span');
  count.style.cssText = 'font-weight:400;font-size:14px;color:#6b5d44';
  head.append(title, count);
  const text = document.createElement('div');
  text.style.cssText = 'margin:4px 0 8px';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;justify-content:flex-end;gap:10px';
  const mk = (action: string, label: string, bg: string, fg: string): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.action = action;
    b.textContent = label;
    b.style.cssText = `${BUTTON}background:${bg};color:${fg};`;
    return b;
  };
  const back = mk('coach-back', 'Back', '#e3d6b0', '#2a1f0e');
  const next = mk('coach-next', 'Next', '#2f6a30', '#fff');
  const close = mk('coach-close', 'Close', '#e3d6b0', '#2a1f0e');
  const ok = mk('coach-ok', 'Got it', '#2f6a30', '#fff');
  ok.style.display = 'none';
  row.style.justifyContent = 'space-between';
  const left = document.createElement('span');
  left.style.cssText = 'display:flex;gap:8px';
  left.append(back, next, ok);
  row.append(left, close);
  root.append(head, text, row);
  parent.append(style, root);

  let state: CoachState | null = null;
  let shown = '';
  let pointed: HTMLElement | null = null;

  const point = (id: string | null): void => {
    pointed?.classList.remove(PULSE);
    pointed = id ? document.getElementById(`touch-${id}`) : null;
    pointed?.classList.add(PULSE);
  };
  const hide = (): void => {
    state = null;
    shown = '';
    root.style.display = 'none';
    point(null);
  };
  const draw = (world: WorldState): void => {
    if (!state) return;
    const steps = stepsOf(state.chapter);
    const finished = state.step >= steps.length;
    const step = finished ? null : steps[state.step]!;
    const line = step ? stepText(step, opts.touch, world) : COACH_DONE[state.chapter];
    // Redraw only when the words change, as the other readouts do. The ring step's distance changes the words as the beaver walks.
    const key = `${state.chapter}:${state.step}:${line}`;
    if (key === shown) return;
    shown = key;
    title.textContent = step ? step.title : 'Well done!';
    count.textContent = step ? `${state.step + 1} of ${steps.length}` : '';
    text.textContent = line;
    back.style.visibility = state.step > 0 ? 'visible' : 'hidden';
    next.style.display = step ? '' : 'none';
    ok.style.display = step ? 'none' : '';
    point(step && opts.touch ? step.button : null);
  };
  let latest: WorldState | null = null;
  const go = (change: (s: CoachState) => CoachState): void => {
    if (!state || !latest) return;
    state = change(state);
    shown = '';
    draw(latest);
  };
  back.addEventListener('click', () => go(coachBack));
  next.addEventListener('click', () => go(coachForward));
  // Close turns the coach off for good. Got it only puts away the card of a finished run: the next life stage starts its own.
  close.addEventListener('click', () => {
    hide();
    opts.onClose();
  });
  ok.addEventListener('click', () => {
    const last = state?.chapter === 'adult';
    hide();
    if (last) opts.onClose();
  });

  return {
    start(world, chapter) {
      latest = world;
      state = newCoach(world, chapter);
      shown = '';
      root.style.display = 'block';
      draw(world);
    },
    update(world) {
      latest = world;
      if (!state) return;
      state = coachNext(world, state);
      draw(world);
    },
    active: () => state !== null,
  };
}
