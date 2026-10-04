import { describe, expect, it } from 'vitest';
import { relativeToView } from './actions';

describe('relativeToView', () => {
  it('leaves the move alone for the default view behind a beaver facing +z', () => {
    const m = relativeToView({ x: 0.3, z: 1 }, Math.PI);
    expect(m.x).toBeCloseTo(0.3);
    expect(m.z).toBeCloseTo(1);
  });

  it('goes away from the camera when the camera is east of the beaver', () => {
    // camera at +x (yaw PI/2), so forward is -x
    const m = relativeToView({ x: 0, z: 1 }, Math.PI / 2);
    expect(m.x).toBeCloseTo(-1);
    expect(m.z).toBeCloseTo(0);
  });

  it('keeps the length', () => {
    const m = relativeToView({ x: 0.6, z: 0.8 }, 1.1);
    expect(Math.hypot(m.x, m.z)).toBeCloseTo(1);
  });
});
