import { describe, expect, it } from 'vitest';
import { noActions } from '../actions/actions';
import { flatTerrain, type Terrain } from './terrain';
import { WALK_SPEED, createWorld, setSpeedMultiplier, teleport } from './state';
import { step } from './step';

const flat = flatTerrain(0);

describe('step', () => {
  it('stands still without actions', () => {
    const w = step(createWorld(flat), noActions(), 1, flat);
    expect(w.beaver.x).toBe(0);
    expect(w.beaver.z).toBe(0);
    expect(w.time).toBe(1);
  });

  it('walks at walk speed', () => {
    const w = step(createWorld(flat), { move: { x: 0, z: 1 } }, 1, flat);
    expect(w.beaver.z).toBeCloseTo(WALK_SPEED);
  });

  it('does not walk faster diagonally', () => {
    const w = step(createWorld(flat), { move: { x: 1, z: 1 } }, 1, flat);
    expect(Math.hypot(w.beaver.x, w.beaver.z)).toBeCloseTo(WALK_SPEED);
  });

  it('does not change its input', () => {
    const w0 = createWorld(flat);
    step(w0, { move: { x: 1, z: 0 } }, 1, flat);
    expect(w0.beaver.x).toBe(0);
  });

  it('stands on the ground', () => {
    const slope: Terrain = { ...flat, heightAt: (_x, z) => 100 + z * 0.5 };
    const w = step(createWorld(slope), { move: { x: 0, z: 1 } }, 1, slope);
    expect(w.beaver.y).toBeCloseTo(100 + WALK_SPEED * 0.5);
  });

  it('scales speed by the multiplier', () => {
    const w0 = setSpeedMultiplier(createWorld(flat), 20);
    const w = step(w0, { move: { x: 0, z: 1 } }, 1, flat);
    expect(w.beaver.z).toBeCloseTo(WALK_SPEED * 20);
    expect(w.speedMultiplier).toBe(20);
  });

  it('teleports onto the ground and keeps the heading', () => {
    const w0 = step(createWorld(flat), { move: { x: 1, z: 0 } }, 1, flat);
    const hill = { ...flat, heightAt: () => 640 };
    const w = teleport(w0, hill, 100, -50);
    expect(w.beaver).toMatchObject({ x: 100, z: -50, y: 640, heading: w0.beaver.heading });
  });
});
