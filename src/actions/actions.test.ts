import { describe, expect, it } from 'vitest';
import { mergeActions, noActions, relativeToView } from './actions';

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

describe('mergeActions', () => {
  it('adds moves, caps them at full speed, and ors the buttons', () => {
    const a = { move: { x: 0, z: 1 }, dive: true, slap: false };
    const b = { move: { x: 0, z: 1 }, dive: false, slap: true };
    const m = mergeActions(a, b);
    expect(m.move.z).toBeCloseTo(1);
    expect(m.dive).toBe(true);
    expect(m.slap).toBe(true);
  });

  it('keeps one device alone as it is', () => {
    const m = mergeActions(noActions(), { move: { x: 0.3, z: -0.2 }, dive: false, slap: false });
    expect(m.move).toEqual({ x: 0.3, z: -0.2 });
  });
});
