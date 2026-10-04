import { describe, expect, it } from 'vitest';
import { noActions } from '../actions/actions';
import { WALK_SPEED, createWorld } from './state';
import { step } from './step';

describe('step', () => {
  it('stands still without actions', () => {
    const w = step(createWorld(), noActions(), 1);
    expect(w.beaver.x).toBe(0);
    expect(w.beaver.z).toBe(0);
    expect(w.time).toBe(1);
  });

  it('walks at walk speed', () => {
    const w = step(createWorld(), { move: { x: 0, z: 1 } }, 1);
    expect(w.beaver.z).toBeCloseTo(WALK_SPEED);
  });

  it('does not walk faster diagonally', () => {
    const w = step(createWorld(), { move: { x: 1, z: 1 } }, 1);
    expect(Math.hypot(w.beaver.x, w.beaver.z)).toBeCloseTo(WALK_SPEED);
  });

  it('does not change its input', () => {
    const w0 = createWorld();
    step(w0, { move: { x: 1, z: 0 } }, 1);
    expect(w0.beaver.x).toBe(0);
  });
});
