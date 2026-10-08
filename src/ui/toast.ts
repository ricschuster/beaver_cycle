// A short message that appears at the top centre and fades away, for things like an achievement won. DOM only.
export interface Toast {
  show(text: string): void;
}

/** How long a toast stays, in milliseconds. */
export const TOAST_MS = 4000;

export function createToast(parent: HTMLElement): Toast {
  const root = document.createElement('div');
  root.id = 'toast';
  root.setAttribute('role', 'status');
  root.style.cssText =
    'position:fixed;top:72px;left:50%;transform:translateX(-50%);z-index:6;padding:10px 18px;border-radius:10px;' +
    'background:rgba(0,0,0,.65);color:#fff;font:16px system-ui,sans-serif;pointer-events:none;opacity:0;transition:opacity .4s';
  parent.appendChild(root);
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    show(text) {
      root.textContent = text;
      root.style.opacity = '1';
      clearTimeout(timer);
      timer = setTimeout(() => {
        root.style.opacity = '0';
      }, TOAST_MS);
    },
  };
}
