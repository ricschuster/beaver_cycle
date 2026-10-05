import { describe, expect, it } from 'vitest';
import { LeafFall } from './fallingLeaves';

function seeded(): () => number {
  let s = 12345;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
}

const TREES = [100, 500, 100, 1, 110, 502, 95, 1.2];

function run(fall: LeafFall, seconds: number, amount: number, trees: readonly number[]): void {
  for (let t = 0; t < seconds; t += 0.1) fall.update(0.1, amount, trees);
}

describe('leaf fall', () => {
  it('drops no leaves when the amount is zero or there are no trees', () => {
    const none = new LeafFall(seeded());
    run(none, 20, 1, []);
    expect(none.count()).toBe(0);
    const out = new LeafFall(seeded());
    run(out, 20, 0, TREES);
    expect(out.count()).toBe(0);
  });

  it('starts leaves in the crowns and brings them down to the ground', () => {
    const fall = new LeafFall(seeded());
    run(fall, 10, 1, TREES);
    expect(fall.count()).toBeGreaterThan(10);
    for (const l of fall.leaves.filter((x) => x.alive)) {
      expect(l.y).toBeGreaterThan(l.ground);
      expect(l.y).toBeLessThan(l.ground + 12);
      expect(Math.hypot(l.x - 105, l.z - 100)).toBeLessThan(30);
    }
  });

  it('keeps the number in the air at or below the amount', () => {
    const fall = new LeafFall(seeded());
    run(fall, 30, 0.25, TREES);
    expect(fall.count()).toBeLessThanOrEqual(35);
    expect(fall.count()).toBeGreaterThan(0);
  });

  it('lets the leaves in the air finish when the season ends', () => {
    const fall = new LeafFall(seeded());
    run(fall, 10, 1, TREES);
    run(fall, 20, 0, TREES);
    expect(fall.count()).toBe(0);
  });
});
