import { afterEach, describe, expect, it } from 'vitest';
import { en } from './en';
import { LANGS, getLang, resolveLang, setLang, t, tList, type Key } from './index';

const PLACEHOLDER = /\{(\w+)\}/g;
const holders = (v: string | readonly string[]): string[] => (typeof v === 'string' ? [v] : v).flatMap((s) => [...s.matchAll(PLACEHOLDER)].map((m) => m[1] ?? '')).sort();

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
    for (const lang of LANGS) {
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
