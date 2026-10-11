// Recorded sounds (docs/design/32_sound.md, "Recordings"): which files stand in for each effect and layer, and how one is picked.
// `public/audio/manifest.json` is written by tools/sound-preview/pick_from_ratings.py from the author's ratings, so choosing
// other clips never needs a code change. An effect or layer with no entry keeps its sound made in code.

import type { Effect } from './effects';
import type { Layer } from './soundOut';

export interface Manifest {
  effects: Partial<Record<Effect, string[]>>;
  layers: Partial<Record<Layer, string[]>>;
}

/** Pitch of a played clip varies by up to this much either way (7%), and its gain by up to 15% down, so a repeat is not the same. */
export const PITCH_JITTER = 0.07;
export const GAIN_JITTER = 0.15;

/** Reads a manifest, dropping anything that is not a list of file names. */
export function parseManifest(json: unknown): Manifest {
  const out: Manifest = { effects: {}, layers: {} };
  if (typeof json !== 'object' || json === null) return out;
  const j = json as { effects?: unknown; layers?: unknown };
  const lists = (v: unknown): [string, string[]][] =>
    typeof v === 'object' && v !== null
      ? Object.entries(v).flatMap(([k, files]): [string, string[]][] =>
          Array.isArray(files) && files.length > 0 && files.every((f) => typeof f === 'string' && /^[\w.-]+$/.test(f)) ? [[k, files as string[]]] : [])
      : [];
  for (const [k, files] of lists(j.effects)) out.effects[k as Effect] = files;
  for (const [k, files] of lists(j.layers)) out.layers[k as Layer] = files;
  return out;
}

/** One item of a list, chosen with `rand` (0 up to 1). Avoids `not` (the one played last) when there is a choice. */
export function pickVariant<T>(list: readonly T[], rand: number, not?: T): T {
  const pool = list.length > 1 && not !== undefined ? list.filter((x) => x !== not) : list;
  return pool[Math.min(pool.length - 1, Math.floor(rand * pool.length))]!;
}

/** Playback rate and gain multiplier for one play, from two random numbers (0 up to 1). */
export function variation(r1: number, r2: number): { rate: number; gain: number } {
  return { rate: 1 + PITCH_JITTER * (2 * r1 - 1), gain: 1 - GAIN_JITTER * r2 };
}
