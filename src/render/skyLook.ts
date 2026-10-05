// Sky and light by time of day and season. Pure numbers (0xRRGGBB and an intensity), so it is testable without three.js.
import { daylight, type Season } from '../sim/clock';

export interface SkyLook {
  /** Sky and fog colour. */
  sky: number;
  /** Hemisphere light strength; the day value is the 1.6 the scene used before the clock. */
  intensity: number;
}

const DAY_SKY: Record<Season, number> = {
  spring: 0xcfe3d4,
  summer: 0xcde6f0,
  autumn: 0xe3d8c0,
  winter: 0xdde6ee,
};
const NIGHT_SKY = 0x0b1426;
const NIGHT_INTENSITY = 0.35;
const DAY_INTENSITY = 1.6;

function mix(a: number, b: number, t: number): number {
  const ch = (shift: number): number => {
    const x = (a >> shift) & 0xff;
    const y = (b >> shift) & 0xff;
    return Math.round(x + (y - x) * t);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export function skyLook(season: Season, timeOfDay: number): SkyLook {
  const light = daylight(timeOfDay);
  return {
    sky: mix(NIGHT_SKY, DAY_SKY[season], light),
    intensity: NIGHT_INTENSITY + (DAY_INTENSITY - NIGHT_INTENSITY) * light,
  };
}
