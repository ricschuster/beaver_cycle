// A stylized beaver built from three.js shapes, so its parts can be posed in code.
// Origin at the feet, facing +z, about one metre long without the tail. Parts
// that later poses move (tail, legs) sit in their own groups.
import * as THREE from 'three';
import type { BeaverMode } from '../sim/state';
import type { Food } from '../sim/food';
import { SHOT_SECONDS, type ActionKind, type BeaverAction } from './beaverAction';
import { grain, hash, patternTexture, smoothstep } from './modelKit';

/** Coats within beaver browns (Q59), indexed by `coatOf` in the sim. Fur, dark fur for legs and ears, and belly. */
export const COATS = [
  { fur: 0x8b5a2b, dark: 0x5a3a1c, belly: 0xa8794a },
  { fur: 0xa5733d, dark: 0x6e4a26, belly: 0xc29a66 },
  { fur: 0x6e4527, dark: 0x45291a, belly: 0x8c6340 },
  { fur: 0x5b3b22, dark: 0x33200f, belly: 0x7a5736 },
  { fur: 0x9a6a3a, dark: 0x4f3a2a, belly: 0xb88b55 },
] as const;
export const TAIL = 0x3b2a1a;
/** Tail colours the player can choose (`Look.tail`): the natural dark one first. */
export const TAILS = [TAIL, 0x55575c, 0x9a4a25, 0x2f6f73, 0x6b3a6b, 0x3f6b3a, 0x2b3f73, 0xb03030, 0xc8a02f, 0xd987a8] as const;
/** Scarf colours (`Look.scarf`); 0 is no scarf. */
export const SCARVES = [null, 0xd6453d, 0x3b78c4, 0xe8c23a, 0xe58bb0, 0x4fa05a, 0xe8862f, 0x8e5bb5, 0x2fa7a0, 0xf2f2ee, 0x2b2b30, 0x7a4a2a] as const;
/** Hats (`Look.hat`); 0 is no hat. */
export const HATS = [null, 'cap', 'straw', 'party', 'top', 'beanie', 'crown', 'cowboy', 'chef', 'flowers'] as const;
const HAT_COLOURS = { cap: 0xc0392b, straw: 0xe3c565, party: 0x8e44ad, top: 0x26262b, beanie: 0x3b78c4, crown: 0xe6b422, cowboy: 0x8a5a2b, chef: 0xf5f5f0, flowers: 0x4fa05a } as const;
const HAT_BAND = 0xd6453d;
/** Beaver teeth are orange, from the iron in them. */
export const TEETH = 0xe0904a;
export const NOSE = 0x1a1210;
const EYE = 0x0d0a08;

/** How far a shade of 1 moves a coat toward white (or of -1 toward black). */
const SHADE_STRENGTH = 0.18;

/** The colours of a coat with a shade of -1 to 1 on it: the whole coat a little darker or lighter, so no two beavers of a coat look the same. */
export function coatColours(index: number, shade = 0): { fur: THREE.Color; dark: THREE.Color; belly: THREE.Color } {
  const c = COATS[index % COATS.length]!;
  const tint = (hex: number): THREE.Color => new THREE.Color(hex).lerp(new THREE.Color(shade < 0 ? 0x000000 : 0xffffff), Math.abs(shade) * SHADE_STRENGTH);
  return { fur: tint(c.fur), dark: tint(c.dark), belly: tint(c.belly) };
}

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
const HIP = { y: 0.28, z: -0.3 };

/** The colours of a coat: fur, dark fur for legs and ears, and belly. */
export interface CoatColours {
  fur: THREE.ColorRepresentation;
  dark: THREE.ColorRepresentation;
  belly: THREE.ColorRepresentation;
}

export interface BeaverModel {
  group: THREE.Group;
  /** The head, which nods and turns with the poses, to add things to it (the dream's blush). */
  head: THREE.Group;
  /** Change the coat, an index into `COATS`. A new baby has its own colour. */
  setCoat(coat: number, shade?: number): void;
  /** Paint the coat in any colours, such as the dream's pastel marshmallow beavers. */
  setColours(colours: CoatColours): void;
  /** Put on a hat and scarf and colour the tail, as indices into `HATS`, `SCARVES` and `TAILS` (`Look` in the sim). */
  setLook(look: { hat: number; scarf: number; tail: number }): void;
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

/** The fur grain of the animals (modelKit.ts), repeated more often over the beaver's bigger body. Shared by every beaver. */
let furTexture: THREE.Texture | null = null;
function furGrain(): THREE.Texture {
  if (!furTexture) {
    furTexture = grain('fur').clone();
    furTexture.repeat.set(3, 2);
  }
  return furTexture;
}

/** The criss-cross scales on the tail. Shared by every beaver. */
let scaleTexture: THREE.DataTexture | null = null;
function tailScales(): THREE.DataTexture {
  if (!scaleTexture) {
    scaleTexture = patternTexture(32, (x, y) => {
      const a = (x + y) % 16;
      const b = (x - y + 32) % 16;
      return a < 2 || b < 2 ? 0.6 : 0.95 + 0.05 * hash(x, y);
    });
    scaleTexture.repeat.set(14, 14);
  }
  return scaleTexture;
}

/** Give a fur part the fur grain. */
function furry(mesh: THREE.Mesh): THREE.Mesh {
  (mesh.material as THREE.MeshLambertMaterial).map = furGrain();
  return mesh;
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
  const mesh = furry(part(geo, 0xffffff, 0, 0.33, -0.05));
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
/**
 * A leg hinged at the shoulder or hip, `length` up from the ground and inside the body, so it never comes apart from it.
 * The top is a furry shoulder, or a big haunch on a hind leg, and the lower leg and foot are dark. Hind legs have big
 * webbed feet.
 */
function leg(x: number, z: number, length: number, hind: boolean, fur: number, dark: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, length, z);
  if (hind) g.add(furry(ellipsoid(0.11, 0.16, 0.17, fur, 0, -0.04, 0)));
  else g.add(furry(ellipsoid(0.075, 0.12, 0.08, fur, 0, -0.06, 0)));
  const lower = length * 0.55;
  g.add(part(new THREE.CapsuleGeometry(hind ? 0.055 : 0.045, lower - 0.06, 4, 8), dark, 0, -length + lower / 2 + 0.02, 0));
  if (hind) g.add(part(webbedFoot(0.2, 0.17), dark, 0, -length, -0.04));
  else g.add(ellipsoid(0.065, 0.035, 0.08, dark, 0, -length + 0.035, 0.035));
  return g;
}

/** A hat for the top of the head, in the head's frame (the ears sit at y 0.14). */
function hatShape(kind: Exclude<(typeof HATS)[number], null>): THREE.Group {
  const g = new THREE.Group();
  const colour = HAT_COLOURS[kind];
  if (kind === 'cap') {
    g.add(part(new THREE.SphereGeometry(0.175, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), colour, 0, 0.1, 0));
    g.add(ellipsoid(0.13, 0.012, 0.1, colour, 0, 0.105, 0.17));
  } else if (kind === 'straw') {
    g.add(part(new THREE.CylinderGeometry(0.29, 0.29, 0.015, 18), colour, 0, 0.15, 0));
    g.add(part(new THREE.CylinderGeometry(0.12, 0.14, 0.1, 14), colour, 0, 0.2, 0));
    g.add(part(new THREE.CylinderGeometry(0.143, 0.143, 0.025, 14), HAT_BAND, 0, 0.17, 0));
  } else if (kind === 'party') {
    const cone = part(new THREE.ConeGeometry(0.1, 0.26, 12), colour, 0, 0.3, -0.02);
    cone.rotation.x = -0.15;
    g.add(cone, part(new THREE.SphereGeometry(0.03, 8, 6), 0xf2d04a, 0, 0.44, -0.06));
  } else if (kind === 'top') {
    g.add(part(new THREE.CylinderGeometry(0.2, 0.2, 0.014, 16), colour, 0, 0.15, 0));
    g.add(part(new THREE.CylinderGeometry(0.115, 0.125, 0.19, 14), colour, 0, 0.25, 0));
    g.add(part(new THREE.CylinderGeometry(0.127, 0.127, 0.03, 14), HAT_BAND, 0, 0.18, 0));
  } else if (kind === 'beanie') {
    g.add(part(new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), colour, 0, 0.09, 0));
    g.add(part(new THREE.CylinderGeometry(0.196, 0.196, 0.05, 14), 0xf2f2ee, 0, 0.115, 0));
    g.add(part(new THREE.SphereGeometry(0.045, 8, 6), 0xf2f2ee, 0, 0.29, 0));
  } else if (kind === 'crown') {
    g.add(part(new THREE.CylinderGeometry(0.13, 0.115, 0.07, 12), colour, 0, 0.19, 0));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.add(part(new THREE.ConeGeometry(0.03, 0.07, 6), colour, Math.sin(a) * 0.12, 0.26, Math.cos(a) * 0.12));
    }
    g.add(part(new THREE.SphereGeometry(0.02, 8, 6), 0xd6453d, 0, 0.2, 0.125));
  } else if (kind === 'cowboy') {
    const brim = part(new THREE.CylinderGeometry(0.28, 0.28, 0.014, 18), colour, 0, 0.15, 0.02);
    brim.scale.set(1, 1, 0.85);
    g.add(brim, part(new THREE.CylinderGeometry(0.1, 0.13, 0.13, 14), colour, 0, 0.215, 0), part(new THREE.CylinderGeometry(0.133, 0.133, 0.025, 14), 0x4a2f18, 0, 0.17, 0));
  } else if (kind === 'chef') {
    g.add(part(new THREE.CylinderGeometry(0.14, 0.14, 0.07, 14), colour, 0, 0.17, 0));
    const puff = ellipsoid(0.17, 0.12, 0.17, colour, 0, 0.29, 0);
    g.add(puff);
  } else {
    // A ring of flowers on a green wreath.
    g.add(part(new THREE.TorusGeometry(0.175, 0.025, 6, 20).rotateX(Math.PI / 2), colour, 0, 0.12, -0.01));
    const petals = [0xe58bb0, 0xe8c23a, 0xffffff, 0x8e5bb5, 0xd6453d, 0x3b78c4];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(part(new THREE.SphereGeometry(0.05, 8, 6), petals[i % petals.length]!, Math.sin(a) * 0.175, 0.13, Math.cos(a) * 0.175 - 0.01));
    }
  }
  return g;
}

/**
 * A scarf wound round the neck, in the head's frame. The head sits in the front of the torso, so the neck is the torso's front just
 * behind the head: the wrap is an upright ring there, round the torso, which covers the back of the neck and the shoulders. The knot
 * is at the side with two short ends hanging down the chest.
 */
function scarfShape(colour: number): THREE.Group {
  const g = new THREE.Group();
  const wrap = part(new THREE.TorusGeometry(0.2, 0.05, 10, 28), colour, 0, -0.15, -0.22);
  wrap.scale.set(1.05, 1.0, 1);
  g.add(wrap);
  g.add(ellipsoid(0.065, 0.06, 0.06, colour, 0.17, -0.2, -0.17));
  for (const [x, len] of [[0.15, 0.1], [0.2, 0.08]] as const) {
    const end = ellipsoid(0.03, len, 0.022, colour, x, -0.26 - len * 0.7, -0.15);
    end.rotation.z = x > 0.17 ? -0.15 : 0.12;
    g.add(end);
  }
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

  const head = new THREE.Group();
  head.position.set(0, 0.47, 0.5);
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
  tail.position.set(0, 0.24, -0.58);
  tail.rotation.x = 0.35;
  body.add(tail);
  const tailMesh = tailShape();
  tail.add(tailMesh);

  // The legs ride on the body, so they go with it when it bobs, dips, or sits up.
  const legs = [leg(-0.15, 0.27, 0.27, false, FUR, DARK_FUR), leg(0.15, 0.27, 0.27, false, FUR, DARK_FUR), leg(-0.19, -0.3, 0.28, true, FUR, DARK_FUR), leg(0.19, -0.3, 0.28, true, FUR, DARK_FUR)];
  body.add(...legs);

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

  const setColours = ({ fur, dark, belly }: CoatColours): void => {
    for (const m of painted.fur) m.color.set(fur);
    for (const m of painted.dark) m.color.set(dark);
    for (const m of painted.belly) m.color.set(belly);
    torso.paint(new THREE.Color(fur), new THREE.Color(belly));
  };

  // Hat and scarf are made when first chosen, so the many beavers without them carry no extra parts.
  const hats = new Map<string, THREE.Group>();
  let scarf: THREE.Group | null = null;
  let scarfColour = 0;
  const setLook = ({ hat, scarf: scarfIndex, tail: tailIndex }: { hat: number; scarf: number; tail: number }): void => {
    const kind = HATS[hat] ?? null;
    for (const [k, h] of hats) h.visible = k === kind;
    if (kind && !hats.has(kind)) {
      const h = hatShape(kind);
      hats.set(kind, h);
      head.add(h);
    }
    const colour = SCARVES[scarfIndex] ?? null;
    if (colour !== null && colour !== scarfColour) {
      scarf?.removeFromParent();
      scarf = scarfShape(colour);
      scarfColour = colour;
      head.add(scarf);
    }
    if (scarf) scarf.visible = colour !== null;
    (tailMesh.material as THREE.MeshLambertMaterial).color.set(TAILS[tailIndex] ?? TAIL);
  };

  return {
    group,
    head,
    setLook,
    setCoat(index, shade = 0) {
      setColours(coatColours(index, shade));
    },
    setColours,
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

      legs.forEach((l, i) => {
        const front = i < 2;
        const swing = Math.sin(phase + (i % 2 === 0 ? 0 : Math.PI) + (front ? 0 : Math.PI));
        const walkAngle = swing * 0.5 * speed01;
        // Swimming: front legs tuck under the chest, back legs trail and kick.
        const swimAngle = front ? 1.3 : 0.9 + swing * (0.7 + 0.3 * under) * (0.3 + 0.7 * speed01);
        // On land the legs stand upright however the body tips, so the feet stay on the ground; afloat they go with it.
        let angle = walkAngle * (1 - swim) + swimAngle * swim - body.rotation.x * (1 - swim);
        if (doing && doing.paws !== null) {
          // Front paws reach, pat, or hold, and hind legs stand still under a beaver that works with its paws.
          const paw = front ? doing.paws + (i === 0 ? -doing.split : doing.split) : -body.rotation.x * (1 - swim);
          angle += (paw - angle) * w;
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
