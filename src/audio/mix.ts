// What the player should hear, as plain numbers (docs/design/32_sound.md). No audio device here, so it is easy to test.

import type { Season } from '../sim/clock';
import type { SoundSettings } from './settings';

/** A stream is heard from this far, in metres. */
export const STREAM_HEARD = 60;
/** The gain at the lake shore, where the water laps and does not rush. */
const LAKE_GAIN = 0.25;

export interface Hearing {
  /** Metres to the nearest stream centre line, or Infinity. */
  streamDistance: number;
  /** True when the beaver is on the lake or a pond. */
  onWater: boolean;
  /** True in a lodge: the walls keep the water out. */
  inLodge: boolean;
  /** True with the head under water: the sound is dull and quiet. */
  underwater: boolean;
  /** How bright it is, 0 at night to 1 at midday (`daylight` in sim/clock). */
  daylight: number;
  season: Season;
}

/** How much a lodge and the water over the head keep an outside sound out. */
function indoors(g: number, h: Hearing): number {
  if (h.inLodge) return g * 0.2;
  return h.underwater ? 0 : g;
}

const WIND_BY_SEASON: Record<Season, number> = { spring: 0.4, summer: 0.25, autumn: 0.5, winter: 0.3 };
const BIRDS_BY_SEASON: Record<Season, number> = { spring: 1, summer: 0.8, autumn: 0.35, winter: 0.1 };
const CRICKETS_BY_SEASON: Record<Season, number> = { spring: 0.4, summer: 1, autumn: 0.4, winter: 0 };
const OWL_BY_SEASON: Record<Season, number> = { spring: 0.8, summer: 0.6, autumn: 1, winter: 0.7 };

/** The wind: always there, stronger in autumn, and the one outside sound a lodge only dulls. */
export function windGain(h: Hearing): number {
  return indoors(WIND_BY_SEASON[h.season], h);
}

/** Birds by day, most in spring and few under the snow. */
export function birdsGain(h: Hearing): number {
  return indoors(BIRDS_BY_SEASON[h.season] * h.daylight * 0.8, h);
}

/** Crickets at night, none in winter. */
export function cricketsGain(h: Hearing): number {
  return indoors(CRICKETS_BY_SEASON[h.season] * (1 - h.daylight) * 0.6, h);
}

/** An owl at night, in every season. */
export function owlGain(h: Hearing): number {
  return indoors(OWL_BY_SEASON[h.season] * (1 - h.daylight) * 0.7, h);
}

/** How loud the rushing water is, 0 to 1: full at a stream, gone at 60 m, softer in a lodge and under water. */
export function waterGain(h: Hearing): number {
  const near = Number.isFinite(h.streamDistance) ? Math.max(0, 1 - h.streamDistance / STREAM_HEARD) : 0;
  let g = Math.max(near * near, h.onWater ? LAKE_GAIN : 0);
  if (h.inLodge) g *= 0.3;
  else if (h.underwater) g *= 0.4;
  return g;
}

/** The master gain for the effects bus: the volume, or silence when muted. */
export function effectsGain(s: SoundSettings): number {
  return s.muted ? 0 : s.effects;
}

/** The master gain for the music bus. */
export function musicGain(s: SoundSettings): number {
  return s.muted ? 0 : s.music;
}
