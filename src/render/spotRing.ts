// A calm white ring on each free dam spot near the beaver (Q72), so the valley stays quiet far from one. The gold ring
// is for repair (repairGlow.ts), so a free spot looks different. Reads state only.
import * as THREE from 'three';
import { damAt, damWhole, raised, type Dam } from '../sim/dam';
import type { DamSpot } from '../sim/damSpots';

export interface SpotRings {
  /** Take the rings out of the scene. */
  dispose(): void;
  /** Show the rings of the spots within `range` metres of the beaver, hide the rest. A spot with a dam started is green, one with a whole dam has no ring unless it can be raised. */
  update(x: number, z: number, dams?: readonly Dam[], clock?: number): void;
}

/** Ring radius, metres: about half a first dam. */
const RADIUS = 5;
/** The rings show this close to the beaver. */
export const SHOW_RANGE = 120;

export function createSpotRings(scene: THREE.Scene, spots: readonly DamSpot[]): SpotRings {
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthTest: false, side: THREE.DoubleSide });
  const building = material.clone();
  building.color.set(0x8fe08f);
  const geometry = new THREE.RingGeometry(RADIUS - 0.25, RADIUS, 40).rotateX(-Math.PI / 2);
  const rings = spots.map((s) => {
    const ring = new THREE.Mesh(geometry, material);
    ring.renderOrder = 10;
    ring.visible = false;
    ring.position.set(s.bed.x, s.bedY + 0.6, s.bed.z);
    scene.add(ring);
    return { spot: s, ring };
  });
  return {
    dispose() {
      for (const { ring } of rings) ring.removeFromParent();
      material.dispose();
      building.dispose();
      geometry.dispose();
    },
    update(x, z, dams = [], clock = 0) {
      for (const { spot, ring } of rings) {
        const dam = damAt(dams, spot);
        ring.visible = Math.hypot(spot.bed.x - x, spot.bed.z - z) <= SHOW_RANGE && (!damWhole(dam) || !!raised(dam, spot, clock));
        ring.material = dam ? building : material;
      }
    },
  };
}
