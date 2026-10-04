// Draws the loaded tiles. Reads the tile store and the streamer's wishes, never
// changes them. One mesh per tile, rebuilt when the level it shows changes.
import * as THREE from 'three';
import type { DecodedTile } from '../terrain/format';
import { distToTile, shownLevel, type Streamer } from '../terrain/streamer';
import { tileKey, type TileStore } from '../terrain/store';

const CLASS_COLORS: Record<number, number> = {
  0: 0x8a9a62, // ground
  1: 0x9bbf5f, // meadow
  2: 0x3f6b3a, // forest
  3: 0x6f8a45, // scrub
  4: 0x8d8a82, // rock
  5: 0x6d8a6a, // wetland
  9: 0x2f6f8f, // lake bed, until the water plane arrives
};
const FALLBACK = new THREE.Color(CLASS_COLORS[0]);
const COLORS = new Map(Object.entries(CLASS_COLORS).map(([k, v]) => [Number(k), new THREE.Color(v)]));

/** Metres a skirt hangs per metre of cell size, to hide gaps between levels. */
const SKIRT_PER_CELL = 1;
/** Milliseconds per frame spent building tile meshes. At least one is always built. */
const BUILD_BUDGET_MS = 4;

export function buildTileGeometry(tile: DecodedTile, size: number): THREE.BufferGeometry {
  const { n, heights: h, classes } = tile;
  const w = n + 1;
  const cell = size / n;
  const x0 = tile.tx * size;
  const z0 = tile.tz * size;
  const drop = Math.max(2, cell * SKIRT_PER_CELL);
  const edge: number[] = []; // vertex indices of the border, in a loop
  for (let i = 0; i < n; i++) edge.push(i); // north, west to east
  for (let j = 0; j < n; j++) edge.push(j * w + n); // east, north to south
  for (let i = n; i > 0; i--) edge.push(n * w + i); // south, east to west
  for (let j = n; j > 0; j--) edge.push(j * w); // west, south to north

  const nv = w * w;
  const total = nv + edge.length;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const at = (i: number, j: number): number => h[Math.min(Math.max(j, 0), n) * w + Math.min(Math.max(i, 0), n)]!;

  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const v = j * w + i;
      pos.set([x0 + i * cell, h[v]!, z0 + j * cell], v * 3);
      const dx = (at(i - 1, j) - at(i + 1, j)) / (2 * cell);
      const dz = (at(i, j - 1) - at(i, j + 1)) / (2 * cell);
      const len = Math.hypot(dx, 1, dz);
      nor.set([dx / len, 1 / len, dz / len], v * 3);
      // average the colours of the (up to four) cells around the vertex
      let r = 0, g = 0, b = 0, count = 0;
      for (let cj = j - 1; cj <= j; cj++) {
        for (let ci = i - 1; ci <= i; ci++) {
          if (ci < 0 || cj < 0 || ci >= n || cj >= n) continue;
          const c = COLORS.get(classes[cj * n + ci]!) ?? FALLBACK;
          r += c.r; g += c.g; b += c.b; count++;
        }
      }
      col.set([r / count, g / count, b / count], v * 3);
    }
  }
  edge.forEach((v, k) => {
    const s = nv + k;
    pos.set([pos[v * 3]!, pos[v * 3 + 1]! - drop, pos[v * 3 + 2]!], s * 3);
    nor.copyWithin(s * 3, v * 3, v * 3 + 3);
    col.copyWithin(s * 3, v * 3, v * 3 + 3);
  });

  const index: number[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * w + i;
      const b = a + 1;
      const c = a + w;
      const d = c + 1;
      index.push(a, c, b, b, c, d); // counter clockwise seen from above
    }
  }
  // skirts, in both windings so they show from either side
  edge.forEach((v, k) => {
    const next = (k + 1) % edge.length;
    const p = v, q = edge[next]!;
    const p2 = nv + k, q2 = nv + next;
    index.push(p, q, q2, p, q2, p2, p, q2, q, p, p2, q2);
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
}

export interface TerrainStats {
  meshes: number;
  triangles: number;
  tilesByLevel: number[];
}

export interface TerrainView {
  update(x: number, z: number): void;
  stats(): TerrainStats;
}

export function createTerrainView(scene: THREE.Scene, store: TileStore, streamer: Streamer): TerrainView {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const meshes = new Map<string, { mesh: THREE.Mesh; level: number }>();
  const size = store.size;

  return {
    update(x, z) {
      const todo: { tx: number; tz: number; level: number; dist: number }[] = [];
      for (const t of store.index.tiles) {
        const level = shownLevel(streamer.desiredLevel(t.tx, t.tz), (l) => store.has(t.tx, t.tz, l));
        if (level === undefined || meshes.get(tileKey(t.tx, t.tz))?.level === level) continue;
        todo.push({ tx: t.tx, tz: t.tz, level, dist: distToTile(x, z, t.tx, t.tz, size) });
      }
      todo.sort((a, b) => a.dist - b.dist);
      const start = performance.now();
      for (const job of todo) {
        const tile = store.get(job.tx, job.tz, job.level)!;
        const key = tileKey(job.tx, job.tz);
        const old = meshes.get(key);
        if (old) {
          scene.remove(old.mesh);
          old.mesh.geometry.dispose();
        }
        const mesh = new THREE.Mesh(buildTileGeometry(tile, size), material);
        scene.add(mesh);
        meshes.set(key, { mesh, level: job.level });
        if (performance.now() - start > BUILD_BUDGET_MS) break;
      }
    },
    stats() {
      let triangles = 0;
      for (const { mesh } of meshes.values()) triangles += (mesh.geometry.index?.count ?? 0) / 3;
      return { meshes: meshes.size, triangles, tilesByLevel: store.countByLevel() };
    },
  };
}
