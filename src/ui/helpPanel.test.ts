import { describe, expect, it } from 'vitest';
import { welcomeLines, wantsWelcome } from './helpPanel';

const q = (s: string): URLSearchParams => new URLSearchParams(s);

describe('the welcome card', () => {
  it('shows the first time, and not again', () => {
    expect(wantsWelcome(false, q(''), false)).toBe(true);
    expect(wantsWelcome(true, q(''), false)).toBe(false);
  });

  it('stays out of an automated browser, so the playtests are not blocked', () => {
    expect(wantsWelcome(false, q(''), true)).toBe(false);
  });

  it('can be forced on or off from the address', () => {
    expect(wantsWelcome(true, q('welcome=1'), true)).toBe(true);
    expect(wantsWelcome(false, q('welcome=0'), false)).toBe(false);
  });

  it('names the keys the game really uses', () => {
    for (const k of ['W A S D', 'E', 'G', 'B']) expect(welcomeLines().keys).toContain(k);
  });
});
