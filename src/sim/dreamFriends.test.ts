import { describe, expect, it } from 'vitest';
import { MAX_FRIENDS, joinDream, leaveDream, newDream, stepDream, WALK_SPEED, type DreamInput } from './dream';

const DT = 1 / 30;
const still: DreamInput = { move: { x: 0, z: 0 }, hop: false, slap: false, play: false };

describe('friends in a dream (#665)', () => {
  it('puts a friend beside the player, once, on the ground', () => {
    const s = joinDream(newDream(7), 'g1');
    expect(s.friends).toHaveLength(1);
    const f = s.friends![0]!;
    expect(f.id).toBe('g1');
    expect(Math.hypot(f.beaver.x - s.beaver.x, f.beaver.z - s.beaver.z)).toBeGreaterThan(1);
    expect(Math.hypot(f.beaver.x - s.beaver.x, f.beaver.z - s.beaver.z)).toBeLessThan(5);
    expect(joinDream(s, 'g1')).toBe(s);
  });

  it('holds at most three friends, each in a place of its own', () => {
    let s = newDream(7);
    for (const id of ['a', 'b', 'c', 'd']) s = joinDream(s, id);
    expect(s.friends).toHaveLength(MAX_FRIENDS);
    const spots = new Set(s.friends!.map((f) => `${f.beaver.x.toFixed(2)},${f.beaver.z.toFixed(2)}`));
    expect(spots.size).toBe(MAX_FRIENDS);
  });

  it('moves a friend by its own input, not the player\'s', () => {
    let s = joinDream(newDream(7), 'g1');
    const before = s.friends![0]!.beaver;
    const player = s.beaver;
    for (let i = 0; i < 60; i++) s = stepDream(s, still, DT, { g1: { ...still, move: { x: 0, z: 1 } } }).state;
    const after = s.friends![0]!.beaver;
    expect(after.z - before.z).toBeGreaterThan(WALK_SPEED * 0.5);
    expect(s.beaver.x).toBe(player.x);
    expect(s.beaver.z).toBe(player.z);
  });

  it('lets a friend hop and slap, and leaves one with no input standing', () => {
    let s = joinDream(joinDream(newDream(7), 'a'), 'b');
    s = stepDream(s, still, DT, { a: { ...still, hop: true, slap: true } }).state;
    const [a, b] = s.friends!;
    expect(a!.beaver.hopAt).not.toBeNull();
    expect(a!.beaver.slapAt).not.toBeNull();
    expect(b!.beaver.hopAt).toBeNull();
  });

  it('lets a friend wake while the dream goes on', () => {
    const s = joinDream(joinDream(newDream(7), 'a'), 'b');
    const w = leaveDream(s, 'a');
    expect(w.friends!.map((f) => f.id)).toEqual(['b']);
    expect(leaveDream(w, 'b').friends).toBeUndefined();
    expect(leaveDream(w, 'nobody')).toBe(w);
  });
});
