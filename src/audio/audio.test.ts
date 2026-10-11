import { describe, expect, it } from 'vitest';
import { birdsGain, cricketsGain, effectsGain, musicGain, owlGain, waterGain, windGain, STREAM_HEARD, type Hearing } from './mix';
import { DEFAULT_SOUND, SOUND_KEY, loadSound, parseSound, saveSound } from './settings';
import { createSound, wireBrowser } from './sound';
import { fakeSoundOut } from './soundOut';
import { birdsLoop, cricketsLoop, owlLoop } from './synth';

const far: Hearing = { streamDistance: Infinity, onWater: false, inLodge: false, underwater: false, daylight: 1, season: 'spring' };

function memory(): Pick<Storage, 'getItem' | 'setItem'> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('waterGain', () => {
  it('is full at a stream, falls to nothing at the hearing range, and is silent with no stream', () => {
    expect(waterGain({ ...far, streamDistance: 0 })).toBe(1);
    expect(waterGain({ ...far, streamDistance: STREAM_HEARD / 2 })).toBeCloseTo(0.25);
    expect(waterGain({ ...far, streamDistance: STREAM_HEARD })).toBe(0);
    expect(waterGain(far)).toBe(0);
  });
  it('laps quietly on the lake with no stream near', () => {
    expect(waterGain({ ...far, onWater: true })).toBeCloseTo(0.25);
  });
  it('is softer in a lodge and under water', () => {
    const at = { ...far, streamDistance: 0 };
    expect(waterGain({ ...at, inLodge: true })).toBeCloseTo(0.3);
    expect(waterGain({ ...at, underwater: true })).toBeCloseTo(0.4);
  });
});

describe('the ambient layers', () => {
  const night = { ...far, daylight: 0 };
  it('has birds by day and not at night, and fewer under the snow', () => {
    expect(birdsGain(far)).toBeGreaterThan(0.5);
    expect(birdsGain(night)).toBe(0);
    expect(birdsGain({ ...far, season: 'winter' })).toBeLessThan(birdsGain({ ...far, season: 'summer' }) / 4);
  });
  it('has crickets and an owl at night, with no crickets in winter and none by day', () => {
    expect(cricketsGain({ ...night, season: 'summer' })).toBeGreaterThan(0.3);
    expect(cricketsGain(far)).toBe(0);
    expect(cricketsGain({ ...night, season: 'winter' })).toBe(0);
    expect(owlGain({ ...night, season: 'winter' })).toBeGreaterThan(0);
    expect(owlGain(far)).toBe(0);
  });
  it('is dull in a lodge and gone under water', () => {
    expect(windGain({ ...far, inLodge: true })).toBeCloseTo(windGain(far) * 0.2);
    expect(windGain({ ...far, underwater: true })).toBe(0);
    expect(birdsGain({ ...far, underwater: true })).toBe(0);
  });
});

describe('the synthesised loops', () => {
  for (const [name, make] of [['birds', birdsLoop], ['crickets', cricketsLoop], ['owl', owlLoop]] as const) {
    it(`${name} has sound, stays in range, and is silent at both ends so it joins`, () => {
      const d = make(8000);
      expect(d.length).toBeGreaterThan(8000 * 5);
      let peak = 0;
      for (const v of d) peak = Math.max(peak, Math.abs(v));
      expect(peak).toBeGreaterThan(0.05);
      expect(peak).toBeLessThanOrEqual(1);
      expect(Math.abs(d[0]!)).toBeLessThan(0.01);
      expect(Math.abs(d[d.length - 1]!)).toBeLessThan(0.01);
    });
  }
});

describe('the buses', () => {
  it('follow the volumes, and are silent when muted', () => {
    expect(effectsGain({ effects: 0.7, music: 0.2, muted: false })).toBe(0.7);
    expect(musicGain({ effects: 0.7, music: 0.2, muted: false })).toBe(0.2);
    expect(effectsGain({ effects: 0.7, music: 0.2, muted: true })).toBe(0);
    expect(musicGain({ effects: 0.7, music: 0.2, muted: true })).toBe(0);
  });
});

describe('the settings', () => {
  it('fall back to the defaults for missing or wrong text', () => {
    expect(parseSound(null)).toEqual(DEFAULT_SOUND);
    expect(parseSound('not json')).toEqual(DEFAULT_SOUND);
    expect(parseSound('{"effects":"loud","music":9,"muted":"yes"}')).toEqual({ effects: 0.5, music: 1, muted: false });
  });
  it('are kept and read back, and a blocked storage does no harm', () => {
    const m = memory();
    saveSound(m, { effects: 0.2, music: 0.9, muted: true });
    expect(m.data.has(SOUND_KEY)).toBe(true);
    expect(loadSound(m)).toEqual({ effects: 0.2, music: 0.9, muted: true });
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSound(blocked)).toEqual(DEFAULT_SOUND);
    expect(() => saveSound(blocked, DEFAULT_SOUND)).not.toThrow();
  });
});

describe('createSound', () => {
  it('sends the saved volumes to the out at the start and on each change', () => {
    const m = memory();
    saveSound(m, { effects: 0.3, music: 0.4, muted: false });
    const out = fakeSoundOut();
    const sound = createSound(out, m);
    expect([out.effects, out.music]).toEqual([0.3, 0.4]);
    sound.setMuted(true);
    expect([out.effects, out.music]).toEqual([0, 0]);
    sound.setMuted(false);
    sound.setEffects(2);
    expect(out.effects).toBe(1);
    expect(loadSound(m).effects).toBe(1);
  });
  it('plays the water layer from what is heard, and mutes it when its switch is off', () => {
    const out = fakeSoundOut();
    const sound = createSound(out, null);
    sound.update({ ...far, streamDistance: 0 });
    expect(out.layers.get('water')).toBe(1);
    sound.setLayerOn('water', false);
    sound.update({ ...far, streamDistance: 0 });
    expect(out.layers.get('water')).toBe(0);
  });
  it('sends every layer and lets a switch silence one', () => {
    const out = fakeSoundOut();
    const sound = createSound(out, null);
    sound.setLayerOn('birds', false);
    sound.update(far);
    expect(out.layers.get('birds')).toBe(0);
    expect(out.layers.get('wind')).toBeGreaterThan(0);
    expect([...out.layers.keys()].sort()).toEqual(['birds', 'crickets', 'owl', 'water', 'wind']);
  });
});

describe('wireBrowser', () => {
  it('unlocks on the first touch and follows the page being hidden', () => {
    const out = fakeSoundOut();
    const target = new EventTarget() as unknown as Window;
    const doc = new EventTarget() as unknown as Document & { visibilityState: string };
    doc.visibilityState = 'visible';
    wireBrowser(out, target, doc);
    expect(out.unlocked).toBe(false);
    target.dispatchEvent(new Event('pointerdown'));
    expect(out.unlocked).toBe(true);
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(out.suspended).toBe(true);
  });
});
