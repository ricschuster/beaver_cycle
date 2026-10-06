// Trees felled, the log being dragged, and how far a gnaw has got, top left under the clock. DOM only.
export interface CarryHud {
  /** `gnaw` is 0 to 1 while a tree is being gnawed, null otherwise. */
  set(felled: number, dragging: boolean, gnaw: number | null): void;
}

/** "5 trees felled", with ", dragging a log" or the gnaw progress in percent while either is going on. */
export function formatCarry(felled: number, dragging: boolean, gnaw: number | null): string {
  const base = `${felled} ${felled === 1 ? 'tree' : 'trees'} felled`;
  if (dragging) return `${base}, dragging a log`;
  return gnaw === null ? base : `${base}, gnawing ${Math.floor(Math.min(1, gnaw) * 100)}%`;
}

export function createCarryHud(parent: HTMLElement): CarryHud {
  const root = document.createElement('div');
  root.id = 'carry-hud';
  root.setAttribute('role', 'status');
  root.style.cssText =
    'position:fixed;top:44px;left:8px;z-index:5;padding:6px 10px;border-radius:8px;background:rgba(0,0,0,.45);' +
    'color:#fff;font:14px system-ui,sans-serif;pointer-events:none';
  parent.appendChild(root);
  let shown = '';
  return {
    set(felled, dragging, gnaw) {
      const text = formatCarry(felled, dragging, gnaw);
      if (text !== shown) {
        shown = text;
        root.textContent = text;
      }
    },
  };
}
