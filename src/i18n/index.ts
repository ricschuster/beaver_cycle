// The words of the game in the player's language (docs/design/36_languages.md). `t(key, params)` gives a string from the table
// of the language set with `setLang`, the English one when that language lacks the key. No DOM, no dependency.
import { de } from './de';
import { en, type Key, type Table } from './en';

export type { Key } from './en';
export type Lang = 'en' | 'de';
/** What the player picks in Settings: a language, or "auto" to follow the device. */
export type LangChoice = Lang | 'auto';

/** The languages whose tables are complete and shipped; Settings offers only these. German joins when its table is done. */
export const LANGS: readonly Lang[] = ['en'];

const TABLES: Partial<Record<Lang, Partial<Table>>> = { en, de };

let current: Lang = 'en';

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

/** The file of a plain page (`manual`, `privacy`) in a language: `manual.html` for English, `manual.de.html` for German. */
export function pageFile(name: string, lang: Lang = current): string {
  return lang === 'en' ? `${name}.html` : `${name}.${lang}.html`;
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

type Entry = string | readonly string[];
type Params = Readonly<Record<string, string | number>>;
const ENGLISH: Readonly<Record<string, Entry>> = en;
/** Every key, in the order of the English table (the order of the lines a game picks from, so every language picks alike). */
const KEYS: readonly string[] = Object.keys(en);

/** The entry of a key: a string, or the list of lines for a key the game picks from. Undefined for a key that does not exist. */
function entry(key: string): Entry | undefined {
  return (TABLES[current] as Readonly<Record<string, Entry>> | undefined)?.[key] ?? ENGLISH[key];
}

/** The text with its `{placeholders}` filled in; a placeholder without a value stays as it is. */
export function fill(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/**
 * A read-only view of the keys under `prefix` as nested objects, for tables the game indexes by role, season, errand and the like
 * (`tree('talk.remark')['mama']['wary']` reads the list at `talk.remark.mama.wary`). Read when it is indexed, so it follows the
 * language set now. A key that exists gives its string or list; a part of a key gives a view; anything else is undefined.
 */
export function tree<T>(prefix: string): T {
  const below = (path: string): string[] => {
    const seen = new Set<string>();
    for (const k of KEYS) if (k.startsWith(`${path}.`)) seen.add(k.slice(path.length + 1).split('.')[0]!);
    return [...seen];
  };
  const read = (path: string): unknown => {
    const e = entry(path);
    if (e !== undefined) return typeof e === 'string' ? e : [...e];
    return below(path).length > 0 ? tree(path) : undefined;
  };
  return new Proxy({}, {
    get: (_, p) => (typeof p === 'string' ? read(`${prefix}.${p}`) : undefined),
    has: (_, p) => typeof p === 'string' && read(`${prefix}.${p}`) !== undefined,
    ownKeys: () => below(prefix),
    getOwnPropertyDescriptor: (_, p) => (typeof p === 'string' && read(`${prefix}.${p}`) !== undefined ? { enumerable: true, configurable: true, value: read(`${prefix}.${p}`) } : undefined),
  }) as T;
}

/** The ids under `prefix` in table order: `groups('chatter.everyday')` gives `a`, `b` for the keys `chatter.everyday.a.call` and `.a.reply`. */
export function groups(prefix: string): string[] {
  const seen = new Set<string>();
  for (const k of KEYS) if (k.startsWith(`${prefix}.`)) seen.add(k.slice(prefix.length + 1).split('.')[0]!);
  return [...seen];
}

/** The text of a key by name (for keys made up at run time, such as `achievement.name.${id}`). */
export function text(key: string, params?: Params): string {
  const e = entry(key);
  return fill(typeof e === 'string' ? e : (e?.[0] ?? key), params);
}

/** The lines of a list key by name, placeholders left as they are (the caller fills them). */
export function list(key: string): string[] {
  const e = entry(key);
  return typeof e === 'string' ? [e] : [...(e ?? [])];
}

/** Every key of the English table, for the review page and the tests. */
export const ALL_KEYS: readonly string[] = KEYS;

/** The text of a key with its `{placeholders}` filled in. For a list key, the first line (use `tList` to pick). */
export function t(key: Key, params?: Params): string {
  const e = entry(key);
  return fill(typeof e === 'string' ? e : (e?.[0] ?? ''), params);
}

/** The lines of a list key, each with its placeholders filled in. */
export function tList(key: string, params?: Params): string[] {
  const e = entry(key);
  return (typeof e === 'string' ? [e] : (e ?? [])).map((s) => fill(s, params));
}

/** A function of one string whose answers are kept for the language set now (the tables do not change while it runs). */
export function memoByLang<R>(build: (key: string) => R): (key: string) => R {
  const kept = new Map<string, R>();
  return (key) => {
    const id = `${current}:${key}`;
    let v = kept.get(id);
    if (v === undefined) {
      v = build(key);
      kept.set(id, v);
    }
    return v;
  };
}
