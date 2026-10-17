// Every line a beaver says to the player (docs/design/27_families_and_dialog.md). The words are in the language tables, `src/i18n/en/talk.ts`
// and the other languages; this file says which key each table reads and what shape it has. Short, gentle and for children from 8: a kit
// is cheeky and short, a mama warm, a papa practical. `talk.ts` picks from these by pure functions; nothing here is chosen. The news
// hints live in `news.ts`. No DOM.
import { fill, list, t, tree } from '../i18n';
import type { Season } from './clock';
import type { Carry, Errand, Feeling, NeighbourKind, Reply, SpeakerKind, Task } from './talk';

/** Who is spoken of in a line: the speaker's name, and its pond ("north pond") when known. */
export interface Who {
  name: string;
  place?: string;
}

/** A line with `{name}` and `{from}` filled in for the one spoken of: ", from the north pond" is added when the pond is known. */
export const withWho = (line: string, w: Who): string => fill(line, { name: w.name, from: w.place ? t('talk.from', { place: w.place }) : '' });

/** A line with `{since}` filled in: the season it last saw the player ("the snow"). */
export const withSince = (line: string, since: string): string => fill(line, { since });

/** The words on the reply buttons. */
export const REPLY_LABEL = tree<Record<Reply, string>>('talk.reply');

/** A remark about the player, by role and feeling. A wary beaver only warns. */
export const REMARK = tree<Record<SpeakerKind, Record<Feeling, readonly string[]>>>('talk.remark');

/** A remark about the season, for anyone who is not wary. */
export const SEASONAL = tree<Record<Season, readonly string[]>>('talk.seasonal');

/** A remark after dark, in place of the season. */
export const night = (): readonly string[] => list('talk.night');

/** The first time a beaver of another family talks to the player: it says who it is. Lines hold `{name}` and `{from}` (`withWho`). */
export const FIRST_MEETING = tree<Record<NeighbourKind, Record<'calm' | 'curious', readonly string[]>>>('talk.first');

/** A beaver met again before long. */
export const AGAIN = tree<Record<NeighbourKind, readonly string[]>>('talk.again');

/** How a beaver names the season it last saw the player in: "I have not seen you since the snow". */
export const SINCE = tree<Record<Season, string>>('talk.since');

/** A beaver met again after a long time away (`LONG_AWAY`). Lines hold `{since}` (`withSince`). */
export const LONG_AWAY_LINES = tree<Record<SpeakerKind, readonly string[]>>('talk.longAway');

/** A family that took a gift from the player or its family remembers it (trust is kept for the family, from life to life). */
export const THANKS = tree<Record<NeighbourKind, readonly string[]>>('talk.thanks');

/** A beaver the player dug out of the snow in this life remembers it. Only a mama or a papa gets stuck. Lines hold `{name}` and `{from}`. */
export const RESCUED = tree<Record<NeighbourKind, readonly string[]>>('talk.rescued');

/** A beaver an earlier life of the family dug out of the snow. */
export const KIN_RESCUE = tree<Record<NeighbourKind, string>>('talk.kinRescue');

/** What Mama, Papa and the partner say about the player's life, each only when it is true (`talk.ts` checks). */
export type LifeFact = 'baby' | 'teen' | 'storeLow' | 'lodgeWorn' | 'damWorn' | 'firstDam' | 'ownLodge' | 'building' | 'noLodge' | 'mate' | 'lonely' | 'kitsSoon';

export const LIFE = tree<Record<'home-mama' | 'home-papa' | 'partner', Partial<Record<LifeFact, readonly string[]>>>>('talk.life');

/** "What are you doing?" for a beaver of another family on an errand: one line, or one for what it carries. */
export interface ErrandLines {
  lines: readonly string[];
  carrying?: Partial<Record<Carry, string>>;
}

export const DOING = tree<Record<NeighbourKind, Partial<Record<Errand, ErrandLines>>>>('talk.doing');

/** Why the store matters, by season, after a store line. */
export const STORE_WHY = tree<Record<Season, string>>('talk.storeWhy');

/** "What are you doing?" when the beaver has no errand, by what it does. */
export const TASK_DOING = tree<Record<NeighbourKind, Partial<Record<Task, readonly string[]>>>>('talk.taskDoing');

/** "What are you doing?" for Mama and Papa out in the pond on an errand (`routines.ts`). */
export const HOME_ERRANDS = tree<Record<'home-mama' | 'home-papa', Partial<Record<Errand, ErrandLines>>>>('talk.homeErrands');

/** "What are you doing?" for Mama, Papa and the partner. */
export const HOME_DOING = tree<{
  'home-mama': { nest: string; young: string; grown: string };
  'home-papa': { nest: string; young: string; grown: string; worn: string };
  partner: { following: string; home: string };
}>('talk.homeDoing');

/** "Can I help?" to a family that is wary of the player. */
export const HELP_WARY = tree<Record<NeighbourKind, readonly string[]>>('talk.helpWary');

/** "Can I help?" to a family that knows the player: a gift put down near them, which they take (`giftFamilies`). */
export const HELP = tree<Record<NeighbourKind, Partial<Record<Errand | 'any', string>>>>('talk.help');

/** "Can I help?" to Mama, Papa and the partner: one true job, most useful first. */
export type HomeJob = 'baby' | 'storeLow' | 'lodgeWorn' | 'damWorn' | 'noLodge' | 'building' | 'lonely' | 'storeRoom' | 'none';

export const HOME_HELP = tree<Record<'home-mama' | 'home-papa' | 'partner', Record<HomeJob, string>>>('talk.homeHelp');

/** The answer to "Bye": a short goodbye, then the card closes. */
export const FAREWELL = tree<Record<SpeakerKind, Record<'wary' | 'warm', readonly string[]>>>('talk.farewell');

/** "Any news?" to a beaver that does not trust the player enough to tell. */
export const NOT_YET = tree<Record<SpeakerKind, string>>('talk.notYet');

/** "Any news?" when nothing is true to tell. */
export const NO_NEWS = tree<Record<SpeakerKind, string>>('talk.noNews');

/** Who a speaker is, under its name on the card. */
export const ROLE_WORD = tree<Record<SpeakerKind, string>>('talk.role');
