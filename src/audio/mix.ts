// What the player should hear, as plain numbers (docs/design/32_sound.md). No audio device here, so it is easy to test.

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
