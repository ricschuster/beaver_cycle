import { describe, expect, it } from 'vitest';
import { DAY_SECONDS } from './clock';
import { DIG_REACH, DIG_TIME, LOST, WAIT_GAP, digging, nearestStuck, rescue, startEscort, stepEscort, stuckNow, whereTo } from './escort';
import { FAMILY_START_TRUST, familyTrust } from './familyMoods';
import type { Neighbour } from './neighbours';
import { createWorld, type WorldState } from './state';
import type { Terrain } from './terrain';

const land: Terrain = { heightAt: () => 0, isWater: () => false, waterDepth: () => 0 };
const lake: Terrain = { heightAt: () => 0, isWater: () => true, waterDepth: () => 2 };
const winter = 32 * DAY_SECONDS;

const families = (n: number): Neighbour[] => Array.from({ length: n }, (_, i) => ({ id: `family:${i}:0`, lodge: { x: i * 500, z: 0 } as Neighbour['lodge'], parents: [{ coat: 0, shade: 0 }, { coat: 1, shade: 0 }], seed: 1000 + i * 7919 }));
const world = (trust = 0.5, clock = winter): WorldState => {
  const ns = families(20);
  return { ...createWorld(land, 0, 0), neighbours: ns, clock, trust: Object.fromEntries(ns.map((f) => [f.id, trust])) };
};

describe('stuckNow', () => {
  it('has stuck beavers only in winter, and in some winters for some families', () => {
    const w = world();
    const list = stuckNow(w, land);
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThan(20);
    expect(stuckNow({ ...w, clock: 12 * DAY_SECONDS }, land)).toEqual([]);
  });

  it('is the same every time, and each is a named member of its family', () => {
    const w = world();
    expect(stuckNow(w, land)).toEqual(stuckNow(w, land));
    for (const s of stuckNow(w, land)) {
      expect(s.member).toMatch(/:(mama|papa)$/);
      expect(s.name.length).toBeGreaterThan(0);
    }
  });

  it('skips a family that fears the player, a rescued one, and a lodge with no dry ground round it', () => {
    expect(stuckNow(world(0.1), land)).toEqual([]);
    const w = world();
    const first = stuckNow(w, land)[0]!;
    expect(stuckNow({ ...w, rescued: [first.id] }, land).some((s) => s.id === first.id)).toBe(false);
    const wet = { ...w, neighbours: w.neighbours.map((n) => ({ ...n, id: `${n.id}:wet` })) };
    expect(stuckNow(wet, lake)).toEqual([]);
  });
});

describe('digging and rescue', () => {
  const stuck = { x: 10, z: 0 };
  it('starts with a press, grows while standing still beside the drift, and starts over otherwise', () => {
    const b = { x: 10 - DIG_REACH + 0.5, z: 0 };
    expect(digging(0, stuck, b, false, false, 0.5)).toBe(0);
    expect(digging(0, stuck, b, true, false, 0.5)).toBe(0.5);
    expect(digging(1, stuck, b, true, false, 0.5)).toBe(1.5);
    // The press is one frame; the dig goes on without the button.
    expect(digging(1, stuck, b, false, false, 0.5)).toBe(1.5);
    expect(digging(1, stuck, b, true, true, 0.5)).toBe(0);
    expect(digging(1, stuck, { x: 0, z: 0 }, true, false, 0.5)).toBe(0);
    expect(digging(1, null, b, true, false, 0.5)).toBe(0);
    expect(DIG_TIME).toBeGreaterThan(0);
  });

  it('finishes from one press after DIG_TIME of standing still', () => {
    const b = { x: 10, z: 1 };
    let dug = digging(0, stuck, b, true, false, 0.1);
    for (let i = 0; i < 40; i++) dug = digging(dug, stuck, b, false, false, 0.1);
    expect(dug).toBeGreaterThanOrEqual(DIG_TIME);
  });

  it('finds the nearest drift in range', () => {
    const a = { id: 'a', member: 'a', name: 'A', family: 'f', x: 5, z: 0 };
    const c = { id: 'c', member: 'c', name: 'C', family: 'f', x: 20, z: 0 };
    expect(nearestStuck([c, a], { x: 0, z: 0 }, 45)?.id).toBe('a');
    expect(nearestStuck([c], { x: 0, z: 0 }, 10)).toBeNull();
  });

  it('frees the beaver: it becomes a guide once, and the family trusts more', () => {
    const w = world();
    const s = stuckNow(w, land)[0]!;
    const r = rescue(rescue(w, s), s);
    expect(r.rescued).toEqual([s.id, s.id]);
    expect(r.guides).toEqual([s.member]);
    expect(familyTrust(r, s.family)).toBeGreaterThan(familyTrust(w, s.family));
    expect(FAMILY_START_TRUST).toBeLessThan(familyTrust(r, s.family));
  });
});

describe('escort', () => {
  const guide = { id: 'f:papa', name: 'Reed', family: 'f', x: 0, z: 0 };
  const base = createWorld(land, 0, 0);

  it('leads to the nearest free dam spot, else home, else nowhere', () => {
    expect(whereTo(base)).toBeNull();
    const spot = { id: 's1', bed: { x: 100, z: 0 } } as WorldState['spots'][number];
    expect(whereTo({ ...base, spots: [spot] })).toMatchObject({ what: 'dam', x: 100 });
    expect(whereTo({ ...base, spots: [spot], dams: [{ spot: 's1' } as WorldState['dams'][number]] })).toBeNull();
    expect(whereTo({ ...base, lodge: { x: 5, z: 5 } as WorldState['lodge'] })).toMatchObject({ what: 'home' });
  });

  it('moves toward the goal, waits for a beaver that falls behind, and arrives', () => {
    let w: WorldState = { ...base, escort: startEscort(guide, { x: 30, z: 0, what: 'dam' }) };
    w = stepEscort(w, 1).world;
    expect(w.escort!.x).toBeGreaterThan(0);
    const far = { ...w, beaver: { ...w.beaver, x: -(WAIT_GAP + 1) } };
    expect(stepEscort(far, 1).world.escort!.x).toBe(w.escort!.x);
    let events: string[] = [];
    for (let i = 0; i < 20; i++) {
      const r = stepEscort({ ...w, beaver: { ...w.beaver, x: w.escort!.x - 3 } }, 1);
      w = r.world;
      events = [...events, ...r.events.map((e) => e.what)];
    }
    expect(events).toContain('arrived');
  });

  it('gives up when the beaver is lost, and lets go after a stay', () => {
    const e = startEscort(guide, { x: 300, z: 0, what: 'home' });
    const lost = stepEscort({ ...base, escort: e, beaver: { ...base.beaver, x: -(LOST + 1) } }, 1);
    expect(lost.world.escort).toBeNull();
    expect(lost.events[0]?.what).toBe('lost');
    const there = { ...base, time: 100, escort: { ...e, arrivedAt: 100 } };
    expect(stepEscort(there, 1).world.escort).not.toBeNull();
    expect(stepEscort({ ...there, time: 200 }, 1).world.escort).toBeNull();
  });
});
