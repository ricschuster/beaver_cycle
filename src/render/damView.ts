// Draws the dams of the sim as plain piles at their spots: sticks laid across the stream, mud mounds and rocks on top, as
// many of each as have been placed. No pond yet. Reads state only.
import * as THREE from 'three';
import { LEVEL1_COST, type Dam } from '../sim/dam';
import type { DamSpot } from '../sim/damSpots';

export interface DamView {
  /** Draw the dams at their spots. Rebuilds only when what has been placed changes. */
  update(dams: readonly Dam[], spots: readonly DamSpot[], heightAt: (x: number, z: number) => number): void;
}

/** A stick is this long (metres) and lies along the dam line. */
const STICK = 2.6;
const ROW = 4;
const SPACING = 1.8;

export function createDamView(scene: THREE.Scene, shadows: boolean, prepare: (m: THREE.Material) => void): DamView {
  const wood = new THREE.MeshLambertMaterial({ color: 0x7a5230, flatShading: true });
  const mud = new THREE.MeshLambertMaterial({ color: 0x5a3f28, flatShading: true });
  const stone = new THREE.MeshLambertMaterial({ color: 0x8d8f8c, flatShading: true });
  for (const m of [wood, mud, stone]) prepare(m);
  const stickGeometry = new THREE.CylinderGeometry(0.14, 0.17, STICK, 6).rotateZ(Math.PI / 2);
  const moundGeometry = new THREE.SphereGeometry(0.8, 10, 6);
  const rockGeometry = new THREE.IcosahedronGeometry(0.5, 0);
  const root = new THREE.Group();
  scene.add(root);
  let shown = '';
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh => {
    const o = new THREE.Mesh(g, m);
    o.castShadow = shadows;
    o.receiveShadow = shadows;
    return o;
  };
  return {
    update(dams, spots, heightAt) {
      const key = dams.map((d) => `${d.spot}:${d.wood}:${d.mud}:${d.rock}`).join('|');
      if (key === shown) return;
      shown = key;
      root.clear();
      for (const dam of dams) {
        const spot = spots.find((s) => s.id === dam.spot);
        if (!spot) continue;
        // The dam line runs across the stream; `lateral` points along it.
        const lateral = { x: -spot.flow.z, z: spot.flow.x };
        const base = heightAt(spot.bed.x, spot.bed.z);
        const group = new THREE.Group();
        group.position.set(spot.bed.x, base, spot.bed.z);
        group.rotation.y = Math.atan2(-lateral.z, lateral.x);
        const sticks = Math.min(dam.wood, LEVEL1_COST.wood);
        for (let i = 0; i < sticks; i++) {
          const o = mesh(stickGeometry, wood);
          o.position.set(((i % ROW) - (ROW - 1) / 2) * SPACING + (Math.floor(i / ROW) % 2) * 0.6, 0.17 + Math.floor(i / ROW) * 0.3, ((i * 7) % 3) * 0.08);
          o.rotation.y = ((i * 5) % 7) * 0.03 - 0.1;
          group.add(o);
        }
        for (let i = 0; i < dam.mud; i++) {
          const o = mesh(moundGeometry, mud);
          o.position.set(((i % ROW) - (ROW - 1) / 2) * SPACING, 0.4, 0.35);
          o.scale.set(1.2, 0.5, 1.1);
          group.add(o);
        }
        for (let i = 0; i < dam.rock; i++) {
          const o = mesh(rockGeometry, stone);
          o.position.set((i - 0.5) * 3.2, 0.75, -0.3);
          o.rotation.set(i, i * 2, 0);
          group.add(o);
        }
        root.add(group);
      }
    },
  };
}
