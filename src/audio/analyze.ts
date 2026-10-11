// Measuring a sound from its samples (docs/design/32_sound.md, "Checking sound"), and writing it as a WAV file. Plain numbers,
// no audio device, so the tests and the sound preview page share it.

export interface SoundStats {
  seconds: number;
  /** Highest absolute sample, 0 to 1 or more. */
  peak: number;
  /** Loudness over the part that is not silent, in dB below full scale (0 is full). */
  rmsDb: number;
  /** Samples at or past full scale. */
  clipped: number;
  /** Seconds of near silence at the start and at the end. */
  leadSilence: number;
  tailSilence: number;
  /** Mean of the samples: a value far from 0 clicks at the start. */
  dc: number;
  /** The "centre of mass" of the spectrum in Hz: low is dull or thin, high is bright or buzzy. */
  centroid: number;
}

/** Below this a sample counts as silent. */
export const SILENCE = 0.002;

/** An in-place radix-2 FFT of `re` and `im`, whose length is a power of two. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b]! * wr - im[b]! * wi;
        const ti = re[b]! * wi + im[b]! * wr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a]! += tr;
        im[a]! += ti;
      }
    }
  }
}

/** Spectral centroid in Hz, from Hann windowed blocks of 1024 samples, weighted by their energy. */
export function centroidOf(samples: Float32Array, rate: number): number {
  const N = 1024;
  let weighted = 0;
  let total = 0;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let start = 0; start < samples.length; start += N / 2) {
    for (let i = 0; i < N; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
      re[i] = (samples[start + i] ?? 0) * w;
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const mag = re[k]! * re[k]! + im[k]! * im[k]!;
      weighted += mag * ((k * rate) / N);
      total += mag;
    }
  }
  return total > 0 ? weighted / total : 0;
}

export function analyze(samples: Float32Array, rate: number): SoundStats {
  const n = samples.length;
  let peak = 0;
  let clipped = 0;
  let sum = 0;
  let first = -1;
  let last = -1;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(samples[i]!);
    sum += samples[i]!;
    if (a > peak) peak = a;
    if (a >= 1) clipped++;
    if (a > SILENCE) {
      if (first < 0) first = i;
      last = i;
    }
  }
  let sq = 0;
  const span = first < 0 ? 0 : last - first + 1;
  for (let i = Math.max(0, first); i <= last; i++) sq += samples[i]! * samples[i]!;
  const rms = span > 0 ? Math.sqrt(sq / span) : 0;
  return {
    seconds: n / rate,
    peak,
    rmsDb: rms > 0 ? 20 * Math.log10(rms) : -Infinity,
    clipped,
    leadSilence: first < 0 ? n / rate : first / rate,
    tailSilence: first < 0 ? n / rate : (n - 1 - last) / rate,
    dc: n > 0 ? sum / n : 0,
    centroid: centroidOf(samples, rate),
  };
}

/** A 16 bit mono WAV file. */
export function wavBytes(samples: Float32Array, rate: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(bytes.buffer);
  const text = (at: number, s: string): void => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i]!)) * 32767), true);
  return bytes;
}
