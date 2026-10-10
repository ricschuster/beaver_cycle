// Draws the loaded tiles. Reads the tile store and the streamer's wishes, never
// changes them. One mesh per tile, rebuilt when the level it shows changes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CLASS_LAKE, LEVEL_FINE, type DecodedTile, type TileWater } from '../terrain/format';
import type { TreeRef, Trunk } from '../sim/trees';
import { BROADLEAF_SHAPE, KIND_BROADLEAF, placeTrees, TREE_FLOATS, TREE_SHAPE, TreeGrid, treeIdPosition } from '../terrain/trees';
import { distToTile, shownLevel, type Streamer } from '../terrain/streamer';
import { tileKey, type TileStore } from '../terrain/store';
import { timed } from '../terrain/buildTimes';
import type { SeasonLook, Tint } from './seasonLook';

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
/** Which seasonal tint a ground class takes: [grass, forest]. Rock and lake bed keep their colour all year. */
const SEASON_WEIGHT: Record<number, [number, number]> = {
  0: [1, 0],
  1: [1, 0],
  2: [0, 1],
  3: [1, 0],
  5: [1, 0],
};
const NO_WEIGHT: [number, number] = [0, 0];
const COLORS = new Map(Object.entries(CLASS_COLORS).map(([k, v]) => [Number(k), new THREE.Color(v)]));

/** Metres a skirt hangs per metre of cell size, to hide gaps between levels. */
const SKIRT_PER_CELL = 1;
/** Milliseconds per frame spent building tile meshes. At least one is always built. */
const BUILD_BUDGET_MS = 4;

/** Far backdrop tiles are merged into chunks of this many tiles per side, one draw call each. */
export const FAR_CHUNK = 8;

/** Key of the far chunk a tile belongs to. */
export function farChunkKey(tx: number, tz: number): string {
  return `${Math.floor(tx / FAR_CHUNK)},${Math.floor(tz / FAR_CHUNK)}`;
}

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
  const weight = new Float32Array(total * 2);
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
      let r = 0, g = 0, b = 0, wg = 0, wf = 0, count = 0;
      for (let cj = j - 1; cj <= j; cj++) {
        for (let ci = i - 1; ci <= i; ci++) {
          if (ci < 0 || cj < 0 || ci >= n || cj >= n) continue;
          const c = COLORS.get(classes[cj * n + ci]!) ?? FALLBACK;
          const [sg, sf] = SEASON_WEIGHT[classes[cj * n + ci]!] ?? NO_WEIGHT;
          r += c.r; g += c.g; b += c.b; wg += sg; wf += sf; count++;
        }
      }
      col.set([r / count, g / count, b / count], v * 3);
      weight.set([wg / count, wf / count], v * 2);
    }
  }
  edge.forEach((v, k) => {
    const s = nv + k;
    pos.set([pos[v * 3]!, pos[v * 3 + 1]! - drop, pos[v * 3 + 2]!], s * 3);
    nor.copyWithin(s * 3, v * 3, v * 3 + 3);
    col.copyWithin(s * 3, v * 3, v * 3 + 3);
    weight.copyWithin(s * 2, v * 2, v * 2 + 2);
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
  geo.setAttribute('seasonWeight', new THREE.BufferAttribute(weight, 2));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Flat water at the lake level, cut where the ground rises through it. It covers
 * the lake cells and their neighbours, and each ground triangle is clipped to the
 * part below the level, so the shoreline follows the terrain rather than whole
 * cells. Null when the tile has no lake cells.
 */
export function buildLakeGeometry(tile: DecodedTile, size: number, level: number): THREE.BufferGeometry | null {
  const { n, classes, heights: h } = tile;
  const w = n + 1;
  const cell = size / n;
  const near = (i: number, j: number): boolean => {
    for (let cj = Math.max(j - 1, 0); cj <= Math.min(j + 1, n - 1); cj++) {
      for (let ci = Math.max(i - 1, 0); ci <= Math.min(i + 1, n - 1); ci++) {
        if (classes[cj * n + ci] === CLASS_LAKE) return true;
      }
    }
    return false;
  };
  const pos: number[] = [];
  const clipped: [number, number][] = [];
  /** Emits the part of a ground triangle that lies below the level, as a fan. */
  const clip = (tri: [number, number, number][]): void => {
    clipped.length = 0;
    for (let k = 0; k < 3; k++) {
      const [ax, az, ah] = tri[k]!;
      const [bx, bz, bh] = tri[(k + 1) % 3]!;
      const aIn = ah <= level;
      if (aIn) clipped.push([ax, az]);
      if (aIn !== bh <= level) {
        const t = (level - ah) / (bh - ah);
        clipped.push([ax + (bx - ax) * t, az + (bz - az) * t]);
      }
    }
    for (let k = 1; k + 1 < clipped.length; k++) {
      for (const [x, z] of [clipped[0]!, clipped[k]!, clipped[k + 1]!]) pos.push(x, level, z);
    }
  };
  let any = false;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (classes[j * n + i] === CLASS_LAKE) any = true;
      else if (!near(i, j)) continue;
      const x = tile.tx * size + i * cell;
      const z = tile.tz * size + j * cell;
      const a: [number, number, number] = [x, z, h[j * w + i]!];
      const b: [number, number, number] = [x + cell, z, h[j * w + i + 1]!];
      const c: [number, number, number] = [x, z + cell, h[(j + 1) * w + i]!];
      const d: [number, number, number] = [x + cell, z + cell, h[(j + 1) * w + i + 1]!];
      clip([a, c, b]); // the same split as the ground mesh
      clip([b, c, d]);
    }
  }
  if (!any || pos.length === 0) return null;
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

// Trees are shared geometry, one per level and kind, never disposed. Level 2 has none.
const CONIFER_GEOMETRY = [
  new THREE.ConeGeometry(TREE_SHAPE[0]!.radius, TREE_SHAPE[0]!.height, 6, 1, true).translate(0, 4, 0),
  new THREE.ConeGeometry(TREE_SHAPE[1]!.radius, TREE_SHAPE[1]!.height, 4, 1, true).translate(0, 4.5, 0),
];

/**
 * A low crown on a short trunk with a few bare branches. The crown is white and the trunk dark in the vertex
 * colours, so the season's leaf colour (the material colour) tints the crown fully and the wood only a little.
 * The `crown` attribute is 1 and the crown's centre height for crown vertices, so the shader can shrink the
 * crown away in winter, and 0 for the wood.
 */
function broadleafGeometry(level: number): THREE.BufferGeometry {
  const { radius, centre } = BROADLEAF_SHAPE[level]!;
  const crown = new THREE.OctahedronGeometry(radius, 0).scale(1, 0.85, 1).translate(0, centre, 0);
  const wood: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.3, 0.45, centre, 4, 1, true).translate(0, centre / 2, 0).toNonIndexed()];
  // Three thin branches from the top of the trunk, leaning out in different directions.
  for (let k = 0; k < 3; k++) {
    const length = radius * 1.1;
    const branch = new THREE.CylinderGeometry(0.05, 0.16, length, 3, 1, true).translate(0, length / 2, 0).toNonIndexed();
    branch.rotateZ(-0.75).rotateY((k * Math.PI * 2) / 3 + 0.4).translate(0, centre * 0.55, 0);
    wood.push(branch);
  }
  const paint = (g: THREE.BufferGeometry, grey: number, isCrown: number): void => {
    const n = g.getAttribute('position').count;
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(grey), 3));
    const info = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      info[i * 2] = isCrown;
      info[i * 2 + 1] = centre;
    }
    g.setAttribute('crown', new THREE.BufferAttribute(info, 2));
  };
  paint(crown, 1, 1);
  wood.forEach((g) => paint(g, 0.3, 0));
  const merged = mergeGeometries([crown, ...wood]);
  crown.dispose();
  wood.forEach((g) => g.dispose());
  return merged;
}
const BROADLEAF_GEOMETRY = [broadleafGeometry(0), broadleafGeometry(1)];

function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, trees: number[], depth?: THREE.Material) {
  const count = trees.length / TREE_FLOATS;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.castShadow = true;
  if (depth) mesh.customDepthMaterial = depth;
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

function buildTrees(
  tile: DecodedTile,
  size: number,
  materials: { conifer: THREE.Material; broadleaf: THREE.Material; broadleafDepth: THREE.Material },
  felled: ReadonlySet<string>,
): { meshes: THREE.InstancedMesh[]; grid: TreeGrid } | null {
  const shown = tile.level === LEVEL_FINE ? 0 : tile.level;
  const conifers = CONIFER_GEOMETRY[shown];
  const trees = conifers ? placeTrees(tile, size, felled) : new Float32Array(0);
  if (!conifers || trees.length === 0) return null;
  const conifer: number[] = [];
  const broadleaf: number[] = [];
  for (let o = 0; o < trees.length; o += TREE_FLOATS) {
    (trees[o + 4] === KIND_BROADLEAF ? broadleaf : conifer).push(...trees.subarray(o, o + TREE_FLOATS));
  }
  const meshes: THREE.InstancedMesh[] = [];
  if (conifer.length > 0) meshes.push(instanced(conifers, materials.conifer, conifer));
  if (broadleaf.length > 0) meshes.push(instanced(BROADLEAF_GEOMETRY[shown]!, materials.broadleaf, broadleaf, materials.broadleafDepth));
  return { meshes, grid: new TreeGrid(trees, shown) };
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
  /** True when a point is inside a drawn tree, grown by `margin` metres. */
  insideTree(x: number, y: number, z: number, margin: number): boolean;
  /** Appends x, y, z, scale of the drawn broadleaf trees within `radius` metres of a point (four numbers per tree). */
  broadleafNear(x: number, z: number, radius: number, out: number[]): void;
  /** The nearest standing tree within `reach` metres of a point, for chopping. Only the near, detailed trees count. */
  nearestTree(x: number, z: number, reach: number, felled: ReadonlySet<string>): TreeRef | null;
  /** Trunks of the standing trees within `reach` metres of a point, for walking into. */
  trunksNear(x: number, z: number, reach: number, felled: ReadonlySet<string>): Trunk[];
  /** Tells the view which trees are felled, given in the order they fell. Tiles that had one are rebuilt without it. */
  setFelled(ids: readonly string[]): void;
  stats(): TerrainStats;
  /** Sets the seasonal ground and tree colours. Cheap, so it can be called every frame. */
  setSeason(look: SeasonLook): void;
}

export function createTerrainView(
  scene: THREE.Scene,
  store: TileStore,
  streamer: Streamer,
  /** Called once for each material that should take part in the shadows. */
  prepareMaterial: (material: THREE.Material) => void = () => {},
): TerrainView {
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
  const leafMaterial = new THREE.MeshLambertMaterial({ color: 0x3f7a35, vertexColors: true });
  prepareMaterial(material);
  prepareMaterial(treeMaterial);
  prepareMaterial(leafMaterial);
  // Broadleaf crowns shrink to nothing as the foliage goes, in the colour pass and in the shadow pass alike.
  const foliage = { value: 1 };
  const leafDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  const addFoliage = (material: THREE.Material): void => {
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      shader.uniforms.foliage = foliage;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 crown;\nuniform float foliage;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          transformed = mix(vec3(0.0, crown.y, 0.0), transformed, mix(1.0, foliage, crown.x));`,
        );
    };
  };
  addFoliage(leafMaterial);
  addFoliage(leafDepthMaterial);
  // Pull the baked ground colours towards the season's colours, by the weights in the geometry.
  const grassTint = { value: new THREE.Vector4() };
  const forestTint = { value: new THREE.Vector4() };
  const shadowHook = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    shadowHook.call(material, shader, renderer);
    shader.uniforms.grassTint = grassTint;
    shader.uniforms.forestTint = forestTint;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 seasonWeight;\nuniform vec4 grassTint;\nuniform vec4 forestTint;')
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        #ifdef USE_COLOR
        vColor.rgb = mix(vColor.rgb, grassTint.rgb, grassTint.a * seasonWeight.x);
        vColor.rgb = mix(vColor.rgb, forestTint.rgb, forestTint.a * seasonWeight.y);
        #endif`,
      );
  };
  const tint = new THREE.Color();
  const setTint = (uniform: { value: THREE.Vector4 }, t: Tint): void => {
    tint.set(t.color);
    uniform.value.set(tint.r, tint.g, tint.b, t.amount);
  };
  const meshes = new Map<string, { group: THREE.Group; level: number; streams: boolean; grid: TreeGrid | null }>();
  const size = store.size;
  // Felled trees are left out when a tile's trees are placed; a tile that lost one is rebuilt.
  const felledIds = new Set<string>();
  const dirty = new Set<string>();
  // The far backdrop never changes level, so its tiles are merged into a mesh per chunk,
  // rebuilt when more of the chunk has loaded. This is a few hundred draw calls fewer.
  const farChunks = new Map<string, { mesh: THREE.Mesh | null; built: number; tiles: { tx: number; tz: number }[] }>();
  for (const t of store.index.tiles) {
    if (!t.far) continue;
    const key = farChunkKey(t.tx, t.tz);
    const chunk = farChunks.get(key) ?? { mesh: null, built: 0, tiles: [] };
    chunk.tiles.push({ tx: t.tx, tz: t.tz });
    farChunks.set(key, chunk);
  }

  function updateFar(): void {
    const start = performance.now();
    for (const chunk of farChunks.values()) {
      const loaded = chunk.tiles.filter((t) => store.has(t.tx, t.tz, 2));
      if (loaded.length === chunk.built) continue;
      const geos = loaded.map((t) => buildTileGeometry(store.get(t.tx, t.tz, 2)!, size));
      const merged = mergeGeometries(geos);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      if (chunk.mesh) {
        scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
      }
      chunk.mesh = new THREE.Mesh(merged, material);
      scene.add(chunk.mesh);
      chunk.built = loaded.length;
      if (performance.now() - start > BUILD_BUDGET_MS) break;
    }
  }

  return {
    update(x, z) {
      updateFar();
      const todo: { tx: number; tz: number; level: number; dist: number }[] = [];
      for (const t of store.index.tiles) {
        if (t.far) continue;
        const fineOn = streamer.wantsFine(t.tx, t.tz) && store.has(t.tx, t.tz, LEVEL_FINE);
        const level = fineOn ? LEVEL_FINE : shownLevel(streamer.desiredLevel(t.tx, t.tz), (l) => store.has(t.tx, t.tz, l));
        if (level === undefined) continue;
        const shown = meshes.get(tileKey(t.tx, t.tz));
        const wantsStreams = level !== 2 && store.waterOf(t.tx, t.tz) !== undefined;
        if (shown && shown.level === level && shown.streams === wantsStreams && !dirty.has(tileKey(t.tx, t.tz))) continue;
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
        const ground = own(new THREE.Mesh(timed('ground', job.level, () => buildTileGeometry(tile, size)), material));
        // Near tiles take and throw shadows; the far rings (level 2) are too far to matter.
        ground.castShadow = ground.receiveShadow = job.level !== 2;
        group.add(ground);
        const lakeLevel = store.tileInfo(job.tx, job.tz)?.lakeLevel_m;
        const lake = lakeLevel == null || job.level === 2 ? null : timed('lake', job.level, () => buildLakeGeometry(tile, size, lakeLevel));
        if (lake) group.add(own(new THREE.Mesh(lake, lakeMaterial)));
        const water = store.waterOf(job.tx, job.tz);
        const streams = job.level !== 2 && water ? timed('streams', job.level, () => buildStreamGeometry(water, (x, z) => store.heightAt(x, z))) : null;
        if (streams) group.add(own(new THREE.Mesh(streams, streamMaterial)));
        const trees = timed('trees', job.level, () => buildTrees(tile, size, { conifer: treeMaterial, broadleaf: leafMaterial, broadleafDepth: leafDepthMaterial }, felledIds));
        if (trees) group.add(...trees.meshes);
        scene.add(group);
        dirty.delete(key);
        meshes.set(key, { group, level: job.level, streams: job.level !== 2 && water !== undefined, grid: trees?.grid ?? null });
        if (performance.now() - start > BUILD_BUDGET_MS) break;
      }
    },
    setSeason(look) {
      setTint(grassTint, look.grass);
      setTint(forestTint, look.forest);
      treeMaterial.color.set(look.tree);
      leafMaterial.color.set(look.leaf);
      foliage.value = look.foliage;
    },
    insideTree(x, y, z, margin) {
      return meshes.get(tileKey(Math.floor(x / size), Math.floor(z / size)))?.grid?.hit(x, y, z, margin) ?? false;
    },
    broadleafNear(x, z, radius, out) {
      const tx = Math.floor(x / size);
      const tz = Math.floor(z / size);
      for (let i = tx - 1; i <= tx + 1; i++) {
        for (let j = tz - 1; j <= tz + 1; j++) meshes.get(tileKey(i, j))?.grid?.broadleafNear(x, z, radius, out);
      }
    },
    nearestTree(x, z, reach, felled) {
      const tx = Math.floor(x / size);
      const tz = Math.floor(z / size);
      let best: TreeRef | null = null;
      let bestDist = reach;
      for (let i = tx - 1; i <= tx + 1; i++) {
        for (let j = tz - 1; j <= tz + 1; j++) {
          const t = meshes.get(tileKey(i, j))?.grid?.nearest(x, z, bestDist, felled);
          if (!t) continue;
          best = t;
          bestDist = Math.hypot(t.x - x, t.z - z);
        }
      }
      return best;
    },
    trunksNear(x, z, reach, felled) {
      const out: Trunk[] = [];
      const tx = Math.floor(x / size);
      const tz = Math.floor(z / size);
      for (let i = tx - 1; i <= tx + 1; i++) {
        for (let j = tz - 1; j <= tz + 1; j++) meshes.get(tileKey(i, j))?.grid?.trunksNear(x, z, reach, felled, out);
      }
      return out;
    },
    setFelled(ids) {
      if (ids.length < felledIds.size) {
        felledIds.clear();
        for (const key of meshes.keys()) dirty.add(key);
      }
      for (let i = felledIds.size; i < ids.length; i++) {
        const id = ids[i]!;
        felledIds.add(id);
        const at = treeIdPosition(id);
        dirty.add(tileKey(Math.floor(at.x / size), Math.floor(at.z / size)));
      }
    },
    stats() {
      let triangles = 0;
      let trees = 0;
      let drawn = meshes.size;
      for (const { mesh } of farChunks.values()) {
        if (!mesh) continue;
        drawn++;
        triangles += trianglesOf(mesh);
      }
      for (const { group } of meshes.values()) {
        for (const child of group.children as THREE.Mesh[]) {
          triangles += trianglesOf(child);
          if (child instanceof THREE.InstancedMesh) trees += child.count;
        }
      }
      return { meshes: drawn, triangles, trees, tilesByLevel: store.countByLevel() };
    },
  };
}
