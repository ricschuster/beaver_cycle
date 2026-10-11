import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWebAudio } from './webAudio';

// A fake AudioContext that behaves like the browser where it matters: a buffer source throws when stop comes before start.
type Source = { started: boolean; stopped: boolean; order: string[]; loop: boolean };
let sources: Source[];
let ctxState: string;
let oscillators: number[];

const param = (): Record<string, unknown> => ({ value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });

function node(): Record<string, unknown> {
  const n: Record<string, unknown> = {
    gain: param(),
    stop() {},
    frequency: param(),
    detune: param(),
    Q: param(),
    playbackRate: { value: 1 },
    start() {},
    connect: (to: unknown) => to,
  };
  return n;
}

class FakeContext {
  sampleRate = 44100;
  currentTime = 1;
  destination = {};
  get state(): string {
    return ctxState;
  }
  resume = (): Promise<void> => Promise.resolve();
  suspend = (): Promise<void> => Promise.resolve();
  createGain = node;
  createOscillator = (): Record<string, unknown> => {
    const n = node();
    n.start = () => oscillators.push(1);
    return n;
  };
  createBiquadFilter = node;
  createConvolver = node;
  createBuffer(_c: number, n: number) {
    return { length: n, getChannelData: () => new Float32Array(n), copyToChannel() {} };
  }
  createBufferSource() {
    const s: Source = { started: false, stopped: false, order: [], loop: false };
    sources.push(s);
    const n = node();
    Object.defineProperty(n, 'loop', { get: () => s.loop, set: (v: boolean) => (s.loop = v) });
    n.start = () => {
      s.started = true;
      s.order.push('start');
    };
    n.stop = () => {
      if (!s.started) throw new Error('cannot call stop without calling start first');
      s.stopped = true;
      s.order.push('stop');
    };
    return n;
  }
  decodeAudioData = (): Promise<unknown> => Promise.resolve({ duration: 1 });
}

/** A web audio out with the fake context, unlocked. `manifest` is served as manifest.json; any other file is a stub. */
async function make(manifest: unknown) {
  vi.stubGlobal('window', { AudioContext: FakeContext });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: string) =>
      u.endsWith('manifest.json') && manifest !== null
        ? { ok: true, json: async () => manifest }
        : { ok: manifest !== null, arrayBuffer: async () => new ArrayBuffer(8) },
    ),
  );
  const out = createWebAudio();
  out.unlock();
  out.setBuses(1, 1);
  // Let the manifest and the effect files load.
  await new Promise((r) => setTimeout(r, 20));
  return out;
}

beforeEach(() => {
  sources = [];
  oscillators = [];
  ctxState = 'running';
});
afterEach(() => vi.unstubAllGlobals());

describe('createWebAudio play', () => {
  it('plays a recorded babble: start comes before stop and nothing throws', async () => {
    const out = await make({ effects: { babble: ['babble1.ogg'] } });
    const before = sources.length;
    expect(() => out.play('babble', 0.5, { pitch: 200, seconds: 1.5, seed: 1 })).not.toThrow();
    const s = sources[before]!;
    expect(s.order).toEqual(['start', 'stop']);
    expect(s.loop).toBe(true);
  });

  it('plays a plain recorded effect with a start and no stop', async () => {
    const out = await make({ effects: { chop: ['chop1.ogg'] } });
    const before = sources.length;
    expect(() => out.play('chop', 0.5)).not.toThrow();
    expect(sources[before]!.order).toEqual(['start']);
  });

  it('falls back to the synth when there is no manifest, plain and as a voice', async () => {
    const out = await make(null);
    const before = sources.length;
    expect(() => out.play('chop', 0.5)).not.toThrow();
    expect(() => out.play('babble', 0.5, { pitch: 400, seconds: 1, seed: 2 })).not.toThrow();
    expect(sources.slice(before).map((s) => s.order)).toEqual([['start'], ['start']]);
  });

  it('says nothing while the context is not running', async () => {
    const out = await make({ effects: { chop: ['chop1.ogg'] } });
    ctxState = 'suspended';
    const before = sources.length;
    out.play('chop', 0.5);
    expect(sources.length).toBe(before);
  });
});

describe('createWebAudio music', () => {
  it('plays nothing until a mood is set, then a pad chord, and nothing again when set to off', async () => {
    const out = await make(null);
    const quiet = oscillators.length;
    await new Promise((r) => setTimeout(r, 600));
    expect(oscillators.length).toBe(quiet);
    out.setMood('valley');
    await new Promise((r) => setTimeout(r, 600));
    expect(oscillators.length).toBeGreaterThan(quiet);
    out.setMood('off');
    const after = oscillators.length;
    await new Promise((r) => setTimeout(r, 600));
    expect(oscillators.length).toBe(after);
  });
});
