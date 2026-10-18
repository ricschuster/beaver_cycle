import { describe, expect, it } from 'vitest';
import { NARROW_PX, narrowHudCss } from './narrowHud';

describe('narrowHudCss', () => {
  it('moves the readouts only below the narrow width', () => {
    const css = narrowHudCss();
    expect(css.startsWith(`@media (max-width:${NARROW_PX}px)`)).toBe(true);
    for (const id of ['clock-hud', 'life-hud', 'carry-hud', 'coach']) expect(css).toContain(`#${id}{`);
  });

  it('stacks the clock above the life readout, above the carry line, above the coach', () => {
    const top = (id: string): number => Number(new RegExp(`#${id}\\{top:(\\d+)px`).exec(narrowHudCss())![1]);
    expect(top('clock-hud')).toBeLessThan(top('life-hud'));
    expect(top('life-hud')).toBeLessThan(top('carry-hud'));
    expect(top('carry-hud')).toBeLessThan(top('coach'));
  });
});
