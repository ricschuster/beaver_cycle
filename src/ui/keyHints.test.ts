import { describe, expect, it } from 'vitest';
import { KEY_HINTS, wordLine } from './keyHints';

describe('the key hints', () => {
  it('name every game key', () => {
    const listed = KEY_HINTS.map(([k]) => k).join(' ');
    for (const k of ['W A S D', 'Space', 'T', 'E', 'G']) expect(listed).toContain(k);
    // B was Build, which is now Do on E (#341).
    expect(KEY_HINTS.map(([k]) => k)).not.toContain('B');
  });

  it('give every key a description', () => {
    for (const [k, what] of KEY_HINTS) {
      expect(k.length).toBeGreaterThan(0);
      expect(what.length).toBeGreaterThan(0);
    }
  });

  it('show what E and G do here, or that they do nothing', () => {
    expect(wordLine('E', 'Talk')).toContain('talk');
    expect(wordLine('G', null)).toContain('nothing here');
  });
});
