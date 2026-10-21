import { describe, expect, it } from 'vitest';
import { hideLine } from './hideCount';

const game = (phase: 'invite' | 'count' | 'seek' | 'cheer', role: 'hide' | 'seek' | null, left: number) => ({ key: 'host:0', phase, asker: 'host', role, invitedMe: false, found: [], left });

describe('the count of hide and seek', () => {
  it('tells a seeker to count and a hider to run, with the seconds rounded up', () => {
    expect(hideLine(game('count', 'seek', 6.2))).toBe('Counting... 7');
    expect(hideLine(game('count', 'hide', 6.2))).toBe('Run and hide! 7');
  });

  it('shows the time left while seeking', () => {
    expect(hideLine(game('seek', 'seek', 40))).toBe('Seeking: 40 s left');
    expect(hideLine(game('seek', 'hide', 40))).toBe('Hiding: 40 s left');
  });

  it('shows nothing outside the game or in the invitation and the cheer', () => {
    expect(hideLine(null)).toBeNull();
    expect(hideLine(game('count', null, 5))).toBeNull();
    expect(hideLine(game('invite', 'hide', 0))).toBeNull();
    expect(hideLine(game('cheer', 'hide', 0))).toBeNull();
  });
});
