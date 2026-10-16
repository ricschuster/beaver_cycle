import { describe, expect, it } from 'vitest';
import { prettyLine } from './settingsPanel';

describe('prettyLine', () => {
  it('draws a tick for a won achievement and a ring for one still to win, with its count', () => {
    expect(prettyLine('[x] Home')).toBe('✓ Home');
    expect(prettyLine('[ ] Wood 3/10')).toBe('○ Wood 3/10');
  });

  it('leaves any other line alone', () => {
    expect(prettyLine('Home')).toBe('Home');
  });
});
