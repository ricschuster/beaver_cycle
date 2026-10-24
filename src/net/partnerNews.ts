// What a change in the partner state of a player tells it (#666, #761): a toast for a new partner, a stopped partnership, kits born, or
// a question to stop or to be partners. The step from one snapshot to the next, as a plain function so a test can check each case.
import type { pairingOf } from './view';

export type Pairing = ReturnType<typeof pairingOf>;

/** What the player saw of its partner state at the last snapshot. */
export interface PartnerSeen {
  askedBy: number;
  asking: number;
  partner: string | null;
  /** The partner's name, kept for when it is gone. */
  name: string;
  stopBy: boolean;
  stopping: boolean;
  born: number | null;
}

export const noPartnerSeen = (): PartnerSeen => ({ askedBy: 0, asking: 0, partner: null, name: '', stopBy: false, stopping: false, born: null });

export interface PartnerNews {
  key: 'toast.partnered' | 'toast.kitsBorn' | 'toast.partnerStopped' | 'toast.partnerStopAsked' | 'toast.partnerStopAsk' | 'toast.partnerAsked' | 'toast.partnerAsk';
  /** The id whose name goes into the toast, or null to use the name kept in `seen`. */
  about: string | null;
  /** Kits born are the news: older toasts in the queue wait. */
  urgent: boolean;
  /** The partnership ended and the player's own `bornAt` changed: it was reborn as a kit and picks a new look. */
  kits: boolean;
}

/** The one thing to tell, if any, going from `seen` to `pairing` with the player born at `born`. */
export function partnerNews(pairing: Pairing, seen: PartnerSeen, born: number | null): PartnerNews | null {
  if (pairing.partner && pairing.partner !== seen.partner) return { key: 'toast.partnered', about: pairing.partner, urgent: false, kits: false };
  if (!pairing.partner && seen.partner) {
    const kits = born !== seen.born;
    return { key: kits ? 'toast.kitsBorn' : 'toast.partnerStopped', about: null, urgent: kits, kits };
  }
  if (pairing.partner && pairing.stopBy && !seen.stopBy) return { key: 'toast.partnerStopAsked', about: pairing.partner, urgent: false, kits: false };
  if (pairing.partner && pairing.stopping && !seen.stopping) return { key: 'toast.partnerStopAsk', about: pairing.partner, urgent: false, kits: false };
  if (!pairing.partner && pairing.askedBy.length > seen.askedBy) return { key: 'toast.partnerAsked', about: pairing.askedBy[0]!, urgent: false, kits: false };
  if (!pairing.partner && pairing.asking.length > seen.asking) return { key: 'toast.partnerAsk', about: pairing.asking[0]!, urgent: false, kits: false };
  return null;
}

/** What the player has seen once this snapshot is handled. `nameOfPartner` is the partner's name now, if there is one. */
export function seenNow(pairing: Pairing, before: PartnerSeen, nameOfPartner: string | null, born: number | null): PartnerSeen {
  return { askedBy: pairing.askedBy.length, asking: pairing.asking.length, partner: pairing.partner, name: pairing.partner ? nameOfPartner ?? before.name : before.name, stopBy: pairing.stopBy, stopping: pairing.stopping, born };
}
