// The host a tablet is about to join (ADR 0014). A guest starts a different game (no save, a grown beaver, the host's world), so
// the Join button keeps the address here and starts the game again; the new run reads it. It lives in the session, so closing the
// app ends it, and Leave clears it. Storage can be blocked, so a failed read is "no host" and a failed write is ignored.

const KEY = 'beaver-cycle.join';

/** The most an address can hold: an IPv4 address or a short host name, nothing that could change the URL built from it. */
const ADDRESS = /^[A-Za-z0-9.-]{1,63}$/;

/** The address from what the player typed, or null when it is not one. */
export function cleanAddress(text: string): string | null {
  const a = text.trim();
  return ADDRESS.test(a) ? a : null;
}

export function pendingJoin(storage: Pick<Storage, 'getItem'> | null): string | null {
  try {
    return cleanAddress(storage?.getItem(KEY) ?? '');
  } catch {
    return null;
  }
}

export function setPendingJoin(storage: Pick<Storage, 'setItem' | 'removeItem'> | null, address: string | null): void {
  try {
    if (address) storage?.setItem(KEY, address);
    else storage?.removeItem(KEY);
  } catch {
    // Not kept: the game starts as the host's own.
  }
}
