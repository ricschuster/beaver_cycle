import { describe, expect, it } from 'vitest';
import { FOLLOW_GAP, MEET_DISTANCE, PARTNER_COUNT, PARTNER_MIN_APART, PARTNER_MIN_FROM_HOME, canHoldLodge, follower, mateOf, moveIn, partnerCue, seedPartners, stepPartners } from './partners';
import type { DamSpot } from './damSpots';

const spot = (id: string, x: number, z: number): DamSpot => ({ id, bed: { x, z }, bedY: 0, flow: { x: 0, z: 1 }, maxCrest: 2 }) as DamSpot;
const spots = Array.from({ length: 30 }, (_, i) => spot(`s${i}`, (i % 6) * 200 - 500, Math.floor(i / 6) * 200 - 400));
const home = { x: 0, z: 0 };

describe('lone beavers', () => {
  it('are a few, far from the old home and from each other', () => {
    const ps = seedPartners(spots, home);
    expect(ps).toHaveLength(PARTNER_COUNT);
    for (const p of ps) expect(Math.hypot(p.x - home.x, p.z - home.z)).toBeGreaterThanOrEqual(PARTNER_MIN_FROM_HOME);
    for (const a of ps) for (const b of ps) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(PARTNER_MIN_APART);
    expect(new Set(ps.map((p) => p.id)).size).toBe(PARTNER_COUNT);
  });

  it('has one within a short search of the home, the nearest far enough', () => {
    const nearest = Math.min(...spots.map((s) => Math.hypot(s.bed.x - home.x, s.bed.z - home.z)).filter((d) => d >= PARTNER_MIN_FROM_HOME));
    const ps = seedPartners(spots, home);
    expect(Math.min(...ps.map((p) => Math.hypot(p.x - home.x, p.z - home.z)))).toBeCloseTo(nearest);
  });

  it('are the same on every start, and each has a coat and a shade', () => {
    expect(seedPartners(spots, home)).toEqual(seedPartners(spots, home));
    for (const p of seedPartners(spots, home)) {
      expect(p.shade).toBeGreaterThanOrEqual(-1);
      expect(p.shade).toBeLessThanOrEqual(1);
      expect(p.state).toBe('alone');
    }
  });

  it('keep to spots with room for a lodge, the nearest of them first', () => {
    const nearestAll = seedPartners(spots, home)[0]!;
    const canLive = (s: DamSpot): boolean => s.id !== nearestAll.id.replace('partner:', '');
    const ps = seedPartners(spots, home, canLive);
    expect(ps.length).toBeGreaterThan(0);
    for (const p of ps) expect(p.id).not.toBe(nearestAll.id);
    const livable = spots.filter((s) => canLive(s) && Math.hypot(s.bed.x - home.x, s.bed.z - home.z) >= PARTNER_MIN_FROM_HOME);
    expect(Math.min(...ps.map((p) => Math.hypot(p.x - home.x, p.z - home.z)))).toBeCloseTo(Math.min(...livable.map((s) => Math.hypot(s.bed.x - home.x, s.bed.z - home.z))));
    expect(seedPartners(spots, home, () => false)).toHaveLength(0);
  });

  it('are fewer when the valley has few dam spots far enough away', () => {
    expect(seedPartners([spot('near', 10, 10)], home)).toHaveLength(0);
  });
});

describe('room for a lodge', () => {
  it('is a spot whose dam can hold a pond deep enough for the door', () => {
    expect(canHoldLodge({ ...spot('a', 0, 0), maxCrest: 1.0 })).toBe(false);
    expect(canHoldLodge({ ...spot('a', 0, 0), maxCrest: 1.5 })).toBe(true);
    expect(canHoldLodge({ ...spot('a', 0, 0), maxCrest: 2.0 })).toBe(true);
  });

  it('is the default, so shallow spots get no lone beaver', () => {
    const shallow = spots.map((s) => ({ ...s, maxCrest: 1.0 }));
    expect(seedPartners(shallow, home)).toHaveLength(0);
  });
});

describe('meeting', () => {
  const ps = seedPartners(spots, home);
  const first = ps[0]!;

  it('stays alone while the player is far', () => {
    expect(stepPartners(ps, { x: 5000, z: 5000 }, 1, 0.1).every((p) => p.state === 'alone')).toBe(true);
  });

  it('makes a beaver follow once the player is near, and it remembers when', () => {
    const next = stepPartners(ps, { x: first.x + MEET_DISTANCE - 1, z: first.z }, 7, 0.1);
    expect(follower(next)?.id).toBe(first.id);
    expect(follower(next)?.metAt).toBe(7);
  });

  it('swims after the player and stops a gap behind', () => {
    let next = stepPartners(ps, { x: first.x + 6, z: first.z }, 1, 0.1);
    const player = { x: first.x + 60, z: first.z };
    for (let i = 0; i < 200; i++) next = stepPartners(next, player, 2 + i * 0.1, 0.1);
    const f = follower(next)!;
    expect(Math.hypot(f.x - player.x, f.z - player.z)).toBeCloseTo(FOLLOW_GAP, 0);
  });

  it('lets the one met last follow, and leaves the first where it stood', () => {
    let next = stepPartners(ps, { x: first.x + 3, z: first.z }, 1, 0.1);
    const second = ps[1]!;
    next = stepPartners(next, { x: second.x + 3, z: second.z }, 2, 0.1);
    expect(follower(next)?.id).toBe(second.id);
    expect(next[0]!.state).toBe('alone');
  });

  it('moves the follower into the lodge', () => {
    const next = moveIn(stepPartners(ps, { x: first.x + 3, z: first.z }, 1, 0.1), 99);
    expect(mateOf(next)?.id).toBe(first.id);
    expect(mateOf(next)?.homeAt).toBe(99);
    expect(follower(next)).toBeNull();
  });
});

describe('the cue to a lone beaver', () => {
  const alone = (id: string, x: number, z: number) => ({ id, x, z, heading: 0, coat: 0, shade: 0, state: 'alone' as const, metAt: null, homeAt: null });
  it('names the direction (north is -z) and the distance of the nearest', () => {
    const cue = partnerCue([alone('a', 1200, 0), alone('b', 0, -1060)], { x: 0, z: 0 });
    expect(cue).toEqual({ direction: 'north', metres: 1050 });
    expect(partnerCue([alone('a', 700, 700)], { x: 0, z: 0 })).toEqual({ direction: 'south-east', metres: 1000 });
    expect(partnerCue([alone('a', -300, 0)], { x: 0, z: 0 })?.direction).toBe('west');
  });
  it('is silent with no lone beaver, a follower, or a mate', () => {
    expect(partnerCue([], { x: 0, z: 0 })).toBeNull();
    const a = alone('a', 500, 0);
    expect(partnerCue([{ ...a, state: 'following' }, alone('b', 900, 0)], { x: 0, z: 0 })).toBeNull();
    expect(partnerCue([{ ...a, state: 'home' }], { x: 0, z: 0 })).toBeNull();
  });
});
