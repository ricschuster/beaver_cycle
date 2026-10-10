// Ground, tree, and water colours by season. Pure numbers (0xRRGGBB and amounts), so it is testable without three.js.
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
  /** Colour of the conifers. */
  tree: number;
  /** Colour of the crowns of broadleaf trees: fresh, green, turning, then bare twigs. */
  leaf: number;
  /** How much of its crown a broadleaf tree carries, 0 (bare) to 1. */
  foliage: number;
  /** How hard the broadleaf trees are dropping leaves, 0 to 1. */
  leafFall: number;
  /** Snow on the trees, 0 to 1: it settles on the tops of the conifer tiers and the bare branches. */
  snow: number;
  /** Colour of the open water of the lake and the streams. */
  water: number;
  /**
   * Ice at the edges of the lake, 0 to 1: 1 freezes the shallows the beaver wades in. The water it swims in stays
   * open, since the sim lets it swim all winter, and the talk says "the pond is frozen at the edges" (src/sim/talk.ts).
   */
  ice: number;
}

const KEYS: Record<Season, SeasonLook> = {
  spring: {
    grass: { color: 0xa8d46a, amount: 0.45 },
    forest: { color: 0x5a8a45, amount: 0.3 },
    tree: 0x3f7a3a,
    leaf: 0x86b84e,
    foliage: 1,
    leafFall: 0,
    snow: 0,
    water: 0x3f97ad, // snowmelt, a little milky
    ice: 0,
  },
  summer: {
    grass: { color: 0x9bbf5f, amount: 0 },
    forest: { color: 0x3f6b3a, amount: 0 },
    tree: 0x2f5a2f,
    leaf: 0x3f7a35,
    foliage: 1,
    leafFall: 0,
    snow: 0,
    water: 0x3b8fb0,
    ice: 0,
  },
  autumn: {
    grass: { color: 0xb59a4a, amount: 0.6 },
    forest: { color: 0x9a6a30, amount: 0.4 },
    tree: 0x6a6a2c,
    leaf: 0xc9782a,
    foliage: 1,
    leafFall: 1,
    snow: 0,
    water: 0x2f7896, // deeper and darker under a low sun
    ice: 0,
  },
  winter: {
    grass: { color: 0xeef2f5, amount: 0.85 },
    forest: { color: 0xdfe6ea, amount: 0.5 },
    tree: 0x3f5a4f,
    leaf: 0x6b5a4c,
    foliage: 0,
    leafFall: 0,
    snow: 1,
    water: 0x7aa6ba, // cold and grey
    ice: 1,
  },
};

/** Part of a season, at each end, spent blending into its neighbour. 0.3 is three days of ten. */
const BLEND = 0.3;
/** The first whole day of a season (0 is its first day) that shows its own look, past the blend from the season before. */
export const SEASON_FULL_DAY = Math.ceil(BLEND * DAYS_PER_SEASON);

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
  return {
    grass: mixTint(a.grass, b.grass, t),
    forest: mixTint(a.forest, b.forest, t),
    tree: mix(a.tree, b.tree, t),
    leaf: mix(a.leaf, b.leaf, t),
    foliage: a.foliage + (b.foliage - a.foliage) * t,
    leafFall: a.leafFall + (b.leafFall - a.leafFall) * t,
    snow: a.snow + (b.snow - a.snow) * t,
    water: mix(a.water, b.water, t),
    ice: a.ice + (b.ice - a.ice) * t,
  };
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
