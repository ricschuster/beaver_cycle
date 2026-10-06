// What the beaver carries and how far a gnaw has got, top left under the clock. DOM only.
import { CARRY_MAX } from '../sim/trees';

export interface CarryHud {
  /** `gnaw` is 0 to 1 while a tree is being gnawed, null otherwise. */
  set(wood: number, felled: number, gnaw: number | null): void;
}

/** "Wood 2/4, 5 trees felled", with the gnaw progress in percent while gnawing. */
export function formatCarry(wood: number, felled: number, gnaw: number | null): string {
  const base = `Wood ${wood}/${CARRY_MAX}, ${felled} ${felled === 1 ? 'tree' : 'trees'} felled`;
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
    set(wood, felled, gnaw) {
      const text = formatCarry(wood, felled, gnaw);
      if (text !== shown) {
        shown = text;
        root.textContent = text;
      }
    },
  };
}
