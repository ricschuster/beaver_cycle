import { describe, expect, it } from 'vitest';
import { dreamOf, wireOf } from './dreamWire';
import { joinDream, newDream, stepDream, type DreamInput } from '../sim/dream';
import { readToHost } from './protocol';

const still: DreamInput = { move: { x: 0, z: 0 }, hop: false, slap: false, play: false };

describe('a dream on the wire', () => {
  it('makes the same dream again from the seed and what moved', () => {
    let s = joinDream(newDream(7), 'g1');
    // Stand on a sweet so it is taken, then walk on.
    const sweet = s.sweets.find((w) => !w.floating)!;
    s = { ...s, beaver: { ...s.beaver, x: sweet.x, z: sweet.z } };
    for (let i = 0; i < 40; i++) s = stepDream(s, { ...still, move: { x: 0, z: 1 } }, 1 / 30, { g1: { ...still, move: { x: 1, z: 0 } } }).state;
    expect(s.sweets.some((w) => w.taken)).toBe(true);
    const wire = JSON.parse(JSON.stringify(wireOf(s, 'g2', 'candy')));
    const back = dreamOf(wire);
    expect(back.beaver).toEqual(s.beaver);
    expect(back.friends).toEqual(s.friends);
    expect(back.mallows).toEqual(s.mallows);
    expect(back.sweets).toEqual(s.sweets);
    expect(back.land.river).toEqual(s.land.river);
    expect(back.game).toEqual(s.game);
  });

  it('keeps the wire small: no land and no sweets that are still there', () => {
    const text = JSON.stringify(wireOf(newDream(7), 'g1', 'candy'));
    expect(text).not.toContain('"river"');
    expect(JSON.parse(text).taken).toEqual([]);
  });
});

describe('the dream message', () => {
  it('is clamped to the unit circle and keeps only what a dream understands', () => {
    const m = readToHost(JSON.stringify({ t: 'dream', input: { move: { x: 9, z: 0 }, hop: true, slap: 'yes', play: false, pick: 'seek' } }));
    expect(m).toEqual({ t: 'dream', input: { move: { x: 1, z: 0 }, hop: true, slap: false, play: false, pick: 'seek' } });
    expect(readToHost(JSON.stringify({ t: 'dream' }))).toEqual({ t: 'dream', input: { move: { x: 0, z: 0 }, hop: false, slap: false, play: false } });
  });
});
