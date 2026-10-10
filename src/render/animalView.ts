// Draws the ambient animals (src/sim/animals.ts) from rounded shapes at about the detail of the beaver model: ellipsoid
// bodies, legs that swing, a head with eyes and ears, and a small idle motion for each kind. Each animal gets a model, made
// when first seen and kept for the next animal of its kind. Reads state only.
import * as THREE from 'three';
import type { Animal, AnimalKind } from '../sim/animals';
import { ellipsoid, part } from './beaverModel';

export interface AnimalView {
  /** Place the animals of this frame. `now` is the real time in seconds, for the walking and the idle motion. */
  update(animals: readonly Animal[], now: number): void;
}

interface AnimalModel {
  group: THREE.Group;
  /** Poses the model: `time` in seconds, `walk` 1 while it moves and 0 while it grazes or stands, eased by the model. */
  pose(time: number, moving: boolean, seed: number): void;
}

const EYE = 0x120d0a;

/** A leg hinged at the top: swings about x. The capsule hangs from the hinge, and a hoof or foot ends it. */
function leg(x: number, y: number, z: number, length: number, radius: number, colour: number, foot: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.add(part(new THREE.CapsuleGeometry(radius, length - radius * 2, 4, 8), colour, 0, -length / 2, 0));
  g.add(ellipsoid(radius * 1.25, radius * 0.7, foot, colour === foot ? colour : 0x2a2018, 0, -length + radius * 0.4, foot * 0.4));
  return g;
}

function eyes(head: THREE.Group, x: number, y: number, z: number, r: number): void {
  for (const s of [-1, 1]) head.add(part(new THREE.SphereGeometry(r, 8, 6), EYE, s * x, y, z));
}

/** Eases a 0 to 1 value toward its target over a fraction of a second. */
function easer(): (target: number, time: number) => number {
  let value = 0;
  let last = 0;
  return (target, time) => {
    const dt = Math.min(Math.max(time - last, 0), 0.1);
    last = time;
    value += (target - value) * Math.min(1, dt * 6);
    return value;
  };
}

function deerModel(): AnimalModel {
  const FUR = 0x9a6a3e;
  const DARK = 0x6e4a2a;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  body.add(ellipsoid(0.26, 0.28, 0.7, FUR, 0, 1.0, 0));
  body.add(ellipsoid(0.22, 0.12, 0.55, 0xcdb58e, 0, 0.82, 0.02));
  body.add(ellipsoid(0.2, 0.2, 0.12, 0xf0e4cc, 0, 1.0, -0.66));
  // Neck and head hinge at the shoulders so the head can dip to graze.
  const neck = new THREE.Group();
  neck.position.set(0, 1.12, 0.55);
  body.add(neck);
  neck.add(ellipsoid(0.13, 0.4, 0.15, FUR, 0, 0.22, 0.06));
  const head = new THREE.Group();
  head.position.set(0, 0.48, 0.14);
  neck.add(head);
  head.add(ellipsoid(0.12, 0.13, 0.2, FUR, 0, 0, 0.05));
  head.add(ellipsoid(0.075, 0.075, 0.14, 0xc7a47a, 0, -0.04, 0.24));
  head.add(part(new THREE.SphereGeometry(0.035, 8, 6), 0x15100c, 0, -0.02, 0.37));
  eyes(head, 0.1, 0.05, 0.1, 0.03);
  for (const s of [-1, 1]) {
    const ear = ellipsoid(0.04, 0.11, 0.025, DARK, s * 0.14, 0.17, -0.04);
    ear.rotation.z = -s * 0.7;
    head.add(ear);
    // A short antler, a tine and a point, on the stag's head.
    const antler = part(new THREE.CylinderGeometry(0.012, 0.02, 0.26, 5), 0xd8ccb0, s * 0.07, 0.25, -0.06);
    antler.rotation.z = -s * 0.25;
    head.add(antler);
  }
  const legs = [leg(-0.14, 0.9, 0.42, 0.9, 0.05, DARK, 0.06), leg(0.14, 0.9, 0.42, 0.9, 0.05, DARK, 0.06), leg(-0.14, 0.9, -0.45, 0.9, 0.055, DARK, 0.06), leg(0.14, 0.9, -0.45, 0.9, 0.055, DARK, 0.06)];
  group.add(...legs);
  const tail = ellipsoid(0.05, 0.07, 0.04, 0xf0e4cc, 0, 1.12, -0.78);
  body.add(tail);
  const walk = easer();
  const graze = easer();
  return {
    group,
    pose(time, moving, seed) {
      const w = walk(moving ? 1 : 0, time);
      const g = graze(moving ? 0 : 1, time);
      const phase = time * 5 + seed;
      body.position.y = Math.abs(Math.sin(phase)) * 0.025 * w;
      legs.forEach((l, i) => (l.rotation.x = Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.5 * w));
      // Grazing: the neck lowers and the head follows the grass; walking, the head nods.
      neck.rotation.x = 0.15 * w + 0.95 * g;
      head.rotation.x = Math.sin(phase * 0.5) * 0.06 * w - 0.2 * g + Math.sin(time * 1.3 + seed) * 0.06 * g;
      tail.rotation.x = Math.sin(time * 2 + seed) * 0.2 * g;
    },
  };
}

function foxModel(): AnimalModel {
  const FUR = 0xd2702a;
  const SOCK = 0x2c2018;
  const WHITE = 0xf2eadc;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  body.add(ellipsoid(0.15, 0.15, 0.4, FUR, 0, 0.42, 0));
  body.add(ellipsoid(0.12, 0.08, 0.3, WHITE, 0, 0.32, 0.04));
  const head = new THREE.Group();
  head.position.set(0, 0.52, 0.36);
  body.add(head);
  head.add(ellipsoid(0.11, 0.1, 0.13, FUR, 0, 0, 0));
  head.add(ellipsoid(0.055, 0.05, 0.12, FUR, 0, -0.025, 0.14));
  head.add(ellipsoid(0.1, 0.05, 0.07, WHITE, 0, -0.05, 0.05));
  head.add(part(new THREE.SphereGeometry(0.022, 8, 6), 0x0d0a08, 0, -0.01, 0.26));
  eyes(head, 0.06, 0.03, 0.1, 0.018);
  for (const s of [-1, 1]) {
    const ear = part(new THREE.ConeGeometry(0.05, 0.14, 6), FUR, s * 0.065, 0.12, -0.02);
    ear.rotation.z = -s * 0.2;
    head.add(ear);
    head.add(part(new THREE.ConeGeometry(0.025, 0.05, 6), SOCK, s * 0.075, 0.18, -0.02));
  }
  const legs = [leg(-0.09, 0.32, 0.22, 0.32, 0.03, SOCK, 0.045), leg(0.09, 0.32, 0.22, 0.32, 0.03, SOCK, 0.045), leg(-0.09, 0.32, -0.22, 0.32, 0.03, SOCK, 0.045), leg(0.09, 0.32, -0.22, 0.32, 0.03, SOCK, 0.045)];
  group.add(...legs);
  // A bushy tail with a white tip, hinged at the rump.
  const tail = new THREE.Group();
  tail.position.set(0, 0.44, -0.38);
  body.add(tail);
  tail.add(ellipsoid(0.08, 0.08, 0.3, FUR, 0, 0, -0.24));
  tail.add(ellipsoid(0.065, 0.065, 0.1, WHITE, 0, 0, -0.5));
  const walk = easer();
  return {
    group,
    pose(time, moving, seed) {
      const w = walk(moving ? 1 : 0, time);
      const phase = time * 9 + seed;
      body.position.y = Math.abs(Math.sin(phase)) * 0.03 * w;
      legs.forEach((l, i) => (l.rotation.x = Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.7 * w));
      // Standing, the fox looks about; trotting, the nose is low and the tail streams out.
      head.rotation.y = Math.sin(time * 0.9 + seed) * 0.5 * (1 - w);
      head.rotation.x = 0.1 * w - Math.sin(time * 0.6 + seed) * 0.08 * (1 - w);
      tail.rotation.x = -0.2 * w + 0.5 * (1 - w) + Math.sin(time * 2.2 + seed) * 0.05;
      tail.rotation.y = Math.sin(time * 1.5 + seed) * 0.25 * (1 - w);
    },
  };
}

function duckModel(): AnimalModel {
  const BROWN = 0x8a6e4e;
  const GREEN = 0x2f6a4a;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  body.add(ellipsoid(0.17, 0.12, 0.3, BROWN, 0, 0.1, 0));
  body.add(ellipsoid(0.15, 0.06, 0.22, 0xd8d0c0, 0, 0.04, 0.02));
  // Folded wings with a blue patch, and a tail that sticks up.
  for (const s of [-1, 1]) {
    body.add(ellipsoid(0.04, 0.09, 0.2, 0x6e5a42, s * 0.15, 0.13, -0.04));
    body.add(ellipsoid(0.02, 0.03, 0.06, 0x3a5ea0, s * 0.18, 0.14, -0.1));
  }
  const tail = ellipsoid(0.07, 0.04, 0.09, 0x2a2420, 0, 0.17, -0.32);
  tail.rotation.x = -0.5;
  body.add(tail);
  const neck = new THREE.Group();
  neck.position.set(0, 0.17, 0.2);
  body.add(neck);
  neck.add(ellipsoid(0.055, 0.1, 0.055, GREEN, 0, 0.09, 0.03));
  neck.add(ellipsoid(0.058, 0.01, 0.058, 0xf4f0e8, 0, 0.02, 0.03));
  const head = new THREE.Group();
  head.position.set(0, 0.2, 0.05);
  neck.add(head);
  head.add(ellipsoid(0.07, 0.065, 0.09, GREEN, 0, 0, 0));
  head.add(ellipsoid(0.04, 0.015, 0.07, 0xe0b020, 0, -0.015, 0.12));
  eyes(head, 0.05, 0.02, 0.04, 0.012);
  const walk = easer();
  return {
    group,
    pose(time, moving, seed) {
      const w = walk(moving ? 1 : 0, time);
      // Afloat: a slow bob and a little roll, the head turning now and then and dipping to feed when still.
      body.position.y = Math.sin(time * 2.2 + seed) * 0.01;
      body.rotation.z = Math.sin(time * 1.4 + seed) * 0.03;
      body.rotation.x = -0.05 * w;
      neck.rotation.x = 0.1 * w + 0.9 * Math.max(0, Math.sin(time * 0.4 + seed * 3)) ** 6 * (1 - w);
      head.rotation.y = Math.sin(time * 0.8 + seed) * 0.5 * (1 - w);
    },
  };
}

function heronModel(): AnimalModel {
  const GREY = 0x8c9aa8;
  const LEG = 0xc2a860;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  for (const s of [-1, 1]) {
    // Long thin legs with a knee, ending in a foot.
    group.add(part(new THREE.CylinderGeometry(0.014, 0.018, 0.5, 6), LEG, s * 0.05, 0.3, 0));
    group.add(part(new THREE.CylinderGeometry(0.012, 0.014, 0.3, 6), LEG, s * 0.05, 0.62, 0.02));
    group.add(ellipsoid(0.05, 0.015, 0.1, LEG, s * 0.05, 0.02, 0.05));
  }
  body.add(ellipsoid(0.12, 0.17, 0.3, GREY, 0, 0.9, 0));
  body.add(ellipsoid(0.1, 0.1, 0.2, 0xe4e8ea, 0, 0.86, 0.12));
  for (const s of [-1, 1]) body.add(ellipsoid(0.04, 0.13, 0.27, 0x5e6c7a, s * 0.12, 0.92, -0.02));
  const tail = ellipsoid(0.05, 0.03, 0.12, GREY, 0, 0.88, -0.32);
  body.add(tail);
  // An S shaped neck in two parts: the base leans forward and the top comes back up, ending in the head and a long bill.
  const neck = new THREE.Group();
  neck.position.set(0, 1.0, 0.22);
  body.add(neck);
  const lower = ellipsoid(0.035, 0.2, 0.035, 0xe9eaea, 0, 0.14, 0.04);
  lower.rotation.x = 0.5;
  neck.add(lower);
  const upper = new THREE.Group();
  upper.position.set(0, 0.3, 0.12);
  neck.add(upper);
  const mid = ellipsoid(0.03, 0.17, 0.03, 0xe9eaea, 0, 0.1, -0.02);
  mid.rotation.x = -0.35;
  upper.add(mid);
  const head = new THREE.Group();
  head.position.set(0, 0.26, -0.06);
  upper.add(head);
  head.add(ellipsoid(0.045, 0.04, 0.08, 0xf0f0ee, 0, 0, 0.02));
  const bill = part(new THREE.ConeGeometry(0.022, 0.26, 6), 0xe0b040, 0, -0.005, 0.18);
  bill.rotation.x = Math.PI / 2;
  head.add(bill);
  head.add(ellipsoid(0.02, 0.015, 0.14, 0x1c1c20, 0, 0.04, -0.12));
  eyes(head, 0.036, 0.015, 0.05, 0.011);
  return {
    group,
    pose(time, _moving, seed) {
      // Standing still: the neck sways slowly, and now and then the head darts forward and down toward the water.
      const strike = Math.max(0, Math.sin(time * 0.35 + seed * 2)) ** 24;
      neck.rotation.x = 0.05 * Math.sin(time * 0.7 + seed) + 0.6 * strike;
      upper.rotation.x = 0.4 * strike;
      head.rotation.y = Math.sin(time * 0.5 + seed) * 0.3;
      body.rotation.x = 0.1 * strike;
    },
  };
}

function owlModel(): AnimalModel {
  const BROWN = 0x7a6246;
  const PALE = 0xd9cdb4;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  // Perched, the owl stands upright: a tall body, pale at the chest, on two feet. In flight the group tilts forward.
  body.add(ellipsoid(0.16, 0.26, 0.15, BROWN, 0, 0.3, 0));
  body.add(ellipsoid(0.12, 0.2, 0.08, PALE, 0, 0.3, 0.1));
  for (const s of [-1, 1]) body.add(ellipsoid(0.04, 0.04, 0.07, 0xc2a860, s * 0.06, 0.02, 0.04));
  const tail = ellipsoid(0.08, 0.02, 0.15, 0x5e4a32, 0, 0.06, -0.12);
  tail.rotation.x = -0.3;
  body.add(tail);
  const head = new THREE.Group();
  head.position.set(0, 0.6, 0.02);
  body.add(head);
  head.add(ellipsoid(0.15, 0.13, 0.13, BROWN, 0, 0, 0));
  // A pale round face with big dark eyes and a short hooked beak, and two ear tufts.
  head.add(ellipsoid(0.13, 0.11, 0.04, PALE, 0, -0.01, 0.1));
  eyes(head, 0.06, 0.01, 0.13, 0.04);
  for (const s of [-1, 1]) head.add(part(new THREE.SphereGeometry(0.014, 6, 4), 0xe8c040, s * 0.06, 0.012, 0.165));
  const beak = part(new THREE.ConeGeometry(0.02, 0.05, 5), 0xd8c070, 0, -0.03, 0.17);
  beak.rotation.x = Math.PI / 2;
  head.add(beak);
  for (const s of [-1, 1]) {
    const tuft = part(new THREE.ConeGeometry(0.03, 0.09, 5), BROWN, s * 0.09, 0.14, 0);
    tuft.rotation.z = -s * 0.3;
    head.add(tuft);
  }
  // Wings hinged at the shoulders: folded at the sides when perched, spread and flapping in flight.
  const wings = [-1, 1].map((s) => {
    const w = new THREE.Group();
    w.position.set(s * 0.14, 0.45, 0);
    w.add(ellipsoid(0.34, 0.015, 0.14, BROWN, s * 0.34, 0, 0));
    w.add(ellipsoid(0.2, 0.012, 0.1, PALE, s * 0.36, -0.01, -0.02));
    body.add(w);
    return w;
  });
  const fly = easer();
  return {
    group,
    pose(time, moving, seed) {
      const f = fly(moving ? 1 : 0, time);
      body.rotation.x = 0.9 * f;
      body.position.y = 0.1 * f;
      // Folded wings hang down by the body (rotation about z, steep), spread ones beat up and down.
      const beat = Math.sin(time * 9 + seed) * 0.5 * f;
      wings.forEach((w, i) => {
        const s = i === 0 ? -1 : 1;
        w.rotation.z = s * (-1.4 * (1 - f) + beat);
      });
      // Perched, the head turns slowly to look about; in flight it stays on the prey.
      head.rotation.y = Math.sin(time * 0.6 + seed) * 1.1 * (1 - f);
      head.rotation.x = -0.9 * f;
    },
  };
}

const MAKERS: Record<AnimalKind, () => AnimalModel> = { deer: deerModel, fox: foxModel, duck: duckModel, heron: heronModel, owl: owlModel };

/** A number in [0, 7) from an animal's cell id, so animals of a kind do not move in step. */
function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 700) / 100;
}

export function createAnimalView(scene: THREE.Scene, prepare: (m: THREE.Material) => void): AnimalView {
  // Spare models of each kind, and the ones now in use by animal id.
  const spare: Record<AnimalKind, AnimalModel[]> = { deer: [], fox: [], duck: [], heron: [], owl: [] };
  const used = new Map<string, { kind: AnimalKind; model: AnimalModel; seed: number }>();
  const release = (id: string): void => {
    const entry = used.get(id)!;
    entry.model.group.visible = false;
    spare[entry.kind].push(entry.model);
    used.delete(id);
  };
  const make = (kind: AnimalKind): AnimalModel => {
    const model = MAKERS[kind]();
    model.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        prepare(o.material as THREE.Material);
      }
    });
    scene.add(model.group);
    return model;
  };
  return {
    update(animals, now) {
      const seen = new Set<string>();
      for (const a of animals) {
        seen.add(a.id);
        let entry = used.get(a.id);
        if (entry && entry.kind !== a.kind) {
          release(a.id);
          entry = undefined;
        }
        if (!entry) {
          entry = { kind: a.kind, model: spare[a.kind].pop() ?? make(a.kind), seed: seedOf(a.id) };
          used.set(a.id, entry);
        }
        const g = entry.model.group;
        g.visible = true;
        g.position.set(a.x, a.y, a.z);
        g.rotation.y = a.heading;
        entry.model.pose(now, a.moving, entry.seed);
      }
      for (const id of [...used.keys()]) if (!seen.has(id)) release(id);
    },
  };
}
