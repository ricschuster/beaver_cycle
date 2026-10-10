import { describe, expect, it } from 'vitest';
import { DAY_SECONDS } from './clock';
import { HOLE } from './lodge';
import { TALK_RANGE, buildIsFree, nearestSpeaker, pickLine, speakersOf, type Speaker } from './talk';
import { createWorld } from './state';
import type { Terrain } from './terrain';

const land: Terrain = { heightAt: () => 0, isWater: () => false, waterDepth: () => 0 };
const speaker = (id: string, kind: Speaker['kind'], x: number, z: number): Speaker => ({ id, name: id, kind, family: null, x, z });
const noon = 0.5 * DAY_SECONDS;
const ctx = (feeling: 'wary' | 'calm' | 'curious', seed = 0) => ({ feeling, season: 'spring' as const, clock: noon, seed });

describe('nearestSpeaker', () => {
  it('finds the nearest one in reach, or none', () => {
    const list = [speaker('a', 'kit', 5, 0), speaker('b', 'mama', 2, 0), speaker('c', 'papa', 50, 0)];
    expect(nearestSpeaker(list, { x: 0, z: 0 })?.id).toBe('b');
    expect(nearestSpeaker([speaker('c', 'papa', TALK_RANGE + 1, 0)], { x: 0, z: 0 })).toBeNull();
  });
});

describe('pickLine', () => {
  it('is the same for the same inputs', () => {
    expect(pickLine({ id: 'k', kind: 'kit' }, ctx('calm', 3))).toBe(pickLine({ id: 'k', kind: 'kit' }, ctx('calm', 3)));
  });

  it('has a line for every kind and the feelings it can have', () => {
    for (const kind of ['mama', 'papa', 'kit'] as const) for (const f of ['wary', 'calm', 'curious'] as const) expect(pickLine({ id: 'x', kind }, ctx(f)).length).toBeGreaterThan(0);
    for (const kind of ['home-mama', 'home-papa', 'partner'] as const) expect(pickLine({ id: 'x', kind }, ctx('curious')).length).toBeGreaterThan(0);
  });

  it('only warns when wary, and varies over talks otherwise', () => {
    const wary = new Set(Array.from({ length: 20 }, (_, i) => pickLine({ id: 'm', kind: 'mama' }, ctx('wary', i))));
    expect([...wary].every((l) => ['Hmm. Who are you?', 'Stay back, please.'].includes(l))).toBe(true);
    const calm = new Set(Array.from({ length: 20 }, (_, i) => pickLine({ id: 'm', kind: 'mama' }, ctx('calm', i))));
    expect(calm.size).toBeGreaterThan(2);
  });

  it('speaks of the night after dark', () => {
    const lines = new Set(Array.from({ length: 30 }, (_, i) => pickLine({ id: 'p', kind: 'papa' }, { ...ctx('calm', i), clock: 0.95 * DAY_SECONDS })));
    expect([...lines].some((l) => /owls|Quiet/.test(l))).toBe(true);
  });
});

describe('speakersOf', () => {
  it('lists neighbours, both parents, and partners that are not alone', () => {
    const n = [{ id: 'f:mama', name: 'Hazel', family: 'f', role: 'mama' as const, x: 1, z: 1 }];
    const parents = [{ id: 'mama', x: 2, z: 2, inside: false }, { id: 'papa', x: 3, z: 3, inside: true }];
    const partners = [{ id: 'p1', x: 4, z: 4, state: 'following' as const }, { id: 'p2', x: 5, z: 5, state: 'alone' as const }];
    const list = speakersOf(n, parents, partners, () => 'Reed');
    expect(list.map((s) => s.kind)).toEqual(['mama', 'home-mama', 'home-papa', 'partner']);
    expect(list[0]!.name).toBe('Hazel');
    expect(list[3]!.name).toBe('Reed');
  });
});

describe('buildIsFree', () => {
  it('is free in the open and busy with a log, a load, or at the water hole of the lodge', () => {
    const w = createWorld(land, 0, 0);
    expect(buildIsFree(w)).toBe(true);
    expect(buildIsFree({ ...w, drag: 'log' })).toBe(false);
    expect(buildIsFree({ ...w, haul: { kind: 'mud' } })).toBe(false);
    const lodge = { x: 10, z: 10 } as unknown as NonNullable<typeof w.lodge>;
    const inside = { ...w, inLodge: true, lodge, beaver: { ...w.beaver, x: 10 + HOLE.x, z: 10 + HOLE.z } };
    expect(buildIsFree(inside)).toBe(false);
    expect(buildIsFree({ ...inside, beaver: { ...inside.beaver, x: 10 + 4, z: 10 + 4 } })).toBe(true);
  });
});
