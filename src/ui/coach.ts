// The first-steps coach (docs/design/25_first_steps_coach.md): a small card at the top left, under the status line, that gives one step at
// a time and points at the button to press. DOM only. The steps and their order are in coachSteps.ts.
import { COACH_DONE, COACH_HOME_DONE, coachNext, newCoach, stepText, stepsOf, type CoachChapter, type CoachState } from './coachSteps';
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
  /** Start the steps of a chapter (the dam by default) from the beginning at the beaver's place now. */
  start(world: WorldState, chapter?: CoachChapter): void;
  /** Called every frame with the world: moves to the next step and redraws when something changed. */
  update(world: WorldState): void;
  active(): boolean;
}

export interface CoachOptions {
  touch: boolean;
  /** Called when the steps end, by the last step or by Skip, so the caller can remember it. */
  onEnd(): void;
}

const BUTTON = 'min-height:44px;padding:6px 14px;border:0;border-radius:10px;font:16px system-ui,sans-serif;cursor:pointer;';
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
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.dataset.action = 'coach-skip';
  skip.textContent = 'Skip the tips';
  skip.style.cssText = `${BUTTON}background:#e3d6b0;color:#2a1f0e;`;
  const more = document.createElement('button');
  more.type = 'button';
  more.dataset.action = 'coach-home';
  more.textContent = 'Show me the lodge';
  more.style.cssText = `${BUTTON}background:#e3d6b0;color:#2a1f0e;display:none;`;
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.dataset.action = 'coach-ok';
  ok.textContent = 'Got it';
  ok.style.cssText = `${BUTTON}background:#2f6a30;color:#fff;display:none;`;
  row.append(skip, more, ok);
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
  const end = (): void => {
    state = null;
    shown = '';
    root.style.display = 'none';
    point(null);
    opts.onEnd();
  };
  skip.addEventListener('click', end);
  ok.addEventListener('click', end);

  let latest: WorldState | null = null;
  const coach: Coach = {
    start(world, chapter = 'dam') {
      state = newCoach(world, chapter);
      shown = '';
      ok.style.display = 'none';
      more.style.display = 'none';
      skip.style.display = '';
      root.style.display = 'block';
      this.update(world);
    },
    update(world) {
      latest = world;
      if (!state) return;
      state = coachNext(world, state);
      const steps = stepsOf(state.chapter);
      const finished = state.step >= steps.length;
      const step = finished ? null : steps[state.step]!;
      const dam = state.chapter === 'dam';
      const line = step ? stepText(step, opts.touch, world) : dam ? COACH_DONE : COACH_HOME_DONE;
      // Redraw only when the words change, as the other readouts do. The ring step's distance changes the words as the beaver walks.
      if (line === shown) return;
      shown = line;
      title.textContent = step ? step.title : 'Well done!';
      count.textContent = step ? `${state.step + 1} of ${steps.length}` : '';
      text.textContent = line;
      ok.style.display = step ? 'none' : '';
      // The dam's closing card offers the second run; the home's is the end.
      more.style.display = !step && dam ? '' : 'none';
      skip.style.display = step ? '' : 'none';
      point(step && opts.touch ? step.button : null);
    },
    active: () => state !== null,
  };
  more.addEventListener('click', () => {
    if (latest) coach.start(latest, 'home');
  });
  return coach;
}
