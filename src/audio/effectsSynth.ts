// The beaver's one-shot effects made in code (docs/design/32_sound.md), so they need no file and have no licence. Each is plain
// samples in a `Float32Array`, silent at both ends. No audio device here, so it is easy to test.

import { SYNTH_RATE } from './synth';
import type { Effect } from './effects';
import { DURATION } from './effects';

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Add noise with a fast attack and an exponential fall, run through a one pole low-pass (`lp` 0 to 1, higher is brighter). */
function noise(out: Float32Array, rand: () => number, at: number, len: number, level: number, lp: number, rate: number): void {
  const start = Math.floor(at * rate);
  const count = Math.floor(len * rate);
  let last = 0;
  for (let i = 0; i < count && start + i < out.length; i++) {
    const x = i / count;
    last += lp * ((rand() * 2 - 1) - last);
    out[start + i]! += level * last * Math.min(1, x * 40) * Math.exp(-5 * x);
  }
}

/** Add a falling sine thump. */
function thump(out: Float32Array, at: number, len: number, level: number, f0: number, f1: number, rate: number): void {
  const start = Math.floor(at * rate);
  const count = Math.floor(len * rate);
  let phase = 0;
  for (let i = 0; i < count && start + i < out.length; i++) {
    const x = i / count;
    phase += (2 * Math.PI * (f0 + (f1 - f0) * x)) / rate;
    out[start + i]! += level * Math.min(1, x * 30) * Math.exp(-4 * x) * Math.sin(phase);
  }
}

/** Add noise through a resonant band-pass (centre `hz`, `q` higher is narrower) with a shaped envelope `env(x)` for x 0 to 1. */
function band(out: Float32Array, rand: () => number, at: number, len: number, level: number, hz: number, q: number, env: (x: number) => number, rate: number): void {
  const start = Math.floor(at * rate);
  const count = Math.floor(len * rate);
  const f = 2 * Math.sin((Math.PI * hz) / rate);
  let low = 0;
  let bp = 0;
  for (let i = 0; i < count && start + i < out.length; i++) {
    const high = rand() * 2 - 1 - low - bp / q;
    bp += f * high;
    low += f * bp;
    out[start + i]! += level * bp * env(i / count);
  }
}

/** Add a short damped ringing tone, a knock of wood. */
function knock(out: Float32Array, at: number, len: number, level: number, hz: number, rate: number): void {
  const start = Math.floor(at * rate);
  const count = Math.floor(len * rate);
  for (let i = 0; i < count && start + i < out.length; i++) {
    const x = i / count;
    out[start + i]! += level * Math.min(1, x * 80) * Math.exp(-7 * x) * Math.sin((2 * Math.PI * hz * i) / rate);
  }
}

/** Incisors on wood: a rasp that chatters with the ridges of the teeth, then a small knock as the chip comes away. */
function bite(out: Float32Array, rand: () => number, at: number, len: number, level: number, rate: number): void {
  const chatter = 70 + rand() * 40;
  band(out, rand, at, len, level * 0.9, 2200 + rand() * 1800, 2.5, (x) => Math.min(1, x * 12) * (1 - x) * (0.45 + 0.55 * Math.abs(Math.sin(Math.PI * chatter * x * len))), rate);
  band(out, rand, at, len * 0.8, level * 0.5, 700 + rand() * 300, 4, (x) => Math.min(1, x * 20) * Math.exp(-4 * x), rate);
  knock(out, at + len * 0.55, 0.05, level * 0.5, 320 + rand() * 120, rate);
}

/** The samples of one effect, as long as `DURATION` says. */
export function effectSamples(effect: Effect, rate = SYNTH_RATE): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.floor(rate * DURATION[effect]));
  const rand = rng(41 + effect.length * 7 + effect.charCodeAt(0));
  switch (effect) {
    case 'chop':
      // Gnawing: four quick bites, each a rasp and a small knock, no two the same.
      for (let k = 0; k < 4; k++) bite(out, rand, 0.01 + k * 0.115 + rand() * 0.02, 0.09 + rand() * 0.03, 0.75 - k * 0.05, rate);
      break;
    case 'fall': {
      // A creak that slides down, a crack, then the thud of the trunk.
      const creak = Math.floor(0.7 * rate);
      let phase = 0;
      for (let i = 0; i < creak; i++) {
        const x = i / creak;
        phase += (2 * Math.PI * (320 - 200 * x) * (1 + 0.08 * Math.sin(2 * Math.PI * 23 * (i / rate)))) / rate;
        out[i]! += 0.2 * Math.sin(Math.PI * x) * Math.sin(phase);
      }
      for (let k = 0; k < 5; k++) bite(out, rand, 0.5 + k * 0.035, 0.05, 0.5, rate); // the trunk splinters
      band(out, rand, 0.7, 0.35, 0.5, 3500, 1.2, (x) => Math.sin(Math.PI * x), rate); // the crown through leaves
      noise(out, rand, 0.55, 0.15, 0.7, 0.6, rate);
      noise(out, rand, 1.0, 0.45, 0.8, 0.12, rate);
      thump(out, 1.0, 0.45, 0.9, 70, 38, rate);
      break;
    }
    case 'splash':
      noise(out, rand, 0, 0.6, 0.8, 0.35, rate);
      noise(out, rand, 0.05, 0.3, 0.4, 0.8, rate);
      break;
    case 'slap':
      // The flat of the tail on the water: a sharp crack and a low pop.
      noise(out, rand, 0, 0.12, 1, 0.7, rate);
      thump(out, 0, 0.25, 0.7, 150, 70, rate);
      break;
    case 'stroke':
      noise(out, rand, 0, 0.35, 0.5, 0.25, rate);
      break;
    case 'eat':
      // Three little crunches.
      for (let k = 0; k < 3; k++) noise(out, rand, 0.02 + k * 0.12, 0.07, 0.8, 0.45, rate);
      break;
    case 'pickup':
      noise(out, rand, 0, 0.08, 0.5, 0.3, rate);
      break;
    case 'setdown':
      noise(out, rand, 0, 0.12, 0.5, 0.15, rate);
      thump(out, 0, 0.2, 0.6, 120, 60, rate);
      break;
  }
  // Keep it clear of clipping, then end on silence.
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const scale = peak > 0.9 ? 0.9 / peak : 1;
  const fade = Math.floor(rate * 0.01);
  for (let i = 0; i < out.length; i++) {
    const tail = Math.min(1, (out.length - 1 - i) / fade);
    out[i] = out[i]! * scale * tail;
  }
  return out;
}
