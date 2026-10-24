import { describe, expect, it } from 'vitest';
import type { Snapshot } from './protocol';
import { askedOf, GuestLying, LYING_WAIT } from './sleepNews';

const snap = (over: Partial<Snapshot>): Snapshot => ({ beavers: [{ id: 'a', look: { name: 'Alder' } }], ...over }) as unknown as Snapshot;
const skip = (over: object = {}) => ({ from: 'a', goal: 'night', waiting: ['me'], left: 20, ...over }) as Snapshot['skip'];

describe('a friend\'s bed asked about', () => {
  it('names the asker and the goal when this player is waited on', () => {
    expect(askedOf(snap({ skip: skip() }), 'me')).toEqual({ name: 'Alder', goal: 'night' });
  });

  it('is nothing without a skip, for a dream, or when another is waited on', () => {
    expect(askedOf(undefined, 'me')).toBeNull();
    expect(askedOf(snap({}), 'me')).toBeNull();
    expect(askedOf(snap({ skip: skip({ goal: 'dream' }) }), 'me')).toBeNull();
    expect(askedOf(snap({ skip: skip({ waiting: ['you'] }) }), 'me')).toBeNull();
  });

  it('has a null name when the asker is not in the snapshot', () => {
    expect(askedOf(snap({ skip: skip({ from: 'z' }) }), 'me')?.name).toBeNull();
  });
});

describe('a guest\'s bed waiting for the host', () => {
  const asleep = (...ids: string[]) => ({ asleep: ids }) as Snapshot;

  it('is quiet while nothing was asked', () => {
    expect(new GuestLying().settle(asleep(), 'me', 100)).toBeNull();
  });

  it('settles as slept once the host listed the guest and then did not', () => {
    const l = new GuestLying();
    l.lie(0);
    expect(l.settle(asleep('me'), 'me', 1)).toBeNull();
    expect(l.settle(asleep(), 'me', 2)).toEqual({ slept: true });
    expect(l.settle(asleep(), 'me', 3)).toBeNull();
  });

  it('gives up as not slept after the wait when the host never listed it', () => {
    const l = new GuestLying();
    l.lie(0);
    expect(l.settle(asleep(), 'me', LYING_WAIT)).toBeNull();
    expect(l.settle(asleep(), 'me', LYING_WAIT + 0.1)).toEqual({ slept: false });
  });

  it('waits for a snapshot, and forgets when cleared', () => {
    const l = new GuestLying();
    l.lie(0);
    expect(l.settle(null, 'me', 99)).toBeNull();
    l.clear();
    expect(l.settle(asleep(), 'me', 99)).toBeNull();
  });
});
