// Breath meter: a small bar at the bottom centre, shown only while breath is
// below full. DOM only; the game feeds it the beaver's breath each frame.

export interface BreathMeter {
  /** Breath from 0 to 1. The bar hides at 1 and turns amber when low. */
  set(breath: number): void;
}

export const LOW_BREATH = 0.25;

/** What the bar shows for a breath value. */
export function meterLook(breath: number): { visible: boolean; percent: number; color: string } {
  const b = Math.min(1, Math.max(0, breath));
  return { visible: b < 1, percent: Math.round(b * 100), color: b < LOW_BREATH ? '#f0a23c' : '#7fd0ef' };
}

export function createBreathMeter(parent: HTMLElement): BreathMeter {
  const root = document.createElement('div');
  root.id = 'breath-meter';
  root.setAttribute('role', 'progressbar');
  root.setAttribute('aria-label', 'Breath');
  root.setAttribute('aria-valuemin', '0');
  root.setAttribute('aria-valuemax', '100');
  root.style.cssText =
    'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);width:min(280px,60vw);height:14px;' +
    'border-radius:7px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.6);overflow:hidden;display:none;z-index:5';
  const fill = document.createElement('div');
  fill.style.cssText = 'height:100%;width:100%;background:#7fd0ef';
  root.appendChild(fill);
  parent.appendChild(root);

  return {
    set(breath) {
      const look = meterLook(breath);
      root.style.display = look.visible ? 'block' : 'none';
      fill.style.width = `${look.percent}%`;
      fill.style.background = look.color;
      root.setAttribute('aria-valuenow', String(look.percent));
    },
  };
}
