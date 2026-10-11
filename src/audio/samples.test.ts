import { describe, expect, it } from 'vitest';
import { GAIN_JITTER, PITCH_JITTER, parseManifest, pickVariant, variation } from './samples';

describe('the sample manifest', () => {
  it('keeps lists of safe file names and drops the rest', () => {
    const m = parseManifest({ effects: { chop: ['chop-1-a.ogg', 'chop-2-b.ogg'], wood: [], mud: ['../x.ogg'], eat: 'no' }, layers: { water: ['water-1-a.ogg'], wind: [3] } });
    expect(m.effects).toEqual({ chop: ['chop-1-a.ogg', 'chop-2-b.ogg'] });
    expect(m.layers).toEqual({ water: ['water-1-a.ogg'] });
  });
  it('is empty for anything that is not an object', () => {
    expect(parseManifest(null)).toEqual({ effects: {}, layers: {} });
    expect(parseManifest('x')).toEqual({ effects: {}, layers: {} });
  });
});

describe('picking a variant', () => {
  it('maps 0 up to 1 over the list', () => {
    expect(pickVariant(['a', 'b', 'c'], 0)).toBe('a');
    expect(pickVariant(['a', 'b', 'c'], 0.5)).toBe('b');
    expect(pickVariant(['a', 'b', 'c'], 0.999)).toBe('c');
  });
  it('does not repeat the clip played last when there is a choice', () => {
    for (const r of [0, 0.3, 0.6, 0.99]) expect(pickVariant(['a', 'b', 'c'], r, 'b')).not.toBe('b');
    expect(pickVariant(['a'], 0.5, 'a')).toBe('a');
  });
});

describe('variation', () => {
  it('stays within the pitch and gain limits', () => {
    expect(variation(0, 0)).toEqual({ rate: 1 - PITCH_JITTER, gain: 1 });
    expect(variation(1, 1).rate).toBeCloseTo(1 + PITCH_JITTER);
    expect(variation(0.5, 1).gain).toBeCloseTo(1 - GAIN_JITTER);
    expect(variation(0.5, 0.5).rate).toBe(1);
  });
});
