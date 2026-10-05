import { describe, expect, it } from 'vitest';
import { meterLook } from './breathMeter';

describe('breath meter', () => {
  it('hides at full breath and shows below it', () => {
    expect(meterLook(1).visible).toBe(false);
    expect(meterLook(0.6)).toMatchObject({ visible: true, percent: 60 });
  });

  it('turns amber when low and clamps out of range values', () => {
    expect(meterLook(0.1).color).not.toBe(meterLook(0.5).color);
    expect(meterLook(-1).percent).toBe(0);
    expect(meterLook(2).visible).toBe(false);
  });
});
