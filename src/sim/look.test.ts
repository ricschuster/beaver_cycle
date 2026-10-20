import { describe, expect, it } from 'vitest';
import { flatTerrain } from './terrain';
import { chooseLook, createWorld } from './state';
import { decodeSave, encodeSave } from '../persist/save';
import { DEFAULT_LOOK, SHADE_STEPS, cleanLook, furChoices, nearestShade } from './look';

describe('look', () => {
  it('offers 25 different furs: five browns in five shades', () => {
    const furs = furChoices();
    expect(furs).toHaveLength(25);
    expect(new Set(furs.map((f) => `${f.coat}:${f.shade}`)).size).toBe(25);
  });

  it('puts a kit shade on the nearest step', () => {
    expect(nearestShade(0.2)).toBe(0);
    expect(nearestShade(0.4)).toBe(0.5);
    expect(nearestShade(-0.9)).toBe(-1);
    for (const s of SHADE_STEPS) expect(nearestShade(s)).toBe(s);
  });

  it('keeps every choice in range, whatever it is given', () => {
    expect(cleanLook({ hat: 99, scarf: -1, tail: 1.5, name: 'Maple' })).toEqual({ hat: 0, scarf: 0, tail: 0, name: 'Maple' });
    expect(cleanLook(undefined)).toEqual(DEFAULT_LOOK);
  });

  it('sets the fur and look of the player beaver, and a save keeps them', () => {
    const fresh = createWorld(flatTerrain(), 0, 0);
    const w = chooseLook(fresh, { coat: 3, shade: -0.5 }, { hat: 2, scarf: 4, tail: 1, name: 'Maple' });
    expect(w.coat).toEqual({ coat: 3, shade: -0.5 });
    const back = decodeSave(encodeSave(w, { on: false, stage: null, state: null }, 1), fresh)!.world;
    expect(back.look).toEqual({ hat: 2, scarf: 4, tail: 1, name: 'Maple' });
    expect(back.coat).toEqual({ coat: 3, shade: -0.5 });
  });

  it('gives an old save without a look the plain one', () => {
    const fresh = createWorld(flatTerrain(), 0, 0);
    const { look: _look, ...old } = fresh;
    const back = decodeSave(JSON.stringify({ version: 1, savedAt: 1, world: old, coach: { on: false, stage: null, state: null } }), fresh)!.world;
    expect(back.look).toEqual(DEFAULT_LOOK);
  });
});
