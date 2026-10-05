// Sky and light by time of day and season. Pure numbers (0xRRGGBB and an intensity), so it is testable without three.js.
import { daylight, type Season } from '../sim/clock';

export interface SkyLook {
  /** Sky and fog colour. */
  sky: number;
  /** Hemisphere (ambient) light strength. */
  ambient: number;
  /** Sun strength: 0 at night. */
  sun: number;
  /** Colour of the view under the water surface, dark at night. */
  underwater: number;
}

const DAY_SKY: Record<Season, number> = {
  spring: 0xcfe3d4,
  summer: 0xcde6f0,
  autumn: 0xe3d8c0,
  winter: 0xdde6ee,
};
const NIGHT_SKY = 0x0b1426;
const DAY_UNDERWATER = 0x2c7a96;
const NIGHT_UNDERWATER = 0x07151f;
const NIGHT_AMBIENT = 0.35;
const DAY_AMBIENT = 0.95;
const DAY_SUN = 1.3;

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
    ambient: NIGHT_AMBIENT + (DAY_AMBIENT - NIGHT_AMBIENT) * light,
    sun: DAY_SUN * light,
    underwater: mix(NIGHT_UNDERWATER, DAY_UNDERWATER, light),
  };
}
