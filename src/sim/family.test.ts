import { describe, expect, it } from 'vitest';
import { DAY_SECONDS } from './clock';
import { COAT_COUNT, FIRST_PARENTS, STAY, formerParentsAt, kitCoat, coatOf, parentsAt, pondParts } from './family';
import { BABY_DAYS, TEENAGER_DAYS } from './life';
import { LODGE_WOOD, NEST_SPOTS, SOLID_RADIUS, type Lodge } from './lodge';
import type { Terrain } from './terrain';

/** A lake everywhere within 40 m of the origin, 3 m deep, and dry land beyond. */
const lake: Terrain = {
  heightAt: () => -3,
  isWater: (x, z) => Math.hypot(x, z) < 40,
  waterDepth: (x, z) => (Math.hypot(x, z) < 40 ? 3 : 0),
};
const lodge: Lodge = { x: 0, z: 0, base: 0, door: 0, wood: LODGE_WOOD };
const d = (days: number) => days * DAY_SECONDS;

describe('coats', () => {
  it('gives every birth a coat from the palette, the same each time', () => {
    for (let i = 0; i < 50; i++) expect(coatOf(d(i))).toBeLessThan(COAT_COUNT);
    expect(coatOf(d(7))).toBe(coatOf(d(7)));
  });

  it('varies between babies', () => {
    const seen = new Set(Array.from({ length: 40 }, (_, i) => coatOf(d(i * 3))));
    expect(seen.size).toBeGreaterThan(2);
  });

  it('gives Mama and Papa different coats', () => {
    expect(FIRST_PARENTS[0].coat).not.toBe(FIRST_PARENTS[1].coat);
  });
});

describe('a kit coat', () => {
  const parents = [{ coat: 0, shade: 0.2 }, { coat: 3, shade: -0.4 }] as const;

  it('is the coat of one of the parents in a slightly different shade', () => {
    for (let i = 0; i < 60; i++) {
      const kit = kitCoat(parents, i * 977);
      const from = parents.find((p) => p.coat === kit.coat)!;
      expect(from).toBeDefined();
      expect(Math.abs(kit.shade - from.shade)).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(kit.shade).toBeGreaterThanOrEqual(-1);
      expect(kit.shade).toBeLessThanOrEqual(1);
    }
  });

  it('comes from both parents and varies', () => {
    const kits = Array.from({ length: 60 }, (_, i) => kitCoat(parents, i * 977));
    expect(new Set(kits.map((k) => k.coat)).size).toBe(2);
    expect(new Set(kits.map((k) => k.shade.toFixed(2))).size).toBeGreaterThan(10);
  });
});

describe('the parents of a former home', () => {
  const former = { ...lodge, x: 10, parents: [{ coat: 0, shade: 0 }, { coat: 2, shade: 0.3 }] as const };

  it('stay in their pond after the player is grown, each with its own id and coat', () => {
    const ps = formerParentsAt([former], d(500), lake);
    expect(ps).toHaveLength(2);
    expect(ps.map((p) => p.coat)).toEqual([...former.parents]);
    expect(new Set(ps.map((p) => p.id)).size).toBe(2);
    expect(ps.every((p) => !p.inside && lake.waterDepth(p.x, p.z) > 0)).toBe(true);
  });

  it('are none without a former home, and do not share ids between homes', () => {
    expect(formerParentsAt([], d(500), lake)).toEqual([]);
    const ids = formerParentsAt([former, { ...former, x: -10 }], d(500), lake).map((p) => p.id);
    expect(new Set(ids).size).toBe(4);
  });
});

describe('Mama and Papa', () => {
  it('are there while the player is a baby or a teenager, and gone when it is grown', () => {
    expect(parentsAt(lodge, 0, d(1), false, lake)).toHaveLength(2);
    expect(parentsAt(lodge, 0, d(BABY_DAYS + 1), false, lake)).toHaveLength(2);
    expect(parentsAt(lodge, 0, d(BABY_DAYS + TEENAGER_DAYS), false, lake)).toHaveLength(0);
  });

  it('need a whole lodge', () => {
    expect(parentsAt(null, 0, d(1), false, lake)).toHaveLength(0);
    expect(parentsAt({ ...lodge, wood: LODGE_WOOD - 1 }, 0, d(1), false, lake)).toHaveLength(0);
  });

  it('keep to deep water near the lodge when outside', () => {
    for (let h = 0; h < 40; h++) {
      for (const p of parentsAt(lodge, 0, d(1) + h * STAY * 0.37, false, lake)) {
        expect(p.inside).toBe(false);
        expect(lake.waterDepth(p.x, p.z)).toBeGreaterThan(0);
        expect(Math.hypot(p.x - lodge.x, p.z - lodge.z)).toBeLessThan(30);
      }
    }
  });

  it('never swim through the dome of the lodge', () => {
    for (let i = 0; i < 400; i++) {
      for (const p of parentsAt(lodge, 0, d(1) + i * STAY * 0.05, false, lake)) {
        expect(Math.hypot(p.x - lodge.x, p.z - lodge.z)).toBeGreaterThanOrEqual(SOLID_RADIUS);
      }
    }
  });

  it('move to another part of the pond over the days', () => {
    const at = (clock: number) => parentsAt(lodge, 0, clock, false, lake).map((p) => `${p.x.toFixed(1)},${p.z.toFixed(1)}`);
    const seen = new Set(Array.from({ length: 24 }, (_, i) => at(d(1) + i * STAY).join('|')));
    expect(seen.size).toBeGreaterThan(3);
  });

  it('do not change when asked twice at the same clock', () => {
    expect(parentsAt(lodge, 0, d(2.3), false, lake)).toEqual(parentsAt(lodge, 0, d(2.3), false, lake));
  });

  it('lie on their own nests inside the lodge, not on the nest of the player', () => {
    const inside = parentsAt(lodge, 0, d(1), true, lake);
    expect(inside.map((p) => p.inside)).toEqual([true, true]);
    expect(inside[0]!.x).toBeCloseTo(NEST_SPOTS[1]!.x);
    expect(inside[1]!.z).toBeCloseTo(NEST_SPOTS[2]!.z);
    expect(inside.every((p) => Math.hypot(p.x - NEST_SPOTS[0]!.x, p.z - NEST_SPOTS[0]!.z) > 1)).toBe(true);
  });

  it('stay out when there is no water to swim in', () => {
    const dry: Terrain = { heightAt: () => 0, isWater: () => false, waterDepth: () => 0 };
    expect(pondParts(lodge, dry)).toHaveLength(0);
    expect(parentsAt(lodge, 0, d(1), false, dry)).toHaveLength(0);
  });
});
