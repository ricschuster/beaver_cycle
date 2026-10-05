// Where the sun is, and where its shadow box sits. Pure numbers, so it is testable without three.js.
import type { Season } from '../sim/clock';
import { DAY_FRACTION } from '../sim/clock';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Highest sun at midday, in degrees, for the Almsee (about 47.8 N), one value per season. */
const PEAK_ELEVATION: Record<Season, number> = { spring: 42, summer: 62, autumn: 42, winter: 19 };
/** The sun never drops below this, so the light does not come from under the ground at dusk. */
const MIN_ELEVATION = 3;

/**
 * Unit vector from the ground toward the sun. The sun rises in the east (+x), is
 * highest in the south (+z, the game's south) at midday, and sets in the west.
 */
export function sunDirection(season: Season, timeOfDay: number): Vec3 {
  const t = Math.min(1, Math.max(0, timeOfDay / DAY_FRACTION));
  const az = t * Math.PI;
  const el = Math.max(MIN_ELEVATION, PEAK_ELEVATION[season] * Math.sin(az)) * (Math.PI / 180);
  return { x: Math.cos(az) * Math.cos(el), y: Math.sin(el), z: Math.sin(az) * Math.cos(el) };
}
