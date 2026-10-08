import { describe, expect, it } from 'vitest';
import type { ViewState } from './cameraRig';
import { FLY_MIN_HEIGHT, fly, flyTarget, glide, look, lookDir, pickGround, zoomFree } from './flyCam';

const flat = (h: number) => () => h;
const view = (over: Partial<ViewState> = {}): ViewState => ({ yaw: 0, pitch: 0, dist: 0, free: { x: 0, y: 100, z: 0 }, ...over });

describe('fly camera', () => {
  it('looks north at yaw 0 and down at positive pitch', () => {
    const d = lookDir(0, 0);
    expect(d.z).toBeCloseTo(-1);
    expect(lookDir(0, Math.PI / 4).y).toBeLessThan(0);
  });

  it('flies forward level, whatever the pitch', () => {
    const v = view({ pitch: Math.PI / 4 });
    fly(v, { x: 0, z: 1 }, 0, 1, flat(0));
    expect(v.free!.z).toBeLessThan(0);
    expect(v.free!.y).toBeCloseTo(100);
  });

  it('strafes left with positive x', () => {
    const v = view();
    fly(v, { x: 1, z: 0 }, 0, 1, flat(0));
    expect(v.free!.x).toBeLessThan(0);
  });

  it('keeps a height over the ground and cannot dive into it', () => {
    const v = view({ free: { x: 0, y: 5, z: 0 } });
    for (let i = 0; i < 50; i++) fly(v, { x: 0, z: 0 }, -1, 0.1, flat(0));
    expect(v.free!.y).toBeCloseTo(FLY_MIN_HEIGHT);
  });

  it('climbs straight up', () => {
    const v = view();
    fly(v, { x: 0, z: 0 }, 1, 1, flat(0));
    expect(v.free!.y).toBeGreaterThan(100);
  });

  it('zooms in along the look with a forward wheel roll and out with a back roll', () => {
    const v = view();
    zoomFree(v, -100, flat(0));
    expect(v.free!.z).toBeLessThan(0);
    zoomFree(v, 200, flat(0));
    expect(v.free!.z).toBeGreaterThan(0);
  });

  it('turns with a drag and clamps the pitch', () => {
    const v = view();
    look(v, 100, 0);
    expect(v.yaw).toBeLessThan(0);
    look(v, 0, 50);
    expect(v.pitch).toBeGreaterThan(0);
    look(v, 0, 100000);
    expect(v.pitch).toBeLessThanOrEqual(1.5);
  });

  it('picks the ground under the screen centre', () => {
    const v = view({ pitch: Math.PI / 2 });
    const hit = pickGround(v, 0, 0, 1.5, 1, flat(0));
    expect(hit!.x).toBeCloseTo(0, 1);
    expect(hit!.y).toBeCloseTo(0, 1);
  });

  it('finds nothing in the sky', () => {
    expect(pickGround(view({ pitch: -0.5 }), 0, 0, 1.5, 1, flat(0))).toBeNull();
  });

  it('picks to the right of centre toward east when looking north', () => {
    const hit = pickGround(view({ pitch: 0.8 }), 0.5, 0, 1.5, 1, flat(0));
    expect(hit!.x).toBeGreaterThan(0);
  });

  it('glides to a spot facing the tapped point and arrives', () => {
    const v = view();
    const to = flyTarget(v.free!, { x: 0, y: 0, z: -500 }, flat(0));
    expect(to.z).toBeLessThan(-300);
    expect(to.pitch).toBeGreaterThan(0);
    let done = false;
    for (let i = 0; i < 600 && !done; i++) done = glide(v, to, 0.05);
    expect(done).toBe(true);
  });

  it('stops no nearer than the stand-off', () => {
    const to = flyTarget({ x: 0, y: 60, z: 0 }, { x: 0, y: 0, z: -50 }, flat(0));
    expect(Math.hypot(to.z + 50, to.y)).toBeGreaterThan(30);
  });
});
