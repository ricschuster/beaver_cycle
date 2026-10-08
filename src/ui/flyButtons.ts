// Up and Down buttons for the free fly view (?fly=free) on a tablet, at the bottom right. Held, like the dive button.
// The stick moves the drone and a drag on the empty view turns it. DOM only.

import { touchTuning } from '../actions/stick';

export interface FlyButtons {
  /** -1 while Down is held, 1 while Up is held, 0 otherwise (both held cancel out). */
  read(): number;
}

const GLASS = 'background:rgba(0,0,0,.35);border:2px solid rgba(255,255,255,.6);color:#fff;font:600 14px sans-serif;';

export function createFlyButtons(parent: HTMLElement, visible: boolean): FlyButtons {
  const { buttonSize } = touchTuning;
  const held = new Map<number, number>();
  const root = document.createElement('div');
  root.id = 'fly-buttons';
  root.style.cssText = `display:${visible ? 'block' : 'none'};position:fixed;inset:0;pointer-events:none;z-index:4;user-select:none;-webkit-user-select:none;`;
  const make = (label: string, dir: number, bottom: string): void => {
    const b = document.createElement('button');
    b.id = `fly-${label.toLowerCase()}`;
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-label', label);
    b.style.cssText = `${GLASS}position:absolute;right:max(32px,env(safe-area-inset-right));bottom:${bottom};width:${buttonSize}px;height:${buttonSize}px;border-radius:50%;pointer-events:auto;touch-action:none;`;
    b.addEventListener('pointerdown', (e) => {
      b.setPointerCapture(e.pointerId);
      held.set(e.pointerId, dir);
    });
    const end = (e: PointerEvent): void => {
      held.delete(e.pointerId);
    };
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', end);
    root.appendChild(b);
  };
  make('Down', -1, '48px');
  make('Up', 1, `calc(48px + ${buttonSize + 16}px)`);
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  parent.appendChild(root);
  return {
    read() {
      let sum = 0;
      for (const d of held.values()) sum += d;
      return Math.max(-1, Math.min(1, sum));
    },
  };
}
