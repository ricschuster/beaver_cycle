import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, PREFS_KEY, loadPrefs, parsePrefs, savePrefs } from './prefs';

describe('parsePrefs', () => {
  it('gives the defaults for nothing or for rubbish', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('not json')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('7')).toEqual(DEFAULT_PREFS);
  });

  it('reads the choices and drops a mode it does not know', () => {
    expect(parsePrefs('{"minimap":"north","shadows":true}')).toEqual({ minimap: 'north', shadows: true, lang: 'auto', lastHost: '' });
    expect(parsePrefs('{"lang":"de"}').lang).toBe('de');
    expect(parsePrefs('{"lang":"klingon"}').lang).toBe('auto');
    expect(parsePrefs('{"lastHost":"10.0.0.2"}').lastHost).toBe('10.0.0.2');
    expect(parsePrefs('{"lastHost":5}').lastHost).toBe('');
    expect(parsePrefs('{"minimap":"sideways","shadows":"yes"}')).toEqual(DEFAULT_PREFS);
  });
});

describe('savePrefs and loadPrefs', () => {
  it('keep the choices between runs', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    savePrefs(storage, { minimap: 'off', shadows: true, lang: 'de', lastHost: '192.168.0.7' });
    expect(data.has(PREFS_KEY)).toBe(true);
    expect(loadPrefs(storage)).toEqual({ minimap: 'off', shadows: true, lang: 'de', lastHost: '192.168.0.7' });
  });

  it('survive storage that throws or is missing', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadPrefs(blocked)).toEqual(DEFAULT_PREFS);
    expect(() => savePrefs(blocked, DEFAULT_PREFS)).not.toThrow();
    expect(loadPrefs(null)).toEqual(DEFAULT_PREFS);
  });
});
