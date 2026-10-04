import type { TileIndex } from './format';
import { TileStore } from './store';

/** Loads the tile index. Returns null when there are no tiles (they are built locally, not in git). */
export async function loadTileStore(base: string): Promise<TileStore | null> {
  try {
    const res = await fetch(`${base}index.json`);
    if (!res.ok) return null;
    const index = (await res.json()) as TileIndex;
    return index.version === 1 ? new TileStore(index) : null;
  } catch {
    return null;
  }
}
