import { describe, expect, it } from 'vitest';
import { createFrameCap } from './frameCap';

/** Frames drawn in `seconds` of a screen at `hz`, with `jitter` ms of noise on each timestamp. */
function drawn(hz: number, fps: number, seconds = 10, jitter = 0): number {
  const cap = createFrameCap(fps);
  let count = 0;
  let seed = 7;
  const noise = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2 * jitter;
  for (let i = 0; i < hz * seconds; i++) if (cap.due(1000 + (i * 1000) / hz + noise())) count++;
  return count;
}

describe('createFrameCap', () => {
  it('halves a 120 Hz screen to 60 fps', () => {
    expect(drawn(120, 60)).toBe(600);
  });

  it('keeps every frame of a 60 Hz screen, even with jitter on the timestamps', () => {
    expect(drawn(60, 60)).toBe(600);
    expect(drawn(60, 60, 10, 2)).toBe(600);
  });

  it('holds a 90 Hz screen near 60 fps and a 144 Hz screen at 60', () => {
    expect(drawn(90, 60)).toBeGreaterThanOrEqual(590);
    expect(drawn(90, 60)).toBeLessThanOrEqual(610);
    expect(drawn(144, 60)).toBeGreaterThanOrEqual(590);
    expect(drawn(144, 60)).toBeLessThanOrEqual(610);
  });

  it('never draws faster than the cap', () => {
    expect(drawn(240, 30)).toBeLessThanOrEqual(305);
  });

  it('does not cap with 0, a negative number or NaN', () => {
    expect(drawn(120, 0)).toBe(1200);
    expect(drawn(120, -5)).toBe(1200);
    expect(drawn(120, Number.NaN)).toBe(1200);
  });

  it('starts again after a long stall instead of drawing a burst', () => {
    const cap = createFrameCap(60);
    expect(cap.due(1000)).toBe(true);
    expect(cap.due(5000)).toBe(true);
    expect(cap.due(5008)).toBe(false);
    expect(cap.due(5017)).toBe(true);
  });
});
