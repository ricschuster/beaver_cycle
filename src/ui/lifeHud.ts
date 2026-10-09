// Life stage readout at the top centre, clear of the clock and the carry readout: the stage and a bar for how far through it. DOM only.
import type { LifeInfo } from '../sim/life';

export interface LifeHud {
  set(life: LifeInfo): void;
}

/** "Baby, day 12" for the beaver's life. The bar is hidden for an adult, who has no next stage yet. */
export function formatLife(life: LifeInfo): string {
  const stage = life.stage[0]!.toUpperCase() + life.stage.slice(1);
  return `${stage}, ${life.ageDays} days old`;
}

export function createLifeHud(parent: HTMLElement): LifeHud {
  const root = document.createElement('div');
  root.id = 'life-hud';
  root.setAttribute('role', 'status');
  root.style.cssText =
    'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:5;text-align:center;padding:6px 10px;border-radius:8px;background:rgba(0,0,0,.45);' +
    'color:#fff;font:14px system-ui,sans-serif;pointer-events:none';
  const text = document.createElement('div');
  const track = document.createElement('div');
  track.style.cssText = 'margin:4px auto 0;height:5px;width:120px;border-radius:3px;background:rgba(255,255,255,.25)';
  const fill = document.createElement('div');
  fill.style.cssText = 'height:100%;width:0;border-radius:3px;background:#e8b64c';
  track.appendChild(fill);
  root.append(text, track);
  parent.appendChild(root);
  let shown = '';
  return {
    set(life) {
      const label = formatLife(life);
      if (label !== shown) {
        shown = label;
        text.textContent = label;
      }
      track.style.display = life.stage === 'adult' ? 'none' : 'block';
      fill.style.width = `${Math.round(life.progress * 100)}%`;
    },
  };
}
