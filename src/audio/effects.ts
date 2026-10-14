// One-shot effects (docs/design/32_sound.md, slice 3), the beaver's group: what the player did, as sound cues. The sim has no
// event stream, so `watchBeaver` compares each frame's world with the last. Plain numbers only, so it is easy to test.

import { isMate } from '../sim/predators';
import type { WorldState } from '../sim/state';
import type { Animal } from '../sim/animals';
import { LODGE_WOOD } from '../sim/lodge';
import { follower } from '../sim/partners';

export type Effect =
  | 'chop' | 'fall' | 'splash' | 'slap' | 'slapwater' | 'stroke' | 'eat' | 'pickup' | 'setdown'
  // The building group: a log, a load of mud, a rock placed, and a piece finished or mended.
  | 'wood' | 'mud' | 'rock' | 'done'
  // The animals: a duck, and the warnings of the owl, the fox, the lynx and the bear, and the beaver hurt.
  | 'quack' | 'hoot' | 'yap' | 'growl' | 'howl' | 'rumble' | 'hurt'
  // Talk: a babble per line (its pitch and length come with the cue), and the call of a partner or a lone beaver.
  | 'babble' | 'chirp'
  // The dream: a chime for each kind of sweet, a giggle and a cheer.
  | 'chime' | 'chimeHigh' | 'chimeStar' | 'giggle' | 'cheer';

export interface Cue {
  effect: Effect;
  /** 0 to 1, before the effects volume. */
  gain: number;
  /** For a babble: the pitch of the speaker in Hz, how long the line runs in seconds, and a seed so no two sound alike. */
  voice?: { pitch: number; seconds: number; seed: number };
}

/** Seconds each effect lasts: the voice it takes is free again then. */
export const DURATION: Record<Effect, number> = { chop: 0.5, fall: 1.5, splash: 0.7, slap: 0.3, slapwater: 0.5, stroke: 0.4, eat: 0.4, pickup: 0.15, setdown: 0.25, wood: 0.35, mud: 0.4, rock: 0.3, done: 0.9, quack: 0.45, hoot: 1.2, yap: 0.35, growl: 1.1, howl: 2.4, rumble: 1.4, hurt: 0.5, babble: 0, chirp: 0.45, chime: 0.8, chimeHigh: 0.8, chimeStar: 1.1, giggle: 0.8, cheer: 1.4 };

/** Seconds a cue holds its voice. */
export const cueSeconds = (c: Cue): number => c.voice?.seconds ?? DURATION[c.effect];

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
    if (cur.slapAt !== null && cur.slapAt !== prev.slapAt) cues.push({ effect: cur.mode === 'walk' ? 'slap' : 'slapwater', gain: 0.9 });
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
      playing.push({ until: now + cueSeconds(cue), gain: cue.gain });
      return true;
    },
  };
}

/** Where each predator's warning is heard from, and the effect it gives. */
const WARNING: Record<string, Effect> = { owl: 'hoot', fox: 'yap', lynx: 'growl', wolf: 'howl', bear: 'rumble' };
/** A predator is heard within this many metres. */
const HEARD = 60;
/** A duck is heard within this many metres, and calls about this often (real seconds) at the nearest. */
const QUACK_HEARD = 30;
const QUACK_EVERY = 9;

interface Built {
  wood: number;
  mud: number;
  rock: number;
  level: number;
}

/**
 * Like `watchBeaver`, for what is built and for the animals: a log, mud or a rock placed on a dam or the lodge, a piece
 * finished or mended, the warning of each predator when it first notices the beaver, the beaver hurt, and now and then a duck
 * near by. `ambient` is the animals around the beaver now. The first call gives no cue.
 */
export function watchWorld(): (w: WorldState, ambient: readonly Animal[], now: number) => Cue[] {
  let first = true;
  let dams = new Map<string, Built>();
  let lodgeWood = 0;
  let mended = 0;
  let hurtAt: number | null = null;
  let warned = new Set<string>();
  let quackAt = 0;
  let following: string | null = null;
  let leading = false;
  return (w, ambient, now) => {
    const cues: Cue[] = [];
    const nowDams = new Map<string, Built>();
    for (const d of w.dams) nowDams.set(d.spot, { wood: d.wood, mud: d.mud, rock: d.rock, level: d.level ?? 1 });
    const nowWood = w.lodge?.wood ?? 0;
    const nowWarned = new Set(w.predators.filter((p) => p.phase !== 'off').map((p) => p.id));
    if (!first) {
      let wood = false;
      let mud = false;
      let rock = false;
      let done = false;
      for (const [spot, d] of nowDams) {
        const was = dams.get(spot) ?? { wood: 0, mud: 0, rock: 0, level: 0 };
        wood ||= d.wood > was.wood;
        mud ||= d.mud > was.mud;
        rock ||= d.rock > was.rock;
        done ||= was.level > 0 && d.level > was.level;
      }
      if (nowWood > lodgeWood) {
        wood = true;
        done ||= nowWood >= LODGE_WOOD && lodgeWood < LODGE_WOOD;
      }
      if (w.mended > mended) done = true;
      if (wood) cues.push({ effect: 'wood', gain: 0.8 });
      if (mud) cues.push({ effect: 'mud', gain: 0.7 });
      if (rock) cues.push({ effect: 'rock', gain: 0.8 });
      if (done) cues.push({ effect: 'done', gain: 0.8 });
      for (const p of w.predators) {
        if (p.phase === 'off' || warned.has(p.id) || isMate(p)) continue;
        const near = Math.hypot(p.x - w.beaver.x, p.z - w.beaver.z);
        if (near < HEARD) cues.push({ effect: WARNING[p.kind] ?? 'growl', gain: Math.max(0.3, 1 - near / HEARD) });
      }
      const follow = follower(w.partners)?.id ?? null;
      if ((follow !== null && follow !== following) || (w.leader !== null && !leading)) cues.push({ effect: 'chirp', gain: 0.7 });
      if (w.hurtAt !== null && w.hurtAt !== hurtAt) cues.push({ effect: 'hurt', gain: 0.9 });
      if (now - quackAt >= QUACK_EVERY) {
        let near = Infinity;
        for (const a of ambient) if (a.kind === 'duck') near = Math.min(near, Math.hypot(a.x - w.beaver.x, a.z - w.beaver.z));
        if (near < QUACK_HEARD) {
          cues.push({ effect: 'quack', gain: 0.6 * (1 - near / QUACK_HEARD) + 0.1 });
          quackAt = now;
        }
      }
    } else quackAt = now;
    first = false;
    dams = nowDams;
    lodgeWood = nowWood;
    mended = w.mended;
    hurtAt = w.hurtAt;
    following = follower(w.partners)?.id ?? null;
    leading = w.leader !== null;
    warned = nowWarned;
    return cues;
  };
}
