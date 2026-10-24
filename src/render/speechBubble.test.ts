import { describe, expect, it } from 'vitest';
import { BUBBLE_LIFE, bubbleLook } from './speechBubble';

describe('a speech bubble over a head', () => {
  it('pops open with a little overshoot and settles to full size', () => {
    expect(bubbleLook(0).scale).toBe(0);
    const peak = Math.max(...[0.1, 0.2, 0.3, 0.4].map((a) => bubbleLook(a).scale));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(1.15);
    expect(bubbleLook(1.5).scale).toBe(1);
  });

  it('stays solid, then fades out and is gone at the end', () => {
    expect(bubbleLook(1).opacity).toBe(1);
    const late = bubbleLook(BUBBLE_LIFE - 0.3);
    expect(late.opacity).toBeGreaterThan(0);
    expect(late.opacity).toBeLessThan(1);
    expect(bubbleLook(BUBBLE_LIFE)).toEqual({ scale: 0, opacity: 0 });
    expect(bubbleLook(-1)).toEqual({ scale: 0, opacity: 0 });
  });
});
