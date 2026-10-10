// The beavers of the dream (docs/design/29_dream_candy_land.md): the player's beaver, and the marshmallow beavers, the
// same model in pastel colours, a little rounder, with pink cheeks and a squash and stretch when they hop. The parts of
// each model that move together are merged into one mesh, so a beaver costs seven draw calls instead of about thirty.
import * as THREE from 'three';
import { LEAP_TIME, MALLOW_COLOURS, type DreamBeaver, type Mallow } from '../sim/dream';
import { NOSE, TAIL, TEETH, createBeaverModel, type BeaverModel } from './beaverModel';
import type { Coat } from '../sim/family';

/** Seconds a marshmallow beaver squashes and stretches after a hop. */
export const HOP_SQUASH_SECONDS = 0.6;

/**
 * The height scale of a marshmallow beaver `age` seconds after a hop: up to about 1.15 (stretched) in the air, down to
 * about 0.9 (squashed) as it lands, and 1 before and after. Width scales by one over its square root, so it keeps its size.
 */
export function hopSquash(age: number | null): number {
  if (age === null || age < 0 || age >= HOP_SQUASH_SECONDS) return 1;
  const t = age / HOP_SQUASH_SECONDS;
  return 1 + 0.17 * Math.sin(t * Math.PI * 2) * (1 - t * 0.6);
}

/** How far a beaver leaping out of the chocolate tips its nose (radians, negative up): up as it leaves, down as it dives back. */
export function leapPitch(b: Pick<DreamBeaver, 'hopAt' | 'leap'>, time: number): number {
  if (!b.leap || b.hopAt === null) return 0;
  const p = (time - b.hopAt) / LEAP_TIME;
  return p <= 0 || p >= 1 ? 0 : -0.6 * Math.cos(Math.PI * p) * Math.sin(Math.PI * p) ** 0.5;
}

/** A marshmallow beaver is a little rounder than a real one. */
const ROUND = new THREE.Vector3(1.06, 0.95, 1.06);

/**
 * Merge the meshes hanging straight under each visible group of `root` into one mesh per group, coloured by its vertices,
 * with `material`. Groups that move (the head, the legs, the tail) stay groups, so the model still poses. Groups with fewer
 * than `least` meshes are left as they are. `recolour` may change a part's colour, by its colour. Hidden groups (things
 * carried in the mouth) are left alone. The old geometries and materials are freed, not the shared textures. `rounder` below 1
 * remakes the balls with that share of their faces.
 */
export function flatten(root: THREE.Object3D, material: THREE.Material, least = 2, recolour: (c: THREE.Color) => THREE.Color = (c) => c, rounder = 1): void {
  const holders: THREE.Object3D[] = [];
  const visit = (o: THREE.Object3D): void => {
    if (!o.visible) return;
    holders.push(o);
    for (const child of o.children) visit(child);
  };
  visit(root);
  for (const holder of holders) {
    const meshes = holder.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh && c.visible);
    if (meshes.length < least) continue;
    const parts = meshes.map((mesh) => {
      mesh.updateMatrix();
      // `rounder` below 1 makes the balls (most of a beaver) of fewer faces.
      const ball = mesh.geometry instanceof THREE.SphereGeometry && rounder < 1 ? mesh.geometry.parameters : null;
      const shape = ball ? new THREE.SphereGeometry(ball.radius, Math.max(6, Math.round(ball.widthSegments * rounder)), Math.max(4, Math.round(ball.heightSegments * rounder))) : mesh.geometry;
      const source = shape.index ? shape.toNonIndexed() : shape.clone();
      if (shape !== mesh.geometry) shape.dispose();
      source.applyMatrix4(mesh.matrix);
      const base = recolour((mesh.material as THREE.MeshLambertMaterial).color.clone());
      const own = source.getAttribute('color');
      const count = source.getAttribute('position').count;
      const colours = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = own ? own.getX(i) : 1;
        const g = own ? own.getY(i) : 1;
        const b = own ? own.getZ(i) : 1;
        colours.set([r * base.r, g * base.g, b * base.b], i * 3);
      }
      source.setAttribute('color', new THREE.BufferAttribute(colours, 3));
      const keep = (material as THREE.MeshLambertMaterial).map ? ['position', 'normal', 'color', 'uv'] : ['position', 'normal', 'color'];
      for (const name of Object.keys(source.attributes)) if (!keep.includes(name)) source.deleteAttribute(name);
      return source;
    });
    const merged = new THREE.Mesh(mergeAll(parts), material);
    for (const mesh of meshes) {
      holder.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    holder.add(merged);
  }
}

function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // The parts are all non indexed with the same attributes, so they join end to end.
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(parts[0]!.attributes)) {
    const size = parts[0]!.getAttribute(name).itemSize;
    const total = parts.reduce((n, g) => n + g.getAttribute(name).count, 0);
    const data = new Float32Array(total * size);
    let at = 0;
    for (const g of parts) {
      const a = g.getAttribute(name);
      for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) data[(at + i) * size + k] = a.getComponent(i, k);
      at += a.count;
    }
    out.setAttribute(name, new THREE.BufferAttribute(data, size));
  }
  for (const g of parts) g.dispose();
  return out;
}

/** The player's beaver in its own coat, merged for the dream. Its fur keeps the fur grain. */
export function dreamPlayer(coat: Coat): BeaverModel {
  const model = createBeaverModel(coat.coat);
  model.setCoat(coat.coat, coat.shade);
  let fur: THREE.Texture | null = null;
  model.group.traverse((o) => {
    if (!fur && o instanceof THREE.Mesh) fur = (o.material as THREE.MeshLambertMaterial).map;
  });
  flatten(model.group, new THREE.MeshLambertMaterial({ vertexColors: true, map: fur }));
  return model;
}

/** Pink cheeks, a rosy nose, white teeth, and a pastel tail for a marshmallow beaver. */
const BLUSH = 0xff9fbf;

/** A marshmallow beaver in the pastel coat `colour` (an index into `MALLOW_COLOURS`), merged for the dream. */
export function mallowModel(colour: number): BeaverModel {
  const coat = MALLOW_COLOURS[((colour % MALLOW_COLOURS.length) + MALLOW_COLOURS.length) % MALLOW_COLOURS.length]!;
  const model = createBeaverModel();
  model.setColours(coat);
  for (const s of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), new THREE.MeshLambertMaterial({ color: BLUSH }));
    cheek.position.set(s * 0.125, -0.005, 0.155);
    cheek.scale.set(0.045, 0.03, 0.012);
    cheek.lookAt(cheek.position.clone().add(new THREE.Vector3(s * 0.75, -0.05, 0.65)));
    model.head.add(cheek);
  }
  const tail = new THREE.Color(coat.dark).multiplyScalar(0.92);
  const recolour = (c: THREE.Color): THREE.Color => {
    const hex = c.getHex();
    if (hex === TEETH) return new THREE.Color(0xffffff);
    if (hex === NOSE) return new THREE.Color(0xc0607e);
    if (hex === TAIL) return tail.clone();
    return c;
  };
  // Soft and bright, as if lit from inside a little.
  flatten(model.group, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color(coat.fur).multiplyScalar(0.12) }), 1, recolour, 0.75);
  return model;
}

/** Beyond this many metres from the camera a marshmallow beaver is drawn as `mallowFar`, a few pixels tall anyway. */
export const FAR_MALLOW = 16;

/**
 * A marshmallow beaver for far away: a round body, a head with ears, a belly and a tail, in about 600 triangles and one
 * draw call. Same size and colours as `mallowModel`, standing on its origin and facing +z.
 */
export function mallowFar(colour: number): THREE.Mesh {
  const coat = MALLOW_COLOURS[((colour % MALLOW_COLOURS.length) + MALLOW_COLOURS.length) % MALLOW_COLOURS.length]!;
  const parts: THREE.BufferGeometry[] = [];
  const blob = (rx: number, ry: number, rz: number, hex: number, x: number, y: number, z: number): void => {
    const g = new THREE.SphereGeometry(1, 10, 7).toNonIndexed().scale(rx, ry, rz).translate(x, y, z);
    const c = new THREE.Color(hex);
    const n = g.getAttribute('position').count;
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).map((_, i) => [c.r, c.g, c.b][i % 3]!), 3));
    g.deleteAttribute('uv');
    parts.push(g);
  };
  blob(0.3, 0.25, 0.55, coat.fur, 0, 0.33, -0.05);
  blob(0.24, 0.12, 0.4, coat.belly, 0, 0.18, 0.02);
  blob(0.19, 0.17, 0.19, coat.fur, 0, 0.49, 0.5);
  blob(0.09, 0.07, 0.09, coat.belly, 0, 0.41, 0.68);
  for (const sx of [-1, 1]) blob(0.05, 0.05, 0.03, coat.dark, sx * 0.135, 0.61, 0.45);
  blob(0.17, 0.03, 0.25, new THREE.Color(coat.dark).multiplyScalar(0.92).getHex(), 0, 0.2, -0.8);
  for (const [x, z] of [[-0.16, 0.27], [0.16, 0.27], [-0.19, -0.3], [0.19, -0.3]] as const) blob(0.07, 0.12, 0.08, coat.dark, x, 0.1, z);
  const mesh = new THREE.Mesh(mergeAll(parts), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color(coat.fur).multiplyScalar(0.12) }));
  mesh.scale.copy(ROUND);
  return mesh;
}

/** Pose and place a marshmallow beaver at dream time `time`: rounder, with the squash and stretch of a fresh hop. */
export function placeMallow(model: BeaverModel, m: Mallow, time: number, y: number, slapAge: number | null): void {
  model.update(time, Math.min(1, m.speed / 4), m.mode, 0, slapAge, null, null);
  const s = hopSquash(m.hopAt === null ? null : time - m.hopAt);
  const w = 1 / Math.sqrt(s);
  model.group.position.set(m.x, y, m.z);
  model.group.rotation.set(leapPitch(m, time), m.heading, 0, 'YXZ');
  model.group.scale.set(ROUND.x * w, ROUND.y * s, ROUND.z * w);
}

/** Free a model's geometries and materials. Shared textures (the fur grain) are left, the waking game still uses them. */
export function disposeModel(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose();
    (o.material as THREE.Material).dispose();
  });
}
