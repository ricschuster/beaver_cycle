import { describe, expect, it } from 'vitest';
import { GuestIntent } from './guestIntent';

const move = { x: 0.5, z: -1 };

describe('a guest\'s intent', () => {
  it('sends the move and dive with nothing else when nothing was pressed', () => {
    expect(new GuestIntent().send(move, true)).toEqual({ t: 'intent', x: 0.5, z: -1, dive: true, gnaw: false });
  });

  it('keeps a press between two sends, and spends it once sent', () => {
    const g = new GuestIntent();
    g.press('build', null, false);
    g.press(null, null, false);
    expect(g.send(move, false)).toMatchObject({ do: 'build' });
    expect(g.send(move, false)).not.toHaveProperty('do');
  });

  it('keeps a gnaw apart from the other presses', () => {
    const g = new GuestIntent();
    g.press('gnaw', null, false);
    g.press('eat', null, false);
    expect(g.send(move, false)).toMatchObject({ gnaw: true, do: 'eat' });
    expect(g.send(move, false).gnaw).toBe(false);
  });

  it('asks to part as a partner press, and ignores presses the host does not act on', () => {
    const g = new GuestIntent();
    g.press('part', null, false);
    expect(g.send(move, false)).toMatchObject({ do: 'partner' });
    g.press('talk', null, false);
    g.press('dig', null, false);
    expect(g.send(move, false)).not.toHaveProperty('do');
  });

  it('takes a partner wish from a card', () => {
    const g = new GuestIntent();
    g.partner();
    expect(g.send(move, false)).toMatchObject({ do: 'partner' });
  });

  it('sends a take and a dive tap once', () => {
    const g = new GuestIntent();
    g.press(null, 'log', true);
    expect(g.send(move, false)).toMatchObject({ take: 'log', diveTap: true });
    const next = g.send(move, false);
    expect(next).not.toHaveProperty('take');
    expect(next).not.toHaveProperty('diveTap');
  });
});
