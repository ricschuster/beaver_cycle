import { describe, expect, it } from 'vitest';
import { DAY_SECONDS } from './clock';
import { POND_CELL, type Pond } from './pond';
import { MATURE_DAYS, matureAt, pondGuests, trackPonds } from './pondGuests';
import { createWorld, type WorldState } from './state';
import { flatTerrain } from './terrain';

/** A round pond 60 m across, 1.5 m deep in the middle, on a 41 by 41 grid. */
function pond(spot = 'spot-a'): Pond {
  const n = 41;
  const flooded = new Uint8Array(n * n);
  const heights = new Float32Array(n * n);
  let area = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const r = Math.hypot(i - 20, j - 20);
      heights[j * n + i] = -1.5 * Math.max(0, 1 - r / 15);
      if (r <= 15) {
        flooded[j * n + i] = 1;
        area += POND_CELL * POND_CELL;
      }
    }
  }
  return { spot, crest: 1.5, level: 0, n, x0: 0, z0: 0, heights, flooded, area };
}

const world = (clock: number, since: Record<string, number>): WorldState => ({ ...createWorld(flatTerrain(0), 0, 0), ponds: [pond()], pondSince: since, clock });
const noon = 0.3 * DAY_SECONDS;

describe('pond guests', () => {
  it('comes only once the pond is mature', () => {
    const since = { 'spot-a': 0 };
    expect(matureAt(since, 'spot-a', MATURE_DAYS * DAY_SECONDS - 1)).toBe(false);
    expect(pondGuests(world(DAY_SECONDS, since), 40, 40)).toHaveLength(0);
    expect(pondGuests(world(MATURE_DAYS * DAY_SECONDS + noon, since), 40, 40).length).toBeGreaterThan(0);
  });

  it('gives ducks on the water and frogs at the edge, the same each time', () => {
    const w = world(MATURE_DAYS * DAY_SECONDS + noon, { 'spot-a': 0 });
    const guests = pondGuests(w, 40, 40);
    expect(guests.some((g) => g.kind === 'duck')).toBe(true);
    expect(guests.some((g) => g.kind === 'frog')).toBe(true);
    for (const g of guests) {
      const r = Math.hypot(g.x / POND_CELL - 20, g.z / POND_CELL - 20);
      expect(r).toBeLessThanOrEqual(16.5);
      if (g.kind === 'duck') expect(r).toBeLessThanOrEqual(13);
      expect(g.y).toBe(0);
    }
    expect(pondGuests(w, 40, 40)).toEqual(guests);
  });

  it('lets the frogs sleep through the winter', () => {
    const winter = 31 * DAY_SECONDS + noon;
    const w = world(winter, { 'spot-a': 0 });
    expect(pondGuests(w, 40, 40).some((g) => g.kind === 'frog')).toBe(false);
  });

  it('notes when a pond is first seen and forgets it when it drains', () => {
    const w = trackPonds({ ...world(500, {}) });
    expect(w.pondSince['spot-a']).toBe(500);
    expect(trackPonds({ ...w, clock: 900 }).pondSince['spot-a']).toBe(500);
    expect(trackPonds({ ...w, ponds: [] }).pondSince).toEqual({});
  });
});
