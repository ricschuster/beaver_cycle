// The partner who lives in the lodge keeps it up (docs/design/23_leaving_and_next_baby.md, the author, session 54): it
// mends the lodge and the store as they wear, and brings branches to the store now and then. No three.js, no DOM.

import { DAY_SECONDS } from './clock';
import { storeCapacity, storeCondition } from './food';
import { lodgeComplete, lodgeCondition } from './lodge';
import { mateOf } from './partners';
import type { WorldState } from './state';
import { newWear } from './wear';

/** The partner brings one branch to the store this often (seconds of game clock). Untuned. */
export const PARTNER_FILL_EVERY = DAY_SECONDS / 8;

/**
 * `prev` is the world a step started from and `world` the one it made. A lodge and store with a wear record are made
 * whole again, and a store with room gets a branch when a fill time has passed. With no partner at home, or no whole
 * lodge, nothing changes. It runs after the tally, so the mending is not counted as the player's.
 */
export function partnerKeepsUp(prev: Pick<WorldState, 'clock'>, world: WorldState): WorldState {
  const { lodge } = world;
  if (!mateOf(world.partners) || !lodge || !lodgeComplete(lodge)) return world;
  let next = world;
  if (lodge.wear && lodgeCondition(lodge, world.clock) < 1) next = { ...next, lodge: { ...lodge, wear: newWear(world.clock) } };
  if (next.storeWear && storeCondition(next.storeWear, world.clock) < 1) next = { ...next, storeWear: newWear(world.clock) };
  if (Math.floor(world.clock / PARTNER_FILL_EVERY) > Math.floor(prev.clock / PARTNER_FILL_EVERY)) {
    const room = Math.min(next.store.length, storeCapacity(storeCondition(next.storeWear, world.clock)));
    const slot = next.store.findIndex((s, i) => s === null && i < room);
    if (slot >= 0) next = { ...next, store: next.store.map((s, i) => (i === slot ? ('branch' as const) : s)) };
  }
  return next;
}
