import { describe, expect, it } from 'vitest';
import { doHere, DO_LABEL, noIntent } from './buttons';
import { DAY_SECONDS } from './clock';
import { LODGE_WOOD } from './lodge';
import { MOUND_DAYS, VISIT_DAYS, WELCOME_TRUST, WALK_IN, WELCOME_DISTANCE, departsAt, keepMounds, settleFamily, settledId, SCENT_APART, SCENT_MAX, SCENT_NEAR_LODGE, arrivesAt, canMark, newMound, visitorAt, welcomeNear, type ScentMound } from './scent';
import { createWorld, newLife, leaveHome, type WorldState } from './state';
import { step } from './step';
import { flatTerrain, type Terrain } from './terrain';
import { noTrees } from './trees';
import { newlyWon } from './achievements';

const flat = flatTerrain(0);
const none = { speaker: false, drift: false };
const lodge = { x: 0, z: 0, base: 0, heading: 0, wood: LODGE_WOOD } as unknown as NonNullable<WorldState['lodge']>;
/** A beaver with a whole lodge, mud in its mouth, on the bank 10 m from the lodge. */
const muddy = (): WorldState => ({ ...createWorld(flat, 10, 0), lodge, haul: { kind: 'mud' } });
const mound: ScentMound = { id: 'scent:1', x: 10, z: 0, madeAt: 0.3 * DAY_SECONDS };
/** A clock in the morning of the day after the mound was made, after its visitor has walked in. */
const settled = arrivesAt(mound) + WALK_IN + 1;

describe('Mark', () => {
  it('is Do with mud in the mouth on the bank by a whole lodge', () => {
    expect(doHere(muddy(), flat, noTrees, none)).toBe('mark');
    expect(DO_LABEL.mark).toBe('Mark');
  });

  it('needs a whole lodge, mud, land, and to be near the lodge', () => {
    expect(canMark({ ...muddy(), lodge: null })).toBe(false);
    expect(canMark({ ...muddy(), lodge: { ...lodge, wood: 0 } })).toBe(false);
    expect(canMark({ ...muddy(), haul: { kind: 'rock' } })).toBe(false);
    expect(canMark({ ...muddy(), haul: null })).toBe(false);
    expect(canMark({ ...muddy(), inLodge: true })).toBe(false);
    const far = muddy();
    expect(canMark({ ...far, beaver: { ...far.beaver, x: SCENT_NEAR_LODGE + 1 } })).toBe(false);
    const swimming = muddy();
    expect(canMark({ ...swimming, beaver: { ...swimming.beaver, mode: 'swim' } })).toBe(false);
  });

  it('allows three mounds at least a few metres apart', () => {
    const w = muddy();
    const at = (x: number): ScentMound => ({ ...mound, id: `m${x}`, x });
    expect(canMark({ ...w, scents: [at(10 + SCENT_APART - 1)] })).toBe(false);
    expect(canMark({ ...w, scents: [at(10 + SCENT_APART)] })).toBe(true);
    expect(canMark({ ...w, scents: [at(20), at(30), at(40)].slice(0, SCENT_MAX) })).toBe(false);
  });

  it('makes a mound where the beaver stands and uses up the mud', () => {
    const w = step(muddy(), { ...noIntent(), do: 'mark' }, 0.1, flat);
    expect(w.scents).toHaveLength(1);
    expect(w.scents[0]).toMatchObject({ x: 10, z: 0 });
    expect(w.haul).toBeNull();
    expect(step(w, { ...noIntent(), do: 'mark' }, 0.1, flat).scents).toHaveLength(1);
  });

  it('is not on a dam or with a log: build comes first', () => {
    const w = { ...muddy(), spots: [{ id: 's', bed: { x: 10, z: 0 }, bedY: 0, flow: { x: 1, z: 0 }, maxCrest: 2, pondM2: 900 }] };
    expect(doHere(w, flat, noTrees, none)).not.toBe('mark');
  });
});

describe('the visitor', () => {
  it('comes the next morning, by day only', () => {
    expect(arrivesAt(mound)).toBeGreaterThan(DAY_SECONDS);
    expect(arrivesAt(mound)).toBeLessThan(1.31 * DAY_SECONDS);
    expect(visitorAt(mound, [], arrivesAt(mound) - 1, flat)).toBeNull();
    expect(visitorAt(mound, [], arrivesAt(mound) + 1, flat)).not.toBeNull();
    // The second night after, it sleeps.
    expect(visitorAt(mound, [], 2.8 * DAY_SECONDS, flat)).toBeNull();
    expect(visitorAt(mound, [], 3.2 * DAY_SECONDS, flat)).not.toBeNull();
  });

  it('walks in and then stands by the mound', () => {
    const coming = visitorAt(mound, [], arrivesAt(mound) + 1, flat)!;
    expect(coming.pace).toBe(1);
    expect(Math.hypot(coming.x - mound.x, coming.z - mound.z)).toBeGreaterThan(10);
    const there = visitorAt(mound, [], settled, flat)!;
    expect(there.pace).toBe(0);
    expect(Math.hypot(there.x - mound.x, there.z - mound.z)).toBeLessThan(2);
    expect(there.task).toBe('rest');
    expect(visitorAt(mound, [mound.id], settled, flat)!.task).toBe('groom');
  });

  it('comes from the dry side', () => {
    const pond: Terrain = { ...flat, waterDepth: (x: number) => (x > mound.x ? 2 : 0) };
    for (let day = 0; day < 8; day++) {
      const m = { ...mound, id: `m${day}`, z: day * 3.7 };
      const v = visitorAt(m, [], arrivesAt(m) + 1, pond)!;
      expect(v.x).toBeLessThanOrEqual(m.x + 1e-6);
    }
  });

  it('keeps its coat and name for the mound', () => {
    const a = visitorAt(mound, [], settled, flat)!;
    expect(visitorAt(mound, [], settled + 100, flat)).toMatchObject({ id: a.id, name: a.name, coat: a.coat });
  });
});

describe('welcome', () => {
  it('needs the beaver within reach of a visitor that has arrived', () => {
    const near = { x: mound.x + 3, z: 0 };
    expect(welcomeNear([], [mound], near, arrivesAt(mound) - 1, flat)).toEqual([]);
    // Still walking in.
    expect(welcomeNear([], [mound], near, arrivesAt(mound) + 1, flat)).toEqual([]);
    expect(welcomeNear([], [mound], { x: mound.x + WELCOME_DISTANCE + 5, z: 0 }, settled, flat)).toEqual([]);
    expect(welcomeNear([], [mound], near, settled, flat)).toEqual([mound.id]);
  });

  it('keeps the list when nothing is new', () => {
    const list = [mound.id];
    expect(welcomeNear(list, [mound], mound, settled, flat)).toBe(list);
  });

  it('wins the Welcome achievement, and a new life starts without it', () => {
    let w: WorldState = { ...createWorld(flat, mound.x + 2, 0), scents: [mound], clock: settled };
    w = step(w, noIntent(), 0.1, flat);
    expect(w.welcomed).toEqual([mound.id]);
    expect(w.achievements).toContain('welcome');
    const kit = newLife(w);
    expect(kit.scents).toEqual([]);
    expect(kit.welcomed).toEqual([]);
    expect(newlyWon(kit)).not.toContain('welcome');
  });

  it('is not won by a mound nobody came to', () => {
    const w: WorldState = { ...createWorld(flat, mound.x + 2, 0), scents: [mound], clock: arrivesAt(mound) - 5 };
    expect(step(w, noIntent(), 0.1, flat).achievements).not.toContain('welcome');
  });

  it('leaving home leaves the mounds', () => {
    expect(leaveHome({ ...muddy(), scents: [mound] }).scents).toEqual([]);
  });

  it('has a mound made by Mark', () => {
    expect(newMound({ x: 1, z: 2 }, 3, 4)).toMatchObject({ x: 1, z: 2, madeAt: 4 });
  });
});

describe('a few days later', () => {
  const off = departsAt(mound) + WALK_IN + 1;

  it('has the visitor walk off after its days, and stay till then', () => {
    expect(visitorAt(mound, [], arrivesAt(mound) + (VISIT_DAYS - 1) * DAY_SECONDS, flat)).not.toBeNull();
    const leaving = visitorAt(mound, [], departsAt(mound) + WALK_IN / 2, flat);
    expect(leaving).toMatchObject({ pace: 1 });
    expect(visitorAt(mound, [], off, flat)).toBeNull();
  });

  it('dries the mound and drops it, but keeps one whose visitor was welcomed until its family has settled', () => {
    const late = mound.madeAt + (MOUND_DAYS + 1) * DAY_SECONDS;
    expect(keepMounds([mound], [], [], mound.madeAt + DAY_SECONDS)).toEqual([mound]);
    expect(keepMounds([mound], [], [], late)).toEqual([]);
    expect(keepMounds([mound], [mound.id], [], late)).toEqual([mound]);
    expect(keepMounds([mound], [mound.id], [{ id: settledId(mound) }], late)).toEqual([]);
  });

  it('founds a family only on a pond, and trusts the player once welcomed', () => {
    expect(settleFamily(mound, flat, { x: 0, z: 0 }, [])).toBeNull();
    let w: WorldState = { ...createWorld(flat, mound.x + 2, 0), scents: [mound], clock: settled };
    w = step(w, noIntent(), 0.1, flat);
    expect(w.trust[`visitor:${mound.id}`]).toBe(WELCOME_TRUST);
    expect(w.trust[settledId(mound)]).toBe(WELCOME_TRUST);
  });
});
