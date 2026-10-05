import { describe, expect, it } from 'vitest';
import { noActions } from '../actions/actions';
import { flatTerrain, type Terrain } from './terrain';
import { SLAP_COOLDOWN, DIVE_FLOOR, DIVE_MIN_DEPTH, DIVE_RATE, DIVE_SPEED, SWIM_ENTER_DEPTH, SWIM_EXIT_DEPTH, SWIM_SINK, SWIM_SPEED, WALK_SPEED, createWorld, setSpeedMultiplier, teleport } from './state';
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

  describe('swimming', () => {
    // A lake from z = 10 southward, 1 m deep, at level 100, over a bed at 99.
    const lake = (depthAt: (z: number) => number): Terrain => ({
      heightAt: (_x, z) => 100 - depthAt(z),
      isWater: (_x, z) => depthAt(z) > 0,
      waterDepth: (_x, z) => depthAt(z),
    });
    const deep = lake((z) => (z >= 10 ? 1 : 0));

    it('walks on dry land and swims in deep water', () => {
      expect(createWorld(deep, 0, 0).beaver.mode).toBe('walk');
      expect(createWorld(deep, 0, 20).beaver.mode).toBe('swim');
    });

    it('swims faster than it walks', () => {
      const w = step(createWorld(deep, 0, 20), { move: { x: 0, z: 1 } }, 1, deep);
      expect(w.beaver.z - 20).toBeCloseTo(SWIM_SPEED);
      expect(SWIM_SPEED).toBeGreaterThan(WALK_SPEED);
    });

    it('floats just below the water surface, not on the bed', () => {
      const w = createWorld(deep, 0, 20);
      expect(w.beaver.y).toBeCloseTo(100 - SWIM_SINK);
    });

    it('wades through shallows without swimming', () => {
      const shallow = lake(() => SWIM_ENTER_DEPTH - 0.1);
      const w = step(createWorld(shallow), { move: { x: 0, z: 1 } }, 1, shallow);
      expect(w.beaver.mode).toBe('walk');
      expect(w.beaver.y).toBeCloseTo(100 - (SWIM_ENTER_DEPTH - 0.1));
    });

    it('starts swimming at one depth and stops at a shallower one', () => {
      const mid = (SWIM_ENTER_DEPTH + SWIM_EXIT_DEPTH) / 2;
      const ramp = lake((z) => (z < 10 ? 0 : z < 20 ? mid : 1));
      expect(createWorld(ramp, 0, 15).beaver.mode).toBe('walk');
      const swimming = step(createWorld(ramp, 0, 25), { move: { x: 0, z: -1 } }, 1.5, ramp);
      expect(swimming.beaver.z).toBeLessThan(20);
      expect(swimming.beaver.mode).toBe('swim');
      const stillSwimming = step(createWorld(ramp, 0, 25), { move: { x: 0, z: -1 } }, 0.5, ramp);
      expect(stillSwimming.beaver.mode).toBe('swim');
    });

    it('leaves the water and walks again on the shore', () => {
      const w = step(createWorld(deep, 0, 11), { move: { x: 0, z: -1 } }, 1, deep);
      expect(w.beaver.mode).toBe('walk');
      expect(w.beaver.y).toBeCloseTo(100);
    });

    it('is swimming after a jump into the water, and walking after a jump to land', () => {
      const w0 = createWorld(deep, 0, 0);
      expect(teleport(w0, deep, 0, 30).beaver.mode).toBe('swim');
      expect(teleport(createWorld(deep, 0, 30), deep, 0, 0).beaver.mode).toBe('walk');
    });
  });

  describe('diving', () => {
    // Water 4 m deep from z = 10 southward, level 100, bed at 96.
    const lake: Terrain = {
      heightAt: (_x, z) => (z >= 10 ? 96 : 100),
      isWater: (_x, z) => z >= 10,
      waterDepth: (_x, z) => (z >= 10 ? 4 : 0),
    };
    const dive = { move: { x: 0, z: 0 }, dive: true };
    const surface = 100 - SWIM_SINK;

    it('sinks at the dive rate while the button is held', () => {
      const w = step(createWorld(lake, 0, 20), dive, 0.5, lake);
      expect(w.beaver.mode).toBe('dive');
      expect(w.beaver.y).toBeCloseTo(surface - DIVE_RATE * 0.5);
    });

    it('stops at the lake bed', () => {
      let w = createWorld(lake, 0, 20);
      for (let i = 0; i < 40; i++) w = step(w, dive, 0.25, lake);
      expect(w.beaver.y).toBeCloseTo(96 + DIVE_FLOOR);
      expect(w.beaver.mode).toBe('dive');
    });

    it('rises when the button is released and swims again at the surface', () => {
      let w = createWorld(lake, 0, 20);
      for (let i = 0; i < 4; i++) w = step(w, dive, 0.25, lake);
      const low = w.beaver.y;
      w = step(w, noActions(), 0.25, lake);
      expect(w.beaver.y).toBeCloseTo(low + DIVE_RATE * 0.25);
      for (let i = 0; i < 20; i++) w = step(w, noActions(), 0.25, lake);
      expect(w.beaver.y).toBeCloseTo(surface);
      expect(w.beaver.mode).toBe('swim');
    });

    it('moves at dive speed under water', () => {
      let w = step(createWorld(lake, 0, 20), dive, 0.5, lake);
      const z0 = w.beaver.z;
      w = step(w, { move: { x: 0, z: 1 }, dive: true }, 1, lake);
      expect(w.beaver.z - z0).toBeCloseTo(DIVE_SPEED);
    });

    it('does not dive in water that is too shallow', () => {
      const shallow: Terrain = { ...lake, waterDepth: () => DIVE_MIN_DEPTH - 0.1, heightAt: () => 100 - (DIVE_MIN_DEPTH - 0.1) };
      const w = step(createWorld(shallow, 0, 20), dive, 1, shallow);
      expect(w.beaver.mode).toBe('swim');
    });

    it('ignores the dive button on dry land', () => {
      const w = step(createWorld(lake, 0, 0), dive, 1, lake);
      expect(w.beaver.mode).toBe('walk');
      expect(w.beaver.y).toBeCloseTo(100);
    });

    it('is pushed up when the bed rises under it', () => {
      let w = createWorld(lake, 0, 20);
      for (let i = 0; i < 40; i++) w = step(w, dive, 0.25, lake);
      // swim north to the shore: the bed climbs to the surface and the beaver walks out
      w = step(w, { move: { x: 0, z: -1 }, dive: true }, 3, lake);
      expect(w.beaver.mode).toBe('walk');
      expect(w.beaver.y).toBeCloseTo(100);
    });
  });

  describe('tail slap', () => {
    const slap = { move: { x: 0, z: 0 }, slap: true };

    it('records when and where the beaver slapped', () => {
      const w0 = teleport(createWorld(flat), flat, 10, 20);
      const w = step(w0, slap, 0.5, flat);
      expect(w.lastSlap).toEqual({ time: 0.5, x: 10, z: 20 });
    });

    it('has no slap before the first', () => {
      expect(step(createWorld(flat), noActions(), 1, flat).lastSlap).toBeNull();
    });

    it('does not slap again during the cooldown, then does', () => {
      let w = step(createWorld(flat), slap, 0.1, flat);
      const first = w.lastSlap;
      w = step(w, slap, SLAP_COOLDOWN / 2, flat);
      expect(w.lastSlap).toBe(first);
      w = step(w, slap, SLAP_COOLDOWN, flat);
      expect(w.lastSlap?.time).toBeGreaterThan(first!.time);
    });

    it('keeps the last slap while the button is not pressed', () => {
      let w = step(createWorld(flat), slap, 0.1, flat);
      const first = w.lastSlap;
      w = step(w, noActions(), 5, flat);
      expect(w.lastSlap).toBe(first);
    });

    it('slaps at the water surface but not under water', () => {
      const lake: Terrain = { heightAt: () => 96, isWater: () => true, waterDepth: () => 4 };
      const surface = step(createWorld(lake), slap, 0.1, lake);
      expect(surface.lastSlap).not.toBeNull();
      let under = createWorld(lake);
      for (let i = 0; i < 4; i++) under = step(under, { move: { x: 0, z: 0 }, dive: true }, 0.25, lake);
      expect(under.beaver.mode).toBe('dive');
      expect(step(under, { move: { x: 0, z: 0 }, dive: true, slap: true }, 0.1, lake).lastSlap).toBeNull();
    });
  });
});
