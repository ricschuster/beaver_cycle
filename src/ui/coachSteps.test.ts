import { describe, expect, it } from 'vitest';
import { flatTerrain } from '../sim/terrain';
import { createWorld, type WorldState } from '../sim/state';
import { COACH_DONE, MOVE_DONE, STEPS, coachNext, nearestRing, newCoach, stepText } from './coachSteps';
import { wantsCoach } from './coach';
import { KEY_HINTS } from './keyHints';

const world = (): WorldState => createWorld(flatTerrain(0), 0, 0);
const at = (w: WorldState, x: number, z: number, mode: WorldState['beaver']['mode'] = 'walk'): WorldState => ({ ...w, beaver: { ...w.beaver, x, z, mode } });
const spot = { id: 's1', bed: { x: 0, z: -100 } } as unknown as WorldState['spots'][number];

describe('the coach steps', () => {
  it('start at walking and move on only when the world shows the step is done', () => {
    let w = world();
    let c = newCoach(w);
    expect(STEPS[c.step]!.id).toBe('move');
    c = coachNext(at(w, 3, 0), c);
    expect(STEPS[c.step]!.id).toBe('move');
    c = coachNext(at(w, MOVE_DONE, 0), c);
    expect(STEPS[c.step]!.id).toBe('swim');
    c = coachNext(at(w, MOVE_DONE, 0, 'swim'), c);
    expect(STEPS[c.step]!.id).toBe('dive');
    c = coachNext(at(w, MOVE_DONE, 0, 'dive'), c);
    expect(STEPS[c.step]!.id).toBe('gnaw');
    w = { ...w, felled: ['t1'] };
    c = coachNext(w, c);
    expect(STEPS[c.step]!.id).toBe('drag');
  });

  it('skips steps the player already did, and ends when the pond is there', () => {
    const w = { ...world(), felled: ['t1'], drag: 'l1', spots: [spot], dams: [{ spot: 's1', wood: 99, mud: 99, rock: 99 }], ponds: [{}] } as unknown as WorldState;
    let c = coachNext(at(w, 20, 0, 'dive'), newCoach(w));
    expect(c.step).toBe(STEPS.length);
    c = coachNext(w, c);
    expect(c.step).toBe(STEPS.length);
  });

  it('points at the ring: the way and the distance', () => {
    const w = { ...world(), spots: [spot] };
    expect(nearestRing(w)).toEqual({ direction: 'north', metres: 100 });
    const ring = STEPS.find((s) => s.id === 'ring')!;
    expect(stepText(ring, true, w)).toContain('about 100 m to the north');
    expect(stepText(ring, true, world())).not.toContain('about');
  });

  it('names the keys the game really uses, and the buttons it really has', () => {
    const keys = KEY_HINTS.map(([k]) => k).join(' ');
    for (const k of ['Space', 'E', 'G', 'B']) expect(keys).toContain(k);
    for (const s of STEPS) {
      expect(s.touch.length).toBeGreaterThan(0);
      if (s.button) expect(['dive', 'slap', 'chop', 'grab', 'build']).toContain(s.button);
    }
    expect(COACH_DONE).not.toContain(String.fromCharCode(0x2014));
  });
});

describe('when the coach starts', () => {
  const q = (s: string): URLSearchParams => new URLSearchParams(s);
  it('runs once, and not in an automated browser', () => {
    expect(wantsCoach(false, q(''), false)).toBe(true);
    expect(wantsCoach(true, q(''), false)).toBe(false);
    expect(wantsCoach(false, q(''), true)).toBe(false);
  });
  it('can be forced from the address', () => {
    expect(wantsCoach(true, q('coach=1'), true)).toBe(true);
    expect(wantsCoach(false, q('coach=0'), false)).toBe(false);
  });
});
