import { describe, expect, it } from 'vitest';
import type { Animal } from './animals';
import { DAY_SECONDS } from './clock';
import { LEAD_AGAIN, LOST, WAIT_GAP, lead, leaderAnimal } from './guides';
import { lilyPadsNear } from './lily';
import { createWorld, type WorldState } from './state';
import type { Terrain } from './terrain';

/** Shallow water everywhere, so pads grow in patches across it. */
const pond: Terrain = { heightAt: () => 0, isWater: () => true, waterDepth: () => 1 };
const summer = 0.3 * DAY_SECONDS + 12 * DAY_SECONDS;
const otter = (x: number, z: number, id = '5:5'): Animal => ({ id, kind: 'otter', x, y: 1, z, heading: 0, moving: false });
const start = (): WorldState => ({ ...createWorld(pond, 0, 0), clock: summer, beaver: { ...createWorld(pond, 0, 0).beaver, x: 3, z: 0 } });

describe('guides', () => {
  it('has pads to lead to in the test water', () => {
    expect(lilyPadsNear(pond, 0, 0, 90, summer).length).toBeGreaterThan(0);
  });

  it('calls the beaver that comes close, and leads it to the pads', () => {
    let w = start();
    const r = lead(w, [otter(0, 0)], 0.1, pond);
    expect(r.events.map((e) => e.what)).toEqual(['called']);
    w = r.world;
    expect(w.leader).not.toBeNull();
    const to = { x: w.leader!.tx, z: w.leader!.tz };
    let arrived = false;
    for (let i = 0; i < 2000 && w.leader; i++) {
      // The beaver keeps up with the guide.
      w = { ...w, time: w.time + 0.1, beaver: { ...w.beaver, x: w.leader.x, z: w.leader.z } };
      const s = lead(w, [], 0.1, pond);
      w = s.world;
      if (s.events.some((e) => e.what === 'arrived')) arrived = true;
    }
    expect(arrived).toBe(true);
    expect(w.leader).toBeNull();
    expect(Math.hypot(to.x, to.z)).toBeLessThan(91);
  });

  it('waits for a beaver that falls behind, and gives up when it is lost', () => {
    let w = lead(start(), [otter(0, 0)], 0.1, pond).world;
    w = { ...w, beaver: { ...w.beaver, x: w.leader!.x + WAIT_GAP + 5, z: w.leader!.z } };
    const waiting = lead(w, [], 1, pond).world;
    expect(waiting.leader!.x).toBe(w.leader!.x);
    expect(leaderAnimal(waiting.leader!, pond, waiting).moving).toBe(false);
    const gone = lead({ ...w, beaver: { ...w.beaver, x: w.leader!.x + LOST + 5 } }, [], 0.1, pond);
    expect(gone.world.leader).toBeNull();
    expect(gone.events[0]!.what).toBe('lost');
  });

  it('does not lead again for a day, and does not call from far away or in winter', () => {
    const w = lead(start(), [otter(0, 0)], 0.1, pond).world;
    const done = { ...w, leader: null };
    expect(lead(done, [otter(0, 0)], 0.1, pond).events).toHaveLength(0);
    expect(lead({ ...done, clock: done.clock + LEAD_AGAIN + 1 }, [otter(0, 0)], 0.1, pond).events).toHaveLength(1);
    expect(lead(start(), [otter(40, 0)], 0.1, pond).events).toHaveLength(0);
    expect(lead({ ...start(), clock: 31 * DAY_SECONDS }, [otter(0, 0)], 0.1, pond).events).toHaveLength(0);
  });
});
