import { describe, expect, it } from 'vitest';
import { DAY_SECONDS } from './clock';
import { STORE_CAPACITY, emptyStock, stockTotal, storeCondition } from './food';
import { LODGE_WOOD, lodgeCondition } from './lodge';
import { moveIn, seedPartners } from './partners';
import { createWorld, type WorldState } from './state';
import { flatTerrain } from './terrain';
import { PARTNER_FILL_EVERY, partnerKeepsUp } from './upkeep';
import { newWear } from './wear';

const old = -300 * DAY_SECONDS;
const spot = { id: 's', bed: { x: 500, z: 500 }, bedY: 0, flow: { x: 0, z: 1 }, maxCrest: 1 } as never;

function home(withPartner: boolean): WorldState {
  const w = createWorld(flatTerrain(0));
  const partners = seedPartners([spot], { x: 0, z: 0 });
  return {
    ...w,
    clock: 10 * DAY_SECONDS,
    lodge: { x: 0, z: 20, base: 0, door: 0, wood: LODGE_WOOD, wear: newWear(old) },
    storeWear: newWear(old),
    store: emptyStock(),
    partners: withPartner ? moveIn(partners.map((p) => ({ ...p, state: 'following' as const })), 10 * DAY_SECONDS) : partners,
  };
}

describe('a partner at home', () => {
  it('mends a worn lodge and store', () => {
    const w = home(true);
    expect(lodgeCondition(w.lodge!, w.clock)).toBeLessThan(0.5);
    const k = partnerKeepsUp(w, w);
    expect(lodgeCondition(k.lodge!, k.clock)).toBe(1);
    expect(storeCondition(k.storeWear, k.clock)).toBe(1);
  });

  it('brings a branch to the store each fill time, and stops when it is full', () => {
    const w = home(true);
    const later = { ...w, clock: w.clock + PARTNER_FILL_EVERY };
    expect(stockTotal(partnerKeepsUp(w, later).store)).toBe(1);
    expect(partnerKeepsUp(later, later).store).toBe(later.store);
    const full = { ...later, store: Array.from({ length: STORE_CAPACITY }, () => 'branch' as const) };
    expect(partnerKeepsUp(w, full).store).toBe(full.store);
  });

  it('changes nothing with no partner at home', () => {
    const w = home(false);
    expect(partnerKeepsUp(w, { ...w, clock: w.clock + PARTNER_FILL_EVERY })).toEqual({ ...w, clock: w.clock + PARTNER_FILL_EVERY });
  });
});
