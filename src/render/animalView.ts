// Draws the ambient animals (src/sim/animals.ts) in the stylized look of the beaver model (#105): bodies swept along a
// curve with the colours painted in (a pale belly, the deer's white rump, the fox's white tail tip), fur and feather
// grain, slim legs that swing, flat ears, wings, and bills, eyes with a glint, and a small idle motion for each kind.
// Each animal gets a model, made when first seen and kept for the next animal of its kind. Reads state only.
import * as THREE from 'three';
import type { Animal, AnimalKind } from '../sim/animals';
import { blob, coated, dome, eye, flat, mix, outline, painted, path, plain, smoothstep, sweep, type Grain, type SweepOptions } from './modelKit';

export interface AnimalView {
  /** Place the animals of this frame. `now` is the real time in seconds, for the walking and the idle motion. */
  update(animals: readonly Animal[], now: number): void;
}

export interface AnimalModel {
  group: THREE.Group;
  /** Poses the model: `time` in seconds, `walk` 1 while it moves and 0 while it grazes or stands, eased by the model. */
  pose(time: number, moving: boolean, seed: number): void;
}

type Paint = NonNullable<SweepOptions['paint']>;

/** A swept tube with painted colours and a grain. */
function tube(points: THREE.Vector3[], radius: (t: number) => [number, number], paint: Paint, kind: Grain = 'fur', radial = 12, steps = 16): THREE.Mesh {
  return coated(sweep(points, radius, { paint, radial, steps }), 0xffffff, kind);
}

/** One colour all over, for `tube`. */
function one(colour: number): Paint {
  const c = new THREE.Color(colour);
  return () => c;
}

/** A group at a place: a hinge for a leg, a neck, a tail, or a wing. */
function hinge(x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  return g;
}

/**
 * A leg hinged at the top that swings about x: a tube down the `points` (from the hinge, ending at the ground),
 * thick at the top as the thigh or shoulder and slim below, painted from `top` to `low` toward the foot.
 */
function limb(x: number, y: number, z: number, points: THREE.Vector3[], thick: [number, number], slim: number, top: number, low: number, kind: Grain = 'fur'): THREE.Group {
  const g = hinge(x, y, z);
  const radius = (t: number): [number, number] => {
    const f = 1 - smoothstep(0, 0.45, t);
    return [slim + (thick[0] - slim) * f, slim + (thick[1] - slim) * f];
  };
  g.add(tube(points, radius, (t) => mix(top, low, smoothstep(0.3, 0.65, t)), kind, 10, 12));
  return g;
}

/** Pair of mirrored parts: makes one for the right (s = 1) and one for the left (s = -1). */
function pair<T>(make: (s: number) => T): T[] {
  return [make(-1), make(1)];
}

/** A flat piece mirrored for the left side: a negative x scale, which three.js draws with the faces still outward. */
function side<T extends THREE.Object3D>(o: T, s: number): T {
  o.scale.x *= s;
  return o;
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

/** A leaf shaped ear `w` wide and `h` tall, standing in the xy plane from its base, painted `tip` toward the top. */
function earShape(w: number, h: number, colour: number, tip: number, from = 0.65): THREE.BufferGeometry {
  const s = outline([[0, 0], [w * 0.5, h * 0.25], [w * 0.4, h * 0.7], [0, h], [-w * 0.4, h * 0.7], [-w * 0.5, h * 0.25], [0, 0]]);
  return painted(flat(s, Math.max(0.008, w * 0.15), 4), (_x, y) => mix(colour, tip, smoothstep(h * from, h * (from + 0.15), y)));
}

/** The four legs walk in diagonal pairs: front left with hind right. */
function swingLegs(legs: THREE.Group[], phase: number, amount: number): void {
  legs.forEach((l, i) => (l.rotation.x = Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI)) * amount));
}

/** The roe deer: a slim brown body with a white rump, a long neck, big ears, short antlers, and slim legs with hooves. */
function deerModel(): AnimalModel {
  const FUR = 0x9a6a3e;
  const DARK = 0x6e4a2a;
  const BELLY = 0xcdb58e;
  const WHITE = 0xf0e4cc;
  const HOOF = 0x2a2018;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  body.add(
    tube(
      path([0, 1.02, -0.72], [0, 1.03, -0.4], [0, 1.0, 0.1], [0, 1.02, 0.45], [0, 1.08, 0.68]),
      (t) => {
        const d = dome(t, 0.16, 0.2);
        const chest = smoothstep(0.35, 0.75, t);
        return [(0.2 + 0.03 * chest) * d, (0.23 + 0.06 * chest) * d];
      },
      (t, up) => mix(FUR, BELLY, smoothstep(-0.25, -0.65, up)).lerp(new THREE.Color(WHITE), smoothstep(0.13, 0.04, t) * smoothstep(-0.9, -0.4, up)),
      'fur',
      14,
      20,
    ),
  );
  // Neck and head hinge at the shoulders so the head can dip to graze.
  const neck = hinge(0, 1.12, 0.55);
  body.add(neck);
  neck.add(tube(path([0, -0.14, -0.06], [0, 0.12, 0.04], [0, 0.32, 0.1], [0, 0.48, 0.13]), (t) => [0.1 - 0.035 * t, 0.15 - 0.07 * t], (_t, up) => mix(FUR, BELLY, smoothstep(-0.5, -0.95, up) * 0.8), 'fur', 10, 8));
  const head = hinge(0, 0.48, 0.14);
  head.name = 'head';
  neck.add(head);
  head.add(
    tube(
      path([0, 0.04, -0.1], [0, 0.03, 0.04], [0, -0.02, 0.18], [0, -0.05, 0.31]),
      (t) => {
        const d = dome(t, 0.3, 0.12);
        const snout = 1 - 0.45 * smoothstep(0.3, 1, t);
        return [0.1 * d * snout, 0.11 * d * (1 - 0.35 * smoothstep(0.3, 1, t))];
      },
      (t, up) => mix(FUR, WHITE, smoothstep(-0.35, -0.75, up) * smoothstep(0.55, 0.8, t)),
      'fur',
      12,
      12,
    ),
  );
  head.add(blob(0.035, 0.028, 0.025, 0x15100c, 0, -0.035, 0.31, 8, null));
  for (const s of [-1, 1]) {
    head.add(eye(0.026, s, 0.078, 0.04, 0.09));
    const ear = coated(earShape(0.1, 0.19, FUR, DARK), 0xffffff);
    ear.position.set(s * 0.06, 0.09, -0.05);
    ear.rotation.set(-0.15, s * 0.5, -s * 0.75);
    head.add(ear);
    // A short antler with a front tine and a back tine, on the buck's head.
    const antler = new THREE.Group();
    antler.position.set(s * 0.045, 0.1, -0.03);
    antler.rotation.set(-0.2, 0, -s * 0.2);
    antler.add(plain(new THREE.CylinderGeometry(0.011, 0.018, 0.24, 5).translate(0, 0.12, 0), 0xd8ccb0, 0, 0, 0));
    antler.add(plain(new THREE.TorusGeometry(0.02, 0.008, 4, 6).rotateX(Math.PI / 2), 0xb8a888, 0, 0.02, 0));
    const front = plain(new THREE.CylinderGeometry(0.007, 0.011, 0.08, 4).translate(0, 0.04, 0), 0xd8ccb0, 0, 0.12, 0);
    front.rotation.x = 0.9;
    const back = plain(new THREE.CylinderGeometry(0.006, 0.01, 0.07, 4).translate(0, 0.035, 0), 0xd8ccb0, 0, 0.19, 0);
    back.rotation.x = -0.9;
    antler.add(front, back);
    head.add(antler);
  }
  const front = (x: number): THREE.Group => {
    const l = limb(x, 0.9, 0.42, path([0, 0.12, 0], [0, -0.25, 0.02], [0, -0.55, 0.0], [0, -0.85, 0.01]), [0.07, 0.1], 0.026, FUR, DARK);
    l.add(plain(new THREE.CylinderGeometry(0.022, 0.03, 0.06, 6), HOOF, 0, -0.87, 0.012));
    return l;
  };
  const hind = (x: number): THREE.Group => {
    // The hind leg bends back at the hock.
    const l = limb(x, 0.9, -0.45, path([0, 0.15, 0.04], [0, -0.2, -0.04], [0, -0.45, -0.12], [0, -0.85, -0.05]), [0.085, 0.14], 0.028, FUR, DARK);
    l.add(plain(new THREE.CylinderGeometry(0.022, 0.03, 0.06, 6), HOOF, 0, -0.87, -0.04));
    return l;
  };
  const legs = [front(-0.13), front(0.13), hind(-0.13), hind(0.13)];
  group.add(...legs);
  const tail = blob(0.045, 0.06, 0.035, WHITE, 0, 1.1, -0.74, 8);
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
      swingLegs(legs, phase, 0.5 * w);
      // Grazing: the neck lowers and the head follows the grass; walking, the head nods.
      neck.rotation.x = 0.15 * w + 0.95 * g;
      head.rotation.x = Math.sin(phase * 0.5) * 0.06 * w - 0.2 * g + Math.sin(time * 1.3 + seed) * 0.06 * g;
      tail.rotation.x = Math.sin(time * 2 + seed) * 0.2 * g;
    },
  };
}

/** The red fox: orange with a white chest and chin, pointed black-backed ears, dark socks, and a bushy tail with a white tip. */
function foxModel(): AnimalModel {
  const FUR = 0xd2702a;
  const PALE = 0xe8b07a;
  const SOCK = 0x2c2018;
  const WHITE = 0xf2eadc;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  body.add(
    tube(
      path([0, 0.44, -0.4], [0, 0.44, -0.12], [0, 0.42, 0.16], [0, 0.45, 0.36]),
      (t) => {
        const d = dome(t, 0.2, 0.25);
        return [0.12 * d, (0.13 + 0.02 * smoothstep(0.4, 0.8, t)) * d];
      },
      (t, up) => mix(FUR, PALE, smoothstep(-0.3, -0.75, up)).lerp(new THREE.Color(WHITE), smoothstep(-0.2, -0.6, up) * smoothstep(0.55, 0.85, t)),
      'fur',
      12,
      18,
    ),
  );
  // The neck rises from the chest into the head, white at the throat.
  body.add(tube(path([0, 0.42, 0.24], [0, 0.48, 0.33], [0, 0.53, 0.38]), () => [0.08, 0.095], (_t, up) => mix(FUR, WHITE, smoothstep(-0.2, -0.6, up)), 'fur', 10, 6));
  const head = hinge(0, 0.52, 0.36);
  head.name = 'head';
  body.add(head);
  head.add(
    tube(
      path([0, 0.015, -0.09], [0, 0.005, 0.03], [0, -0.025, 0.15], [0, -0.04, 0.26]),
      (t) => {
        const d = dome(t, 0.35, 0.06);
        return [0.1 * d * (1 - 0.78 * smoothstep(0.2, 1, t)), 0.09 * d * (1 - 0.62 * smoothstep(0.25, 1, t))];
      },
      (t, up) => mix(FUR, WHITE, smoothstep(0.05, -0.35, up) * smoothstep(0.15, 0.4, t)),
      'fur',
      12,
      14,
    ),
  );
  head.add(blob(0.022, 0.018, 0.018, 0x0d0a08, 0, -0.035, 0.262, 8, null));
  for (const s of [-1, 1]) {
    // White cheeks, an amber eye, and a big pointed ear, black at the back of the tip.
    head.add(blob(0.05, 0.045, 0.06, WHITE, s * 0.065, -0.045, 0.01, 8));
    head.add(eye(0.019, s, 0.055, 0.03, 0.1, 0xd88a28));
    const ear = coated(earShape(0.1, 0.15, FUR, SOCK, 0.55), 0xffffff);
    ear.position.set(s * 0.055, 0.06, -0.03);
    ear.rotation.set(-0.15, s * 0.3, -s * 0.28);
    head.add(ear);
  }
  const front = (x: number): THREE.Group => {
    const l = limb(x, 0.32, 0.22, path([0, 0.07, 0], [0, -0.14, 0.01], [0, -0.3, 0.02]), [0.045, 0.06], 0.02, FUR, SOCK);
    l.add(blob(0.026, 0.018, 0.036, SOCK, 0, -0.305, 0.03, 8));
    return l;
  };
  const hind = (x: number): THREE.Group => {
    const l = limb(x, 0.32, -0.24, path([0, 0.09, 0.02], [0, -0.08, -0.03], [0, -0.18, -0.06], [0, -0.3, -0.02]), [0.055, 0.085], 0.021, FUR, SOCK);
    l.add(blob(0.026, 0.018, 0.036, SOCK, 0, -0.305, 0.0, 8));
    return l;
  };
  const legs = [front(-0.075), front(0.075), hind(-0.075), hind(0.075)];
  group.add(...legs);
  // A bushy tail with a white tip, hinged at the rump.
  const tail = hinge(0, 0.44, -0.38);
  body.add(tail);
  tail.add(
    tube(
      path([0, 0, 0.04], [0, -0.05, -0.2], [0, -0.06, -0.4], [0, -0.03, -0.6]),
      (t) => {
        const r = (0.035 + 0.07 * smoothstep(0, 0.55, t)) * dome(t, 0, 0.3);
        return [r, r * 1.05];
      },
      (t) => mix(FUR, WHITE, smoothstep(0.8, 0.86, t)),
      'fur',
      12,
      14,
    ),
  );
  const walk = easer();
  return {
    group,
    pose(time, moving, seed) {
      const w = walk(moving ? 1 : 0, time);
      const phase = time * 9 + seed;
      body.position.y = Math.abs(Math.sin(phase)) * 0.03 * w;
      swingLegs(legs, phase, 0.7 * w);
      // Standing, the fox looks about; trotting, the nose is low and the tail streams out.
      head.rotation.y = Math.sin(time * 0.9 + seed) * 0.5 * (1 - w);
      head.rotation.x = 0.1 * w - Math.sin(time * 0.6 + seed) * 0.08 * (1 - w);
      tail.rotation.x = -0.2 * w + 0.5 * (1 - w) + Math.sin(time * 2.2 + seed) * 0.05;
      tail.rotation.y = Math.sin(time * 1.5 + seed) * 0.25 * (1 - w);
    },
  };
}

/** A folded bird wing: a long pointed blade, `length` back from the shoulder, painted by `paint` along it (0 at the shoulder, 1 at the tip). */
function foldedWing(length: number, width: number, paint: (along: number, across: number) => THREE.Color): THREE.BufferGeometry {
  const s = outline([[0, 0], [width * 0.55, length * 0.25], [width * 0.45, length * 0.7], [width * 0.1, length], [-width * 0.25, length * 0.55], [-width * 0.3, length * 0.15], [0, 0]]);
  // Drawn with the length along y, then laid back along -z with the thickness up.
  return painted(flat(s, 0.012, 4, 0.12), (x, y) => paint(y / length, (x + width * 0.3) / (width * 0.85))).rotateX(-Math.PI / 2);
}

/** The mallard drake: a grey boat of a body with a chestnut breast, a green head, a white neck ring, and a yellow bill. */
function duckModel(): AnimalModel {
  const GREY = 0xbdb8ae;
  const BACK = 0x7a6a58;
  const BREAST = 0x6e3a24;
  const BLACK = 0x1e1e22;
  const GREEN = 0x1f6a4a;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  body.add(
    tube(
      path([0, 0.15, -0.33], [0, 0.11, -0.15], [0, 0.1, 0.08], [0, 0.13, 0.27]),
      (t) => {
        const d = dome(t, 0.28, 0.3);
        return [0.16 * d, 0.11 * d];
      },
      (t, up) => {
        const c = mix(GREY, BACK, smoothstep(0.45, 0.85, up));
        c.lerp(new THREE.Color(0xe8e4dc), smoothstep(-0.5, -0.9, up) * 0.6);
        c.lerp(new THREE.Color(BREAST), smoothstep(0.66, 0.78, t) * smoothstep(-0.95, -0.5, up));
        return c.lerp(new THREE.Color(BLACK), smoothstep(0.17, 0.07, t));
      },
      'feather',
      12,
      16,
    ),
  );
  // Folded wings, grey brown with a blue patch edged in white, and the drake's black curl over a pale tail.
  for (const s of [-1, 1]) {
    const wing = coated(
      foldedWing(0.32, 0.13, (along, across) => {
        const patch = smoothstep(0.45, 0.5, along) * smoothstep(0.7, 0.65, along) * smoothstep(0.55, 0.75, across);
        const rim = smoothstep(0.7, 0.72, along) * smoothstep(0.76, 0.74, along);
        return mix(BACK, 0x3a5ea0, patch).lerp(new THREE.Color(0xf0eee8), rim * smoothstep(0.55, 0.75, across)).lerp(new THREE.Color(0x4a3e32), smoothstep(0.8, 0.95, along));
      }),
      0xffffff,
      'feather',
    );
    wing.position.set(s * 0.09, 0.2, 0.14);
    wing.rotation.set(-0.1, s * 0.05, -s * 0.32);
    body.add(side(wing, s));
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.18, -0.31);
  tail.rotation.x = 0.5;
  tail.add(coated(flat(outline([[0, 0.02], [0.05, -0.02], [0.025, -0.08], [0, -0.09], [-0.025, -0.08], [-0.05, -0.02], [0, 0.02]]), 0.012, 4).rotateX(Math.PI / 2), 0xd8d4cc, 'feather'));
  tail.add(plain(new THREE.TorusGeometry(0.02, 0.007, 4, 8, Math.PI * 1.3).rotateY(Math.PI / 2), BLACK, 0, 0.03, 0.03));
  body.add(tail);
  const neck = hinge(0, 0.17, 0.2);
  body.add(neck);
  neck.add(
    tube(path([0, -0.04, -0.02], [0, 0.08, 0.02], [0, 0.2, 0.05]), (t) => [0.055 - 0.012 * t, 0.06 - 0.015 * t], (t) => {
      const ring = smoothstep(0.3, 0.34, t) * smoothstep(0.44, 0.4, t);
      return mix(BREAST, GREEN, smoothstep(0.3, 0.36, t)).lerp(new THREE.Color(0xf4f0e8), ring);
    }, 'feather', 10, 10),
  );
  const head = hinge(0, 0.2, 0.05);
  head.name = 'head';
  neck.add(head);
  head.add(
    tube(
      path([0, 0.0, -0.07], [0, 0.015, 0.0], [0, 0.0, 0.075]),
      (t) => {
        const d = dome(t, 0.45, 0.4);
        return [0.058 * d, 0.065 * d];
      },
      (_t, up) => mix(GREEN, 0x2f8a6a, smoothstep(0.2, 0.9, up)),
      'feather',
      12,
      10,
    ),
  );
  // The bill: a flat yellow spoon pointing forward, with a dark nail at the tip.
  const bill = coated(flat(outline([[-0.018, 0], [-0.024, 0.05], [-0.016, 0.085], [0, 0.092], [0.016, 0.085], [0.024, 0.05], [0.018, 0]]), 0.016, 4).rotateX(Math.PI / 2), 0xe0b020, null);
  bill.position.set(0, -0.015, 0.045);
  bill.rotation.x = 0.2;
  head.add(bill);
  head.add(blob(0.01, 0.006, 0.01, BLACK, 0, -0.033, 0.13, 6, null));
  for (const s of [-1, 1]) head.add(eye(0.011, s, 0.046, 0.018, 0.035));
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

/** The grey heron: long yellow legs, a grey body with dark wing tips, an S shaped white neck streaked in front, a black plume, and a dagger bill. */
function heronModel(): AnimalModel {
  const GREY = 0x8c9aa8;
  const DARK = 0x3a4250;
  const WHITE = 0xe9eaea;
  const LEG = 0xc2a860;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  for (const s of [-1, 1]) {
    // Long thin legs with a heel joint, ending in long toes.
    group.add(plain(new THREE.CylinderGeometry(0.012, 0.014, 0.5, 6), LEG, s * 0.05, 0.27, 0));
    group.add(plain(new THREE.SphereGeometry(0.018, 6, 4), LEG, s * 0.05, 0.52, 0));
    group.add(plain(new THREE.CylinderGeometry(0.02, 0.014, 0.28, 6), LEG, s * 0.05, 0.66, 0.0));
    for (const a of [-0.5, 0, 0.5, Math.PI]) {
      const toe = plain(new THREE.CylinderGeometry(0.005, 0.007, 0.09, 4).translate(0, 0.045, 0).rotateX(Math.PI / 2), LEG, s * 0.05, 0.008, 0);
      toe.rotation.y = a + s * 0.15;
      group.add(toe);
    }
  }
  body.add(
    tube(
      path([0, 0.82, -0.36], [0, 0.86, -0.12], [0, 0.93, 0.1], [0, 1.0, 0.24]),
      (t) => {
        const d = dome(t, 0.3, 0.35);
        return [0.11 * d, 0.15 * d];
      },
      (t, up) => mix(GREY, WHITE, smoothstep(-0.2, -0.6, up) * smoothstep(0.35, 0.7, t)),
      'feather',
      12,
      14,
    ),
  );
  for (const s of [-1, 1]) {
    const wing = coated(foldedWing(0.46, 0.2, (along) => mix(GREY, 0x6e7c8a, smoothstep(0.2, 0.5, along)).lerp(new THREE.Color(DARK), smoothstep(0.6, 0.75, along))), 0xffffff, 'feather');
    wing.position.set(s * 0.1, 1.0, 0.18);
    wing.rotation.set(-0.42, 0, -s * 1.25);
    body.add(side(wing, s));
  }
  const tail = blob(0.05, 0.03, 0.1, GREY, 0, 0.82, -0.36, 8, 'feather');
  body.add(tail);
  // An S shaped neck in two parts: the base leans forward and the top comes back up, ending in the head and a long bill.
  const streaked: Paint = (t, up) => mix(WHITE, DARK, (up < -0.75 && (t * 9) % 1 < 0.5 ? 1 : 0) * 0.85);
  const neck = hinge(0, 1.0, 0.22);
  body.add(neck);
  neck.add(tube(path([0, -0.06, -0.04], [0, 0.08, 0.08], [0, 0.2, 0.14], [0, 0.31, 0.12]), (t) => [0.045 - 0.012 * t, 0.05 - 0.015 * t], streaked, 'feather', 8, 10));
  const upper = hinge(0, 0.3, 0.12);
  neck.add(upper);
  upper.add(tube(path([0, -0.02, 0.01], [0, 0.1, -0.03], [0, 0.2, -0.06], [0, 0.27, -0.06]), (t) => [0.032 - 0.004 * t, 0.034 - 0.004 * t], streaked, 'feather', 8, 10));
  const head = hinge(0, 0.26, -0.06);
  head.name = 'head';
  upper.add(head);
  head.add(
    tube(
      path([0, 0.0, -0.05], [0, 0.006, 0.02], [0, -0.004, 0.07]),
      (t) => {
        const d = dome(t, 0.45, 0.4);
        return [0.034 * d, 0.04 * d];
      },
      (_t, up, s) => mix(WHITE, 0x1c1c20, smoothstep(0.55, 0.7, Math.abs(s)) * smoothstep(-0.05, 0.25, up)),
      'feather',
      10,
      8,
    ),
  );
  const bill = plain(new THREE.ConeGeometry(0.019, 0.24, 6).rotateX(Math.PI / 2), 0xe0a838, 0, -0.008, 0.18);
  bill.scale.x = 0.7;
  head.add(bill);
  // The black plume trails back from the crown.
  head.add(tube(path([0, 0.03, 0.0], [0, 0.03, -0.08], [0, 0.0, -0.17]), (t) => [0.012 * (1 - 0.8 * t), 0.008 * (1 - 0.8 * t)], one(0x1c1c20), 'feather', 5, 6));
  for (const s of [-1, 1]) head.add(eye(0.01, s, 0.028, 0.012, 0.035, 0xf0d040));
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

const OWL_SCALE = 2;

/** An owl wing spread out along +x from the shoulder: a broad blade with a rounded, feathered back edge and barred tips. */
function owlWing(span: number, chord: number, colour: number, bar: number): THREE.BufferGeometry {
  const pts: [number, number][] = [[0, -0.04], [span * 0.5, -chord * 0.28], [span * 0.92, -chord * 0.1], [span, chord * 0.15]];
  // The trailing edge, scalloped by the long flight feathers.
  for (let i = 1; i <= 6; i++) {
    const x = span * (1 - i / 6.5);
    pts.push([x + span * 0.05, chord * (0.55 + 0.25 * Math.sin((i / 6) * Math.PI))], [x, chord * (0.5 + 0.25 * Math.sin((i / 6) * Math.PI))]);
  }
  pts.push([0, chord * 0.5], [0, -0.04]);
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  return painted(flat(s, 0.014, 1, 0.12), (x) => mix(colour, bar, x > span * 0.5 && (x * 18) % 1 < 0.35 ? 0.8 : 0)).rotateX(-Math.PI / 2);
}

/** The eagle owl: an upright tawny body streaked on the chest, a round face disc with big orange eyes, ear tufts, and broad wings. */
function owlModel(): AnimalModel {
  const BROWN = 0x7a6246;
  const DARK = 0x3e2e1e;
  const PALE = 0xd9b98c;
  const FACE = 0xc9a676;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  // Perched, the owl stands upright: a tall body, pale at the chest, on two feet. In flight the group tilts forward.
  body.add(
    tube(
      path([0, 0.03, -0.03], [0, 0.18, 0.0], [0, 0.4, 0.0], [0, 0.6, -0.01]),
      (t) => {
        const d = dome(t, 0.2, 0.2);
        const belly = 1 + 0.12 * Math.sin(Math.min(1, t * 1.6) * Math.PI);
        return [0.15 * d * belly, 0.14 * d * belly];
      },
      (t, up, s) => {
        const c = mix(BROWN, PALE, smoothstep(0.1, -0.4, up));
        const streak = up < -0.2 && (t * 11 + s * 0.8) % 1 < 0.18 ? 0.6 : 0;
        return c.lerp(new THREE.Color(DARK), streak);
      },
      'feather',
      12,
      14,
    ),
  );
  for (const s of [-1, 1]) {
    body.add(blob(0.045, 0.035, 0.065, PALE, s * 0.06, 0.03, 0.06, 8, 'feather'));
    for (const a of [-0.35, 0, 0.35]) {
      const claw = plain(new THREE.ConeGeometry(0.008, 0.035, 4).rotateX(Math.PI / 2), 0x2a2420, s * 0.06 + Math.sin(a) * 0.035, 0.012, 0.11);
      claw.rotation.y = a;
      body.add(claw);
    }
  }
  const tail = coated(flat(outline([[0, 0], [0.07, -0.03], [0.06, -0.15], [0, -0.17], [-0.06, -0.15], [-0.07, -0.03], [0, 0]]), 0.014, 4, 0.12).rotateX(Math.PI / 2), BROWN, 'feather');
  tail.position.set(0, 0.18, -0.11);
  tail.rotation.x = -1.2;
  body.add(tail);
  const head = hinge(0, 0.6, 0.02);
  head.name = 'head';
  body.add(head);
  head.add(blob(0.15, 0.13, 0.13, BROWN, 0, 0, 0, 14, 'feather'));
  // A pale round face disc rimmed in dark, with big orange eyes, a short hooked beak, and two ear tufts.
  const disc = outline([[0, 0.07], [0.07, 0.1], [0.125, 0.04], [0.11, -0.06], [0.04, -0.11], [0, -0.1], [-0.04, -0.11], [-0.11, -0.06], [-0.125, 0.04], [-0.07, 0.1], [0, 0.07]]);
  head.add(coated(flat(disc, 0.02, 3, 0.1), DARK, 'feather').translateZ(0.088));
  const face = coated(flat(disc, 0.02, 3, 0.1), FACE, 'feather').translateZ(0.096);
  face.scale.set(0.9, 0.9, 1);
  head.add(face);
  for (const s of [-1, 1]) head.add(eye(0.034, s, 0.052, 0.015, 0.105, 0xf08a20));
  const beak = plain(new THREE.ConeGeometry(0.02, 0.065, 5).rotateX(Math.PI * 0.7), 0x5a5048, 0, -0.035, 0.13);
  head.add(beak);
  for (const s of [-1, 1]) {
    const tuft = coated(earShape(0.035, 0.1, BROWN, DARK, 0.3), 0xffffff, 'feather');
    tuft.position.set(s * 0.09, 0.085, 0.04);
    tuft.rotation.set(-0.2, 0, -s * 0.55);
    head.add(tuft);
  }
  // Wings hinged at the shoulders: folded at the sides when perched, spread and flapping in flight.
  const wings = [-1, 1].map((s) => {
    const w = hinge(s * 0.12, 0.47, -0.02);
    w.add(side(coated(owlWing(0.4, 0.2, BROWN, DARK), 0xffffff, 'feather'), s));
    body.add(w);
    return w;
  });
  // Drawn about twice life size: at its true 0.5 m the owl was a speck in the dark forest and its warning could not be read.
  group.scale.setScalar(OWL_SCALE);
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

/** The lynx: a big spotted tawny cat with tufted ears, a cheek ruff, a short black-tipped tail, long legs, and big paws. About twice the fox's size. */
function lynxModel(): AnimalModel {
  const FUR = 0xb89a68;
  const PALE = 0xe6dcc4;
  const DARK = 0x2a2018;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  body.add(
    tube(
      path([0, 0.7, -0.52], [0, 0.71, -0.2], [0, 0.68, 0.2], [0, 0.74, 0.46]),
      (t) => {
        const d = dome(t, 0.2, 0.25);
        return [0.17 * d, (0.19 + 0.03 * smoothstep(0.4, 0.8, t)) * d];
      },
      (_t, up) => mix(FUR, PALE, smoothstep(-0.3, -0.7, up)),
      'spots',
      14,
      18,
    ),
  );
  body.add(tube(path([0, 0.7, 0.32], [0, 0.77, 0.44], [0, 0.8, 0.5]), () => [0.12, 0.14], (_t, up) => mix(FUR, PALE, smoothstep(-0.2, -0.7, up)), 'fur', 10, 6));
  const head = hinge(0, 0.8, 0.5);
  head.name = 'head';
  body.add(head);
  head.add(
    tube(
      path([0, 0.02, -0.1], [0, 0.015, 0.03], [0, -0.03, 0.15]),
      (t) => {
        const d = dome(t, 0.4, 0.22);
        return [0.14 * d * (1 - 0.3 * smoothstep(0.5, 1, t)), 0.125 * d];
      },
      (t, up) => mix(FUR, PALE, smoothstep(-0.2, -0.6, up) * smoothstep(0.3, 0.7, t)),
      'fur',
      12,
      12,
    ),
  );
  head.add(blob(0.025, 0.018, 0.018, 0x5a3430, 0, -0.025, 0.155, 8, null));
  for (const s of [-1, 1]) {
    // Whisker pads, the cheek ruff hanging down, a yellow green eye, and a pointed ear with a black tuft.
    head.add(blob(0.036, 0.03, 0.03, PALE, s * 0.03, -0.06, 0.13, 8));
    const ruff = blob(0.05, 0.1, 0.06, PALE, s * 0.12, -0.08, 0.0, 8);
    ruff.rotation.z = s * 0.35;
    head.add(ruff);
    head.add(eye(0.022, s, 0.062, 0.035, 0.11, 0xc8b040));
    const ear = coated(earShape(0.1, 0.14, FUR, DARK, 0.6), 0xffffff);
    ear.position.set(s * 0.085, 0.08, -0.03);
    ear.rotation.set(-0.1, s * 0.25, -s * 0.2);
    head.add(ear);
    const tuft = plain(new THREE.ConeGeometry(0.012, 0.09, 4), DARK, s * 0.11, 0.255, -0.03);
    tuft.rotation.z = -s * 0.2;
    head.add(tuft);
  }
  const front = (x: number): THREE.Group => {
    const l = limb(x, 0.55, 0.3, path([0, 0.1, 0], [0, -0.25, 0.02], [0, -0.52, 0.02]), [0.07, 0.09], 0.04, FUR, FUR, 'spots');
    l.add(blob(0.055, 0.035, 0.065, FUR, 0, -0.52, 0.03, 10));
    return l;
  };
  const hind = (x: number): THREE.Group => {
    const l = limb(x, 0.55, -0.34, path([0, 0.12, 0.02], [0, -0.15, -0.05], [0, -0.32, -0.1], [0, -0.52, -0.04]), [0.08, 0.12], 0.04, FUR, FUR, 'spots');
    l.add(blob(0.055, 0.035, 0.065, FUR, 0, -0.52, -0.01, 10));
    return l;
  };
  const legs = [front(-0.11), front(0.11), hind(-0.11), hind(0.11)];
  group.add(...legs);
  const tail = hinge(0, 0.72, -0.5);
  body.add(tail);
  tail.add(tube(path([0, 0, 0.03], [0, -0.03, -0.1], [0, -0.07, -0.2]), (t) => [0.05 * dome(t, 0, 0.35), 0.05 * dome(t, 0, 0.35)], (t) => mix(FUR, DARK, smoothstep(0.6, 0.68, t)), 'fur', 8, 8));
  const walk = easer();
  return {
    group,
    pose(time, moving, seed) {
      const w = walk(moving ? 1 : 0, time);
      const phase = time * 7 + seed;
      body.position.y = Math.abs(Math.sin(phase)) * 0.03 * w;
      swingLegs(legs, phase, 0.6 * w);
      // Still, it watches with the head low; moving, the head is low and level, as in a stalk.
      head.rotation.y = Math.sin(time * 0.7 + seed) * 0.4 * (1 - w);
      head.rotation.x = 0.25 * w;
      tail.rotation.x = Math.sin(time * 1.4 + seed) * 0.15;
    },
  };
}

/** The bear: a large brown bear on four legs, with a hump at the shoulders, a pale snout, small round ears, and pale claws. */
function bearModel(): AnimalModel {
  const FUR = 0x56392a;
  const LIGHT = 0x7e5a3a;
  const DARK = 0x3a2618;
  const SNOUT = 0x9a7a58;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  body.add(
    tube(
      path([0, 1.0, -0.85], [0, 1.02, -0.4], [0, 1.05, 0.2], [0, 1.1, 0.6], [0, 1.14, 0.85]),
      (t) => {
        const d = dome(t, 0.22, 0.2);
        return [0.48 * d, (0.44 + 0.04 * smoothstep(0.4, 0.7, t)) * d];
      },
      (t, up) => mix(FUR, LIGHT, smoothstep(0.5, 0.95, up) * smoothstep(0.45, 0.75, t)).lerp(new THREE.Color(DARK), smoothstep(-0.4, -0.9, up) * 0.6),
      'fur',
      14,
      18,
    ),
  );
  // The hump of muscle over the shoulders.
  body.add(blob(0.34, 0.26, 0.36, LIGHT, 0, 1.36, 0.42, 12));
  const head = hinge(0, 1.2, 0.95);
  head.name = 'head';
  body.add(head);
  head.add(
    tube(
      path([0, 0.05, -0.18], [0, 0.04, 0.04], [0, -0.04, 0.24], [0, -0.07, 0.4]),
      (t) => {
        const d = dome(t, 0.3, 0.12);
        return [0.25 * d * (1 - 0.5 * smoothstep(0.35, 0.9, t)), 0.24 * d * (1 - 0.48 * smoothstep(0.35, 0.9, t))];
      },
      (t) => mix(FUR, SNOUT, smoothstep(0.6, 0.72, t)),
      'fur',
      14,
      14,
    ),
  );
  head.add(blob(0.045, 0.032, 0.03, 0x0d0a08, 0, -0.06, 0.41, 8, null));
  for (const s of [-1, 1]) {
    head.add(eye(0.026, s, 0.11, 0.07, 0.17));
    const ear = blob(0.07, 0.07, 0.035, FUR, s * 0.16, 0.2, -0.08, 8);
    ear.rotation.z = -s * 0.3;
    head.add(ear);
  }
  const leg = (x: number, z: number, front: boolean): THREE.Group => {
    const l = limb(x, 0.8, z, path([0, 0.15, 0], [0, -0.3, front ? 0.02 : -0.04], [0, -0.73, 0.02]), [0.17, 0.2], 0.12, FUR, DARK);
    l.add(blob(0.13, 0.07, 0.17, DARK, 0, -0.74, 0.05, 10));
    for (let i = -1.5; i <= 1.5; i++) {
      const claw = plain(new THREE.ConeGeometry(0.015, 0.06, 4).rotateX(Math.PI / 2), 0xd8cdb8, i * 0.055, -0.77, 0.21);
      l.add(claw);
    }
    return l;
  };
  const legs = [leg(-0.28, 0.55, true), leg(0.28, 0.55, true), leg(-0.28, -0.55, false), leg(0.28, -0.55, false)];
  group.add(...legs);
  const walk = easer();
  return {
    group,
    pose(time, moving, seed) {
      const w = walk(moving ? 1 : 0, time);
      const phase = time * 3.5 + seed;
      // A heavy rolling walk; standing, the head swings slowly to sniff.
      body.position.y = Math.abs(Math.sin(phase)) * 0.04 * w;
      body.rotation.z = Math.sin(phase) * 0.04 * w;
      swingLegs(legs, phase, 0.45 * w);
      head.rotation.y = Math.sin(time * 0.5 + seed) * 0.5 * (1 - w);
      head.rotation.x = 0.1 * w + Math.sin(time * 0.8 + seed) * 0.15 * (1 - w);
    },
  };
}

/** The frog: a squat green body with a pale belly, big golden eyes on top, long folded back legs with webbed feet, sitting at the water's edge, throat swelling now and then, and a hop when it moves. */
function frogModel(): AnimalModel {
  const GREEN = 0x4f8a3a;
  const DARK = 0x3d6e2e;
  const BELLY = 0xd8e0a0;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  body.add(
    tube(
      path([0, 0.055, -0.09], [0, 0.065, -0.02], [0, 0.065, 0.05], [0, 0.055, 0.105]),
      (t) => {
        const d = dome(t, 0.35, 0.3);
        return [0.068 * d, 0.045 * d];
      },
      (_t, up) => mix(GREEN, BELLY, smoothstep(-0.2, -0.6, up)),
      'skin',
      12,
      12,
    ),
  );
  // The head is part of the body, as the frog has no neck to turn; this group holds its eyes.
  const head = hinge(0, 0.095, 0.06);
  head.name = 'head';
  body.add(head);
  for (const s of [-1, 1]) {
    // A bump on top of the head for each big golden eye.
    head.add(blob(0.022, 0.02, 0.022, GREEN, s * 0.032, 0, 0, 8, 'skin'));
    head.add(eye(0.017, s, 0.036, 0.01, 0.006, 0xe0c040));
    // The hind leg folds at the side: the thigh forward to the knee, the shin back, and a webbed foot flat on the ground.
    body.add(tube(path([s * 0.04, 0.05, -0.07], [s * 0.08, 0.04, -0.03], [s * 0.1, 0.03, 0.01]), (t) => [0.022 - 0.008 * t, 0.02 - 0.007 * t], one(GREEN), 'skin', 8, 6));
    body.add(tube(path([s * 0.1, 0.03, 0.01], [s * 0.095, 0.018, -0.04], [s * 0.08, 0.01, -0.08]), (t) => [0.013 - 0.004 * t, 0.012 - 0.004 * t], (t) => mix(GREEN, DARK, t), 'skin', 6, 6));
    const foot = coated(flat(outline([[0, 0], [0.022, 0.03], [0.008, 0.042], [0, 0.034], [-0.008, 0.042], [-0.022, 0.03], [0, 0]]), 0.005, 3, 0.05).rotateX(Math.PI / 2), DARK, 'skin');
    foot.position.set(s * 0.08, 0.004, -0.085);
    foot.rotation.y = s * 0.7;
    body.add(foot);
    body.add(tube(path([s * 0.04, 0.04, 0.06], [s * 0.05, 0.02, 0.08], [s * 0.052, 0.006, 0.09]), () => [0.008, 0.008], one(GREEN), 'skin', 6, 4));
    body.add(blob(0.012, 0.004, 0.014, GREEN, s * 0.054, 0.004, 0.096, 6, 'skin'));
  }
  const walk = easer();
  return {
    group,
    pose(time, moving, seed) {
      const w = walk(moving ? 1 : 0, time);
      // Sitting: the body swells slowly with breath. Moving: a small hop.
      const hop = Math.max(0, Math.sin(time * 7 + seed)) * 0.06 * w;
      body.position.y = hop;
      body.scale.set(1, 1 + Math.sin(time * 2 + seed) * 0.05 * (1 - w), 1);
    },
  };
}

/** The otter: a long, low, sleek dark brown body with a thick tapering tail, a flat head, and a pale throat, swimming at the surface and bobbing. */
function otterModel(): AnimalModel {
  const BROWN = 0x5a3e2a;
  const PALE = 0xcdb89a;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  body.add(
    tube(
      path([0, 0.04, -0.42], [0, 0.055, -0.1], [0, 0.06, 0.2], [0, 0.09, 0.42]),
      (t) => {
        const d = dome(t, 0, 0.22);
        return [(0.085 + 0.035 * smoothstep(0, 0.4, t)) * d, (0.07 + 0.03 * smoothstep(0, 0.4, t)) * d];
      },
      (t, up) => mix(BROWN, PALE, smoothstep(-0.2, -0.7, up) * smoothstep(0.55, 0.9, t)),
      'fur',
      12,
      16,
    ),
  );
  const tail = hinge(0, 0.04, -0.4);
  tail.rotation.x = 0.15;
  body.add(tail);
  tail.add(tube(path([0, 0, 0.04], [0, -0.005, -0.2], [0, -0.01, -0.46]), (t) => [0.085 * (1 - 0.85 * t) * dome(t, 0, 0.06), 0.065 * (1 - 0.85 * t) * dome(t, 0, 0.06)], one(BROWN), 'fur', 10, 10));
  for (const s of [-1, 1]) body.add(blob(0.03, 0.018, 0.04, 0x3e2a1c, s * 0.08, 0.0, 0.26, 8));
  const head = hinge(0, 0.1, 0.42);
  head.name = 'head';
  body.add(head);
  head.add(
    tube(
      path([0, 0.01, -0.08], [0, 0.005, 0.03], [0, -0.01, 0.13]),
      (t) => {
        const d = dome(t, 0.35, 0.18);
        return [0.08 * d * (1 - 0.3 * smoothstep(0.4, 1, t)), 0.062 * d];
      },
      (t, up) => mix(BROWN, PALE, smoothstep(-0.1, -0.5, up) * smoothstep(0.35, 0.65, t)),
      'fur',
      12,
      10,
    ),
  );
  head.add(blob(0.018, 0.013, 0.012, 0x15100c, 0, 0.0, 0.135, 8, null));
  for (const s of [-1, 1]) {
    head.add(blob(0.025, 0.02, 0.02, PALE, s * 0.022, -0.022, 0.115, 8));
    head.add(eye(0.013, s, 0.045, 0.032, 0.06));
    head.add(blob(0.018, 0.016, 0.01, BROWN, s * 0.06, 0.05, -0.02, 8));
  }
  const walk = easer();
  return {
    group,
    pose(time, moving, seed) {
      const w = walk(moving ? 1 : 0, time);
      body.position.y = Math.sin(time * 2.4 + seed) * 0.015 + Math.sin(time * 7 + seed) * 0.02 * w;
      body.rotation.x = -0.1 * w + Math.sin(time * 1.1 + seed) * 0.05;
      tail.rotation.y = Math.sin(time * 4 + seed) * 0.3 * w;
      head.rotation.y = Math.sin(time * 0.9 + seed) * 0.5 * (1 - w);
    },
  };
}

/** The kingfisher: a small bird with a big head and a long black bill, blue on the back with a bright stripe, orange beneath and at the cheek, perched, and whirring its wings in flight. */
function kingfisherModel(): AnimalModel {
  const BLUE = 0x1f7fb8;
  const BRIGHT = 0x48c8e8;
  const ORANGE = 0xe0803a;
  const WHITE = 0xf4f0e8;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  body.add(
    tube(
      path([0, 0.01, -0.07], [0, 0.0, 0.0], [0, 0.02, 0.06]),
      (t) => {
        const d = dome(t, 0.4, 0.35);
        return [0.038 * d, 0.045 * d];
      },
      (_t, up, s) => mix(BLUE, ORANGE, smoothstep(0.05, -0.35, up)).lerp(new THREE.Color(BRIGHT), up > 0.85 && Math.abs(s) < 0.4 ? 1 : 0),
      'feather',
      10,
      10,
    ),
  );
  const tail = coated(flat(outline([[-0.014, 0], [-0.016, -0.04], [0, -0.045], [0.016, -0.04], [0.014, 0]]), 0.006, 3, 0.04).rotateX(-Math.PI / 2), BLUE, 'feather');
  tail.position.set(0, 0.0, -0.06);
  tail.rotation.x = -0.3;
  body.add(tail);
  const head = hinge(0, 0.04, 0.06);
  head.name = 'head';
  body.add(head);
  head.add(
    tube(
      path([0, 0.0, -0.04], [0, 0.003, 0.0], [0, 0.0, 0.042]),
      (t) => {
        const d = dome(t, 0.5, 0.45);
        return [0.038 * d, 0.039 * d];
      },
      (t, up, s) => {
        const cheek = smoothstep(0.55, 0.75, Math.abs(s)) * smoothstep(-0.45, -0.2, up) * smoothstep(0.25, -0.05, up);
        const c = mix(BLUE, ORANGE, cheek).lerp(new THREE.Color(WHITE), smoothstep(-0.65, -0.85, up) * smoothstep(0.3, 0.6, t));
        // A sprinkle of bright blue spots on the crown.
        return c.lerp(new THREE.Color(BRIGHT), up > 0.5 && (t * 7 + s * 3) % 1 < 0.25 ? 0.7 : 0);
      },
      'feather',
      10,
      8,
    ),
  );
  head.add(plain(new THREE.ConeGeometry(0.008, 0.06, 5).rotateX(Math.PI / 2), 0x201810, 0, -0.006, 0.065));
  for (const s of [-1, 1]) {
    head.add(blob(0.01, 0.012, 0.012, WHITE, s * 0.03, -0.012, -0.02, 6, null));
    head.add(eye(0.008, s, 0.028, 0.008, 0.02));
  }
  // Wings hinged at the shoulders, spread along x, with darker tips.
  const wings = [-1, 1].map((s) => {
    const w = hinge(s * 0.03, 0.022, 0.025);
    const shape = outline([[0, 0.01], [0.05, 0.004], [0.095, 0.012], [0.09, 0.03], [0.04, 0.045], [0, 0.04], [0, 0.01]], 2);
    w.add(side(coated(painted(flat(shape, 0.005, 3, 0.04), (x) => mix(BLUE, 0x16507a, smoothstep(0.06, 0.08, x))).rotateX(-Math.PI / 2), 0xffffff, 'feather'), s));
    body.add(w);
    return w;
  });
  const walk = easer();
  return {
    group,
    pose(time, moving, seed) {
      const w = walk(moving ? 1 : 0, time);
      const beat = Math.sin(time * 40 + seed) * 0.7 * w;
      wings[0]!.rotation.z = beat;
      wings[1]!.rotation.z = -beat;
      // Perched: the head bobs and turns now and then. In flight: level.
      head.rotation.x = Math.sin(time * 1.6 + seed) * 0.15 * (1 - w);
      head.rotation.y = Math.sin(time * 0.7 + seed * 2) * 0.6 * (1 - w);
    },
  };
}

const MAKERS: Record<AnimalKind, () => AnimalModel> = { deer: deerModel, fox: foxModel, duck: duckModel, heron: heronModel, owl: owlModel, lynx: lynxModel, bear: bearModel, frog: frogModel, otter: otterModel, kingfisher: kingfisherModel };

/** A fresh model of a kind, posed by its `pose`. The view keeps spares; the model preview and the tests make their own. */
export function createAnimalModel(kind: AnimalKind): AnimalModel {
  return MAKERS[kind]();
}

/** A number in [0, 7) from an animal's cell id, so animals of a kind do not move in step. */
function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 700) / 100;
}

export function createAnimalView(scene: THREE.Scene, prepare: (m: THREE.Material) => void): AnimalView {
  // Spare models of each kind, and the ones now in use by animal id.
  const spare: Record<AnimalKind, AnimalModel[]> = { deer: [], fox: [], duck: [], heron: [], owl: [], lynx: [], bear: [], frog: [], otter: [], kingfisher: [] };
  const used = new Map<string, { kind: AnimalKind; model: AnimalModel; seed: number }>();
  const release = (id: string): void => {
    const entry = used.get(id)!;
    entry.model.group.visible = false;
    spare[entry.kind].push(entry.model);
    used.delete(id);
  };
  const make = (kind: AnimalKind): AnimalModel => {
    const model = createAnimalModel(kind);
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
