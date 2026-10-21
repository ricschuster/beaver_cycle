// The candy shapes of the dream (docs/design/29_dream_candy_land.md): lollipop trees, cotton candy trees, gumdrop bushes,
// candy canes, cupcakes, ice cream cones, marshmallow rocks, the peppermint stepping stones of the path, and the sweets. Every shape
// is non indexed with a colour per vertex and smooth normals, so the props of a patch of land merge into one mesh with
// one material, and stripes stay crisp because each face has one colour. Built at size 1, standing on the origin and
// facing +z, from a seeded draw so a prop looks the same every time it is rebuilt.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CANDY_COLOURS, type DreamProp, type PropKind } from '../sim/dream';
import { seeded, seedOf } from './propShapes';
import { GARDEN_SHAPES, gardenSweetShapes } from './gardenProps';

const WHITE = new THREE.Color(0xfffaf4);
const CHERRY = new THREE.Color(0xe8405e);
const WAFFLE = new THREE.Color(0xe2a862);
const WAFFLE_DARK = new THREE.Color(0xc98a48);

/** A candy colour by index, softened a little toward white so the land is bright but not loud. */
export function candy(index: number, soften = 0.12): THREE.Color {
  const n = CANDY_COLOURS.length;
  return new THREE.Color(CANDY_COLOURS[((index % n) + n) % n]!).lerp(WHITE, soften);
}

/** What a face's painter is told: its centre, its normal, and the mean texture coordinate of its corners. */
type Painter = (centre: THREE.Vector3, normal: THREE.Vector3, uv: THREE.Vector2) => THREE.Color;

/**
 * A three.js shape made non indexed and painted one face at a time. The smooth normals of the indexed shape are kept
 * (`flat` makes them per face instead), and only position, normal and colour are left so every part merges.
 */
export function paint(geometry: THREE.BufferGeometry, colourOf: Painter, flat = false): THREE.BufferGeometry {
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (g !== geometry) geometry.dispose();
  if (flat) g.computeVertexNormals();
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  const t = g.getAttribute('uv');
  const colours = new Float32Array(p.count * 3);
  const centre = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const uv = new THREE.Vector2();
  const v = new THREE.Vector3();
  for (let f = 0; f < p.count / 3; f++) {
    centre.set(0, 0, 0);
    normal.set(0, 0, 0);
    uv.set(0, 0);
    for (let k = 0; k < 3; k++) {
      const i = f * 3 + k;
      centre.add(v.fromBufferAttribute(p, i));
      normal.add(v.fromBufferAttribute(n, i));
      if (t) uv.add(new THREE.Vector2(t.getX(i), t.getY(i)));
    }
    centre.divideScalar(3);
    normal.normalize();
    uv.divideScalar(3);
    const c = colourOf(centre, normal, uv);
    for (let k = 0; k < 3; k++) colours.set([c.r, c.g, c.b], (f * 3 + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'color') g.deleteAttribute(name);
  return g;
}

/** One colour for every face. */
export const plainPaint = (geometry: THREE.BufferGeometry, colour: THREE.Color, flat = false): THREE.BufferGeometry => paint(geometry, () => colour, flat);

/** Merge painted parts into one geometry, and free the parts. */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (parts.length === 0) return new THREE.BufferGeometry();
  const merged = mergeGeometries(parts)!;
  for (const g of parts) g.dispose();
  return merged;
}

/** Move, turn and scale a part. */
export function put(geometry: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  return geometry.applyMatrix4(m);
}

/** A lathe from (radius, height) pairs, around y. */
export const lathe = (profile: [number, number][], segments: number): THREE.LatheGeometry =>
  new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);

/**
 * A round candy disc in the xy plane facing +z, `radius` across and `thick` deep, in `base` with a spiral band of each of
 * `bands` on both faces (the swirl of a lollipop). The bands are thin strips laid just over the faces, so the spiral is
 * smooth however coarse the disc.
 */
export function swirlDisc(radius: number, thick: number, base: THREE.Color, bands: THREE.Color[], turns = 2.5, steps = 72): THREE.BufferGeometry {
  const disc = lathe([[0, thick / 2], [radius * 0.9, thick / 2], [radius, thick * 0.25], [radius, -thick * 0.25], [radius * 0.9, -thick / 2], [0, -thick / 2]], 24).rotateX(Math.PI / 2);
  const parts = [plainPaint(disc, base)];
  const reach = radius * 0.86;
  // Each band takes its share of the gap between turns, leaving the base showing between them.
  const width = (reach / turns / bands.length) * 0.6;
  bands.forEach((colour, b) => {
    const pos: number[] = [];
    const nor: number[] = [];
    const end = turns * Math.PI * 2;
    const at = (t: number, side: number): [number, number] => {
      const r = Math.max(0, (t / end) * reach + side * width * 0.5 * Math.min(1, t / 2));
      const a = t + (b * Math.PI * 2) / bands.length;
      return [Math.cos(a) * r, Math.sin(a) * r];
    };
    for (const face of [1, -1]) {
      const z = face * (thick / 2 + 0.004);
      for (let i = 0; i < steps; i++) {
        const t0 = (i / steps) * end;
        const t1 = ((i + 1) / steps) * end;
        const [a, b2, c, d] = [at(t0, -1), at(t0, 1), at(t1, -1), at(t1, 1)];
        // Wound so the front of each triangle faces out of its face of the disc.
        const quad = face > 0 ? [a, b2, c, b2, d, c] : [a, c, b2, b2, c, d];
        for (const [x, y] of quad) {
          pos.push(x, y, z);
          nor.push(0, 0, face);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    parts.push(plainPaint(g, colour));
  });
  return merge(parts);
}

/** A lollipop tree: a white stick and a big swirl disc on top. About 3.5 m high. */
function lollipop(colour: number, random: () => number): THREE.BufferGeometry {
  const stick = put(plainPaint(new THREE.CylinderGeometry(0.07, 0.085, 2.4, 8, 1, true), WHITE), 0, 1.2, 0);
  const swirl = put(swirlDisc(0.8, 0.22, WHITE, [candy(colour), candy(colour + 1 + Math.floor(random() * 3))]), 0, 2.8, 0, 0, 0, (random() - 0.5) * 0.3);
  // A little ribbon bow where the stick meets the disc.
  const bow = candy(colour + 3, 0.3);
  const knots = [-1, 1].map((s) => put(plainPaint(new THREE.ConeGeometry(0.09, 0.2, 8), bow), s * 0.1, 1.93, 0.02, 0, 0, (s * Math.PI) / 2));
  return merge([stick, swirl, ...knots]);
}

/** Cotton candy comes in pink, sky blue, and lilac. */
const COTTON = [0xffb6dc, 0xaedcff, 0xd9bcff].map((hex) => new THREE.Color(hex));

/** A cotton candy tree: a paper stick and a big soft cloud of spun sugar on top, a heap of puffs in two colours. About 3.4 m high. */
function cottonCandy(colour: number, random: () => number): THREE.BufferGeometry {
  const paper = new THREE.Color(0xf6efe2);
  const stick = put(plainPaint(new THREE.CylinderGeometry(0.06, 0.08, 2.3, 8, 1, true), paper), 0, 1.15, 0);
  const main = COTTON[((colour % 3) + 3) % 3]!;
  const swirl = COTTON[(((colour + 1) % 3) + 3) % 3]!;
  // Fluffy: each face a touch lighter or darker, so the cloud looks spun and not smooth.
  const fluff = (base: THREE.Color): THREE.BufferGeometry =>
    paint(new THREE.SphereGeometry(1, 10, 7), () => base.clone().lerp(WHITE, 0.08 + random() * 0.25));
  const parts = [stick, put(fluff(main), 0, 2.72, 0, 0, 0, 0, 0.88, 0.7, 0.88)];
  const puffs = 7;
  for (let i = 0; i < puffs; i++) {
    const a = (i / puffs) * Math.PI * 2 + random() * 0.5;
    const up = 2.55 + random() * 0.55;
    const out = 0.6 + random() * 0.2;
    const r = 0.36 + random() * 0.14;
    parts.push(put(fluff(i % 3 === 1 ? swirl : main), Math.cos(a) * out, up, Math.sin(a) * out, 0, 0, 0, r, r * 0.9, r));
  }
  parts.push(put(fluff(swirl), 0.05, 3.12, -0.03, 0, 0, 0, 0.3, 0.26, 0.3));
  return merge(parts);
}

/** A cotton candy bush (wish 1): a low heap of spun sugar puffs close to the ground, in two colours. About 1.3 m high, 1.6 m across. */
function cottonBush(colour: number, random: () => number): THREE.BufferGeometry {
  const main = COTTON[((colour % 3) + 3) % 3]!;
  const swirl = COTTON[(((colour + 1) % 3) + 3) % 3]!;
  const fluff = (base: THREE.Color): THREE.BufferGeometry =>
    paint(new THREE.SphereGeometry(1, 9, 6), () => base.clone().lerp(WHITE, 0.08 + random() * 0.25));
  const parts = [put(fluff(main), 0, 0.55, 0, 0, 0, 0, 0.8, 0.62, 0.8)];
  const puffs = 6;
  for (let i = 0; i < puffs; i++) {
    const a = (i / puffs) * Math.PI * 2 + random() * 0.6;
    const out = 0.45 + random() * 0.25;
    const r = 0.3 + random() * 0.14;
    parts.push(put(fluff(i % 2 === 1 ? swirl : main), Math.cos(a) * out, 0.3 + random() * 0.35, Math.sin(a) * out, 0, 0, 0, r, r * 0.85, r));
  }
  parts.push(put(fluff(swirl), 0.05, 1.05, -0.03, 0, 0, 0, 0.3, 0.26, 0.3));
  return merge(parts);
}

/**
 * A cotton candy boat (wish 1, Q80): a round bowl of spun sugar, long and low, with a ring of puffs on its rim and a curled
 * bow. Its bow points along +z and it floats with its rim 0.4 m over the chocolate, about 1.4 m wide and 2.8 m long. `colour` picks pink, sky blue or lilac.
 */
export function cottonBoat(colour: number, random: () => number = () => 0.5): THREE.BufferGeometry {
  const main = COTTON[((colour % 3) + 3) % 3]!;
  const swirl = COTTON[(((colour + 1) % 3) + 3) % 3]!;
  const fluff = (base: THREE.Color, segments = 12): THREE.BufferGeometry =>
    paint(new THREE.SphereGeometry(1, segments, 7), () => base.clone().lerp(WHITE, 0.06 + random() * 0.2));
  // The hull is the lower half of a sphere, squashed long and low, and its inside floor is a pale disc a little over the water.
  const hull = paint(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), () => main.clone().lerp(WHITE, 0.05 + random() * 0.15));
  const parts = [put(hull, 0, 0.4, 0, 0, 0, 0, 0.72, 0.55, 1.4)];
  parts.push(put(plainPaint(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), WHITE.clone().lerp(main, 0.25)), 0, 0.1, 0, 0, 0, 0, 0.52, 1, 1.15));
  const rim = 10;
  for (let i = 0; i < rim; i++) {
    const a = (i / rim) * Math.PI * 2;
    parts.push(put(fluff(i % 2 === 0 ? main : swirl, 8), Math.sin(a) * 0.72, 0.4, Math.cos(a) * 1.4, 0, 0, 0, 0.17, 0.15, 0.17));
  }
  // A curled bow: a few puffs that climb in front.
  [[0, 0.55, 1.5, 0.2], [0, 0.72, 1.62, 0.16], [0, 0.88, 1.66, 0.12]].forEach(([x, y, z, r]) => parts.push(put(fluff(swirl, 8), x!, y!, z!, 0, 0, 0, r!, r!, r!)));
  return merge(parts);
}

/** A sugared dome. */
function drop(colour: THREE.Color, random: () => number, segments = 12): THREE.BufferGeometry {
  const geo = lathe([[0, 0], [0.8, 0], [0.84, 0.07], [0.8, 0.28], [0.68, 0.58], [0.46, 0.82], [0.2, 0.94], [0, 0.96]], segments);
  // Sugar: a few faces a touch lighter, so the dome glitters without looking cut like a gem.
  const sugar = colour.clone().lerp(WHITE, 0.16);
  return paint(geo, () => (random() < 0.18 ? sugar : colour));
}

/** A gumdrop bush: one big sugared dome and two small ones in other colours. */
function gumdrop(colour: number, random: () => number): THREE.BufferGeometry {
  const parts = [drop(candy(colour), random)];
  for (const [a, s, c] of [[0.9, 0.55, 2], [3.6, 0.45, 4]] as const) {
    const turn = a + random() * 0.8;
    parts.push(put(drop(candy(colour + c), random, 10), Math.cos(turn) * 0.85, 0, Math.sin(turn) * 0.85, 0, 0, 0, s));
  }
  return merge(parts);
}

/** A candy cane: a striped tube straight up, curling over into a hook. About 2.4 m high. */
function candyCane(colour: number, random: () => number): THREE.BufferGeometry {
  void random;
  const pts = [new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(0, 1.0, 0), new THREE.Vector3(0, 1.8, 0)];
  for (let i = 1; i <= 7; i++) {
    const a = (i / 7) * Math.PI * 1.05;
    pts.push(new THREE.Vector3(0.35 - Math.cos(a) * 0.35, 1.8 + Math.sin(a) * 0.38, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const stripe = candy(colour, 0.05);
  const tube = twistedTube(curve, 0.11, 64, 8, 7, (i) => (Math.floor(i / 2) % 2 === 0 ? stripe : WHITE));
  const end = curve.getPoint(1);
  const cap = put(plainPaint(new THREE.SphereGeometry(0.11, 8, 6), WHITE), end.x, end.y, end.z);
  return merge([tube, cap]);
}

/**
 * A tube along `curve`, `radius` thick, whose rings turn `twists` times round along its length, so faces that share a place
 * round the tube (`colourOf` that index) wind round it as crisp stripes, as on a candy cane.
 */
export function twistedTube(curve: THREE.Curve<THREE.Vector3>, radius: number, segments: number, sides: number, twists: number, colourOf: (side: number) => THREE.Color): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(segments, false);
  const ring = (j: number, i: number): { p: THREE.Vector3; n: THREE.Vector3 } => {
    const a = (i / sides) * Math.PI * 2 + (j / segments) * twists * Math.PI * 2;
    const n = frames.normals[j]!.clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[j]!, Math.sin(a));
    return { p: curve.getPointAt(j / segments).addScaledVector(n, radius), n };
  };
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < sides; i++) {
      const [a, b, c, d] = [ring(j, i), ring(j + 1, i), ring(j + 1, i + 1), ring(j, i + 1)];
      const colour = colourOf(i);
      for (const v of [a, b, d, b, c, d]) {
        pos.push(v.p.x, v.p.y, v.p.z);
        nor.push(v.n.x, v.n.y, v.n.z);
        col.push(colour.r, colour.g, colour.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** A cupcake hill: a pleated wrapper, a swirl of frosting, sprinkles and a cherry. About 2.6 m high and 2.5 m across. */
function cupcake(colour: number, random: () => number): THREE.BufferGeometry {
  const pleats = 24;
  const wrapGeo = lathe([[0, 0], [0.95, 0], [1.25, 0.95], [1.27, 1.0]], pleats * 2);
  const wp = wrapGeo.getAttribute('position');
  for (let i = 0; i < wp.count; i++) {
    // Every other column of vertices in: the pleats.
    const a = Math.atan2(wp.getZ(i), wp.getX(i));
    const k = 1 - 0.04 * (0.5 + 0.5 * Math.cos(a * pleats));
    wp.setXYZ(i, wp.getX(i) * k, wp.getY(i), wp.getZ(i) * k);
  }
  wrapGeo.computeVertexNormals();
  const paper = candy(colour + 2, 0.55);
  const paperDark = paper.clone().multiplyScalar(0.9);
  const wrapper = paint(wrapGeo, (c) => (Math.floor(((Math.atan2(c.z, c.x) / (Math.PI * 2)) * pleats + 100) % 2) === 0 ? paper : paperDark));
  const cake = plainPaint(lathe([[1.2, 0.9], [1.32, 1.0], [1.2, 1.1], [0, 1.12]], 20), new THREE.Color(0xd9a066));
  const frosting = candy(colour, 0.3);
  const cream = paint(
    lathe([[1.3, 1.0], [1.36, 1.12], [1.22, 1.26], [1.0, 1.3], [1.06, 1.44], [0.88, 1.64], [0.66, 1.7], [0.7, 1.84], [0.46, 2.02], [0.24, 2.12], [0.08, 2.3], [0, 2.34]], 20),
    () => frosting,
  );
  const parts = [wrapper, cake, cream];
  parts.push(put(plainPaint(new THREE.SphereGeometry(0.2, 10, 8), CHERRY), 0, 2.46, 0));
  parts.push(put(plainPaint(new THREE.CylinderGeometry(0.015, 0.02, 0.22, 4), new THREE.Color(0x6a8a3a)), 0.04, 2.7, 0, 0, 0, -0.3));
  // Sprinkles on the frosting, each a short bar in a candy colour.
  for (let i = 0; i < 14; i++) {
    const a = random() * Math.PI * 2;
    const t = 0.15 + random() * 0.75;
    const r = 1.25 * (1 - t) + 0.25;
    const y = 1.1 + t * 1.05;
    parts.push(put(plainPaint(new THREE.BoxGeometry(0.16, 0.05, 0.05), candy(i, 0), true), Math.cos(a) * r, y, Math.sin(a) * r, random() * 3, random() * 3, random() * 3));
  }
  return merge(parts);
}

/** A scoop of ice cream: a ball with drips round its bottom, its top a little lighter unless `plain`. */
export function scoop(radius: number, colour: THREE.Color, random: () => number, segments = 14, rings = 9, plain = false): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(radius, segments, rings);
  const p = geo.getAttribute('position');
  const phase = random() * 6;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < -0.1 * radius) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const drip = Math.max(0, Math.sin(a * Math.min(5, Math.floor(segments / 3)) + phase)) ** 2 * 0.28 * radius;
      p.setY(i, y - drip * smoothBand(-y / radius));
    }
  }
  geo.computeVertexNormals();
  const light = colour.clone().lerp(WHITE, 0.25);
  return paint(geo, (c) => (!plain && c.y > radius * 0.55 ? light : colour));
}

/** 0 at the equator, 1 by a third of the way down, 0.4 at the bottom: where drips hang. */
const smoothBand = (down: number): number => (down < 0.33 ? down / 0.33 : 1 - 0.6 * ((down - 0.33) / 0.67));

/** An ice cream cone stuck point down in the ground, with two scoops and a cherry. About 3 m high. */
function iceCream(colour: number, random: () => number): THREE.BufferGeometry {
  const cone = paint(lathe([[0, 0], [0.5, 1.5], [0.6, 1.58], [0.55, 1.64]], 14), (c) => {
    const a = Math.atan2(c.z, c.x) / (Math.PI * 2);
    return (Math.floor(a * 14 + c.y * 4 + 100) + Math.floor(a * 14 - c.y * 4 + 100)) % 2 === 0 ? WAFFLE : WAFFLE_DARK;
  });
  const lower = put(scoop(0.66, candy(colour), random), 0, 1.86, 0, 0, random() * 6, 0, 1, 0.9, 1);
  const upper = put(scoop(0.54, candy(colour + 2 + Math.floor(random() * 3)), random), 0.05, 2.54, 0, 0, random() * 6, 0, 1, 0.9, 1);
  const cherry = put(plainPaint(new THREE.SphereGeometry(0.16, 10, 8), CHERRY), 0.05, 3.1, 0);
  return merge([cone, lower, upper, cherry]);
}

/** A soft round cylinder: a marshmallow, `r` across and `h` high, standing on the origin. */
function marshmallow(r: number, h: number, colour: THREE.Color): THREE.BufferGeometry {
  const e = Math.min(r, h) * 0.32;
  const profile: [number, number][] = [[0, 0], [r - e, 0]];
  for (let i = 1; i <= 2; i++) {
    const a = (i / 3) * (Math.PI / 2);
    profile.push([r - e + Math.sin(a) * e, e - Math.cos(a) * e]);
  }
  profile.push([r, e], [r, h - e]);
  for (let i = 1; i <= 2; i++) {
    const a = (i / 3) * (Math.PI / 2);
    profile.push([r - e + Math.cos(a) * e, h - e + Math.sin(a) * e]);
  }
  profile.push([r - e, h], [0, h]);
  return plainPaint(lathe(profile, 12), colour);
}

/** A marshmallow rock: a heap of four soft marshmallows, mostly white, one faintly tinted. */
function marshmallowRock(colour: number, random: () => number): THREE.BufferGeometry {
  const tint = candy(colour, 0.78);
  const parts: THREE.BufferGeometry[] = [];
  const heap: [number, number, number, number, number][] = [
    [0, 0, 0, 0, 0],
    [0.62, 0, 0.2, 0, 0.15],
    [-0.35, 0, 0.55, Math.PI / 2, 0.25],
    [0.2, 0.62, 0.1, 0.25, -0.2],
  ];
  heap.forEach(([x, y, z, lie, tilt], i) => {
    const m = marshmallow(0.42, 0.62, i === 1 ? tint : WHITE.clone().multiplyScalar(0.97 + random() * 0.03));
    // A lying marshmallow is turned on its side and lifted by its radius.
    parts.push(put(m, x, y + (lie ? 0.42 : 0), z, lie ? Math.PI / 2 : tilt, random() * 6, tilt));
  });
  return merge(parts);
}

const SHAPES: Partial<Record<PropKind, (colour: number, random: () => number) => THREE.BufferGeometry>> = {
  lollipop,
  gumdrop,
  candyCane,
  cupcake,
  iceCream,
  marshmallowRock,
  cottonCandy,
  cottonBush,
};

/** The shape of one prop at size 1, standing on the origin and facing +z, the same every time for the same prop. */
export function propShape(prop: Pick<DreamProp, 'id' | 'kind' | 'colour'>): THREE.BufferGeometry {
  return (SHAPES[prop.kind] ?? GARDEN_SHAPES[prop.kind]!)(prop.colour, seeded(seedOf(prop.id)));
}

/** The props placed on the land, merged into one geometry: turned, sized, and stood on the ground `groundAt` gives. */
export function propsGeometry(props: readonly DreamProp[], groundAt: (prop: DreamProp) => number): THREE.BufferGeometry {
  return merge(props.map((p) => put(propShape(p), p.x, groundAt(p), p.z, 0, p.yaw, 0, p.size)));
}

/** A five pointed star in the xy plane facing +z, `r` to its points, a little puffy. */
export function starShape(r: number, depth: number, colour: THREE.Color): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 === 0 ? r : r * 0.48;
    if (i === 0) s.moveTo(Math.cos(a) * d, Math.sin(a) * d);
    else s.lineTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.5, bevelSize: r * 0.08, bevelSegments: 1 });
  geo.translate(0, 0, -depth / 2);
  return plainPaint(geo, colour, true);
}

/**
 * The sweets, each as parts: a part that `tinted` takes the sweet's own colour (an instance colour times its white
 * vertices), the other parts keep theirs. Sizes are about half a metre, big enough to see from a few metres away.
 */
export function sweetShapes(theme: 'candy' | 'veggie' = 'candy'): Record<'drop' | 'swirl' | 'star' | 'lily', { geometry: THREE.BufferGeometry; tinted: boolean }[]> {
  if (theme === 'veggie') return gardenSweetShapes();
  // A wrapped candy: a round body, and the wrapper twisted into a bow at each end.
  const body = plainPaint(new THREE.SphereGeometry(1, 12, 8).scale(0.2, 0.15, 0.15), new THREE.Color(0xffffff));
  const wrap = new THREE.Color(0xfff6fb);
  const ends = merge([-1, 1].map((s) => put(plainPaint(new THREE.ConeGeometry(0.12, 0.2, 6), wrap, true), s * 0.27, 0, 0, 0, 0, (s * Math.PI) / 2)));
  // A flat swirl: the coloured arms and the white arms are two parts.
  const swirl = swirlDisc(0.28, 0.08, new THREE.Color(0xffffff), [new THREE.Color(0xff00ff)], 2, 40);
  const [arms, whites] = splitByColour(swirl, (c) => c.g > 0.5);
  return {
    drop: [{ geometry: body, tinted: true }, { geometry: ends, tinted: false }],
    swirl: [{ geometry: arms, tinted: true }, { geometry: whites, tinted: false }],
    star: [{ geometry: starShape(0.3, 0.1, new THREE.Color(0xffd84d)), tinted: false }],
    lily: [{ geometry: lilyPad(), tinted: false }],
  };
}

/** A white chocolate lily pad (wish 7): a flat round pad with a notch cut in, a thin dark rim, and a cream bud in the middle. */
function lilyPad(): THREE.BufferGeometry {
  const pad = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 20, 1, false, 0.35, Math.PI * 2 - 0.7);
  const rim = new THREE.CylinderGeometry(0.52, 0.52, 0.03, 20, 1, true, 0.35, Math.PI * 2 - 0.7);
  const bud = new THREE.SphereGeometry(1, 8, 6).scale(0.1, 0.07, 0.1);
  return merge([
    plainPaint(pad, new THREE.Color(0xfff7ea)),
    put(plainPaint(rim, new THREE.Color(0xe6c9a0)), 0, -0.01, 0),
    put(plainPaint(bud, new THREE.Color(0xffe0ec)), 0, 0.05, 0),
  ]);
}

/** Split a painted geometry into the faces whose colour passes `test` and the rest, and free it. */
function splitByColour(geometry: THREE.BufferGeometry, test: (c: THREE.Color) => boolean): [THREE.BufferGeometry, THREE.BufferGeometry] {
  const p = geometry.getAttribute('position');
  const n = geometry.getAttribute('normal');
  const c = geometry.getAttribute('color');
  const out: [number[], number[], number[]][] = [[[], [], []], [[], [], []]];
  const colour = new THREE.Color();
  for (let f = 0; f < p.count / 3; f++) {
    colour.setRGB(c.getX(f * 3), c.getY(f * 3), c.getZ(f * 3));
    const o = out[test(colour) ? 1 : 0]!;
    for (let k = 0; k < 3; k++) {
      const i = f * 3 + k;
      o[0].push(p.getX(i), p.getY(i), p.getZ(i));
      o[1].push(n.getX(i), n.getY(i), n.getZ(i));
      o[2].push(1, 1, 1);
    }
  }
  geometry.dispose();
  return out.map(([pos, nor, col]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  }) as [THREE.BufferGeometry, THREE.BufferGeometry];
}

/** Peppermint stepping stones along the path, about every 1.7 m, each a flat round candy with coloured wedges. */
export function pathStones(points: readonly { x: number; z: number }[], groundAt: (x: number, z: number) => number, spacing = 1.7, earthy = false): THREE.BufferGeometry {
  const spots = resample(points, spacing);
  const parts: THREE.BufferGeometry[] = [];
  spots.forEach((s, i) => {
    const random = seeded(i * 7919 + 13);
    const r = 0.5 + random() * 0.12;
    const colour = candy(i % 2 === 0 ? 0 : [1, 3, 4, 5][Math.floor(i / 2) % 4]!, 0.15);
    // In the veggie garden the stones are plain river stones, grey brown, a little different each.
    const earth = new THREE.Color(i % 2 === 0 ? 0xb7a07a : 0xa6a08e);
    const stone = paint(new THREE.CylinderGeometry(r, r * 1.04, 0.16, 16, 1), (c, n) => {
      if (earthy) return n.y < 0.5 ? earth.clone().multiplyScalar(0.85) : earth;
      if (n.y < 0.5) return colour.clone().multiplyScalar(0.92);
      return Math.floor(((Math.atan2(c.z, c.x) / (Math.PI * 2)) * 8 + 8) % 2) === 0 ? colour : WHITE;
    });
    // A little zig and zag either side of the line, so it reads as stepping stones, not a road.
    const side = (i % 2 === 0 ? 1 : -1) * 0.25;
    const x = s.x + s.nx * side;
    const z = s.z + s.nz * side;
    parts.push(put(stone, x, groundAt(x, z) + 0.03, z, 0, random() * 6, 0));
  });
  return merge(parts);
}

/** Points along a line every `spacing` metres, with the unit normal of the line there (to its left). */
export function resample(points: readonly { x: number; z: number }[], spacing: number): { x: number; z: number; nx: number; nz: number }[] {
  const out: { x: number; z: number; nx: number; nz: number }[] = [];
  if (points.length < 2) return points.map((p) => ({ x: p.x, z: p.z, nx: 1, nz: 0 }));
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len === 0) continue;
    const tx = (b.x - a.x) / len;
    const tz = (b.z - a.z) / len;
    for (let d = carry; d < len; d += spacing) out.push({ x: a.x + tx * d, z: a.z + tz * d, nx: -tz, nz: tx });
    carry = (((carry - len) % spacing) + spacing) % spacing;
  }
  return out;
}
