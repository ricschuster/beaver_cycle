// Lone beavers looking for a partner (docs/design/23_leaving_and_next_baby.md). When the player beaver has left home it
// can go and find one. Each lives at a different dam spot, a pond or stream of the valley. The player picks by meeting:
// the beaver met last follows it, and moves into the lodge when the lodge is whole.

import { COAT_COUNT } from './family';
import type { DamSpot } from './damSpots';

export type PartnerState = 'alone' | 'following' | 'home';

export interface Partner {
  id: string;
  x: number;
  z: number;
  heading: number;
  /** Base coat, an index into the palette, and a small random shade of it, -1 darker to 1 lighter (Q59, note 23). */
  coat: number;
  shade: number;
  state: PartnerState;
  /** Game time of the first meeting, for the tail slap it answers with, or null before. */
  metAt: number | null;
  /** Game clock at which it moved into the lodge, or null. */
  homeAt: number | null;
}

/** The player is met within this many metres. */
export const MEET_DISTANCE = 8;
/** A follower keeps this far behind the player, in metres, and swims at this share of the swim speed. */
export const FOLLOW_GAP = 4;
export const FOLLOW_SPEED = 14;
/** How many lone beavers there are, and how far at least from the home they left (metres), and from each other. */
export const PARTNER_COUNT = 3;
export const PARTNER_MIN_FROM_HOME = 120;
export const PARTNER_MIN_APART = 150;

function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

/** Lone beavers at dam spots far from the old home, in an order fixed by the home's place, so a start always gives the same ones. */
export function seedPartners(spots: readonly DamSpot[], home: { x: number; z: number }): Partner[] {
  const key = Math.round(home.x * 3 + home.z * 7);
  const far = spots
    .map((s, i) => ({ s, i, d: Math.hypot(s.bed.x - home.x, s.bed.z - home.z), h: hash(i, key) }))
    .filter((c) => c.d >= PARTNER_MIN_FROM_HOME)
    .sort((a, b) => a.h - b.h);
  const chosen: typeof far = [];
  for (const c of far) {
    if (chosen.length >= PARTNER_COUNT) break;
    if (chosen.every((o) => Math.hypot(o.s.bed.x - c.s.bed.x, o.s.bed.z - c.s.bed.z) >= PARTNER_MIN_APART)) chosen.push(c);
  }
  return chosen.map((c) => ({
    id: `partner:${c.s.id}`,
    x: c.s.bed.x,
    z: c.s.bed.z,
    heading: ((hash(c.i, key + 1) % 628) / 100) - 3.14,
    coat: hash(c.i, key + 2) % COAT_COUNT,
    shade: ((hash(c.i, key + 3) % 2001) - 1000) / 1000,
    state: 'alone' as const,
    metAt: null,
    homeAt: null,
  }));
}

/**
 * One step of the lone beavers. A beaver the player comes near is met: it slaps its tail and follows, and the one
 * followed before goes back to being alone where it stands. A follower swims after the player, a gap behind.
 */
export function stepPartners(partners: readonly Partner[], player: { x: number; z: number }, time: number, dt: number): Partner[] {
  const met = partners.find((p) => p.state === 'alone' && Math.hypot(p.x - player.x, p.z - player.z) <= MEET_DISTANCE);
  return partners.map((p) => {
    if (met && p.id === met.id) return { ...p, state: 'following' as const, metAt: p.metAt ?? time };
    if (met && p.state === 'following') return { ...p, state: 'alone' as const };
    if (p.state !== 'following') return p;
    const dx = player.x - p.x;
    const dz = player.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d <= FOLLOW_GAP) return { ...p, heading: Math.atan2(dx, dz) };
    const move = Math.min(d - FOLLOW_GAP, FOLLOW_SPEED * dt);
    return { ...p, x: p.x + (dx / d) * move, z: p.z + (dz / d) * move, heading: Math.atan2(dx, dz) };
  });
}

/** The beaver that follows the player, or null. */
export function follower(partners: readonly Partner[]): Partner | null {
  return partners.find((p) => p.state === 'following') ?? null;
}

/** The lodge is whole: the follower moves in. */
export function moveIn(partners: readonly Partner[], clock: number): Partner[] {
  return partners.map((p) => (p.state === 'following' ? { ...p, state: 'home' as const, homeAt: clock } : p));
}

/** The partner who lives in the lodge, or null. */
export function mateOf(partners: readonly Partner[]): Partner | null {
  return partners.find((p) => p.state === 'home') ?? null;
}
