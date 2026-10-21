import { describe, expect, it } from 'vitest';
import {
  CHOCOLATE_LEVEL,
  COUNT_TIME,
  HIDE_TIME,
  MALLOW_COLOURS,
  PROP_RADIUS,
  RUSH,
  STATUE_RUSH_TIME,
  SEEK_SPEED,
  SHOWER,
  SWIM_SPEED,
  TAG_TIME,
  WALK_SPEED,
  chocolateDepth,
  dreamHeight,
  hideOrSeek,
  newDream,
  playPrompt,
  stepDream,
  type DreamEvent,
  type DreamInput,
  type DreamPoint,
  type DreamState,
  type Mallow,
} from './dream';
import { INNER, lineDistance } from './dreamLand';

const DT = 1 / 30;
const still: DreamInput = { move: { x: 0, z: 0 }, hop: false, slap: false, play: false };
const input = (over: Partial<DreamInput>): DreamInput => ({ ...still, ...over });

/** Runs the dream for some seconds with the same input each frame (a press only on the first), gathering what happened. */
function run(s: DreamState, seconds: number, first: DreamInput = still, every: DreamInput = { ...first, hop: false, slap: false, play: false }): { state: DreamState; events: DreamEvent[] } {
  const events: DreamEvent[] = [];
  let state = s;
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    const r = stepDream(state, i === 0 ? first : every, DT);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

/** Runs until an event of a kind happens, or the time is up. */
function runUntil(s: DreamState, what: DreamEvent['what'], seconds: number): { state: DreamState; events: DreamEvent[] } {
  const events: DreamEvent[] = [];
  let state = s;
  for (let i = 0; i < seconds / DT; i++) {
    const r = stepDream(state, still, DT);
    state = r.state;
    events.push(...r.events);
    if (r.events.some((e) => e.what === what)) break;
  }
  return { state, events };
}

const dist = (a: DreamPoint, b: DreamPoint): number => Math.hypot(a.x - b.x, a.z - b.z);
const place = (s: DreamState, p: DreamPoint): DreamState => ({ ...s, beaver: { ...s.beaver, x: p.x, z: p.z } });
const mallow = (s: DreamState, id: string): Mallow => s.mallows.find((m) => m.id === id)!;

/** The middle of the river, well inside the land. */
const riverMiddle = (s: DreamState): DreamPoint => s.land.river[Math.floor(s.land.river.length / 2)]!;

/** A dream with only one marshmallow beaver near the player, so a game has a known set of players. */
function alone(s: DreamState, keep: string): DreamState {
  return { ...s, mallows: s.mallows.map((m, i) => (m.id === keep ? m : { ...m, x: -INNER + 2 + i * 3, z: -INNER + 2, met: true })) };
}

const SEEDS = [1, 7, 42, 1234, 99];

describe('newDream', () => {
  it('makes the same land from the same seed, and a new one from another', () => {
    expect(newDream(7)).toEqual(newDream(7));
    expect(newDream(7).land.river).not.toEqual(newDream(8).land.river);
    expect(newDream(7).land.props).not.toEqual(newDream(8).land.props);
  });

  it('runs the river from one edge to the opposite one, with points about 2 m apart', () => {
    for (const seed of SEEDS) {
      const { river, half, riverWidth } = newDream(seed).land;
      const a = river[0]!;
      const b = river[river.length - 1]!;
      const onEdge = (p: DreamPoint): boolean => Math.abs(Math.abs(p.x) - half) < 1e-6 || Math.abs(Math.abs(p.z) - half) < 1e-6;
      expect(onEdge(a) && onEdge(b)).toBe(true);
      expect(Math.abs(a.x - b.x) === 2 * half || Math.abs(a.z - b.z) === 2 * half).toBe(true);
      for (let i = 1; i < river.length - 1; i++) expect(dist(river[i - 1]!, river[i]!)).toBeCloseTo(2, 1);
      expect(riverWidth).toBeGreaterThanOrEqual(9);
      expect(riverWidth).toBeLessThanOrEqual(12);
    }
  });

  it('leads the path from a start 45 to 60 m away down to the river bank, and starts the beaver on it', () => {
    for (const seed of SEEDS) {
      const { land, beaver } = newDream(seed);
      const { path, river, riverWidth, start } = land;
      expect(lineDistance(river, path[0]!.x, path[0]!.z)).toBeGreaterThanOrEqual(45);
      expect(lineDistance(river, path[0]!.x, path[0]!.z)).toBeLessThanOrEqual(60);
      const end = path[path.length - 1]!;
      expect(Math.abs(lineDistance(river, end.x, end.z) - riverWidth / 2)).toBeLessThan(1);
      for (let i = 1; i < path.length - 1; i++) expect(dist(path[i - 1]!, path[i]!)).toBeCloseTo(2, 1);
      expect(start).toMatchObject(path[0]!);
      expect(start.heading).toBeCloseTo(Math.atan2(path[1]!.x - path[0]!.x, path[1]!.z - path[0]!.z));
      expect(beaver).toMatchObject({ x: start.x, z: start.z, heading: start.heading, mode: 'walk' });
    }
  });

  it('puts props on the land, off the path, out of the river and the hills, a third or so to hide behind', () => {
    for (const seed of SEEDS) {
      const { land } = newDream(seed);
      expect(land.props.length).toBeGreaterThanOrEqual(60);
      expect(land.props.length).toBeLessThanOrEqual(90);
      for (const p of land.props) {
        expect(lineDistance(land.path, p.x, p.z)).toBeGreaterThanOrEqual(2);
        expect(lineDistance(land.river, p.x, p.z)).toBeGreaterThanOrEqual(land.riverWidth / 2 + 1.5);
        expect(Math.max(Math.abs(p.x), Math.abs(p.z))).toBeLessThanOrEqual(land.half - 15);
        expect(p.size).toBeGreaterThanOrEqual(0.6);
        expect(p.size).toBeLessThanOrEqual(1.6);
      }
      const hiding = land.props.filter((p) => p.hide).length / land.props.length;
      expect(hiding).toBeGreaterThan(0.2);
      expect(hiding).toBeLessThan(0.5);
      // Some stand along the path, so the walk goes through candy.
      expect(land.props.filter((p) => lineDistance(land.path, p.x, p.z) < 7).length).toBeGreaterThanOrEqual(8);
    }
  });

  it('lays sweets along the path, in the river and over the land, with a few stars', () => {
    for (const seed of SEEDS) {
      const { land, sweets } = newDream(seed);
      expect(sweets.length).toBeGreaterThanOrEqual(40);
      expect(sweets.length).toBeLessThanOrEqual(60);
      const stars = sweets.filter((s) => s.kind === 'star').length;
      expect(stars).toBeGreaterThanOrEqual(3);
      expect(stars).toBeLessThanOrEqual(5);
      expect(sweets.filter((s) => lineDistance(land.path, s.x, s.z) < 2).length).toBeGreaterThanOrEqual(8);
      const floating = sweets.filter((s) => s.floating);
      expect(floating.length).toBeGreaterThanOrEqual(8);
      for (const s of floating) expect(chocolateDepth(land, s.x, s.z)).toBeGreaterThan(0);
      expect(new Set(sweets.map((s) => s.id)).size).toBe(sweets.length);
    }
  });

  it('brings a group of marshmallow beavers, each with its own name and coat, by the river and the path', () => {
    for (const seed of SEEDS) {
      const { land, mallows } = newDream(seed);
      expect(mallows.length).toBe(MALLOW_COLOURS.length);
      expect(new Set(mallows.map((m) => m.name)).size).toBe(mallows.length);
      expect(new Set(mallows.map((m) => m.colour)).size).toBe(mallows.length);
      const end = land.path[land.path.length - 1]!;
      expect(mallows.filter((m) => dist(m, end) < 15).length).toBeGreaterThanOrEqual(3);
      for (const m of mallows) expect(m).toMatchObject({ state: 'wander', met: false });
    }
    expect(newDream(1).mallows.map((m) => m.name)).not.toEqual(newDream(2).mallows.map((m) => m.name));
  });
});

describe('dreamHeight', () => {
  it('is below the chocolate in the river, gently above it on land, and high at the edges', () => {
    for (const seed of SEEDS) {
      const { land } = newDream(seed);
      for (const p of land.river.slice(15, -15)) expect(dreamHeight(land, p.x, p.z)).toBeLessThan(CHOCOLATE_LEVEL - 1);
      for (const p of land.path.slice(0, -6)) {
        expect(dreamHeight(land, p.x, p.z)).toBeGreaterThan(CHOCOLATE_LEVEL + 0.4);
        expect(dreamHeight(land, p.x, p.z)).toBeLessThan(CHOCOLATE_LEVEL + 2.6);
      }
      for (const p of land.props) expect(chocolateDepth(land, p.x, p.z)).toBe(0);
      for (const c of [-1, 1]) {
        expect(dreamHeight(land, c * land.half, c * land.half)).toBeGreaterThan(CHOCOLATE_LEVEL + 10);
      }
    }
  });

  it('has banks gentle enough to walk in and out of the chocolate', () => {
    const { land } = newDream(42);
    const c = land.river[40]!;
    const n = land.river[41]!;
    const len = dist(c, n);
    const ax = -(n.z - c.z) / len;
    const az = (n.x - c.x) / len;
    let last = dreamHeight(land, c.x, c.z);
    for (let d = 0.5; d < 20; d += 0.5) {
      const h = dreamHeight(land, c.x + ax * d, c.z + az * d);
      expect(Math.abs(h - last)).toBeLessThan(0.5);
      last = h;
    }
  });
});

describe('the beaver', () => {
  it('walks on land and follows the ground', () => {
    const s = newDream(7);
    const h = s.beaver.heading;
    const { state } = run(s, 2, input({ move: { x: Math.sin(h), z: Math.cos(h) } }));
    expect(dist(state.beaver, s.beaver)).toBeGreaterThan(6);
    expect(state.beaver.mode).toBe('walk');
    expect(state.beaver.speed).toBeCloseTo(WALK_SPEED, 0);
    expect(state.beaver.y).toBeCloseTo(dreamHeight(state.land, state.beaver.x, state.beaver.z), 5);
    expect(state.time).toBeCloseTo(2, 5);
  });

  it('swims in the chocolate, afloat on it', () => {
    const s = place(newDream(7), riverMiddle(newDream(7)));
    const a = s.land.river[Math.floor(s.land.river.length / 2) + 1]!;
    const m = riverMiddle(s);
    const len = dist(a, m);
    const { state } = run(s, 1, input({ move: { x: (a.x - m.x) / len, z: (a.z - m.z) / len } }));
    expect(state.beaver.mode).toBe('swim');
    expect(state.beaver.y).toBe(CHOCOLATE_LEVEL);
    expect(state.beaver.speed).toBeCloseTo(SWIM_SPEED, 0);
  });

  it('stays inside the land, slowed by the hills', () => {
    const s = newDream(7);
    for (const move of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) {
      const { state } = run(s, 40, input({ move }));
      expect(Math.abs(state.beaver.x)).toBeLessThanOrEqual(s.land.half - 3 + 1e-9);
      expect(Math.abs(state.beaver.z)).toBeLessThanOrEqual(s.land.half - 3 + 1e-9);
    }
  });

  it('hops on land and leaps out of the chocolate, still going forward', () => {
    const s = newDream(7);
    const hop = run(s, 0.3, input({ hop: true }));
    expect(hop.state.beaver.hopAt).toBeCloseTo(DT, 5);
    expect(hop.state.beaver.leap).toBe(false);
    expect(hop.state.beaver.y).toBeGreaterThan(dreamHeight(s.land, s.beaver.x, s.beaver.z) + 0.5);
    const swimming = run(place(s, riverMiddle(s)), 1, input({ move: { x: 1, z: 0 } })).state;
    const leap = run(swimming, 0.45, input({ hop: true }), still);
    expect(leap.state.beaver.leap).toBe(true);
    expect(leap.state.beaver.y).toBeGreaterThan(CHOCOLATE_LEVEL + 0.9);
    expect(dist(leap.state.beaver, swimming.beaver)).toBeGreaterThan(1.2);
  });

  it('splashes with a tail slap in the chocolate, and only slaps on dry land', () => {
    const s = newDream(7);
    const wet = stepDream(place(s, riverMiddle(s)), input({ slap: true }), DT);
    expect(wet.events).toContainEqual(expect.objectContaining({ what: 'splash' }));
    expect(wet.state.beaver.slapAt).toBeCloseTo(DT, 5);
    const dry = stepDream(s, input({ slap: true }), DT);
    expect(dry.events.some((e) => e.what === 'splash')).toBe(false);
    expect(dry.state.beaver.slapAt).toBeCloseTo(DT, 5);
  });
});

describe('sweets', () => {
  it('are taken by touch and counted', () => {
    const s = newDream(7);
    const sweet = s.sweets.find((w) => w.kind !== 'star' && !w.floating)!;
    const r = stepDream(place(s, { x: sweet.x + 0.6, z: sweet.z }), still, DT);
    expect(r.state.count).toBe(1);
    expect(r.state.sweets.find((w) => w.id === sweet.id)!.taken).toBe(true);
    expect(r.events).toContainEqual({ what: 'sweet', kind: sweet.kind, x: sweet.x, z: sweet.z });
    // Taken once only.
    expect(stepDream(r.state, still, DT).state.count).toBe(1);
  });

  it('a star counts five and gives a sugar rush', () => {
    const s = newDream(7);
    const star = s.sweets.find((w) => w.kind === 'star' && !w.floating) ?? s.sweets.find((w) => w.kind === 'star')!;
    const r = stepDream(place(s, star), still, DT);
    expect(r.state.count).toBe(5);
    expect(r.events).toContainEqual({ what: 'rush' });
    expect(r.state.rushUntil).toBeCloseTo(DT + 6, 5);
    // On land the rush makes the walk faster.
    const land = { ...place(r.state, s.land.start), sweets: r.state.sweets.map((w) => ({ ...w, taken: true })) };
    const h = s.land.start.heading;
    const fast = run(land, 1.5, input({ move: { x: Math.sin(h), z: Math.cos(h) } })).state;
    expect(fast.beaver.speed).toBeCloseTo(WALK_SPEED * RUSH, 0);
  });

  it('puts the golden beaver statue a few steps off the path, on dry land, in a new place each night', () => {
    for (const seed of SEEDS) {
      const { land } = newDream(seed);
      const off = Math.min(...land.path.map((p) => Math.hypot(p.x - land.statue.x, p.z - land.statue.z)));
      expect(off).toBeGreaterThan(2);
      expect(off).toBeLessThan(10);
      expect(dreamHeight(land, land.statue.x, land.statue.z)).toBeGreaterThan(CHOCOLATE_LEVEL);
    }
    expect(newDream(7).land.statue).toEqual(newDream(7).land.statue);
    expect(newDream(7).land.statue).not.toEqual(newDream(8).land.statue);
  });

  it('the statue gives a long rush, once', () => {
    const s = newDream(7);
    const r = stepDream(place(s, s.land.statue), still, DT);
    expect(r.events).toContainEqual({ what: 'statue', x: s.land.statue.x, z: s.land.statue.z });
    expect(r.state.rushUntil).toBeCloseTo(DT + STATUE_RUSH_TIME, 5);
    const again = stepDream(place({ ...r.state, rushUntil: 0 }, s.land.statue), still, DT);
    expect(again.state.rushUntil).toBe(0);
    expect(again.events.some((e) => e.what === 'statue')).toBe(false);
  });
});

describe('marshmallow beavers', () => {
  it('say hello once, the first time the player comes near', () => {
    const s = newDream(42);
    const m = s.mallows.find((x) => x.mode === 'walk')!;
    const near = place(s, { x: m.x + 3, z: m.z });
    const { state, events } = run(near, 6);
    expect(events.filter((e) => e.what === 'greet' && e.who === m.name).length).toBe(1);
    expect(mallow(state, m.id).met).toBe(true);
    expect(mallow(state, m.id).state).toBe('wander');
    const again = run(state, 3).events;
    expect(again.some((e) => e.what === 'greet' && e.who === m.name)).toBe(false);
  });

  it('wander about without leaving the land', () => {
    const { state } = run(newDream(1), 30);
    for (const m of state.mallows) {
      expect(Math.abs(m.x)).toBeLessThanOrEqual(INNER);
      expect(Math.abs(m.z)).toBeLessThanOrEqual(INNER);
      expect(m.state).toBe('wander');
    }
    expect(state.mallows.some((m, i) => dist(m, newDream(1).mallows[i]!) > 2)).toBe(true);
  });

  it('give the same dream for the same inputs', () => {
    const go = input({ move: { x: 0.3, z: 0.8 } });
    expect(run(newDream(5), 5, go).state).toEqual(run(newDream(5), 5, go).state);
  });
});

describe('playPrompt', () => {
  it('offers tag in the chocolate and hide and seek on land, near a marshmallow beaver only', () => {
    const s = newDream(42);
    const dry = s.mallows.find((m) => chocolateDepth(s.land, m.x, m.z) === 0)!;
    expect(playPrompt(place(s, { x: dry.x + 2, z: dry.z }))).toBe(`Play hide and seek with ${dry.name}`);
    const wet = s.mallows.find((m) => chocolateDepth(s.land, m.x, m.z) > 0.5)!;
    expect(playPrompt(place(s, { x: wet.x + 0.5, z: wet.z }))).toBe(`Play tag with ${wet.name}`);
    expect(playPrompt(place(s, { x: wet.x + 30, z: wet.z + 30 }))).toBeNull();
  });
});

describe('tag', () => {
  /** A player in the river next to one marshmallow beaver, the others far away. */
  function tagStart(): { s: DreamState; m: Mallow } {
    const d = newDream(42);
    const c = riverMiddle(d);
    const first = d.mallows[3]!;
    const s = alone({ ...d, mallows: d.mallows.map((m) => (m.id === first.id ? { ...m, x: c.x + 1.5, z: c.z, met: true } : m)) }, first.id);
    return { s: place(s, c), m: first };
  }

  it('starts with the chosen one as it, and stops the prompt', () => {
    const { s, m } = tagStart();
    expect(playPrompt(s)).toBe(`Play tag with ${m.name}`);
    const r = stepDream(s, input({ play: true }), DT);
    expect(r.events).toContainEqual({ what: 'tagStart', it: m.name });
    expect(r.state.game).toMatchObject({ kind: 'tag', it: m.id, players: [m.id], catches: 0 });
    expect(mallow(r.state, m.id).state).toBe('chase');
    expect(playPrompt(r.state)).toBeNull();
  });

  it('brings in the marshmallow beavers within 25 m', () => {
    const d = newDream(42);
    const c = riverMiddle(d);
    const s = place({ ...d, mallows: d.mallows.map((m, i) => ({ ...m, x: c.x + 1 + i * 3, z: c.z, met: true })) }, c);
    const r = stepDream(s, input({ play: true }), DT);
    const game = r.state.game;
    expect(game.kind === 'tag' && game.players.length).toBe(d.mallows.filter((_, i) => 1 + i * 3 < 25).length);
    expect(r.state.mallows.filter((m) => m.state === 'flee').length).toBeGreaterThan(0);
  });

  it('catches the player, and the player catches back', () => {
    const { s, m } = tagStart();
    const started = stepDream(s, input({ play: true }), DT).state;
    // The player stays put; it waits a moment, then swims up and tags.
    const caught = runUntil(started, 'caught', 10);
    expect(caught.events).toContainEqual({ what: 'caught', it: 'player', by: m.name });
    expect(caught.state.game).toMatchObject({ kind: 'tag', it: 'player', catches: 1 });
    expect(mallow(caught.state, m.id).state).toBe('flee');
    // No tag-back straight away.
    const soon = stepDream(place(caught.state, mallow(caught.state, m.id)), still, DT);
    expect(soon.events.some((e) => e.what === 'caught')).toBe(false);
    const later = run(caught.state, 2.5).state;
    const back = stepDream(place(later, mallow(later, m.id)), still, DT);
    expect(back.events).toContainEqual({ what: 'caught', it: m.name, by: 'player' });
    expect(back.state.game).toMatchObject({ kind: 'tag', it: m.id, catches: 2 });
  });

  it('lets a marshmallow beaver that is it be outswum, and the others flee from the player', () => {
    const { s, m } = tagStart();
    const started = stepDream(s, input({ play: true }), DT).state;
    // Swimming away along the river, the player keeps ahead of it.
    const a = s.land.river[Math.floor(s.land.river.length / 2) + 1]!;
    const c = riverMiddle(s);
    const len = dist(a, c);
    const away = run(started, 6, input({ move: { x: (a.x - c.x) / len, z: (a.z - c.z) / len } }));
    expect(away.events.some((e) => e.what === 'caught')).toBe(false);
    // The player is it after the first catch: the marshmallow beaver keeps away for a while.
    const caught = runUntil(started, 'caught', 10).state;
    const after = run(caught, 3).state;
    expect(dist(mallow(after, m.id), after.beaver)).toBeGreaterThan(3);
    expect(chocolateDepth(after.land, mallow(after, m.id).x, mallow(after, m.id).z)).toBeGreaterThan(0.3);
  });

  it('ends after a minute with a shower of sweets in the chocolate', () => {
    const { s, m } = tagStart();
    const started = stepDream(s, input({ play: true }), DT).state;
    const before = started.sweets.length;
    const { state, events } = run(started, TAG_TIME + 0.5);
    expect(events.filter((e) => e.what === 'tagEnd').length).toBe(1);
    expect(events).toContainEqual({ what: 'shower', count: SHOWER });
    expect(state.game.kind).toBe('none');
    expect(state.sweets.length).toBe(before + SHOWER);
    expect(state.sweets.slice(before).filter((w) => w.floating).length).toBeGreaterThan(SHOWER / 2);
    expect(mallow(state, m.id).state).toBe('wander');
    const end = events.find((e) => e.what === 'tagEnd');
    expect(end && end.what === 'tagEnd' && end.catches).toBeGreaterThan(0);
  });

  it('ends early when the player stays out of the chocolate', () => {
    const { s } = tagStart();
    const started = stepDream(s, input({ play: true }), DT).state;
    const ashore = place(started, s.land.start);
    const { state, events } = run(ashore, 9);
    expect(events.some((e) => e.what === 'tagEnd')).toBe(true);
    expect(state.game.kind).toBe('none');
  });
});

describe('hide and seek', () => {
  /** The player on land by the end of the path, next to a marshmallow beaver there. */
  function seekStart(): { s: DreamState; m: Mallow } {
    const d = newDream(42);
    const m = d.mallows.find((x) => chocolateDepth(d.land, x.x, x.z) === 0)!;
    const s = place({ ...d, mallows: d.mallows.map((x) => ({ ...x, met: true })) }, { x: m.x + 2, z: m.z });
    return { s, m };
  }

  it('counts to ten while the hiders run off behind distinct props, then the seeking starts', () => {
    const { s, m } = seekStart();
    const r = stepDream(s, input({ play: true, pick: 'seek' }), DT);
    const game = r.state.game;
    if (game.kind !== 'seek') throw new Error('no seek');
    expect(game.phase).toBe('counting');
    expect(game.hiders).toContain(m.id);
    expect(game.hiders.length).toBe(s.mallows.filter((x) => dist(x, s.beaver) < 35).length);
    expect(r.events).toContainEqual({ what: 'seekStart', hiders: game.hiders.length });
    expect(playPrompt(r.state)).toBeNull();
    const counted = run(r.state, COUNT_TIME + 0.1);
    expect(counted.events).toContainEqual({ what: 'seekGo' });
    expect(counted.state.game).toMatchObject({ kind: 'seek', phase: 'seeking' });
    const { state } = run(counted.state, 15);
    const props = new Set<string>();
    for (const id of game.hiders) {
      const h = mallow(state, id);
      expect(h.state).toBe('hidden');
      const prop = state.land.props.find((p) => p.id === h.hideAt)!;
      expect(prop.hide).toBe(true);
      props.add(prop.id);
      const away = dist(prop, s.beaver);
      expect(away).toBeGreaterThanOrEqual(12);
      expect(away).toBeLessThanOrEqual(40);
      // Right behind it, on the side away from where the player counted.
      expect(dist(h, prop)).toBeLessThan(PROP_RADIUS[prop.kind] * prop.size + 1.3);
      expect((h.x - prop.x) * (prop.x - s.beaver.x) + (h.z - prop.z) * (prop.z - s.beaver.z)).toBeGreaterThan(0);
    }
    expect(props.size).toBe(game.hiders.length);
    expect(playPrompt(state)).toBeNull();
  });

  it('hiders giggle when the player is near enough to hear', () => {
    const { s } = seekStart();
    const hidden = run(stepDream(s, input({ play: true, pick: 'seek' }), DT).state, COUNT_TIME + 15).state;
    const game = hidden.game;
    if (game.kind !== 'seek') throw new Error('no seek');
    const h = mallow(hidden, game.hiders[0]!);
    // Far off, nothing is heard.
    const far = run(place(hidden, { x: h.x + 30, z: h.z + 30 }), 10).events;
    expect(far.some((e) => e.what === 'giggle' && e.who === h.name)).toBe(false);
    // Near, a giggle comes within ten seconds, and only from where it hides.
    const prop = hidden.land.props.find((p) => p.id === h.hideAt)!;
    const ux = (h.x - prop.x) / dist(h, prop);
    const uz = (h.z - prop.z) / dist(h, prop);
    const near = run(place(hidden, { x: prop.x - ux * 8, z: prop.z - uz * 8 }), 10);
    const giggle = near.events.find((e) => e.what === 'giggle' && e.who === h.name);
    expect(giggle).toMatchObject({ what: 'giggle', who: h.name, x: h.x, z: h.z });
    expect(mallow(near.state, h.id).giggleAt).not.toBeNull();
  });

  it('finding all of them ends it with a shower of sweets on land, and they follow the player a little', () => {
    const { s } = seekStart();
    let state = run(stepDream(s, input({ play: true, pick: 'seek' }), DT).state, COUNT_TIME + 15).state;
    const game = state.game;
    if (game.kind !== 'seek') throw new Error('no seek');
    const before = state.sweets.length;
    const events: DreamEvent[] = [];
    for (const id of game.hiders) {
      const h = mallow(state, id);
      const r = stepDream(place(state, { x: h.x + 1, z: h.z }), still, DT);
      state = r.state;
      events.push(...r.events);
      expect(r.events).toContainEqual(expect.objectContaining({ what: 'found', who: h.name }));
    }
    const lefts = events.flatMap((e) => (e.what === 'found' ? [e.left] : []));
    expect(lefts[lefts.length - 1]).toBe(0);
    expect(events).toContainEqual({ what: 'seekEnd' });
    expect(events).toContainEqual({ what: 'shower', count: SHOWER });
    expect(state.game.kind).toBe('none');
    expect(state.sweets.length).toBe(before + SHOWER);
    expect(state.sweets.slice(before).filter((w) => !w.floating).length).toBeGreaterThan(SHOWER / 2);
    for (const id of game.hiders) expect(mallow(state, id).state).toBe('follow');
    const later = run(state, 6).state;
    for (const id of game.hiders) expect(mallow(later, id).state).toBe('wander');
  });

  it('found ones follow the player while the others are still hidden', () => {
    const { s } = seekStart();
    let state = run(stepDream(s, input({ play: true, pick: 'seek' }), DT).state, COUNT_TIME + 15).state;
    const game = state.game;
    if (game.kind !== 'seek' || game.hiders.length < 2) throw new Error('need two hiders');
    const h = mallow(state, game.hiders[0]!);
    state = stepDream(place(state, { x: h.x + 1, z: h.z }), still, DT).state;
    const p = state.beaver;
    const walk = run(state, 4, input({ move: { x: -Math.sign(p.x) || 1, z: 0 } })).state;
    const f = mallow(walk, h.id);
    expect(f.state).toBe('follow');
    expect(dist(f, walk.beaver)).toBeLessThan(5);
    expect(walk.game).toMatchObject({ kind: 'seek', found: [h.id] });
  });
});

describe('hide or seek', () => {
  /** The player on land next to a marshmallow beaver, as for hide and seek. */
  function nextTo(): { s: DreamState; m: Mallow } {
    const d = newDream(42);
    const m = d.mallows.find((x) => chocolateDepth(d.land, x.x, x.z) === 0)!;
    return { s: place({ ...d, mallows: d.mallows.map((x) => ({ ...x, met: true })) }, { x: m.x + 2, z: m.z }), m };
  }

  it('on land, Play asks first, and the one asked waits looking at the player', () => {
    const { s, m } = nextTo();
    const r = stepDream(s, input({ play: true }), DT);
    expect(r.state.game).toEqual({ kind: 'choose', with: m.id });
    expect(r.events.some((e) => e.what === 'seekStart' || e.what === 'hideStart')).toBe(false);
    expect(hideOrSeek(r.state)).toBe(m.name);
    expect(hideOrSeek(s)).toBeNull();
    expect(playPrompt(r.state)).toBeNull();
    const waited = run(r.state, 3).state;
    expect(waited.game).toEqual({ kind: 'choose', with: m.id });
    expect(dist(mallow(waited, m.id), mallow(s, m.id))).toBeLessThan(0.5);
    const w = mallow(waited, m.id);
    expect(Math.abs(Math.atan2(waited.beaver.x - w.x, waited.beaver.z - w.z) - w.heading)).toBeLessThan(0.1);
  });

  it('starts the game picked, and walking off drops the question', () => {
    const { s } = nextTo();
    const asked = stepDream(s, input({ play: true }), DT).state;
    expect(stepDream(asked, input({ pick: 'seek' }), DT).state.game).toMatchObject({ kind: 'seek', phase: 'counting' });
    expect(stepDream(asked, input({ pick: 'hide' }), DT).state.game).toMatchObject({ kind: 'hide', phase: 'counting' });
    const off = stepDream(place(asked, { x: asked.beaver.x + 9, z: asked.beaver.z }), input({ pick: 'hide' }), DT).state;
    expect(off.game.kind).toBe('none');
    // A pick with no question does nothing.
    expect(stepDream(s, input({ pick: 'hide' }), DT).state.game.kind).toBe('none');
  });
});

describe('hiding from the marshmallow beavers', () => {
  function hideStart(): { s: DreamState; m: Mallow; r: { state: DreamState; events: DreamEvent[] } } {
    const d = newDream(42);
    const m = d.mallows.find((x) => chocolateDepth(d.land, x.x, x.z) === 0)!;
    const s = place({ ...d, mallows: d.mallows.map((x) => ({ ...x, met: true })) }, { x: m.x + 2, z: m.z });
    return { s, m, r: stepDream(s, input({ play: true, pick: 'hide' }), DT) };
  }

  /** The corner of the land farthest from a point, well out of the seekers' way. */
  const farCorner = (p: DreamPoint): DreamPoint => ({ x: -Math.sign(p.x || 1) * (INNER - 4), z: -Math.sign(p.z || 1) * (INNER - 4) });

  /** Hiding has begun and the seeking is on, with the player far off in a corner. */
  function seeking(): { state: DreamState; seekers: string[]; base: DreamPoint } {
    const { r } = hideStart();
    const g = r.state.game;
    if (g.kind !== 'hide') throw new Error('no hide');
    const state = run(place(r.state, farCorner(g.base)), COUNT_TIME + 0.1).state;
    return { state, seekers: g.seekers, base: g.base };
  }

  it('the one asked and the nearest others, four at most, count at the base while the player runs off', () => {
    const { s, m, r } = hideStart();
    const g = r.state.game;
    if (g.kind !== 'hide') throw new Error('no hide');
    expect(g.phase).toBe('counting');
    expect(g.seekers[0]).toBe(m.id);
    expect(g.seekers.length).toBe(Math.min(4, s.mallows.filter((x) => dist(x, s.beaver) < 35).length));
    expect(dist(g.base, s.beaver)).toBeLessThan(0.05);
    expect(r.events).toContainEqual({ what: 'hideStart', seekers: g.seekers.length });
    for (const id of g.seekers) expect(mallow(r.state, id).state).toBe('count');
    const counting = run(r.state, COUNT_TIME - 1, input({ move: { x: 1, z: 0 } }));
    expect(counting.events.some((e) => e.what === 'spotted')).toBe(false);
    expect(dist(mallow(counting.state, m.id), g.base)).toBeLessThan(2.5);
    const go = run(counting.state, 1.2);
    expect(go.events).toContainEqual({ what: 'hideGo' });
    expect(go.state.game).toMatchObject({ kind: 'hide', phase: 'seeking' });
    for (const id of g.seekers) expect(mallow(go.state, id).state).toBe('seek');
  });

  it('seekers go slower than the player, looking behind the hiding props near the base', () => {
    const { state, seekers, base } = seeking();
    let st = state;
    const peeked = new Set<string>();
    let fastest = 0;
    for (let i = 0; i < 20 / DT; i++) {
      st = stepDream(st, still, DT).state;
      for (const id of seekers) {
        const m = mallow(st, id);
        fastest = Math.max(fastest, m.speed);
        if (m.peek) peeked.add(m.peek);
      }
    }
    expect(fastest).toBeLessThanOrEqual(SEEK_SPEED + 0.01);
    expect(SEEK_SPEED).toBeLessThan(WALK_SPEED);
    expect(peeked.size).toBeGreaterThan(seekers.length);
    for (const id of peeked) {
      const p = st.land.props.find((q) => q.id === id)!;
      expect(p.hide).toBe(true);
      expect(dist(p, base)).toBeLessThan(50);
    }
  });

  it('a seeker sees a player in the open, but not one behind a hiding prop', () => {
    const { state, seekers } = seeking();
    const id = seekers[0]!;
    const prop = state.land.props.find((p) => p.hide && dist(p, state.beaver) > 20 && PROP_RADIUS[p.kind] * p.size > 0.6)!;
    const r = PROP_RADIUS[prop.kind] * prop.size;
    const at = (p: DreamPoint): DreamState => ({ ...state, mallows: state.mallows.map((m) => (m.id === id ? { ...m, x: p.x, z: p.z, goal: { x: p.x, z: p.z }, until: state.time + 5 } : m)) });
    const seeker = { x: prop.x + r + 4, z: prop.z };
    const behind = stepDream(place(at(seeker), { x: prop.x - r - 0.5, z: prop.z }), still, DT);
    expect(behind.events.some((e) => e.what === 'spotted')).toBe(false);
    const open = stepDream(place(at(seeker), { x: seeker.x, z: seeker.z + 4 }), still, DT);
    expect(open.events).toContainEqual({ what: 'spotted', who: mallow(state, id).name, left: seekers.length - 1 });
    const found = mallow(open.state, id);
    expect(found.state).toBe('home');
    expect(found.giggleAt).toBe(open.state.time);
    expect(found.hopAt).toBe(open.state.time);
    expect(open.state.game).toMatchObject({ kind: 'hide', found: [id] });
  });

  it('seekers near the player giggle, and they find one hiding by the base within the minute', () => {
    const { r } = hideStart();
    const g = r.state.game;
    if (g.kind !== 'hide') throw new Error('no hide');
    const prop = r.state.land.props.filter((p) => p.hide && dist(p, g.base) > 10).sort((a, b) => dist(a, g.base) - dist(b, g.base))[0]!;
    const k = (PROP_RADIUS[prop.kind] * prop.size + 0.6) / dist(prop, g.base);
    const spot = { x: prop.x + (prop.x - g.base.x) * k, z: prop.z + (prop.z - g.base.z) * k };
    const { events } = run(place(r.state, spot), COUNT_TIME + 60);
    const spotted = events.findIndex((e) => e.what === 'spotted');
    expect(spotted).toBeGreaterThan(-1);
    expect(events.slice(0, spotted).some((e) => e.what === 'giggle' && g.seekers.some((id) => mallow(r.state, id).name === e.who))).toBe(true);
  });

  it('ends with a shower of sweets on land when all have found the player', () => {
    const { state, seekers } = seeking();
    let st = state;
    const events: DreamEvent[] = [];
    const before = st.sweets.length;
    for (const id of seekers) {
      const m = mallow(st, id);
      const r = stepDream(place(st, { x: m.x + 1, z: m.z }), still, DT);
      st = r.state;
      events.push(...r.events);
    }
    expect(events.filter((e) => e.what === 'spotted').length).toBe(seekers.length);
    expect(events).toContainEqual({ what: 'hideEnd', found: seekers.length, seekers: seekers.length });
    expect(events).toContainEqual({ what: 'shower', count: SHOWER });
    expect(st.game.kind).toBe('none');
    expect(st.sweets.length).toBe(before + SHOWER);
    for (const id of seekers) expect(mallow(st, id).state).toBe('follow');
    for (const id of seekers) expect(mallow(run(st, 6).state, id).state).toBe('wander');
  });

  it('ends after a minute with sweets all the same when nobody found the player', () => {
    const { state, seekers } = seeking();
    const { state: st, events } = run(state, HIDE_TIME + 0.5);
    expect(events.some((e) => e.what === 'spotted')).toBe(false);
    expect(events).toContainEqual({ what: 'hideEnd', found: 0, seekers: seekers.length });
    expect(events).toContainEqual({ what: 'shower', count: SHOWER });
    expect(st.game.kind).toBe('none');
  });
});
