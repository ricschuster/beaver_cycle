import { describe, expect, it } from 'vitest';
import type { Animal } from './animals';
import { AnimalField } from './animals';
import { DAY_SECONDS } from './clock';
import { noIntent } from './buttons';
import { HURT_SPEED, HURT_TIME, RULES, isMate, hurtFactor, isHurt, meetPredators, predatorAnimals, threatened } from './predators';
import { createWorld, WALK_SPEED, type WorldState } from './state';
import { step } from './step';
import { flatTerrain, type Terrain } from './terrain';

const land = flatTerrain(0);
const fox = (x: number, z: number): Animal => ({ id: 'a:1', kind: 'fox', x, y: 0, z, heading: 0, moving: false });
const owl = (x: number, z: number): Animal => ({ id: 'a:2', kind: 'owl', x, y: 0, z, heading: 0, moving: false });
const lynx = (x: number, z: number): Animal => ({ id: 'a:3', kind: 'lynx', x, y: 0, z, heading: 0, moving: false });
const bear = (x: number, z: number): Animal => ({ id: 'a:4', kind: 'bear', x, y: 0, z, heading: 0, moving: false });
/** Land from x = -3 up; a pond lies west of that. The beaver at the origin stands about 3 m from the water. */
const bank: Terrain = { heightAt: () => 0, isWater: (x) => x < -3, waterDepth: (x) => (x < -3 ? 1 : 0) };

/** Runs the meeting for `seconds` in 0.1 s steps, the beaver standing, and returns the world and all events. */
function run(world: WorldState, animals: Animal[], seconds: number, ground: Terrain = land, slapAt = -1) {
  const events: string[] = [];
  for (let t = 0; t < seconds; t += 0.1) {
    world = { ...world, time: world.time + 0.1 };
    const slapped = slapAt >= 0 && Math.abs(t - slapAt) < 0.05;
    const r = meetPredators(world, animals, slapped, 0.1, ground);
    world = r.world;
    events.push(...r.events.map((e) => `${e.kind}:${e.what}`));
  }
  return { world, events };
}

describe('predators', () => {
  it('notice a beaver on land within their range, and not one far away', () => {
    expect(run(createWorld(land, 0, 0), [fox(10, 0)], 0.1).world.predators).toHaveLength(1);
    expect(run(createWorld(land, 0, 0), [fox(RULES.fox.notice + 5, 0)], 0.1).world.predators).toHaveLength(0);
  });

  it('do not notice a beaver in deep water or in its lodge', () => {
    const lake: Terrain = { heightAt: () => 0, isWater: () => true, waterDepth: () => 3, };
    expect(run(createWorld(lake, 0, 0), [fox(10, 0)], 1, lake).world.predators).toHaveLength(0);
    expect(run({ ...createWorld(land, 0, 0), inLodge: true }, [fox(10, 0)], 1).world.predators).toHaveLength(0);
  });

  it('warn first, then chase, and catch a beaver that stands still: it drops what it carries and is hurt', () => {
    const w0 = { ...createWorld(land, 0, 0), carry: 'branch' as const, drag: 'log:1', clock: 100 };
    const start = run(w0, [fox(12, 0)], 0.2);
    expect(start.world.predators[0]!.phase).toBe('warn');
    expect(start.events).toEqual(['fox:noticed']);
    const end = run(start.world, [fox(12, 0)], 5);
    expect(end.events).toContain('fox:caught');
    expect(end.world.carry).toBeNull();
    expect(end.world.drag).toBeNull();
    expect(end.world.dropped).toHaveLength(1);
    expect(end.world.hurtAt).toBe(100);
    // After it caught the beaver the fox walks off and does not catch it again.
    expect(end.world.predators[0]!.phase).toBe('off');
    expect(run(end.world, [fox(12, 0)], 20).events.filter((e) => e === 'fox:caught')).toHaveLength(0);
  });

  it('lose the beaver when it gets into the water', () => {
    const start = run(createWorld(land, 0, 0), [fox(12, 0)], 1).world;
    expect(start.predators[0]!.phase).toBe('chase');
    const swimming = { ...start, beaver: { ...start.beaver, mode: 'swim' as const } };
    const r = run(swimming, [fox(12, 0)], 1);
    expect(r.world.predators[0]!.phase).toBe('off');
    expect(r.world.hurtAt).toBeNull();
  });

  it('are scared off by a tail slap within range', () => {
    const start = run(createWorld(land, 0, 0), [fox(12, 0)], 1).world;
    const r = run(start, [fox(12, 0)], 0.5, land, 0.2);
    expect(r.events).toContain('fox:scared');
    expect(r.world.predators[0]!.phase).toBe('off');
    expect(r.world.hurtAt).toBeNull();
  });

  it('let a beaver that keeps walking away outrun a fox', () => {
    let w = createWorld(land, 0, 0);
    w = run(w, [fox(10, 0)], 1).world;
    const start = w.predators[0]!;
    // The beaver runs west at the walking speed for a few seconds.
    for (let i = 0; i < 40; i++) {
      w = step({ ...w, predators: w.predators }, { ...noIntent(), move: { x: -1, z: 0 } }, 0.1, land);
      w = meetPredators(w, [fox(10, 0)], false, 0.1, land).world;
    }
    const fox2 = w.predators[0]!;
    expect(Math.hypot(fox2.x - w.beaver.x, fox2.z - w.beaver.z)).toBeGreaterThan(Math.hypot(start.x - 0, start.z - 0) - 1);
    expect(w.hurtAt).toBeNull();
  });

  it('give the owl a longer sign and a swoop from above', () => {
    const w = run(createWorld(land, 0, 0), [owl(20, 0)], 1).world;
    expect(w.predators[0]!.phase).toBe('warn');
    const swoop = run(w, [owl(20, 0)], 2).world;
    expect(swoop.predators[0]!.phase).toBe('chase');
    expect(predatorAnimals(swoop.predators, land)[0]!.y).toBeGreaterThan(0.3);
  });

  it('draw a predator once: its ambient animal is replaced by the predator', () => {
    const w = run(createWorld(land, 0, 0), [fox(12, 0)], 0.1).world;
    expect(predatorAnimals(w.predators, land).map((a) => a.id)).toEqual(['a:1']);
  });

  it('lift the owl gradually during its sign, so it does not jump up when the chase begins', () => {
    const w1 = run(createWorld(land, 0, 0), [owl(25, 0)], 1).world;
    const w2 = run(w1, [owl(25, 0)], 1).world;
    expect(w1.predators[0]!.phase).toBe('warn');
    expect(w2.predators[0]!.lift).toBeGreaterThan(w1.predators[0]!.lift);
    expect(w2.predators[0]!.lift).toBeLessThan(7);
  });

  it('put owls in the field only at night', () => {
    const field = new AnimalField();
    const kinds = (clock: number) => new Set(field.near(land, 0, 0, clock, 500, 600).map((a) => a.kind));
    expect(kinds(DAY_SECONDS * 0.3).has('owl')).toBe(false);
    expect(kinds(DAY_SECONDS * 0.8).has('owl')).toBe(true);
  });
});

describe('lynx and bear', () => {
  it('stalk: the lynx creeps closer during its sign, then rushes faster than a beaver walks', () => {
    const w = run(createWorld(land, 0, 0), [lynx(24, 0)], 2).world;
    expect(w.predators[0]!.phase).toBe('warn');
    expect(w.predators[0]!.x).toBeLessThan(24 - 2);
    expect(RULES.lynx.chase).toBeGreaterThan(WALK_SPEED);
    const rush = run(w, [lynx(24, 0)], 2).world;
    expect(rush.predators[0]!.phase === 'chase' || rush.hurtAt !== null).toBe(true);
  });

  it('are scared by a slap from the water edge, but the lynx is not scared by one far from the water', () => {
    const seen = (animal: Animal, ground: Terrain) => {
      const start = run(createWorld(ground, 0, 0), [animal], 3.2, ground).world;
      return run(start, [animal], 0.4, ground, 0.2).events;
    };
    expect(seen(lynx(14, 0), bank)).toContain('lynx:scared');
    expect(seen(lynx(14, 0), land)).not.toContain('lynx:scared');
    // The bear and the fox do not need the water.
    expect(seen(bear(14, 0), land)).toContain('bear:scared');
  });

  it('keep the bear too slow to catch a beaver that keeps walking, and the lynx and the bear out of the water', () => {
    expect(RULES.bear.chase).toBeLessThan(WALK_SPEED * 0.6);
    let w = run(createWorld(bank, 0, 0), [lynx(14, 0)], 3.2, bank).world;
    for (let i = 0; i < 20; i++) w = meetPredators({ ...w, time: w.time + 0.1 }, [lynx(14, 0)], false, 0.1, bank).world;
    expect(w.predators.every((p) => bank.waterDepth(p.x, p.z) < 0.4)).toBe(true);
  });

  it('put the lynx out from the middle of the afternoon and the bear out from spring to autumn', () => {
    const field = new AnimalField();
    const kinds = (clock: number) => new Set(field.near(land, 0, 0, clock, 2000, 1500).map((a) => a.kind));
    expect(kinds(DAY_SECONDS * 0.3).has('lynx')).toBe(false);
    expect(kinds(DAY_SECONDS * 0.8).has('lynx')).toBe(true);
    expect(kinds(DAY_SECONDS * 0.3).has('bear')).toBe(true);
    expect(kinds(DAY_SECONDS * 35.3).has('bear')).toBe(false);
  });
});

describe('hurt', () => {
  it('slows the beaver until a day has passed', () => {
    expect(hurtFactor(100, 100)).toBe(HURT_SPEED);
    expect(isHurt(100, 100 + HURT_TIME - 1)).toBe(true);
    expect(isHurt(100, 100 + HURT_TIME)).toBe(false);
    const go = (hurtAt: number | null): number => {
      const w = step({ ...createWorld(land, 0, 0), hurtAt, clock: 100 }, { ...noIntent(), move: { x: 1, z: 0 } }, 1, land);
      return w.beaver.x;
    };
    expect(go(100)).toBeCloseTo(go(null) * HURT_SPEED, 5);
    expect(go(null)).toBeGreaterThan(WALK_SPEED * 0.5);
  });

  it('is healed by eating a lily pad in the lodge', () => {
    const w = { ...createWorld(land, 0, 0), hurtAt: 100, clock: 200, carry: 'lily' as const, inLodge: true };
    expect(step(w, { ...noIntent(), do: 'eat' }, 0.1, land).hurtAt).toBeNull();
    expect(step({ ...w, carry: 'branch' }, { ...noIntent(), do: 'eat' }, 0.1, land).hurtAt).toBe(100);
  });
});

describe('the wolf pair', () => {
  const wolf = (x: number, z: number): Animal => ({ id: 'a:5', kind: 'wolf', x, y: 0, z, heading: 0, moving: false });

  it('comes as two, and tells of one', () => {
    const { world, events } = run(createWorld(land, 0, 0), [wolf(20, 0)], 0.1);
    expect(world.predators).toHaveLength(2);
    expect(world.predators.filter(isMate)).toHaveLength(1);
    expect(events.filter((e) => e === 'wolf:noticed')).toHaveLength(1);
  });

  it('both chase, and a catch is told once', () => {
    const { world, events } = run(createWorld(land, 0, 0), [wolf(20, 0)], 12);
    expect(events.filter((e) => e === 'wolf:caught')).toHaveLength(1);
    expect(world.hurtAt).not.toBeNull();
    expect(world.predators.every((p) => p.phase === 'off')).toBe(true);
  });

  it('both go off when slapped from the water', () => {
    const { world, events } = run(createWorld(bank, 0, 0), [wolf(20, 0)], 1, bank, 0.5);
    expect(events.filter((e) => e === 'wolf:scared')).toHaveLength(1);
    expect(world.predators.every((p) => p.phase === 'off')).toBe(true);
  });

  it('the other kinds come alone', () => {
    expect(run(createWorld(land, 0, 0), [lynx(20, 0)], 0.1).world.predators).toHaveLength(1);
  });
});

describe('sleeping out (#661)', () => {
  it('is threatened by a predator within 100 m, not by a far one or a deer', () => {
    const w = createWorld(land);
    expect(threatened(w, [])).toBe(false);
    expect(threatened(w, [fox(60, 0)])).toBe(true);
    expect(threatened(w, [fox(150, 0)])).toBe(false);
    expect(threatened(w, [{ ...fox(10, 0), kind: 'deer' }])).toBe(false);
  });
});
