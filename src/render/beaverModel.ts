// A stylized beaver built from three.js shapes, so its parts can be posed in code.
// Origin at the feet, facing +z, about one metre long without the tail. Parts
// that later poses move (tail, legs) sit in their own groups.
import * as THREE from 'three';
import type { BeaverMode } from '../sim/state';
import type { Food } from '../sim/food';
import { SHOT_SECONDS, type ActionKind, type BeaverAction } from './beaverAction';

/** Coats within beaver browns (Q59), indexed by `coatOf` in the sim. Fur, dark fur for legs and ears, and belly. */
export const COATS = [
  { fur: 0x8b5a2b, dark: 0x5a3a1c, belly: 0xa8794a },
  { fur: 0xa5733d, dark: 0x6e4a26, belly: 0xc29a66 },
  { fur: 0x6e4527, dark: 0x45291a, belly: 0x8c6340 },
  { fur: 0x5b3b22, dark: 0x33200f, belly: 0x7a5736 },
  { fur: 0x9a6a3a, dark: 0x4f3a2a, belly: 0xb88b55 },
] as const;
const TAIL = 0x3b2a1a;
/** Beaver teeth are orange, from the iron in them. */
const TEETH = 0xe0904a;
const NOSE = 0x1a1210;
const EYE = 0x0d0a08;

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

/**
 * A pose for an action, as changes from the walking pose. Angles are radians. `sit` rears the body up about the hips
 * (negative lifts the nose), `lean` tips it forward about the feet, `head` nods it down, `turn` turns it, `paws` is the
 * angle of both front legs from the body (negative reaches forward and up, or null leaves them walking), `split` moves
 * the left paw up and the right down by that much, and `tail` is the tail's lift from the ground (null leaves it).
 * `weight` (0 to 1) fades a one-off pose in and out.
 */
export interface ActionPose {
  weight: number;
  sit: number;
  lean: number;
  head: number;
  turn: number;
  paws: number | null;
  split: number;
  tail: number | null;
}

/** The pose for an action `age` seconds after it began. */
export function actionPose(kind: ActionKind, age: number): ActionPose {
  const still = { weight: 1, sit: 0, lean: 0, head: 0, turn: 0, paws: null, split: 0, tail: null };
  // One-off poses fade in over a fifth of a second and out over the last third.
  const fade = (seconds: number): number => smoothstep(0, 0.2, age) * smoothstep(seconds, seconds - 0.3, age);
  switch (kind) {
    case 'gnaw':
      // Up on the hind legs, paws on the trunk, the head working side to side as the teeth bite in.
      return { ...still, sit: -0.35, head: 0.15 + 0.07 * Math.sin(age * 28), turn: 0.2 * Math.sin(age * 2.2), paws: -1.1, tail: -0.2 };
    case 'dig':
      // Nose down at the drift, front paws scraping in turn.
      return { ...still, lean: 0.18, head: 0.35, turn: 0.1 * Math.sin(age * 3), paws: -0.5, split: 0.8 * Math.sin(age * 14), tail: 0.6 };
    case 'drag':
      // Head low, pulling the log along in the teeth.
      return { ...still, lean: 0.1, head: 0.3, tail: 0.15 };
    case 'build':
      // Rear up and pat the piece into place with both paws, twice.
      return { ...still, weight: fade(SHOT_SECONDS.build), sit: -0.3, head: 0.25, paws: -0.95 + 1.05 * (0.5 - 0.5 * Math.cos((age * Math.PI * 2) / 0.55)) };
    case 'eat':
      // Sit up, hold the food in the front paws, and nibble.
      return { ...still, weight: fade(SHOT_SECONDS.eat), sit: -0.75, head: 0.35 + 0.06 * Math.sin(age * 24), turn: 0.1 * Math.sin(age * 1.5), paws: -1.5, tail: -0.15 };
    case 'pick':
      // A quick dip of the head to take something into the mouth.
      return { ...still, weight: Math.sin((Math.PI * Math.min(age, SHOT_SECONDS.pick)) / SHOT_SECONDS.pick), lean: 0.2, head: 0.45 };
    case 'groom':
      // Sit up and comb the face and fur with the front paws.
      return { ...still, weight: fade(SHOT_SECONDS.groom), sit: -0.7, head: 0.4 + 0.1 * Math.sin(age * 3), turn: 0.25 * Math.sin(age * 2), paws: -1.6, split: 0.5 * Math.sin(age * 9), tail: -0.15 };
  }
}

/** The hip the body rears up about when it sits, in the model's frame. */
const HIP = { y: 0.25, z: -0.3 };

export interface BeaverModel {
  group: THREE.Group;
  /** Change the coat, an index into `COATS`. A new baby has its own colour. */
  setCoat(coat: number, shade?: number): void;
  /**
   * Poses the model. `time` is seconds, `speed01` is 0 standing and 1 at full pace,
   * `mode` picks the pose, `tilt` (-1 rising to 1 sinking) pitches a diver's nose,
   * `slapAge` is the seconds since a tail slap began, or null, `carry` is the piece held in the mouth, and `action` is
   * what the beaver is doing (`beaverAction.ts`), or null.
   */
  update(time: number, speed01: number, mode?: BeaverMode, tilt?: number, slapAge?: number | null, carry?: Food | 'mud' | 'rock' | null, action?: BeaverAction | null): void;
}

export function part(geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color }));
  mesh.position.set(x, y, z);
  return mesh;
}

export function ellipsoid(rx: number, ry: number, rz: number, color: number, x: number, y: number, z: number): THREE.Mesh {
  const m = part(new THREE.SphereGeometry(1, 16, 12), color, x, y, z);
  m.scale.set(rx, ry, rz);
  return m;
}

/** A small number from 0 to 1 that is always the same for the same two whole numbers. */
function hash(a: number, b: number): number {
  const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

/** Make a grey pattern texture, `size` texels square, from a brightness (0 to 1) per texel. */
function patternTexture(size: number, repeatU: number, repeatV: number, shade: (x: number, y: number) => number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.round(255 * shade(x, y));
      data.set([v, v, v, 255], (y * size + x) * 4);
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatU, repeatV);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Fur grain: thin streaks of slightly lighter and darker hair that run along the body. Shared by every beaver. */
let furTexture: THREE.DataTexture | null = null;
function furGrain(): THREE.DataTexture {
  furTexture ??= patternTexture(64, 3, 2, (x, y) => {
    const strand = Math.floor((y + hash(x, 7) * 8) / 8);
    return 0.87 + 0.13 * hash(x, strand);
  });
  return furTexture;
}

/** The criss-cross scales on the tail. Shared by every beaver. */
let scaleTexture: THREE.DataTexture | null = null;
function tailScales(): THREE.DataTexture {
  scaleTexture ??= patternTexture(32, 14, 14, (x, y) => {
    const a = (x + y) % 16;
    const b = (x - y + 32) % 16;
    return a < 2 || b < 2 ? 0.6 : 0.95 + 0.05 * hash(x, y);
  });
  return scaleTexture;
}

/** Give a fur part the fur grain. */
function furry(mesh: THREE.Mesh): THREE.Mesh {
  (mesh.material as THREE.MeshLambertMaterial).map = furGrain();
  return mesh;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * The body: a round shape along z from the rump to the neck, higher at the hips than at the
 * shoulders, as a beaver sits hunched. Its colour is in the vertices (fur on top, belly under),
 * which `paint` sets, so the material stays white.
 */
function bodyShape(): { mesh: THREE.Mesh; paint: (fur: THREE.Color, belly: THREE.Color) => void } {
  // Radius (x) along the length (y, later z), rump first.
  const outline = new THREE.SplineCurve([
    new THREE.Vector2(0.0, -0.6),
    new THREE.Vector2(0.15, -0.56),
    new THREE.Vector2(0.25, -0.46),
    new THREE.Vector2(0.31, -0.3),
    new THREE.Vector2(0.31, -0.1),
    new THREE.Vector2(0.27, 0.08),
    new THREE.Vector2(0.21, 0.24),
    new THREE.Vector2(0.17, 0.36),
    new THREE.Vector2(0.12, 0.46),
    new THREE.Vector2(0.0, 0.5),
  ]).getPoints(22);
  const geo = new THREE.LatheGeometry(outline, 18).rotateX(Math.PI / 2);
  // rotateX turned +y into +z, and the lathe's seam faces down, under the belly.
  const pos = geo.attributes.position!;
  const under = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Flatter underneath, and the rump lifted.
    const lift = 0.07 * smoothstep(0.4, -0.35, z);
    pos.setY(i, (y < 0 ? y * 0.78 : y) + lift);
    under[i] = smoothstep(0.02, -0.18, y);
  }
  geo.computeVertexNormals();
  const colors = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
  geo.setAttribute('color', colors);
  const mesh = furry(part(geo, 0xffffff, 0, 0.36, -0.05));
  (mesh.material as THREE.MeshLambertMaterial).vertexColors = true;
  const c = new THREE.Color();
  return {
    mesh,
    paint(fur, belly) {
      for (let i = 0; i < pos.count; i++) {
        c.copy(fur).lerp(belly, under[i]!);
        colors.setXYZ(i, c.r, c.g, c.b);
      }
      colors.needsUpdate = true;
    },
  };
}

/** The tail: a flat paddle, narrow at the rump and round at the tip, lying along -z from its hinge. */
function tailShape(): THREE.Mesh {
  const s = new THREE.Shape();
  s.moveTo(-0.06, 0);
  s.bezierCurveTo(-0.13, 0.06, -0.19, 0.15, -0.19, 0.28);
  s.bezierCurveTo(-0.19, 0.43, -0.08, 0.5, 0, 0.5);
  s.bezierCurveTo(0.08, 0.5, 0.19, 0.43, 0.19, 0.28);
  s.bezierCurveTo(0.19, 0.15, 0.13, 0.06, 0.06, 0);
  s.lineTo(-0.06, 0);
  const depth = 0.03;
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.015, bevelSegments: 2, curveSegments: 10 });
  geo.translate(0, 0, -depth / 2).rotateX(-Math.PI / 2);
  const mesh = part(geo, TAIL, 0, 0, 0);
  (mesh.material as THREE.MeshLambertMaterial).map = tailScales();
  return mesh;
}

/** A webbed hind foot: a fan of five toes, flat on the ground, pointing +z from the heel. */
function webbedFoot(length: number, width: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-width * 0.35, 0);
  s.lineTo(-width * 0.5, length * 0.75);
  for (let t = 0; t < 5; t++) {
    const x0 = -width * 0.5 + (width * t) / 5;
    const x1 = x0 + width / 5;
    s.quadraticCurveTo((x0 + x1) / 2, length * 1.08, x1, length * 0.8);
  }
  s.lineTo(width * 0.35, 0);
  s.quadraticCurveTo(0, -length * 0.12, -width * 0.35, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 4 });
  // Lie flat: the shape's +y runs forward (+z) and the thickness goes up.
  return geo.rotateX(Math.PI / 2).translate(0, 0.035, 0);
}

/** A leg hinged at the hip or shoulder, `length` up from the ground. Hind legs have big webbed feet. */
function leg(x: number, z: number, length: number, hind: boolean, dark: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, length, z);
  g.add(part(new THREE.CapsuleGeometry(hind ? 0.06 : 0.048, length - 0.1, 4, 8), dark, 0, -length / 2, 0));
  if (hind) g.add(part(webbedFoot(0.2, 0.17), dark, 0, -length, -0.04));
  else g.add(ellipsoid(0.065, 0.035, 0.08, dark, 0, -length + 0.035, 0.035));
  return g;
}

export function createBeaverModel(coat = 0): BeaverModel {
  const { fur: FUR, dark: DARK_FUR, belly: BELLY } = COATS[coat % COATS.length]!;
  const group = new THREE.Group();

  // Everything but the feet rides on the body group so a walk can bob it.
  const body = new THREE.Group();
  group.add(body);
  const torso = bodyShape();
  body.add(torso.mesh);
  // Haunches over the hind legs.
  for (const s of [-1, 1]) body.add(furry(ellipsoid(0.1, 0.15, 0.17, FUR, s * 0.21, 0.36, -0.3)));

  const head = new THREE.Group();
  head.position.set(0, 0.5, 0.5);
  body.add(head);
  head.add(furry(ellipsoid(0.19, 0.165, 0.19, FUR, 0, 0.02, 0)));
  for (const s of [-1, 1]) {
    // Round cheeks, a small round ear, and a dark eye with a glint.
    head.add(furry(ellipsoid(0.095, 0.09, 0.095, FUR, s * 0.08, -0.04, 0.11)));
    head.add(ellipsoid(0.048, 0.048, 0.025, DARK_FUR, s * 0.135, 0.14, -0.05));
    head.add(part(new THREE.SphereGeometry(0.028, 10, 8), EYE, s * 0.108, 0.065, 0.135));
    head.add(part(new THREE.SphereGeometry(0.008, 6, 4), 0xffffff, s * 0.106, 0.077, 0.16));
  }
  head.add(ellipsoid(0.09, 0.068, 0.085, BELLY, 0, -0.06, 0.18));
  head.add(ellipsoid(0.045, 0.028, 0.03, NOSE, 0, -0.01, 0.262));
  for (const s of [-1, 1]) head.add(part(new THREE.BoxGeometry(0.03, 0.065, 0.015), TEETH, s * 0.017, -0.122, 0.228));

  // A piece held crosswise in the teeth, shown only while the mouth is full.
  const branch = new THREE.Group();
  branch.position.set(0, -0.12, 0.25);
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
  lily.position.set(0, -0.12, 0.27);
  lily.add(part(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 14), 0x4f9a46, 0, 0, 0));
  lily.visible = false;
  head.add(lily);

  // A lump of mud in the paws and teeth, and a grey rock.
  const mud = new THREE.Group();
  mud.position.set(0, -0.14, 0.28);
  mud.add(ellipsoid(0.15, 0.1, 0.13, 0x5a3f28, 0, 0, 0));
  mud.add(ellipsoid(0.07, 0.05, 0.07, 0x6b4c31, 0.07, 0.07, 0.03));
  mud.visible = false;
  head.add(mud);
  const rock = new THREE.Group();
  rock.position.set(0, -0.12, 0.29);
  const stone = part(new THREE.IcosahedronGeometry(0.16, 0), 0x8d8f8c, 0, 0, 0);
  stone.scale.set(1, 0.8, 1);
  rock.add(stone);
  rock.visible = false;
  head.add(rock);

  // Tail: a flat paddle hinged at the rump. Rotate `tail.rotation.x` to slap.
  const tail = new THREE.Group();
  tail.position.set(0, 0.27, -0.58);
  tail.rotation.x = 0.35;
  body.add(tail);
  tail.add(tailShape());

  const legs = [leg(-0.16, 0.27, 0.22, false, DARK_FUR), leg(0.16, 0.27, 0.22, false, DARK_FUR), leg(-0.2, -0.3, 0.24, true, DARK_FUR), leg(0.2, -0.3, 0.24, true, DARK_FUR)];
  group.add(...legs);

  // The parts that take the coat's colours, found by their colour, so setCoat can paint them again.
  const painted: Record<'fur' | 'dark' | 'belly', THREE.MeshLambertMaterial[]> = { fur: [], dark: [], belly: [] };
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o === torso.mesh) return;
    const hex = o.material.color.getHex();
    if (hex === FUR) painted.fur.push(o.material);
    else if (hex === DARK_FUR) painted.dark.push(o.material);
    else if (hex === BELLY) painted.belly.push(o.material);
  });
  torso.paint(new THREE.Color(FUR), new THREE.Color(BELLY));

  // 0 walking, 1 swimming or diving. Eases so the pose changes over a fraction of a second.
  let swim = 0;
  let under = 0;
  let pitch = 0;
  let last = 0;
  // The action pose and how much of it shows. It eases in and out, and the last pose is held while it fades.
  let doing: ActionPose | null = null;
  let weight = 0;
  const rest = legs.map((l) => l.position.clone());
  const attach = new THREE.Vector3();

  return {
    group,
    setCoat(index, shade = 0) {
      const c = COATS[index % COATS.length]!;
      // A shade of -1 to 1 makes the whole coat a little darker or lighter, so no two beavers of a coat look the same.
      const tint = (hex: number): THREE.Color => new THREE.Color(hex).lerp(new THREE.Color(shade < 0 ? 0x000000 : 0xffffff), Math.abs(shade) * SHADE_STRENGTH);
      for (const m of painted.fur) m.color.copy(tint(c.fur));
      for (const m of painted.dark) m.color.copy(tint(c.dark));
      for (const m of painted.belly) m.color.copy(tint(c.belly));
      torso.paint(tint(c.fur), tint(c.belly));
    },
    update(time, speed01, mode = 'walk', tilt = 0, slapAge = null, carry = null, action = null) {
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
      head.rotation.y = 0;

      if (action) doing = actionPose(action.kind, action.age);
      weight += ((action ? doing!.weight : 0) - weight) * Math.min(1, dt * 10);
      if (!action && weight < 0.001) doing = null;
      const w = doing ? weight : 0;
      // Afloat there is nothing to sit on, so the body does not rear up.
      const sit = (doing?.sit ?? 0) * w * (1 - swim);
      if (doing) {
        // Rear up about the hips: turn the body and move it so the hips stay where they are.
        body.rotation.x += sit + doing.lean * w;
        body.position.y += HIP.y - (HIP.y * Math.cos(sit) - HIP.z * Math.sin(sit));
        body.position.z = HIP.z - (HIP.y * Math.sin(sit) + HIP.z * Math.cos(sit));
        head.rotation.x += doing.head * w;
        head.rotation.y = doing.turn * w;
      } else body.position.z = 0;
      body.updateMatrix();

      legs.forEach((l, i) => {
        const front = i < 2;
        const swing = Math.sin(phase + (i % 2 === 0 ? 0 : Math.PI) + (front ? 0 : Math.PI));
        const walkAngle = swing * 0.5 * speed01;
        // Swimming: front legs tuck under the chest, back legs trail and kick.
        const swimAngle = front ? 1.3 : 0.9 + swing * (0.7 + 0.3 * under) * (0.3 + 0.7 * speed01);
        let angle = walkAngle * (1 - swim) + swimAngle * swim;
        l.position.copy(rest[i]!);
        if (doing && front && doing.paws !== null) {
          // The front legs go with the chest as it rears up, and the paws reach, pat, or hold.
          attach.copy(rest[i]!).applyMatrix4(body.matrix);
          l.position.lerp(attach, w);
          const paw = body.rotation.x + doing.paws + (i === 0 ? -doing.split : doing.split);
          angle += (paw - angle) * w;
        } else if (doing && !front && doing.paws !== null) {
          // The hind legs stand still under a beaver that works with its paws.
          angle *= 1 - w;
        }
        l.rotation.x = angle;
      });

      const walkTail = 0.35 + Math.sin(phase * 0.5) * 0.05 * speed01;
      tail.rotation.x = slapping?.tail ?? walkTail * (1 - swim) + -0.05 * swim;
      // The tail's lift is measured from the ground, so the body's own tilt is taken off.
      if (doing && doing.tail !== null && !slapping) tail.rotation.x += (doing.tail - body.rotation.x - tail.rotation.x) * w;
      tail.rotation.y = Math.sin(time * 2.5) * 0.25 * swim * speed01;
    },
  };
}
