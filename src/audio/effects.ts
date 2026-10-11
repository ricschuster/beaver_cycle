// One-shot effects (docs/design/32_sound.md, slice 3), the beaver's group: what the player did, as sound cues. The sim has no
// event stream, so `watchBeaver` compares each frame's world with the last. Plain numbers only, so it is easy to test.

import type { WorldState } from '../sim/state';

export type Effect = 'chop' | 'fall' | 'splash' | 'slap' | 'stroke' | 'eat' | 'pickup' | 'setdown';

export interface Cue {
  effect: Effect;
  /** 0 to 1, before the effects volume. */
  gain: number;
}

/** Seconds each effect lasts: the voice it takes is free again then. */
export const DURATION: Record<Effect, number> = { chop: 0.2, fall: 1.5, splash: 0.7, slap: 0.3, stroke: 0.4, eat: 0.4, pickup: 0.15, setdown: 0.25 };

/** One gnaw per this many seconds of chopping progress. */
const CHOP_TICK = 0.5;
/** A swimming stroke, in real seconds, while the beaver moves in the water. */
const STROKE_EVERY = 0.9;
/** The beaver counts as moving when it covers this much ground between two frames, in metres. */
const MOVED = 0.02;

interface Seen {
  mode: string;
  x: number;
  z: number;
  felled: number;
  slapAt: number | null;
  chopId: string | null;
  chopTick: number;
  carrying: boolean;
  hauling: boolean;
  dragging: boolean;
  eaten: number;
  padAt: number | null;
  branchAt: number | null;
  strokeAt: number;
}

function look(w: WorldState, strokeAt: number): Seen {
  return {
    mode: w.beaver.mode,
    x: w.beaver.x,
    z: w.beaver.z,
    felled: w.felled.length,
    slapAt: w.lastSlap?.time ?? null,
    chopId: w.chop?.id ?? null,
    chopTick: w.chop ? Math.floor(w.chop.progress / CHOP_TICK) : 0,
    carrying: w.carry !== null,
    hauling: w.haul !== null,
    dragging: w.drag !== null,
    eaten: w.eaten,
    padAt: w.padAt,
    branchAt: w.branchAt,
    strokeAt,
  };
}

/**
 * Returns a function to call once a frame with the world and the real time in seconds. It gives the cues for what changed
 * since the call before. The first call gives none, so a loaded game does not start with a splash.
 */
export function watchBeaver(): (w: WorldState, now: number) => Cue[] {
  let was: Seen | null = null;
  return (w, now) => {
    const prev = was;
    const cur = look(w, prev?.strokeAt ?? now);
    was = cur;
    if (!prev) return [];
    const cues: Cue[] = [];
    if (w.chop && (w.chop.id !== prev.chopId || cur.chopTick > prev.chopTick)) cues.push({ effect: 'chop', gain: 0.7 });
    if (cur.felled > prev.felled) cues.push({ effect: 'fall', gain: 1 });
    if (cur.slapAt !== null && cur.slapAt !== prev.slapAt) cues.push({ effect: 'slap', gain: 0.9 });
    const wet = (m: string): boolean => m !== 'walk';
    if (wet(cur.mode) && !wet(prev.mode)) {
      cues.push({ effect: 'splash', gain: 0.8 });
      cur.strokeAt = now; // the first stroke comes after the splash, not with it
    }
    else if (!wet(cur.mode) && wet(prev.mode)) cues.push({ effect: 'splash', gain: 0.4 });
    if (cur.mode === 'swim' && Math.hypot(cur.x - prev.x, cur.z - prev.z) > MOVED && now - prev.strokeAt >= STROKE_EVERY) {
      cues.push({ effect: 'stroke', gain: 0.4 });
      cur.strokeAt = now;
    }
    const ate = cur.eaten > prev.eaten || cur.padAt !== prev.padAt || cur.branchAt !== prev.branchAt;
    if (ate) cues.push({ effect: 'eat', gain: 0.7 });
    const took = (cur.carrying && !prev.carrying) || (cur.hauling && !prev.hauling) || (cur.dragging && !prev.dragging);
    const put = (!cur.hauling && prev.hauling) || (!cur.dragging && prev.dragging) || (!cur.carrying && prev.carrying && !ate);
    if (took) cues.push({ effect: 'pickup', gain: 0.5 });
    else if (put) cues.push({ effect: 'setdown', gain: 0.6 });
    return cues;
  };
}

/**
 * The sounds playing now, for the tablet's limit of voices (design note, "Tablet budget"). A new sound that finds no free voice
 * takes the place of the quietest one if it is louder, and is dropped if not.
 */
export function createVoices(max: number): { admit(cue: Cue, now: number): boolean } {
  let playing: { until: number; gain: number }[] = [];
  return {
    admit(cue, now) {
      playing = playing.filter((v) => v.until > now);
      if (playing.length >= max) {
        let quietest = 0;
        for (let i = 1; i < playing.length; i++) if (playing[i]!.gain < playing[quietest]!.gain) quietest = i;
        if (playing[quietest]!.gain >= cue.gain) return false;
        playing.splice(quietest, 1);
      }
      playing.push({ until: now + DURATION[cue.effect], gain: cue.gain });
      return true;
    },
  };
}
