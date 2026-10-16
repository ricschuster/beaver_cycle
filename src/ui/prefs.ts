// The player's choices in the Settings panel that are not sound (sound keeps its own, src/audio/settings.ts): the minimap mode
// and the sun's shadows. Kept in the browser between runs. Storage can be blocked, so a failed read gives the defaults and a
// failed write is ignored.

import type { MinimapMode } from './minimap';

export interface Prefs {
  /** The minimap mode the player chose, or null while they have not chosen (the default then follows the browser). */
  minimap: MinimapMode | null;
  /** The sun's shadows. Off by default: they halve the frame rate on the tablet (docs/design/16_shadow_cost.md). */
  shadows: boolean;
}

/** The key the choices are kept under. */
export const PREFS_KEY = 'beaver-cycle.prefs';

export const DEFAULT_PREFS: Prefs = { minimap: null, shadows: false };

const MODES: readonly string[] = ['north', 'turn', 'off'];

/** The choices from stored text, with anything missing or wrong replaced by the default. */
export function parsePrefs(text: string | null): Prefs {
  if (!text) return DEFAULT_PREFS;
  try {
    const o = JSON.parse(text) as Partial<Record<keyof Prefs, unknown>> | null;
    if (!o || typeof o !== 'object') return DEFAULT_PREFS;
    return {
      minimap: typeof o.minimap === 'string' && MODES.includes(o.minimap) ? (o.minimap as MinimapMode) : null,
      shadows: o.shadows === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function loadPrefs(storage: Pick<Storage, 'getItem'> | null): Prefs {
  try {
    return parsePrefs(storage?.getItem(PREFS_KEY) ?? null);
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(storage: Pick<Storage, 'setItem'> | null, prefs: Prefs): void {
  try {
    storage?.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Not kept: the defaults come back next time.
  }
}
