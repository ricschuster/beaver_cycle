// The glowing circle that marks a worn or broken structure (Q55): a gold ring on the spot that pulses slowly, drawn over
// everything so the water does not hide it. Reads state only.
import * as THREE from 'three';

export interface RepairGlow {
  /** Show the ring at a point, or hide it with null. A broken piece glows brighter than a worn one. */
  set(at: { x: number; y: number; z: number; broken: boolean } | null): void;
}

/** Seconds for one slow pulse. */
const PULSE_SECONDS = 2.4;

export function createRepairGlow(scene: THREE.Scene, radius: number): RepairGlow {
  const material = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.6, depthTest: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.2, radius, 40).rotateX(-Math.PI / 2), material);
  ring.renderOrder = 11;
  ring.visible = false;
  scene.add(ring);
  return {
    set(at) {
      ring.visible = at !== null;
      if (!at) return;
      ring.position.set(at.x, at.y + 0.08, at.z);
      const pulse = 0.5 + 0.5 * Math.sin((performance.now() / 1000) * ((2 * Math.PI) / PULSE_SECONDS));
      material.opacity = (at.broken ? 0.55 : 0.3) + (at.broken ? 0.4 : 0.35) * pulse;
      ring.scale.setScalar(1 + 0.06 * pulse);
    },
  };
}
