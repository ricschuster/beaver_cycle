import { afterEach, describe, expect, it } from 'vitest';
import { ACHIEVEMENT_IDS, achievementRows } from '../sim/achievements';
import { createWorld } from '../sim/state';
import type { Terrain } from '../sim/terrain';
import { stepsOf } from '../ui/coachSteps';
import { en } from './en';
import { ALL_KEYS, LANGS, getLang, type Lang, resolveLang, setLang, t, tList, type Key } from './index';

const PLACEHOLDER = /\{(\w+)\}/g;
const holders = (v: string | readonly string[]): string[] => (typeof v === 'string' ? [v] : v).flatMap((s) => [...s.matchAll(PLACEHOLDER)].map((m) => m[1] ?? '')).sort();

const dry: Terrain = { heightAt: () => 0, isWater: () => false, waterDepth: () => 0 };
const count = (v: string | readonly string[]): number => (typeof v === 'string' ? 1 : v.length);

afterEach(() => setLang('en'));

describe('t', () => {
  it('gives the English words and fills the placeholders', () => {
    expect(t('settings.title')).toBe('Settings');
    expect(t('achievements.summary', { won: 3, all: 40 })).toBe('3 of 40 won');
  });

  it('keeps a placeholder it has no value for', () => {
    expect(t('achievements.progress', { have: 1 })).toBe('1 of {need}');
  });

  it('gives a list key as lists and as its first line', () => {
    expect(tList('ui.close')).toEqual(['Close']);
  });
});

describe('resolveLang', () => {
  it('follows the device for auto, and English for what is not shipped', () => {
    expect(resolveLang('auto', ['fr-FR'])).toBe('en');
    expect(resolveLang('auto', null)).toBe('en');
    expect(resolveLang('en', ['de-AT'])).toBe('en');
    if (LANGS.includes('de')) expect(resolveLang('auto', ['de-AT', 'en'])).toBe('de');
  });
});

describe('the tables', () => {
  it('has no empty English text', () => {
    for (const [key, v] of Object.entries(en)) expect((typeof v === 'string' ? [v] : v).every((s) => s.trim() !== ''), key).toBe(true);
  });

  it('has every key, with the same placeholders, in every shipped language', async () => {
    // German is checked before it ships too, so the draft stays complete while the author reviews it.
    for (const lang of new Set<Lang>([...LANGS, 'de'])) {
      if (lang === 'en') continue;
      setLang(lang);
      const table = (await import(`./${lang}.ts`))[lang] as Record<Key, string | readonly string[]>;
      for (const key of Object.keys(en) as Key[]) {
        expect(table[key], `${lang} lacks ${key}`).toBeDefined();
        expect(holders(table[key]), `${lang} ${key} placeholders`).toEqual(holders(en[key]));
        expect(count(table[key]), `${lang} ${key} length`).toBe(count(en[key]));
      }
      expect(getLang()).toBe(lang);
    }
  });
});

describe('the keys the code builds at run time', () => {
  const has = (key: string): boolean => ALL_KEYS.includes(key) || ALL_KEYS.some((k) => k.startsWith(`${key}.`));
  const every = (prefix: string, ids: readonly string[], suffixes: readonly string[] = ['']): void => {
    for (const id of ids) for (const s of suffixes) expect(has(`${prefix}.${id}${s}`), `${prefix}.${id}${s}`).toBe(true);
  };

  it('exist for seasons, stages, directions and animals', () => {
    every('season', ['spring', 'summer', 'autumn', 'winter']);
    every('daypart', ['morning', 'midday', 'evening', 'night']);
    every('stage', ['baby', 'teenager', 'adult']);
    every('way.compass', ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']);
    every('animal', ['fox', 'owl', 'lynx', 'wolf', 'bear']);
    for (const what of ['caught', 'scared', 'noticed']) every(`predator.${what}`, ['fox', 'owl', 'lynx', 'wolf', 'bear']);
  });

  it('exist for the status line, guides and sleeping', () => {
    every('hud.site', ['ok', 'dry', 'deep', 'far']);
    every('hud.spot', ['hole', 'nest', 'room']);
    every('hud.hint', ['pick', 'strip', 'branch', 'lily', 'rock', 'mud', 'store', 'eat']);
    every('hud.carry', ['branch', 'lily', 'mud', 'rock']);
    every('hud.repair', ['lodge', 'store'], ['Broken', 'Worn']);
    every('hud.also', ['lodge', 'store']);
    every('sleep.until', ['teenager', 'adult']);
    every('btn', ['eat', 'build', 'mend', 'store', 'dig', 'talk', 'gnaw', 'strip', 'mark', 'drop', 'take', 'dive', 'slap', 'do']);
    for (const kind of ['otter', 'kingfisher']) for (const what of ['called', 'arrived', 'lost']) expect(has(`guide.${what}.${kind}`)).toBe(true);
  });

  it('exist for every achievement, row and coach step', () => {
    for (const part of ['text', 'name', 'hint']) every(`achievement.${part}`, ACHIEVEMENT_IDS);
    every('achievement.group', ['building', 'gathering', 'family', 'valley']);
    for (const row of achievementRows(createWorld(dry))) expect(typeof row.name === 'string' && row.name.length > 0, row.line).toBe(true);
    for (const stage of ['baby', 'teenager', 'adult'] as const) {
      expect(has(`coach.done.${stage}`)).toBe(true);
      for (const step of stepsOf(stage)) every(`coach.step.${step.id}`, ['title', 'touch', 'keys']);
    }
  });
});
