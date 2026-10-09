// Bedtime: when the beaver can sleep (in the lodge, at night) a panel offers
// two ways (Q65): sleep until morning, or go into the dream. Both fade to black
// and wake at dawn. The dream is a placeholder for a mini game later. DOM only.

/** Milliseconds of each fade to or from black. */
export const FADE_MS = 700;

export type SleepGoal = 'night' | 'season' | 'grow';

export interface SleepChoices {
  /** It is night: offer sleeping until morning and the dream. */
  night: boolean;
  /** The beaver rests on its nest: offer sleeping ahead to the next season. */
  rest: boolean;
  /** Offer sleeping until growing up, or null for an adult. The text names the next stage. */
  grow: string | null;
}

export interface SleepPrompt {
  /** Show the panel with the choices that apply, hide it when none do. */
  set(choices: SleepChoices): void;
}

export interface SleepPromptOptions {
  /** Called in the dark, once, when the beaver wakes: move the clock to dawn, the next season, or growing up. */
  onWake(goal: SleepGoal): void;
}

const BUTTON =
  'padding:12px 18px;border:0;border-radius:10px;background:#f3e3b5;color:#2a1f0e;font:16px system-ui,sans-serif;cursor:pointer';

export function createSleepPrompt(parent: HTMLElement, opts: SleepPromptOptions): SleepPrompt {
  const panel = document.createElement('div');
  panel.id = 'sleep-prompt';
  panel.style.cssText =
    'display:none;position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:6;gap:12px;padding:10px;' +
    'border-radius:14px;background:rgba(0,0,0,.5)';

  const skipButton = document.createElement('button');
  skipButton.textContent = 'Sleep until morning';
  skipButton.dataset.action = 'sleep-skip';
  skipButton.style.cssText = BUTTON;
  const dreamButton = document.createElement('button');
  dreamButton.textContent = 'Dream';
  dreamButton.dataset.action = 'sleep-dream';
  dreamButton.style.cssText = BUTTON;
  const seasonButton = document.createElement('button');
  seasonButton.textContent = 'Sleep until next season';
  seasonButton.dataset.action = 'sleep-season';
  seasonButton.style.cssText = BUTTON;
  const growButton = document.createElement('button');
  growButton.dataset.action = 'sleep-grow';
  growButton.style.cssText = BUTTON;
  panel.append(skipButton, dreamButton, seasonButton, growButton);

  const dark = document.createElement('div');
  dark.id = 'sleep-dark';
  dark.style.cssText =
    `position:fixed;inset:0;z-index:20;background:#05060d;opacity:0;pointer-events:none;transition:opacity ${FADE_MS}ms;` +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;color:#cfd8ff;font:20px system-ui,sans-serif';
  const dreamText = document.createElement('p');
  dreamText.textContent = 'The beaver dreams... (a mini game will go here)';
  dreamText.hidden = true;
  const wakeButton = document.createElement('button');
  wakeButton.textContent = 'Wake up';
  wakeButton.dataset.action = 'sleep-wake';
  wakeButton.style.cssText = BUTTON;
  wakeButton.hidden = true;
  dark.append(dreamText, wakeButton);

  parent.append(panel, dark);

  let busy = false;
  let choices: SleepChoices = { night: false, rest: false, grow: null };
  let goal: SleepGoal = 'night';
  const refresh = (): void => {
    skipButton.hidden = dreamButton.hidden = !choices.night;
    seasonButton.hidden = !choices.rest;
    growButton.hidden = choices.grow === null;
    if (choices.grow !== null) growButton.textContent = `Sleep until ${choices.grow}`;
    panel.style.display = busy || (!choices.night && !choices.rest && choices.grow === null) ? 'none' : 'flex';
  };

  const fadeTo = (opacity: number): void => {
    dark.style.opacity = String(opacity);
    dark.style.pointerEvents = opacity > 0 ? 'auto' : 'none';
  };

  // Fade out, wake in the dark, fade back in.
  const wake = (): void => {
    dreamText.hidden = true;
    wakeButton.hidden = true;
    opts.onWake(goal);
    setTimeout(() => {
      fadeTo(0);
      setTimeout(() => {
        busy = false;
        refresh();
      }, FADE_MS);
    }, 300);
  };

  const sleepTo = (next: SleepGoal) => () => {
    if (busy) return;
    goal = next;
    busy = true;
    refresh();
    fadeTo(1);
    setTimeout(wake, FADE_MS);
  };
  skipButton.onclick = sleepTo('night');
  seasonButton.onclick = sleepTo('season');
  growButton.onclick = sleepTo('grow');
  dreamButton.onclick = () => {
    if (busy) return;
    goal = 'night';
    busy = true;
    refresh();
    fadeTo(1);
    setTimeout(() => {
      dreamText.hidden = false;
      wakeButton.hidden = false;
    }, FADE_MS);
  };
  wakeButton.onclick = wake;

  return {
    set(value) {
      choices = value;
      refresh();
    },
  };
}
