// Shared pieces for the stylized animal and beaver models (#105): generated grain
// textures, a tube swept along a curve with an oval cross-section and colours painted into its vertices, low poly
// blobs, flat extruded shapes, and an eye with a glint. Everything is made from code and the same every time.
import * as THREE from 'three';

/** A small number from 0 to 1 that is always the same for the same two whole numbers. */
export function hash(a: number, b: number): number {
  const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Make a grey pattern texture, `size` texels square, from a brightness (0 to 1) per texel. */
export function patternTexture(size: number, shade: (x: number, y: number) => number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.round(255 * Math.min(1, Math.max(0, shade(x, y))));
      data.set([v, v, v, 255], (y * size + x) * 4);
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Thin streaks of lighter and darker hair, running along v. */
function streaks(x: number, y: number): number {
  const strand = Math.floor((y + hash(x, 7) * 8) / 8);
  return 0.87 + 0.13 * hash(x, strand);
}

export type Grain = 'fur' | 'spots' | 'feather' | 'skin';

const textures = new Map<Grain, THREE.DataTexture>();

/** A grain texture shared by every animal: fur streaks, fur with dark spots (lynx), feather rows, or a soft mottle (frog). */
export function grain(kind: Grain): THREE.DataTexture {
  let tex = textures.get(kind);
  if (tex) return tex;
  if (kind === 'fur') tex = patternTexture(64, streaks);
  else if (kind === 'spots') {
    // Fur with round dark spots on a jittered grid of 16 texel cells.
    tex = patternTexture(64, (x, y) => {
      const cx = Math.floor(x / 16);
      const cy = Math.floor(y / 16);
      const sx = cx * 16 + 4 + hash(cx, cy) * 8;
      const sy = cy * 16 + 4 + hash(cy, cx + 9) * 8;
      const d = Math.hypot(x - sx, (y - sy) * 0.7);
      return streaks(x, y) * (0.62 + 0.38 * smoothstep(2.2, 3.6, d));
    });
  } else if (kind === 'feather') {
    // Small overlapping feather tips, each row shifted half a feather, each feather a little lighter or darker,
    // with a soft darker edge.
    tex = patternTexture(64, (x, y) => {
      const row = Math.floor(y / 4);
      const shift = (row % 2) * 3;
      const col = Math.floor((x + shift) / 6);
      const fx = ((x + shift) % 6) - 2.5;
      const fy = (y % 4) - 4;
      const rim = 1 - 0.07 * smoothstep(3, 4.2, Math.hypot(fx, fy));
      return (0.92 + 0.08 * hash(col, row)) * rim;
    });
  } else {
    // Soft round darker blotches on a fine mottle.
    tex = patternTexture(64, (x, y) => {
      const cx = Math.floor(x / 16);
      const cy = Math.floor(y / 16);
      const sx = cx * 16 + 5 + hash(cx + 3, cy) * 6;
      const sy = cy * 16 + 5 + hash(cy, cx + 5) * 6;
      const r = 3 + hash(cx, cy + 11) * 2.5;
      return (0.95 + 0.05 * hash(x, y)) * (0.72 + 0.28 * smoothstep(r - 1, r + 1, Math.hypot(x - sx, y - sy)));
    });
  }
  textures.set(kind, tex);
  return tex;
}

/** A Lambert mesh with a grain, coloured by its vertices when the geometry has colours, else by `colour`. */
export function coated(geometry: THREE.BufferGeometry, colour: number, kind: Grain | null = 'fur'): THREE.Mesh {
  const vertexColors = geometry.hasAttribute('color');
  const material = new THREE.MeshLambertMaterial({ color: vertexColors ? 0xffffff : colour, vertexColors });
  if (kind) material.map = grain(kind);
  return new THREE.Mesh(geometry, material);
}

/** A colour that blends from `a` to `b` by `f` (0 to 1), for painting. */
export function mix(a: number, b: number, f: number): THREE.Color {
  return new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, f)));
}

/** Rounds a radius off at both ends of a tube: 0 at t = 0 and 1 over the first `a` and the last `b` of the length. */
export function dome(t: number, a: number, b = a): number {
  const s = a > 0 && t < a ? 1 - (1 - t / a) ** 2 : 1;
  const e = b > 0 && t > 1 - b ? 1 - (1 - (1 - t) / b) ** 2 : 1;
  return Math.sqrt(Math.max(0, s)) * Math.sqrt(Math.max(0, e));
}

export interface SweepOptions {
  /** Segments around the tube. */
  radial?: number;
  /** Rings along the tube, set closer at the two ends so rounded ends stay round. */
  steps?: number;
  /**
   * The colour at a point: `t` 0 to 1 along the path, `up` from -1 (under) to 1 (on top), and `side` from -1 (left,
   * -x) to 1. For a path that runs up and down, "on top" is the back (-z) side.
   */
  paint?: (t: number, up: number, side: number) => THREE.Color;
  /** Texture repeats around and along. */
  uv?: [number, number];
}

/**
 * A tube along a smooth curve through `points`, with an oval cross-section `radius(t)` = [width, height] at `t` from 0
 * to 1 along it. Width runs along x and height across the path in its yz plane, so paths should not run along x.
 * The seam is underneath.
 */
export function sweep(points: THREE.Vector3[], radius: (t: number) => [number, number], options: SweepOptions = {}): THREE.BufferGeometry {
  const radial = options.radial ?? 12;
  const steps = options.steps ?? 16;
  const [uRepeat, vRepeat] = options.uv ?? [2, 2];
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const positions: number[] = [];
  const uvs: number[] = [];
  const colours: number[] = [];
  const p = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const t = (1 - Math.cos((Math.PI * i) / steps)) / 2;
    curve.getPointAt(t, p);
    curve.getTangentAt(t, tangent);
    side.set(1, 0, 0).addScaledVector(tangent, -tangent.x).normalize();
    up.crossVectors(tangent, side).normalize();
    const [rx, ry] = radius(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const s = Math.sin(a);
      const c = -Math.cos(a);
      positions.push(p.x + side.x * s * rx + up.x * c * ry, p.y + side.y * s * rx + up.y * c * ry, p.z + side.z * s * rx + up.z * c * ry);
      uvs.push((j / radial) * uRepeat, t * vRepeat);
      if (options.paint) {
        const col = options.paint(t, c, s);
        colours.push(col.r, col.g, col.b);
      }
    }
  }
  const index: number[] = [];
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      index.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (options.paint) geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Shorthand for a list of points. */
export function path(...xyz: [number, number, number][]): THREE.Vector3[] {
  return xyz.map(([x, y, z]) => new THREE.Vector3(x, y, z));
}

/** A low poly ellipsoid, with `detail` segments around (and two thirds of that from pole to pole). */
export function blob(rx: number, ry: number, rz: number, colour: number, x: number, y: number, z: number, detail = 10, kind: Grain | null = 'fur'): THREE.Mesh {
  const m = coated(new THREE.SphereGeometry(1, detail, Math.max(4, Math.round((detail * 2) / 3))), colour, kind);
  m.position.set(x, y, z);
  m.scale.set(rx, ry, rz);
  return m;
}

/** A plain mesh at a place, with no grain: for horn, bill, hoof, and eye. */
export function plain(geometry: THREE.BufferGeometry, colour: number, x: number, y: number, z: number): THREE.Mesh {
  const m = coated(geometry, colour, null);
  m.position.set(x, y, z);
  return m;
}

/**
 * A flat shape, drawn in x and y, extruded `depth` thick (centred on z = 0) with a small rounded edge. The texture
 * repeats every `tile` metres of the shape.
 */
export function flat(shape: THREE.Shape, depth: number, curveSegments = 6, tile = 0.25): THREE.BufferGeometry {
  const bevel = Math.min(depth * 0.5, 0.01);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments });
  geo.translate(0, 0, -depth / 2);
  const uv = geo.attributes.uv!;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile);
  return geo;
}

/** Paint a geometry's vertices by where they are, before it is placed: ears with dark tips, wings with a patch. */
export function painted(geo: THREE.BufferGeometry, paint: (x: number, y: number, z: number) => THREE.Color): THREE.BufferGeometry {
  const pos = geo.attributes.position!;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = paint(pos.getX(i), pos.getY(i), pos.getZ(i));
    colours.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geo;
}

/** A shape from a list of [x, y] points, smoothed through them with `per` points for each. */
export function outline(points: [number, number][], per = 3): THREE.Shape {
  const curve = new THREE.SplineCurve(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.Shape(curve.getPoints(points.length * per));
}

/**
 * An eye of radius `r` on side `s` (-1 left, 1 right): a dark ball, or an iris of `iris` colour with a pupil, and a
 * small white glint up and to the front, so it catches the light like the beaver's.
 */
export function eye(r: number, s: number, x: number, y: number, z: number, iris?: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(s * x, y, z);
  if (iris === undefined) g.add(plain(new THREE.SphereGeometry(r, 8, 6), 0x0d0a08, 0, 0, 0));
  else {
    g.add(plain(new THREE.SphereGeometry(r, 10, 6), iris, 0, 0, 0));
    // The pupil: a dark ball pressed into the front of the iris.
    const pupil = plain(new THREE.SphereGeometry(r * 0.62, 8, 5), 0x0d0a08, 0, 0, r * 0.52);
    pupil.scale.set(1, 1, 0.6);
    g.add(pupil);
  }
  g.add(plain(new THREE.SphereGeometry(r * 0.28, 6, 4), 0xffffff, s * r * 0.15, r * 0.42, r * 0.82));
  return g;
}

/** The number of triangles drawn by the meshes under `root`. */
export function triangles(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) n += (o.geometry.index?.count ?? o.geometry.attributes.position!.count) / 3;
  });
  return n;
}
