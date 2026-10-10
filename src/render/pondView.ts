// Draws the ponds of the sim: flat water at the pond level, cut where the ground rises through it, in the lake's look,
// season by season, with ice in the shallows in winter (waterLook.ts). Each ground triangle next to a flooded point is
// clipped to the part below the level, as the lake is, and to the upstream side of the dam wall, so the water ends in a
// straight line at the dam and not in the steps of the pond grid. The ground does not change (design note 20). Reads
// state only.
import * as THREE from 'three';
import type { DamSpot } from '../sim/damSpots';
import { POND_CELL, type Pond } from '../sim/pond';
import type { SeasonLook } from './seasonLook';
import { createWaterLook } from './waterLook';

export interface PondView {
  /** Draw the ponds, each cut at the wall of its dam spot. Rebuilds only when a pond's level or extent changes. */
  update(ponds: readonly Pond[], spots: readonly DamSpot[]): void;
  /** Sets the water colour and the ice for a season, as the lake's. */
  setSeason(look: SeasonLook): void;
}

/**
 * The water of one pond as a mesh geometry, or null when nothing is below the level next to a flooded point. Each vertex
 * keeps the depth of the water over the ground in a `waterDepth` attribute (0 on the shoreline), for the ice.
 */
export function buildPondGeometry(pond: Pond, spot?: Pick<DamSpot, 'bed' | 'flow'>): THREE.BufferGeometry | null {
  const { n, x0, z0, heights: h, flooded, level } = pond;
  const pos: number[] = [];
  const depth: number[] = [];
  const clipped: [number, number, number][] = [];
  const cut: [number, number, number][] = [];
  // How far upstream of the dam wall a point is: the wall runs across the flow through the bed point (damView.ts).
  const up = (x: number, z: number): number => (spot ? -((x - spot.bed.x) * spot.flow.x + (z - spot.bed.z) * spot.flow.z) : 1);
  const clip = (tri: [number, number, number][]): void => {
    clipped.length = 0;
    for (let k = 0; k < 3; k++) {
      const [ax, az, ah] = tri[k]!;
      const [bx, bz, bh] = tri[(k + 1) % 3]!;
      const aIn = ah <= level;
      if (aIn) clipped.push([ax, az, level - ah]);
      if (aIn !== bh <= level) {
        const t = (level - ah) / (bh - ah);
        clipped.push([ax + (bx - ax) * t, az + (bz - az) * t, 0]);
      }
    }
    // Then keep the part upstream of the wall. The wall is a straight line, so the cut is exact.
    cut.length = 0;
    for (let k = 0; k < clipped.length; k++) {
      const a = clipped[k]!;
      const b = clipped[(k + 1) % clipped.length]!;
      const ua = up(a[0], a[1]);
      const ub = up(b[0], b[1]);
      if (ua >= 0) cut.push(a);
      if (ua >= 0 !== ub >= 0) {
        const t = ua / (ua - ub);
        cut.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
      }
    }
    for (let k = 1; k + 1 < cut.length; k++) {
      for (const [x, z, d] of [cut[0]!, cut[k]!, cut[k + 1]!]) {
        pos.push(x, level, z);
        depth.push(d);
      }
    }
  };
  for (let j = 0; j + 1 < n; j++) {
    for (let i = 0; i + 1 < n; i++) {
      if (!(flooded[j * n + i] || flooded[j * n + i + 1] || flooded[(j + 1) * n + i] || flooded[(j + 1) * n + i + 1])) continue;
      const x = x0 + i * POND_CELL;
      const z = z0 + j * POND_CELL;
      const a: [number, number, number] = [x, z, h[j * n + i]!];
      const b: [number, number, number] = [x + POND_CELL, z, h[j * n + i + 1]!];
      const c: [number, number, number] = [x, z + POND_CELL, h[(j + 1) * n + i]!];
      const d: [number, number, number] = [x + POND_CELL, z + POND_CELL, h[(j + 1) * n + i + 1]!];
      clip([a, c, b]); // the same split as the ground mesh
      clip([b, c, d]);
    }
  }
  if (pos.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(pos), 3));
  geo.setAttribute('waterDepth', new THREE.BufferAttribute(Float32Array.from(depth), 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export function createPondView(scene: THREE.Scene, prepare: (m: THREE.Material) => void): PondView {
  const material = new THREE.MeshLambertMaterial({
    color: 0x3b8fb0,
    transparent: true,
    opacity: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  prepare(material);
  const waterLook = createWaterLook();
  waterLook.apply(material);
  const root = new THREE.Group();
  scene.add(root);
  let shown: readonly Pond[] | null = null;
  return {
    update(ponds, spots) {
      if (shown === ponds) return;
      shown = ponds;
      for (const m of root.children) (m as THREE.Mesh).geometry.dispose();
      root.clear();
      for (const pond of ponds) {
        const geo = buildPondGeometry(pond, spots.find((s) => s.id === pond.spot));
        if (geo) root.add(new THREE.Mesh(geo, material));
      }
    },
    setSeason(look) {
      waterLook.setSeason(look);
    },
  };
}
