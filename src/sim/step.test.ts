import { describe, expect, it } from 'vitest';
import { noActions } from '../actions/actions';
import { flatTerrain, type Terrain } from './terrain';
import { WALK_SPEED, createWorld } from './state';
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
});
