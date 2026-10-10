import { describe, expect, it } from 'vitest';
import { CALL_SLOT, answerNews, newsFor, overheard } from './news';
import { createWorld } from './state';
import type { Terrain } from './terrain';
import { DAY_SECONDS } from './clock';

const land: Terrain = { heightAt: () => 0, isWater: () => false, waterDepth: () => 0 };
const none = { pad: null, predator: null };
const w = createWorld(land, 0, 0);

describe('newsFor', () => {
  it('has nothing to say when nothing is true', () => {
    expect(newsFor(w, none)).toEqual([]);
    expect(answerNews(w, none, true, 0)).toBe('Nothing new on the pond today.');
  });

  it('tells where the pads are, with the compass and the distance to 10 m', () => {
    const news = newsFor(w, { pad: { x: 0, z: -43 }, predator: null });
    expect(news).toEqual(['Lily pads grow to the north, about 40 m from here.']);
  });

  it('warns of a predator, and says where', () => {
    const news = newsFor(w, { pad: null, predator: { x: 30, z: 0, kind: 'fox' } });
    expect(news[0]).toContain('fox to the east');
  });

  it('keeps hints from a beaver that does not trust the player yet', () => {
    expect(answerNews(w, { pad: { x: 0, z: -40 }, predator: null }, false, 0)).toContain('nothing to tell');
    expect(answerNews(w, { pad: { x: 0, z: -40 }, predator: null }, true, 0)).toContain('Lily pads');
  });

  it('turns over the hints by the seed', () => {
    const around = { pad: { x: 0, z: -40 }, predator: { x: 30, z: 0, kind: 'fox' } };
    expect(answerNews(w, around, true, 0)).not.toBe(answerNews(w, around, true, 1));
  });
});

describe('overheard', () => {
  const family = [
    { id: 'f:mama', name: 'Hazel', family: 'f', x: 5, z: 0 },
    { id: 'f:kit:0', name: 'Reed', family: 'f', x: 8, z: 0 },
  ];

  it('is the same for the same slot, and sometimes calls, sometimes not', () => {
    const calls = Array.from({ length: 40 }, (_, i) => overheard(family, { x: 0, z: 0 }, i * CALL_SLOT + 1));
    expect(calls.some((c) => c !== null)).toBe(true);
    expect(calls.some((c) => c === null)).toBe(true);
    expect(overheard(family, { x: 0, z: 0 }, 3 * CALL_SLOT + 1)).toEqual(overheard(family, { x: 0, z: 0 }, 3 * CALL_SLOT + 2));
    expect(CALL_SLOT).toBeLessThan(DAY_SECONDS);
  });

  it('calls one member to another by name', () => {
    const call = calls(family)!;
    expect(['Hazel', 'Reed']).toContain(call.who);
    expect(call.text).toMatch(/Hazel|Reed/);
  });

  it('needs two of a family within hearing', () => {
    expect(overheard([family[0]!], { x: 0, z: 0 }, 0)).toBeNull();
    expect(overheard(family, { x: 500, z: 0 }, 0)).toBeNull();
  });
});

function calls(family: Parameters<typeof overheard>[0]) {
  for (let i = 0; i < 40; i++) {
    const c = overheard(family, { x: 0, z: 0 }, i * CALL_SLOT + 1);
    if (c) return c;
  }
  return null;
}
