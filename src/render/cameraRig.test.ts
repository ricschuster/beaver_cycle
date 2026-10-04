import { describe, expect, it } from 'vitest';
import { MAX_DIST, MAX_PITCH, MIN_DIST, defaultView, drag, followYaw, zoom } from './cameraRig';

describe('camera rig', () => {
  it('turns with a horizontal drag and clamps the tilt', () => {
    const v = defaultView();
    drag(v, 100, 0);
    expect(v.yaw).not.toBeCloseTo(Math.PI);
    drag(v, 0, 100000);
    expect(v.pitch).toBe(MAX_PITCH);
  });

  it('keeps the zoom within limits', () => {
    const v = defaultView();
    zoom(v, 1000);
    expect(v.dist).toBe(MAX_DIST);
    zoom(v, 0.0001);
    expect(v.dist).toBe(MIN_DIST);
  });

  it('eases the yaw toward behind the beaver by the short way round', () => {
    // beaver faces +x (heading PI/2), so behind it is 3PI/2, which is -PI/2 once wrapped.
    // From PI the short way is up through the wrap, landing just past -PI.
    const next = followYaw(Math.PI, Math.PI / 2, 0.1);
    expect(next).toBeGreaterThan(-Math.PI);
    expect(next).toBeLessThan(-Math.PI + 0.3);
    expect(followYaw(Math.PI, 0, 5)).toBeCloseTo(Math.PI); // already behind
  });
});
