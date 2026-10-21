import { describe, expect, it } from 'vitest';
import { BOAT_SPEED, chocolateDepth, newDream, playPrompt, stepDream, type DreamEvent, type DreamInput, type DreamPoint, type DreamState } from './dream';

const DT = 1 / 30;
const still: DreamInput = { move: { x: 0, z: 0 }, hop: false, slap: false, play: false };
const press: DreamInput = { ...still, play: true };
const SEEDS = [1, 7, 42, 1234, 99];
const place = (s: DreamState, p: DreamPoint): DreamState => ({ ...s, beaver: { ...s.beaver, x: p.x, z: p.z } });

function run(s: DreamState, seconds: number, input: (st: DreamState) => DreamInput): { state: DreamState; events: DreamEvent[] } {
  const events: DreamEvent[] = [];
  let state = s;
  for (let i = 0; i < seconds / DT; i++) {
    const r = stepDream(state, input(state), DT);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

/** The dream with the beaver one step from its first boat, and it pressed Do once: aboard. */
function aboard(seed: number): DreamState {
  const s = newDream(seed);
  const boat = s.boats![0]!;
  return stepDream(place(s, { x: boat.x + 1, z: boat.z }), press, DT).state;
}

describe('cotton candy boats', () => {
  it('moors up to three on the chocolate in candy land, and none in the veggie garden', () => {
    for (const seed of SEEDS) {
      const { land, boats } = newDream(seed);
      expect(boats!.length).toBeGreaterThanOrEqual(2);
      expect(boats!.length).toBeLessThanOrEqual(3);
      for (const b of boats!) expect(chocolateDepth(land, b.x, b.z)).toBeGreaterThanOrEqual(0.5);
    }
    expect(newDream(1, [], 'veggie').boats).toBeUndefined();
  });

  it('offers to get in next to a boat, and Do puts the beaver in it', () => {
    for (const seed of SEEDS) {
      const s = newDream(seed);
      const boat = s.boats![0]!;
      expect(playPrompt(place(s, { x: boat.x + 40, z: boat.z }))).not.toBe('Get into the cotton candy boat');
      const near = place(s, { x: boat.x + 1, z: boat.z });
      expect(playPrompt(near)).toBe('Get into the cotton candy boat');
      const r = stepDream(near, press, DT);
      expect(r.state.aboard).toBe(boat.id);
      expect(r.events.some((e) => e.what === 'board')).toBe(true);
      expect(r.state.beaver.mode).toBe('swim');
    }
  });

  it('steers with the stick on the chocolate, faster than swimming, and carries the boat along', () => {
    for (const seed of SEEDS) {
      const s = aboard(seed);
      const id = s.aboard!;
      const along = { move: { x: Math.sin(s.beaver.heading), z: Math.cos(s.beaver.heading) }, hop: false, slap: false, play: false };
      const r = run(s, 1.5, () => along);
      expect(r.state.aboard).toBe(id);
      const moved = Math.hypot(r.state.beaver.x - s.beaver.x, r.state.beaver.z - s.beaver.z);
      expect(moved).toBeGreaterThan(1);
      expect(moved).toBeLessThanOrEqual(BOAT_SPEED * 1.5 + 0.01);
      const boat = r.state.boats!.find((b) => b.id === id)!;
      expect(boat.x).toBe(r.state.beaver.x);
      expect(boat.z).toBe(r.state.beaver.z);
    }
  });

  it('never runs aground, however it is steered', () => {
    for (const seed of SEEDS) {
      let state = aboard(seed);
      for (let i = 0; i < 20 * 30; i++) {
        const a = (i / 45) * Math.PI;
        state = stepDream(state, { ...still, move: { x: Math.sin(a), z: Math.cos(a) } }, DT).state;
        expect(chocolateDepth(state.land, state.beaver.x, state.beaver.z)).toBeGreaterThanOrEqual(0.5 - 1e-6);
      }
    }
  });

  it('lets the beaver out on the bank, and leaves the boat floating there', () => {
    let landed = 0;
    for (const seed of SEEDS) {
      const s = aboard(seed);
      const id = s.aboard!;
      // Sail toward the nearest bank (to the right of the boat's side) until a landing is offered.
      let state = s;
      let offered = false;
      for (let i = 0; i < 40 * 30 && !offered; i++) {
        const toward = state.boats!.find((b) => b.id === id)!;
        const out = Math.atan2(-toward.x, -toward.z);
        state = stepDream(state, { ...still, move: { x: Math.sin(out + 1.2), z: Math.cos(out + 1.2) } }, DT).state;
        offered = playPrompt(state) === 'Get out of the boat';
      }
      if (!offered) continue;
      const left = stepDream(state, press, DT);
      expect(left.state.aboard).toBeUndefined();
      expect(left.events.some((e) => e.what === 'leave')).toBe(true);
      expect(left.state.beaver.mode).toBe('walk');
      expect(chocolateDepth(left.state.land, left.state.beaver.x, left.state.beaver.z)).toBeLessThan(0.25);
      const boat = left.state.boats!.find((b) => b.id === id)!;
      expect(Math.hypot(boat.x - state.beaver.x, boat.z - state.beaver.z)).toBeLessThan(0.3);
      landed++;
    }
    expect(landed).toBeGreaterThanOrEqual(3);
  });

  it('gives no way out in the middle of the river, so Do does nothing there', () => {
    const s = aboard(1);
    const r = stepDream(s, press, DT);
    if (playPrompt(s) === null) expect(r.state.aboard).toBe(s.aboard);
  });
});
