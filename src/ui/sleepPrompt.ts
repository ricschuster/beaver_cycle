// Bedtime: when the beaver can sleep (in the lodge, at night) a panel offers
// two ways (Q65): sleep until morning, or go into the dream. Both fade to black
// and wake at dawn. The dream is a placeholder for a mini game later. DOM only.

/** Milliseconds of each fade to or from black. */
export const FADE_MS = 700;

export interface SleepPrompt {
  /** Show the bedtime panel while the beaver can sleep, hide it otherwise. */
  setAvailable(available: boolean): void;
}

export interface SleepPromptOptions {
  /** Called in the dark, once, when the beaver wakes: move the clock to dawn. */
  onWake(): void;
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
  panel.append(skipButton, dreamButton);

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
  let available = false;
  const refresh = (): void => {
    panel.style.display = !available || busy ? 'none' : 'flex';
  };

  const fadeTo = (opacity: number): void => {
    dark.style.opacity = String(opacity);
    dark.style.pointerEvents = opacity > 0 ? 'auto' : 'none';
  };

  // Fade out, wake in the dark, fade back in.
  const wake = (): void => {
    dreamText.hidden = true;
    wakeButton.hidden = true;
    opts.onWake();
    setTimeout(() => {
      fadeTo(0);
      setTimeout(() => {
        busy = false;
        refresh();
      }, FADE_MS);
    }, 300);
  };

  skipButton.onclick = () => {
    if (busy) return;
    busy = true;
    refresh();
    fadeTo(1);
    setTimeout(wake, FADE_MS);
  };
  dreamButton.onclick = () => {
    if (busy) return;
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
    setAvailable(value) {
      available = value;
      refresh();
    },
  };
}
