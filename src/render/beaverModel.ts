// A simple beaver built from three.js shapes, until the model pipeline exists.
// Origin at the feet, facing +z, about one metre long without the tail. Parts
// that later poses move (tail, legs) sit in their own groups.
import * as THREE from 'three';
import type { BeaverMode } from '../sim/state';
import type { Food } from '../sim/food';

/** Coats within beaver browns (Q59), indexed by `coatOf` in the sim. Fur, dark fur for legs and ears, and belly. */
export const COATS = [
  { fur: 0x8b5a2b, dark: 0x5a3a1c, belly: 0xa8794a },
  { fur: 0xa5733d, dark: 0x6e4a26, belly: 0xc29a66 },
  { fur: 0x6e4527, dark: 0x45291a, belly: 0x8c6340 },
  { fur: 0x5b3b22, dark: 0x33200f, belly: 0x7a5736 },
  { fur: 0x9a6a3a, dark: 0x4f3a2a, belly: 0xb88b55 },
] as const;
const TAIL = 0x3b2a1a;
const TEETH = 0xf2ead0;

/** How far a shade of 1 moves a coat toward white (or of -1 toward black). */
const SHADE_STRENGTH = 0.18;

/** Seconds a tail slap takes to play: wind up, slam, settle. */
export const SLAP_DURATION = 0.7;

/** Tail angle (radians, positive lifts the tip) and body dip while slapping, `age` seconds after the press. */
export function slapPose(age: number): { tail: number | null; dip: number } {
  if (age < 0 || age >= SLAP_DURATION) return { tail: null, dip: 0 };
  const WIND = 0.28;
  const SLAM = 0.08;
  const UP = 1.15;
  const DOWN = -0.3;
  if (age < WIND) {
    const t = age / WIND;
    return { tail: UP * (1 - (1 - t) * (1 - t)), dip: -0.05 * t };
  }
  if (age < WIND + SLAM) {
    const t = (age - WIND) / SLAM;
    return { tail: UP + (DOWN - UP) * t, dip: -0.05 + 0.2 * t };
  }
  const t = (age - WIND - SLAM) / (SLAP_DURATION - WIND - SLAM);
  const ease = t * t * (3 - 2 * t);
  return { tail: DOWN * (1 - ease), dip: 0.15 * (1 - ease) };
}

export interface BeaverModel {
  group: THREE.Group;
  /** Change the coat, an index into `COATS`. A new baby has its own colour. */
  setCoat(coat: number, shade?: number): void;
  /**
   * Poses the model. `time` is seconds, `speed01` is 0 standing and 1 at full pace,
   * `mode` picks the pose, `tilt` (-1 rising to 1 sinking) pitches a diver's nose, and
   * `slapAge` is the seconds since a tail slap began, or null, and `carry` is the piece held in the mouth.
   */
  update(time: number, speed01: number, mode?: BeaverMode, tilt?: number, slapAge?: number | null, carry?: Food | 'mud' | 'rock' | null): void;
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

function leg(x: number, z: number, length: number, foot: number, dark: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, length, z);
  g.add(part(new THREE.CapsuleGeometry(0.07, length - 0.14, 4, 8), dark, 0, -length / 2, 0));
  g.add(ellipsoid(0.09, 0.04, foot, dark, 0, -length + 0.04, foot * 0.4));
  return g;
}

export function createBeaverModel(coat = 0): BeaverModel {
  const { fur: FUR, dark: DARK_FUR, belly: BELLY } = COATS[coat % COATS.length]!;
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

  // A piece held crosswise in the teeth, shown only while the mouth is full.
  const branch = new THREE.Group();
  branch.position.set(0, -0.1, 0.25);
  const stick = part(new THREE.CylinderGeometry(0.022, 0.03, 0.8, 6).rotateZ(Math.PI / 2), 0x7a5230, 0, 0, 0);
  branch.add(stick);
  for (const [x, a] of [[-0.18, 0.7], [0.12, -0.8]] as const) {
    const twig = part(new THREE.CylinderGeometry(0.01, 0.015, 0.22, 5), 0x7a5230, x, 0.08, 0);
    twig.rotation.z = a;
    branch.add(twig);
  }
  for (const x of [-0.4, 0.4]) branch.add(ellipsoid(0.09, 0.03, 0.07, 0x5f8a3a, x, 0.02, 0));
  branch.visible = false;
  head.add(branch);
  const lily = new THREE.Group();
  lily.position.set(0, -0.1, 0.27);
  lily.add(part(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 14), 0x4f9a46, 0, 0, 0));
  lily.visible = false;
  head.add(lily);

  // A lump of mud in the paws and teeth, and a grey rock.
  const mud = new THREE.Group();
  mud.position.set(0, -0.12, 0.28);
  mud.add(ellipsoid(0.15, 0.1, 0.13, 0x5a3f28, 0, 0, 0));
  mud.add(ellipsoid(0.07, 0.05, 0.07, 0x6b4c31, 0.07, 0.07, 0.03));
  mud.visible = false;
  head.add(mud);
  const rock = new THREE.Group();
  rock.position.set(0, -0.1, 0.29);
  const stone = part(new THREE.IcosahedronGeometry(0.16, 0), 0x8d8f8c, 0, 0, 0);
  stone.scale.set(1, 0.8, 1);
  rock.add(stone);
  rock.visible = false;
  head.add(rock);

  // Tail: a flat paddle hinged at the rump. Rotate `tail.rotation.x` to slap.
  const tail = new THREE.Group();
  tail.position.set(0, 0.28, -0.5);
  tail.rotation.x = 0.35;
  body.add(tail);
  tail.add(ellipsoid(0.21, 0.03, 0.34, TAIL, 0, 0, -0.32));

  const legs = [leg(-0.17, 0.25, 0.2, 0.1, DARK_FUR), leg(0.17, 0.25, 0.2, 0.1, DARK_FUR), leg(-0.19, -0.3, 0.22, 0.17, DARK_FUR), leg(0.19, -0.3, 0.22, 0.17, DARK_FUR)];
  group.add(...legs);

  // The parts that take the coat's colours, found by their colour, so setCoat can paint them again.
  const painted: Record<'fur' | 'dark' | 'belly', THREE.MeshLambertMaterial[]> = { fur: [], dark: [], belly: [] };
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const hex = o.material.color.getHex();
    if (hex === FUR) painted.fur.push(o.material);
    else if (hex === DARK_FUR) painted.dark.push(o.material);
    else if (hex === BELLY) painted.belly.push(o.material);
  });

  // 0 walking, 1 swimming or diving. Eases so the pose changes over a fraction of a second.
  let swim = 0;
  let under = 0;
  let pitch = 0;
  let last = 0;

  return {
    group,
    setCoat(index, shade = 0) {
      const c = COATS[index % COATS.length]!;
      // A shade of -1 to 1 makes the whole coat a little darker or lighter, so no two beavers of a coat look the same.
      const tint = (hex: number): THREE.Color => new THREE.Color(hex).lerp(new THREE.Color(shade < 0 ? 0x000000 : 0xffffff), Math.abs(shade) * SHADE_STRENGTH);
      for (const m of painted.fur) m.color.copy(tint(c.fur));
      for (const m of painted.dark) m.color.copy(tint(c.dark));
      for (const m of painted.belly) m.color.copy(tint(c.belly));
    },
    update(time, speed01, mode = 'walk', tilt = 0, slapAge = null, carry = null) {
      branch.visible = carry === 'branch';
      lily.visible = carry === 'lily';
      mud.visible = carry === 'mud';
      rock.visible = carry === 'rock';
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
      const slapping = slapAge === null ? null : slapPose(slapAge);
      body.rotation.x = -0.12 * swim * speed01 * (1 - under) + pitch * 0.9 * under + (slapping?.dip ?? 0);
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
      tail.rotation.x = slapping?.tail ?? walkTail * (1 - swim) + -0.05 * swim;
      tail.rotation.y = Math.sin(time * 2.5) * 0.25 * swim * speed01;
    },
  };
}
