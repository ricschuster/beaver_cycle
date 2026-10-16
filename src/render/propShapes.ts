// Shared low poly shapes for the props (lodge, dam, logs, rocks, food store, lily pads): sticks with pale cut ends,
// lumps of rock and mud, notched lily pads and their flowers. Every shape is non indexed and carries a colour per
// vertex, so a prop merges many parts into one mesh with one material, and its colours vary by face. Variation comes
// from a seeded random draw, never Math.random, so a prop looks the same every frame and every time it is rebuilt.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** A random draw in [0, 1) that repeats for the same seed (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number seed from a string, such as an id. */
export function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A whole number seed from a point, to the centimetre. */
export function seedAt(x: number, z: number, salt = 0): number {
  return seedOf(`${Math.round(x * 100)}:${Math.round(z * 100)}:${salt}`);
}

/** The material the props share: lit, flat shaded, coloured by the vertex colours. */
export function propMaterial(options: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...options });
}

/** A colour a little lighter or darker than `base`, by up to `amount` either way. */
export function vary(base: THREE.Color, random: () => number, amount: number): THREE.Color {
  return base.clone().multiplyScalar(1 + (random() * 2 - 1) * amount);
}

/** Metres one repeat of the bark grain covers, along a stick and round it (`barkUv`). */
export const BARK_REPEAT_M = 0.8;

/**
 * Give every vertex of a non indexed geometry a colour, one face (three vertices) at a time. With `grainOf` each face
 * also gets a grain strength, 0 for none (cut wood, mud) up to 1 (bark), in the `grain` attribute for `grainMaterial`.
 */
export function paintFaces(
  geometry: THREE.BufferGeometry,
  colorOf: (centre: THREE.Vector3, normal: THREE.Vector3, face: number) => THREE.Color,
  grainOf?: (centre: THREE.Vector3, normal: THREE.Vector3, face: number) => number,
): THREE.BufferGeometry {
  const p = geometry.getAttribute('position');
  const colors = new Float32Array(p.count * 3);
  const grain = grainOf ? new Float32Array(p.count) : null;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const centre = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let f = 0; f < p.count / 3; f++) {
    a.fromBufferAttribute(p, f * 3);
    b.fromBufferAttribute(p, f * 3 + 1);
    c.fromBufferAttribute(p, f * 3 + 2);
    centre.copy(a).add(b).add(c).divideScalar(3);
    normal.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    const color = colorOf(centre, normal, f);
    for (let k = 0; k < 3; k++) colors.set([color.r, color.g, color.b], (f * 3 + k) * 3);
    if (grain) grain.fill(grainOf!(centre, normal, f), f * 3, f * 3 + 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (grain) geometry.setAttribute('grain', new THREE.BufferAttribute(grain, 1));
  // Face normals: flat shading does not need them, but the shadow's normal bias does.
  geometry.computeVertexNormals();
  return geometry;
}

/** Merge painted non indexed parts into one geometry, and free the parts. */
export function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Keep only what every part has, so parts made by different three.js shapes merge, then give it face normals again.
  // The grain and its uv stay when any part has them; a part without them gets none (grain 0).
  const grained = parts.some((g) => g.hasAttribute('grain'));
  for (const g of parts) {
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'color' && !(grained && (name === 'grain' || name === 'uv'))) g.deleteAttribute(name);
    if (!grained) continue;
    const count = g.getAttribute('position').count;
    if (!g.hasAttribute('grain')) g.setAttribute('grain', new THREE.BufferAttribute(new Float32Array(count), 1));
    if (!g.hasAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  const merged = parts.length > 0 ? mergeGeometries(parts) : new THREE.BufferGeometry();
  for (const g of parts) g.dispose();
  if (parts.length > 0) merged.computeVertexNormals();
  return merged;
}

/** Number of vertices in a non indexed geometry. */
export const vertexCount = (geometry: THREE.BufferGeometry): number => geometry.getAttribute('position').count;

/** Wood colours: bark from grey brown to red brown, peeled wood, and the pale wood of a cut end. */
export const BARK = [0x6b4a2b, 0x7a5a38, 0x5f4a36, 0x7d5536, 0x6e5a45].map((c) => new THREE.Color(c));
export const PEELED = new THREE.Color(0xc4a271);
export const CUT_WOOD = new THREE.Color(0xe2c690);
export const CUT_RING = new THREE.Color(0xa77f4f);

/**
 * A stick along +x, centred on the origin, a prism of `sides` faces with flat ends. Its sides are `bark` with a
 * little variation per face, its ends pale cut wood.
 */
export function stick(length: number, radius: number, sides: number, bark: THREE.Color, random: () => number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(radius * 0.85, radius, length, sides, 1).rotateZ(-Math.PI / 2).rotateX(random() * Math.PI);
  const flat = g.toNonIndexed();
  g.dispose();
  barkUv(flat, 2 * Math.PI * radius, length);
  return paintFaces(flat, (_c, n) => (Math.abs(n.x) > 0.9 ? CUT_WOOD : vary(bark, random, 0.12)), (_c, n) => (Math.abs(n.x) > 0.9 ? 0 : 1));
}

/**
 * Set the uv of a cylinder (u round it, v along it, both 0 to 1) to texture repeats of `BARK_REPEAT_M` metres, a whole
 * number of them round the girth so the bark meets without a seam, for the bark grain that runs along the stick.
 */
export function barkUv(geometry: THREE.BufferGeometry, girth: number, length: number): void {
  const uv = geometry.getAttribute('uv');
  const round = Math.max(1, Math.round(girth / BARK_REPEAT_M));
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * round, uv.getY(i) * (length / BARK_REPEAT_M));
}

/** Place a part: turn it by `rotation` (Euler, radians) and move it to `at`. */
export function place(geometry: THREE.BufferGeometry, at: THREE.Vector3Like, rotation: THREE.Euler, scale?: THREE.Vector3Like): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(at.x, at.y, at.z),
    new THREE.Quaternion().setFromEuler(rotation),
    scale ? new THREE.Vector3(scale.x, scale.y, scale.z) : new THREE.Vector3(1, 1, 1),
  );
  return geometry.applyMatrix4(m);
}

/** Lay a stick from point `a` to point `b`. */
export function stickBetween(a: THREE.Vector3, b: THREE.Vector3, radius: number, sides: number, bark: THREE.Color, random: () => number): THREE.BufferGeometry {
  const dir = b.clone().sub(a);
  const g = stick(dir.length(), radius, sides, bark, random);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
  return g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
}

/**
 * A lump of rock or mud: a polyhedron of radius 1 pushed in and out at random, its underside flattened so it sits on
 * the ground. `detail` 0 is a dodecahedron (36 faces), 1 an icosahedron (80 faces). Unpainted.
 */
export function lump(random: () => number, roughness: number, detail: 0 | 1 = 0, flatBelow = -0.45): THREE.BufferGeometry {
  const base = detail === 0 ? new THREE.DodecahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, 1);
  const g = base.index ? base.toNonIndexed() : base.clone();
  base.dispose();
  // The same corner appears once per face, so push each by an amount keyed on where it is, not on its index.
  const push = new Map<string, number>();
  const p = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const key = `${v.x.toFixed(3)}:${v.y.toFixed(3)}:${v.z.toFixed(3)}`;
    let k = push.get(key);
    if (k === undefined) {
      k = 1 + (random() * 2 - 1) * roughness;
      push.set(key, k);
    }
    v.multiplyScalar(k);
    v.y = Math.max(v.y, flatBelow);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

/** Paint a lump: lighter on top, darker below, each face a little different, some faces `patch` coloured (moss, wet mud). */
export function paintLump(geometry: THREE.BufferGeometry, base: THREE.Color, random: () => number, patch?: { color: THREE.Color; share: number }): THREE.BufferGeometry {
  return paintFaces(geometry, (_c, n) => {
    const color = vary(base, random, 0.1).multiplyScalar(0.8 + 0.3 * Math.max(0, n.y));
    if (patch && n.y > 0.2 && random() < patch.share) color.lerp(patch.color, 0.6);
    return color;
  });
}

/**
 * A lily pad: a slab of `radius` and `height`, its top a low cone, with a wedge cut out from the rim to the middle
 * (the notch), along +x. `segments` faces round the rim. Painted: a pale middle, a deeper green rim and a dark edge.
 */
export function lilyPad(radius: number, height: number, segments: number, notch = 0.45): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const top = height / 2;
  const bottom = -height / 2;
  const middle = new THREE.Color(0xa4e27a);
  const rim = new THREE.Color(0x6cc04a);
  const edge = new THREE.Color(0x3e7a2c);
  const under = new THREE.Color(0x4c6e2a);
  const tri = (a: number[], b: number[], c: number[], ca: THREE.Color, cb: THREE.Color, cc: THREE.Color): void => {
    positions.push(...a, ...b, ...c);
    for (const col of [ca, cb, cc]) colors.push(col.r, col.g, col.b);
  };
  const at = (a: number, r: number, y: number): number[] => [Math.cos(a) * r, y, Math.sin(a) * r];
  const from = notch / 2;
  const span = Math.PI * 2 - notch;
  const centreTop = [0, top + height * 0.2, 0];
  const centreBottom = [0, bottom, 0];
  for (let i = 0; i < segments; i++) {
    const a0 = from + (span * i) / segments;
    const a1 = from + (span * (i + 1)) / segments;
    // The rim is a touch lower than the middle, and a vein of lighter green runs out along every other face.
    const veined = i % 2 === 0 ? middle : rim;
    tri(centreTop, at(a1, radius, top), at(a0, radius, top), middle, veined, rim);
    tri(centreBottom, at(a0, radius, bottom), at(a1, radius, bottom), under, under, under);
    tri(at(a0, radius, top), at(a1, radius, top), at(a1, radius, bottom), edge, edge, edge);
    tri(at(a0, radius, top), at(a1, radius, bottom), at(a0, radius, bottom), edge, edge, edge);
  }
  // The two walls of the notch.
  const end = from + span;
  tri(centreTop, at(from, radius, top), at(from, radius, bottom), edge, edge, edge);
  tri(centreTop, at(from, radius, bottom), centreBottom, edge, edge, edge);
  tri(centreTop, centreBottom, at(end, radius, bottom), edge, edge, edge);
  tri(centreTop, at(end, radius, bottom), at(end, radius, top), edge, edge, edge);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A water lily flower standing on the origin: an outer ring of `outer` pointed petals that open wide, an inner ring
 * that stands up, and a yellow heart. Petals are single sheets, so draw it double sided.
 */
export function lilyFlower(size: number, outer = 8, inner = 6): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const white = new THREE.Color(0xfff6f2);
  const blush = new THREE.Color(0xf7c6d6);
  const yellow = new THREE.Color(0xffc93a);
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ca: THREE.Color, cb: THREE.Color, cc: THREE.Color): void => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (const col of [ca, cb, cc]) colors.push(col.r, col.g, col.b);
  };
  const petals = (count: number, length: number, width: number, rise: number, turn: number, lift: number): void => {
    for (let i = 0; i < count; i++) {
      const a = turn + (i * Math.PI * 2) / count;
      const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const side = new THREE.Vector3(-out.z, 0, out.x);
      const base = new THREE.Vector3(0, lift, 0).addScaledVector(out, size * 0.08);
      // The petal opens at `rise` radians above the water, a little cupped: the middle line stands higher than the sides.
      const along = out.clone().multiplyScalar(Math.cos(rise)).add(new THREE.Vector3(0, Math.sin(rise), 0));
      const tip = base.clone().addScaledVector(along, length);
      const mid = base.clone().addScaledVector(along, length * 0.45);
      const left = mid.clone().addScaledVector(side, width).addScaledVector(new THREE.Vector3(0, 1, 0), width * 0.3);
      const right = mid.clone().addScaledVector(side, -width).addScaledVector(new THREE.Vector3(0, 1, 0), width * 0.3);
      tri(base, left, tip, blush, white, white);
      tri(base, tip, right, blush, white, white);
    }
  };
  petals(outer, size, size * 0.24, 0.35, 0, 0);
  petals(inner, size * 0.8, size * 0.2, 1.0, Math.PI / inner, 0.01);
  // The heart: a low yellow pyramid.
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a0 = (i * Math.PI * 2) / n;
    const a1 = ((i + 1) * Math.PI * 2) / n;
    const r = size * 0.22;
    tri(new THREE.Vector3(0, size * 0.4, 0), new THREE.Vector3(Math.cos(a1) * r, size * 0.1, Math.sin(a1) * r), new THREE.Vector3(Math.cos(a0) * r, size * 0.1, Math.sin(a0) * r), yellow, yellow, yellow);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}
