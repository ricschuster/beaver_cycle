import { describe, expect, it } from 'vitest';
import { noIntent, type Intent } from './buttons';
import { ACHIEVEMENT_IDS, ACHIEVEMENT_TEXT, GARDENER_PADS, HAULER_LOADS, WOOD_TREES, mendsBetween, newlyWon, padsBetween, rescuesThisLife, tally, visitedHome } from './achievements';
import { DAY_SECONDS, DAYS_PER_YEAR, START_CLOCK, dateAt, nextSpringStart } from './clock';
import { LEVEL1_COST, LEVEL_COST } from './dam';
import type { DamSpot } from './damSpots';
import { FIRST_PARENTS, formerParentIds, type FormerHome } from './family';
import { STORE_CAPACITY } from './food';
import { BABY_DAYS } from './life';
import { LODGE_WOOD } from './lodge';
import type { Partner } from './partners';
import { birth, createWorld, newLife, setStage, type WorldState } from './state';
import { step } from './step';
import type { Terrain } from './terrain';
import { newWear } from './wear';

const dry: Terrain = { heightAt: () => 0, isWater: () => false, waterDepth: () => 0 };
const spot: DamSpot = { id: 'core:50:0', bed: { x: 50, z: 0 }, bedY: 0, flow: { x: 1, z: 0 }, maxCrest: 2, pondM2: 900 };
const whole = { spot: spot.id, ...LEVEL1_COST };
const base = (): WorldState => ({ ...createWorld(dry, 52, 0), spots: [spot] });
const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `t${i}`);
const won = (w: WorldState) => newlyWon(w);

describe('the rules', () => {
  it('has a name and a toast for each', () => {
    for (const id of ACHIEVEMENT_IDS) expect(ACHIEVEMENT_TEXT[id].length).toBeGreaterThan(0);
  });
  it('wood: 30 trees', () => {
    expect(won({ ...base(), felled: ids(WOOD_TREES - 1) })).toEqual([]);
    expect(won({ ...base(), felled: ids(WOOD_TREES) })).toEqual(['wood']);
  });
  it('is won only once', () => {
    expect(won({ ...base(), felled: ids(WOOD_TREES + 5), achievements: ['wood'] })).toEqual([]);
  });
  it('home: a whole lodge', () => {
    const lodge = { x: 0, z: 0, heading: 0, base: 0, wood: LODGE_WOOD - 1 } as unknown as WorldState['lodge'];
    expect(won({ ...base(), lodge })).toEqual([]);
    expect(won({ ...base(), lodge: { ...lodge!, wood: LODGE_WOOD } })).toEqual(['home']);
  });
  it('first dam: a whole dam, not one half built', () => {
    expect(won({ ...base(), dams: [{ spot: spot.id, wood: 2, mud: 0, rock: 0 }] })).toEqual([]);
    expect(won({ ...base(), dams: [whole] })).toEqual(['firstDam']);
  });
  it('higher dam: whole at the top level of a spot that holds level 2 or more', () => {
    const w2 = { spot: spot.id, ...LEVEL_COST[1]!, level: 2 as const };
    expect(won({ ...base(), dams: [w2], spots: [{ ...spot, maxCrest: 1.5 }] })).toContain('highDam');
    expect(won({ ...base(), dams: [w2], spots: [spot] })).not.toContain('highDam');
    expect(won({ ...base(), dams: [whole], spots: [{ ...spot, maxCrest: 1 }] })).not.toContain('highDam');
  });
  it('pioneer: a dam at a spot a pond found', () => {
    const half = { spot: spot.id, wood: 1, mud: 0, rock: 0 };
    expect(won({ ...base(), dams: [half] })).toEqual([]);
    expect(won({ ...base(), dams: [half], spots: [{ ...spot, found: true }] })).toEqual(['pioneer']);
  });
  it('pantry: every place holds a piece', () => {
    const store = Array.from({ length: STORE_CAPACITY }, () => 'branch' as const);
    expect(won({ ...base(), store: store.map((p, i) => (i === 0 ? null : p)) })).toEqual([]);
    expect(won({ ...base(), store })).toEqual(['pantry']);
  });
  it('the counters: pads, mends, loads', () => {
    expect(won({ ...base(), padsPicked: GARDENER_PADS - 1 })).toEqual([]);
    expect(won({ ...base(), padsPicked: GARDENER_PADS })).toEqual(['gardener']);
    expect(won({ ...base(), mended: 1 })).toEqual(['handy']);
    expect(won({ ...base(), hauled: HAULER_LOADS })).toEqual(['hauler']);
  });
  it('a full year of game clock', () => {
    expect(won({ ...base(), clock: START_CLOCK + DAYS_PER_YEAR * DAY_SECONDS - 1 })).toEqual([]);
    expect(won({ ...base(), clock: START_CLOCK + DAYS_PER_YEAR * DAY_SECONDS })).toEqual(['year']);
  });
});

describe('the family ones (Q38)', () => {
  const home = { x: 0, z: 0, base: 0, door: 0, wood: LODGE_WOOD };
  const partner: Partner = { id: 'partner:s1', x: 0, z: 0, heading: 0, coat: 1, shade: 0, state: 'alone', metAt: null, homeAt: null };
  const mate: Partner = { ...partner, state: 'home', metAt: 1, homeAt: 100 };
  // A grown beaver whose partner lives in its whole lodge. The test lodge would win Home, so it counts as inherited here.
  const family = (): WorldState => ({ ...base(), lodge: home, partners: [mate], journey: { ...base().journey, inherited: ['lodge'] } });

  it('mate: a partner lives in the lodge, not one that only follows or was never met', () => {
    expect(won({ ...base(), partners: [partner] })).toEqual([]);
    expect(won({ ...base(), partners: [{ ...partner, state: 'following', metAt: 1 }] })).toEqual([]);
    expect(won(family())).toEqual(['mate']);
  });

  it('kits: won when the kit is due, on the first day of spring after the partner moved in', () => {
    expect(won({ ...family(), clock: nextSpringStart(100) - 1 })).not.toContain('kits');
    expect(won({ ...family(), clock: nextSpringStart(100) })).toContain('kits');
  });

  it('kits: the kit starts with nothing won, and no partner, so it finds its own mate', () => {
    const kit = birth({ ...family(), clock: nextSpringStart(100), achievements: ['mate', 'kits'] });
    expect(kit.achievements).toEqual([]);
    expect(won(kit)).not.toContain('mate');
    expect(won(kit)).not.toContain('kits');
  });

  it('guide: a stuck beaver dug out in this life', () => {
    const year = dateAt(base().clock).year;
    expect(won({ ...base(), rescued: [] })).toEqual([]);
    expect(won({ ...base(), rescued: [`family:1:2:stuck:${year}`] })).toEqual(['guide']);
  });

  it('guide: a rescue of an earlier life does not count, one in this life does', () => {
    const spring = nextSpringStart(base().clock);
    const before = `family:1:2:stuck:${dateAt(base().clock).year}`;
    const kit = newLife({ ...base(), clock: spring, rescued: [before] });
    expect(rescuesThisLife(kit)).toBe(0);
    expect(won(kit)).not.toContain('guide');
    const now = `family:1:2:stuck:${dateAt(spring).year}`;
    expect(won({ ...kit, rescued: [before, now] })).toContain('guide');
  });
});

describe('more of the family (#220)', () => {
  const home = { x: 0, z: 0, base: 0, door: 0, wood: LODGE_WOOD };
  const mate: Partner = { id: 'partner:s1', x: 0, z: 0, heading: 0, coat: 1, shade: 0, state: 'home', metAt: 1, homeAt: 100 };
  const family = (): WorldState => ({ ...base(), lodge: home, partners: [mate], journey: { ...base().journey, inherited: ['lodge'] } });
  const due = nextSpringStart(100);
  const teen = BABY_DAYS * DAY_SECONDS;

  it('growing up: a life that began as a baby reaches the teenager stage', () => {
    const kit = newLife(base());
    expect(won({ ...kit, clock: kit.clock + teen - 1 })).toEqual([]);
    expect(won({ ...kit, clock: kit.clock + teen })).toEqual(['grownUp']);
  });

  it('growing up: not for a life that began as a teenager or an adult', () => {
    expect(won(base())).toEqual([]);
    const begunTeen = setStage(newLife(base()), 'teenager');
    expect(won({ ...begunTeen, journey: { ...begunTeen.journey, start: begunTeen.clock } })).toEqual([]);
  });

  it('growing up: the next life starts it again', () => {
    const kit = newLife(base());
    const grownKit = { ...kit, clock: kit.clock + teen, achievements: ['grownUp' as const] };
    const next = newLife(grownKit);
    expect(next.achievements).toEqual([]);
    expect(won(next)).toEqual([]);
    expect(won({ ...next, clock: next.clock + teen })).toEqual(['grownUp']);
  });

  const left: FormerHome = { ...home, x: 40.2, z: -9.7, parents: FIRST_PARENTS };
  const talked = (id: string) => ({ [id]: { talks: 1, last: 1 } });

  it('visit home: a talk with Mama or Papa at the home this life left', () => {
    const w = { ...base(), formerHomes: [left] };
    expect(won(w)).toEqual([]);
    // A talk with Mama while still at home has the plain id, which is not the former home's.
    expect(won({ ...w, met: talked('mama') })).toEqual([]);
    expect(won({ ...w, met: talked(formerParentIds(left)[0]) })).toEqual(['visitHome']);
    expect(won({ ...w, met: talked(formerParentIds(left)[1]) })).toEqual(['visitHome']);
  });

  it('visit home: the parents of an older home, from an earlier life, do not count', () => {
    const w = { ...base(), formerHomes: [left], parentCoats: [{ coat: 0, shade: 0.1 }, { coat: 2, shade: 0.3 }] as WorldState['parentCoats'], met: talked(formerParentIds(left)[0]) };
    expect(visitedHome(w)).toBe(false);
    expect(won(w)).toEqual([]);
  });

  it('visit home: the next life has met nobody yet', () => {
    const w = { ...base(), formerHomes: [left], met: talked(formerParentIds(left)[0]), achievements: ['visitHome' as const] };
    const kit = newLife(w);
    expect(kit.achievements).toEqual([]);
    expect(won(kit)).toEqual([]);
  });

  it('hand down: the kit is due and a dam this life built stands', () => {
    expect(won({ ...family(), clock: due, dams: [whole] })).toContain('handDown');
    expect(won({ ...family(), clock: due - 1, dams: [whole] })).not.toContain('handDown');
    expect(won({ ...family(), clock: due, dams: [{ spot: spot.id, wood: 2, mud: 0, rock: 0 }] })).not.toContain('handDown');
    // A dam being raised was whole first.
    expect(won({ ...family(), clock: due, dams: [{ spot: spot.id, ...LEVEL1_COST, level: 2 }] })).toContain('handDown');
  });

  it('hand down: a dam an earlier life left does not count', () => {
    const w = { ...family(), clock: due, dams: [whole] };
    expect(won({ ...w, journey: { ...w.journey, inherited: ['lodge', `dam:${spot.id}`] } })).not.toContain('handDown');
  });

  it('hand down: the kit starts with nothing won, and the dam it was given is not its own', () => {
    const kit = birth({ ...family(), clock: due, dams: [whole], achievements: ['mate', 'kits', 'handDown'] });
    expect(kit.achievements).toEqual([]);
    expect(kit.journey.inherited).toContain(`dam:${spot.id}`);
    expect(won(kit)).not.toContain('handDown');
  });

  it('hand down: the birth waits one step, so the toast shows', () => {
    let w: WorldState = { ...family(), clock: due - 0.5, dams: [whole], achievements: ['mate', 'firstDam'] };
    w = step(w, noIntent(), 1, dry);
    expect(w.achievements).toContain('handDown');
    expect(w.generation).toBe(0);
    w = step(w, noIntent(), 1, dry);
    expect(w.generation).toBe(1);
    expect(w.achievements).toEqual([]);
  });
});

describe('the counts', () => {
  it('counts a pad picked, and one picked again after it grew back', () => {
    expect(padsBetween({}, { a: 0 })).toBe(1);
    expect(padsBetween({ a: 0 }, { a: 0 })).toBe(0);
    expect(padsBetween({ a: 0 }, { a: 1 })).toBe(1);
  });
  it('counts a dam mended from worn back to new, and not one built or only a little mended', () => {
    const at = (level: number, clock = 0) => ({ ...base(), clock, dams: [{ ...whole, wear: { level, since: 0, mend: 0 } }] });
    expect(mendsBetween(at(0.4), at(1))).toBe(1);
    expect(mendsBetween(at(0.4), at(0.6))).toBe(0);
    expect(mendsBetween(base(), at(1))).toBe(0);
    expect(mendsBetween({ ...base(), dams: [whole] }, at(1))).toBe(0);
  });
  it('tally records a win once and keeps the counters', () => {
    const before = { ...base(), felled: ids(WOOD_TREES - 1) };
    const after = tally(before, { ...before, felled: ids(WOOD_TREES) });
    expect(after.achievements).toEqual(['wood']);
    expect(tally(after, after).achievements).toEqual(['wood']);
  });
});

describe('in a step', () => {
  const build: Intent = { ...noIntent(), do: 'build' };
  it('counts a load of mud put on a dam, and wins the first dam when it completes', () => {
    const w0 = { ...base(), dams: [{ ...whole, mud: LEVEL1_COST.mud - 1 }], haul: { kind: 'mud' as const } };
    const w1 = step(w0, build, 0.1, dry);
    expect(w1.hauled).toBe(1);
    expect(w1.achievements).toEqual(['firstDam']);
  });
  it('does not count a load that was not used', () => {
    const w1 = step({ ...base(), spots: [], haul: { kind: 'mud' as const } }, build, 0.1, dry);
    expect(w1.hauled).toBe(0);
  });
  it('a mend back to new is the handy beaver', () => {
    const w0 = { ...base(), spots: [{ ...spot, maxCrest: 1 }], clock: 0, dams: [{ ...whole, wear: { level: 0.9, since: 0, mend: 0 } }], haul: { kind: 'rock' as const } };
    expect(step(w0, build, 0.1, dry).achievements).toContain('handy');
    expect(newWear(0).level).toBe(1);
  });
});

describe('the list', () => {
  it('marks what is won and counts what is counted', async () => {
    const { achievementLines } = await import('./achievements');
    const lines = achievementLines({ achievements: ['home'], felled: ids(12), padsPicked: 3, hauled: 0, journey: base().journey });
    expect(lines[0]).toBe('[ ] Wood 12/30');
    expect(lines[1]).toBe('[x] Home');
    expect(lines).toContain('[ ] Water gardener 3/20');
    expect(lines).toContain('[ ] Mate');
    expect(lines).toContain('[ ] Kits');
    expect(lines).toContain('[ ] Guide');
    expect(lines).toContain('[ ] Growing up');
    expect(lines).toContain('[ ] Visit home');
    expect(lines).toContain('[ ] Hand down');
    expect(lines).toHaveLength(16);
  });
});

describe('each life has its own journey', () => {
  const lived = (): WorldState => ({
    ...base(),
    felled: ids(WOOD_TREES),
    lodge: { x: 0, z: 0, base: 0, door: 0, wood: LODGE_WOOD },
    dams: [whole],
    padsPicked: 5,
    achievements: ['wood', 'home', 'firstDam'],
  });

  it('starts the list and the counters again', () => {
    const w = newLife(lived());
    expect(w.achievements).toEqual([]);
    expect(w.padsPicked).toBe(0);
    expect(w.journey.inherited).toEqual(['lodge', `dam:${spot.id}`]);
  });

  it('what earlier lives built wins nothing, and the trees already felled do not count', () => {
    expect(won(newLife(lived()))).toEqual([]);
  });

  it('trees count from the new life, and a dam built in it counts', () => {
    const w = newLife(lived());
    expect(won({ ...w, felled: ids(WOOD_TREES + 29) })).toEqual([]);
    expect(won({ ...w, felled: ids(WOOD_TREES + WOOD_TREES) })).toEqual(['wood']);
    expect(won({ ...w, dams: [...w.dams, { ...whole, spot: 'core:other' }] })).toEqual(['firstDam']);
  });

  it('a full year counts from the start of the life', () => {
    // The new life is a baby, a teenager long before a year is up, so Growing up is won already.
    const w = { ...newLife({ ...lived(), clock: 5 * DAY_SECONDS }), achievements: ['grownUp' as const] };
    expect(won({ ...w, clock: w.journey.start + DAYS_PER_YEAR * DAY_SECONDS - 1 })).toEqual([]);
    expect(won({ ...w, clock: w.journey.start + DAYS_PER_YEAR * DAY_SECONDS })).toEqual(['year']);
  });
});
