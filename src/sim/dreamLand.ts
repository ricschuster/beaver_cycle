// Candy land's ground for the dream (dream.ts, docs/design/29_dream_candy_land.md): the winding chocolate river, the little
// path down to its bank, the candy props, and the height of the ground, all laid out from the night's seed. Heights here are
// measured from the chocolate's surface; dream.ts adds `CHOCOLATE_LEVEL`. The land itself stays plain data: what makes the
// height quick (distance grids to the river and the path) is worked out once per land and kept in a WeakMap.
// Pure, no DOM, no three.js.
import type { DreamLand, DreamPoint, DreamProp, PropKind } from './dream';

/** The land is this many metres either side of the middle. */
export const DREAM_HALF = 80;
/** Candy hills rise over this many metres to the edge, to this height over the chocolate. */
export const HILL_WIDTH = 15;
const HILL_TOP = 12;
/** The river bed in the middle of the chocolate is this deep. */
export const RIVER_BED = 1.2;
/** The bank climbs from the chocolate's edge to the land over this many metres. */
const BANK = 5;
/** River and path points are about this far apart (metres). */
const STEP = 2;
/** Props, sweets and wander spots keep inside this far from the middle, out of the hills. */
export const INNER = DREAM_HALF - HILL_WIDTH - 1;
/** A prop keeps this far from the path and from the chocolate's edge (metres, from its middle). */
export const PATH_CLEAR = 2;
export const BANK_CLEAR = 1.5;
/** Ground taken by a prop of each kind at size 1 (metres): what the beaver bumps into, and what a hider stands behind. */
export const PROP_RADIUS: Readonly<Record<PropKind, number>> = {
  lollipop: 0.2,
  gumdrop: 0.7,
  candyCane: 0.15,
  cupcake: 0.9,
  iceCream: 0.35,
  marshmallowRock: 0.8,
  cottonCandy: 0.2,
};

const TAU = Math.PI * 2;

/** A small seeded random source (mulberry32): `next()` in [0, 1), and its state to carry on to the next step. */
export function rngFrom(state: number): { next: () => number; state: () => number } {
  let s = state >>> 0;
  return {
    next: () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    state: () => s,
  };
}

/** Mixes a seed with a salt into a new 32 bit state. */
export function mixSeed(seed: number, salt: number): number {
  let h = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt ^ 0xc2b2ae35, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const smooth = (a: number, b: number, v: number): number => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Squared distance from a point to the segment a-b, and where along it (0 to 1) the nearest point is. */
function toSegment(px: number, pz: number, a: DreamPoint, b: DreamPoint): { d2: number; t: number } {
  const ex = b.x - a.x;
  const ez = b.z - a.z;
  const l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? clamp(((px - a.x) * ex + (pz - a.z) * ez) / l2, 0, 1) : 0;
  const dx = a.x + ex * t - px;
  const dz = a.z + ez * t - pz;
  return { d2: dx * dx + dz * dz, t };
}

/** The nearest point of a line of points to (x, z), its distance, and the side (+1 left of the way the line runs, -1 right). */
export function nearestOnLine(line: readonly DreamPoint[], x: number, z: number): { x: number; z: number; d: number; side: number } {
  let best = Infinity;
  let bx = x;
  let bz = z;
  let side = 1;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const { d2, t } = toSegment(x, z, a, b);
    if (d2 < best) {
      best = d2;
      bx = a.x + (b.x - a.x) * t;
      bz = a.z + (b.z - a.z) * t;
      side = (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x) >= 0 ? 1 : -1;
    }
  }
  return { x: bx, z: bz, d: Math.sqrt(best), side };
}

export const lineDistance = (line: readonly DreamPoint[], x: number, z: number): number => nearestOnLine(line, x, z).d;

/** Points along a dense line, about `step` metres apart, keeping its first and last points. */
function resample(dense: readonly DreamPoint[], step: number): DreamPoint[] {
  const out: DreamPoint[] = [dense[0]!];
  let carried = 0;
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1]!;
    const b = dense[i]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    let at = step - carried;
    while (at <= len) {
      out.push({ x: a.x + ((b.x - a.x) * at) / len, z: a.z + ((b.z - a.z) * at) / len });
      at += step;
    }
    carried = len - (at - step);
  }
  const last = dense[dense.length - 1]!;
  const tail = out[out.length - 1]!;
  if (Math.hypot(last.x - tail.x, last.z - tail.z) < step * 0.4 && out.length > 1) out[out.length - 1] = last;
  else out.push(last);
  return out;
}

/** The river's centre line, from one edge to the opposite one: a gentle sway with a smaller wiggle on it. */
function makeRiver(rand: () => number): DreamPoint[] {
  const centre = (rand() - 0.5) * 30;
  const a1 = 10 + rand() * 5;
  const l1 = 120 + rand() * 50;
  const p1 = rand() * TAU;
  const a2 = 2 + rand() * 2;
  const l2 = 45 + rand() * 20;
  const p2 = rand() * TAU;
  const alongX = rand() < 0.5;
  const flip = rand() < 0.5 ? -1 : 1;
  const dense: DreamPoint[] = [];
  for (let u = -DREAM_HALF; u <= DREAM_HALF + 1e-9; u += 0.25) {
    const v = centre + a1 * Math.sin((TAU * u) / l1 + p1) + a2 * Math.sin((TAU * u) / l2 + p2);
    dense.push(alongX ? { x: u * flip, z: v } : { x: v, z: u * flip });
  }
  return resample(dense, STEP);
}

/** The little path: from a start 45 to 60 m from the river, winding gently down to the bank at the nearest stretch. */
function makePath(rand: () => number, river: readonly DreamPoint[], width: number): DreamPoint[] {
  const inside = (p: DreamPoint): boolean => Math.abs(p.x) < DREAM_HALF - 22 && Math.abs(p.z) < DREAM_HALF - 22;
  const middle = river.filter((p) => Math.abs(p.x) < 38 && Math.abs(p.z) < 38).map((p) => river.indexOf(p));
  let start: DreamPoint | null = null;
  let fallback: { p: DreamPoint; miss: number } | null = null;
  for (let attempt = 0; attempt < 300 && !start; attempt++) {
    const i = middle[Math.floor(rand() * middle.length)] ?? Math.floor(river.length / 2);
    const a = river[Math.max(0, i - 1)]!;
    const b = river[Math.min(river.length - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const side = rand() < 0.5 ? 1 : -1;
    const turn = (rand() - 0.5) * 0.8;
    const nx = (-(b.z - a.z) / len) * side;
    const nz = ((b.x - a.x) / len) * side;
    const dx = nx * Math.cos(turn) - nz * Math.sin(turn);
    const dz = nx * Math.sin(turn) + nz * Math.cos(turn);
    const far = 46 + rand() * 13;
    const p = { x: river[i]!.x + dx * far, z: river[i]!.z + dz * far };
    if (!inside(p)) continue;
    const d = lineDistance(river, p.x, p.z);
    if (d >= 45 && d <= 60) start = p;
    else {
      const miss = d < 45 ? 45 - d : d - 60;
      if (!fallback || miss < fallback.miss) fallback = { p, miss };
    }
  }
  const s = start ?? fallback?.p ?? { x: 0, z: 0 };
  const near = nearestOnLine(river, s.x, s.z);
  const away = Math.hypot(s.x - near.x, s.z - near.z) || 1;
  const end = { x: near.x + ((s.x - near.x) / away) * (width / 2 + 0.3), z: near.z + ((s.z - near.z) / away) * (width / 2 + 0.3) };
  const ex = end.x - s.x;
  const ez = end.z - s.z;
  const el = Math.hypot(ex, ez) || 1;
  const sway = 4 + rand() * 3;
  const waves = 1 + rand() * 0.6;
  const phase = rand() * TAU;
  const dense: DreamPoint[] = [];
  for (let k = 0; k <= 200; k++) {
    const t = k / 200;
    const off = sway * Math.sin(Math.PI * t) * Math.sin(TAU * waves * t + phase);
    dense.push({ x: s.x + ex * t + (-ez / el) * off, z: s.z + ez * t + (ex / el) * off });
  }
  return resample(dense, STEP);
}

const PROP_KINDS: readonly [PropKind, number][] = [
  ['lollipop', 0.21],
  ['gumdrop', 0.19],
  ['candyCane', 0.12],
  ['cupcake', 0.11],
  ['iceCream', 0.1],
  ['marshmallowRock', 0.12],
  ['cottonCandy', 0.15],
];

function pickKind(rand: () => number): PropKind {
  let r = rand();
  for (const [kind, w] of PROP_KINDS) {
    r -= w;
    if (r < 0) return kind;
  }
  return 'gumdrop';
}

/** Big enough to hide a marshmallow beaver: the bulky kinds from size 1.1, a lollipop or a cotton candy tree from 1.2 (its sweet is big then). */
const hides = (kind: PropKind, size: number): boolean =>
  ((kind === 'cupcake' || kind === 'marshmallowRock' || kind === 'iceCream') && size >= 1.1) || ((kind === 'lollipop' || kind === 'cottonCandy') && size >= 1.2);

/** Hiding props in the grove by the end of the path, and the most of all props that hide. */
const GROVE = 10;
const HIDE_SHARE = 0.42;

/** About 60 to 90 props: groups along the path, so the walk goes through candy, and the rest over the land. */
function makeProps(rand: () => number, river: readonly DreamPoint[], width: number, path: readonly DreamPoint[]): DreamProp[] {
  const props: DreamProp[] = [];
  const want = 60 + Math.floor(rand() * 31);
  const tryPlace = (x: number, z: number, kind = pickKind(rand), size = 0.6 + rand() * 1.0): boolean => {
    const r = PROP_RADIUS[kind] * size;
    if (Math.abs(x) > INNER || Math.abs(z) > INNER) return false;
    if (lineDistance(path, x, z) < Math.max(PATH_CLEAR, r + 0.6)) return false;
    if (lineDistance(river, x, z) < width / 2 + BANK_CLEAR + r) return false;
    for (const p of props) {
      const gap = PROP_RADIUS[p.kind] * p.size + r + 1.2;
      if ((p.x - x) ** 2 + (p.z - z) ** 2 < gap * gap) return false;
    }
    const colour = Math.floor(rand() * 7);
    props.push({ id: `p${props.length}`, kind, x, z, size, yaw: rand() * TAU, colour, hide: hides(kind, size) });
    return true;
  };
  // A grove of big props round where the path meets the river, where the marshmallow beavers play, to hide behind.
  const end = path[path.length - 1]!;
  const hiders: PropKind[] = ['cupcake', 'marshmallowRock', 'iceCream', 'lollipop', 'cottonCandy'];
  for (let attempt = 0, grove = 0; attempt < 400 && grove < GROVE; attempt++) {
    const a = rand() * TAU;
    const r = 14 + rand() * 24;
    const kind = hiders[Math.floor(rand() * hiders.length)]!;
    if (tryPlace(end.x + Math.sin(a) * r, end.z + Math.cos(a) * r, kind, 1.2 + rand() * 0.4)) grove++;
  }
  for (let i = 1; i + 1 < path.length && props.length < want; i += 2) {
    const a = path[i - 1]!;
    const b = path[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = -(b.z - a.z) / len;
    const nz = (b.x - a.x) / len;
    const side = rand() < 0.5 ? 1 : -1;
    const p = path[i]!;
    if (rand() < 0.75) {
      const off = side * (2.6 + rand() * 4);
      tryPlace(p.x + nx * off, p.z + nz * off);
    }
    if (rand() < 0.35) {
      const off = -side * (2.6 + rand() * 4);
      tryPlace(p.x + nx * off, p.z + nz * off);
    }
  }
  for (let attempt = 0; attempt < 4000 && props.length < want; attempt++) tryPlace((rand() * 2 - 1) * INNER, (rand() * 2 - 1) * INNER);
  // About a third hide: past that, the smallest ones outside the grove are only for looking at.
  const extra = props.filter((p) => p.hide).length - Math.floor(props.length * HIDE_SHARE);
  if (extra <= 0) return props;
  const small = new Set(
    props
      .slice(GROVE)
      .filter((p) => p.hide)
      .sort((a, b) => a.size - b.size)
      .slice(0, extra)
      .map((p) => p.id),
  );
  return props.map((p) => (small.has(p.id) ? { ...p, hide: false } : p));
}

/** The land for a seed: the river, the path, the start, and the props. Sweets and marshmallow beavers are laid out in dream.ts. */
export function makeLand(seed: number): DreamLand {
  const rand = rngFrom(mixSeed(seed, 1)).next;
  const riverWidth = 9 + rand() * 3;
  const river = makeRiver(rand);
  const path = makePath(rand, river, riverWidth);
  const a = path[0]!;
  const b = path[1] ?? a;
  const start = { x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z) };
  const props = makeProps(rand, river, riverWidth, path);
  return { seed, half: DREAM_HALF, path, river, riverWidth, start, props };
}

/** What makes the height quick for one land: grids of the signed distance to the river and the distance to the path. */
interface Field {
  half: number;
  /** Grid nodes per side, one metre apart. */
  n: number;
  /** Signed distance to the river's centre line: positive on its left, negative on its right. */
  river: Float32Array;
  /** Distance to the path, capped at a few metres past where it stops mattering. */
  path: Float32Array;
  /** The rolling of the land: three waves with seeded tilts and phases. */
  k: [number, number, number];
  ph: [number, number, number];
  /** Places a marshmallow beaver ambles between: in the river, on its banks, and on the path. */
  spots: DreamPoint[];
}

const fields = new WeakMap<DreamLand, Field>();
const PATH_CAP = 12;

function field(land: DreamLand): Field {
  const known = fields.get(land);
  if (known) return known;
  const half = land.half;
  const n = 2 * Math.ceil(half) + 1;
  const river = new Float32Array(n * n);
  const path = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i - (n - 1) / 2;
      const z = j - (n - 1) / 2;
      const r = nearestOnLine(land.river, x, z);
      river[j * n + i] = r.d * r.side;
      path[j * n + i] = Math.min(PATH_CAP, lineDistance(land.path, x, z));
    }
  }
  const rand = rngFrom(mixSeed(land.seed, 2)).next;
  const k: [number, number, number] = [0.05 + rand() * 0.04, 0.05 + rand() * 0.04, 0.08 + rand() * 0.05];
  const ph: [number, number, number] = [rand() * TAU, rand() * TAU, rand() * TAU];
  const w2 = land.riverWidth / 2;
  const spots: DreamPoint[] = [];
  const keep = (p: DreamPoint): boolean => Math.abs(p.x) < INNER - 2 && Math.abs(p.z) < INNER - 2;
  land.river.forEach((p, i) => {
    if (i % 2 !== 0 || !keep(p)) return;
    const a = land.river[Math.max(0, i - 1)]!;
    const b = land.river[Math.min(land.river.length - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = -(b.z - a.z) / len;
    const nz = (b.x - a.x) / len;
    spots.push(p, { x: p.x + nx * (w2 + 1.5), z: p.z + nz * (w2 + 1.5) }, { x: p.x - nx * (w2 + 1.5), z: p.z - nz * (w2 + 1.5) });
  });
  for (const p of land.path) if (keep(p)) spots.push(p);
  const made: Field = { half, n, river, path, k, ph, spots };
  fields.set(land, made);
  return made;
}

/** Bilinear sample of a grid at (x, z), clamped to the land. */
function sample(f: Field, g: Float32Array, x: number, z: number): number {
  const c = (f.n - 1) / 2;
  const gx = clamp(x + c, 0, f.n - 1.0001);
  const gz = clamp(z + c, 0, f.n - 1.0001);
  const i = Math.floor(gx);
  const j = Math.floor(gz);
  const tx = gx - i;
  const tz = gz - j;
  const k = j * f.n + i;
  return (g[k]! * (1 - tx) + g[k + 1]! * tx) * (1 - tz) + (g[k + f.n]! * (1 - tx) + g[k + f.n + 1]! * tx) * tz;
}

/** Signed distance to the river's centre line (positive on its left), from the grid. */
export const riverSide = (land: DreamLand, x: number, z: number): number => sample(field(land), field(land).river, x, z);

/** Distance to the river's centre line, from the grid. */
export const riverDistance = (land: DreamLand, x: number, z: number): number => Math.abs(riverSide(land, x, z));

/** Height of the ground over the chocolate's surface at a point. */
export function landRise(land: DreamLand, x: number, z: number): number {
  const f = field(land);
  const r = Math.abs(sample(f, f.river, x, z));
  const p = sample(f, f.path, x, z);
  const w2 = land.riverWidth / 2;
  const roll = 0.6 * Math.sin(x * f.k[0] + f.ph[0]) * Math.cos(z * f.k[1] + f.ph[1]) + 0.4 * Math.sin((x - z) * f.k[2] + f.ph[2]);
  // Rolling candy ground, calmer along the path, and lower by the river so the bank is gentle.
  let ground = 1.5 + roll * (0.25 + 0.75 * smooth(2, 10, p));
  ground = 0.6 + (ground - 0.6) * smooth(w2, w2 + 14, r);
  let h: number;
  if (r < w2) {
    const q = r / w2;
    h = -RIVER_BED * (1 - q * q);
  } else if (r < w2 + BANK) {
    const t = (r - w2) / BANK;
    h = ground * (1 - (1 - t) * (1 - t));
  } else h = ground;
  // The candy hills at the edges, with a gap where the river runs out.
  const m = Math.max(Math.abs(x), Math.abs(z));
  const t = clamp((m - (land.half - HILL_WIDTH)) / HILL_WIDTH, 0, 1);
  if (t > 0) h += (HILL_TOP - h) * t * t * (3 - 2 * t) * smooth(w2 + 1, w2 + 10, r);
  return h;
}

/** Across and along the river at a point: `out` points away from the centre line, `along` the way the river runs. */
export function riverFrame(land: DreamLand, x: number, z: number): { out: DreamPoint; along: DreamPoint; side: number } {
  const f = field(land);
  const gx = sample(f, f.river, x + 0.5, z) - sample(f, f.river, x - 0.5, z);
  const gz = sample(f, f.river, x, z + 0.5) - sample(f, f.river, x, z - 0.5);
  const len = Math.hypot(gx, gz) || 1;
  const side = sample(f, f.river, x, z) >= 0 ? 1 : -1;
  // The signed distance grows to the left, so its slope points left; away from the centre is that times the side.
  return { out: { x: (gx / len) * side, z: (gz / len) * side }, along: { x: gz / len, z: -gx / len }, side };
}

/** The places a marshmallow beaver ambles between. */
export const wanderSpots = (land: DreamLand): readonly DreamPoint[] => field(land).spots;
