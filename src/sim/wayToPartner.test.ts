import { describe, expect, it } from 'vitest';
import { newsFor } from './news';
import type { Partner } from './partners';
import { createWorld, type WorldState } from './state';
import type { Terrain } from './terrain';
import { DOT_COUNT, DOT_START, POINTER_DONE, POINTER_TIME, farWord, hillWord, loneBeaverWay, pointerDots, pointerTarget, sideWord, startPointer, wayWords } from './wayToPartner';

const land: Terrain = { heightAt: () => 0, isWater: () => false, waterDepth: () => 0 };
const alone = (id: string, x: number, z: number): Partner => ({ id, x, z, heading: 0, coat: 0, shade: 0, state: 'alone', metAt: null, homeAt: null });
const spot = (id: string, x: number, z: number, bedY: number) => ({ id, bed: { x, z }, bedY, flow: { x: 1, z: 0 }, maxCrest: 2, pondM2: 500 });
/** A world with the beaver at the origin facing +z, and the lone beavers given. */
const worldWith = (partners: Partner[], extra: Partial<WorldState> = {}): WorldState => ({ ...createWorld(land, 0, 0), partners, ...extra });

describe('the words for which way', () => {
  it('reads from where the player looks: ahead, behind, left (+x when looking along +z) and right', () => {
    expect(sideWord(0, 100, 0)).toBe('straight ahead');
    expect(sideWord(0, -100, 0)).toBe('behind you');
    expect(sideWord(100, 0, 0)).toBe('to your left');
    expect(sideWord(-100, 0, 0)).toBe('to your right');
    // Turned round, looking along -z, the same points swap.
    expect(sideWord(0, -100, Math.PI)).toBe('straight ahead');
    expect(sideWord(100, 0, Math.PI)).toBe('to your right');
  });

  it('says how far as a kid would', () => {
    expect(farWord(80)).toBe('close by');
    expect(farWord(300)).toBe('a little swim away');
    expect(farWord(1200)).toBe('a long way off');
  });

  it('says up or down the hill only when the climb is clear', () => {
    expect(hillWord(590, 640)).toBe('up the hill');
    expect(hillWord(640, 590)).toBe('down the hill');
    expect(hillWord(590, 598)).toBeNull();
  });
});

describe('where a lone beaver lives', () => {
  it('puts the hill, the side and the distance together', () => {
    const w = worldWith([alone('partner:s1', 600, 0)], { spots: [spot('s1', 600, 0, 60)] });
    expect(wayWords(w, w.partners[0]!, 0)).toBe('up the hill to your left, a long way off');
    const flat = worldWith([alone('partner:s2', 0, -300)], { spots: [spot('s2', 0, -300, 2)] });
    expect(wayWords(flat, flat.partners[0]!, 0)).toBe('behind you, a little swim away');
  });

  it('names a family the player has met when the lone beaver lives near it', () => {
    const base = worldWith([alone('partner:s1', 0, -400)]);
    const fam = { id: 'family:a', lodge: { x: 30, z: -420, base: 0, door: 0, wood: 10 }, parents: [{ coat: 0, shade: 0 }, { coat: 1, shade: 0 }] as const, seed: 1 };
    const w = { ...base, neighbours: [fam], met: { 'family:a:mama': { talks: 1, last: 0 } } };
    expect(wayWords(w, w.partners[0]!, 0)).toBe('near the north pond family, a little swim away');
    // A family not met yet means nothing to the player.
    expect(wayWords({ ...w, met: {} }, w.partners[0]!, 0)).toBe('behind you, a little swim away');
  });

  it('tells it in the news with no compass point and no metres', () => {
    const w = worldWith([alone('partner:s1', 0, 900)]);
    const line = newsFor(w, { pad: null, predator: null }).at(-1)!;
    expect(line).toBe('A lone beaver lives straight ahead, a long way off. Follow the sparkles!');
    expect(line).not.toMatch(/north|south|east|west|\d+ ?m\b/);
  });

  it('is silent when a partner already follows', () => {
    expect(loneBeaverWay(worldWith([{ ...alone('a', 10, 0), state: 'following' }, alone('b', 300, 0)]), 0)).toBeNull();
  });
});

describe('the sparkles toward a lone beaver', () => {
  const w = worldWith([alone('p', 0, 200)], { time: 10 });

  it('point at the beaver until the time is up', () => {
    const p = startPointer('p', 10);
    expect(pointerTarget(p, w)).toEqual({ x: 0, z: 200 });
    expect(pointerTarget(p, { ...w, time: 10 + POINTER_TIME - 1 })).not.toBeNull();
    expect(pointerTarget(p, { ...w, time: 10 + POINTER_TIME })).toBeNull();
    expect(pointerTarget(null, w)).toBeNull();
  });

  it('end when the player is close or the beaver no longer waits alone', () => {
    const p = startPointer('p', 10);
    expect(pointerTarget(p, { ...w, beaver: { ...w.beaver, z: 200 - POINTER_DONE + 1 } })).toBeNull();
    expect(pointerTarget(p, { ...w, partners: [{ ...w.partners[0]!, state: 'following' }] })).toBeNull();
    expect(pointerTarget(p, { ...w, partners: [] })).toBeNull();
  });

  it('lie a step apart on the way, on the ground or the water, never past the beaver', () => {
    const wet: Terrain = { heightAt: () => 5, isWater: () => true, waterDepth: () => 1 };
    const dots = pointerDots({ x: 0, z: 0 }, { x: 100, z: 0 }, wet);
    expect(dots).toHaveLength(DOT_COUNT);
    expect(dots[0]!.x).toBeCloseTo(DOT_START);
    expect(dots[0]!.z).toBeCloseTo(0);
    expect(dots.every((d) => d.y > 6 && d.y < 7)).toBe(true);
    expect(dots.every((d, i) => i === 0 || d.x > dots[i - 1]!.x)).toBe(true);
    expect(pointerDots({ x: 0, z: 0 }, { x: 6, z: 0 }, wet).every((d) => d.x < 6)).toBe(true);
  });
});
