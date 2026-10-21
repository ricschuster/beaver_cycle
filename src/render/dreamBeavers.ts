// The beavers of the dream (docs/design/29_dream_candy_land.md): the marshmallow beavers, the game's model in pastel
// colours, a little rounder, with pink cheeks and a squash and stretch when they hop, and the player as one more in the
// colours of the rainbow. The parts of each model that move together are merged into one mesh, so a beaver costs seven
// draw calls instead of about thirty.
import * as THREE from 'three';
import { DAM_LOGS, LEAP_TIME, LODGE_LOGS, MALLOW_COLOURS, type DreamBeaver, type DreamBuild, type Mallow } from '../sim/dream';
import { NOSE, TAIL, TEETH, createBeaverModel, type BeaverModel } from './beaverModel';

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

/** The hue of the rainbow (0 red to 0.8 violet) at `z` metres along a beaver in its own space: red at the nose, violet at the tail. */
export function rainbowHue(z: number): number {
  return 0.8 * Math.min(1, Math.max(0, (0.7 - z) / 1.6));
}

/** The player's beaver in the dream: a marshmallow beaver too, in the colours of the rainbow from nose to tail (the author, session 81). */
export function dreamPlayer(): BeaverModel {
  // A pale grey marshmallow beaver first, so the fur, the darker paws and ears, and the light belly keep their shading.
  const model = mallowModel(RAINBOW_BASE);
  model.group.updateMatrixWorld(true);
  const toModel = model.group.matrixWorld.clone().invert();
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  const hsl = { h: 0, s: 0, l: 0 };
  model.group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const colours = o.geometry.getAttribute('color');
    const positions = o.geometry.getAttribute('position');
    if (!colours) return;
    const m = o.matrixWorld.clone().premultiply(toModel);
    for (let i = 0; i < colours.count; i++) {
      c.fromBufferAttribute(colours as THREE.BufferAttribute, i);
      c.getHSL(hsl);
      // The eyes stay dark, and the white teeth, the rosy nose, and the pink cheeks keep their colour.
      if (hsl.l < 0.3 || hsl.l > 0.97 || hsl.s > 0.1) continue;
      p.fromBufferAttribute(positions as THREE.BufferAttribute, i).applyMatrix4(m);
      c.setHSL(rainbowHue(p.z), 0.85, 0.45 + 0.35 * hsl.l);
      colours.setXYZ(i, c.r, c.g, c.b);
    }
    colours.needsUpdate = true;
  });
  return model;
}

/** Pink cheeks, a rosy nose, white teeth, and a pastel tail for a marshmallow beaver. */
const BLUSH = 0xff9fbf;

/** The pale grey coat the player's rainbow is painted over: an index past the pastel coats of the others. */
const RAINBOW_BASE = -1;
const GREYS = { fur: 0xd9d9d9, dark: 0xbdbdbd, belly: 0xf2f2f2 };
/** The golden statue's coat, past the pastel ones and the rainbow's grey. */
const GOLDEN = -2;
const GOLDS = { fur: 0xf2c230, dark: 0xc9961a, belly: 0xffe58a };

/** A marshmallow beaver in the pastel coat `colour` (an index into `MALLOW_COLOURS`), merged for the dream. */
export function mallowModel(colour: number): BeaverModel {
  const coat = colour === RAINBOW_BASE ? GREYS : colour === GOLDEN ? GOLDS : MALLOW_COLOURS[((colour % MALLOW_COLOURS.length) + MALLOW_COLOURS.length) % MALLOW_COLOURS.length]!;
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

/** The golden beaver statue (wish 10): a golden marshmallow beaver on a round stone, a piece of wood across its mouth. Stands on its origin. */
export function goldenStatue(): THREE.Group {
  const model = mallowModel(GOLDEN);
  model.update(0, 0);
  model.group.position.y = 0.18;
  const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 8).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xb98a4e }));
  wood.position.set(0, -0.06, 0.2);
  model.head.add(wood);
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.2, 14), new THREE.MeshLambertMaterial({ color: 0xf4f0ff }));
  stone.position.y = 0.1;
  const group = new THREE.Group();
  group.add(stone, model.group);
  return group;
}

const LOG_COLOURS = [0xc9895a, 0xf0a0c0, 0xb98a4e];

/**
 * The candy dam or lodge as far as it has got (`build.logs` logs on), standing on its origin. The dam lies across the river along
 * `build.heading`, its logs in a stack of two and one. The lodge is a round iced dome that grows with each log, sticks round its foot.
 */
export function candyBuild(build: DreamBuild, riverWidth: number): THREE.Group {
  const group = new THREE.Group();
  const stripe = (i: number): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color: LOG_COLOURS[i % LOG_COLOURS.length]! });
  if (build.kind === 'dam') {
    const length = riverWidth + 3;
    const spots = [{ along: -0.45, y: 0.3 }, { along: 0.45, y: 0.3 }, { along: 0, y: 0.95 }];
    for (let i = 0; i < Math.min(build.logs, DAM_LOGS); i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, length, 10).rotateZ(Math.PI / 2), stripe(i));
      log.position.set(0, spots[i]!.y, spots[i]!.along);
      group.add(log);
    }
    // The cylinders lie along x; turn the group so that axis is across the river.
    group.rotation.y = build.heading - Math.PI / 2;
    return group;
  }
  const grown = Math.min(build.logs, LODGE_LOGS) / LODGE_LOGS;
  const r = 0.8 + 1.1 * grown;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xf6b8d2 }));
  group.add(dome);
  for (let i = 0; i < build.logs * 3; i++) {
    const a = (i / (build.logs * 3)) * Math.PI * 2;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 6), stripe(i));
    stick.position.set(Math.sin(a) * r * 0.95, 0.35, Math.cos(a) * r * 0.95);
    stick.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
    group.add(stick);
  }
  return group;
}
