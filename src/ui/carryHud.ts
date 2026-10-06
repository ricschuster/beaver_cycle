// Trees felled, the log being dragged, and how far a gnaw has got, top left under the clock. DOM only.
import type { SiteProblem } from '../sim/lodge';

/** What the spot ahead is for a new lodge while dragging a log with no lodge yet: fine, a problem, or null when it does not apply. */
export type LodgeSite = 'ok' | SiteProblem | null;

const SITE_TEXT: Record<'ok' | SiteProblem, string> = {
  ok: 'press Build to start the lodge here',
  dry: 'no lodge spot, face the water',
  deep: 'no lodge spot, too deep',
  far: 'no lodge spot, no deep water near',
};

export interface CarryHud {
  /** `gnaw` is 0 to 1 while a tree is being gnawed, null otherwise. */
  set(felled: number, dragging: boolean, gnaw: number | null, lodge?: number | null, site?: LodgeSite): void;
}

/** "5 trees felled", then the lodge's progress once it is started, with ", dragging a log" or the gnaw progress in percent while either is going on. */
export function formatCarry(felled: number, dragging: boolean, gnaw: number | null, lodge: number | null = null, site: LodgeSite = null): string {
  const lodgeText = lodge === null ? '' : lodge >= 1 ? ', lodge done' : `, lodge ${Math.floor(lodge * 100)}%`;
  const base = `${felled} ${felled === 1 ? 'tree' : 'trees'} felled${lodgeText}`;
  if (dragging) return site ? `${base}, dragging a log, ${SITE_TEXT[site]}` : `${base}, dragging a log`;
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
    set(felled, dragging, gnaw, lodge = null, site = null) {
      const text = formatCarry(felled, dragging, gnaw, lodge, site);
      if (text !== shown) {
        shown = text;
        root.textContent = text;
      }
    },
  };
}
