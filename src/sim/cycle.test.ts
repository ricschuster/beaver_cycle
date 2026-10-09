// A scenario test of the whole family cycle (docs/design/23_leaving_and_next_baby.md), run through the real `step`:
// grow up, leave home, find a partner, build a lodge, wait for spring, a kit is born, and again for the next life.
// It stands in for a playtest of the logic. How it feels on a tablet it cannot say.
import { describe, expect, it } from 'vitest';
import { noActions } from '../actions/actions';
import { nextSpringStart } from './clock';
import { formerParentsAt, parentsAt } from './family';
import { LODGE_WOOD, lodgeComplete } from './lodge';
import { lifeAt, stageStart } from './life';
import type { Log } from './logs';
import { HEARD_DISTANCE, follower, mateOf } from './partners';
import type { DamSpot } from './damSpots';
import { createWorld, leaveHome, setStage, withPartners, type WorldState } from './state';
import { step } from './step';
import type { Terrain } from './terrain';

/** Dry flat land for z < 0, then a lake south of z = 0 that is deep from z = 3 (as in lodge.test.ts). Lodges can start along the whole shore. */
const shore: Terrain = {
  heightAt: () => 0,
  isWater: (_x, z) => z >= 0,
  waterDepth: (_x, z) => Math.max(0, z * 0.5),
};

const spot = (id: string, x: number, z: number): DamSpot => ({ id, bed: { x, z }, bedY: 0, flow: { x: 0, z: 1 }, maxCrest: 1, pondM2: 100 }) as DamSpot;
/** Dam spots on the land north of the shore, so lone beavers have somewhere to be. */
const spots = Array.from({ length: 20 }, (_, i) => spot(`s${i}`, (i % 5) * 220 - 440, -150 - Math.floor(i / 5) * 220));

const DT = 0.1;

/**
 * Play on for a number of simulated seconds, with the same hook the game loop in main.ts has: when the teenager year ends,
 * the grown beaver leaves home and the lone beavers appear. (That hook lives in main.ts, not in `step`.)
 */
function play(world: WorldState, seconds: number, actions = noActions()): WorldState {
  let w = world;
  for (let t = 0; t < seconds; t += DT) {
    const before = lifeAt(w.clock, w.bornAt).stage;
    w = step(w, actions, DT, shore);
    if (before === 'teenager' && lifeAt(w.clock, w.bornAt).stage === 'adult') w = withPartners(leaveHome(w));
  }
  return w;
}

/** Walk to a point on the land, stopping near it. */
function walkTo(world: WorldState, x: number, z: number, near = 1): WorldState {
  let w = world;
  for (let i = 0; i < 4000 && Math.hypot(x - w.beaver.x, z - w.beaver.z) > near; i++) {
    const dx = x - w.beaver.x;
    const dz = z - w.beaver.z;
    const d = Math.hypot(dx, dz);
    w = play(w, DT, { ...noActions(), move: { x: dx / d, z: dz / d } });
  }
  return w;
}

const log = (id: string): Log => ({ id, x: 0, y: 0, z: 0, heading: 0, length: 6, floating: false });

/** Put whole-lodge worth of logs on a new lodge at a point of the shore, one dragged log at a time. */
function buildLodgeAt(world: WorldState, x: number): WorldState {
  let w: WorldState = { ...world, inLodge: false, beaver: { ...world.beaver, x, z: -1, y: 0, mode: 'walk', heading: 0 } };
  for (let i = 0; i < LODGE_WOOD / 2; i++) {
    w = { ...w, logs: [log(`${x}:${i}`)], drag: `${x}:${i}` };
    w = play(w, DT, { ...noActions(), build: true });
  }
  return w;
}

/** The beaver just reaches adulthood, one second before the leaving. */
function nearlyGrown(world: WorldState): WorldState {
  return { ...world, clock: stageStart(world.bornAt, 'adult') - 1 };
}

/** Find the nearest lone beaver, walk to it, and lead it to the shore at x. Returns the world with it following. */
function fetchPartner(world: WorldState, x: number): WorldState {
  const nearest = [...world.partners].sort((a, b) => Math.hypot(a.x - world.beaver.x, a.z - world.beaver.z) - Math.hypot(b.x - world.beaver.x, b.z - world.beaver.z))[0]!;
  let w = walkTo(world, nearest.x, nearest.z, 2);
  expect(follower(w.partners)?.id).toBe(nearest.id);
  w = walkTo(w, x, -3);
  return w;
}

describe('the family cycle, played through the sim', () => {
  // The first life: an adult builds a lodge, grows old enough to count as a teenager there, and leaves it. Played once, read in steps.
  let w = createWorld(shore, 0, -1);
  w = { ...w, spots };

  it('builds a first lodge and wins Home', () => {
    w = buildLodgeAt(setStage(w, 'teenager'), 0);
    expect(lodgeComplete(w.lodge)).toBe(true);
    expect(w.achievements).toContain('home');
  });

  it('shows Mama and Papa while the player is a teenager', () => {
    expect(parentsAt(w.lodge, w.bornAt, w.clock, false, shore, w.parentCoats)).toHaveLength(2);
  });

  it('leaves home when the teenager year ends: no lodge, a former home, three lone beavers', () => {
    w = play(nearlyGrown(w), 3);
    expect(lifeAt(w.clock, w.bornAt).stage).toBe('adult');
    expect(w.lodge).toBeNull();
    expect(w.formerHomes).toHaveLength(1);
    expect(w.partners).toHaveLength(3);
    expect(w.partners.every((p) => p.state === 'alone')).toBe(true);
  });

  it('leaves Mama and Papa at the former home, and not at a lodge', () => {
    expect(formerParentsAt(w.formerHomes, w.clock, shore)).toHaveLength(2);
    expect(parentsAt(w.lodge, w.bornAt, w.clock, false, shore, w.parentCoats)).toHaveLength(0);
  });

  it('puts every lone beaver far from home, and the nearest within a short walk', () => {
    const home = w.formerHomes[0]!;
    const far = w.partners.map((p) => Math.hypot(p.x - home.x, p.z - home.z));
    expect(Math.min(...far)).toBeGreaterThanOrEqual(120);
    expect(Math.min(...far)).toBeLessThan(HEARD_DISTANCE * 3);
  });

  it('follows a beaver to a new shore, where it moves in when the lodge is whole', () => {
    w = fetchPartner(w, 600);
    expect(mateOf(w.partners)).toBeNull();
    // The follower keeps close behind the whole way.
    const f = follower(w.partners)!;
    expect(Math.hypot(f.x - w.beaver.x, f.z - w.beaver.z)).toBeLessThan(10);
    w = buildLodgeAt(w, 600);
    expect(lodgeComplete(w.lodge)).toBe(true);
    expect(mateOf(w.partners)).not.toBeNull();
    expect(mateOf(w.partners)!.homeAt).not.toBeNull();
  });

  it('brings no kit before the first spring day after the partner moved in', () => {
    const homeAt = mateOf(w.partners)!.homeAt!;
    w = { ...w, clock: nextSpringStart(homeAt) - 5 };
    w = play(w, 1);
    expect(w.generation).toBe(0);
  });

  it('brings a kit on that day: a baby in the new lodge, with its own list of achievements', () => {
    w = play(w, 10);
    expect(w.generation).toBe(1);
    expect(lifeAt(w.clock, w.bornAt).stage).toBe('baby');
    expect(w.inLodge).toBe(true);
    expect(w.partners).toEqual([]);
    expect(w.achievements).toEqual([]);
    expect(parentsAt(w.lodge, w.bornAt, w.clock, true, shore, w.parentCoats)).toHaveLength(2);
  });

  it('plays the second life through: leaves the lodge it was born in, builds another, and wins Home again', () => {
    // The kit grows up (the lodge is its home until it leaves), leaves, and goes out to find a partner of its own.
    w = play(nearlyGrown(setStage(w, 'teenager')), 3);
    expect(w.formerHomes).toHaveLength(2);
    expect(w.lodge).toBeNull();
    expect(w.partners).toHaveLength(3);
    w = fetchPartner(w, -600);
    w = buildLodgeAt(w, -600);
    expect(lodgeComplete(w.lodge)).toBe(true);
    // The lodge it built itself is its own achievement, not an inheritance of the one it grew up in.
    expect(w.achievements).toContain('home');
    expect(mateOf(w.partners)).not.toBeNull();
  });

  it('brings a second kit, and the generation count follows the lives', () => {
    const homeAt = mateOf(w.partners)!.homeAt!;
    w = play({ ...w, clock: nextSpringStart(homeAt) - 1 }, 5);
    expect(w.generation).toBe(2);
    expect(w.formerHomes).toHaveLength(2);
  });
});
