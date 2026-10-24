import { describe, expect, it } from 'vitest';
import { friendChoices } from './friendCard';

const none = { askedBy: [], asking: [], partner: null, stopBy: false, stopping: false };

describe('the card by a friend', () => {
  it('adds the phrases it is given after the questions, before hide and seek', () => {
    expect(friendChoices('g1', none, false, ['look', 'hello']).map((c) => [c.id, c.label])).toEqual([
      ['swim', 'Shall we swim together?'], ['work', 'Shall we work on a dam?'], ['play', 'Want to play?'], ['look', 'Look!'], ['hello', 'Hello!'], ['hide', 'Hide and seek?'], ['bye', 'Bye'],
    ]);
  });

  it('offers partners when both can, the questions, and Bye', () => {
    expect(friendChoices('g1', none, true).map((c) => c.id)).toEqual(['partner', 'swim', 'work', 'play', 'hide', 'bye']);
    expect(friendChoices('g1', none, false).map((c) => c.id)).toEqual(['swim', 'work', 'play', 'hide', 'bye']);
  });

  it('says yes to an ask of this friend, and asks to stop with the partner', () => {
    expect(friendChoices('g1', { ...none, askedBy: ['g1'] }, true)[0]!.label).toBe('Yes, partners!');
    expect(friendChoices('g1', { ...none, partner: 'g1' }, false)[0]!.label).toBe('Stop being partners?');
    expect(friendChoices('g1', { ...none, partner: 'g1', stopBy: true }, false)[0]!.label).toBe('Yes, stop');
  });

  it('does not offer partners with someone else as the partner', () => {
    expect(friendChoices('g1', { ...none, partner: 'g2' }, true).map((c) => c.id)).toEqual(['swim', 'work', 'play', 'hide', 'bye']);
  });
});
