// Partners between two players (#666, docs/design/42_multiplayer.md, Q110 to Q112): one asks, the other says yes with the same press.
// Pure, so a test can check it without a socket. A player is 'host' or the id the host gave a guest.

/** An ask waits this many real seconds for a yes. */
export const ASK_TIME = 30;

export interface Ask {
  from: string;
  to: string;
  at: number;
  /** True for an ask to stop being partners (Q4): the same press from the partner says yes. */
  stop?: boolean;
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
export const asked = (p: Pairing, from: string, to: string): boolean => p.asks.some((a) => a.from === from && a.to === to && !a.stop);

/** The players with an open ask for `id`. */
export const askersOf = (p: Pairing, id: string): string[] => p.asks.filter((a) => a.to === id && !a.stop).map((a) => a.from);

/** The pair of `a` and `b` ends, and the asks between them. */
export function unpair(p: Pairing, a: string, b: string): Pairing {
  return { asks: p.asks.filter((k) => ![a, b].includes(k.from) || ![a, b].includes(k.to)), pairs: p.pairs.filter(([x, y]) => !([x, y].includes(a) && [x, y].includes(b))) };
}

/**
 * `from` presses Partner by `to`. If `to` asked `from` already, they become partners and every other ask of either ends; else
 * `from` asks `to` (a new ask replaces the one `from` had). Nothing happens when either one has a partner.
 */
export function press(p: Pairing, from: string, to: string, now: number): Pairing {
  if (from === to) return p;
  // Partners press at each other to stop: the first press asks, the other's press says yes and the pair ends (Q4).
  if (partnerOf(p, from) === to) {
    if (p.asks.some((a) => a.from === to && a.to === from && a.stop)) return unpair(p, from, to);
    return { ...p, asks: [...p.asks.filter((a) => !(a.from === from && a.stop)), { from, to, at: now, stop: true }] };
  }
  if (partnerOf(p, from) || partnerOf(p, to)) return p;
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

/** A player is away: their asks end, but a pair stays, for the partner to come back to (note 48, Q3). */
export function dropAsks(p: Pairing, id: string): Pairing {
  return { ...p, asks: p.asks.filter((a) => a.from !== id && a.to !== id) };
}

/** The pairs of the lodges already built, for a host that starts again: a pair lives as long as its lodge. */
export function restore(lodges: readonly { players: readonly [string, string]; kitsAt?: number }[]): Pairing {
  return { asks: [], pairs: lodges.filter((l) => l.kitsAt === undefined).map((l) => [l.players[0], l.players[1]] as const) };
}
