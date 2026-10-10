// Lone beavers looking for a partner (docs/design/23_leaving_and_next_baby.md). When the player beaver has left home it
// can go and find one. Each lives at a different dam spot, a pond or stream of the valley. The player picks by meeting:
// the beaver met last follows it, and moves into the lodge when the lodge is whole.

import { COAT_COUNT } from './family';
import type { DamSpot } from './damSpots';
import { LODGE_POND_CREST } from './pond';

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
/** A lone beaver slaps its tail now and then, and is heard from this far (metres). The nudge to look for a partner. */
export const HEARD_DISTANCE = 150;
export const SLAP_EVERY = 20;

/** How many lone beavers there are, and how far at least from the home they left (metres), and from each other. */
export const PARTNER_COUNT = 3;
export const PARTNER_MIN_FROM_HOME = 120;
export const PARTNER_MIN_APART = 150;

function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

/**
 * A spot has room for a lodge when a dam there can raise a pond deep enough for one (#254, #287). It reads the spot's data, not the
 * water now, which is only there once the dam is built, and far tiles are not loaded (ADR 0006).
 */
export function canHoldLodge(spot: DamSpot): boolean {
  return spot.maxCrest >= LODGE_POND_CREST - 1e-6;
}

/**
 * Lone beavers at dam spots far from the old home, in an order fixed by the home's place, so a start always gives the same ones.
 * `canLive` says a spot has room for a lodge near it (#254), so the player can lead the partner home and build a dam and lodge there.
 */
export function seedPartners(spots: readonly DamSpot[], home: { x: number; z: number }, canLive: (spot: DamSpot) => boolean = canHoldLodge): Partner[] {
  const key = Math.round(home.x * 3 + home.z * 7);
  const far = spots
    .map((s, i) => ({ s, i, d: Math.hypot(s.bed.x - home.x, s.bed.z - home.z), h: hash(i, key) }))
    .filter((c) => c.d >= PARTNER_MIN_FROM_HOME);
  // The nearest that has room for a lodge comes first, so one is always within reach of a short search.
  const nearest = [...far].sort((a, b) => a.d - b.d).find((c) => canLive(c.s)) ?? null;
  const rest = far.filter((c) => c !== nearest).sort((a, b) => a.h - b.h);
  const chosen: typeof far = nearest ? [nearest] : [];
  for (const c of rest) {
    if (chosen.length >= PARTNER_COUNT) break;
    if (chosen.every((o) => Math.hypot(o.s.bed.x - c.s.bed.x, o.s.bed.z - c.s.bed.z) >= PARTNER_MIN_APART) && canLive(c.s)) chosen.push(c);
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

/** Out of earshot, a word about where the nearest lone beaver is, this often (seconds of play). */
export const CUE_EVERY = 45;

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] as const;

/** Where the nearest lone beaver is, as compass words and metres to the nearest 50, or null when there is none to find. North is -z. */
export function partnerCue(partners: readonly Partner[], from: { x: number; z: number }): { direction: string; metres: number } | null {
  if (follower(partners) || mateOf(partners)) return null;
  let best: { dx: number; dz: number; d: number } | null = null;
  for (const p of partners) {
    if (p.state !== 'alone') continue;
    const dx = p.x - from.x;
    const dz = p.z - from.z;
    const d = Math.hypot(dx, dz);
    if (best === null || d < best.d) best = { dx, dz, d };
  }
  if (best === null) return null;
  const bearing = (Math.atan2(best.dx, -best.dz) + 2 * Math.PI) % (2 * Math.PI);
  return { direction: COMPASS[Math.round(bearing / (Math.PI / 4)) % 8] ?? 'north', metres: Math.round(best.d / 50) * 50 };
}
