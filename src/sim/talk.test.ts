import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, dateAt, withSeason } from './clock';
import { LODGE_WOOD, type Lodge } from './lodge';
import { LONG_AWAY, MAX_ASKS, TALK_RANGE, choicesFor, factsFor, greeting, homeJob, nearestSpeaker, noteTalk, pickLine, replyLine, roleOf, speakersOf, type Reply, type Speaker, type TalkFacts } from './talk';
import { createWorld, newLife, setStage, type WorldState } from './state';
import { emptyStock } from './food';
import type { Terrain } from './terrain';

const land: Terrain = { heightAt: () => 0, isWater: () => false, waterDepth: () => 0 };
const speaker = (id: string, kind: Speaker['kind'], x: number, z: number): Speaker => ({ id, name: id, kind, family: null, x, z });
const noon = 0.5 * DAY_SECONDS;
const ctx = (feeling: 'wary' | 'calm' | 'curious', seed = 0) => ({ feeling, season: 'spring' as const, clock: noon, seed });

describe('nearestSpeaker', () => {
  it('finds the nearest one in reach, or none', () => {
    const list = [speaker('a', 'kit', 5, 0), speaker('b', 'mama', 2, 0), speaker('c', 'papa', 50, 0)];
    expect(nearestSpeaker(list, { x: 0, z: 0 })?.id).toBe('b');
    expect(nearestSpeaker([speaker('c', 'papa', TALK_RANGE + 1, 0)], { x: 0, z: 0 })).toBeNull();
  });
});

describe('pickLine', () => {
  it('is the same for the same inputs', () => {
    expect(pickLine({ id: 'k', kind: 'kit' }, ctx('calm', 3))).toBe(pickLine({ id: 'k', kind: 'kit' }, ctx('calm', 3)));
  });

  it('has a line for every kind and the feelings it can have', () => {
    for (const kind of ['mama', 'papa', 'kit'] as const) for (const f of ['wary', 'calm', 'curious'] as const) expect(pickLine({ id: 'x', kind }, ctx(f)).length).toBeGreaterThan(0);
    for (const kind of ['home-mama', 'home-papa', 'partner'] as const) expect(pickLine({ id: 'x', kind }, ctx('curious')).length).toBeGreaterThan(0);
  });

  it('only warns when wary, and varies over talks otherwise', () => {
    const wary = new Set(Array.from({ length: 20 }, (_, i) => pickLine({ id: 'm', kind: 'mama' }, ctx('wary', i))));
    expect([...wary].every((l) => ['Hmm. Who are you?', 'Stay back, please.'].includes(l))).toBe(true);
    const calm = new Set(Array.from({ length: 20 }, (_, i) => pickLine({ id: 'm', kind: 'mama' }, ctx('calm', i))));
    expect(calm.size).toBeGreaterThan(2);
  });

  it('speaks of the night after dark', () => {
    const lines = new Set(Array.from({ length: 30 }, (_, i) => pickLine({ id: 'p', kind: 'papa' }, { ...ctx('calm', i), clock: 0.95 * DAY_SECONDS })));
    expect([...lines].some((l) => /owls|Quiet/.test(l))).toBe(true);
  });
});

describe('speakersOf', () => {
  it('lists neighbours, both parents, and partners that are not alone', () => {
    const n = [{ id: 'f:mama', name: 'Hazel', family: 'f', role: 'mama' as const, x: 1, z: 1 }];
    const parents = [{ id: 'mama', x: 2, z: 2, inside: false }, { id: 'papa', x: 3, z: 3, inside: true }];
    const partners = [{ id: 'p1', x: 4, z: 4, state: 'following' as const }, { id: 'p2', x: 5, z: 5, state: 'alone' as const }];
    const list = speakersOf(n, parents, partners, () => 'Reed');
    expect(list.map((s) => s.kind)).toEqual(['mama', 'home-mama', 'home-papa', 'partner']);
    expect(list[0]!.name).toBe('Hazel');
    expect(list[3]!.name).toBe('Reed');
  });

  it('passes on what a neighbour does and why, and its pond, and leaves out words it does not know', () => {
    const n = [
      { id: 'f:mama', name: 'Hazel', family: 'f', role: 'mama' as const, x: 1, z: 1, task: 'carry', errand: 'store', carry: 'branch' },
      { id: 'f:papa', name: 'Flint', family: 'f', role: 'papa' as const, x: 1, z: 1, task: 'fly', errand: 'moon', carry: null },
    ];
    const [mama, papa] = speakersOf(n, [], [], () => '', () => 'north pond');
    expect(mama).toMatchObject({ task: 'carry', errand: 'store', carry: 'branch', place: 'north pond' });
    expect(papa!.task).toBeUndefined();
    expect(papa!.errand).toBeUndefined();
    expect(papa!.carry).toBeUndefined();
    expect(speakersOf(n, [], [], () => '')[0]!.place).toBeUndefined();
  });
});

const lodge = (wood = LODGE_WOOD): Lodge => ({ x: 0, z: 0, base: 0, door: 0, wood });
const world = (over: Partial<WorldState> = {}): WorldState => ({ ...createWorld(land, 0, 0), ...over });
const willow: Speaker = { id: 'f:mama', name: 'Willow', kind: 'mama', family: 'f', x: 0, z: 0, place: 'north pond' };
const curious = { f: 0.9 };
const many = (n: number, line: (seed: number) => string): Set<string> => new Set(Array.from({ length: n }, (_, i) => line(i)));

describe('noteTalk', () => {
  it('counts the talks with a beaver and keeps the clock of the last', () => {
    const once = noteTalk(world({ clock: 100 }), 'a');
    const twice = noteTalk({ ...once, clock: 250 }, 'a');
    expect(once.met['a']).toEqual({ talks: 1, last: 100 });
    expect(twice.met['a']).toEqual({ talks: 2, last: 250 });
  });

  it('is forgotten when a new life begins, as nobody has met the baby yet', () => {
    expect(newLife(noteTalk(world(), 'a')).met).toEqual({});
  });
});

describe('greeting', () => {
  it('says who it is the first time, and is glad to see the player again after', () => {
    const w = world({ trust: { f: 0.5 } });
    const first = greeting(willow, factsFor(w, willow), 0);
    expect(first).toContain('I am Willow, from the north pond.');
    const again = noteTalk(w, willow.id);
    const second = many(10, (i) => greeting(willow, factsFor(again, willow), i));
    expect([...second].some((l) => l.includes('Willow'))).toBe(false);
    expect([...second].some((l) => /again/i.test(l))).toBe(true);
  });

  it('remembers a long time away by the season it last saw the player', () => {
    const winter = withSeason(0, 'winter', 2);
    const met = noteTalk(world({ clock: winter, trust: curious }), willow.id);
    const later = { ...met, clock: winter + LONG_AWAY + 10 };
    expect(greeting(willow, factsFor(later, willow), 0)).toContain('since the snow');
    expect(greeting(willow, factsFor({ ...met, clock: winter + 60 }, willow), 0)).not.toContain('since');
  });

  it('only warns when the family is wary, even the first time', () => {
    const lines = many(10, (i) => greeting(willow, factsFor(world(), willow), i));
    expect([...lines].every((l) => ['Hmm. Who are you?', 'Stay back, please.'].includes(l))).toBe(true);
  });

  it('thanks the player for a gift, and remembers being dug out of the snow', () => {
    expect(greeting(willow, factsFor(world({ trust: { f: 0.4 } }), willow), 0)).toMatch(/kind to us/);
    const winter = withSeason(0, 'winter');
    const year = dateAt(winter).year;
    const saved = world({ trust: { f: 0.7 }, guides: [willow.id], rescued: [`f:stuck:${year}`] });
    expect(greeting(willow, factsFor(saved, willow), 0)).toContain('You dug me out of the snow!');
    // Dug out by an earlier life of the family: this life began a year later.
    const later = { ...saved, journey: { ...saved.journey, start: winter + 40 * DAY_SECONDS } };
    expect(greeting(willow, factsFor(later, willow), 0)).toContain('Your family dug me out');
  });

  it('never says the same greeting twice in a row', () => {
    const w = noteTalk(world({ trust: curious }), willow.id);
    for (let i = 0; i < 20; i++) {
      const last = greeting(willow, factsFor(w, willow), i);
      expect(greeting(willow, factsFor(w, willow), i, last)).not.toBe(last);
    }
  });
});

describe('Mama, Papa and the partner', () => {
  const mama: Speaker = { id: 'mama', name: 'Mama', kind: 'home-mama', family: null, x: 0, z: 0 };
  const papa: Speaker = { id: 'papa', name: 'Papa', kind: 'home-papa', family: null, x: 0, z: 0 };
  const lines = (who: Speaker, w: WorldState): Set<string> => many(40, (i) => greeting(who, factsFor(w, who), i));

  it('speak to a baby as a baby, and urge a teenager toward a lodge of its own', () => {
    const baby = setStage(world({ lodge: lodge() }), 'baby');
    expect([...lines(mama, baby)].some((l) => /little one|growing/.test(l))).toBe(true);
    expect([...lines(mama, baby)].some((l) => /store|dam/.test(l))).toBe(false);
    const teen = setStage(world({ lodge: lodge() }), 'teenager');
    expect([...lines(mama, teen)].some((l) => /lodge of your own/.test(l))).toBe(true);
  });

  it('worry kindly about a low store in autumn, and only then', () => {
    const autumn = setStage(world({ lodge: lodge(), clock: withSeason(0, 'autumn', 2), store: emptyStock() }), 'teenager');
    expect([...lines(mama, autumn)].some((l) => /store looks thin/.test(l))).toBe(true);
    const summer = setStage({ ...autumn, clock: withSeason(0, 'summer', 2) }, 'teenager');
    expect([...lines(mama, summer)].some((l) => /store looks thin/.test(l))).toBe(false);
  });

  it('praise the first dam, and ask a grown beaver about its lodge', () => {
    const dam = setStage(world({ achievements: ['firstDam'] }), 'teenager');
    expect([...lines(papa, dam)].some((l) => /your dam/.test(l))).toBe(true);
    const grown = world();
    expect([...lines(papa, grown)].some((l) => /lodge/.test(l))).toBe(true);
    expect([...lines(papa, { ...grown, lodge: lodge(3) })].some((l) => /getting there/.test(l))).toBe(true);
  });

  it('say what errand they are on out in the pond, and rest talk stays about the player', () => {
    const teen = setStage(world({ lodge: lodge() }), 'teenager');
    const atDam: Speaker = { ...papa, errand: 'dam', carry: 'branch' };
    expect(replyLine('doing', atDam, factsFor(teen, atDam), 0)).toMatch(/dam/);
    const resting: Speaker = { ...papa, errand: 'rest' };
    expect(replyLine('doing', resting, factsFor(teen, resting), 0)).toBe(replyLine('doing', papa, factsFor(teen, papa), 0));
  });

  it('get their errand and load from the routine through speakersOf', () => {
    const [p] = speakersOf([], [{ id: 'papa', x: 0, z: 0, inside: false, task: 'carry', errand: 'store', carry: 'branch' }], [], () => '');
    expect(p).toMatchObject({ kind: 'home-papa', task: 'carry', errand: 'store', carry: 'branch' });
  });

  it('give a true job for "Can I help?", most useful first', () => {
    expect(homeJob('home-mama', factsFor(setStage(world(), 'baby'), mama))).toBe('baby');
    const autumn = setStage(world({ lodge: lodge(), clock: withSeason(0, 'autumn', 2) }), 'teenager');
    expect(homeJob('home-mama', factsFor(autumn, mama))).toBe('storeLow');
    expect(replyLine('help', mama, factsFor(autumn, mama), 0)).toMatch(/branches/);
    expect(homeJob('home-mama', factsFor(world(), mama))).toBe('noLodge');
    expect(homeJob('partner', factsFor(world({ lodge: lodge(4) }), mama))).toBe('building');
  });
});

describe('choicesFor', () => {
  const facts = (feeling: TalkFacts['feeling'], guide = false) => ({ feeling, guide });

  it('offers at most three, with Bye always last', () => {
    for (const kind of ['mama', 'kit', 'home-papa', 'partner'] as const) {
      for (const feeling of ['wary', 'calm', 'curious'] as const) {
        const c = choicesFor({ kind }, facts(feeling, true), []);
        expect(c.length).toBeLessThanOrEqual(3);
        expect(c.at(-1)).toBe('bye');
      }
    }
  });

  it('does not ask the same twice, and ends a talk after two questions', () => {
    expect(choicesFor({ kind: 'mama' }, facts('curious'), [])).toEqual(['doing', 'news', 'bye']);
    expect(choicesFor({ kind: 'mama' }, facts('curious'), ['doing'])).not.toContain('doing');
    const two: Reply[] = ['doing', 'news'];
    expect(two.length).toBe(MAX_ASKS);
    expect(choicesFor({ kind: 'mama' }, facts('curious'), two)).toEqual(['bye']);
  });

  it('lets a wary beaver only be asked to help, and a guide show the way', () => {
    expect(choicesFor({ kind: 'papa' }, facts('wary'), [])).toEqual(['help', 'bye']);
    expect(choicesFor({ kind: 'papa' }, facts('curious', true), [])).toContain('lead');
    expect(choicesFor({ kind: 'papa' }, facts('curious', false), [])).not.toContain('lead');
  });
});

describe('replyLine', () => {
  const at = (season: 'autumn' | 'summer', trust = 0.9) => factsFor(world({ clock: withSeason(0, season, 2), trust: { f: trust } }), willow);

  it('says what a beaver is doing and why, from its errand and what it carries', () => {
    expect(replyLine('doing', { ...willow, errand: 'store', carry: 'branch' }, at('autumn'), 0)).toBe('I am taking this branch to our store. Winter comes fast.');
    const papa: Speaker = { ...willow, id: 'f:papa', kind: 'papa', errand: 'dam' };
    expect(replyLine('doing', papa, at('summer'), 0)).toMatch(/dam/);
    const kit: Speaker = { ...willow, id: 'f:kit', kind: 'kit', errand: 'play' };
    expect(replyLine('doing', kit, at('summer'), 0)).toMatch(/!/);
  });

  it('falls back to the task, or swimming, without an errand', () => {
    expect(replyLine('doing', willow, at('summer'), 0)).toBe('Just swimming round our pond.');
    expect(replyLine('doing', { ...willow, task: 'rest' }, at('summer'), 0)).toBe('Resting in the sun.');
  });

  it('asks for a gift put down near them, and a wary family is not ready', () => {
    expect(replyLine('help', { ...willow, errand: 'store' }, at('summer'), 0)).toContain('Put a branch down near us');
    expect(replyLine('help', willow, at('summer', 0.1), 0)).toMatch(/Maybe one day/);
  });

  it('says a goodbye that fits, and not the same twice in a row', () => {
    const f = at('summer');
    for (let i = 0; i < 10; i++) {
      const bye = replyLine('bye', willow, f, i);
      expect(bye.length).toBeGreaterThan(0);
      expect(replyLine('bye', willow, f, i, bye)).not.toBe(bye);
    }
  });
});

describe('roleOf', () => {
  it('names the role and the pond, or the relation to the player', () => {
    expect(roleOf({ kind: 'papa', place: 'north pond' })).toBe('papa of the north pond');
    expect(roleOf({ kind: 'kit' })).toBe('kit');
    expect(roleOf({ kind: 'home-mama' })).toBe('your mama');
  });
});
