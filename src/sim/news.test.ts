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

  it('tells where the pads are from where the player looks, with no compass and no metres', () => {
    // The beaver faces +z, so -z is behind it; a player looking along -z sees them straight ahead.
    expect(newsFor(w, { pad: { x: 0, z: -43 }, predator: null })).toEqual(['Lily pads grow behind you, close by.']);
    expect(newsFor(w, { pad: { x: 0, z: -43 }, predator: null, facing: Math.PI })).toEqual(['Lily pads grow straight ahead, close by.']);
  });

  it('warns of a predator, and says where', () => {
    const news = newsFor(w, { pad: null, predator: { x: 30, z: 0, kind: 'fox' } });
    expect(news[0]).toBe('I smelled a fox to your left. Keep your tail ready.');
  });

  it('keeps hints from a beaver that does not trust the player yet', () => {
    expect(answerNews(w, { pad: { x: 0, z: -40 }, predator: null }, false, 0)).toContain('nothing to tell');
    expect(answerNews(w, { pad: { x: 0, z: -40 }, predator: null }, true, 0)).toContain('Lily pads');
  });

  it('turns over the hints by the seed', () => {
    const around = { pad: { x: 0, z: -40 }, predator: { x: 30, z: 0, kind: 'fox' } };
    expect(answerNews(w, around, true, 0)).not.toBe(answerNews(w, around, true, 1));
  });

  it('does not give the same hint twice in a row, and speaks in the beaver\'s voice', () => {
    const around = { pad: { x: 0, z: -40 }, predator: { x: 30, z: 0, kind: 'fox' } };
    for (let seed = 0; seed < 4; seed++) {
      const last = answerNews(w, around, true, seed);
      expect(answerNews(w, around, true, seed, last)).not.toBe(last);
    }
    expect(answerNews(w, none, false, 0, '', 'kit')).toContain('secrets');
    expect(answerNews(w, none, true, 0, '', 'papa')).toContain('All quiet');
  });
});
