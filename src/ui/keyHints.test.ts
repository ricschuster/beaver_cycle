import { describe, expect, it } from 'vitest';
import { KEY_HINTS } from './keyHints';

describe('the key hints', () => {
  it('name every game key', () => {
    const listed = KEY_HINTS.map(([k]) => k).join(' ');
    for (const k of ['W A S D', 'Space', 'T', 'E', 'G', 'B']) expect(listed).toContain(k);
  });

  it('give every key a description', () => {
    for (const [k, what] of KEY_HINTS) {
      expect(k.length).toBeGreaterThan(0);
      expect(what.length).toBeGreaterThan(0);
    }
  });
});
