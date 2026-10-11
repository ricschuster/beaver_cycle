import { describe, expect, it } from 'vitest';
import {
  CALL_SLOT, ERRAND_LINES, EVERYDAY, GREETINGS, PLAYER_LINES, SEASON_LINES, addressOf, deedsFor, fill, giftThanks, greetingFor, labelOf, overheard, partnerRemark,
  type Chatterer, type Deeds, type ExchangeLine,
} from './chatter';
import { DAY_SECONDS, DAYS_PER_SEASON } from './clock';
import type { DamSpot } from './damSpots';
import { FAMILY_START_TRUST, WORD_RANGE, WORD_SHARE, spreadWord } from './familyMoods';
import { LODGE_WOOD, type Lodge } from './lodge';
import type { Neighbour } from './neighbours';
import { nameOf } from './names';
import type { Partner } from './partners';
import { createWorld, type WorldState } from './state';
import type { Terrain } from './terrain';

const land: Terrain = { heightAt: () => 0, isWater: () => false, waterDepth: () => 0 };
const base = createWorld(land, 0, 0);
const SLOTS = 200;

const member = (family: string, role: 'mama' | 'papa' | 'kit', name: string, x: number, more: Partial<Chatterer> = {}): Chatterer => ({
  id: `${family}:${role === 'kit' ? `kit:0:${name}` : role}`, name, family, role, x, z: 0, ...more,
});
const family = [member('f', 'mama', 'Hazel', 5), member('f', 'kit', 'Reed', 8)];
const deeds = (d: Partial<Deeds> = {}): Deeds => ({ mood: 'calm', met: false, gift: false, rescued: null, dam: false, lodge: false, startled: false, ...d });

/** Every exchange over many slots from a clock start. */
function heard(beavers: readonly Chatterer[], about?: (f: string) => Deeds | null, start = 0, slots = SLOTS) {
  return Array.from({ length: slots }, (_, i) => overheard(beavers, { x: 0, z: 0 }, start + i * CALL_SLOT + 1, about)).filter((e) => e !== null);
}
const calls = (lines: readonly ExchangeLine[]): string[] => lines.map((l) => l.call.split('{to}').at(-1)!);
const said = (texts: readonly string[], lines: readonly ExchangeLine[]): boolean => texts.some((t) => calls(lines).some((c) => t.endsWith(c)));

describe('overheard', () => {
  it('is the same for the same slot, and sometimes talks, sometimes not', () => {
    const all = Array.from({ length: 40 }, (_, i) => overheard(family, { x: 0, z: 0 }, i * CALL_SLOT + 1));
    expect(all.some((c) => c !== null)).toBe(true);
    expect(all.some((c) => c === null)).toBe(true);
    expect(overheard(family, { x: 0, z: 0 }, 3 * CALL_SLOT + 1)).toEqual(overheard(family, { x: 0, z: 0 }, 3 * CALL_SLOT + 2));
    expect(CALL_SLOT).toBeLessThan(DAY_SECONDS);
  });

  it('is a call and a reply between two of the family, with names', () => {
    for (const e of heard(family)) {
      expect(e.family).toBe('f');
      expect(e.call.who).not.toBe(e.reply.who);
      expect(['Mama Hazel', 'Reed']).toContain(e.call.who);
      expect(['Mama Hazel', 'Reed']).toContain(e.reply.who);
      // A kit says "Mama", the mama says the kit's name.
      if (e.call.who === 'Reed') expect(`${e.call.text} ${e.reply.text}`).not.toContain('Hazel');
      expect(`${e.call.text}${e.reply.text}`).not.toMatch(/[{}]/);
    }
  });

  it('needs two of a family within hearing', () => {
    expect(overheard([family[0]!], { x: 0, z: 0 }, 0)).toBeNull();
    expect(overheard(family, { x: 500, z: 0 }, 0)).toBeNull();
  });

  it('keeps each line to its speakers: two kits never call each other home', () => {
    const kits = [member('f', 'kit', 'Reed', 5), member('f', 'kit', 'Moss', 6)];
    const texts = heard(kits).map((e) => e.call.text);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.some((t) => t.includes('come back to the lodge'))).toBe(false);
  });

  it('follows the errand when one is known, and does without', () => {
    const busy = [member('f', 'papa', 'Alder', 5, { errand: 'dam', task: 'carry', carry: 'branch' }), member('f', 'kit', 'Reed', 8)];
    expect(said(heard(busy).map((e) => e.call.text), ERRAND_LINES.dam)).toBe(true);
    expect(said(heard(family).map((e) => e.call.text), ERRAND_LINES.dam)).toBe(false);
  });

  it('talks about the season', () => {
    const winter = 3 * DAYS_PER_SEASON * DAY_SECONDS;
    // A season is 10 days of 12 slots: stay within the winter.
    const texts = heard(family, undefined, winter, 110).map((e) => e.call.text);
    expect(said(texts, SEASON_LINES.winter)).toBe(true);
    expect(said(texts, SEASON_LINES.spring)).toBe(false);
  });

  it('whispers about the stranger in a wary family, and never thanks it', () => {
    const texts = heard(family, () => deeds({ mood: 'wary' })).map((e) => e.call.text);
    expect(said(texts, PLAYER_LINES.wary)).toBe(true);
    expect(said(texts, PLAYER_LINES.gift)).toBe(false);
  });

  it('talks warmly of the player once met, by what it did, and not before', () => {
    const kind = heard(family, () => deeds({ mood: 'curious', met: true, gift: true })).map((e) => e.call.text);
    expect(said(kind, PLAYER_LINES.gift)).toBe(true);
    const unmet = heard(family, () => deeds({ mood: 'curious', gift: true })).map((e) => e.call.text);
    expect(said(unmet, PLAYER_LINES.gift)).toBe(false);
    expect(said(unmet, PLAYER_LINES.friend)).toBe(false);
  });

  it('names the beaver the player dug out, or says "me" when it is the caller', () => {
    const texts = heard(family, () => deeds({ mood: 'curious', met: true, rescued: 'f:mama' })).filter((e) => e.call.text.includes('out of the snow'));
    expect(texts.length).toBeGreaterThan(0);
    for (const e of texts) expect(e.call.text).toContain(e.call.who === 'Mama Hazel' ? 'dug me out' : 'dug you out');
  });

  it('every line has its placeholders filled for any pair of speakers', () => {
    for (const line of [...EVERYDAY, ...Object.values(ERRAND_LINES).flat()]) {
      expect(fill(line.call, { to: 'Reed' })).not.toBeNull();
      expect(fill(line.reply, { from: 'Mama' })).not.toBeNull();
    }
  });
});

describe('names in the chatter', () => {
  it('shows parents as Mama and Papa, and a kit calls them so', () => {
    expect(labelOf({ name: 'Hazel', role: 'mama' })).toBe('Mama Hazel');
    expect(labelOf({ name: 'Reed', role: 'kit' })).toBe('Reed');
    expect(addressOf({ role: 'kit' }, { name: 'Alder', role: 'papa' })).toBe('Papa');
    expect(addressOf({ role: 'mama' }, { name: 'Alder', role: 'papa' })).toBe('Alder');
  });
});

const lodgeAt = (x: number, z: number): Lodge => ({ x, z, base: 0, door: 0, wood: LODGE_WOOD });
const neighbour = (id: string, x: number, z: number): Neighbour => ({ id, lodge: lodgeAt(x, z), parents: [{ coat: 0, shade: 0 }, { coat: 0, shade: 0 }], seed: 1 });
const spot = (id: string, x: number, z: number): DamSpot => ({ id, bed: { x, z }, bedY: 0, flow: { x: 0, z: 1 }, maxCrest: 2, pondM2: 100 });

describe('deedsFor', () => {
  const w: WorldState = { ...base, neighbours: [neighbour('f', 0, 0)] };

  it('knows nothing of a family never met', () => {
    expect(deedsFor(w, 'f')).toEqual(deeds({ mood: 'wary' }));
  });

  it('reads the meeting, the rescue, the slap, the dam and the lodge from the world', () => {
    expect(deedsFor({ ...w, trust: { f: 0.5 } }, 'f').met).toBe(true);
    expect(deedsFor(w, 'f', { greeted: new Set(['f']) }).met).toBe(true);
    expect(deedsFor(w, 'f', { gifts: new Set(['f']) }).gift).toBe(true);
    expect(deedsFor({ ...w, guides: ['f:papa'] }, 'f').rescued).toBe('f:papa');
    expect(deedsFor({ ...w, guides: ['g:papa'] }, 'f').rescued).toBeNull();
    expect(deedsFor({ ...w, trust: { f: 0 } }, 'f').startled).toBe(true);
    expect(deedsFor(w, 'f', { slaps: new Set(['f']) }).startled).toBe(true);
    const dams = [{ spot: 's', wood: 99, mud: 99, rock: 99 }];
    expect(deedsFor({ ...w, spots: [spot('s', 100, 0)], dams }, 'f').dam).toBe(true);
    expect(deedsFor({ ...w, spots: [spot('s', 900, 0)], dams }, 'f').dam).toBe(false);
    expect(deedsFor({ ...w, lodge: lodgeAt(50, 0) }, 'f').lodge).toBe(true);
    expect(deedsFor({ ...w, lodge: { ...lodgeAt(50, 0), wood: 1 } }, 'f').lodge).toBe(false);
  });
});

describe('greetingFor', () => {
  const members = [member('f', 'mama', 'Hazel', 5), member('f', 'kit', 'Reed', 8)];

  it('keeps the branch hint for a wary family, and says the slap made them jump', () => {
    expect(greetingFor(deeds({ mood: 'wary' }), members, 'north pond', 0)).toContain('Put a branch down');
    expect(greetingFor(deeds({ mood: 'wary', met: true, startled: true }), members, 'north pond', 0)).toContain('tail slap');
  });

  it('greets by name, again, and thanks by what the player did', () => {
    const all = (d: Deeds) => [0, 1, 2, 3].map((s) => greetingFor(d, members, 'north pond', s));
    expect(all(deeds({ met: true })).some((t) => t.includes('Mama Hazel') || t.includes('north pond'))).toBe(true);
    expect(all(deeds({ mood: 'curious', met: true, rescued: 'f:papa' }))).toContain(GREETINGS.rescue[0].replace('{guide}', nameOf('f:papa')));
    expect(all(deeds({ mood: 'curious', met: true, gift: true })).every((t) => t.includes('gift'))).toBe(true);
    expect(greetingFor(deeds({ mood: 'curious', met: true }), members, 'north pond', 1)).toBe('Reed swims over to say hello');
    expect(greetingFor(deeds({ mood: 'curious', met: true }), [], 'north pond', 1)).toBe('The beaver family is happy to see you');
  });
});

describe('giftThanks', () => {
  it('thanks for what was given, by the errand of the family', () => {
    const storing = [member('f', 'mama', 'Hazel', 5, { errand: 'store' })];
    expect(giftThanks('branch', storing, 0)).toBe('Mama Hazel: "Just what we needed for the store!" They trust you a little more');
    expect(giftThanks('lily', [member('f', 'papa', 'Alder', 5, { errand: 'food' })], 0)).toContain('Dinner is ready');
    expect(giftThanks('lily', storing, 0)).toContain('lily pad');
    expect(giftThanks('branch', [], 0)).toContain('The beavers take it');
  });
});

describe('partnerRemark', () => {
  const p = (state: Partner['state'], x = 0, z = 0): Partner => ({ id: 'partner:s1', x, z, heading: 0, coat: 0, shade: 0, state, metAt: 0, homeAt: state === 'home' ? 0 : null });
  const remarks = (w: WorldState, pad: { x: number; z: number } | null = null) => Array.from({ length: 60 }, (_, i) => partnerRemark({ ...w, clock: i * CALL_SLOT + 1 }, pad));

  it('says nothing without a partner, or a lone one', () => {
    expect(remarks(base).every((r) => r === null)).toBe(true);
    expect(remarks({ ...base, partners: [p('alone')] }).every((r) => r === null)).toBe(true);
  });

  it('remarks in about half the slots while following, by its name, the same in a slot', () => {
    const w = { ...base, partners: [p('following')] };
    const r = remarks(w);
    const some = r.filter((x) => x !== null);
    expect(some.length).toBeGreaterThan(10);
    expect(some.length).toBeLessThan(50);
    expect(some[0]!.who).toBe(nameOf('partner:s1'));
    expect(partnerRemark({ ...w, clock: 5 * CALL_SLOT + 1 }, null)).toEqual(partnerRemark({ ...w, clock: 5 * CALL_SLOT + 9 }, null));
  });

  it('points out a free dam spot and lily pads near, not a spot with a dam', () => {
    const w = { ...base, partners: [p('following')], spots: [spot('s', 40, 0)] };
    expect(remarks(w).some((r) => r?.text.includes('dam') && r.text.includes('close by'))).toBe(true);
    expect(remarks({ ...w, dams: [{ spot: 's', wood: 0, mud: 0, rock: 0 }] }).some((r) => r?.text.includes('dam spot') || r?.text.includes('good for a dam'))).toBe(false);
    expect(remarks({ ...base, partners: [p('following')] }, { x: 0, z: -30 }).some((r) => r?.text.includes('lily pads') && r.text.includes('close by'))).toBe(true);
  });

  it('talks about the home only near it', () => {
    const w = { ...base, partners: [p('home')], lodge: lodgeAt(200, 0) };
    expect(remarks(w).every((r) => r === null)).toBe(true);
    const near = remarks({ ...w, lodge: lodgeAt(10, 0) }).filter((r) => r !== null);
    expect(near.length).toBeGreaterThan(0);
    expect(near.some((r) => r.text.includes('Our lodge') || r.text.includes('our pond') || r.text.includes('Home sweet'))).toBe(true);
  });
});

describe('spreadWord (familyMoods)', () => {
  const families = [neighbour('a', 0, 0), neighbour('b', 2000, 0), neighbour('c', 300, 0), neighbour('d', 3000, 0)];
  const w: WorldState = { ...base, neighbours: families, trust: { a: 0.7, b: 0.4 } };

  it('raises the families the player has met, or near, by a third of the gain', () => {
    const next = spreadWord(w, 'a', 0.3);
    expect(next.trust.a).toBe(0.7);
    expect(next.trust.b).toBeCloseTo(0.4 + 0.3 * WORD_SHARE);
    expect(next.trust.c).toBeCloseTo(FAMILY_START_TRUST + 0.3 * WORD_SHARE);
    expect(next.trust.d).toBeUndefined();
    expect(Math.hypot(300, 0)).toBeLessThanOrEqual(WORD_RANGE);
  });

  it('counts the families met this visit, and never lowers or passes 1', () => {
    expect(spreadWord(w, 'a', 0.3, new Set(['d'])).trust.d).toBeCloseTo(FAMILY_START_TRUST + 0.1);
    expect(spreadWord({ ...w, trust: { a: 1, b: 1 } }, 'a', 0.3).trust.b).toBe(1);
    expect(spreadWord(w, 'a', -1)).toBe(w);
    const slapped = spreadWord({ ...w, trust: { a: 0.7, b: 0 } }, 'a', 0.3);
    expect(slapped.trust.b).toBeGreaterThan(0);
  });
});
