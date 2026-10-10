import { describe, expect, it } from 'vitest';
import { DAY_FRACTION, DAY_SECONDS, DAYS_PER_SEASON } from './clock';
import { pondParts } from './family';
import { LODGE_WOOD, SOLID_RADIUS, doorPoint, type Lodge } from './lodge';
import { DRY, ERRAND_SECONDS, SWIM_DEPTH, homeDam, routineAt, type Doing, type RoutineHome, type RoutineMember } from './routines';
import type { Terrain } from './terrain';

/** A round pond 30 m across the middle, deepening 0.4 m per metre from its edge to 3 m, in a bank that rises gently. */
const pond: Terrain = {
  heightAt: (x, z) => {
    const r = Math.hypot(x, z);
    return r < 30 ? -Math.min(3, (30 - r) * 0.4) : (r - 30) * 0.1;
  },
  isWater: (x, z) => Math.hypot(x, z) < 30,
  waterDepth: (x, z) => {
    const r = Math.hypot(x, z);
    return r < 30 ? Math.min(3, (30 - r) * 0.4) : 0;
  },
};
const lodge: Lodge = { x: 0, z: 0, base: 0, door: 0, wood: LODGE_WOOD };
const home = (dam: RoutineHome['dam'] = 'shore'): RoutineHome => ({ lodge, seed: 1234, parts: pondParts(lodge, pond), dam });
const family: RoutineMember[] = [
  { id: 'f:mama', role: 'mama', stage: 'adult' },
  { id: 'f:papa', role: 'papa', stage: 'adult' },
  { id: 'f:kit:0', role: 'kit', stage: 'baby' },
  { id: 'f:kit:1', role: 'kit', stage: 'baby' },
  { id: 'f:kit:2', role: 'kit', stage: 'teenager' },
];
const day = (n: number): number => n * DAY_SECONDS;
const AUTUMN = 2 * DAYS_PER_SEASON;
const SUMMER = DAYS_PER_SEASON;

/** Every `step` seconds of daylight over `days` days from `from`: the clock and what each beaver does. */
function daylight(from: number, days: number, step: number, h: RoutineHome = home(), members = family): { clock: number; doing: Doing[] }[] {
  const out: { clock: number; doing: Doing[] }[] = [];
  for (let d = from; d < from + days; d++) {
    for (let t = 0; t < DAY_FRACTION * DAY_SECONDS; t += step) out.push({ clock: day(d) + t, doing: routineAt(h, members, day(d) + t, pond) });
  }
  return out;
}

/** True if there is water within `r` metres of a point. */
const waterNear = (x: number, z: number, r: number): boolean => {
  for (let d = 0.25; d <= r; d += 0.25) {
    for (let a = 0; a < 16; a++) if (pond.waterDepth(x + Math.sin((a * Math.PI) / 8) * d, z + Math.cos((a * Math.PI) / 8) * d) >= DRY) return true;
  }
  return false;
};

describe('routines', () => {
  it('fit the day: an errand is an eighth of a day, and daylight holds whole errands', () => {
    expect(DAY_SECONDS % ERRAND_SECONDS).toBe(0);
    expect((DAY_FRACTION * DAY_SECONDS) % ERRAND_SECONDS).toBe(0);
  });

  it('are the same for the same clock', () => {
    for (const c of [day(3.1), day(AUTUMN + 0.42), day(50.2)]) expect(routineAt(home(), family, c, pond)).toEqual(routineAt(home(), family, c, pond));
  });

  it('need water round the lodge', () => {
    expect(routineAt({ ...home(), parts: [] }, family, day(1.2), pond)).toEqual([]);
  });

  it('move smoothly from one errand to the next, with no jumps', () => {
    let last: Doing[] | null = null;
    for (let c = day(AUTUMN + 1); c < day(AUTUMN + 2); c += 0.5) {
      const now = routineAt(home(), family, c, pond);
      if (last) now.forEach((b, i) => expect(Math.hypot(b.x - last![i]!.x, b.z - last![i]!.z)).toBeLessThan(6));
      last = now;
    }
  });

  it('keep out of the solid dome of the lodge', () => {
    for (const { doing } of daylight(SUMMER, 2, 2)) for (const b of doing) expect(Math.hypot(b.x - lodge.x, b.z - lodge.z)).toBeGreaterThanOrEqual(SOLID_RADIUS);
  });

  it('use only the known tasks and errands, and carry with the right task', () => {
    const tasks = new Set(['swim', 'rest', 'eat', 'gnaw', 'carry', 'build', 'groom', 'play']);
    const errands = new Set(['dam', 'store', 'lodge', 'food', 'kits', 'play', 'rest']);
    for (const { doing } of daylight(AUTUMN, 2, 3)) {
      for (const b of doing) {
        expect(tasks.has(b.task)).toBe(true);
        expect(errands.has(b.errand)).toBe(true);
        if (b.task === 'carry') expect(b.carry).not.toBeNull();
        if (b.task === 'gnaw' || b.task === 'play') expect(b.carry).toBeNull();
        if (b.task === 'eat') expect(['branch', 'lily']).toContain(b.carry);
      }
    }
  });

  it('show an errand from start to end: to the bank, gnaw, carry the branch back, and pat it in', () => {
    let seen = false;
    for (let d = AUTUMN; d < AUTUMN + 8 && !seen; d++) {
      for (let slot = 0; slot < 5 && !seen; slot++) {
        const tasks: string[] = [];
        for (let s = 0; s < ERRAND_SECONDS; s += 1) {
          const papa = routineAt(home(), family, day(d) + slot * ERRAND_SECONDS + s, pond)[1]!;
          if (tasks.at(-1) !== papa.task) tasks.push(papa.task);
        }
        const g = tasks.indexOf('gnaw');
        seen = g >= 0 && tasks.indexOf('carry', g) > g && tasks.indexOf('build', g) > tasks.indexOf('carry', g);
      }
    }
    expect(seen).toBe(true);
  });

  it('gnaw on land right next to the water, and walk there', () => {
    let gnawed = 0;
    for (const { doing } of daylight(AUTUMN, 4, 2)) {
      for (const b of doing) {
        if (b.task !== 'gnaw') continue;
        gnawed++;
        expect(pond.waterDepth(b.x, b.z)).toBeLessThan(DRY);
        expect(waterNear(b.x, b.z, 2.5)).toBe(true);
        expect(b.mode).toBe('walk');
        expect(b.y).toBeCloseTo(pond.heightAt(b.x, b.z), 5);
      }
    }
    expect(gnawed).toBeGreaterThan(0);
  });

  it('swim where the water is deep, and stand at the surface', () => {
    for (const { doing } of daylight(SUMMER, 1, 3)) {
      for (const b of doing) {
        const depth = pond.waterDepth(b.x, b.z);
        expect(b.mode).toBe(depth >= SWIM_DEPTH ? 'swim' : 'walk');
        if (b.mode === 'swim') expect(b.y).toBeCloseTo(pond.heightAt(b.x, b.z) + depth - 0.2, 5);
      }
    }
  });

  it('keep the babies in the water', () => {
    for (const { doing } of daylight(SUMMER, 3, 3)) for (const b of doing.slice(2, 4)) expect(pond.waterDepth(b.x, b.z)).toBeGreaterThan(0);
  });

  it('keep kits near mama much of the time', () => {
    const samples = daylight(SUMMER, 4, 4);
    const near = samples.filter(({ doing }) => doing.slice(2).some((k) => Math.hypot(k.x - doing[0]!.x, k.z - doing[0]!.z) < 4)).length;
    expect(near / samples.length).toBeGreaterThan(0.15);
    expect(samples.some(({ doing }) => doing[0]!.errand === 'kits')).toBe(true);
  });

  it('have two of the family meet at one spot now and then', () => {
    const met = daylight(SUMMER, 6, 3).some(({ doing }) => {
      const [mama, papa] = doing;
      return Math.hypot(mama!.x - papa!.x, mama!.z - papa!.z) < 2 && mama!.task === 'groom' && papa!.task === 'groom';
    });
    expect(met).toBe(true);
  });

  it('let the kits play', () => {
    expect(daylight(SUMMER, 3, 3).some(({ doing }) => doing.slice(2).some((k) => k.task === 'play' && k.pace > 0))).toBe(true);
  });

  it('fill the store in autumn, and eat lily pads in summer', () => {
    const autumn = daylight(AUTUMN, 4, 3);
    expect(autumn.some(({ doing }) => doing.some((b) => b.errand === 'store' && b.task === 'build'))).toBe(true);
    const summer = daylight(SUMMER, 4, 3);
    expect(summer.some(({ doing }) => doing.some((b) => b.task === 'eat' && b.carry === 'lily'))).toBe(true);
    expect(summer.every(({ doing }) => doing.every((b) => b.errand !== 'store'))).toBe(true);
  });

  it('mend a dam only where there is one, and work at it from the pond side', () => {
    const none = daylight(0, 6, 4, home(null));
    expect(none.every(({ doing }) => doing.every((b) => b.errand !== 'dam'))).toBe(true);
    const dam = { x: 0, z: -25 };
    const builds = daylight(0, 6, 2, home(dam)).flatMap(({ doing }) => doing.filter((b) => b.errand === 'dam' && b.task === 'build'));
    expect(builds.length).toBeGreaterThan(0);
    for (const b of builds) expect(Math.hypot(b.x - dam.x, b.z - dam.z)).toBeLessThan(3);
  });

  it('rest by the door of the lodge at night', () => {
    const door = doorPoint(lodge, 4);
    for (const b of routineAt(home(), family, day(5) + DAY_SECONDS * 0.99, pond)) {
      expect(b.task).toBe('rest');
      expect(b.errand).toBe('rest');
      expect(Math.hypot(b.x - door.x, b.z - door.z)).toBeLessThan(4);
    }
  });
});

describe('homeDam', () => {
  const spots = [
    { id: 'a', bed: { x: 50, z: 0 } },
    { id: 'b', bed: { x: 20, z: 0 } },
    { id: 'c', bed: { x: 500, z: 0 } },
  ];
  it('is the dam of the pond the lodge stands in', () => {
    expect(homeDam({ ...lodge, pond: 'a' }, spots, [{ spot: 'a' }, { spot: 'b' }])).toEqual({ x: 50, z: 0 });
  });
  it('else the nearest built dam in reach, else none', () => {
    expect(homeDam(lodge, spots, [{ spot: 'a' }, { spot: 'b' }])).toEqual({ x: 20, z: 0 });
    expect(homeDam(lodge, spots, [{ spot: 'c' }])).toBeNull();
    expect(homeDam(lodge, spots, [])).toBeNull();
    expect(homeDam(null, spots, [{ spot: 'a' }])).toBeNull();
  });
});
