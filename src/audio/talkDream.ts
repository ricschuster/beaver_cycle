// Sound for talk and the dream (docs/design/32_sound.md, slices 4 and 5), as cues: a babble per line of dialog and the dream's
// events as chimes, giggles and cheers. Plain data, no audio device, so it is easy to test.

import type { DreamEvent } from '../sim/dream';
import type { SpeakerKind } from '../sim/talk';
import type { Cue } from './effects';

/** The pitch of each speaker, in Hz: a kit is high, a papa low. */
const PITCH: Record<SpeakerKind, number> = { kit: 560, mama: 320, 'home-mama': 320, papa: 190, 'home-papa': 190, partner: 400 };

/** A small number from text, the same every time. */
function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** Longest and shortest babble in seconds: a line is read in seconds, but a babble should not run on. */
const BABBLE_MIN = 0.5;
const BABBLE_MAX = 2.4;

/**
 * The babble for one line. The pitch follows who speaks, nudged by up to a tenth by the speaker's id so two papas differ, and the
 * length follows the line.
 */
export function babbleCue(kind: SpeakerKind, id: string, text: string): Cue {
  const h = hashOf(id);
  const pitch = PITCH[kind] * (0.9 + 0.2 * ((h % 1000) / 1000));
  const seconds = Math.min(BABBLE_MAX, Math.max(BABBLE_MIN, 0.2 + 0.03 * text.length));
  return { effect: 'babble', gain: 0.6, voice: { pitch, seconds, seed: hashOf(`${id}:${text}`) } };
}

/** The cues for the events of one dream frame. */
export function dreamCues(events: readonly DreamEvent[]): Cue[] {
  const cues: Cue[] = [];
  for (const e of events) {
    switch (e.what) {
      case 'sweet':
        cues.push({ effect: e.kind === 'drop' ? 'chime' : e.kind === 'swirl' ? 'chimeHigh' : 'chimeStar', gain: 0.6 });
        break;
      case 'statue':
        cues.push({ effect: 'chimeStar', gain: 0.9 });
        break;
      case 'shower':
        cues.push({ effect: 'chimeStar', gain: 0.8 });
        break;
      case 'splash':
        cues.push({ effect: 'splash', gain: 0.5 });
        break;
      case 'greet':
      case 'giggle':
      case 'caught':
      case 'found':
      case 'spotted':
        cues.push({ effect: 'giggle', gain: 0.6 });
        break;
      case 'tagEnd':
      case 'seekEnd':
      case 'hideEnd':
        cues.push({ effect: 'cheer', gain: 0.8 });
        break;
    }
  }
  return cues;
}
