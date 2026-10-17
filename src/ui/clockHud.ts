// Clock readout: season, day of the season, and time of day, top left. DOM only.
import { text, t } from '../i18n';
import { DAY_FRACTION, dateAt } from '../sim/clock';

export interface ClockHud {
  set(clock: number): void;
}

/** "Spring, day 3, morning" for a game clock value. */
export function formatClock(clock: number): string {
  const d = dateAt(clock);
  const at = d.timeOfDay;
  const part = at < DAY_FRACTION * 0.4 ? 'morning' : at < DAY_FRACTION * 0.7 ? 'midday' : at < DAY_FRACTION ? 'evening' : 'night';
  return t('clock.line', { season: text(`season.${d.season}`), day: d.dayOfSeason, part: text(`daypart.${part}`) });
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
      const line = formatClock(clock);
      if (line !== shown) {
        shown = line;
        root.textContent = line;
      }
    },
  };
}
