import { describe, expect, it } from 'vitest';
import { DAY_SECONDS } from './clock';
import { LODGE_WOOD, NEST, SOLID_RADIUS, lodgeCondition } from './lodge';
import { newWear } from './wear';
import { createWorld, type WorldState, intoLodge, leaveHome, birth, kitDue, setClock, setStage, setInLodge, sleep, sleepUntil } from './state';
import { flatTerrain } from './terrain';
import { step } from './step';
import { noIntent, type Intent } from './buttons';
import { nextSeasonStart, nextSpringStart } from './clock';
import { CALL_BAND, isCalledBack, softEdge, BABY_DAYS, growUpDawn, STAGE_RULES, TEENAGER_DAYS, bornAtFor, lifeAt, stageAt, stageStart } from './life';

const d = (days: number) => days * DAY_SECONDS;

describe('life stages', () => {
  it('starts as a baby', () => {
    expect(lifeAt(d(5), d(5))).toMatchObject({ stage: 'baby', ageDays: 0, progress: 0 });
  });

  it('becomes a teenager after the baby days, and an adult after the teenager days', () => {
    expect(stageAt(d(BABY_DAYS) - 1, 0)).toBe('baby');
    expect(stageAt(d(BABY_DAYS), 0)).toBe('teenager');
    expect(stageAt(d(BABY_DAYS + TEENAGER_DAYS) - 1, 0)).toBe('teenager');
    expect(stageAt(d(BABY_DAYS + TEENAGER_DAYS), 0)).toBe('adult');
  });

  it('reports progress and days left within a stage', () => {
    const info = lifeAt(d(BABY_DAYS / 2), 0);
    expect(info.progress).toBeCloseTo(0.5);
    expect(info.daysLeft).toBeCloseTo(BABY_DAYS / 2);
    expect(lifeAt(d(1000), 0)).toMatchObject({ stage: 'adult', progress: 0, daysLeft: Infinity });
  });

  it('treats a clock before birth as age zero', () => {
    expect(lifeAt(0, d(3))).toMatchObject({ stage: 'baby', ageDays: 0 });
  });

  it('bornAtFor puts a beaver at the start of the stage', () => {
    for (const stage of ['baby', 'teenager', 'adult'] as const) {
      const clock = d(100);
      const bornAt = bornAtFor(clock, stage);
      expect(stageAt(clock, bornAt)).toBe(stage);
      expect(stageStart(bornAt, stage)).toBe(clock);
    }
  });
});

describe('life in the world', () => {
  const world = createWorld(flatTerrain(0));

  it('starts a new game as an adult', () => {
    expect(lifeAt(world.clock, world.bornAt).stage).toBe('adult');
  });

  it('setStage puts the beaver at the start of a stage', () => {
    const baby = setStage(world, 'baby');
    expect(lifeAt(baby.clock, baby.bornAt)).toMatchObject({ stage: 'baby', ageDays: 0 });
    expect(lifeAt(setStage(world, 'teenager').clock, setStage(world, 'teenager').bornAt).stage).toBe('teenager');
  });

  it('a test jump of the clock does not change the age', () => {
    const baby = setStage(world, 'baby');
    const jumped = setClock(baby, baby.clock + d(100));
    expect(lifeAt(jumped.clock, jumped.bornAt).stage).toBe('baby');
  });

  it('sleeping through the night ages the beaver', () => {
    const night = { ...setInLodge(setStage(world, 'baby'), true), clock: 0.8 * DAY_SECONDS };
    const woke = sleep(night);
    expect(woke.clock).toBeGreaterThan(night.clock);
    expect(lifeAt(woke.clock, woke.bornAt).progress).toBeGreaterThan(lifeAt(night.clock, night.bornAt).progress);
  });
});

describe('stage rules', () => {
  const flat = flatTerrain(0);
  const fwd = { ...noIntent(), move: { x: 0, z: 1 } };
  const run = (w: ReturnType<typeof createWorld>, a = fwd, secs = 1) => {
    for (let i = 0; i < secs * 10; i++) w = step(w, a, 0.1, flat);
    return w;
  };

  it('a baby walks slower than an adult, and a teenager in between', () => {
    const at = (stage: 'baby' | 'teenager' | 'adult') => run(setStage(createWorld(flat), stage)).beaver.z;
    expect(at('baby')).toBeLessThan(at('teenager'));
    expect(at('teenager')).toBeLessThan(at('adult'));
  });

  it('a baby cannot put down a load, an adult can', () => {
    const grab: Intent = { ...noIntent(), take: 'drop' };
    const load = { ...createWorld(flat), haul: { kind: 'mud' as const } };
    expect(step(setStage(load, 'baby'), grab, 0.1, flat).haul).not.toBeNull();
    expect(step(load, grab, 0.1, flat).haul).toBeNull();
  });

  it('a baby stays within range of its lodge', () => {
    const lodge = { x: 0, z: 0, base: 0, door: 0, wood: 99 };
    const baby = setStage({ ...createWorld(flat), lodge }, 'baby');
    const w = run(baby, fwd, 30);
    expect(Math.hypot(w.beaver.x, w.beaver.z)).toBeLessThanOrEqual(STAGE_RULES.baby.range + 1e-6);
    const adult = run({ ...createWorld(flat), lodge }, fwd, 30);
    expect(Math.hypot(adult.beaver.x, adult.beaver.z)).toBeGreaterThan(STAGE_RULES.baby.range);
  });
});

describe('sleeping ahead', () => {
  const home = (stage: 'baby' | 'teenager' | 'adult') => setInLodge(setStage({ ...createWorld(flatTerrain(0)), clock: d(3.3) }, stage), true);

  it('a baby sleeps until the dawn it grows up, and wakes a teenager', () => {
    const w = sleepUntil(home('baby'), 'grow');
    expect(w.clock % DAY_SECONDS).toBe(0);
    expect(w.clock).toBeGreaterThanOrEqual(stageStart(w.bornAt, 'teenager'));
    expect(w.clock - stageStart(w.bornAt, 'teenager')).toBeLessThan(DAY_SECONDS);
    expect(stageAt(w.clock, w.bornAt)).toBe('teenager');
  });

  it('a teenager sleeps until adult, and an adult has no growing up to sleep to', () => {
    const t = sleepUntil(home('teenager'), 'grow');
    expect(stageAt(t.clock, t.bornAt)).toBe('adult');
    const a = home('adult');
    expect(sleepUntil(a, 'grow')).toBe(a);
    expect(growUpDawn(a.clock, a.bornAt)).toBeNull();
  });

  it('sleeps until the next season at dawn, at any hour', () => {
    const w = home('adult');
    const next = sleepUntil(w, 'season');
    expect(next.clock).toBe(nextSeasonStart(w.clock));
    expect(next.clock).toBe(d(10));
  });

  it('does nothing outside the lodge', () => {
    const out = setInLodge(home('baby'), false);
    expect(sleepUntil(out, 'season')).toBe(out);
  });
});

describe('the soft edge', () => {
  const range = 60;

  it('leaves steps inside the band and steps toward home alone', () => {
    expect(softEdge(10, 11, range)).toBe(11);
    expect(softEdge(59, 58, range)).toBe(58);
  });

  it('shrinks outward steps in the band and stops at the range', () => {
    const start = range - CALL_BAND;
    const kept = softEdge(start + 6, start + 7, range);
    expect(kept).toBeGreaterThan(start + 6);
    expect(kept).toBeLessThan(start + 7);
    expect(softEdge(range, range + 1, range)).toBe(range);
  });

  it('is called back only in the band, and never for an adult', () => {
    expect(isCalledBack(range - CALL_BAND - 1, range)).toBe(false);
    expect(isCalledBack(range - 1, range)).toBe(true);
    expect(isCalledBack(1000, Infinity)).toBe(false);
  });
});

describe('a baby keeps to the water', () => {
  // Water north of z = 10 (a metre deep), dry land south of it.
  const shore = { heightAt: (_x: number, z: number) => (z < 10 ? -1 : 0), isWater: (_x: number, z: number) => z < 10, waterDepth: (_x: number, z: number) => (z < 10 ? 1 : 0) };
  const swimmer = (stage: 'baby' | 'teenager') => setStage(createWorld(shore, 0, 0), stage);
  const go = (w: ReturnType<typeof createWorld>, move: { x: number; z: number }) => {
    for (let i = 0; i < 100; i++) w = step(w, { ...noIntent(), move }, 0.1, shore);
    return w;
  };

  it('stops at the shore, where a teenager walks ashore', () => {
    expect(swimmer('baby').beaver.mode).toBe('swim');
    expect(go(swimmer('baby'), { x: 0, z: 1 }).beaver.z).toBeLessThan(10);
    expect(go(swimmer('teenager'), { x: 0, z: 1 }).beaver.z).toBeGreaterThan(10);
  });

  it('slides along the shore', () => {
    const w = go(swimmer('baby'), { x: 1, z: 1 });
    expect(w.beaver.x).toBeGreaterThan(5);
    expect(w.beaver.z).toBeLessThan(10);
    expect(w.beaver.mode).toBe('swim');
  });
});

describe('a baby is born in the lodge', () => {
  const lodge = { x: 20, z: 30, base: 2, door: 0, wood: LODGE_WOOD };

  it('puts the beaver on its nest inside', () => {
    const w = intoLodge({ ...createWorld(flatTerrain(0)), lodge });
    expect(w.inLodge).toBe(true);
    expect(w.beaver).toMatchObject({ x: lodge.x + NEST.x, z: lodge.z + NEST.z, y: 2, mode: 'walk' });
  });

  it('leaves the beaver where it is without a whole lodge', () => {
    const none = createWorld(flatTerrain(0));
    expect(intoLodge(none)).toBe(none);
    const part = { ...none, lodge: { ...lodge, wood: 1 } };
    expect(intoLodge(part)).toBe(part);
  });
});

describe('leaving home', () => {
  const home = { x: 0, z: 20, base: 0, door: 0, wood: LODGE_WOOD };

  it('moves the lodge to the former homes and empties the store', () => {
    const w = leaveHome({ ...createWorld(flatTerrain(0)), lodge: home });
    expect(w.lodge).toBeNull();
    expect(w.formerHomes).toEqual([{ ...home, parents: w.parentCoats }]);
    expect(w.store).toEqual(createWorld(flatTerrain(0)).store);
    expect(w.storeWear).toBeUndefined();
  });

  it('leaves the old lodge kept up by the parents who live there, however worn it was', () => {
    const worn = { ...home, wear: newWear(-200 * DAY_SECONDS) };
    const w = leaveHome({ ...createWorld(flatTerrain(0)), lodge: worn });
    expect(w.formerHomes[0]?.wear).toBeUndefined();
    expect(lodgeCondition(w.formerHomes[0]!, 1000 * DAY_SECONDS)).toBe(1);
  });

  it('puts a sleeper out at the door', () => {
    const inside = intoLodge({ ...createWorld(flatTerrain(0)), lodge: home });
    const w = leaveHome(inside);
    expect(w.inLodge).toBe(false);
    expect(Math.hypot(w.beaver.x - home.x, w.beaver.z - home.z)).toBeGreaterThan(SOLID_RADIUS);
  });

  it('does nothing without a lodge', () => {
    const w = createWorld(flatTerrain(0));
    expect(leaveHome(w)).toBe(w);
  });

  it('keeps the old lodge solid', () => {
    const w = leaveHome({ ...createWorld(flatTerrain(0), 0, home.z - SOLID_RADIUS - 3), lodge: home });
    let s = { ...w, beaver: { ...w.beaver, heading: 0 } };
    for (let i = 0; i < 100; i++) s = step(s, { ...noIntent(), move: { x: 0, z: 1 } }, 0.1, flatTerrain(0));
    expect(Math.hypot(s.beaver.x - home.x, s.beaver.z - home.z)).toBeGreaterThanOrEqual(SOLID_RADIUS - 0.01);
  });
});

describe('a kit is born', () => {
  const home = { x: 0, z: 0, base: 0, door: 0, wood: LODGE_WOOD };
  const mate = { id: 'm', x: 0, z: 0, heading: 0, coat: 2, shade: 0.3, state: 'home' as const, metAt: 1, homeAt: 100 };
  const grown = (): WorldState => ({ ...createWorld(flatTerrain(0)), lodge: home, partners: [mate], coat: { coat: 0, shade: 0.1 } });

  it('is not due before the first day of spring after the partner moved in', () => {
    expect(kitDue({ ...grown(), clock: nextSpringStart(100) - 1 })).toBe(false);
    expect(kitDue({ ...grown(), clock: nextSpringStart(100) })).toBe(true);
  });

  it('is not due with no partner at home, or no whole lodge', () => {
    const late = nextSpringStart(100) + 5;
    expect(kitDue({ ...grown(), clock: late, partners: [{ ...mate, state: 'following' }] })).toBe(false);
    expect(kitDue({ ...grown(), clock: late, lodge: { ...home, wood: LODGE_WOOD - 1 } })).toBe(false);
  });

  it('starts a baby in the lodge, whose parents are the player and the partner', () => {
    const w = birth({ ...grown(), clock: nextSpringStart(100) });
    expect(stageAt(w.clock, w.bornAt)).toBe('baby');
    expect(w.inLodge).toBe(true);
    expect(w.parentCoats).toEqual([{ coat: 0, shade: 0.1 }, { coat: 2, shade: 0.3 }]);
    expect([0, 2]).toContain(w.coat.coat);
    expect(w.generation).toBe(1);
    expect(w.partners).toEqual([]);
  });

  it('happens in the step on that day', () => {
    let w = { ...grown(), clock: nextSpringStart(100) - 0.5 };
    w = step(w, noIntent(), 1, flatTerrain(0));
    expect(w.generation).toBe(1);
    expect(stageAt(w.clock, w.bornAt)).toBe('baby');
  });
});
