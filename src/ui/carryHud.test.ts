import { describe, expect, it } from 'vitest';
import { formatCarry } from './carryHud';

describe('carry hud', () => {
  it('shows wood and felled trees', () => {
    expect(formatCarry(2, 5, null)).toBe('Wood 2/4, 5 trees felled');
    expect(formatCarry(0, 1, null)).toBe('Wood 0/4, 1 tree felled');
  });

  it('shows the gnaw progress', () => {
    expect(formatCarry(0, 0, 0.5)).toBe('Wood 0/4, 0 trees felled, gnawing 50%');
  });
});
