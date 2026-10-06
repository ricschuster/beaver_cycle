import { describe, expect, it } from 'vitest';
import { formatCarry } from './carryHud';

describe('carry hud', () => {
  it('shows the trees felled', () => {
    expect(formatCarry(5, false, null)).toBe('5 trees felled');
    expect(formatCarry(1, false, null)).toBe('1 tree felled');
  });

  it('shows the gnaw progress', () => {
    expect(formatCarry(0, false, 0.5)).toBe('0 trees felled, gnawing 50%');
  });

  it('says when a log is being dragged', () => {
    expect(formatCarry(2, true, null)).toBe('2 trees felled, dragging a log');
  });
});
