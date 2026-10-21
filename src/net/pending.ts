// The host a tablet is about to join (ADR 0014). A guest starts a different game (no save, a grown beaver, the host's world), so
// the Join button keeps the address here and starts the game again; the new run reads it. It lives in the session, so closing the
// app ends it, and Leave clears it. It keeps the beaver's coat and look too: a guest starts a fresh world, and would else show the
// default beaver instead of the one the player dressed. Storage can be blocked, so a failed read is "no host" and a failed write is ignored.

import type { Coat } from '../sim/family';
import { cleanLook, type Look } from '../sim/look';
import { coatOf } from './protocol';

const KEY = 'beaver-cycle.join';

/** The most an address can hold: an IPv4 address or a short host name, nothing that could change the URL built from it. */
const ADDRESS = /^[A-Za-z0-9.-]{1,63}$/;

/** The address from what the player typed, or null when it is not one. */
export function cleanAddress(text: string): string | null {
  const a = text.trim();
  return ADDRESS.test(a) ? a : null;
}

/** Where to join and as whom. `me` is null when only an address is known (the start screen, a dev URL parameter): the guest then picks a look. */
export interface PendingJoin {
  address: string;
  me: { coat: Coat; look: Look } | null;
}

export function pendingJoin(storage: Pick<Storage, 'getItem'> | null): PendingJoin | null {
  try {
    const o = JSON.parse(storage?.getItem(KEY) ?? 'null') as { address?: unknown; coat?: unknown; look?: unknown } | null;
    const address = typeof o?.address === 'string' ? cleanAddress(o.address) : null;
    if (!address) return null;
    return { address, me: o?.coat && o.look ? { coat: coatOf(o.coat), look: cleanLook(o.look as Partial<Look>) } : null };
  } catch {
    return null;
  }
}

export function setPendingJoin(storage: Pick<Storage, 'setItem' | 'removeItem'> | null, join: { address: string; coat?: Coat; look?: Look } | null): void {
  try {
    if (join) storage?.setItem(KEY, JSON.stringify(join));
    else storage?.removeItem(KEY);
  } catch {
    // Not kept: the game starts as the host's own.
  }
}

const GUEST_KEY = 'beaver-cycle.guest-key';

/**
 * This tablet's own key as a guest, made once and kept in the browser's storage, so the host knows the player again after a break and
 * a pair and its lodge wait for them (#666). Without storage there is no key, and the host uses the connection instead.
 */
export function guestKey(storage: Pick<Storage, 'getItem' | 'setItem'> | null, random: () => number = Math.random): string | undefined {
  try {
    const have = storage?.getItem(GUEST_KEY);
    if (have && /^[a-z0-9]{8,24}$/.test(have)) return have;
    let k = '';
    while (k.length < 12) k += Math.floor(random() * 36).toString(36);
    storage?.setItem(GUEST_KEY, k);
    return storage ? k : undefined;
  } catch {
    return undefined;
  }
}
