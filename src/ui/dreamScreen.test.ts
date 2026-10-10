import { describe, expect, it } from 'vitest';
import { noActions } from '../actions/actions';
import type { DreamEvent, DreamGame, DreamState, Mallow } from '../sim/dream';
import { dreamInput, dreamLine, dreamStatus, mallowName } from './dreamScreen';

const mallow = (id: string, name: string): Mallow => ({
  id,
  name,
  colour: 0,
  state: 'wander',
  giggleAt: null,
  met: false,
  x: 0,
  y: 0,
  z: 0,
  heading: 0,
  speed: 0,
  mode: 'walk',
  hopAt: null,
  slapAt: null,
});

/** A dream by hand, with only what the screen reads: the mallows, the time and the game. */
const dream = (game: DreamGame = { kind: 'none' }, time = 0): DreamState => ({
  land: { seed: 1, half: 80, path: [], river: [], riverWidth: 8, start: { x: 0, z: 0, heading: 0 }, props: [] },
  time,
  beaver: { x: 0, y: 0, z: 0, heading: 0, speed: 0, mode: 'walk', hopAt: null, slapAt: null },
  mallows: [mallow('m0', 'Puff'), mallow('m1', 'Squish')],
  sweets: [],
  count: 0,
  rushUntil: 0,
  game,
});

const EVENTS: DreamEvent[] = [
  { what: 'sweet', kind: 'star', x: 0, z: 0 },
  { what: 'rush' },
  { what: 'greet', who: 'm0' },
  { what: 'tagStart', it: 'm0' },
  { what: 'tagStart', it: 'player' },
  { what: 'caught', it: 'player', by: 'm0' },
  { what: 'caught', it: 'm1', by: 'player' },
  { what: 'caught', it: 'm1', by: 'm0' },
  { what: 'tagEnd', catches: 7 },
  { what: 'tagEnd', catches: 0 },
  { what: 'seekStart', hiders: 5 },
  { what: 'seekGo' },
  { what: 'found', who: 'm1', left: 3 },
  { what: 'found', who: 'm1', left: 0 },
  { what: 'seekEnd' },
  { what: 'shower', count: 12 },
];

describe('dream lines', () => {
  it('names the marshmallow beavers by id or by name, and leaves the player as it is', () => {
    const s = dream();
    expect(mallowName(s, 'm1')).toBe('Squish');
    expect(mallowName(s, 'Puff')).toBe('Puff');
    expect(mallowName(s, 'player')).toBe('player');
  });

  it('has a line for every game event, with no ids, no em dashes and nothing empty', () => {
    const s = dream();
    for (const e of EVENTS) {
      for (let n = 0; n < 6; n++) {
        const line = dreamLine(e, s, n);
        expect(line, e.what).toBeTruthy();
        expect(line).not.toMatch(/\bm[01]\b|\u2014|undefined/);
      }
    }
  });

  it('says nothing for a plain sweet, a splash, or a giggle, which show in the count and the scene', () => {
    const s = dream();
    expect(dreamLine({ what: 'sweet', kind: 'drop', x: 0, z: 0 }, s, 0)).toBeNull();
    expect(dreamLine({ what: 'splash', x: 0, z: 0 }, s, 0)).toBeNull();
    expect(dreamLine({ what: 'giggle', who: 'm0', x: 0, z: 0 }, s, 0)).toBeNull();
  });

  it('picks another line as the counter goes on', () => {
    const s = dream();
    const greet: DreamEvent = { what: 'greet', who: 'm0' };
    const lines = new Set([0, 1, 2, 3].map((n) => dreamLine(greet, s, n)));
    expect(lines.size).toBeGreaterThan(1);
    for (const l of lines) expect(l).toContain('Puff');
  });

  it('tells who caught whom, and how many are left to find', () => {
    const s = dream();
    expect(dreamLine({ what: 'caught', it: 'player', by: 'm0' }, s, 0)).toBe('Gotcha! You are it');
    expect(dreamLine({ what: 'caught', it: 'm1', by: 'player' }, s, 0)).toBe('You tagged Squish!');
    expect(dreamLine({ what: 'found', who: 'm1', left: 3 }, s, 0)).toBe('You found Squish! 3 left');
    expect(dreamLine({ what: 'tagEnd', catches: 7 }, s, 0)).toBe('What a game! 7 catches');
    expect(dreamLine({ what: 'tagEnd', catches: 1 }, s, 0)).toBe('What a game! 1 catch');
    expect(dreamLine({ what: 'seekEnd' }, s, 0)).toBe('Everyone found! Sweets for all!');
  });
});

describe('dream status', () => {
  it('shows nothing with no game on', () => {
    expect(dreamStatus(dream())).toEqual({ top: null, big: null });
  });

  it('shows who is it in tag and the seconds left', () => {
    const tag = (it: string): DreamGame => ({ kind: 'tag', it, players: ['m0', 'm1'], since: 0, ends: 60, catches: 0 });
    expect(dreamStatus(dream(tag('m0'), 17.2)).top).toBe('Tag! Puff is it 43 s left');
    expect(dreamStatus(dream(tag('player'), 59.5)).top).toBe('You are it! 1 s left');
    expect(dreamStatus(dream(tag('player'), 70)).top).toBe('You are it! 0 s left');
  });

  it('counts big in the middle, then counts the found ones', () => {
    const counting: DreamGame = { kind: 'seek', phase: 'counting', until: 10, hiders: ['m0', 'm1'], found: [] };
    expect(dreamStatus(dream(counting, 3.5)).big).toBe('Counting... 7');
    const seeking: DreamGame = { kind: 'seek', phase: 'seeking', until: 10, hiders: ['m0', 'm1'], found: ['m1'] };
    expect(dreamStatus(dream(seeking, 12))).toEqual({ top: 'Find them! 1 of 2 found', big: null });
  });
});

describe('dream input', () => {
  it('hops only on the frame Dive goes down, and passes the slap and the play', () => {
    const a = { ...noActions(), dive: true, slap: true, build: true };
    expect(dreamInput(a, Math.PI, false)).toMatchObject({ hop: true, slap: true, play: true });
    expect(dreamInput(a, Math.PI, true).hop).toBe(false);
    expect(dreamInput(noActions(), Math.PI, true)).toMatchObject({ hop: false, slap: false, play: false });
  });

  it('turns the move to the view, so forward walks away from the camera', () => {
    const forward = { ...noActions(), move: { x: 0, z: 1 } };
    // A camera behind a beaver facing +z (yaw PI) keeps forward as +z; a camera to the east (yaw PI/2) sends it west.
    const behind = dreamInput(forward, Math.PI, false).move;
    expect(behind.x).toBeCloseTo(0);
    expect(behind.z).toBeCloseTo(1);
    const east = dreamInput(forward, Math.PI / 2, false).move;
    expect(east.x).toBeCloseTo(-1);
    expect(east.z).toBeCloseTo(0);
  });
});
