// Clock readout: season, day of the season, and time of day, top left. DOM only.
import { DAY_FRACTION, dateAt } from '../sim/clock';

export interface ClockHud {
  set(clock: number): void;
}

/** "Spring, day 3, morning" for a game clock value. */
export function formatClock(clock: number): string {
  const d = dateAt(clock);
  const t = d.timeOfDay;
  const part = t < DAY_FRACTION * 0.4 ? 'morning' : t < DAY_FRACTION * 0.7 ? 'midday' : t < DAY_FRACTION ? 'evening' : 'night';
  const season = d.season[0]!.toUpperCase() + d.season.slice(1);
  return `${season}, day ${d.dayOfSeason}, ${part}`;
}

export function createClockHud(parent: HTMLElement): ClockHud {
  const root = document.createElement('div');
  root.id = 'clock-hud';
  root.setAttribute('role', 'status');
  root.style.cssText =
    'position:fixed;top:8px;left:8px;z-index:5;padding:6px 10px;border-radius:8px;background:rgba(0,0,0,.45);' +
    'color:#fff;font:14px system-ui,sans-serif;pointer-events:none';
  parent.appendChild(root);
  let shown = '';
  return {
    set(clock) {
      const text = formatClock(clock);
      if (text !== shown) {
        shown = text;
        root.textContent = text;
      }
    },
  };
}
