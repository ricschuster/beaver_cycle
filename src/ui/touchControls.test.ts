import { describe, expect, it } from 'vitest';
import { wantsTouchControls } from './touchControls';

describe('wantsTouchControls', () => {
  it('shows on touch devices and with ?touch=1, and not on a plain desktop', () => {
    expect(wantsTouchControls({ maxTouchPoints: 5 }, new URLSearchParams())).toBe(true);
    expect(wantsTouchControls({ maxTouchPoints: 0 }, new URLSearchParams('touch=1'))).toBe(true);
    expect(wantsTouchControls({ maxTouchPoints: 0 }, new URLSearchParams())).toBe(false);
  });
});
