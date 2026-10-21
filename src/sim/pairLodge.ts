// The lodge two partners build together (#666, docs/design/48_partner_lodge_and_kits.md). It is an ordinary lodge that belongs to
// two players: either can put the first log, and either can finish or mend it. Plain data and pure functions (ADR 0007).
import { newLodge } from './buttons';
import { addWood, lodgeComplete, lodgeCondition, nearLodge, LODGE_WOOD, type Lodge } from './lodge';
import { LODGE_WORN_DAYS, mended, newWear } from './wear';
import type { Log } from './logs';
import { logWood } from './lodge';
import type { Pond } from './pond';
import type { Terrain } from './terrain';

/** A lodge and the two players it belongs to: 'host' or the id the host gave a guest. */
export interface PairLodge extends Lodge {
  players: [string, string];
}

/** The lodge of the pair `id` belongs to, or null. */
export const pairLodgeOf = (lodges: readonly PairLodge[], id: string): PairLodge | null => lodges.find((l) => l.players.includes(id)) ?? null;

/**
 * A dragged log put down by one of `players` at (x, z) facing `heading`: the first log starts the lodge ahead of the beaver, a log
 * near an unfinished lodge adds its wood, and a log near a whole worn one mends it. `used` says whether the log went on the lodge.
 */
export function placeLog(
  lodges: readonly PairLodge[],
  players: [string, string],
  at: { x: number; z: number; heading: number },
  log: Pick<Log, 'length'>,
  ground: Terrain,
  ponds: readonly Pond[],
  clock: number,
): { lodges: readonly PairLodge[]; used: boolean } {
  const mine = pairLodgeOf(lodges, players[0]);
  const target = mine ?? (() => {
    const site = newLodge(ground, ponds, at.x, at.z, at.heading);
    return site ? ({ ...site, players } as PairLodge) : null;
  })();
  if (!target || !nearLodge(target, at.x, at.z)) return { lodges, used: false };
  let next: PairLodge;
  if (!lodgeComplete(target)) {
    next = addWood(target, log) as PairLodge;
    if (lodgeComplete(next)) next = { ...next, wear: newWear(clock) };
  } else if (lodgeCondition(target, clock) < 1) {
    next = { ...target, wear: mended(target.wear, clock, LODGE_WORN_DAYS, logWood(log), LODGE_WOOD) };
  } else return { lodges, used: false };
  return { lodges: mine ? lodges.map((l) => (l === mine ? next : l)) : [...lodges, next], used: true };
}

/** The pair that came apart no longer has a lodge it can use alone: the lodge is dropped from the list and returned, so the caller can keep it as a former home. */
export function releaseLodge(lodges: readonly PairLodge[], id: string): { lodges: PairLodge[]; released: PairLodge | null } {
  const found = pairLodgeOf(lodges, id);
  return { lodges: lodges.filter((l) => l !== found), released: found };
}
