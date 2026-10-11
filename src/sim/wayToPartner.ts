// Where a lone beaver lives, told so a kid can use it (docs/design/23_leaving_and_next_baby.md): which way from where the
// player looks (ahead, behind, left, right), up or down the hill, near a family the player knows, and how far as "close by"
// or "a long way off", never compass points and metres. After a hint a short trail of sparkles points the way for a while
// (`WayPointer`, not saved); `render/wayPointer.ts` draws it. Pure, no DOM and no three.js.
import { pondName } from './names';
import { HEARD_DISTANCE, partnerCue, type Partner } from './partners';
import type { WorldState } from './state';
import type { Terrain } from './terrain';

/** A lone beaver this much higher or lower than the player (metres) is "up the hill" or "down the hill". */
export const HILL = 15;
/** A lone beaver this close to the lodge of a family the player has met (metres) lives "near" that family. */
export const NEAR_FAMILY = 120;
/** Up to HEARD_DISTANCE it is "close by", up to this (metres) "a little swim away", beyond it "a long way off". */
export const LITTLE_SWIM = 500;

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Which way a point lies from where the player looks. `facing` is the look direction in the heading convention (atan2 of x
 * and z, 0 looks along +z), and in that view left is +x, as in `relativeToView`.
 */
export function sideWord(dx: number, dz: number, facing: number): 'straight ahead' | 'behind you' | 'to your left' | 'to your right' {
  const a = wrap(Math.atan2(dx, dz) - facing);
  if (Math.abs(a) <= Math.PI / 4) return 'straight ahead';
  if (Math.abs(a) >= (3 * Math.PI) / 4) return 'behind you';
  return a > 0 ? 'to your left' : 'to your right';
}

/** How far, in words. */
export function farWord(d: number): 'close by' | 'a little swim away' | 'a long way off' {
  if (d <= HEARD_DISTANCE) return 'close by';
  return d <= LITTLE_SWIM ? 'a little swim away' : 'a long way off';
}

/** Where a point lies from where the player looks, in kid words: "to your left, close by". Used by the partner's remarks and the coach. */
export function placeWords(dx: number, dz: number, facing: number): string {
  return `${sideWord(dx, dz, facing)}, ${farWord(Math.hypot(dx, dz))}`;
}

/** Up or down the hill, or null when the two are about as high. */
export function hillWord(fromY: number, toY: number): 'up the hill' | 'down the hill' | null {
  if (toY - fromY >= HILL) return 'up the hill';
  if (fromY - toY >= HILL) return 'down the hill';
  return null;
}

/** The family the player has met whose lodge is nearest a point and within NEAR_FAMILY, named as the game names it ("north pond"), or null. */
function familyNear(world: Pick<WorldState, 'neighbours' | 'met' | 'formerHomes' | 'lodge' | 'beaver'>, at: { x: number; z: number }): string | null {
  const met = Object.keys(world.met);
  let best: string | null = null;
  let bestDist = NEAR_FAMILY;
  const home = world.formerHomes.at(-1) ?? world.lodge ?? world.beaver;
  for (const n of world.neighbours) {
    const d = Math.hypot(n.lodge.x - at.x, n.lodge.z - at.z);
    if (d <= bestDist && met.some((id) => id.startsWith(`${n.id}:`))) {
      best = pondName(n.lodge, home);
      bestDist = d;
    }
  }
  return best;
}

/**
 * The words for where a lone beaver lives, from the player: "up the hill to your left, a long way off", "behind you, close by",
 * or "near the north pond family, a little swim away". `facing` is where the player looks (see `sideWord`).
 */
export function wayWords(world: Pick<WorldState, 'neighbours' | 'met' | 'formerHomes' | 'lodge' | 'beaver' | 'spots'>, p: Partner, facing: number): string {
  const b = world.beaver;
  const d = Math.hypot(p.x - b.x, p.z - b.z);
  const family = familyNear(world, p);
  if (family) return `near the ${family} family, ${farWord(d)}`;
  const spot = world.spots.find((s) => `partner:${s.id}` === p.id);
  const hill = spot ? hillWord(b.y, spot.bedY) : null;
  const side = sideWord(p.x - b.x, p.z - b.z, facing);
  return `${hill ? `${hill} ${side}` : side}, ${farWord(d)}`;
}

/** The start of the news line about a lone beaver, so the game can tell it was given and show the sparkles. */
export const LONE_NEWS = 'A lone beaver lives';

/** The nearest lone beaver and the words for where it lives, or null when there is none to find. */
export function loneBeaverWay(world: WorldState, facing: number): { partner: Partner; d: number; words: string } | null {
  const cue = partnerCue(world.partners, world.beaver);
  return cue ? { ...cue, words: wayWords(world, cue.partner, facing) } : null;
}

/** The trail of sparkles toward a lone beaver: which one, and until when (`world.time`). Not saved: a loaded game has none. */
export interface WayPointer {
  partner: string;
  until: number;
}

/** The sparkles show this long (seconds of play), and end sooner when the player is this close (metres), when it can see the beaver. */
export const POINTER_TIME = 60;
export const POINTER_DONE = 25;

export function startPointer(partner: string, time: number): WayPointer {
  return { partner, until: time + POINTER_TIME };
}

/** Where the sparkles point now, or null when they are over: time is up, the player is close, or the beaver is no longer alone. */
export function pointerTarget(pointer: WayPointer | null, world: Pick<WorldState, 'partners' | 'beaver' | 'time'>): { x: number; z: number } | null {
  if (!pointer || world.time >= pointer.until) return null;
  const p = world.partners.find((q) => q.id === pointer.partner);
  if (!p || p.state !== 'alone') return null;
  return Math.hypot(p.x - world.beaver.x, p.z - world.beaver.z) <= POINTER_DONE ? null : { x: p.x, z: p.z };
}

/** The sparkles: COUNT of them a step apart on the way toward the target, from beside the player, so most are in view even when the way is to the side, a hand above the ground or water. */
export const DOT_COUNT = 7;
export const DOT_START = 1.5;
export const DOT_STEP = 1.5;
const DOT_LIFT = 0.45;

export function pointerDots(from: { x: number; z: number }, to: { x: number; z: number }, ground: Terrain): { x: number; y: number; z: number }[] {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dz);
  const out: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < DOT_COUNT; i++) {
    const r = DOT_START + i * DOT_STEP;
    if (r >= d) break;
    const x = from.x + (dx / d) * r;
    const z = from.z + (dz / d) * r;
    out.push({ x, y: ground.heightAt(x, z) + ground.waterDepth(x, z) + DOT_LIFT, z });
  }
  return out;
}
