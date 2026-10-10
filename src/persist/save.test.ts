import { describe, expect, it } from 'vitest';
import { flatTerrain } from '../sim/terrain';
import { createWorld, type WorldState } from '../sim/state';
import { SAVE_BACKUP_KEY, SAVE_KEY, SAVE_VERSION, ago, clearSave, decodeSave, encodeSave, loadSave, wantsSave, writeSave, type SaveStorage, type SavedCoach } from './save';
import type { Pond } from '../sim/pond';

const coachOff: SavedCoach = { on: false, stage: null, state: null };

function memory(): SaveStorage & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return { items, getItem: (k) => items.get(k) ?? null, setItem: (k, v) => void items.set(k, v), removeItem: (k) => void items.delete(k) };
}

const fresh = (): WorldState => createWorld(flatTerrain(), 5, 7);

function pond(): Pond {
  const n = 4;
  return { spot: 'a', crest: 1, level: 3.5, n, x0: 10, z0: 20, heights: Float32Array.from({ length: n * n }, (_, i) => i * 0.37 + 0.001), flooded: Uint8Array.from({ length: n * n }, (_, i) => i % 2), area: 12 };
}

describe('save', () => {
  it('brings a world back as it was, ponds included', () => {
    const w: WorldState = { ...fresh(), clock: 12345, generation: 2, felled: ['t1', 't2'], ponds: [pond()], pondCrests: { a: 1 }, picked: { p1: 1 }, achievements: ['home'] };
    const coach: SavedCoach = { on: true, stage: 'teenager', state: null };
    const save = decodeSave(encodeSave(w, coach, 99), fresh())!;
    expect(save.savedAt).toBe(99);
    expect(save.coach).toEqual(coach);
    expect(save.world).toEqual(w);
    expect(save.world.ponds[0]!.heights).toBeInstanceOf(Float32Array);
    expect(save.world.ponds[0]!.flooded).toBeInstanceOf(Uint8Array);
  });

  it('leaves out what only matters for the moment', () => {
    const w: WorldState = { ...fresh(), speedMultiplier: 100, stashOpen: true, drag: 'log1' };
    const back = decodeSave(encodeSave(w, coachOff, 0), fresh())!.world;
    expect(back.speedMultiplier).toBe(1);
    expect(back.stashOpen).toBe(false);
    expect(back.drag).toBeNull();
  });

  it('gives a field the save lacks the new game value', () => {
    const text = JSON.parse(encodeSave(fresh(), coachOff, 0)) as { world: Record<string, unknown> };
    delete text.world.hauled;
    const back = decodeSave(JSON.stringify(text), { ...fresh(), hauled: 7 })!;
    expect(back.world.hauled).toBe(7);
  });

  it('keeps what the beavers remember of talks, and an older save without it meets them afresh', () => {
    const w: WorldState = { ...fresh(), met: { 'family:1:2:mama': { talks: 3, last: 900 } } };
    expect(decodeSave(encodeSave(w, coachOff, 0), fresh())!.world.met).toEqual(w.met);
    const old = JSON.parse(encodeSave(fresh(), coachOff, 0)) as { version: number; world: Record<string, unknown> };
    delete old.world.met;
    expect(old.version).toBe(SAVE_VERSION);
    expect(decodeSave(JSON.stringify(old), fresh())!.world.met).toEqual({});
  });

  it('refuses text that is not a usable save', () => {
    expect(decodeSave('not json', fresh())).toBeNull();
    expect(decodeSave('{}', fresh())).toBeNull();
    expect(decodeSave(JSON.stringify({ version: SAVE_VERSION, world: { clock: 'x' } }), fresh())).toBeNull();
    const future = JSON.parse(encodeSave(fresh(), coachOff, 0)) as { version: number };
    future.version = SAVE_VERSION + 1;
    expect(decodeSave(JSON.stringify(future), fresh())).toBeNull();
  });

  it('writes, loads and clears', () => {
    const s = memory();
    expect(loadSave(s, fresh()).kind).toBe('none');
    expect(writeSave(s, fresh(), coachOff, 1)).toBe(true);
    expect(loadSave(s, fresh()).kind).toBe('ok');
    clearSave(s);
    expect(loadSave(s, fresh()).kind).toBe('none');
  });

  it('keeps a save it cannot read under another key', () => {
    const s = memory();
    s.setItem(SAVE_KEY, '{broken');
    expect(loadSave(s, fresh()).kind).toBe('unreadable');
    expect(s.getItem(SAVE_KEY)).toBeNull();
    expect(s.getItem(SAVE_BACKUP_KEY)).toBe('{broken');
  });

  it('does not stop the game when storage is full or blocked', () => {
    const full: SaveStorage = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
    expect(writeSave(full, fresh(), coachOff, 1)).toBe(false);
    const blocked: SaveStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => {}, removeItem: () => {} };
    expect(loadSave(blocked, fresh()).kind).toBe('none');
  });

  it('saves in a normal run, but not in a test or a hand set up world', () => {
    expect(wantsSave(new URLSearchParams(''), false)).toBe(true);
    expect(wantsSave(new URLSearchParams(''), true)).toBe(false);
    expect(wantsSave(new URLSearchParams('save=1'), true)).toBe(true);
    expect(wantsSave(new URLSearchParams('save=0'), false)).toBe(false);
    for (const q of ['day=3', 'age=40', 'stage=adult', 'lodge=0', 'fly=1', 'time=0.5']) expect(wantsSave(new URLSearchParams(`${q}&save=1`), false)).toBe(false);
  });

  it('says how long ago', () => {
    expect(ago(0, 20_000)).toBe('just now');
    expect(ago(0, 60_000)).toBe('1 minute ago');
    expect(ago(0, 5 * 60_000)).toBe('5 minutes ago');
    expect(ago(0, 3 * 3_600_000)).toBe('3 hours ago');
    expect(ago(0, 4 * 86_400_000)).toBe('4 days ago');
  });
});
