// Generative music (docs/design/32_sound.md, slice 6): no recording, only a few rules. Every note comes from one major pentatonic
// scale, so no two notes clash, and a slow pad changes chord now and then under single notes that fall at random. The valley is
// slow and sparse, the dream a brighter, quicker music box. No audio device here, so it is easy to test.

import { rng } from './synth';
import type { Season } from '../sim/clock';

/** What the music plays: the valley, the dream, or nothing. */
export type MusicMood = 'valley' | 'dream' | 'off';

/** The instruments: a string section (pad), a harp, a flute, and a celesta-like bell. */
export type NoteVoice = 'pad' | 'pluck' | 'flute' | 'bell';

export interface Note {
  /** Seconds from the start of the music at which it begins. */
  time: number;
  hz: number;
  /** How long it sounds, in seconds. */
  seconds: number;
  /** 0 to 1 before the music volume. */
  gain: number;
  voice: NoteVoice;
}

/** The major pentatonic, in semitones above the key note. Any mix of these sounds consonant. */
export const SCALE = [0, 2, 4, 7, 9] as const;

/** The valley is in A (110 Hz at the bottom), the dream a fourth higher in D. */
const KEY_HZ = { valley: 110, dream: 146.83 } as const;

/** The pitch of a step of the scale, counted up from the key note (0 is the key, 5 is its octave). */
export function stepHz(key: number, step: number): number {
  const octave = Math.floor(step / SCALE.length);
  const degree = ((step % SCALE.length) + SCALE.length) % SCALE.length;
  return key * 2 ** (octave + SCALE[degree]! / 12);
}

/** Facts about each mood. Gaps are the seconds between single notes; a chord is held for `chord` seconds. */
const MOODS = {
  valley: { chord: 36, padGain: 0.5, gap: [6, 14], noteGain: 0.35, voice: 'pluck', low: 5, high: 12, pad: 14 },
  dream: { chord: 16, padGain: 0.3, gap: [0.45, 1.1], noteGain: 0.4, voice: 'bell', low: 10, high: 17, pad: 8 },
} as const;

/** What colours the valley music: the season and whether it is night. The dream is not coloured. */
export interface MusicColour {
  season: Season;
  night: boolean;
}

/** How a season bends the valley music: a longer or shorter wait between notes, steps up or down the scale, and the share of flute. */
const SEASON_COLOUR: Record<Season, { gap: number; shift: number; flute: number }> = {
  spring: { gap: 0.9, shift: 0, flute: 0.4 },
  summer: { gap: 0.8, shift: 1, flute: 0.3 },
  autumn: { gap: 1.1, shift: -1, flute: 0.55 },
  winter: { gap: 1.4, shift: -2, flute: 0.4 },
};

/** At night the notes are fewer, lower, softer and more often a flute, and the chords last longer. */
const NIGHT_COLOUR = { gap: 1.6, shift: -2, flute: 0.55, gain: 0.8, chord: 1.3 } as const;

/** The valley music with no colour at all, the way it was before: a spring day. */
export const PLAIN_COLOUR: MusicColour = { season: 'spring', night: false };

/** The root steps a chord may start on; each chord is the root with the steps two and four above it. */
const ROOTS = [0, 3, 1, 4, 2];

export interface Composer {
  /** Change the mood. Notes already given stay as they are. */
  setMood(mood: Exclude<MusicMood, 'off'>): void;
  /** Change the season and night colour of the valley music. Notes already given stay as they are. */
  setColour(colour: MusicColour): void;
  /** The notes that begin before `until` seconds and have not been given yet, in order of time. */
  notes(until: number): Note[];
}

/** The same seed always makes the same music. `start` is the time of the first notes. */
export function createComposer(seed: number, start = 0): Composer {
  const rand = rng(seed);
  let mood: Exclude<MusicMood, 'off'> = 'valley';
  let chordAt = start;
  let noteAt = start + 3;
  let chordNo = 0;
  let stepNow = 8;
  let colour = PLAIN_COLOUR;
  const pick = (range: readonly [number, number]): number => range[0] + (range[1] - range[0]) * rand();
  return {
    setMood(m) {
      mood = m;
    },
    setColour(c) {
      colour = c;
    },
    notes(until) {
      const out: Note[] = [];
      for (;;) {
        const m = MOODS[mood];
        const key = KEY_HZ[mood];
        const valley = mood === 'valley';
        const sc = valley ? SEASON_COLOUR[colour.season] : { gap: 1, shift: 0, flute: 0 };
        const night = valley && colour.night;
        const shift = sc.shift + (night ? NIGHT_COLOUR.shift : 0);
        // Chords and single notes are made in order of time, whichever is next.
        if (chordAt <= noteAt && chordAt < until) {
          const root = ROOTS[chordNo++ % ROOTS.length]!;
          for (const above of [0, 2, 4]) {
            out.push({ time: chordAt + above * 0.15, hz: stepHz(key, root + above), seconds: m.pad, gain: m.padGain / 3, voice: 'pad' });
          }
          chordAt += m.chord * (night ? NIGHT_COLOUR.chord : 1);
        } else if (noteAt < until) {
          // A walk up and down the scale, by a step or two, kept between the low and high step of the mood.
          const move = Math.floor(rand() * 5) - 2;
          stepNow = Math.min(m.high + shift, Math.max(m.low + shift, stepNow + (move === 0 ? 2 : move)));
          // In the valley a harp and a flute take turns (about two in five are flute), in the dream it is always the bell.
          const voice: NoteVoice = m.voice === 'bell' ? 'bell' : rand() < (night ? NIGHT_COLOUR.flute : sc.flute) ? 'flute' : 'pluck';
          out.push({ time: noteAt, hz: stepHz(key, stepNow), seconds: voice === 'bell' ? 2.4 : voice === 'flute' ? 3.6 : 3.2, gain: m.noteGain * (night ? NIGHT_COLOUR.gain : 1) * (0.7 + 0.3 * rand()), voice });
          noteAt += pick(m.gap) * sc.gap * (night ? NIGHT_COLOUR.gap : 1);
        } else break;
      }
      return out.sort((a, b) => a.time - b.time);
    },
  };
}

/** Watches the frame rate and says when the music should give way (docs/design/32_sound.md, "Tablet budget"): after a stretch of slow frames, until a longer stretch of good ones. */
export function createFrameWatch(slowFps = 22, slowFor = 4, goodFps = 32, goodFor = 12): { update(fps: number, now: number): boolean } {
  let allowed = true;
  /** When the present stretch of slow (or good) frames began, or null if there is none. */
  let since: number | null = null;
  return {
    update(fps, now) {
      const flips = allowed ? fps < slowFps : fps >= goodFps;
      if (!flips) since = null;
      else {
        since ??= now;
        if (now - since >= (allowed ? slowFor : goodFor)) {
          allowed = !allowed;
          since = null;
        }
      }
      return allowed;
    },
  };
}
