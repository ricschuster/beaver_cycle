import { describe, expect, it } from 'vitest';
import { COUNT_TIME, FIND_CLOSE, FIND_REACH, GATHER_REACH, INVITE_TIME, NOTE_REACH, PLAY_RADIUS, SEEK_TIME, accept, clearLine, decline, drop, frozen, hiddenFrom, invite, noteTo, step, timeLeft, type HideGame, type Spot } from './hideGame';

const at = (id: string, x: number, z = 0): Spot => ({ id, x, z });
const asker = at('host', 0);

/** A game with `host` seeking and g1 hiding, in the count. */
function counting(role: 'hide' | 'seek' = 'seek'): HideGame {
  let g = invite(asker, role, ['g1'], 0) as HideGame;
  g = accept(g, 'g1');
  return step(g, [asker, at('g1', 2)], [], 1).game as HideGame;
}

describe('hide and seek between players', () => {
  it('a note reaches the friends within NOTE_REACH', () => {
    expect(noteTo(asker, [at('a', NOTE_REACH - 1), at('b', NOTE_REACH + 1), at('host', 1)])).toEqual(['a']);
  });

  it('an invitation to nobody is no game', () => {
    expect(invite(asker, 'hide', [], 0)).toBeNull();
    expect(invite(asker, 'hide', ['host'], 0)).toBeNull();
  });

  it('starts when every friend who said yes has walked over, and the asker keeps the chosen role', () => {
    let g = invite(asker, 'hide', ['a', 'b'], 0) as HideGame;
    g = accept(accept(g, 'a'), 'b');
    const far = step(g, [asker, at('a', 3), at('b', GATHER_REACH + 5)], [], 2);
    expect(far.game?.phase).toBe('invite');
    const near = step(g, [asker, at('a', 3), at('b', GATHER_REACH - 1)], [], 3);
    expect(near.game?.phase).toBe('count');
    expect(near.game?.roles).toEqual({ host: 'hide', a: 'seek', b: 'seek' });
    expect(near.events).toEqual([{ t: 'start' }]);
  });

  it('starts after INVITE_TIME with the friends who came, and is no game when none came', () => {
    let g = invite(asker, 'seek', ['a', 'b'], 0) as HideGame;
    g = accept(accept(g, 'a'), 'b');
    const late = step(g, [asker, at('a', 3), at('b', 50)], [], INVITE_TIME);
    expect(late.game?.roles).toEqual({ host: 'seek', a: 'hide' });
    const none = invite(asker, 'seek', ['a'], 0) as HideGame;
    expect(step(none, [asker, at('a', 3)], [], INVITE_TIME).game).toBeNull();
  });

  it('a friend who says not now is left out, and a lone asker whose friend declined has no game', () => {
    const g = invite(asker, 'seek', ['a', 'b'], 0) as HideGame;
    expect(decline(g, 'a').invited).toEqual(['b']);
    expect(drop(decline(g, 'a'), 'b')).toBeNull();
    expect(drop(g, 'host')).toBeNull();
  });

  it('seekers stand still during the count and the hiders are hidden from them until found', () => {
    const g = counting();
    expect(frozen(g, 'host')).toBe(true);
    expect(frozen(g, 'g1')).toBe(false);
    expect(hiddenFrom(g, 'host')).toEqual(['g1']);
    expect(hiddenFrom(g, 'g1')).toEqual([]);
    expect(timeLeft(g, 1 + 4)).toBe(COUNT_TIME - 4);
    const seeking = step(g, [asker, at('g1', 30)], [], 1 + COUNT_TIME).game as HideGame;
    expect(seeking.phase).toBe('seek');
    expect(frozen(seeking, 'host')).toBe(false);
  });

  it('a seeker finds a hider within reach with a clear line, or close by through a tree', () => {
    const seeking = step(counting(), [asker, at('g1', 30)], [], 20).game as HideGame;
    const tree = [{ x: 3, z: 0, r: 0.6 }];
    expect(step(seeking, [asker, at('g1', FIND_REACH + 1)], [], 21).game?.found).toEqual([]);
    expect(step(seeking, [asker, at('g1', FIND_REACH - 1)], tree, 21).game?.found).toEqual([]);
    const clear = step(seeking, [asker, at('g1', FIND_REACH - 1)], [], 21);
    expect(clear.events).toEqual([{ t: 'found', hider: 'g1', seeker: 'host' }, { t: 'end' }]);
    expect(clear.game?.phase).toBe('cheer');
    const close = step(seeking, [asker, at('g1', FIND_CLOSE - 0.5)], tree, 21);
    expect(close.game?.found).toEqual(['g1']);
  });

  it('a found hider shows to the seeker again, and the round goes on while another hides', () => {
    let g = invite(asker, 'seek', ['a', 'b'], 0) as HideGame;
    g = accept(accept(g, 'a'), 'b');
    const players = [asker, at('a', 3), at('b', 4)];
    g = step(g, players, [], 1).game as HideGame;
    g = step(g, [asker, at('a', 40), at('b', 40, 30)], [], 20).game as HideGame;
    const one = step(g, [asker, at('a', 3), at('b', 40, 30)], [], 21);
    expect(one.game?.phase).toBe('seek');
    expect(hiddenFrom(one.game, 'host')).toEqual(['b']);
  });

  it('the round ends after SEEK_TIME with a cheer, then the game is over', () => {
    const seeking = step(counting(), [asker, at('g1', 40)], [], 20).game as HideGame;
    const end = step(seeking, [asker, at('g1', 40)], [], 20 + SEEK_TIME);
    expect(end.game?.phase).toBe('cheer');
    expect(step(end.game as HideGame, [asker, at('g1', 40)], [], 20 + SEEK_TIME + 6).game).toBeNull();
  });

  it('a player who walks too far or leaves is out, and with no hider or seeker left the round ends', () => {
    const g = counting();
    const gone = step(g, [asker], [], 5);
    expect(gone.game?.phase).toBe('cheer');
    const far = step(g, [asker, at('g1', PLAY_RADIUS + 5)], [], 5);
    expect(far.game?.phase).toBe('cheer');
    expect(drop(g, 'g1')?.roles).toEqual({ host: 'seek' });
  });

  it('the asker leaving during the invitation ends it', () => {
    const g = invite(asker, 'hide', ['a'], 0) as HideGame;
    expect(step(g, [at('a', 1)], [], 1).game).toBeNull();
  });

  it('a line is clear when no blocker stands on it', () => {
    expect(clearLine(at('a', 0), at('b', 10), [{ x: 5, z: 3, r: 1 }])).toBe(true);
    expect(clearLine(at('a', 0), at('b', 10), [{ x: 5, z: 0.5, r: 1 }])).toBe(false);
    expect(clearLine(at('a', 0), at('b', 10), [{ x: 15, z: 0, r: 1 }])).toBe(true);
  });
});
