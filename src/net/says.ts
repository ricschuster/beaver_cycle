// Talk between two players (#667, #802, docs/design/42_multiplayer.md): one asks a friend a short question or says a friendly phrase,
// the friend answers with a button, and the asker hears the answer. Pure, so a test can check it without a socket. A player is 'host' or the id the host gave
// a guest. The questions and answers are a fixed list of ids; the words are in the language tables.

/** What a player can ask a friend close by. */
export const QUESTIONS = ['swim', 'work', 'play'] as const;
export type QuestionId = (typeof QUESTIONS)[number];
/** Friendly words a player can say to a friend close by (Q116, #802). They change nothing in the game. */
export const PHRASES = ['hello', 'look', 'follow', 'thisway', 'nicedam', 'hungry', 'whatday', 'branch'] as const;
export type PhraseId = (typeof PHRASES)[number];
/** Everything a card can say: a question or a phrase. */
export type SayId = QuestionId | PhraseId;
/** How the friend can answer a yes or no (also the answer to an invitation to hide and seek). */
export const ANSWERS = ['yes', 'later'] as const;
export type AnswerId = (typeof ANSWERS)[number];
/** Every reply a friend can give to a say. */
export const REPLIES = ['yes', 'later', 'good', 'metoo', 'thanks', 'wow'] as const;
export type ReplyId = (typeof REPLIES)[number];

/** The replies the card offers to a question, and to a phrase. */
export const QUESTION_REPLIES: readonly ReplyId[] = ['yes', 'good', 'later'];
export const PHRASE_REPLIES: readonly ReplyId[] = ['metoo', 'thanks', 'wow'];
/** The replies for a say: a question is answered yes or not now, a phrase with a friendly word. */
export const repliesFor = (q: SayId): readonly ReplyId[] => (isQuestion(q) ? QUESTION_REPLIES : PHRASE_REPLIES);
/** A reply that agrees to a question: Yes! and Good idea!. */
export const agrees = (a: ReplyId | undefined): boolean => a === 'yes' || a === 'good';

/** The picture over the head of a speaker, for each say and reply (drawn in `render/speechBubble.ts`). */
export const PICTURES = ['heart', 'question', 'exclamation', 'star', 'branch', 'drop', 'smile', 'note'] as const;
export type PictureId = (typeof PICTURES)[number];
const PICTURE_OF: Record<SayId | ReplyId, PictureId> = {
  swim: 'drop', work: 'branch', play: 'question',
  hello: 'smile', look: 'exclamation', follow: 'note', thisway: 'exclamation', nicedam: 'star', hungry: 'branch', whatday: 'smile', branch: 'branch',
  yes: 'heart', later: 'drop', good: 'star', metoo: 'heart', thanks: 'smile', wow: 'star',
};
export const pictureOf = (id: SayId | ReplyId): PictureId => PICTURE_OF[id];

/** How many phrases the card offers at a time. */
export const PHRASES_SHOWN = 3;

/**
 * Some phrases, drawn at random, none twice. `rand` gives a number from 0 up to 1, so a test can steer it. Not all phrases show at
 * once: the card draws again each time it opens.
 */
export function pickPhrases(rand: () => number, count = PHRASES_SHOWN): PhraseId[] {
  const pool = [...PHRASES];
  const out: PhraseId[] = [];
  while (out.length < count && pool.length > 0) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]!);
  return out;
}

/** A question waits this many real seconds for an answer. */
export const SAY_TIME = 30;
/** An answered question stays this many real seconds, so the asker's tablet hears it. */
export const ANSWER_TIME = 8;

export interface Say {
  /** Counts up, so a tablet knows a question it has shown already. */
  n: number;
  from: string;
  to: string;
  q: SayId;
  at: number;
  a?: ReplyId;
  /** When the answer came. */
  answeredAt?: number;
}

export interface Says {
  list: readonly Say[];
  next: number;
}

export const noSays = (): Says => ({ list: [], next: 1 });

export const isQuestion = (v: unknown): v is QuestionId => typeof v === 'string' && (QUESTIONS as readonly string[]).includes(v);
export const isPhrase = (v: unknown): v is PhraseId => typeof v === 'string' && (PHRASES as readonly string[]).includes(v);
/** A question or a phrase. */
export const isSay = (v: unknown): v is SayId => isQuestion(v) || isPhrase(v);
export const isAnswer = (v: unknown): v is AnswerId => typeof v === 'string' && (ANSWERS as readonly string[]).includes(v);
export const isReply = (v: unknown): v is ReplyId => typeof v === 'string' && (REPLIES as readonly string[]).includes(v);

/** `from` asks `to` a question. A new question of `from` replaces the one it had. */
export function ask(s: Says, from: string, to: string, q: SayId, now: number): Says {
  if (from === to) return s;
  return { list: [...s.list.filter((k) => k.from !== from), { n: s.next, from, to, q, at: now }], next: s.next + 1 };
}

/** `to` answers the latest question put to it that has no answer yet. Nothing happens when there is none. */
export function answer(s: Says, to: string, a: ReplyId, now: number): Says {
  const open = s.list.filter((k) => k.to === to && k.a === undefined);
  const last = open.at(-1);
  if (!last) return s;
  return { ...s, list: s.list.map((k) => (k === last ? { ...k, a, answeredAt: now } : k)) };
}

/** Questions that waited too long and answers that were heard end. */
export function expire(s: Says, now: number): Says {
  const list = s.list.filter((k) => (k.a === undefined ? now - k.at <= SAY_TIME : now - (k.answeredAt ?? k.at) <= ANSWER_TIME));
  return list.length === s.list.length ? s : { ...s, list };
}

/** A player left: what they asked and what was asked of them ends. */
export function drop(s: Says, id: string): Says {
  return { ...s, list: s.list.filter((k) => k.from !== id && k.to !== id) };
}
