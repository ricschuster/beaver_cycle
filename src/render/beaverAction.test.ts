import { describe, expect, it } from 'vitest';
import { GROOM_AFTER, GROOM_EVERY, SHOT_SECONDS, createActionWatcher, type Watched } from './beaverAction';

const base: Watched = { time: 0, chop: null, drag: null, logs: [], carry: null, haul: null, hauled: 0, eaten: 0 };
const log = { id: 'L1' } as Watched['logs'][number];

describe('createActionWatcher', () => {
  it('shows nothing while nothing happens and the beaver moves', () => {
    const w = createActionWatcher();
    for (let t = 0; t < 40; t += 0.5) expect(w.next({ ...base, time: t }, false, false)).toBeNull();
  });

  it('gnaws while a tree is being felled, with the age since it began', () => {
    const w = createActionWatcher();
    w.next(base, false, false);
    const chop = { id: 't', x: 0, z: 0, wood: 1, progress: 0 };
    expect(w.next({ ...base, time: 1, chop }, false, false)).toEqual({ kind: 'gnaw', age: 0 });
    expect(w.next({ ...base, time: 2.5, chop }, false, false)).toEqual({ kind: 'gnaw', age: 1.5 });
    expect(w.next({ ...base, time: 3 }, false, false)).toBeNull();
  });

  it('digs before anything else it holds', () => {
    const w = createActionWatcher();
    expect(w.next({ ...base, drag: 'L1', logs: [log] }, true, true)?.kind).toBe('dig');
  });

  it('builds when a dragged log goes into a building, not when it is let go', () => {
    const w = createActionWatcher();
    w.next({ ...base, drag: 'L1', logs: [log] }, false, false);
    expect(w.next({ ...base, time: 0.1, logs: [log] }, false, false)).toBeNull();
    w.next({ ...base, time: 0.2, drag: 'L1', logs: [log] }, false, false);
    expect(w.next({ ...base, time: 0.3 }, false, false)?.kind).toBe('build');
    expect(w.next({ ...base, time: 0.3 + SHOT_SECONDS.build + 0.01 }, false, false)).toBeNull();
  });

  it('builds when mud or a rock goes onto a dam', () => {
    const w = createActionWatcher();
    w.next({ ...base, haul: { kind: 'mud' } }, false, false);
    expect(w.next({ ...base, time: 0.1, hauled: 1 }, false, false)?.kind).toBe('build');
  });

  it('eats, with the food that just left the mouth', () => {
    const w = createActionWatcher();
    w.next({ ...base, carry: 'lily' }, false, true);
    expect(w.next({ ...base, time: 0.1, eaten: 1 }, false, true)).toEqual({ kind: 'eat', age: 0, food: 'lily' });
  });

  it('dips its head when something comes into the mouth', () => {
    const w = createActionWatcher();
    w.next(base, false, false);
    expect(w.next({ ...base, time: 0.1, haul: { kind: 'rock' } }, false, false)?.kind).toBe('pick');
  });

  it('grooms after standing still a while, not too often, and stops when it moves', () => {
    const w = createActionWatcher();
    let first: number | null = null;
    let t = 0;
    for (; t < 60 && first === null; t += 0.25) if (w.next({ ...base, time: t }, false, true)?.kind === 'groom') first = t;
    expect(first).toBeGreaterThanOrEqual(GROOM_AFTER);
    expect(first).toBeLessThan(GROOM_AFTER + 1);
    // Not again until GROOM_EVERY has passed.
    for (; t < first! + GROOM_EVERY - 0.5; t += 0.25) {
      const a = w.next({ ...base, time: t }, false, true);
      if (t > first! + SHOT_SECONDS.groom) expect(a).toBeNull();
    }
    const w2 = createActionWatcher();
    for (t = 0; t <= GROOM_AFTER + 0.5; t += 0.25) w2.next({ ...base, time: t }, false, true);
    expect(w2.next({ ...base, time: t }, false, true)?.kind).toBe('groom');
    expect(w2.next({ ...base, time: t + 0.1 }, false, false)).toBeNull();
  });
});
