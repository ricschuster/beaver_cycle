import { describe, expect, it } from 'vitest';
import { FAMILY_KEEP_AWAY, FAMILY_START_TRUST, GIFT_REACH, GIVE_REACH, KIT_CLOSE, familyMood, familyTrust, giftFamilies, giveFamily, greetedBy, homeLearned, isOwnFamily, takerNear, reactFamilies, startleFamilies } from './familyMoods';
import { FEED_TRUST, SLAP_TRUST } from './moods';
import type { NeighbourBeaver } from './neighbours';
import { createWorld, type WorldState } from './state';
import type { Terrain } from './terrain';

const lake: Terrain = { heightAt: () => 0, isWater: () => true, waterDepth: () => 2 };
const dry: Terrain = { heightAt: () => 0, isWater: () => false, waterDepth: () => 0 };

const beaver = (family: string, role: 'mama' | 'papa' | 'kit', x: number, z: number): NeighbourBeaver => ({
  id: `${family}:${role}`, name: 'Test', family, role, stage: role === 'kit' ? 'baby' : 'adult', coat: { coat: 0, shade: 0 }, x, y: 0, z, heading: 0, pace: 0, task: 'rest', errand: 'rest', carry: null, scale: 1,
});
const world = (trust: Record<string, number> = {}): WorldState => ({ ...createWorld(lake, 0, 0), trust });
const dist = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z);

describe('family trust', () => {
  it('starts wary, and follows the record', () => {
    expect(familyTrust(world(), 'f')).toBe(FAMILY_START_TRUST);
    expect(familyMood(world(), 'f')).toBe('wary');
    expect(familyMood(world({ f: 0.5 }), 'f')).toBe('calm');
    expect(familyMood(world({ f: 0.8 }), 'f')).toBe('curious');
  });
});

describe('reactFamilies', () => {
  it('keeps a wary family away from the beaver, in the water only', () => {
    const w = world();
    const near = [beaver('f', 'mama', 3, 0)];
    expect(dist(reactFamilies(near, w, lake)[0]!, w.beaver)).toBeCloseTo(FAMILY_KEEP_AWAY, 5);
    expect(reactFamilies(near, w, dry)[0]).toEqual(near[0]);
    const far = [beaver('f', 'mama', 30, 0)];
    expect(reactFamilies(far, w, lake)[0]).toEqual(far[0]);
  });

  it('drops the pose of an errand for a beaver it moves, but keeps its load and errand', () => {
    const w = world();
    const busy: NeighbourBeaver = { ...beaver('f', 'papa', 3, 0), task: 'build', errand: 'store', carry: 'branch', mode: 'walk' };
    const moved = reactFamilies([busy], w, lake)[0]!;
    expect(moved.task).toBe('swim');
    expect(moved.mode).toBe('swim');
    expect(moved.carry).toBe('branch');
    expect(moved.errand).toBe('store');
  });

  it('lets a calm family be, and sends the kits of a curious one to look', () => {
    const calm = world({ f: 0.5 });
    const list = [beaver('f', 'mama', 8, 0), beaver('f', 'kit', 20, 0)];
    expect(reactFamilies(list, calm, lake)).toEqual(list);
    const curious = world({ f: 0.9 });
    const out = reactFamilies(list, curious, lake);
    expect(out[0]).toEqual(list[0]);
    expect(dist(out[1]!, curious.beaver)).toBeLessThan(20);
    expect(dist(out[1]!, curious.beaver)).toBeGreaterThan(KIT_CLOSE);
  });
});

describe('gifts and slaps', () => {
  const lying = (kind: 'branch' | 'lily' | 'rock', x: number) => ({ id: `d${x}`, kind, at: 0, x, z: 0 });
  it('takes food put down near a family and trusts more', () => {
    const w = { ...world(), dropped: [lying('branch', 5), lying('lily', 6)] };
    const r = giftFamilies(w, [beaver('f', 'mama', 8, 0)]);
    expect(r.thanked).toEqual(['f', 'f']);
    expect(r.world.dropped).toEqual([]);
    expect(familyTrust(r.world, 'f')).toBeCloseTo(FAMILY_START_TRUST + 2 * FEED_TRUST, 5);
  });

  it('leaves a rock, and food that is too far', () => {
    const w = { ...world(), dropped: [lying('rock', 5), lying('branch', 8 + GIFT_REACH + 1)] };
    const r = giftFamilies(w, [beaver('f', 'mama', 8, 0)]);
    expect(r.thanked).toEqual([]);
    expect(r.world).toBe(w);
  });

  it('loses trust to a slap near the family, never below 0', () => {
    const w = world({ f: 0.5 });
    expect(familyTrust(startleFamilies(w, [beaver('f', 'mama', 10, 0)]), 'f')).toBeCloseTo(0.5 - SLAP_TRUST, 5);
    expect(familyTrust(startleFamilies(world({ f: 0.1 }), [beaver('f', 'mama', 10, 0)]), 'f')).toBe(0);
    expect(startleFamilies(w, [beaver('f', 'mama', 100, 0)])).toBe(w);
  });
});

describe('greetedBy', () => {
  it('names the nearest family within range', () => {
    const w = world();
    expect(greetedBy([beaver('a', 'mama', 15, 0), beaver('b', 'mama', 5, 0)], w)).toBe('b');
    expect(greetedBy([beaver('a', 'mama', 50, 0)], w)).toBeNull();
  });
});

describe('handing food over', () => {
  const holding = { ...world(), carry: 'branch' as const };
  it('gives the piece to a beaver with an empty mouth close by, and the family trusts more', () => {
    const r = giveFamily(holding, [beaver('f', 'mama', GIVE_REACH - 1, 0)]);
    expect(r?.family).toBe('f');
    expect(r?.kind).toBe('branch');
    expect(r?.world.carry).toBeNull();
    expect(familyTrust(r!.world, 'f')).toBeCloseTo(FAMILY_START_TRUST + FEED_TRUST, 5);
  });
  it('does nothing when the mouth is full, the beaver is far, or the player holds nothing', () => {
    expect(takerNear([{ ...beaver('f', 'mama', 1, 0), carry: 'mud' }], holding.beaver)).toBeNull();
    expect(giveFamily(holding, [beaver('f', 'mama', GIVE_REACH + 1, 0)])).toBeNull();
    expect(giveFamily(world(), [beaver('f', 'mama', 1, 0)])).toBeNull();
  });
});

describe('a guest at home (#784)', () => {
  const lodge = { x: 40, z: -12 };
  it('learns its home only while it is inside, and keeps it after coming out', () => {
    expect(homeLearned(null, { inside: true, home: lodge })).toEqual(lodge);
    expect(homeLearned(lodge, { inside: false })).toEqual(lodge);
    expect(homeLearned(lodge, undefined)).toEqual(lodge);
  });

  it('knows nothing of a home when it never went inside', () => {
    expect(homeLearned(null, { inside: false, home: lodge })).toBeNull();
    expect(homeLearned(null, { inside: true })).toBeNull();
    expect(homeLearned(null, undefined)).toBeNull();
  });

  it('does not alias the view, and a new lodge replaces the old one', () => {
    const learned = homeLearned(null, { inside: true, home: lodge })!;
    expect(learned).not.toBe(lodge);
    expect(homeLearned(learned, { inside: true, home: { x: 5, z: 6 } })).toEqual({ x: 5, z: 6 });
  });

  it('takes the family at that lodge as its own, and no other', () => {
    expect(isOwnFamily({ lodge: { x: 40, z: -12 } }, lodge)).toBe(true);
    expect(isOwnFamily({ lodge: { x: 40, z: -11 } }, lodge)).toBe(false);
    expect(isOwnFamily({ lodge: { x: 41, z: -12 } }, lodge)).toBe(false);
  });

  it('takes every family as new when no home is known, or the family is gone', () => {
    expect(isOwnFamily({ lodge }, null)).toBe(false);
    expect(isOwnFamily(undefined, lodge)).toBe(false);
  });
});
