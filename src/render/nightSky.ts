// The night sky: where the moon is, and where the stars hang. Pure numbers, so it is testable without three.js.
import { DAY_FRACTION } from '../sim/clock';
import type { Vec3 } from './sunShadow';

/** Highest the moon climbs, in degrees. The same all year: it is a stylized moon, not a lunar calendar. */
const MOON_PEAK_ELEVATION = 52;
/** The moon never drops below this, as with the sun. */
const MIN_ELEVATION = 3;

/**
 * Unit vector from the ground toward the moon. It rises in the east (+x) at dusk, is highest in the south
 * (+z) at the middle of the night, and sets in the west at dawn.
 */
export function moonDirection(timeOfDay: number): Vec3 {
  const night = Math.min(1, Math.max(0, (timeOfDay - DAY_FRACTION) / (1 - DAY_FRACTION)));
  const az = night * Math.PI;
  const el = Math.max(MIN_ELEVATION, MOON_PEAK_ELEVATION * Math.sin(az)) * (Math.PI / 180);
  return { x: Math.cos(az) * Math.cos(el), y: Math.sin(el), z: Math.sin(az) * Math.cos(el) };
}

/** How visible the moon and stars are, 0 by day to 1 at night, from the daylight ramp. */
export function nightness(light: number): number {
  return Math.min(1, Math.max(0, 1 - light * 1.6));
}

/** A small seeded generator, so the stars are the same in every run. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Flat xyz triples of unit vectors over the upper sky, spread evenly by area, a little above the horizon. */
export function starDirections(count: number, seed = 7): Float32Array {
  const rand = seeded(seed);
  const out = new Float32Array(count * 3);
  const minY = Math.sin((4 * Math.PI) / 180);
  for (let i = 0; i < count; i++) {
    const y = minY + (1 - minY) * rand();
    const r = Math.sqrt(1 - y * y);
    const a = rand() * Math.PI * 2;
    out[i * 3] = r * Math.cos(a);
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = r * Math.sin(a);
  }
  return out;
}
