// Sound in the browser through the Web Audio API (docs/design/32_sound.md). One AudioContext for the whole game. The browser
// blocks it until the first touch or key, so it is made on `unlock`, called from such an event. The rushing water is made in
// code from looped noise, so it needs no file and has no licence.

import type { Layer, SoundOut } from './soundOut';

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

export function createWebAudio(): SoundOut {
  const Ctor: typeof AudioContext | undefined =
    typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  let ctx: Ctx | null = null;
  let effects: GainNode | null = null;
  let music: GainNode | null = null;
  const layers = new Map<Layer, GainNode>();
  // What was asked before the context existed.
  let wantEffects = 0;
  let wantMusic = 0;
  const wantLayers = new Map<Layer, number>();
  let suspended = false;

  const build = (c: Ctx): void => {
    const master = c.createGain();
    master.connect(c.destination);
    effects = c.createGain();
    effects.connect(master);
    music = c.createGain();
    music.connect(master);
    // Water: noise through a low-pass that opens a little and moves, so it rushes and does not hiss.
    const water = c.createGain();
    water.gain.value = 0;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const wobble = c.createOscillator();
    wobble.frequency.value = 0.3;
    const depth = c.createGain();
    depth.gain.value = 250;
    wobble.connect(depth).connect(lp.frequency);
    src.connect(lp).connect(water).connect(effects);
    src.start();
    wobble.start();
    layers.set('water', water);
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
