import { decodeTile, type DecodedTile } from './format';
import { tileKey, type TileStore } from './store';

export type FetchTile = (level: number, tx: number, tz: number) => Promise<DecodedTile>;

export interface StreamerOptions {
  /** Outer radius in metres of level 0 and level 1. Level 2 is everything beyond. */
  rings: [number, number];
  /** A tile keeps its finer level this far past a ring, so it does not flicker. */
  hysteresis: number;
  maxConcurrent: number;
}

export const defaultStreamerOptions: StreamerOptions = {
  rings: [640, 1300],
  hysteresis: 40,
  maxConcurrent: 4,
};

export const COARSEST = 2;

/** Detail level for a tile at a distance, keeping the previous level near a ring. */
export function levelFor(dist: number, prev: number | undefined, o: StreamerOptions): number {
  const base = dist < o.rings[0] ? 0 : dist < o.rings[1] ? 1 : COARSEST;
  if (prev !== undefined && prev < COARSEST && base > prev && dist < o.rings[prev]! + o.hysteresis) {
    return prev;
  }
  return base;
}

/** Distance from a point to the nearest point of a square tile. */
export function distToTile(x: number, z: number, tx: number, tz: number, size: number): number {
  const dx = Math.max(tx * size - x, 0, x - (tx + 1) * size);
  const dz = Math.max(tz * size - z, 0, z - (tz + 1) * size);
  return Math.hypot(dx, dz);
}

/**
 * Which level to show for a tile given what is loaded: the wanted level if it
 * is there, else the nearest finer one, else the nearest coarser one.
 */
export function shownLevel(desired: number, loaded: (level: number) => boolean): number | undefined {
  if (loaded(desired)) return desired;
  for (let l = desired - 1; l >= 0; l--) if (loaded(l)) return l;
  for (let l = desired + 1; l <= COARSEST; l++) if (loaded(l)) return l;
  return undefined;
}

/**
 * Decides which tiles at which level the player needs around a position,
 * fetches what is missing (nearest first), and drops finer levels that are no
 * longer wanted. The whole core stays loaded at the coarsest level as a horizon,
 * so there is always ground under a fast beaver.
 */
export class Streamer {
  private readonly desired = new Map<string, number>();
  private readonly inFlight = new Set<string>();
  private readonly failed = new Set<string>();

  constructor(
    private readonly store: TileStore,
    private readonly fetchTile: FetchTile,
    private readonly options: StreamerOptions = defaultStreamerOptions,
  ) {}

  desiredLevel(tx: number, tz: number): number {
    return this.desired.get(tileKey(tx, tz)) ?? COARSEST;
  }

  get pending(): number {
    return this.inFlight.size;
  }

  update(x: number, z: number): void {
    const size = this.store.size;
    const wanted: { tx: number; tz: number; level: number; dist: number }[] = [];
    for (const t of this.store.index.tiles) {
      const key = tileKey(t.tx, t.tz);
      const dist = distToTile(x, z, t.tx, t.tz, size);
      const level = levelFor(dist, this.desired.get(key), this.options);
      this.desired.set(key, level);
      for (const l of level === COARSEST ? [COARSEST] : [COARSEST, level]) {
        if (!this.store.has(t.tx, t.tz, l)) wanted.push({ tx: t.tx, tz: t.tz, level: l, dist });
      }
      this.evict(t.tx, t.tz, level);
    }
    // nearest first, and the coarse ground of a tile before its fine level
    wanted.sort((a, b) => a.dist - b.dist || b.level - a.level);
    for (const w of wanted) {
      if (this.inFlight.size >= this.options.maxConcurrent) break;
      this.start(w.tx, w.tz, w.level);
    }
  }

  private evict(tx: number, tz: number, desired: number): void {
    for (let l = 0; l < COARSEST; l++) {
      if (l === desired || !this.store.has(tx, tz, l)) continue;
      // a finer level is no longer wanted; a coarser one stays until the wanted one arrives
      if (l < desired || this.store.has(tx, tz, desired)) this.store.drop(tx, tz, l);
    }
  }

  private start(tx: number, tz: number, level: number): void {
    const id = `${level}:${tileKey(tx, tz)}`;
    if (this.inFlight.has(id) || this.failed.has(id)) return;
    this.inFlight.add(id);
    this.fetchTile(level, tx, tz)
      .then((tile) => this.store.put(tile))
      .catch((e: unknown) => {
        this.failed.add(id);
        console.warn(`tile ${id} failed`, e);
      })
      .finally(() => this.inFlight.delete(id));
  }

  /** Resolves once the tile under a point is loaded at its wanted level, or after a timeout. */
  async ready(x: number, z: number, timeoutMs: number): Promise<boolean> {
    const size = this.store.size;
    const tx = Math.floor(x / size);
    const tz = Math.floor(z / size);
    const end = performance.now() + timeoutMs;
    for (;;) {
      this.update(x, z);
      if (this.store.has(tx, tz, this.desiredLevel(tx, tz))) return true;
      if (performance.now() > end) return false;
      await new Promise((r) => setTimeout(r, 30));
    }
  }
}

/** Fetches tile files from a base url (tiles/ next to the page). */
export function httpFetchTile(base: string): FetchTile {
  return async (level, tx, tz) => {
    const res = await fetch(`${base}L${level}/${tx}_${tz}.bin`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return decodeTile(tx, tz, await res.arrayBuffer());
  };
}
