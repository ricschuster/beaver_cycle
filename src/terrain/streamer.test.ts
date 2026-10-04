import { describe, expect, it } from 'vitest';
import {
  Streamer,
  defaultStreamerOptions as o,
  distToTile,
  levelFor,
  shownLevel,
  type FetchTile,
} from './streamer';
import { TileStore } from './store';
import { makeIndex, makeTile } from './testing';

describe('levelFor', () => {
  it('picks levels by ring', () => {
    expect(levelFor(0, undefined, o)).toBe(0);
    expect(levelFor(639, undefined, o)).toBe(0);
    expect(levelFor(641, undefined, o)).toBe(1);
    expect(levelFor(1299, undefined, o)).toBe(1);
    expect(levelFor(1301, undefined, o)).toBe(2);
  });

  it('keeps the finer level just past a ring, but not far past', () => {
    expect(levelFor(660, 0, o)).toBe(0);
    expect(levelFor(700, 0, o)).toBe(1);
    expect(levelFor(1320, 1, o)).toBe(1);
    expect(levelFor(1400, 1, o)).toBe(2);
  });

  it('goes finer at once', () => {
    expect(levelFor(600, 1, o)).toBe(0);
  });
});

describe('distToTile', () => {
  it('is 0 inside and measures to the nearest edge or corner outside', () => {
    expect(distToTile(100, 100, 0, 0, 320)).toBe(0);
    expect(distToTile(-30, 100, 0, 0, 320)).toBe(30);
    expect(distToTile(-30, -40, 0, 0, 320)).toBe(50);
    expect(distToTile(400, 100, 0, 0, 320)).toBe(80);
  });
});

describe('shownLevel', () => {
  const has = (...ls: number[]) => (l: number) => ls.includes(l);
  it('prefers the wanted level, then finer, then coarser', () => {
    expect(shownLevel(0, has(0, 2))).toBe(0);
    expect(shownLevel(1, has(0, 2))).toBe(0);
    expect(shownLevel(0, has(1, 2))).toBe(1);
    expect(shownLevel(0, has(2))).toBe(2);
    expect(shownLevel(0, has())).toBeUndefined();
  });
});

describe('Streamer', () => {
  function setup(maxConcurrent = 4) {
    const store = new TileStore(makeIndex([0, 4], [0, 0])); // a row of five tiles
    const calls: string[] = [];
    const waiting: (() => void)[] = [];
    const fetchTile: FetchTile = (level, tx, tz) =>
      new Promise((resolve) => {
        calls.push(`${level}:${tx}`);
        waiting.push(() => resolve(makeTile(tx, tz, level, () => 0)));
      });
    const streamer = new Streamer(store, fetchTile, { ...o, maxConcurrent });
    const flush = async () => {
      while (waiting.length) waiting.shift()!();
      await new Promise((r) => setTimeout(r, 0));
    };
    return { store, streamer, calls, flush };
  }

  it('fetches nearest first, coarse ground before fine, within the concurrency cap', () => {
    const { streamer, calls } = setup(3);
    streamer.update(160, 160); // inside tile 0
    expect(calls).toEqual(['2:0', '0:0', '2:1']);
    expect(streamer.pending).toBe(3);
  });

  it('ends up with the whole core coarse and the near tiles fine', async () => {
    const { store, streamer, flush } = setup();
    for (let i = 0; i < 10; i++) {
      streamer.update(160, 160);
      await flush();
    }
    for (let tx = 0; tx <= 4; tx++) expect(store.has(tx, 0, 2)).toBe(true);
    expect(store.has(0, 0, 0)).toBe(true); // distance 0
    expect(store.has(1, 0, 0)).toBe(true); // 160 m from tile 1
    expect(store.has(3, 0, 0)).toBe(false); // 800 m away is level 1
    expect(store.has(3, 0, 1)).toBe(true);
    expect(store.has(4, 0, 1)).toBe(true); // 1120 m
  });

  it('drops fine levels after the beaver moves away and keeps the horizon', async () => {
    const { store, streamer, flush } = setup();
    for (let i = 0; i < 10; i++) {
      streamer.update(160, 160);
      await flush();
    }
    for (let i = 0; i < 10; i++) {
      streamer.update(4 * 320 + 160, 160);
      await flush();
    }
    expect(store.has(0, 0, 0)).toBe(false);
    expect(store.has(0, 0, 1)).toBe(true); // 1120 m away is level 1
    expect(store.has(0, 0, 2)).toBe(true);
    expect(store.has(4, 0, 0)).toBe(true);
  });

  it('is settled once the tiles near a point have their wanted level, whatever is far away', async () => {
    const { streamer, flush } = setup();
    streamer.update(160, 160);
    expect(streamer.settled(160, 160)).toBe(false);
    for (let i = 0; i < 3; i++) {
      streamer.update(160, 160);
      await flush();
    }
    expect(streamer.settled(160, 160)).toBe(true);
    expect(streamer.settled(4 * 320 + 160, 160)).toBe(false); // the far end is still coarse
  });

  it('does not retry a tile that failed', async () => {
    const store = new TileStore(makeIndex([0, 0], [0, 0]));
    let calls = 0;
    const warn = console.warn;
    console.warn = () => {};
    const streamer = new Streamer(store, () => {
      calls++;
      return Promise.reject(new Error('nope'));
    });
    for (let i = 0; i < 4; i++) {
      streamer.update(0, 0);
      await new Promise((r) => setTimeout(r, 0));
    }
    console.warn = warn;
    expect(calls).toBe(2); // level 2 and level 0, once each
  });
});
