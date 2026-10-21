import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK } from '../sim/look';
import { cleanAddress, guestKey, pendingJoin, setPendingJoin } from './pending';

const store = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
};

describe('cleanAddress', () => {
  it('takes an IP address or a host name, trimmed', () => {
    expect(cleanAddress(' 192.168.0.7 ')).toBe('192.168.0.7');
    expect(cleanAddress('tablet-1.local')).toBe('tablet-1.local');
  });

  it('refuses what would change the URL or is empty', () => {
    expect(cleanAddress('')).toBeNull();
    expect(cleanAddress('1.2.3.4/x?y')).toBeNull();
    expect(cleanAddress('a b')).toBeNull();
    expect(cleanAddress('x'.repeat(64))).toBeNull();
  });
});

describe('pendingJoin', () => {
  it('gives no outfit when only an address was kept', () => {
    const s = store();
    s.setItem('beaver-cycle.join', JSON.stringify({ address: '10.0.0.2' }));
    expect(pendingJoin(s)).toEqual({ address: '10.0.0.2', me: null });
  });

  it('keeps the address until it is cleared', () => {
    const s = store();
    expect(pendingJoin(s)).toBeNull();
    setPendingJoin(s, { address: '10.0.0.2', coat: { coat: 2, shade: 0.5 }, look: { ...DEFAULT_LOOK, hat: 1, name: 'Mo' } });
    expect(pendingJoin(s)).toEqual({ address: '10.0.0.2', me: { coat: { coat: 2, shade: 0.5 }, look: { ...DEFAULT_LOOK, hat: 1, name: 'Mo' } } });
    setPendingJoin(s, null);
    expect(pendingJoin(s)).toBeNull();
  });

  it('survives storage that throws or is missing', () => {
    const blocked = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => { throw new Error('no'); } };
    expect(pendingJoin(blocked)).toBeNull();
    expect(() => setPendingJoin(blocked, { address: '10.0.0.2', coat: { coat: 0, shade: 0 }, look: DEFAULT_LOOK })).not.toThrow();
    expect(pendingJoin(null)).toBeNull();
  });
});

describe('the guest key', () => {
  it('is made once and kept', () => {
    const s = store();
    const k = guestKey(s);
    expect(k).toMatch(/^[a-z0-9]{8,24}$/);
    expect(guestKey(s)).toBe(k);
  });

  it('is none without storage', () => {
    expect(guestKey(null)).toBeUndefined();
  });
});
