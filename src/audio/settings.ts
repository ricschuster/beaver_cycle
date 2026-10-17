// The sound settings (docs/design/32_sound.md): two volumes and a mute, kept in the browser between runs.
// Storage can be blocked, so a failed read gives the defaults and a failed write is ignored.

export interface SoundSettings {
  /** 0 to 1, everything but the music. */
  effects: number;
  /** 0 to 1. */
  music: number;
  muted: boolean;
}

/** The key the settings are kept under. */
export const SOUND_KEY = 'beaver-cycle.sound';

/** Effects at a middle volume, music quieter (20 %), so a tablet in a quiet room is not a surprise. */
export const DEFAULT_SOUND: SoundSettings = { effects: 0.5, music: 0.2, muted: false };

const volume = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

/** The settings from stored text, with anything missing or wrong replaced by the default. */
export function parseSound(text: string | null): SoundSettings {
  if (!text) return DEFAULT_SOUND;
  try {
    const o = JSON.parse(text) as Partial<Record<keyof SoundSettings, unknown>> | null;
    if (!o || typeof o !== 'object') return DEFAULT_SOUND;
    return {
      effects: volume(o.effects, DEFAULT_SOUND.effects),
      music: volume(o.music, DEFAULT_SOUND.music),
      muted: o.muted === true,
    };
  } catch {
    return DEFAULT_SOUND;
  }
}

export function loadSound(storage: Pick<Storage, 'getItem'> | null): SoundSettings {
  try {
    return parseSound(storage?.getItem(SOUND_KEY) ?? null);
  } catch {
    return DEFAULT_SOUND;
  }
}

export function saveSound(storage: Pick<Storage, 'setItem'> | null, s: SoundSettings): void {
  try {
    storage?.setItem(SOUND_KEY, JSON.stringify(s));
  } catch {
    // Not kept: the defaults come back next time.
  }
}
