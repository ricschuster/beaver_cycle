// Sound in the browser through the Web Audio API (docs/design/32_sound.md). One AudioContext for the whole game. The browser
// blocks it until the first touch or key, so it is made on `unlock`, called from such an event. Sounds are recordings from
// public/audio/ (samples.ts); an effect or layer the manifest does not list is made in code (synth.ts, effectsSynth.ts).

import { SYNTH_RATE, birdsLoop, cricketsLoop, owlLoop } from './synth';
import { effectSamples } from './effectsSynth';
import type { Effect } from './effects';
import { parseManifest, pickVariant, variation, type Manifest } from './samples';
import { createComposer, type MusicMood, type Note } from './music';
import type { Layer, SoundOut } from './soundOut';

/** The pitch (Hz) at which a recorded babble plays unchanged: a mama's. */
const BABBLE_REF_HZ = 320;

type Ctx = AudioContext;

/** The music is scheduled this far ahead of the clock, in seconds, and looked at this often. */
const MUSIC_AHEAD = 2;
const MUSIC_EVERY_MS = 500;
/** How slowly a mood fades in and out, as a time constant in seconds. */
const MUSIC_FADE = 2.5;

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
  // The music (music.ts): each mood plays into its own gain, so one fades out as the other fades in.
  const moods = new Map<'valley' | 'dream', GainNode>();
  let wantMood: MusicMood = 'off';
  let appliedMood: MusicMood = 'off';
  let composer: ReturnType<typeof createComposer> | null = null;
  let composerStart = 0;
  let musicTimer: ReturnType<typeof setInterval> | null = null;

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

  /** A short wash of noise for the breath at the start of a flute note. */
  let breath: AudioBuffer | null = null;

  /** A hall: two channels of noise that fade over about three seconds and grow duller, for the convolver. */
  const hallResponse = (c: Ctx): AudioBuffer => {
    const seconds = 3;
    const n = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let low = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        // A one-pole low-pass whose cut-off falls with time: the highs die first, as in a real room.
        const k = 0.6 - 0.5 * t;
        low += k * ((Math.random() * 2 - 1) - low);
        d[i] = low * (1 - t) ** 3;
      }
    }
    return buf;
  };

  /** Shorthand: a gain node that swells to `peak` and falls away, and goes into `into`. */
  const envelope = (c: Ctx, into: AudioNode, when: number, peak: number, attack: number, end: number, plucked: boolean): GainNode => {
    const g = c.createGain();
    g.connect(into);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(peak, when + attack);
    if (plucked) g.gain.exponentialRampToValueAtTime(0.0001, end);
    else {
      g.gain.setValueAtTime(peak, Math.max(when + attack, end - Math.max(0.4, (end - when) * 0.4)));
      g.gain.linearRampToValueAtTime(0, end);
    }
    return g;
  };

  /** A tone: an oscillator of one wave through a gain, started and stopped with the note. A vibrato (cents, hertz, after a delay) can sway it. */
  const tone = (c: Ctx, type: OscillatorType, hz: number, level: number, into: AudioNode, when: number, end: number, cents = 0, vibrato?: { cents: number; rate: number; delay: number }): void => {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = hz;
    osc.detune.value = cents;
    const part = c.createGain();
    part.gain.value = level;
    osc.connect(part).connect(into);
    if (vibrato) {
      const lfo = c.createOscillator();
      lfo.frequency.value = vibrato.rate * (0.9 + 0.2 * Math.random());
      const depth = c.createGain();
      depth.gain.setValueAtTime(0, when);
      depth.gain.linearRampToValueAtTime(vibrato.cents, when + vibrato.delay + 0.6);
      lfo.connect(depth).connect(osc.detune);
      lfo.start(when);
      lfo.stop(end + 0.1);
    }
    osc.start(when);
    osc.stop(end + 0.1);
  };

  /** One note of the music, played as an instrument: strings (three detuned saws through a filter that opens as the bow sets in, with a vibrato), a harp (a plucked triangle with its overtones), a flute (a breathy sine with a slow vibrato), or a celesta-like bell. */
  const playNote = (c: Ctx, note: Note, into: AudioNode, when: number): void => {
    const end = when + note.seconds;
    if (note.voice === 'pad') {
      const g = envelope(c, into, when, note.gain, note.seconds * 0.35, end, false);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 0.4;
      lp.frequency.setValueAtTime(350, when);
      lp.frequency.linearRampToValueAtTime(Math.min(2400, note.hz * 7), when + note.seconds * 0.5);
      lp.connect(g);
      // Three players a few cents apart, not one oscillator, so the section has a chorus and a slow beat.
      for (const cents of [-9, 1, 8]) tone(c, 'sawtooth', note.hz, 0.3, lp, when, end, cents + (Math.random() - 0.5) * 4, { cents: 5, rate: 5, delay: 0.8 });
      return;
    }
    if (note.voice === 'pluck') {
      const g = envelope(c, into, when, note.gain, 0.006, end, true);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(Math.min(5000, note.hz * 9), when);
      lp.frequency.exponentialRampToValueAtTime(note.hz * 2, when + 1.2);
      lp.connect(g);
      tone(c, 'triangle', note.hz, 0.7, lp, when, end);
      tone(c, 'sine', note.hz * 2, 0.35, lp, when, end);
      tone(c, 'sine', note.hz * 3, 0.15, lp, when, end);
      return;
    }
    if (note.voice === 'flute') {
      const g = envelope(c, into, when, note.gain, 0.14, end, false);
      tone(c, 'sine', note.hz, 0.8, g, when, end, 0, { cents: 14, rate: 5.2, delay: 0.5 });
      tone(c, 'sine', note.hz * 2, 0.12, g, when, end);
      tone(c, 'sine', note.hz * 3, 0.04, g, when, end);
      // The breath: a puff of band-passed noise as the note starts.
      breath ??= noiseBuffer(c);
      const puff = c.createBufferSource();
      puff.buffer = breath;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = note.hz * 2;
      bp.Q.value = 1.2;
      const pg = c.createGain();
      pg.gain.setValueAtTime(0, when);
      pg.gain.linearRampToValueAtTime(0.05, when + 0.05);
      pg.gain.linearRampToValueAtTime(0.012, when + 0.4);
      pg.gain.linearRampToValueAtTime(0, end);
      puff.connect(bp).connect(pg).connect(g);
      puff.start(when);
      puff.stop(end + 0.1);
      return;
    }
    const g = envelope(c, into, when, note.gain, 0.01, end, true);
    tone(c, 'sine', note.hz, 1, g, when, end);
    tone(c, 'sine', note.hz * 2.76, 0.18, g, when, end);
    tone(c, 'sine', note.hz * 5.4, 0.05, g, when, when + 0.5);
  };

  /** Schedule the notes that begin in the next moments. Runs on a timer while the music plays. */
  const scheduleMusic = (c: Ctx): void => {
    if (!composer || suspended || c.state !== 'running' || wantMood === 'off') return;
    const gain = moods.get(wantMood);
    if (!gain) return;
    const t0 = composerStart;
    for (const note of composer.notes(c.currentTime - t0 + MUSIC_AHEAD)) {
      // A note that fell behind (the tab was away) is dropped, not played late in a heap.
      if (t0 + note.time < c.currentTime) continue;
      // A player is never exactly on the beat: up to 30 ms either way.
      playNote(c, note, gain, Math.max(c.currentTime, t0 + note.time + (Math.random() - 0.5) * 0.06));
    }
  };

  const applyMood = (): void => {
    if (!ctx || appliedMood === wantMood) return;
    appliedMood = wantMood;
    const t = ctx.currentTime;
    for (const [mood, node] of moods) node.gain.setTargetAtTime(mood === wantMood ? 1 : 0, t, MUSIC_FADE);
    if (wantMood !== 'off' && composer) composer.setMood(wantMood);
    if (wantMood !== 'off' && !musicTimer) {
      const c = ctx;
      musicTimer = setInterval(() => scheduleMusic(c), MUSIC_EVERY_MS);
    } else if (wantMood === 'off' && musicTimer) {
      // The tail of the last notes fades with the mood gain; the timer stops now, so nothing new is scheduled.
      clearInterval(musicTimer);
      musicTimer = null;
    }
  };

  const build = (c: Ctx): void => {
    const master = c.createGain();
    master.connect(c.destination);
    effects = c.createGain();
    effects.connect(master);
    music = c.createGain();
    music.connect(master);
    // Everything the music plays goes through one hall: some of it dry, some of it echoing round the room.
    const hall = c.createGain();
    hall.connect(music);
    const room = c.createConvolver();
    room.buffer = hallResponse(c);
    const wet = c.createGain();
    wet.gain.value = 0.5;
    hall.connect(room).connect(wet).connect(music);
    for (const mood of ['valley', 'dream'] as const) {
      const gain = c.createGain();
      gain.gain.value = 0;
      gain.connect(hall);
      moods.set(mood, gain);
    }
    composer = createComposer(Math.floor(Math.random() * 1e9), 1);
    composerStart = c.currentTime;
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
    applyMood();
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
    setMood(mood) {
      wantMood = mood;
      applyMood();
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
