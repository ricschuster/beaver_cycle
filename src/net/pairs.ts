// Partners between two players (#666, docs/design/42_multiplayer.md, Q110 to Q112): one asks, the other says yes with the same press.
// Pure, so a test can check it without a socket. A player is 'host' or the id the host gave a guest.

/** An ask waits this many real seconds for a yes. */
export const ASK_TIME = 30;

export interface Ask {
  from: string;
  to: string;
  at: number;
}

export interface Pairing {
  asks: readonly Ask[];
  pairs: readonly (readonly [string, string])[];
}

export const noPairing = (): Pairing => ({ asks: [], pairs: [] });

export const partnerOf = (p: Pairing, id: string): string | null => {
  const pair = p.pairs.find(([a, b]) => a === id || b === id);
  return pair ? (pair[0] === id ? pair[1] : pair[0]) : null;
};

/** True when `from` has asked `to` and the ask is still open. */
export const asked = (p: Pairing, from: string, to: string): boolean => p.asks.some((a) => a.from === from && a.to === to);

/** The players with an open ask for `id`. */
export const askersOf = (p: Pairing, id: string): string[] => p.asks.filter((a) => a.to === id).map((a) => a.from);

/**
 * `from` presses Partner by `to`. If `to` asked `from` already, they become partners and every other ask of either ends; else
 * `from` asks `to` (a new ask replaces the one `from` had). Nothing happens when either one has a partner.
 */
export function press(p: Pairing, from: string, to: string, now: number): Pairing {
  if (from === to || partnerOf(p, from) || partnerOf(p, to)) return p;
  if (asked(p, to, from)) {
    return { asks: p.asks.filter((a) => ![from, to].includes(a.from) && ![from, to].includes(a.to)), pairs: [...p.pairs, [to, from]] };
  }
  return { ...p, asks: [...p.asks.filter((a) => a.from !== from), { from, to, at: now }] };
}

/** The asks that have waited too long end. */
export function expire(p: Pairing, now: number): Pairing {
  const asks = p.asks.filter((a) => now - a.at <= ASK_TIME);
  return asks.length === p.asks.length ? p : { ...p, asks };
}

/** A player left: their asks end, and their partner is alone again. */
export function drop(p: Pairing, id: string): Pairing {
  return { asks: p.asks.filter((a) => a.from !== id && a.to !== id), pairs: p.pairs.filter(([a, b]) => a !== id && b !== id) };
}
