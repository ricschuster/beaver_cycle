// The trail of sparkles toward a lone beaver after a hint (`sim/wayToPartner.ts`): a few soft gold twinkles on the ground
// or water ahead of the beaver, in a gentle wave that runs away from it, so the trail reads as "this way". One set of
// points, cheap on a tablet. Reads state only.
import * as THREE from 'three';
import { DOT_COUNT } from '../sim/wayToPartner';
import { sparkleTexture } from './dreamEffects';

export interface WayPointerView {
  /** Show sparkles at these points (none hides them), twinkling by `time` (seconds). */
  set(dots: readonly { x: number; y: number; z: number }[], time: number): void;
}

/** Size of a sparkle (metres), its colour, and how fast the wave runs along the trail (radians a second, and from one to the next). */
const SIZE = 0.7;
const GOLD = new THREE.Color(0xfff0b8);
const WAVE_SPEED = 3;
const WAVE_STEP = 0.8;

export function createWayPointer(scene: THREE.Scene): WayPointerView {
  const pos = new Float32Array(DOT_COUNT * 3);
  const col = new Float32Array(DOT_COUNT * 4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const material = new THREE.PointsMaterial({ size: SIZE, map: sparkleTexture(), vertexColors: true, transparent: true, depthWrite: false });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.visible = false;
  scene.add(points);
  return {
    set(dots, time) {
      points.visible = dots.length > 0;
      if (!points.visible) return;
      const n = Math.min(dots.length, DOT_COUNT);
      for (let i = 0; i < n; i++) {
        const d = dots[i]!;
        // A wave runs out along the trail: each sparkle brightens a moment after the one before it, and bobs a little.
        const wave = 0.5 + 0.5 * Math.sin(time * WAVE_SPEED - i * WAVE_STEP);
        pos.set([d.x, d.y + 0.08 * wave, d.z], i * 3);
        col.set([GOLD.r, GOLD.g, GOLD.b, 0.3 + 0.6 * wave], i * 4);
      }
      geo.setDrawRange(0, n);
      geo.attributes.position!.needsUpdate = true;
      geo.attributes.color!.needsUpdate = true;
    },
  };
}
