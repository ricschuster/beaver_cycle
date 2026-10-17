// The English words of the game: the source of truth for the keys (docs/design/36_languages.md). Another language is a table
// with the same keys (`de.ts`), and `index.test.ts` fails when one is missing. A value is a string with `{name}` placeholders,
// or a list of strings when the game picks one of several. Plain data, no functions, so a translator can read it.
// The tables are in `en/`, one file for each part of the game.
import { achievements } from './en/achievements';
import { chatter } from './en/chatter';
import { coach } from './en/coach';
import { hud } from './en/hud';
import { talk } from './en/talk';
import { way } from './en/way';
import { ui } from './en/ui';

export const en = { ...ui, ...talk, ...chatter, ...coach, ...achievements, ...way, ...hud } as const;


export type Key = keyof typeof en;
export type Table = Readonly<Record<Key, string | readonly string[]>>;
