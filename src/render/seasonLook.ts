// Ground and tree colours by season. Pure numbers (0xRRGGBB and amounts), so it is testable without three.js.
// Summer is the base look of the tiles; the other seasons pull the ground towards a colour.
import { DAYS_PER_SEASON, SEASONS, type Season } from '../sim/clock';

/** A colour the ground is pulled towards, and how far (0 leaves the tile colour, 1 replaces it). */
export interface Tint {
  color: number;
  amount: number;
}

export interface SeasonLook {
  /** Meadow, scrub, wetland and bare ground. */
  grass: Tint;
  /** The forest floor seen from above. */
  forest: Tint;
  /** Colour of the trees themselves. */
  tree: number;
}

const KEYS: Record<Season, SeasonLook> = {
  spring: {
    grass: { color: 0xa8d46a, amount: 0.45 },
    forest: { color: 0x5a8a45, amount: 0.3 },
    tree: 0x3f7a3a,
  },
  summer: {
    grass: { color: 0x9bbf5f, amount: 0 },
    forest: { color: 0x3f6b3a, amount: 0 },
    tree: 0x2f5a2f,
  },
  autumn: {
    grass: { color: 0xb59a4a, amount: 0.6 },
    forest: { color: 0x9a6a30, amount: 0.4 },
    tree: 0x6a6a2c,
  },
  winter: {
    grass: { color: 0xeef2f5, amount: 0.85 },
    forest: { color: 0xdfe6ea, amount: 0.5 },
    tree: 0x3f5a4f,
  },
};

/** Part of a season, at each end, spent blending into its neighbour. 0.3 is three days of ten. */
const BLEND = 0.3;

function mix(a: number, b: number, t: number): number {
  const ch = (shift: number): number => {
    const x = (a >> shift) & 0xff;
    const y = (b >> shift) & 0xff;
    return Math.round(x + (y - x) * t);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

function mixTint(a: Tint, b: Tint, t: number): Tint {
  return { color: mix(a.color, b.color, t), amount: a.amount + (b.amount - a.amount) * t };
}

function mixLook(a: SeasonLook, b: SeasonLook, t: number): SeasonLook {
  return { grass: mixTint(a.grass, b.grass, t), forest: mixTint(a.forest, b.forest, t), tree: mix(a.tree, b.tree, t) };
}

/**
 * The look on a day of the year (0 to 40, fractions allowed). It holds each season's
 * colours through the middle of it and blends over the turn, so nothing jumps at midnight.
 */
export function seasonLook(dayOfYear: number): SeasonLook {
  const years = SEASONS.length;
  const s = (((dayOfYear / DAYS_PER_SEASON) % years) + years) % years;
  const k = Math.floor(s);
  const f = s - k;
  const cur = KEYS[SEASONS[k]!];
  if (f < BLEND) return mixLook(KEYS[SEASONS[(k + years - 1) % years]!], cur, 0.5 + (0.5 * f) / BLEND);
  if (f > 1 - BLEND) return mixLook(cur, KEYS[SEASONS[(k + 1) % years]!], (0.5 * (f - (1 - BLEND))) / BLEND);
  return cur;
}
