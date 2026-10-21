// Talk between two players (#667, docs/design/42_multiplayer.md): one asks a friend a short question, the friend answers with a
// button, and the asker hears the answer. Pure, so a test can check it without a socket. A player is 'host' or the id the host gave
// a guest. The questions and answers are a fixed list of ids; the words are in the language tables.

/** What a player can ask a friend close by. */
export const QUESTIONS = ['swim', 'work', 'play'] as const;
export type QuestionId = (typeof QUESTIONS)[number];
/** How the friend can answer. */
export const ANSWERS = ['yes', 'later'] as const;
export type AnswerId = (typeof ANSWERS)[number];

/** A question waits this many real seconds for an answer. */
export const SAY_TIME = 30;
/** An answered question stays this many real seconds, so the asker's tablet hears it. */
export const ANSWER_TIME = 8;

export interface Say {
  /** Counts up, so a tablet knows a question it has shown already. */
  n: number;
  from: string;
  to: string;
  q: QuestionId;
  at: number;
  a?: AnswerId;
  /** When the answer came. */
  answeredAt?: number;
}

export interface Says {
  list: readonly Say[];
  next: number;
}

export const noSays = (): Says => ({ list: [], next: 1 });

export const isQuestion = (v: unknown): v is QuestionId => typeof v === 'string' && (QUESTIONS as readonly string[]).includes(v);
export const isAnswer = (v: unknown): v is AnswerId => typeof v === 'string' && (ANSWERS as readonly string[]).includes(v);

/** `from` asks `to` a question. A new question of `from` replaces the one it had. */
export function ask(s: Says, from: string, to: string, q: QuestionId, now: number): Says {
  if (from === to) return s;
  return { list: [...s.list.filter((k) => k.from !== from), { n: s.next, from, to, q, at: now }], next: s.next + 1 };
}

/** `to` answers the latest question put to it that has no answer yet. Nothing happens when there is none. */
export function answer(s: Says, to: string, a: AnswerId, now: number): Says {
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
