import { describe, expect, it } from 'vitest';
import { SCALE, PLAIN_COLOUR, createComposer, createFrameWatch, stepHz } from './music';

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
    const valley = createComposer(2).notes(120).filter((n) => n.voice === 'pluck' || n.voice === 'flute').length;
    const d = createComposer(2);
    d.setMood('dream');
    const dream = d.notes(120).filter((n) => n.voice === 'bell').length;
    expect(valley).toBeGreaterThan(5);
    expect(valley).toBeLessThan(25);
    expect(dream).toBeGreaterThan(valley * 4);
  });

  it('gives the valley both a harp and a flute', () => {
    const voices = new Set(createComposer(5).notes(600).map((n) => n.voice));
    expect(voices.has('pluck')).toBe(true);
    expect(voices.has('flute')).toBe(true);
  });

  it('holds a chord of three pad notes in the valley', () => {
    expect(createComposer(1).notes(10).filter((n) => n.voice === 'pad')).toHaveLength(3);
  });

  it('keeps single notes in a comfortable range', () => {
    for (const n of createComposer(9).notes(600)) if (n.voice === 'pluck' || n.voice === 'flute') expect(n.hz).toBeLessThan(110 * 2 ** (13 / 5));
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

describe('the colour of the valley music', () => {
  const single = (n: { voice: string }): boolean => n.voice === 'pluck' || n.voice === 'flute';
  const count = (c: Parameters<ReturnType<typeof createComposer>['setColour']>[0]): number => {
    const k = createComposer(3);
    k.setColour(c);
    return k.notes(1200).filter(single).length;
  };

  it('is the plain music with no colour set', () => {
    const a = createComposer(4);
    const b = createComposer(4);
    b.setColour(PLAIN_COLOUR);
    expect(b.notes(300)).toEqual(a.notes(300));
  });

  it('plays fewer notes in winter and at night than in summer by day', () => {
    const summer = count({ season: 'summer', night: false });
    expect(count({ season: 'winter', night: false })).toBeLessThan(summer);
    expect(count({ season: 'summer', night: true })).toBeLessThan(summer);
  });

  it('plays lower and softer at night, and keeps to the scale', () => {
    const day = createComposer(6);
    const night = createComposer(6);
    night.setColour({ season: 'winter', night: true });
    const high = (notes: { hz: number; voice: string }[]): number => Math.max(...notes.filter(single).map((n) => n.hz));
    expect(high(night.notes(1200))).toBeLessThan(high(day.notes(1200)));
    for (const n of night.notes(2400)) expect(inScale(n.hz, 110)).toBe(true);
  });

  it('leaves the dream alone', () => {
    const a = createComposer(8);
    const b = createComposer(8);
    for (const c of [a, b]) c.setMood('dream');
    b.setColour({ season: 'winter', night: true });
    expect(b.notes(100)).toEqual(a.notes(100));
  });
});
