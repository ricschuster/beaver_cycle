// Renders each prop view (lodge, dam, logs, rocks, food store, lily pads) in a cell of its own, with a hemisphere and a
// sun light, and writes the draw calls and triangles of each cell under it and to `window.propStats`. A tool for the art
// pass (#105), not the game: `npx vite --port 5202` and open /tools/prop-preview/, or run `node tools/prop-preview/shoot.mjs`.
import * as THREE from 'three';
import { createLodgeView } from '../../src/render/lodgeView';
import { createDamView } from '../../src/render/damView';
import { createLogView } from '../../src/render/logView';
import { createRockView } from '../../src/render/rockView';
import { createStoreView } from '../../src/render/storeView';
import { createLilyView } from '../../src/render/lilyView';
import { LODGE_WOOD, type Lodge } from '../../src/sim/lodge';
import { floodPond, crestOf } from '../../src/sim/pond';
import type { Dam } from '../../src/sim/dam';
import type { DamSpot } from '../../src/sim/damSpots';
import type { Log } from '../../src/sim/logs';
import type { Terrain } from '../../src/sim/terrain';
import type { Stock } from '../../src/sim/food';
import { lilyPadsNear } from '../../src/sim/lily';
import { rocksNear } from '../../src/sim/haul';
import { DAY_SECONDS, DAYS_PER_SEASON } from '../../src/sim/clock';

const CELL = 400;
const COLS = 4;
const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.info.autoReset = false;
renderer.setScissorTest(true);
const prepare = (): void => {};

interface Cell {
  name: string;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Objects that are only backdrop (ground, water), not counted. */
  backdrop: THREE.Object3D[];
}

function cell(name: string, eye: [number, number, number], target: [number, number, number]): Cell {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe3d4);
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x5a4a30, 1.4));
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
  sun.position.set(30, 50, 20);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  camera.position.set(...eye);
  camera.lookAt(...target);
  return { name, scene, camera, backdrop: [] };
}

function ground(c: Cell, heightAt: (x: number, z: number) => number, size = 60, color = 0x7fa36b): void {
  const g = new THREE.PlaneGeometry(size, size, 60, 60).rotateX(-Math.PI / 2);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color }));
  c.scene.add(m);
  c.backdrop.push(m);
}

function water(c: Cell, y: number, size = 60): void {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x3f7f9a, transparent: true, opacity: 0.55 }),
  );
  m.position.y = y;
  c.scene.add(m);
  c.backdrop.push(m);
}

const cells: Cell[] = [];

// Lodges: whole, half built, and worn to broken. The water is at 0, the bed at -0.8.
const lodgeAt = (wood: number, level: number, door = 0.6, eye: [number, number, number] = [6.5, 4.2, 7.5], target: [number, number, number] = [0, 0.6, 0], name = `lodge wood ${wood} level ${level}`): Cell => {
  const c = cell(name, eye, target);
  ground(c, () => -0.8);
  water(c, 0);
  const lodge: Lodge = { x: 0, z: 0, base: 0, door, wood };
  createLodgeView(c.scene, false, prepare).update(lodge, level);
  return c;
};
cells.push(lodgeAt(LODGE_WOOD, 1), lodgeAt(LODGE_WOOD / 2, 1), lodgeAt(LODGE_WOOD, 0.1, 2.4));

// The food store, full of branches with lily pads, seen from above with no water so it shows.
{
  const c = cell('store full', [3.2, 3.6, 4.2], [0, 0.3, 0]);
  ground(c, () => 0, 30, 0x6a5a40);
  const lodge: Lodge = { x: 0, z: -3.6, base: 0, door: 0, wood: LODGE_WOOD };
  const stock: Stock = Array.from({ length: 40 }, (_, i) => (i < 28 ? 'branch' : i < 36 ? 'lily' : null));
  createStoreView(c.scene, false, prepare).update(lodge, stock, () => 0, 1);
  cells.push(c);
}

// Dams on a valley along z: a bed at 0 and banks that rise from x = +-5, closed upstream.
const valley: Terrain = {
  heightAt: (x, z) => (Math.abs(x) > 5 ? (Math.abs(x) - 5) * 0.35 : 0) + (z < -30 ? (-30 - z) * 0.3 : 0),
  isWater: () => false,
  waterDepth: () => 0,
};
const spot: DamSpot = { id: 'a', bed: { x: 0, z: 0 }, bedY: 0, flow: { x: 0, z: 1 }, maxCrest: 2, pondM2: 0 };
const damAt = (name: string, dam: Dam, clock = 0, eye: [number, number, number] = [3.5, 3.4, 8.5]): Cell => {
  const c = cell(name, eye, [0, 0.5, 0]);
  ground(c, (x, z) => valley.heightAt(x, z));
  const { wear: _w, ...fresh } = dam;
  const crest = crestOf(fresh);
  const pond = floodPond(valley, spot, crest);
  if (pond) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 30).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x3f7f9a, transparent: true, opacity: 0.55 }),
    );
    m.position.set(0, pond.level, -15);
    c.scene.add(m);
    c.backdrop.push(m);
  }
  createDamView(c.scene, false, prepare).update([dam], [spot], valley.heightAt, clock, pond ? [pond] : []);
  return c;
};
cells.push(
  damAt('dam level 1 whole', { spot: 'a', wood: 8, mud: 4, rock: 2 }),
  damAt('dam level 1 half', { spot: 'a', wood: 4, mud: 1, rock: 0 }),
  damAt('dam level 1 worn', { spot: 'a', wood: 8, mud: 4, rock: 2, wear: { level: 0.2, since: 0, mend: 0 } }),
  damAt('dam level 3 whole', { spot: 'a', wood: 22, mud: 12, rock: 9, level: 3 }),
);

// Logs on the ground: a long one, a short one half stripped, one bare.
{
  const c = cell('logs', [6, 5, 7.5], [0, 0, 0]);
  ground(c, () => 0);
  const log = (id: string, x: number, z: number, heading: number, length: number): Log => ({ id, x, y: 0.35, z, heading, length, floating: false });
  const logs = [log('tree:1', 0, -1.5, 1.3, 7), log('tree:2', -1, 1.2, 0.4, 4), log('tree:3', 2, 1.5, 2.2, 3)];
  createLogView(c.scene, false, prepare).update(logs, { 'tree:2': 2, 'tree:3': 3 });
  cells.push(c);
}

// Rocks on wet ground, with mud, a branch, and a lily pad put down, from afar and up close by the nearest rock.
const wet: Terrain = { heightAt: () => 0, isWater: () => false, waterDepth: () => 0.05 };
const rock = rocksNear(wet, 0, 0, 120).sort((p, q) => Math.hypot(p.x, p.z) - Math.hypot(q.x, q.z))[0] ?? { x: 0, z: 0 };
const rocks = (name: string, eye: [number, number, number], target: [number, number, number]): Cell => {
  const c = cell(name, eye, target);
  ground(c, () => 0, 120, 0x8a8a6a);
  createRockView(c.scene, prepare).update(wet, 0, 0, [], [
    { id: 'm', kind: 'mud', at: 0, x: rock.x + 1.5, z: rock.z + 0.5 },
    { id: 'b', kind: 'branch', at: 0, x: rock.x - 0.4, z: rock.z + 1.6 },
    { id: 'l', kind: 'lily', at: 0, x: rock.x + 0.9, z: rock.z + 1.9 },
  ]);
  return c;
};
cells.push(rocks('rocks', [rock.x + 14, 10, rock.z + 16], [rock.x, 0, rock.z]), rocks('rocks close', [rock.x + 2.2, 1.8, rock.z + 3.8], [rock.x + 0.4, 0, rock.z + 0.8]));

// Lily pads on a bay in summer, from afar and up close.
const summer = (DAYS_PER_SEASON + 2) * DAY_SECONDS;
const pond: Terrain = { heightAt: () => -1, isWater: () => true, waterDepth: () => 1 };
const lilies = (name: string, eye: [number, number, number], target: [number, number, number]): Cell => {
  const c = cell(name, eye, target);
  water(c, 0, 400);
  createLilyView(c.scene, prepare).update(pond, 0, 0, summer, {});
  return c;
};
// Aim at the pad nearest the origin, so the cells show some whatever the patch layout is.
const near = lilyPadsNear(pond, 0, 0, 160, summer).sort((p, q) => Math.hypot(p.x, p.z) - Math.hypot(q.x, q.z))[0] ?? { x: 0, z: 0 };
// And at the nearest pad with a flower (the same rule as lilyView).
const flowered = lilyPadsNear(pond, 0, 0, 160, summer).filter((p) => Math.abs(p.x * 3 + p.z * 5) % 1 < 0.4).sort((p, q) => Math.hypot(p.x, p.z) - Math.hypot(q.x, q.z))[0] ?? near;
cells.push(lilies('lilies', [near.x + 14, 9, near.z + 14], [near.x, 0, near.z]), lilies('lilies close', [near.x + 2.5, 2, near.z + 3], [near.x, 0, near.z]), lilies('lily flower', [flowered.x + 1.4, 1.3, flowered.z + 1.8], [flowered.x, 0.1, flowered.z]));
cells.push(lodgeAt(LODGE_WOOD, 1, 0.6, [3.6, 2.2, 4.2], [0, 1, 0], 'lodge close'), damAt('dam close', { spot: 'a', wood: 8, mud: 4, rock: 2 }, 0, [1.2, 1.6, 4.2]));

/** Meshes and triangles in a scene that would draw with no culling, not counting the backdrop or overlays drawn over everything (rings). */
function count(c: Cell): { meshes: number; triangles: number } {
  let meshes = 0;
  let triangles = 0;
  const shown = (o: THREE.Object3D): boolean => o.visible && (!o.parent || shown(o.parent));
  c.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !shown(o) || c.backdrop.includes(o)) return;
    const m = o.material as THREE.Material;
    if (!m.depthTest) return;
    const g = o.geometry as THREE.BufferGeometry;
    const all = g.index ? g.index.count : g.getAttribute('position').count;
    const n = Math.max(0, Math.min(all - g.drawRange.start, g.drawRange.count));
    const instances = o instanceof THREE.InstancedMesh ? o.count : 1;
    if (instances === 0 || n === 0) return;
    meshes++;
    triangles += (n / 3) * instances;
  });
  return { meshes, triangles };
}

const stats: Record<string, { calls: number; triangles: number; meshes: number; allTriangles: number }> = {};
const labels = document.getElementById('labels')!;
cells.forEach((c, i) => {
  const x = (i % COLS) * CELL;
  const y = Math.floor(i / COLS) * CELL;
  const top = canvas.height - y - CELL;
  renderer.setViewport(x, top, CELL, CELL);
  renderer.setScissor(x, top, CELL, CELL);
  // Count the prop alone, then draw the whole cell.
  for (const b of c.backdrop) b.visible = false;
  renderer.info.reset();
  renderer.render(c.scene, c.camera);
  const all = count(c);
  stats[c.name] = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, meshes: all.meshes, allTriangles: all.triangles };
  for (const b of c.backdrop) b.visible = true;
  renderer.render(c.scene, c.camera);
  const label = document.createElement('div');
  label.textContent = `${c.name}: ${all.meshes} meshes, ${all.triangles} tris`;
  labels.appendChild(label);
});
(window as unknown as { propStats: unknown }).propStats = stats;
