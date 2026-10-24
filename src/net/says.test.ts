import { describe, expect, it } from 'vitest';
import { ANSWER_TIME, PHRASES, PHRASES_SHOWN, PICTURES, QUESTIONS, REPLIES, SAY_TIME, agrees, answer, ask, drop, expire, isAnswer, isQuestion, isReply, isSay, noSays, pickPhrases, pictureOf, repliesFor } from './says';

describe('talk between players', () => {
  it('a question is put, and the friend answers the latest one', () => {
    const s = answer(ask(noSays(), 'host', 'g1', 'swim', 0), 'g1', 'yes', 3);
    expect(s.list).toEqual([{ n: 1, from: 'host', to: 'g1', q: 'swim', at: 0, a: 'yes', answeredAt: 3 }]);
  });

  it('a new question of the same player replaces its old one', () => {
    const s = ask(ask(noSays(), 'host', 'g1', 'swim', 0), 'host', 'g2', 'play', 4);
    expect(s.list.map((k) => [k.to, k.q, k.n])).toEqual([['g2', 'play', 2]]);
  });

  it('an answer with nothing asked, or to oneself, changes nothing', () => {
    expect(answer(noSays(), 'g1', 'yes', 1)).toEqual(noSays());
    expect(ask(noSays(), 'g1', 'g1', 'swim', 0)).toEqual(noSays());
  });

  it('only the first answer counts', () => {
    const s = answer(ask(noSays(), 'host', 'g1', 'work', 0), 'g1', 'later', 1);
    expect(answer(s, 'g1', 'yes', 2)).toBe(s);
  });

  it('an unanswered question ends after SAY_TIME and an answer after ANSWER_TIME', () => {
    const asked = ask(noSays(), 'host', 'g1', 'swim', 0);
    expect(expire(asked, SAY_TIME).list).toHaveLength(1);
    expect(expire(asked, SAY_TIME + 1).list).toHaveLength(0);
    const answered = answer(asked, 'g1', 'yes', 10);
    expect(expire(answered, 10 + ANSWER_TIME).list).toHaveLength(1);
    expect(expire(answered, 10 + ANSWER_TIME + 1).list).toHaveLength(0);
  });

  it('a player who left takes its questions with it', () => {
    const s = ask(ask(noSays(), 'host', 'g1', 'swim', 0), 'g2', 'host', 'play', 0);
    expect(drop(s, 'g1').list.map((k) => k.from)).toEqual(['g2']);
  });

  it('reads only known ids', () => {
    expect(isQuestion('swim')).toBe(true);
    expect(isQuestion('hack')).toBe(false);
    expect(isAnswer('later')).toBe(true);
    expect(isAnswer(3)).toBe(false);
  });
});

describe('friendly phrases (#802)', () => {
  it('draws a few different phrases, and a different few when the draw differs', () => {
    let i = 0;
    const walk = () => [0, 0.5, 0.99][i++ % 3]!;
    const some = pickPhrases(walk);
    expect(some).toHaveLength(PHRASES_SHOWN);
    expect(new Set(some).size).toBe(PHRASES_SHOWN);
    expect(pickPhrases(() => 0)).toEqual(PHRASES.slice(0, PHRASES_SHOWN));
    expect(pickPhrases(() => 0.999)).not.toEqual(pickPhrases(() => 0));
  });

  it('never offers more phrases than there are', () => {
    expect(pickPhrases(Math.random, 100)).toHaveLength(PHRASES.length);
    expect(new Set(pickPhrases(Math.random, 100)).size).toBe(PHRASES.length);
  });

  it('knows a phrase from a question, and a reply from a yes or no', () => {
    expect(isSay('look')).toBe(true);
    expect(isSay('swim')).toBe(true);
    expect(isQuestion('look')).toBe(false);
    expect(isSay('<b>')).toBe(false);
    expect(isReply('thanks')).toBe(true);
    expect(isReply('swim')).toBe(false);
    expect(isAnswer('thanks')).toBe(false);
  });

  it('answers a question yes or not now, and a phrase with a friendly word', () => {
    expect(repliesFor('swim')).toEqual(['yes', 'good', 'later']);
    expect(repliesFor('look')).toEqual(['metoo', 'thanks', 'wow']);
    expect(agrees('yes') && agrees('good')).toBe(true);
    expect(agrees('later') || agrees('wow') || agrees(undefined)).toBe(false);
  });

  it('carries a phrase and its reply like a question', () => {
    const s = answer(ask(noSays(), 'host', 'g1', 'nicedam', 0), 'g1', 'thanks', 2);
    expect(s.list).toEqual([{ n: 1, from: 'host', to: 'g1', q: 'nicedam', at: 0, a: 'thanks', answeredAt: 2 }]);
  });

  it('has a picture for every say and reply', () => {
    for (const id of [...QUESTIONS, ...PHRASES, ...REPLIES]) expect(PICTURES).toContain(pictureOf(id));
  });
});
