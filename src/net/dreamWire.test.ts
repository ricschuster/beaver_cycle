import { describe, expect, it } from 'vitest';
import { blendDream, dreamOf, mergeInput, wireOf } from './dreamWire';
import { joinDream, newDream, stepDream, viewFrom, type DreamInput } from '../sim/dream';
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

describe('smoothing between snapshots', () => {
  it('glides beavers, friends, marshmallow beavers and boats a share of the way, and turns the short way round', () => {
    const a = joinDream(newDream(7), 'g1');
    const move = (s: typeof a, dx: number, heading: number): typeof a => ({
      ...s,
      beaver: { ...s.beaver, x: s.beaver.x + dx, heading },
      friends: s.friends!.map((f) => ({ ...f, beaver: { ...f.beaver, z: f.beaver.z + dx } })),
      mallows: s.mallows.map((m) => ({ ...m, x: m.x + dx })),
      boats: s.boats!.map((b) => ({ ...b, z: b.z + dx })),
    });
    const from = { ...a, beaver: { ...a.beaver, heading: 3.0 } };
    const to = move(from, 2, -3.0);
    const mid = blendDream(from, to, 0.5);
    expect(mid.beaver.x).toBeCloseTo(from.beaver.x + 1, 6);
    expect(mid.friends![0]!.beaver.z).toBeCloseTo(from.friends![0]!.beaver.z + 1, 6);
    expect(mid.mallows[0]!.x).toBeCloseTo(from.mallows[0]!.x + 1, 6);
    expect(mid.boats![0]!.z).toBeCloseTo(from.boats![0]!.z + 1, 6);
    // 3.0 to -3.0 is a short turn through pi, not a long one back through 0.
    expect(Math.abs(Math.cos(mid.beaver.heading) + 1)).toBeLessThan(0.01);
    expect(blendDream(from, to, 1)).toBe(to);
    expect(blendDream(null, to, 0.5)).toBe(to);
    expect(blendDream({ ...from, land: { ...from.land } }, to, 0.5)).toBe(to);
  });
});

describe('the dream message', () => {
  it('is clamped to the unit circle and keeps only what a dream understands', () => {
    const m = readToHost(JSON.stringify({ t: 'dream', input: { move: { x: 9, z: 0 }, hop: true, slap: 'yes', play: false, pick: 'seek' } }));
    expect(m).toEqual({ t: 'dream', input: { move: { x: 1, z: 0 }, hop: true, slap: false, play: false, pick: 'seek' } });
    expect(readToHost(JSON.stringify({ t: 'dream' }))).toEqual({ t: 'dream', input: { move: { x: 0, z: 0 }, hop: false, slap: false, play: false } });
  });
});

describe('what a friend sees', () => {
  it('carries the looks over the wire and swaps the viewer in as the beaver', () => {
    const s = joinDream({ ...newDream(7), look: { hat: 2, scarf: 3 } }, 'g1', { hat: 4, scarf: 5 });
    const wire = JSON.parse(JSON.stringify(wireOf(s, 'host', 'candy')));
    const seen = viewFrom(dreamOf(wire), 'g1', 'host');
    expect(seen.beaver).toEqual(s.friends![0]!.beaver);
    expect(seen.look).toEqual({ hat: 4, scarf: 5 });
    expect(seen.friends).toEqual([{ id: 'host', beaver: s.beaver, look: { hat: 2, scarf: 3 } }]);
    expect(seen.game).toEqual({ kind: 'none' });
    expect(viewFrom(s, 'host', 'host')).toBe(s);
    expect(viewFrom(s, 'nobody', 'host')).toBe(s);
  });

  it('keeps presses until sent and the newest stick', () => {
    const a = mergeInput(null, { ...still, hop: true, move: { x: 1, z: 0 } });
    const b = mergeInput(a, { ...still, slap: true, move: { x: 0, z: 1 }, pick: 'hide' });
    expect(b).toEqual({ move: { x: 0, z: 1 }, hop: true, slap: true, play: false, pick: 'hide' });
  });
});
