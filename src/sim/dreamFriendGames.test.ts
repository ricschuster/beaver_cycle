import { describe, expect, it } from 'vitest';
import { COUNT_TIME, PROP_RADIUS, bankSpot, chocolateDepth, friendPrompt, joinDream, leaveDream, newDream, stepDream, viewFrom, type DreamEvent, type DreamInput, type DreamPoint, type DreamState, type Mallow } from './dream';

const DT = 1 / 30;
const still: DreamInput = { move: { x: 0, z: 0 }, hop: false, slap: false, play: false };
const play: DreamInput = { ...still, play: true };

const at = (s: DreamState, p: DreamPoint): DreamState => ({ ...s, beaver: { ...s.beaver, x: p.x, z: p.z } });
const friendAt = (s: DreamState, id: string, p: DreamPoint): DreamState => ({ ...s, friends: s.friends!.map((f) => (f.id === id ? { ...f, beaver: { ...f.beaver, x: p.x, z: p.z } } : f)) });
const mallowAt = (s: DreamState, id: string, p: DreamPoint): DreamState => ({ ...s, mallows: s.mallows.map((m) => (m.id === id ? { ...m, x: p.x, z: p.z, met: true } : m)) });
const mallow = (s: DreamState, id: string): Mallow => s.mallows.find((m) => m.id === id)!;
/** Every marshmallow beaver far away, except those named. */
const alone = (s: DreamState, keep: string[]): DreamState => ({ ...s, mallows: s.mallows.map((m) => (keep.includes(m.id) ? m : { ...m, x: 200, z: 200 })) });

function step(s: DreamState, input: DreamInput, friends: Record<string, DreamInput> = {}): { state: DreamState; events: DreamEvent[] } {
  return stepDream(s, input, DT, friends);
}

describe('friends in tag', () => {
  /** The player in the river with a friend beside them and one marshmallow beaver near, tag started. */
  function tagging(): { s: DreamState; m: Mallow } {
    const d = joinDream(newDream(42), 'g1');
    const c = d.land.river[Math.floor(d.land.river.length / 2)]!;
    const m = d.mallows[3]!;
    let s = alone(d, [m.id]);
    s = mallowAt(s, m.id, { x: c.x + 1.5, z: c.z });
    s = friendAt(at(s, c), 'g1', { x: c.x - 1.5, z: c.z });
    return { s: step(s, play).state, m };
  }

  it('brings in a friend near the player, who may be chased', () => {
    const { s, m } = tagging();
    expect(s.game).toMatchObject({ kind: 'tag', it: m.id, players: [m.id, 'g1'] });
  });

  it('makes a friend it when a marshmallow beaver catches it, and the friend then tags by touching', () => {
    const { s, m } = tagging();
    // The marshmallow beaver that is it goes for the friend, and stands beside it.
    const chasing = s.game.kind === 'tag' ? { ...s, game: { ...s.game, chase: 'g1' } } : s;
    const f = chasing.friends![0]!.beaver;
    let t = mallowAt(chasing, m.id, { x: f.x + 0.5, z: f.z });
    t = { ...t, mallows: t.mallows.map((o) => (o.id === m.id ? { ...o, until: undefined } : o)) };
    const caught = step({ ...t, game: { ...(t.game as object), calm: 0 } as never }, still, { g1: still });
    expect(caught.events).toContainEqual({ what: 'caught', it: 'g1', by: m.name });
    expect(caught.state.game).toMatchObject({ kind: 'tag', it: 'g1', catches: 1 });
    expect(caught.state.game.kind === 'tag' && caught.state.game.chase).toBeUndefined();
    expect(mallow(caught.state, m.id).state).toBe('flee');
    // The caught friend tags the marshmallow beaver it touches, once the calm is over.
    const later = { ...caught.state, game: { ...(caught.state.game as object), calm: 0 } as never } as DreamState;
    const tagged = step(friendAt(later, 'g1', { x: mallow(later, m.id).x, z: mallow(later, m.id).z + 0.5 }), still, { g1: still });
    expect(tagged.events).toContainEqual({ what: 'caught', it: m.name, by: 'g1' });
    expect(tagged.state.game).toMatchObject({ kind: 'tag', it: m.id, catches: 2 });
  });

  it('lets a friend who is it catch the player', () => {
    const { s } = tagging();
    const f = s.friends![0]!.beaver;
    const it: DreamState = { ...s, game: { ...(s.game as object), it: 'g1', chase: undefined, calm: 0 } as never };
    const r = step(at(it, { x: f.x + 0.5, z: f.z }), still, { g1: still });
    expect(r.events).toContainEqual({ what: 'caught', it: 'player', by: 'g1' });
    expect(r.state.game).toMatchObject({ kind: 'tag', it: 'player' });
  });

  it('makes the player it again when the friend who was it wakes', () => {
    const { s } = tagging();
    const it: DreamState = { ...s, game: { ...(s.game as object), it: 'g1' } as never };
    const woke = leaveDream(it, 'g1');
    expect(woke.game).toMatchObject({ kind: 'tag', it: 'player', players: [expect.any(String)] });
  });
});

describe('friends in hide and seek', () => {
  /** The player on land beside a marshmallow beaver, a friend beside the player. */
  function seekStart(): { s: DreamState; m: Mallow } {
    const d = joinDream(newDream(42), 'g1');
    const m = d.mallows.find((x) => chocolateDepth(d.land, x.x, x.z) === 0)!;
    const s = at({ ...d, mallows: d.mallows.map((x) => ({ ...x, met: true })) }, { x: m.x + 2, z: m.z });
    return { s: friendAt(s, 'g1', { x: m.x + 3, z: m.z }), m };
  }

  it('lets a friend find a hider by walking up to it', () => {
    const { s } = seekStart();
    let st = step(s, { ...still, play: true, pick: 'seek' }).state;
    for (let i = 0; i < (COUNT_TIME + 0.5) / DT; i++) st = step(st, still, { g1: still }).state;
    const hider = st.mallows.find((m) => m.state === 'hidden')!;
    expect(hider).toBeDefined();
    // The player stays far away; only the friend stands by the hider.
    st = at(st, { x: 0, z: 0 });
    const r = step(friendAt(st, 'g1', { x: hider.x + 1, z: hider.z }), still, { g1: still });
    expect(r.events.some((e) => e.what === 'found' && e.who === hider.name)).toBe(true);
  });

  it('lets a seeker that sees a friend find someone, though the player is out of sight', () => {
    const { s } = seekStart();
    let st = step(s, { ...play, pick: 'hide' }).state;
    expect(st.game.kind).toBe('hide');
    // Everyone runs off while the seekers count.
    st = friendAt(at(st, { x: 90, z: 90 }), 'g1', { x: -90, z: 90 });
    for (let i = 0; i < (COUNT_TIME + 0.5) / DT; i++) st = step(st, still, { g1: still }).state;
    const game = st.game;
    if (game.kind !== 'hide') throw new Error('no hide');
    const seeker = mallow(st, game.seekers[0]!);
    // The player far off, the friend in the open next to the seeker.
    st = at(mallowAt(st, seeker.id, { x: seeker.x, z: seeker.z }), { x: 90, z: 90 });
    const r = step(friendAt(st, 'g1', { x: seeker.x + 1, z: seeker.z }), still, { g1: still });
    expect(r.events.some((e) => e.what === 'spotted' && e.who === seeker.name)).toBe(true);
    // Behind a prop from the seeker's side, with the player far too, nobody is spotted.
    const prop = st.land.props.find((p) => p.hide && PROP_RADIUS[p.kind] * p.size > 0.6 && Math.hypot(p.x - seeker.x, p.z - seeker.z) > 20)!;
    const rad = PROP_RADIUS[prop.kind] * prop.size;
    const behind = step(friendAt(mallowAt(st, seeker.id, { x: prop.x + rad + 4, z: prop.z }), 'g1', { x: prop.x - rad - 0.5, z: prop.z }), still, { g1: still });
    expect(behind.events.some((e) => e.what === 'spotted')).toBe(false);
  });
});

describe('friends in the plant race', () => {
  const veggie = (): DreamState => joinDream(newDream(7, [], 'veggie'), 'g1');

  it('gives a friend near the bed a plant of its own, and the veggie beavers the beds that are left', () => {
    const d = veggie();
    const bed = d.land.beds![0]!;
    const s = friendAt(at(d, bed), 'g1', { x: bed.x + 2, z: bed.z });
    const r = step(s, play, { g1: still });
    expect(r.events).toContainEqual({ what: 'growStart', friends: 3 });
    const owners = r.state.plants!.map((p) => p.owner);
    expect(owners[0]).toBe('player');
    expect(owners[1]).toBe('g1');
    expect(new Set(r.state.plants!.map((p) => p.bed)).size).toBe(4);
    expect(r.state.mallows.filter((m) => m.state === 'water')).toHaveLength(2);
  });

  it('lets a friend fill its can at the river and water its plant, with a can of its own', () => {
    const d = veggie();
    const bed = d.land.beds![0]!;
    let s = step(friendAt(at(d, bed), 'g1', { x: bed.x + 2, z: bed.z }), play, { g1: still }).state;
    const mine = s.plants!.find((p) => p.owner === 'g1')!;
    const home = s.land.beds![mine.bed]!;
    const bank = bankSpot(s.land, home);
    const filled = step(friendAt(s, 'g1', bank), still, { g1: play });
    expect(filled.events.some((e) => e.what === 'fill' && e.who === 'g1')).toBe(true);
    expect(filled.state.game).toMatchObject({ kind: 'grow', can: false, cans: ['g1'] });
    s = filled.state;
    const watered = step(friendAt(s, 'g1', home), still, { g1: play });
    expect(watered.events).toContainEqual({ what: 'water', who: 'g1', stage: 1, x: home.x, z: home.z });
    expect(watered.state.game).toMatchObject({ kind: 'grow', cans: [] });
    expect(watered.state.plants!.find((p) => p.owner === 'g1')!.stage).toBe(1);
    // The player's own plant and can are untouched.
    expect(watered.state.plants!.find((p) => p.owner === 'player')!.stage).toBe(0);
  });

  it('does not grow the plant of a friend who is not in the game', () => {
    const d = veggie();
    const bed = d.land.beds![0]!;
    // The friend is far from the player, so it takes no bed, and Do near a bank does not fill a can.
    const s = step(friendAt(at(d, bed), 'g1', { x: 90, z: 90 }), play, { g1: still }).state;
    expect(s.plants!.some((p) => p.owner === 'g1')).toBe(false);
    const bank = bankSpot(s.land, bed);
    const r = step(friendAt(s, 'g1', bank), still, { g1: play });
    expect(r.events.some((e) => e.what === 'fill')).toBe(false);
  });
});

describe('a friend in the statue', () => {
  it('lets a friend touch the golden statue, for a rush for all', () => {
    const d = joinDream(newDream(7), 'g1');
    const r = step(friendAt(d, 'g1', d.land.statue), still, { g1: still });
    expect(r.events.some((e) => e.what === 'statue')).toBe(true);
    expect(r.state.statueTouched).toBe(true);
    expect(r.state.rushUntil).toBeGreaterThan(r.state.time);
  });
});

describe('a friend\'s view of the games', () => {
  it('swaps who is it and who is chased, and drops the owner\'s question', () => {
    const d = joinDream(newDream(42), 'g1');
    const tag: DreamState = { ...d, game: { kind: 'tag', it: 'g1', players: ['m0', 'g1'], since: 0, ends: 60, catches: 0, chase: 'player' } };
    const v = viewFrom(tag, 'g1', 'host');
    expect(v.game).toMatchObject({ kind: 'tag', it: 'player', players: ['m0', 'host'], chase: 'host' });
    const asked: DreamState = { ...d, game: { kind: 'choose', with: 'm0' } };
    expect(viewFrom(asked, 'g1', 'host').game.kind).toBe('none');
  });

  it('shows a friend its own plant and can as the player\'s', () => {
    const d = joinDream(newDream(7, [], 'veggie'), 'g1');
    const g: DreamState = {
      ...d,
      plants: [
        { bed: 0, owner: 'player', stage: 2 },
        { bed: 1, owner: 'g1', stage: 1 },
      ],
      game: { kind: 'grow', ends: 90, can: true, cans: ['g1'] },
    };
    const v = viewFrom(g, 'g1', 'host');
    expect(v.plants).toEqual([
      { bed: 0, owner: 'host', stage: 2 },
      { bed: 1, owner: 'player', stage: 1 },
    ]);
    expect(v.game).toMatchObject({ kind: 'grow', can: true, cans: ['host'] });
    const none: DreamState = { ...g, game: { kind: 'grow', ends: 90, can: true } };
    expect(viewFrom(none, 'g1', 'host').game).toMatchObject({ can: false, cans: ['host'] });
  });

  it('prompts a friend to tend its plant or take a boat, never to start a game', () => {
    const d = joinDream(newDream(7, [], 'veggie'), 'g1');
    const bed = d.land.beds![1]!;
    const g: DreamState = {
      ...d,
      plants: [
        { bed: 0, owner: 'player', stage: 0 },
        { bed: 1, owner: 'g1', stage: 0 },
      ],
      game: { kind: 'grow', ends: 90, can: false },
    };
    const v = viewFrom(g, 'g1', 'host');
    expect(friendPrompt(at(v, bankSpot(v.land, bed)))).toBe('Fill your watering can');
    expect(friendPrompt(newDream(7))).toBeNull();
    const m = newDream(42).mallows[0]!;
    expect(friendPrompt(at(newDream(42), { x: m.x + 1, z: m.z }))).toBeNull();
  });
});

