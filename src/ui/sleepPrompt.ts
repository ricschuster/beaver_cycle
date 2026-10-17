// Bedtime: when the beaver can sleep (in the lodge, at night) a panel offers
// two ways (Q65): sleep until morning, or go into the dream. Both fade to black
// and wake at dawn. The dream itself is the dream screen (ui/dreamScreen.ts,
// docs/design/29_dream_candy_land.md), which opens over the dark and hands back
// to `wakeFromDream` when the player wakes. DOM only.
import { t } from '../i18n';

/** Milliseconds of each fade to or from black. */
export const FADE_MS = 700;
/** Milliseconds the screen stays dark on waking before it fades back in (the dream screen fades out in this time). */
export const DARK_MS = 300;

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
  /**
   * The dream is over: wake at dawn in the dark and fade the game back in. A dream started without the Dream button (the test
   * menu, ?dream=1) wakes from the same dark, put up at once under the dream screen. Does nothing while a plain sleep is on.
   */
  wakeFromDream(): void;
}

export interface SleepPromptOptions {
  /** Called in the dark, once, when the beaver wakes: move the clock to dawn, the next season, or growing up. */
  onWake(goal: SleepGoal): void;
  /** Called in the dark after the Dream button: open the dream, which calls `wakeFromDream` when it ends. */
  onDream(): void;
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
  skipButton.textContent = t('sleep.morning');
  skipButton.dataset.action = 'sleep-skip';
  skipButton.style.cssText = BUTTON;
  const dreamButton = document.createElement('button');
  dreamButton.textContent = t('sleep.dream');
  dreamButton.dataset.action = 'sleep-dream';
  dreamButton.style.cssText = BUTTON;
  const seasonButton = document.createElement('button');
  seasonButton.textContent = t('sleep.season');
  seasonButton.dataset.action = 'sleep-season';
  seasonButton.style.cssText = BUTTON;
  const growButton = document.createElement('button');
  growButton.dataset.action = 'sleep-grow';
  growButton.style.cssText = BUTTON;
  panel.append(skipButton, dreamButton, seasonButton, growButton);

  const dark = document.createElement('div');
  dark.id = 'sleep-dark';
  dark.style.cssText =
    `position:fixed;inset:0;z-index:20;background:#05060d;opacity:0;pointer-events:none;transition:opacity ${FADE_MS}ms`;

  parent.append(panel, dark);

  let busy = false;
  let dreaming = false;
  let choices: SleepChoices = { night: false, rest: false, grow: null };
  let goal: SleepGoal = 'night';
  const refresh = (): void => {
    skipButton.hidden = dreamButton.hidden = !choices.night;
    seasonButton.hidden = !choices.rest;
    growButton.hidden = choices.grow === null;
    if (choices.grow !== null) growButton.textContent = t('sleep.until', { when: choices.grow });
    panel.style.display = busy || (!choices.night && !choices.rest && choices.grow === null) ? 'none' : 'flex';
  };

  const fadeTo = (opacity: number): void => {
    dark.style.opacity = String(opacity);
    dark.style.pointerEvents = opacity > 0 ? 'auto' : 'none';
  };

  // Fade out, wake in the dark, fade back in.
  const wake = (): void => {
    dreaming = false;
    opts.onWake(goal);
    setTimeout(() => {
      fadeTo(0);
      setTimeout(() => {
        busy = false;
        refresh();
      }, FADE_MS);
    }, DARK_MS);
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
      dreaming = true;
      opts.onDream();
    }, FADE_MS);
  };

  return {
    set(value) {
      choices = value;
      refresh();
    },
    wakeFromDream() {
      if (busy && !dreaming) return;
      if (!busy) {
        busy = true;
        refresh();
        dark.style.transition = 'none';
        fadeTo(1);
        // Read the layout once so the dark is up before its fade comes back.
        void dark.offsetWidth;
        dark.style.transition = `opacity ${FADE_MS}ms`;
      }
      goal = 'night';
      wake();
    },
  };
}
