import { describe, expect, it } from 'vitest';
import { ASK_TIME, asked, askersOf, drop, expire, noPairing, partnerOf, press } from './pairs';

describe('partners between players', () => {
  it('one press asks and the other press says yes', () => {
    const asking = press(noPairing(), 'host', 'g1', 0);
    expect(asked(asking, 'host', 'g1')).toBe(true);
    expect(askersOf(asking, 'g1')).toEqual(['host']);
    expect(partnerOf(asking, 'g1')).toBeNull();
    const yes = press(asking, 'g1', 'host', 5);
    expect(partnerOf(yes, 'host')).toBe('g1');
    expect(partnerOf(yes, 'g1')).toBe('host');
    expect(yes.asks).toEqual([]);
  });

  it('asking again by the same one changes nothing but the time, and a new ask replaces the old', () => {
    const a = press(press(noPairing(), 'g1', 'g2', 0), 'g1', 'g3', 2);
    expect(a.asks).toEqual([{ from: 'g1', to: 'g3', at: 2 }]);
  });

  it('a pair ends the other asks of both, and a partner cannot be asked', () => {
    let p = press(noPairing(), 'g1', 'g2', 0);
    p = press(p, 'g3', 'g1', 0);
    p = press(p, 'g2', 'g1', 1);
    expect(p.asks).toEqual([]);
    expect(press(p, 'g3', 'g1', 2)).toBe(p);
    expect(press(p, 'g1', 'g3', 2)).toBe(p);
  });

  it('an ask runs out, and a leaver frees the partner', () => {
    const p = press(noPairing(), 'host', 'g1', 0);
    expect(expire(p, ASK_TIME).asks).toHaveLength(1);
    expect(expire(p, ASK_TIME + 1).asks).toHaveLength(0);
    const paired = press(p, 'g1', 'host', 1);
    expect(partnerOf(drop(paired, 'g1'), 'host')).toBeNull();
  });
});
