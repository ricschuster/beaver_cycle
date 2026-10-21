// The big count of a game of hide and seek (#664): who counts, how long the hiding or the seeking has left, and a heart for a find.
// DOM only; `hideLine` is the text, pure, so a test can check it.
import { t } from '../i18n';
import type { hideOf } from '../net/view';

/** The line for the game this tablet is in, or null when it is in none or the game has nothing to count. */
export function hideLine(game: ReturnType<typeof hideOf>): string | null {
  if (!game?.role) return null;
  const n = Math.ceil(game.left);
  if (game.phase === 'count') return t(game.role === 'hide' ? 'hide.countHide' : 'hide.countSeek', { n: String(n) });
  if (game.phase === 'seek') return t(game.role === 'hide' ? 'hide.hiding' : 'hide.seeking', { n: String(n) });
  return null;
}

export interface HideCount {
  set(line: string | null): void;
  /** A heart over the screen for a moment, for a find. */
  heart(): void;
}

export function createHideCount(parent: HTMLElement): HideCount {
  const root = document.createElement('div');
  root.id = 'hide-count';
  root.setAttribute('aria-live', 'polite');
  root.style.cssText =
    'position:fixed;top:128px;left:50%;transform:translateX(-50%);z-index:5;padding:8px 20px;border-radius:12px;display:none;' +
    'background:rgba(0,0,0,.55);color:#fff;font:700 28px system-ui,sans-serif;text-align:center;pointer-events:none;white-space:nowrap';
  parent.appendChild(root);
  const heart = document.createElement('div');
  heart.textContent = '♥';
  heart.style.cssText = 'position:fixed;top:40%;left:50%;transform:translate(-50%,-50%);z-index:5;font:96px system-ui,sans-serif;color:#ff5a7a;pointer-events:none;opacity:0;transition:opacity .3s';
  parent.appendChild(heart);
  let timer = 0;
  return {
    set(line) {
      root.style.display = line ? 'block' : 'none';
      if (line && root.textContent !== line) root.textContent = line;
    },
    heart() {
      heart.style.opacity = '1';
      window.clearTimeout(timer);
      timer = window.setTimeout(() => (heart.style.opacity = '0'), 1200);
    },
  };
}
