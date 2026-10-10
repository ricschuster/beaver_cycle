import { describe, expect, it } from 'vitest';
import { answerNews, newsFor } from './news';
import { createWorld } from './state';
import type { Terrain } from './terrain';

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
