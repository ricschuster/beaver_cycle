import { describe, expect, it } from 'vitest';
import { newDream, type DreamInput } from '../sim/dream';
import { wireOf, type DreamWire } from './dreamWire';
import { DREAM_GONE, DREAM_WAIT, GuestDream } from './guestDream';

const input = (over: Partial<DreamInput> = {}): DreamInput => ({ move: { x: 0, z: 0 }, hop: false, slap: false, play: false, ...over }) as DreamInput;

describe('a guest waiting for its dream', () => {
  it('opens with the host\'s first frame, and not before', () => {
    const g = new GuestDream();
    g.ask(10);
    expect(g.waiting(false, 11)).toBeNull();
    expect(g.waiting(true, 12)).toBe('open');
    expect(g.waiting(true, 13)).toBeNull();
  });

  it('gives up after the wait when no frame comes, once', () => {
    const g = new GuestDream();
    g.ask(0);
    expect(g.waiting(false, DREAM_WAIT)).toBeNull();
    expect(g.waiting(false, DREAM_WAIT + 0.1)).toBe('giveUp');
    expect(g.waiting(false, DREAM_WAIT + 1)).toBeNull();
  });

  it('does nothing when it did not ask', () => {
    expect(new GuestDream().waiting(true, 0)).toBeNull();
  });

  it('drops the input of the wish when the dream opens', () => {
    const g = new GuestDream();
    g.ask(0);
    g.steer(input({ hop: true }));
    g.waiting(true, 1);
    expect(g.take()).toBeNull();
  });
});

describe('a guest dreaming', () => {
  it('sends the input once, with one-shot presses spent after', () => {
    const g = new GuestDream();
    g.steer(input({ move: { x: 1, z: 0 }, hop: true, play: true }));
    expect(g.take()).toMatchObject({ move: { x: 1, z: 0 }, hop: true, play: true });
    expect(g.take()).toMatchObject({ move: { x: 1, z: 0 }, hop: false, play: false });
  });

  it('wakes when the snapshots carry no dream for a while', () => {
    const g = new GuestDream();
    expect(g.ended(true, 0)).toBe(false);
    expect(g.ended(false, 1000)).toBe(false);
    expect(g.ended(false, 1000 + DREAM_GONE)).toBe(false);
    expect(g.ended(false, 1001 + DREAM_GONE)).toBe(true);
  });

  it('starts the count again when a dream comes back', () => {
    const g = new GuestDream();
    g.ended(false, 1000);
    g.ended(true, 2000);
    expect(g.ended(false, 3500)).toBe(false);
  });
});

describe('a guest drawing the host\'s dream', () => {
  const wire = (seed: number): DreamWire => wireOf(newDream(seed), 'a', 'candy');

  it('tells a new snapshot as fresh once, and not the same one again', () => {
    const g = new GuestDream();
    const w = wire(1);
    expect(g.glide(w, 0, 50).fresh).toBe(true);
    expect(g.glide(w, 10, 50).fresh).toBe(false);
    expect(g.glide(wire(1), 60, 50).fresh).toBe(true);
  });
});
