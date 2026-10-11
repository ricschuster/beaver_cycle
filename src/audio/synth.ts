// Ambient loops made in code (docs/design/32_sound.md), so they need no file and have no licence. Each is plain samples in a
// `Float32Array`, and every loop is silent at both ends, so it joins without a click. No audio device here, so it is easy to test.

/** The loops are made at a low rate: they are birdsong and night sounds, which have little above 6 kHz. The browser resamples. */
export const SYNTH_RATE = 22050;

/** A small seeded random generator, so a loop sounds the same every run. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth bump, 0 at both ends and 1 in the middle. */
const bump = (x: number): number => Math.sin(Math.PI * Math.min(1, Math.max(0, x))) ** 2;

/** Birdsong, 20 s: short phrases of two to four chirps, each a quick sweep with a little wobble. */
export function birdsLoop(rate = SYNTH_RATE, seconds = 20): Float32Array<ArrayBuffer> {
  const n = Math.floor(rate * seconds);
  const out = new Float32Array(n);
  const rand = rng(11);
  let t = 0.6;
  while (t < seconds - 1.5) {
    const chirps = 2 + Math.floor(rand() * 3);
    const base = 2600 + rand() * 1800;
    const up = rand() < 0.5;
    for (let c = 0; c < chirps; c++) {
      const len = 0.07 + rand() * 0.12;
      const f0 = base * (1 + 0.1 * c);
      const f1 = f0 * (up ? 1.5 : 0.65);
      const start = Math.floor((t + c * (len + 0.06)) * rate);
      const count = Math.floor(len * rate);
      let phase = 0;
      for (let i = 0; i < count && start + i < n; i++) {
        const x = i / count;
        const wobble = 1 + 0.03 * Math.sin(2 * Math.PI * 38 * (i / rate));
        phase += (2 * Math.PI * (f0 + (f1 - f0) * x) * wobble) / rate;
        out[start + i]! += 0.35 * bump(x) * Math.sin(phase);
      }
    }
    t += chirps * 0.25 + 1 + rand() * 2.5;
  }
  return out;
}

/** Crickets, 8 s: several insects at their own pitch, each a group of quick pulses that repeats a whole number of times. */
export function cricketsLoop(rate = SYNTH_RATE, seconds = 8): Float32Array<ArrayBuffer> {
  const n = Math.floor(rate * seconds);
  const out = new Float32Array(n);
  const rand = rng(23);
  for (let k = 0; k < 5; k++) {
    const groups = 14 + k * 3;
    const period = seconds / groups;
    const freq = 4200 + rand() * 900;
    const offset = rand() * period * 0.3;
    const pulses = 3;
    for (let g = 0; g < groups; g++) {
      for (let p = 0; p < pulses; p++) {
        const start = Math.floor((g * period + offset + p * 0.045) * rate);
        const count = Math.floor(0.03 * rate);
        let phase = 0;
        for (let i = 0; i < count && start + i < n; i++) {
          phase += (2 * Math.PI * freq) / rate;
          out[start + i]! += 0.07 * bump(i / count) * Math.sin(phase);
        }
      }
    }
  }
  return out;
}

/** An owl, 20 s: a low "hoo, hoo-hoooo" twice, with a long quiet between. */
export function owlLoop(rate = SYNTH_RATE, seconds = 20): Float32Array<ArrayBuffer> {
  const n = Math.floor(rate * seconds);
  const out = new Float32Array(n);
  const hoots: [number, number][] = [
    [2.0, 0.35],
    [2.7, 0.3],
    [3.2, 0.7],
    [11.0, 0.35],
    [11.7, 0.3],
    [12.2, 0.7],
  ];
  for (const [at, len] of hoots) {
    const start = Math.floor(at * rate);
    const count = Math.floor(len * rate);
    let phase = 0;
    for (let i = 0; i < count && start + i < n; i++) {
      const x = i / count;
      phase += (2 * Math.PI * (420 - 60 * x)) / rate;
      out[start + i]! += 0.4 * bump(x) * (Math.sin(phase) + 0.25 * Math.sin(2 * phase));
    }
  }
  return out;
}
