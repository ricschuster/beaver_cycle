// A simple beaver built from three.js shapes, until the model pipeline exists.
// Origin at the feet, facing +z, about one metre long without the tail. Parts
// that later poses move (tail, legs) sit in their own groups.
import * as THREE from 'three';
import type { BeaverMode } from '../sim/state';

const FUR = 0x8b5a2b;
const DARK_FUR = 0x5a3a1c;
const BELLY = 0xa8794a;
const TAIL = 0x3b2a1a;
const TEETH = 0xf2ead0;

export interface BeaverModel {
  group: THREE.Group;
  /**
   * Poses the model. `time` is seconds, `speed01` is 0 standing and 1 at full pace,
   * `mode` picks the pose, and `tilt` (-1 rising to 1 sinking) pitches a diver's nose.
   */
  update(time: number, speed01: number, mode?: BeaverMode, tilt?: number): void;
}

function part(geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color }));
  mesh.position.set(x, y, z);
  return mesh;
}

function ellipsoid(rx: number, ry: number, rz: number, color: number, x: number, y: number, z: number): THREE.Mesh {
  const m = part(new THREE.SphereGeometry(1, 16, 12), color, x, y, z);
  m.scale.set(rx, ry, rz);
  return m;
}

function leg(x: number, z: number, length: number, foot: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, length, z);
  g.add(part(new THREE.CapsuleGeometry(0.07, length - 0.14, 4, 8), DARK_FUR, 0, -length / 2, 0));
  g.add(ellipsoid(0.09, 0.04, foot, DARK_FUR, 0, -length + 0.04, foot * 0.4));
  return g;
}

export function createBeaverModel(): BeaverModel {
  const group = new THREE.Group();

  // Everything but the feet rides on the body group so a walk can bob it.
  const body = new THREE.Group();
  group.add(body);
  body.add(ellipsoid(0.3, 0.27, 0.5, FUR, 0, 0.36, -0.05));
  body.add(ellipsoid(0.24, 0.12, 0.4, BELLY, 0, 0.2, 0));

  const head = new THREE.Group();
  head.position.set(0, 0.45, 0.45);
  body.add(head);
  head.add(ellipsoid(0.19, 0.17, 0.2, FUR, 0, 0, 0));
  head.add(ellipsoid(0.1, 0.08, 0.1, FUR, 0, -0.05, 0.17));
  head.add(part(new THREE.SphereGeometry(0.035, 8, 6), 0x1a1210, 0, -0.02, 0.26));
  head.add(part(new THREE.BoxGeometry(0.07, 0.07, 0.015), TEETH, 0, -0.11, 0.22));
  for (const s of [-1, 1]) {
    head.add(part(new THREE.SphereGeometry(0.03, 8, 6), 0x0d0a08, s * 0.11, 0.06, 0.12));
    head.add(ellipsoid(0.05, 0.05, 0.02, DARK_FUR, s * 0.12, 0.17, -0.04));
  }

  // Tail: a flat paddle hinged at the rump. Rotate `tail.rotation.x` to slap.
  const tail = new THREE.Group();
  tail.position.set(0, 0.28, -0.5);
  tail.rotation.x = 0.35;
  body.add(tail);
  tail.add(ellipsoid(0.21, 0.03, 0.34, TAIL, 0, 0, -0.32));

  const legs = [leg(-0.17, 0.25, 0.2, 0.1), leg(0.17, 0.25, 0.2, 0.1), leg(-0.19, -0.3, 0.22, 0.17), leg(0.19, -0.3, 0.22, 0.17)];
  group.add(...legs);

  // 0 walking, 1 swimming or diving. Eases so the pose changes over a fraction of a second.
  let swim = 0;
  let under = 0;
  let pitch = 0;
  let last = 0;

  return {
    group,
    update(time, speed01, mode = 'walk', tilt = 0) {
      const dt = Math.min(Math.max(time - last, 0), 0.1);
      last = time;
      const ease = Math.min(1, dt * 8);
      swim += ((mode === 'walk' ? 0 : 1) - swim) * ease;
      under += ((mode === 'dive' ? 1 : 0) - under) * ease;
      pitch += (tilt - pitch) * Math.min(1, dt * 6);

      const phase = time * (9 + 3 * swim + 2 * under);
      const walkBob = Math.abs(Math.sin(phase)) * 0.03 * speed01;
      // Afloat the body rides low, with a slow bob instead of footfalls.
      const swimBob = Math.sin(time * 3) * 0.015 * (0.4 + 0.6 * speed01);
      body.position.y = walkBob * (1 - swim) + swimBob * swim;
      // Nose down while sinking, up while rising; a diver also kicks harder.
      body.rotation.x = -0.12 * swim * speed01 * (1 - under) + pitch * 0.9 * under;
      head.rotation.x = -0.15 * swim - pitch * 0.35 * under;

      legs.forEach((l, i) => {
        const front = i < 2;
        const swing = Math.sin(phase + (i % 2 === 0 ? 0 : Math.PI) + (front ? 0 : Math.PI));
        const walkAngle = swing * 0.5 * speed01;
        // Swimming: front legs tuck under the chest, back legs trail and kick.
        const swimAngle = front ? 1.3 : 0.9 + swing * (0.7 + 0.3 * under) * (0.3 + 0.7 * speed01);
        l.rotation.x = walkAngle * (1 - swim) + swimAngle * swim;
      });

      const walkTail = 0.35 + Math.sin(phase * 0.5) * 0.05 * speed01;
      tail.rotation.x = walkTail * (1 - swim) + -0.05 * swim;
      tail.rotation.y = Math.sin(time * 2.5) * 0.25 * swim * speed01;
    },
  };
}
