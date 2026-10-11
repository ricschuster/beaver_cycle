import { describe, expect, it } from 'vitest';
import { flatTerrain } from '../sim/terrain';
import { STAGES } from '../sim/life';
import { createWorld, type WorldState } from '../sim/state';
import { COACH_DONE, SLEEP_JUMP, STEPS, coachBack, coachForward, coachNext, nearestRing, newCoach, stepText, stepsOf } from './coachSteps';
import { wantsCoach } from './coach';
import { KEY_HINTS } from './keyHints';

const world = (): WorldState => createWorld(flatTerrain(0), 0, 0);
const spot = { id: 's1', bed: { x: 0, z: -100 } } as unknown as WorldState['spots'][number];
const lodge = (wood: number): WorldState['lodge'] => ({ wood }) as unknown as WorldState['lodge'];
const ids = (c: ReturnType<typeof newCoach>): string | undefined => stepsOf(c.chapter)[c.step]?.id;

describe('the baby steps', () => {
  it('go from leaving the lodge to sleeping, as the world changes', () => {
    let w: WorldState = { ...world(), inLodge: true };
    let c = coachNext(w, newCoach(w, 'baby'));
    expect(ids(c)).toBe('leave');
    w = { ...w, inLodge: false, beaver: { ...w.beaver, mode: 'swim' } };
    c = coachNext(w, c);
    expect(ids(c)).toBe('dive');
    c = coachNext({ ...w, beaver: { ...w.beaver, mode: 'dive' } }, c);
    expect(ids(c)).toBe('slap');
    c = coachNext({ ...w, lastSlap: { time: w.time + 1, x: 0, z: 0 } }, c);
    expect(ids(c)).toBe('home');
    c = coachNext({ ...w, inLodge: true }, c);
    expect(ids(c)).toBe('sleep');
    c = coachNext({ ...w, inLodge: true, clock: w.clock + 0.5 }, c);
    expect(ids(c)).toBe('sleep');
    c = coachNext({ ...w, inLodge: true, clock: w.clock + SLEEP_JUMP + 1 }, c);
    expect(c.step).toBe(STEPS.baby.length);
  });

  it('skips leaving when the baby starts outside, and ignores a slap from before', () => {
    const w: WorldState = { ...world(), time: 50, lastSlap: { time: 10, x: 0, z: 0 } };
    const c = coachNext(w, newCoach(w, 'baby'));
    expect(ids(c)).toBe('swim');
    const d = coachNext({ ...w, beaver: { ...w.beaver, mode: 'dive' } }, c);
    expect(ids(d)).toBe('slap');
  });
});

describe('the teenager steps', () => {
  it('come in the order food, store, dam, pond', () => {
    expect(STEPS.teenager.map((s) => s.id)).toEqual(['pad', 'eat', 'store', 'gnaw', 'drag', 'ring', 'build', 'fill', 'pond']);
  });

  it('move on as the world shows each step is done', () => {
    let w = world();
    let c = newCoach(w, 'teenager');
    expect(ids(c)).toBe('pad');
    w = { ...w, eaten: 1 };
    c = coachNext(w, c);
    expect(ids(c)).toBe('store');
    w = { ...w, store: ['lily'] } as unknown as WorldState;
    c = coachNext(w, c);
    expect(ids(c)).toBe('gnaw');
    w = { ...w, felled: ['t1'] };
    c = coachNext(w, c);
    expect(ids(c)).toBe('drag');
  });

  it('skips steps already done, and ends when the pond is there', () => {
    const w = { ...world(), eaten: 1, store: ['lily'], felled: ['t1'], drag: 'l1', spots: [spot], dams: [{ spot: 's1', wood: 99, mud: 99, rock: 99 }], ponds: [{}] } as unknown as WorldState;
    let c = coachNext(w, newCoach(w, 'teenager'));
    expect(c.step).toBe(STEPS.teenager.length);
    c = coachNext(w, c);
    expect(c.step).toBe(STEPS.teenager.length);
  });

  it('points at the ring: the way and the distance', () => {
    const w = { ...world(), spots: [spot] };
    expect(nearestRing(w, 0)).toBe('behind you, close by');
    const ring = STEPS.teenager.find((s) => s.id === 'ring')!;
    expect(stepText(ring, true, w, 0)).toContain('The nearest ring is behind you, close by.');
    expect(stepText(ring, true, world())).not.toContain('nearest ring');
  });
});

describe('the adult steps', () => {
  it('go from the partner to the kit', () => {
    let w: WorldState = { ...world(), partners: [{ state: 'alone' }] as unknown as WorldState['partners'] };
    let c = newCoach(w, 'adult');
    expect(ids(coachNext(w, c))).toBe('partner');
    w = { ...w, partners: [{ state: 'following' }] as unknown as WorldState['partners'] };
    c = coachNext(w, c);
    expect(ids(c)).toBe('lodge');
    w = { ...w, lodge: lodge(3) };
    c = coachNext(w, c);
    expect(ids(c)).toBe('lodge-finish');
    w = { ...w, lodge: lodge(10) };
    c = coachNext(w, c);
    expect(ids(c)).toBe('moved-in');
    w = { ...w, partners: [{ state: 'home' }] as unknown as WorldState['partners'] };
    c = coachNext(w, c);
    expect(ids(c)).toBe('kit');
    c = coachNext({ ...w, bornAt: w.bornAt + 1 }, c);
    expect(c.step).toBe(STEPS.adult.length);
  });
});

describe('moving through the steps by hand', () => {
  it('goes back to read, and the world does not jump forward from there', () => {
    let w = world();
    let c = newCoach(w, 'teenager');
    w = { ...w, eaten: 1, store: ['lily'] } as unknown as WorldState;
    c = coachNext(w, c);
    expect(ids(c)).toBe('gnaw');
    c = coachBack(c);
    expect(ids(c)).toBe('store');
    c = coachNext({ ...w, felled: ['t1'] }, c);
    expect(ids(c)).toBe('store');
    expect(c.furthest).toBe(4);
    c = coachForward(c);
    expect(ids(c)).toBe('gnaw');
    c = coachForward(c);
    expect(ids(c)).toBe('drag');
  });

  it('skips a step with Next, stops at the first step going back, and stays on the closing card', () => {
    const w = world();
    let c = newCoach(w, 'teenager');
    expect(coachBack(c).step).toBe(0);
    c = coachForward(c);
    expect(ids(c)).toBe('eat');
    expect(c.furthest).toBe(1);
    c = coachNext(w, c);
    expect(ids(c)).toBe('eat');
    const end = { ...c, step: STEPS.teenager.length, furthest: STEPS.teenager.length };
    expect(coachForward(end)).toEqual(end);
    expect(coachBack(end).step).toBe(STEPS.teenager.length - 1);
  });
});

describe('the wording', () => {
  it('names the keys the game really uses, and the buttons it really has', () => {
    const keys = KEY_HINTS.map(([k]) => k).join(' ');
    for (const k of ['Space', 'E', 'G', 'T']) expect(keys).toContain(k);
    for (const stage of STAGES) {
      expect(STEPS[stage].length).toBeGreaterThan(0);
      expect(COACH_DONE[stage]).not.toContain(String.fromCharCode(0x2014));
      for (const s of STEPS[stage]) {
        expect(s.touch.length).toBeGreaterThan(0);
        expect(s.keys).not.toContain(String.fromCharCode(0x2014));
        if (s.button) expect(['dive', 'slap', 'take', 'do']).toContain(s.button);
      }
    }
  });

  it('asks a baby only for what a baby may do', () => {
    // Gnawing, dragging and building are for a teenager (STAGE_RULES.baby.works is false).
    for (const s of STEPS.baby) expect(['take', 'do']).not.toContain(s.button);
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
