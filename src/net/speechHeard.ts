// Which says and replies a tablet has heard and which of them still show a picture over the speaker's head (#802). It holds the
// bookkeeping that main.ts kept inline: a say is heard once, the first snapshot only fills the list (a joiner does not replay old talk),
// and a bubble lives for a few seconds. No DOM, no three.js.
import { pictureOf, type PictureId, type ReplyId, type Say, type SayId } from './says';

/** A say or a reply heard for the first time: who speaks, the words (as the question or answer id), and the picture. */
export type Words = { kind: 'q'; id: SayId } | { kind: 'a'; id: ReplyId };
export type Heard = { who: string; picture: PictureId } & Words;

/** Where a speaker's head is. */
export interface HeadAt {
  x: number;
  y: number;
  z: number;
  inside?: boolean;
}

export interface Bubble {
  x: number;
  y: number;
  z: number;
  picture: PictureId;
  age: number;
}

/** The ids kept before the oldest half is forgotten. */
const KEEP = 400;

export class SpeechHeard {
  private readonly spoken = new Set<number>();
  private started = false;
  private readonly bubbles = new Map<string, { picture: PictureId; at: number }>();

  constructor(private readonly life: number) {}

  /** Takes the says of a snapshot (none for no snapshot yet) at `real` seconds; returns what is new and heard live. */
  hear(says: readonly Say[] | undefined, real: number): Heard[] {
    const fresh: Heard[] = [];
    for (const k of says ?? []) {
      const parts: [string, number, Words][] = [[k.from, k.n * 2, { kind: 'q', id: k.q }]];
      if (k.a !== undefined) parts.push([k.to, k.n * 2 + 1, { kind: 'a', id: k.a }]);
      for (const [who, key, words] of parts) {
        if (this.spoken.has(key)) continue;
        this.spoken.add(key);
        if (!this.started) continue;
        const picture = pictureOf(words.id);
        this.bubbles.set(who, { picture, at: real });
        fresh.push({ who, picture, ...words });
      }
    }
    if (says) this.started = true;
    if (this.spoken.size > KEEP) for (const key of [...this.spoken].slice(0, KEEP / 2)) this.spoken.delete(key);
    return fresh;
  }

  /** The bubbles to draw now: an old one, or one whose speaker is gone, is dropped; one over a speaker inside a lodge is kept but not drawn. */
  visible(real: number, headOf: (who: string) => HeadAt | undefined): Bubble[] {
    const shown: Bubble[] = [];
    for (const [who, b] of this.bubbles) {
      const age = real - b.at;
      const at = headOf(who);
      if (age >= this.life || !at) this.bubbles.delete(who);
      else if (!at.inside) shown.push({ x: at.x, y: at.y, z: at.z, picture: b.picture, age });
    }
    return shown;
  }
}
