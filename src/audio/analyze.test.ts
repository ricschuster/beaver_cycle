import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { analyze, wavBytes, SILENCE } from './analyze';
import { effectSamples } from './effectsSynth';
import { birdsLoop, cricketsLoop, owlLoop, SYNTH_RATE } from './synth';
import { DURATION, type Effect } from './effects';

const EFFECTS = Object.keys(DURATION) as Effect[];
/** A babble has no fixed length: it comes with its cue. */
const talk = { pitch: 300, seconds: 1.2, seed: 7 };
const samplesOf = (e: Effect): Float32Array => effectSamples(e, SYNTH_RATE, e === 'babble' ? talk : undefined);

describe('analyze', () => {
  it('measures a sine', () => {
    const s = new Float32Array(SYNTH_RATE).map((_, i) => 0.5 * Math.sin((2 * Math.PI * 1000 * i) / SYNTH_RATE));
    const a = analyze(s, SYNTH_RATE);
    expect(a.peak).toBeCloseTo(0.5, 2);
    expect(a.rmsDb).toBeCloseTo(20 * Math.log10(0.5 / Math.SQRT2), 0);
    expect(a.centroid).toBeGreaterThan(900);
    expect(a.centroid).toBeLessThan(1100);
    expect(a.clipped).toBe(0);
  });

  it('finds silence at both ends', () => {
    const s = new Float32Array(1000);
    s.fill(0.5, 100, 800);
    const a = analyze(s, 1000);
    expect(a.leadSilence).toBeCloseTo(0.1, 3);
    expect(a.tailSilence).toBeCloseTo(0.2, 3);
    expect(analyze(new Float32Array(10), 10).rmsDb).toBe(-Infinity);
  });

  it('writes a WAV with a header and 16 bit samples', () => {
    const w = wavBytes(new Float32Array([0, 1, -1]), 22050);
    expect(w.length).toBe(44 + 6);
    expect(String.fromCharCode(...w.slice(0, 4))).toBe('RIFF');
    expect(new DataView(w.buffer).getInt16(46, true)).toBe(32767);
  });
});

describe('every one-shot effect', () => {
  for (const e of EFFECTS) {
    it(`${e} does not clip, click or run silent`, () => {
      const a = analyze(samplesOf(e), SYNTH_RATE);
      expect(a.clipped).toBe(0);
      expect(a.peak).toBeGreaterThan(0.1);
      expect(Math.abs(a.dc)).toBeLessThan(0.02);
      // Loud enough to hear, and none far louder than the rest (the quietest are the strokes and the pickup, on purpose).
      expect(a.rmsDb).toBeGreaterThan(-32);
      expect(a.rmsDb).toBeLessThan(-14);
    });
  }
});

describe('the ambient loops', () => {
  const loops = { birds: birdsLoop(), crickets: cricketsLoop(), owl: owlLoop() };
  for (const [name, s] of Object.entries(loops)) {
    it(`${name} joins without a click and does not clip`, () => {
      const a = analyze(s, SYNTH_RATE);
      expect(a.clipped).toBe(0);
      expect(Math.abs(s[0]!)).toBeLessThan(SILENCE);
      expect(Math.abs(s[s.length - 1]!)).toBeLessThan(SILENCE);
    });
  }
});

// `SOUND_REPORT=dir npx vitest run src/audio/analyze.test.ts` writes a WAV of each sound and a table of the measurements there.
const dir = process.env.SOUND_REPORT;
describe.skipIf(!dir)('sound report', () => {
  it('writes the WAV files and the table', () => {
    mkdirSync(dir!, { recursive: true });
    const rows = ['| sound | seconds | peak | rms dB | lead s | tail s | centroid Hz |', '|---|---|---|---|---|---|---|'];
    const all: [string, Float32Array][] = [...EFFECTS.map((e): [string, Float32Array] => [e, samplesOf(e)]), ['loop-birds', birdsLoop()], ['loop-crickets', cricketsLoop()], ['loop-owl', owlLoop()]];
    for (const [name, s] of all) {
      writeFileSync(`${dir}/${name}.wav`, wavBytes(s, SYNTH_RATE));
      const a = analyze(s, SYNTH_RATE);
      rows.push(`| ${name} | ${a.seconds.toFixed(2)} | ${a.peak.toFixed(2)} | ${a.rmsDb.toFixed(1)} | ${a.leadSilence.toFixed(2)} | ${a.tailSilence.toFixed(2)} | ${Math.round(a.centroid)} |`);
    }
    writeFileSync(`${dir}/report.md`, rows.join('\n') + '\n');
  });
});
