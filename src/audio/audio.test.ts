import { describe, expect, it, vi } from 'vitest';
import { birdsGain, cricketsGain, effectsGain, musicGain, owlGain, waterGain, windGain, STREAM_HEARD, type Hearing } from './mix';
import { DEFAULT_SOUND, SOUND_KEY, loadSound, parseSound, saveSound } from './settings';
import { createSound, wireBrowser, MAX_ONE_SHOTS } from './sound';
import { DURATION, createVoices, watchBeaver, watchWorld, type Cue, type Effect } from './effects';
import { effectSamples } from './effectsSynth';
import { babbleCue, dreamCues } from './talkDream';
import { createWorld } from '../sim/state';
import { fakeSoundOut } from './soundOut';
import { SYNTH_RATE, birdsLoop, cricketsLoop, owlLoop } from './synth';

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

describe('cue', () => {
  it('does not throw into the caller when a play throws, and plays the later cues', () => {
    const out = fakeSoundOut();
    const real = out.play.bind(out);
    out.play = (effect, gain, voice) => {
      if (effect === 'chop') throw new Error('boom');
      real(effect, gain, voice);
    };
    const sound = createSound(out, null);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => sound.cue([{ effect: 'chop', gain: 1 }, { effect: 'splash', gain: 1 }], 0)).not.toThrow();
    expect(out.played.map((p) => p.effect)).toEqual(['splash']);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
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

describe('the beaver cues', () => {
  const dry = createWorld({ heightAt: () => 0, waterDepth: () => 0, isWater: () => false } as never, 0, 0);
  const effects = (cues: Cue[]): string[] => cues.map((c) => c.effect);
  it('gives nothing on the first frame, and nothing while the world stands still', () => {
    const watch = watchBeaver();
    expect(watch(dry, 0)).toEqual([]);
    expect(watch(dry, 0.1)).toEqual([]);
  });
  it('gnaws once every half second of chopping, and a tree falls with its own sound', () => {
    const watch = watchBeaver();
    watch(dry, 0);
    const chop = (progress: number) => ({ ...dry, chop: { id: 't', x: 1, z: 1, wood: 1, progress } });
    expect(effects(watch(chop(0), 0.1))).toEqual(['chop']);
    expect(watch(chop(0.2), 0.2)).toEqual([]);
    expect(effects(watch(chop(0.55), 0.3))).toEqual(['chop']);
    expect(effects(watch({ ...dry, felled: ['t'] }, 0.4))).toEqual(['fall']);
  });
  it('slaps once per slap, splashes going into the water and softer coming out, and strokes while it swims', () => {
    const watch = watchBeaver();
    watch(dry, 0);
    expect(effects(watch({ ...dry, lastSlap: { time: 5, x: 0, z: 0 } }, 0.1))).toEqual(['slap']);
    expect(watch({ ...dry, lastSlap: { time: 5, x: 0, z: 0 } }, 0.2)).toEqual([]);
    const swim = (x: number) => ({ ...dry, beaver: { ...dry.beaver, mode: 'swim' as const, x } });
    expect(effects(watch({ ...swim(0), lastSlap: { time: 6, x: 0, z: 0 } }, 0.5)).filter((e) => e !== 'splash')).toEqual(['slapwater']);
    watch(dry, 0.6);
    const splash = watch(swim(0), 1);
    expect(splash.map((c) => c.effect)).toEqual(['splash']);
    expect(effects(watch(swim(0.5), 1.5))).toEqual([]);
    expect(effects(watch(swim(1), 2))).toEqual(['stroke']);
    expect(effects(watch(swim(1), 3))).toEqual([]);
    const out = watch(dry, 3.1);
    expect(out[0]!.effect).toBe('splash');
    expect(out[0]!.gain).toBeLessThan(splash[0]!.gain);
  });
  it('eats, picks up and sets down', () => {
    const watch = watchBeaver();
    watch(dry, 0);
    const lily = { kind: 'lily' } as never;
    expect(effects(watch({ ...dry, carry: lily }, 0.1))).toEqual(['pickup']);
    expect(effects(watch(dry, 0.2))).toEqual(['setdown']);
    watch({ ...dry, carry: lily }, 0.3);
    expect(effects(watch({ ...dry, carry: null, eaten: 1 }, 0.4))).toEqual(['eat']);
    expect(effects(watch({ ...dry, drag: 'log' }, 0.5))).toEqual(['pickup']);
    expect(effects(watch(dry, 0.6))).toEqual(['setdown']);
  });
});

describe('the voice limit', () => {
  it('drops a quieter sound when full, takes the place of a quieter playing one, and frees a voice when it ends', () => {
    const v = createVoices(2);
    expect(v.admit({ effect: 'fall', gain: 0.5 }, 0)).toBe(true);
    expect(v.admit({ effect: 'splash', gain: 0.8 }, 0)).toBe(true);
    expect(v.admit({ effect: 'stroke', gain: 0.4 }, 0.1)).toBe(false);
    expect(v.admit({ effect: 'slap', gain: 0.9 }, 0.1)).toBe(true);
    expect(v.admit({ effect: 'eat', gain: 0.1 }, 0.2)).toBe(false);
    expect(v.admit({ effect: 'eat', gain: 0.1 }, 5)).toBe(true);
  });
});

describe('the one-shots through Sound', () => {
  it('plays the cues within MAX_ONE_SHOTS and none when the switch is off', () => {
    const out = fakeSoundOut();
    const sound = createSound(out, null);
    sound.cue(Array.from({ length: 6 }, () => ({ effect: 'fall' as const, gain: 0.5 })), 0);
    expect(out.played).toHaveLength(MAX_ONE_SHOTS);
    sound.setOneShotsOn(false);
    sound.cue([{ effect: 'slap', gain: 1 }], 10);
    expect(out.played).toHaveLength(MAX_ONE_SHOTS);
  });
});

describe('the building and animal cues', () => {
  const dry = createWorld({ heightAt: () => 0, waterDepth: () => 0, isWater: () => false } as never, 0, 0);
  const effects = (cues: Cue[]): string[] => cues.map((c) => c.effect);
  const dam = (wood: number, mud: number, rock: number, level: 1 | 2 | 3 = 1) => ({ ...dry, dams: [{ spot: 'a', wood, mud, rock, level }] });
  it('is silent on the first frame and while nothing changes', () => {
    const watch = watchWorld();
    expect(watch(dam(3, 1, 0), [], 0)).toEqual([]);
    expect(watch(dam(3, 1, 0), [], 0.1)).toEqual([]);
  });
  it('gives a sound for each material placed on a dam, and a flourish when the level rises', () => {
    const watch = watchWorld();
    watch(dam(3, 1, 0), [], 0);
    expect(effects(watch(dam(5, 1, 0), [], 1))).toEqual(['wood']);
    expect(effects(watch(dam(5, 2, 1), [], 2))).toEqual(['mud', 'rock']);
    expect(effects(watch(dam(5, 2, 1, 2), [], 3))).toEqual(['done']);
  });
  it('sounds a lodge log and the finished lodge, and a mended piece', () => {
    const watch = watchWorld();
    const lodge = (wood: number) => ({ ...dry, lodge: { x: 0, z: 0, base: 0, door: 0, wood } });
    watch(lodge(8), [], 0);
    expect(effects(watch(lodge(10), [], 1))).toEqual(['wood', 'done']);
    expect(effects(watch({ ...lodge(10), mended: 1 }, [], 2))).toEqual(['done']);
  });
  it('warns once for each predator by its own call, louder when near, and hears the beaver hurt', () => {
    const watch = watchWorld();
    watch(dry, [], 0);
    const owl = { id: 'o', kind: 'owl' as const, x: 10, z: 0, lift: 0, heading: 0, phase: 'warn' as const, since: 0 };
    const cues = watch({ ...dry, predators: [owl] }, [], 1);
    expect(effects(cues)).toEqual(['hoot']);
    expect(watch({ ...dry, predators: [{ ...owl, phase: 'chase' as const }] }, [], 2)).toEqual([]);
    expect(effects(watch({ ...dry, predators: [{ ...owl, phase: 'chase' as const }], hurtAt: 5 }, [], 3))).toEqual(['hurt']);
    const far = watch({ ...dry, predators: [{ ...owl, id: 'f', kind: 'fox' as const, x: 100 }] }, [], 4);
    expect(far).toEqual([]);
  });
  it('quacks now and then for a duck near by, not for a far one', () => {
    const watch = watchWorld();
    const duck = (x: number) => [{ id: 'd', kind: 'duck' as const, x, y: 0, z: 0, heading: 0, moving: true }];
    watch(dry, duck(5), 0);
    expect(watch(dry, duck(5), 3)).toEqual([]);
    expect(effects(watch(dry, duck(5), 10))).toEqual(['quack']);
    expect(watch(dry, duck(5), 12)).toEqual([]);
    expect(watch(dry, duck(80), 30)).toEqual([]);
  });
});

describe('talk and dream cues', () => {
  it('babbles higher for a kit than a papa, longer for a longer line, and the same each time', () => {
    const kit = babbleCue('kit', 'k1', 'Hello there!').voice!;
    const papa = babbleCue('papa', 'p1', 'Hello there!').voice!;
    expect(kit.pitch).toBeGreaterThan(papa.pitch);
    expect(babbleCue('papa', 'p1', 'A much longer line about the dam and the weather today.').voice!.seconds).toBeGreaterThan(papa.seconds);
    expect(babbleCue('papa', 'p1', 'Hello there!')).toEqual(babbleCue('papa', 'p1', 'Hello there!'));
    expect(babbleCue('papa', 'p2', 'Hello there!').voice!.pitch).not.toBe(papa.pitch);
  });
  it('makes a babble as long as the line says, and different for different seeds', () => {
    const cue = babbleCue('mama', 'm', 'Come and see the pond');
    const s = effectSamples('babble', SYNTH_RATE, cue.voice);
    expect(s.length).toBe(Math.floor(SYNTH_RATE * cue.voice!.seconds));
    expect(Math.max(...s.map(Math.abs))).toBeGreaterThan(0.1);
    expect(s).not.toEqual(effectSamples('babble', SYNTH_RATE, { ...cue.voice!, seed: 5 }));
  });
  it('gives the dream a chime for each sweet, a giggle for play and a cheer at the end', () => {
    const e = (what: string, more: object = {}) => ({ what, ...more }) as never;
    expect(dreamCues([e('sweet', { kind: 'drop' }), e('sweet', { kind: 'swirl' }), e('sweet', { kind: 'star' })]).map((c) => c.effect)).toEqual(['chime', 'chimeHigh', 'chimeStar']);
    expect(dreamCues([e('giggle'), e('tagEnd'), e('rush')]).map((c) => c.effect)).toEqual(['giggle', 'cheer']);
  });
  it('calls when a partner starts to follow', () => {
    const dry = createWorld({ heightAt: () => 0, waterDepth: () => 0, isWater: () => false } as never, 0, 0);
    const watch = watchWorld();
    watch(dry, [], 0);
    const partner = { id: 'p', state: 'following' } as never;
    expect(watch({ ...dry, partners: [partner] }, [], 1).map((c) => c.effect)).toEqual(['chirp']);
    expect(watch({ ...dry, partners: [partner] }, [], 2)).toEqual([]);
  });
});

describe('effectSamples', () => {
  const all: Effect[] = ['chop', 'fall', 'splash', 'slap', 'slapwater', 'stroke', 'eat', 'pickup', 'setdown', 'wood', 'mud', 'rock', 'done', 'quack', 'hoot', 'yap', 'growl', 'rumble', 'hurt', 'babble', 'chirp', 'chime', 'chimeHigh', 'chimeStar', 'giggle', 'cheer'];
  it('makes every effect as long as its duration, audible, in range, and silent at the end', () => {
    for (const e of all.filter((x) => x !== 'babble')) {
      const s = effectSamples(e);
      expect(s.length, e).toBe(Math.floor(SYNTH_RATE * DURATION[e]));
      expect(Math.max(...s.map(Math.abs)), e).toBeGreaterThan(0.1);
      expect(Math.max(...s.map(Math.abs)), e).toBeLessThanOrEqual(0.9001);
      expect(Math.abs(s[s.length - 1]!), e).toBeLessThan(1e-3);
    }
  });
  it('is the same every time', () => {
    expect(effectSamples('splash')).toEqual(effectSamples('splash'));
  });
});
