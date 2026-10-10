// The tree models: stylized, flat shaded, and few triangles, since they are drawn instanced by the ten thousand.
// Shared geometry, one per level and kind, built once and never disposed. Level 2 has no trees.
//
// Each vertex carries a shade in its colour (crowns lighter on top and darker below), and a `tree` attribute:
// x is 1 for wood, which keeps its own bark colour rather than the season's leaf colour, and y is how well the
// spot holds snow, 1 on the top of a tier or a twig, 0 at the tips and underneath. The material's shader
// (terrainView) lays the season's snow from the highest catch down. Broadleaf trees also carry the `crown`
// attribute: 1 and the crown's centre height for crown vertices, so the shader can shrink the crown away in winter.
import * as THREE from 'three';
import { BROADLEAF_SHAPE, TREE_SHAPE } from '../terrain/trees';

type Vec = [number, number, number];
interface Vert {
  p: Vec;
  /** Brightness the part's colour is multiplied by. */
  shade: number;
  /** How well the spot holds snow, 0 to 1. */
  snow: number;
}
interface Part {
  rgb: Vec;
  wood: number;
  /** 1 for the leafy crown of a broadleaf tree. */
  crown: number;
}

const LEAF: Vec = [1, 1, 1];
/** A colour as the linear numbers the vertex colours hold. */
const linear = (hex: number): Vec => new THREE.Color(hex).toArray() as Vec;
/** Spruce bark, and the greyer bark of the broadleaf trees. */
const CONIFER_BARK = linear(0x5a4232);
const BROADLEAF_BARK = linear(0x6b6257);

class TreeBuilder {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private readonly tree: number[] = [];
  private readonly crown: number[] = [];

  constructor(private readonly centre = 0) {}

  /** A triangle, turned to face away from `inside`, a point within the part. */
  tri(part: Part, a: Vert, b: Vert, c: Vert, inside: Vec): void {
    const u = sub(b.p, a.p);
    const v = sub(c.p, a.p);
    const n = cross(u, v);
    const mid: Vec = [(a.p[0] + b.p[0] + c.p[0]) / 3, (a.p[1] + b.p[1] + c.p[1]) / 3, (a.p[2] + b.p[2] + c.p[2]) / 3];
    const out = sub(mid, inside);
    const verts = n[0] * out[0] + n[1] * out[1] + n[2] * out[2] >= 0 ? [a, b, c] : [a, c, b];
    for (const w of verts) {
      this.pos.push(...w.p);
      this.col.push(part.rgb[0] * w.shade, part.rgb[1] * w.shade, part.rgb[2] * w.shade);
      this.tree.push(part.wood, w.snow);
      this.crown.push(part.crown, this.centre);
    }
  }

  build(withCrown: boolean): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(this.pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(this.col), 3));
    geo.setAttribute('tree', new THREE.BufferAttribute(Float32Array.from(this.tree), 2));
    if (withCrown) geo.setAttribute('crown', new THREE.BufferAttribute(Float32Array.from(this.crown), 2));
    geo.computeVertexNormals(); // not indexed, so every face is flat
    geo.computeBoundingSphere();
    return geo;
  }
}

function sub(a: Vec, b: Vec): Vec {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec, b: Vec): Vec {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** A point on a ring round the trunk. */
function ring(r: number, angle: number, y: number): Vec {
  return [r * Math.sin(angle), y, r * Math.cos(angle)];
}

/**
 * An open cone from a ring at `y0` up to a point at `y1`: a trunk, or a tier of a conifer. A tier with an even
 * number of sides has a star shaped rim, with every other point drawn in and up, like the tips of the branches.
 */
function cone(
  b: TreeBuilder,
  part: Part,
  sides: number,
  r: number,
  y0: number,
  y1: number,
  twist: number,
  look: { tipShade: number; topShade: number; star: boolean; droop: number },
): void {
  const apex: Vert = { p: [0, y1, 0], shade: look.topShade, snow: part.wood ? 0 : 1 };
  const rim: Vert[] = [];
  for (let i = 0; i < sides; i++) {
    const notch = look.star && i % 2 === 1;
    const a = twist + (i * Math.PI * 2) / sides;
    rim.push({
      p: ring(notch ? r * 0.72 : r, a, notch ? y0 + look.droop * 0.5 : y0 - look.droop),
      shade: notch ? look.tipShade * 0.85 : look.tipShade,
      snow: part.wood ? 0 : notch ? 0.3 : 0,
    });
  }
  const inside: Vec = [0, y0 + (y1 - y0) * 0.3, 0];
  for (let i = 0; i < sides; i++) b.tri(part, apex, rim[i]!, rim[(i + 1) % sides]!, inside);
}

/**
 * A spruce: tiers of branches, each a cone wider than the one above, on a short trunk that shows below the
 * lowest. It keeps within the cone of `TREE_SHAPE`, which the camera and the walking still use.
 * Level 0 has three tiers of six sides and a trunk, 21 triangles; level 1 three tiers of four, 12 triangles.
 */
export function coniferGeometry(level: number): THREE.BufferGeometry {
  const { radius, height, base } = TREE_SHAPE[level]!;
  const b = new TreeBuilder();
  const leaf: Part = { rgb: LEAF, wood: 0, crown: 0 };
  const near = level === 0;
  // rim height and radius of each tier, as shares of the height and of the radius at the foot
  const tiers = [
    { rim: 0.2, r: 1, apex: 0.58, shade: 0.8 },
    { rim: 0.43, r: 0.78, apex: 0.8, shade: 0.92 },
    { rim: 0.66, r: 0.52, apex: 1, shade: 1.05 },
  ];
  tiers.forEach((t, k) => {
    cone(b, leaf, near ? 6 : 4, radius * t.r, base + height * t.rim, base + height * t.apex, k * 0.7, {
      tipShade: 0.72 * t.shade,
      topShade: 1.2 * t.shade,
      star: near,
      droop: height * 0.025,
    });
  });
  if (near) {
    cone(b, { rgb: CONIFER_BARK, wood: 1, crown: 0 }, 3, 0.28, base, base + height * 0.5, 0.3, { tipShade: 0.9, topShade: 1, star: false, droop: 0 });
  }
  return b.build(false);
}

/** A stable number in [0, 1) for a point, so a jittered vertex shared by several faces moves the same way in each. */
function hash3(p: Vec): number {
  const s = Math.sin(p[0] * 12.9898 + p[1] * 78.233 + p[2] * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * A blob of leaves: a polyhedron round `at`, each corner pushed in or out a little so the crown is lumpy, lighter
 * on top and darker underneath.
 */
function blob(b: TreeBuilder, part: Part, shape: THREE.BufferGeometry, at: Vec, r: number, squash: number, shadeAt: (y: number) => number): void {
  const p = shape.getAttribute('position');
  for (let i = 0; i < p.count; i += 3) {
    const v: Vert[] = [0, 1, 2].map((k) => {
      const unit: Vec = [p.getX(i + k), p.getY(i + k), p.getZ(i + k)];
      const len = r * (0.88 + 0.24 * hash3(unit));
      const q: Vec = [at[0] + unit[0] * len, at[1] + unit[1] * len * squash, at[2] + unit[2] * len];
      return { p: q, shade: shadeAt(q[1]), snow: 0 };
    });
    b.tri(part, v[0]!, v[1]!, v[2]!, at);
  }
}

const ICOSAHEDRON = new THREE.IcosahedronGeometry(1, 0);
const OCTAHEDRON = new THREE.OctahedronGeometry(1, 0);

/**
 * A broadleaf tree: a lumpy crown of a big blob and smaller ones beside it, on a tapering trunk with bare branches
 * that show in winter, when the crown has shrunk away. The upper faces of the branches hold snow.
 * Level 0 has a crown of 36 triangles and wood of 17; level 1 a crown of 28 and wood of 14.
 */
export function broadleafGeometry(level: number): THREE.BufferGeometry {
  const { radius: R, centre, base } = BROADLEAF_SHAPE[level]!;
  const b = new TreeBuilder(centre);
  const crown: Part = { rgb: LEAF, wood: 0, crown: 1 };
  const shadeAt = (y: number): number => 0.68 + 0.5 * Math.min(1, Math.max(0, (y - (centre - R)) / (2 * R)));
  blob(b, crown, ICOSAHEDRON, [0, centre + R * 0.08, 0], R * 0.82, 0.9, shadeAt);
  blob(b, crown, OCTAHEDRON, [R * 0.5, centre - R * 0.18, R * 0.22], R * 0.52, 0.85, shadeAt);
  if (level === 0) blob(b, crown, OCTAHEDRON, [-R * 0.42, centre - R * 0.1, -R * 0.4], R * 0.5, 0.85, shadeAt);

  const bark: Part = { rgb: BROADLEAF_BARK, wood: 1, crown: 0 };
  cone(b, bark, level === 0 ? 5 : 4, 0.42, base, centre + R * 0.35, 0.2, { tipShade: 0.85, topShade: 1, star: false, droop: 0 });
  // Bare branches from the upper trunk, leaning out in different directions: each a thin three sided cone.
  const branches = level === 0 ? 4 : 3;
  const m = new THREE.Matrix4();
  const tmp = new THREE.Vector3();
  for (let k = 0; k < branches; k++) {
    const length = R * (1.05 - 0.12 * (k % 2));
    m.makeTranslation(0, centre * (0.5 + 0.08 * k), 0)
      .multiply(new THREE.Matrix4().makeRotationY((k * Math.PI * 2) / branches + 0.4))
      .multiply(new THREE.Matrix4().makeRotationZ(-0.8 + 0.1 * (k % 2)));
    const at = (v: Vec): Vec => {
      tmp.set(...v).applyMatrix4(m);
      return [tmp.x, tmp.y, tmp.z];
    };
    const tip = at([0, length, 0]);
    const foot = [0, 1, 2].map((i) => at(ring(0.15, (i * Math.PI * 2) / 3, 0)));
    const inside = at([0, length * 0.3, 0]);
    for (let i = 0; i < 3; i++) {
      const a = foot[i]!;
      const c = foot[(i + 1) % 3]!;
      // the face's slope decides its snow: only the upper faces of a branch hold any
      const n = cross(sub(c, a), sub(tip, a));
      const mid = sub([(a[0] + c[0] + tip[0]) / 3, (a[1] + c[1] + tip[1]) / 3, (a[2] + c[2] + tip[2]) / 3], inside);
      const up = (Math.sign(n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2]) * n[1]) / Math.hypot(...n);
      const snow = Math.min(1, Math.max(0, up * 1.6));
      b.tri(bark, { p: a, shade: 0.9, snow }, { p: c, shade: 0.9, snow }, { p: tip, shade: 1, snow }, inside);
    }
  }
  return b.build(true);
}
