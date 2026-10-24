import { describe, expect, it } from 'vitest';
import type { Say } from './says';
import { SpeechHeard } from './speechHeard';

const say = (n: number, over: Partial<Say> = {}): Say => ({ n, from: 'a', to: 'b', q: 'play', at: 0, ...over }) as Say;
const head = { x: 1, y: 2, z: 3 };

describe('speech heard', () => {
  it('does not replay what was said before the first snapshot', () => {
    const h = new SpeechHeard(3.5);
    expect(h.hear([say(1)], 0)).toEqual([]);
    expect(h.visible(0.1, () => head)).toEqual([]);
  });

  it('hears a say once, and a reply to it as the answerer\'s own', () => {
    const h = new SpeechHeard(3.5);
    h.hear([], 0);
    const first = h.hear([say(1)], 1);
    expect(first.map((x) => [x.who, x.kind, x.id])).toEqual([['a', 'q', 'play']]);
    expect(h.hear([say(1)], 1.1)).toEqual([]);
    const reply = h.hear([say(1, { a: 'yes' })], 2);
    expect(reply.map((x) => [x.who, x.kind, x.id])).toEqual([['b', 'a', 'yes']]);
  });

  it('shows a bubble over the head for its life, then drops it', () => {
    const h = new SpeechHeard(3.5);
    h.hear([], 0);
    h.hear([say(1)], 10);
    const shown = h.visible(11, () => head);
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({ x: 1, y: 2, z: 3, age: 1 });
    expect(h.visible(13.5, () => head)).toEqual([]);
    expect(h.visible(11, () => head)).toEqual([]);
  });

  it('drops the bubble of a speaker that is gone, and keeps one over a speaker inside without drawing it', () => {
    const h = new SpeechHeard(3.5);
    h.hear([], 0);
    h.hear([say(1)], 10);
    expect(h.visible(10.5, () => ({ ...head, inside: true }))).toEqual([]);
    expect(h.visible(11, () => head)).toHaveLength(1);
    expect(h.visible(11.5, () => undefined)).toEqual([]);
    expect(h.visible(11.6, () => head)).toEqual([]);
  });

  it('forgets the oldest ids when it keeps too many, and still hears a new one', () => {
    const h = new SpeechHeard(3.5);
    h.hear([], 0);
    for (let n = 1; n <= 250; n++) h.hear([say(n)], n);
    expect(h.hear([say(251)], 300)).toHaveLength(1);
  });
});
