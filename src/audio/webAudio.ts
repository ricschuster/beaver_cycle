// Sound in the browser through the Web Audio API (docs/design/32_sound.md). One AudioContext for the whole game. The browser
// blocks it until the first touch or key, so it is made on `unlock`, called from such an event. Sounds are recordings from
// public/audio/ (samples.ts); an effect or layer the manifest does not list is made in code (synth.ts, effectsSynth.ts).

import { SYNTH_RATE, birdsLoop, cricketsLoop, owlLoop } from './synth';
import { effectSamples } from './effectsSynth';
import type { Effect } from './effects';
import { parseManifest, pickVariant, variation, type Manifest } from './samples';
import type { Layer, SoundOut } from './soundOut';

/** The pitch (Hz) at which a recorded babble plays unchanged: a mama's. */
const BABBLE_REF_HZ = 320;

type Ctx = AudioContext;

/** Brown-ish noise, 4 s, which joins without a click because it is made to end where it began. */
function noiseBuffer(ctx: Ctx): AudioBuffer {
  const seconds = 4;
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04;
    d[i] = last * 3.5;
  }
  // Fade the last 0.2 s into the first sample, so the loop has no step.
  const fade = Math.floor(ctx.sampleRate * 0.2);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    d[n - fade + i] = d[n - fade + i]! * (1 - t) + d[i]! * t;
  }
  return buf;
}

/** A looped buffer from samples. */
function loopSource(ctx: Ctx, samples: Float32Array<ArrayBuffer>): AudioBufferSourceNode {
  const buf = ctx.createBuffer(1, samples.length, SYNTH_RATE);
  buf.copyToChannel(samples, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

export function createWebAudio(): SoundOut {
  const Ctor: typeof AudioContext | undefined =
    typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  let ctx: Ctx | null = null;
  let effects: GainNode | null = null;
  let music: GainNode | null = null;
  const layers = new Map<Layer, GainNode>();
  // Code made effects are made the first time they are needed, and kept.
  const buffers = new Map<Effect, AudioBuffer>();
  // Recordings: the manifest (null until read, or if there is none), the decoded files, and the file played last per effect.
  let manifest: Manifest | null = null;
  let manifestDone = false;
  const decoded = new Map<string, AudioBuffer>();
  const last = new Map<Effect, string>();
  // What was asked before the context existed.
  let wantEffects = 0;
  let wantMusic = 0;
  const wantLayers = new Map<Layer, number>();
  let suspended = false;

  const url = (file: string): string => `${import.meta.env.BASE_URL}audio/${file}`;
  const load = async (c: Ctx, file: string): Promise<AudioBuffer | null> => {
    const have = decoded.get(file);
    if (have) return have;
    try {
      const r = await fetch(url(file));
      if (!r.ok) return null;
      const buf = await c.decodeAudioData(await r.arrayBuffer());
      decoded.set(file, buf);
      return buf;
    } catch {
      return null;
    }
  };

  /** A layer made in code: noise through filters for water and wind, a looped sample for the rest. */
  const synthLayer = (c: Ctx, layer: Layer, into: GainNode, noise: AudioBuffer): void => {
    if (layer === 'water') {
      // Noise through a low-pass that opens a little and moves, so it rushes and does not hiss.
      const src = c.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      const wobble = c.createOscillator();
      wobble.frequency.value = 0.3;
      const depth = c.createGain();
      depth.gain.value = 250;
      wobble.connect(depth).connect(lp.frequency);
      src.connect(lp).connect(into);
      src.start();
      wobble.start();
    } else if (layer === 'wind') {
      // The same noise, duller, with a slow gust.
      const gust = c.createGain();
      gust.gain.value = 0.6;
      const gustLfo = c.createOscillator();
      gustLfo.frequency.value = 0.08;
      const gustDepth = c.createGain();
      gustDepth.gain.value = 0.4;
      gustLfo.connect(gustDepth).connect(gust.gain);
      const src = c.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 450;
      src.connect(lp).connect(gust).connect(into);
      src.start();
      gustLfo.start();
    } else {
      const loop = loopSource(c, layer === 'birds' ? birdsLoop() : layer === 'crickets' ? cricketsLoop() : owlLoop());
      loop.connect(into);
      loop.start();
    }
  };

  /** Start every layer: a recording from the manifest (one picked for this session), or the one made in code. */
  const startLayers = async (c: Ctx): Promise<void> => {
    const noise = noiseBuffer(c);
    for (const [layer, node] of layers) {
      const files = manifest?.layers[layer];
      const buf = files ? await load(c, pickVariant(files, Math.random())) : null;
      if (buf) {
        const src = c.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(node);
        src.start();
      } else synthLayer(c, layer, node, noise);
    }
  };

  /** Read the manifest, start the layers, then decode the effect files in the background, six at a time. */
  const start = async (c: Ctx): Promise<void> => {
    try {
      const r = await fetch(url('manifest.json'));
      if (r.ok) manifest = parseManifest(await r.json());
    } catch {
      manifest = null;
    }
    manifestDone = true;
    await startLayers(c);
    const files = Object.values(manifest?.effects ?? {}).flat();
    for (let i = 0; i < files.length; i += 6) await Promise.all(files.slice(i, i + 6).map((f) => load(c, f)));
  };

  const build = (c: Ctx): void => {
    const master = c.createGain();
    master.connect(c.destination);
    effects = c.createGain();
    effects.connect(master);
    music = c.createGain();
    music.connect(master);
    for (const layer of ['water', 'wind', 'birds', 'crickets', 'owl'] as const) {
      const gain = c.createGain();
      gain.gain.value = 0;
      gain.connect(effects);
      layers.set(layer, gain);
    }
    void start(c);
  };

  const apply = (): void => {
    if (!ctx || !effects || !music) return;
    const t = ctx.currentTime;
    // A short ramp, so a changed volume does not click.
    effects.gain.setTargetAtTime(wantEffects, t, 0.05);
    music.gain.setTargetAtTime(wantMusic, t, 0.05);
    for (const [layer, node] of layers) node.gain.setTargetAtTime(wantLayers.get(layer) ?? 0, t, 0.3);
    if (suspended && ctx.state === 'running') void ctx.suspend();
    else if (!suspended && ctx.state === 'suspended') void ctx.resume();
  };

  /** A recording of the effect to play now, or null: none listed (use the synth) or none ready yet (say nothing). */
  const recording = (effect: Effect): AudioBuffer | null | undefined => {
    if (!manifestDone) return null;
    const files = manifest?.effects[effect];
    if (!files) return undefined;
    const ready = files.filter((f) => decoded.has(f));
    if (ready.length === 0) return null;
    const file = pickVariant(ready, Math.random(), last.get(effect));
    last.set(effect, file);
    return decoded.get(file)!;
  };

  return {
    setBuses(e, m) {
      wantEffects = e;
      wantMusic = m;
      apply();
    },
    setLayer(layer, gain) {
      wantLayers.set(layer, gain);
      apply();
    },
    play(effect, gain, voice) {
      if (!ctx || !effects || suspended || ctx.state !== 'running') return;
      const rec = recording(effect);
      if (rec === null) return;
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      let stopAt: number | null = null; // a stop is set after the start: before it the browser throws
      if (rec) {
        const v = variation(Math.random(), Math.random());
        src.buffer = rec;
        // A talking sound follows the speaker: a higher or lower pitch (halfway to the speaker's, so a papa is not a slow growl) and the
        // length of the line, the clip looped when it is shorter and faded out at the end.
        const pitch = voice ? Math.sqrt(voice.pitch / BABBLE_REF_HZ) : 1;
        src.playbackRate.value = v.rate * pitch;
        g.gain.value = gain * v.gain;
        if (voice) {
          src.loop = true;
          const t = ctx.currentTime;
          g.gain.setValueAtTime(gain * v.gain, t + Math.max(0, voice.seconds - 0.1));
          g.gain.linearRampToValueAtTime(0, t + voice.seconds);
          stopAt = t + voice.seconds;
        }
      } else {
        let buf = voice ? undefined : buffers.get(effect);
        if (!buf) {
          const samples = effectSamples(effect, SYNTH_RATE, voice);
          buf = ctx.createBuffer(1, samples.length, SYNTH_RATE);
          buf.copyToChannel(samples, 0);
          if (!voice) buffers.set(effect, buf);
        }
        src.buffer = buf;
        g.gain.value = gain;
      }
      src.connect(g).connect(effects);
      src.start();
      if (stopAt !== null) src.stop(stopAt);
    },
    setSuspended(s) {
      suspended = s;
      apply();
    },
    unlock() {
      if (!Ctor) return;
      try {
        if (!ctx) {
          ctx = new Ctor();
          build(ctx);
        }
        // Resume inside the touch, which is what the browser wants.
        if (!suspended && ctx.state === 'suspended') void ctx.resume();
        apply();
      } catch {
        // No sound on this device: the game goes on in silence.
        ctx = null;
      }
    },
    running: () => ctx !== null && ctx.state === 'running',
  };
}
