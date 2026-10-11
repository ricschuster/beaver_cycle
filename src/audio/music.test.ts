import { describe, expect, it } from 'vitest';
import { SCALE, createComposer, createFrameWatch, stepHz } from './music';

const inScale = (hz: number, key: number): boolean => {
  const semis = (12 * Math.log2(hz / key)) % 12;
  const s = (semis + 12) % 12;
  return SCALE.some((d) => Math.abs(d - s) < 0.01 || Math.abs(d - s + 12) < 0.01);
};

describe('stepHz', () => {
  it('counts up the pentatonic and doubles at the octave', () => {
    expect(stepHz(110, 0)).toBeCloseTo(110);
    expect(stepHz(110, 5)).toBeCloseTo(220);
    expect(stepHz(110, 2)).toBeCloseTo(110 * 2 ** (4 / 12));
    expect(stepHz(110, -1)).toBeCloseTo(55 * 2 ** (9 / 12));
  });
});

describe('composer', () => {
  it('makes the same music for the same seed', () => {
    expect(createComposer(3).notes(120)).toEqual(createComposer(3).notes(120));
    expect(createComposer(3).notes(120)).not.toEqual(createComposer(4).notes(120));
  });

  it('gives each note once, in order of time, and only notes in the scale', () => {
    const c = createComposer(1);
    const a = c.notes(60);
    const b = c.notes(120);
    expect(a.length).toBeGreaterThan(3);
    for (const n of a) expect(n.time).toBeLessThan(60);
    for (const n of b) expect(n.time).toBeGreaterThanOrEqual(60 - 1);
    const all = [...a, ...b];
    for (let i = 1; i < a.length; i++) expect(a[i]!.time).toBeGreaterThanOrEqual(a[i - 1]!.time);
    for (const n of all) expect(inScale(n.hz, 110)).toBe(true);
  });

  it('is sparse in the valley and busy in the dream', () => {
    const valley = createComposer(2).notes(120).filter((n) => n.voice === 'pluck').length;
    const d = createComposer(2);
    d.setMood('dream');
    const dream = d.notes(120).filter((n) => n.voice === 'bell').length;
    expect(valley).toBeGreaterThan(5);
    expect(valley).toBeLessThan(25);
    expect(dream).toBeGreaterThan(valley * 4);
  });

  it('holds a chord of three pad notes in the valley', () => {
    expect(createComposer(1).notes(10).filter((n) => n.voice === 'pad')).toHaveLength(3);
  });

  it('keeps single notes in a comfortable range', () => {
    for (const n of createComposer(9).notes(600)) if (n.voice === 'pluck') expect(n.hz).toBeLessThan(110 * 2 ** (13 / 5));
  });
});

describe('frame watch', () => {
  it('gives way after slow frames and comes back after a longer stretch of good ones', () => {
    const w = createFrameWatch();
    expect(w.update(30, 0)).toBe(true);
    expect(w.update(15, 1)).toBe(true);
    expect(w.update(15, 4)).toBe(true);
    expect(w.update(15, 5)).toBe(false);
    expect(w.update(40, 7)).toBe(false);
    expect(w.update(40, 18)).toBe(false);
    expect(w.update(40, 19)).toBe(true);
  });

  it('does not give way for one slow moment', () => {
    const w = createFrameWatch();
    w.update(15, 0);
    w.update(60, 1);
    expect(w.update(15, 5)).toBe(true);
  });
});
