import { describe, expect, it } from 'vitest';
import { ASK_TIME, answer, isAsleep, leave, lie, noSleep, tick, wake, waitingFor } from './sleepCheck';

const all = ['host', 'g-a', 'g-b'];

describe('the sleep check', () => {
  it('lets a lone player skip at once', () => {
    const s = lie(noSleep(), 'host', 'night', false, ['host'], 0);
    expect(s.verdict).toEqual({ t: 'go', goal: 'night', woke: ['host'] });
    expect(s.check.asleep).toEqual([]);
  });

  it('asks the friends who are awake and goes when all say yes', () => {
    let s = lie(noSleep(), 'host', 'night', true, all, 0);
    expect(s.verdict).toBeNull();
    expect(waitingFor(s.check, all)).toEqual(['g-a', 'g-b']);
    s = answer(s.check, 'g-a', true, all, 1);
    expect(s.verdict).toBeNull();
    s = answer(s.check, 'g-b', true, all, 2);
    expect(s.verdict).toEqual({ t: 'go', goal: 'night', woke: ['host'] });
    // The dreamer is told, but its dream goes on until it wakes.
    expect(isAsleep(s.check, 'host')).toBe(true);
    expect(s.check.ask).toBeNull();
  });

  it('counts a friend who falls asleep as a yes', () => {
    let s = lie(noSleep(), 'host', 'night', false, all, 0);
    s = lie(s.check, 'g-a', 'night', true, all, 1);
    expect(s.verdict).toBeNull();
    s = answer(s.check, 'g-b', true, all, 2);
    expect(s.verdict).toEqual({ t: 'go', goal: 'night', woke: ['host', 'g-a'] });
  });

  it('stops on one no and wakes only the asker', () => {
    let s = lie(noSleep(), 'host', 'night', false, all, 0);
    s = lie(s.check, 'g-a', 'night', true, all, 1);
    s = answer(s.check, 'g-b', false, all, 2);
    expect(s.verdict).toEqual({ t: 'stop', from: 'host' });
    expect(isAsleep(s.check, 'host')).toBe(false);
    expect(isAsleep(s.check, 'g-a')).toBe(true);
    expect(s.check.ask).toBeNull();
  });

  it('lets a dreamer dream on when its skip is stopped', () => {
    let s = lie(noSleep(), 'host', 'night', true, all, 0);
    s = answer(s.check, 'g-a', false, all, 1);
    expect(s.verdict).toEqual({ t: 'stop', from: 'host' });
    expect(isAsleep(s.check, 'host')).toBe(true);
  });

  it('takes no answer in time as a no', () => {
    const s = lie(noSleep(), 'host', 'season', false, all, 0);
    expect(tick(s.check, all, ASK_TIME - 1).verdict).toBeNull();
    expect(tick(s.check, all, ASK_TIME).verdict).toEqual({ t: 'stop', from: 'host' });
  });

  it('ends the ask when the asker wakes', () => {
    const s = lie(noSleep(), 'host', 'night', false, all, 0);
    const w = wake(s.check, 'host', all, 3);
    expect(w.check).toEqual(noSleep());
    expect(w.verdict).toBeNull();
  });

  it('does not wait for a friend who left', () => {
    let s = lie(noSleep(), 'host', 'night', false, all, 0);
    s = answer(s.check, 'g-a', true, all, 1);
    s = leave(s.check, 'g-b', all, 2);
    expect(s.verdict).toEqual({ t: 'go', goal: 'night', woke: ['host'] });
  });

  it('takes a late sleeper after a stopped skip as a new ask', () => {
    let s = lie(noSleep(), 'host', 'night', true, all, 0);
    s = answer(s.check, 'g-a', false, all, 1);
    s = lie(s.check, 'g-b', 'night', false, all, 5);
    expect(s.verdict).toBeNull();
    expect(s.check.ask?.from).toBe('g-b');
    expect(s.check.ask?.awake).toEqual(['g-a']);
  });

  it('ignores answers from the asleep and from strangers', () => {
    const s = lie(noSleep(), 'host', 'night', false, all, 0);
    expect(answer(s.check, 'host', false, all, 1).verdict).toBeNull();
    expect(answer(s.check, 'nobody', false, all, 1).verdict).toBeNull();
  });
});
