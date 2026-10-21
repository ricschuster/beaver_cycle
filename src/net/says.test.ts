import { describe, expect, it } from 'vitest';
import { ANSWER_TIME, SAY_TIME, answer, ask, drop, expire, isAnswer, isQuestion, noSays } from './says';

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
