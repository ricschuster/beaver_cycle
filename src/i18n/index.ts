// The words of the game in the player's language (docs/design/36_languages.md). `t(key, params)` gives a string from the table
// of the language set with `setLang`, the English one when that language lacks the key. No DOM, no dependency.
import { en, type Key, type Table } from './en';

export type { Key } from './en';
export type Lang = 'en' | 'de';
/** What the player picks in Settings: a language, or "auto" to follow the device. */
export type LangChoice = Lang | 'auto';

/** The languages whose tables are complete and shipped; Settings offers only these. German joins when its table is done. */
export const LANGS: readonly Lang[] = ['en'];

const TABLES: Partial<Record<Lang, Partial<Table>>> = { en };

let current: Lang = 'en';

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

/** The language for a choice: the device language (`de-AT` gives `de`) for "auto", English when that is not shipped. */
export function resolveLang(choice: LangChoice, device: readonly string[] | string | null | undefined): Lang {
  const want: string = choice === 'auto' ? firstOf(device) : choice;
  return (LANGS as readonly string[]).includes(want) ? (want as Lang) : 'en';
}

function firstOf(device: readonly string[] | string | null | undefined): string {
  const first = typeof device === 'string' ? device : device?.[0];
  return (first ?? '').toLowerCase().split('-')[0] ?? '';
}

/** The entry of a key: a string, or the list of lines for a key the game picks from. */
function entry(key: Key): string | readonly string[] {
  return TABLES[current]?.[key] ?? en[key];
}

function fill(text: string, params?: Readonly<Record<string, string | number>>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/** The text of a key with its `{placeholders}` filled in. For a list key, the first line (use `tList` to pick). */
export function t(key: Key, params?: Readonly<Record<string, string | number>>): string {
  const e = entry(key);
  return fill(typeof e === 'string' ? e : (e[0] ?? ''), params);
}

/** The lines of a list key, each with its placeholders filled in. */
export function tList(key: Key, params?: Readonly<Record<string, string | number>>): string[] {
  const e = entry(key);
  return (typeof e === 'string' ? [e] : e).map((s) => fill(s, params));
}
