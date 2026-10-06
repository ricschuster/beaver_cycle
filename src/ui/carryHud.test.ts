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

  it('shows the lodge once it is started', () => {
    expect(formatCarry(1, false, null, 0.4)).toBe('1 tree felled, lodge 40%');
    expect(formatCarry(1, false, null, 1)).toBe('1 tree felled, lodge done');
  });

  it('says whether the spot ahead takes a lodge while dragging', () => {
    expect(formatCarry(1, true, null, null, 'ok')).toBe('1 tree felled, dragging a log, press Build to start the lodge here');
    expect(formatCarry(1, true, null, null, 'deep')).toBe('1 tree felled, dragging a log, no lodge spot, too deep');
    expect(formatCarry(1, true, null, null, null)).toBe('1 tree felled, dragging a log');
  });
});
