// Draws the loaded tiles. Reads the tile store and the streamer's wishes, never
// changes them. One mesh per tile, rebuilt when the level it shows changes.
import * as THREE from 'three';
import { CLASS_LAKE, type DecodedTile, type TileWater } from '../terrain/format';
import { placeTrees, TREE_FLOATS } from '../terrain/trees';
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

/** Flat quads at the lake level over the lake cells of a tile, or null when it has none. */
export function buildLakeGeometry(tile: DecodedTile, size: number, level: number): THREE.BufferGeometry | null {
  const { n, classes } = tile;
  const cell = size / n;
  const pos: number[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (classes[j * n + i] !== CLASS_LAKE) continue;
      const x = tile.tx * size + i * cell;
      const z = tile.tz * size + j * cell;
      pos.push(x, level, z, x, level, z + cell, x + cell, level, z, x + cell, level, z, x, level, z + cell, x + cell, level, z + cell);
    }
  }
  if (pos.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(pos), 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

const STREAM_HALF_WIDTH = 1.25;
const STREAM_STEP = 5;
const STREAM_LIFT = 0.3;

/** Ribbons draped on the ground along the stream lines of a tile, or null when it has none. */
export function buildStreamGeometry(
  water: TileWater,
  heightAt: (x: number, z: number) => number,
): THREE.BufferGeometry | null {
  const pos: number[] = [];
  const index: number[] = [];
  for (const s of water.streams) {
    // resample the line every few metres so the ribbon follows the ground
    const pts: [number, number][] = [];
    for (let k = 0; k + 1 < s.pts.length; k++) {
      const [ax, az] = s.pts[k]!;
      const [bx, bz] = s.pts[k + 1]!;
      const parts = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / STREAM_STEP));
      for (let p = 0; p < parts; p++) pts.push([ax + ((bx - ax) * p) / parts, az + ((bz - az) * p) / parts]);
    }
    if (s.pts.length < 2) continue;
    pts.push(s.pts[s.pts.length - 1]!);
    const base = pos.length / 3;
    for (let k = 0; k < pts.length; k++) {
      const [x, z] = pts[k]!;
      const [px, pz] = pts[Math.max(k - 1, 0)]!;
      const [qx, qz] = pts[Math.min(k + 1, pts.length - 1)]!;
      const len = Math.hypot(qx - px, qz - pz) || 1;
      const nx = (-(qz - pz) / len) * STREAM_HALF_WIDTH;
      const nz = ((qx - px) / len) * STREAM_HALF_WIDTH;
      for (const side of [-1, 1]) {
        const wx = x + nx * side;
        const wz = z + nz * side;
        pos.push(wx, heightAt(wx, wz) + STREAM_LIFT, wz);
      }
    }
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = base + k * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3, a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  if (pos.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(pos), 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// Trees are shared geometry, one per level, never disposed. Level 2 has none.
const TREE_GEOMETRY = [
  new THREE.ConeGeometry(1.8, 9, 6, 1, true).translate(0, 4, 0),
  new THREE.ConeGeometry(2.4, 10, 4, 1, true).translate(0, 4.5, 0),
];

function buildTrees(tile: DecodedTile, size: number, material: THREE.Material): THREE.InstancedMesh | null {
  const geometry = TREE_GEOMETRY[tile.level];
  const trees = geometry ? placeTrees(tile, size) : new Float32Array(0);
  if (!geometry || trees.length === 0) return null;
  const count = trees.length / TREE_FLOATS;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const m = new THREE.Matrix4();
  for (let k = 0; k < count; k++) {
    const o = k * TREE_FLOATS;
    const s = trees[o + 3]!;
    m.makeScale(s, s, s).setPosition(trees[o]!, trees[o + 1]!, trees[o + 2]!);
    mesh.setMatrixAt(k, m);
  }
  mesh.computeBoundingSphere();
  return mesh;
}

/** Triangles a mesh draws, counting every instance. */
function trianglesOf(mesh: THREE.Mesh): number {
  const per = (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3;
  return per * (mesh instanceof THREE.InstancedMesh ? mesh.count : 1);
}

export interface TerrainStats {
  meshes: number;
  triangles: number;
  trees: number;
  tilesByLevel: number[];
}

/** Marks a mesh whose geometry belongs to its tile, so it is freed with the tile. */
function own<T extends THREE.Mesh>(mesh: T): T {
  mesh.userData.owned = true;
  return mesh;
}

function disposeGroup(scene: THREE.Scene, group: THREE.Group): void {
  scene.remove(group);
  for (const child of group.children as THREE.Mesh[]) {
    if (child.userData.owned) child.geometry.dispose();
    if (child instanceof THREE.InstancedMesh) child.dispose();
  }
}

export interface TerrainView {
  update(x: number, z: number): void;
  stats(): TerrainStats;
}

export function createTerrainView(scene: THREE.Scene, store: TileStore, streamer: Streamer): TerrainView {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const lakeMaterial = new THREE.MeshLambertMaterial({
    color: 0x3b8fb0,
    transparent: true,
    opacity: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const streamMaterial = new THREE.MeshLambertMaterial({ color: 0x3b8fb0, side: THREE.DoubleSide });
  const treeMaterial = new THREE.MeshLambertMaterial({ color: 0x2f5a2f });
  const meshes = new Map<string, { group: THREE.Group; level: number; streams: boolean }>();
  const size = store.size;

  return {
    update(x, z) {
      const todo: { tx: number; tz: number; level: number; dist: number }[] = [];
      for (const t of store.index.tiles) {
        const level = shownLevel(streamer.desiredLevel(t.tx, t.tz), (l) => store.has(t.tx, t.tz, l));
        if (level === undefined) continue;
        const shown = meshes.get(tileKey(t.tx, t.tz));
        const wantsStreams = level < 2 && store.waterOf(t.tx, t.tz) !== undefined;
        if (shown && shown.level === level && shown.streams === wantsStreams) continue;
        todo.push({ tx: t.tx, tz: t.tz, level, dist: distToTile(x, z, t.tx, t.tz, size) });
      }
      todo.sort((a, b) => a.dist - b.dist);
      const start = performance.now();
      for (const job of todo) {
        const tile = store.get(job.tx, job.tz, job.level)!;
        const key = tileKey(job.tx, job.tz);
        const old = meshes.get(key);
        if (old) disposeGroup(scene, old.group);
        const group = new THREE.Group();
        group.add(own(new THREE.Mesh(buildTileGeometry(tile, size), material)));
        const lakeLevel = store.tileInfo(job.tx, job.tz)?.lakeLevel_m;
        const lake = lakeLevel == null || job.level > 1 ? null : buildLakeGeometry(tile, size, lakeLevel);
        if (lake) group.add(own(new THREE.Mesh(lake, lakeMaterial)));
        const water = store.waterOf(job.tx, job.tz);
        const streams = job.level < 2 && water ? buildStreamGeometry(water, (x, z) => store.heightAt(x, z)) : null;
        if (streams) group.add(own(new THREE.Mesh(streams, streamMaterial)));
        const trees = buildTrees(tile, size, treeMaterial);
        if (trees) group.add(trees);
        scene.add(group);
        meshes.set(key, { group, level: job.level, streams: job.level < 2 && water !== undefined });
        if (performance.now() - start > BUILD_BUDGET_MS) break;
      }
    },
    stats() {
      let triangles = 0;
      let trees = 0;
      for (const { group } of meshes.values()) {
        for (const child of group.children as THREE.Mesh[]) {
          triangles += trianglesOf(child);
          if (child instanceof THREE.InstancedMesh) trees += child.count;
        }
      }
      return { meshes: meshes.size, triangles, trees, tilesByLevel: store.countByLevel() };
    },
  };
}
