// A short message that appears at the top centre and fades away, for things like an achievement won. Messages that
// come in while one is showing wait in a queue and show in turn. DOM only.
export interface Toast {
  show(text: string): void;
}

/** How long a toast stays, in milliseconds. */
export const TOAST_MS = 4000;
/** The fade out takes this long before the next message shows, in milliseconds. */
export const TOAST_FADE_MS = 400;

export function createToast(parent: HTMLElement): Toast {
  const root = document.createElement('div');
  root.id = 'toast';
  root.setAttribute('role', 'status');
  root.style.cssText =
    'position:fixed;top:72px;left:50%;transform:translateX(-50%);z-index:6;padding:10px 18px;border-radius:10px;' +
    'background:rgba(0,0,0,.65);color:#fff;font:16px system-ui,sans-serif;pointer-events:none;opacity:0;transition:opacity .4s';
  parent.appendChild(root);
  const queue: string[] = [];
  let showing = false;
  const next = (): void => {
    const text = queue.shift();
    if (text === undefined) {
      showing = false;
      return;
    }
    showing = true;
    root.textContent = text;
    root.style.opacity = '1';
    setTimeout(() => {
      root.style.opacity = '0';
      setTimeout(next, TOAST_FADE_MS);
    }, TOAST_MS);
  };
  return {
    show(text) {
      queue.push(text);
      if (!showing) next();
    },
  };
}
