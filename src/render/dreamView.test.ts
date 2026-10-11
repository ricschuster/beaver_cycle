import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CHOCOLATE_LEVEL, LEAP_TIME, MALLOW_COLOURS, dreamHeight, newDream, type PropKind } from '../sim/dream';
import { cameraSpot, sweetHeight } from './dreamView';
import { FAR_MALLOW, HOP_SQUASH_SECONDS, dreamPlayer, flatten, hopSquash, leapPitch, mallowFar, mallowModel, rainbowHue } from './dreamBeavers';
import { pathStones, propShape, propsGeometry, resample, sweetShapes, swirlDisc, twistedTube } from './dreamProps';
import { groundColour, groundGeometry } from './dreamScenery';
import { createBeaverModel } from './beaverModel';

/** Meshes that would be drawn: visible, with every parent visible. */
function drawn(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverseVisible((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
}

const tris = (g: THREE.BufferGeometry): number => (g.index?.count ?? g.getAttribute('position').count) / 3;

describe('cameraSpot', () => {
  const flat = (): number => 0;
  it('orbits the beaver at the view distance, behind it at yaw PI, looking at its back', () => {
    const { eye, look } = cameraSpot({ x: 2, y: 1, z: 3 }, { yaw: Math.PI, pitch: 0.3, dist: 6 }, flat);
    expect(eye.distanceTo(look)).toBeCloseTo(6, 5);
    expect(eye.z).toBeLessThan(3);
    expect(eye.x).toBeCloseTo(2, 5);
    expect(look.y).toBeGreaterThan(1);
  });

  it('comes in toward the beaver rather than out past the limit', () => {
    const { eye, look } = cameraSpot({ x: 60, y: 1, z: 0 }, { yaw: Math.PI / 2, pitch: 0.3, dist: 20 }, flat, 66);
    expect(eye.x).toBeLessThanOrEqual(66 + 1e-9);
    expect(eye.distanceTo(look)).toBeLessThan(20);
    // Looking in from the edge, the limit does not matter.
    const inward = cameraSpot({ x: 60, y: 1, z: 0 }, { yaw: -Math.PI / 2, pitch: 0.3, dist: 20 }, flat, 66);
    expect(inward.eye.distanceTo(inward.look)).toBeCloseTo(20, 5);
  });

  it('keeps the camera over high ground under it', () => {
    const { eye } = cameraSpot({ x: 0, y: 1, z: 0 }, { yaw: 0, pitch: 0.05, dist: 8 }, () => 10);
    expect(eye.y).toBeGreaterThanOrEqual(10.5);
  });
});

describe('sweetHeight', () => {
  it('floats a sweet on the chocolate and hovers one over the ground', () => {
    for (let t = 0; t < 5; t += 0.37) {
      expect(Math.abs(sweetHeight({ floating: true }, -1, t, 0) - CHOCOLATE_LEVEL)).toBeLessThan(0.3);
      const y = sweetHeight({ floating: false }, 2, t, 1);
      expect(y).toBeGreaterThan(2.3);
      expect(y).toBeLessThan(2.7);
    }
  });
});

describe('hopSquash', () => {
  it('is 1 with no hop, before it and after it', () => {
    expect(hopSquash(null)).toBe(1);
    expect(hopSquash(-0.1)).toBe(1);
    expect(hopSquash(HOP_SQUASH_SECONDS)).toBe(1);
  });

  it('stretches in the air, squashes as it lands, and stays gentle', () => {
    expect(hopSquash(HOP_SQUASH_SECONDS * 0.25)).toBeGreaterThan(1.1);
    expect(hopSquash(HOP_SQUASH_SECONDS * 0.75)).toBeLessThan(0.95);
    for (let t = 0; t < HOP_SQUASH_SECONDS; t += 0.01) {
      expect(hopSquash(t)).toBeGreaterThan(0.85);
      expect(hopSquash(t)).toBeLessThan(1.2);
    }
  });
});

describe('leapPitch', () => {
  it('tips the nose up leaving the chocolate and down diving back, and only in a leap', () => {
    expect(leapPitch({ hopAt: 1, leap: true }, 1 + LEAP_TIME * 0.2)).toBeLessThan(-0.2);
    expect(leapPitch({ hopAt: 1, leap: true }, 1 + LEAP_TIME * 0.8)).toBeGreaterThan(0.2);
    expect(leapPitch({ hopAt: 1, leap: true }, 1 + LEAP_TIME * 1.1)).toBe(0);
    expect(leapPitch({ hopAt: 1, leap: false }, 1 + LEAP_TIME * 0.2)).toBe(0);
    expect(leapPitch({ hopAt: null }, 1)).toBe(0);
  });
});

describe('the beavers of the dream', () => {
  it('merges each moving part of a beaver into one mesh, about seven draw calls', () => {
    const before = drawn(createBeaverModel().group).length;
    const mallow = mallowModel(0);
    const after = drawn(mallow.group).length;
    expect(before).toBeGreaterThan(20);
    expect(after).toBeLessThanOrEqual(8);
    expect(drawn(dreamPlayer().group).length).toBeLessThanOrEqual(8);
  });

  it('makes the player a marshmallow beaver in the colours of the rainbow, red at the nose to violet at the tail', () => {
    expect(rainbowHue(0.7)).toBe(0);
    expect(rainbowHue(-0.9)).toBeCloseTo(0.8, 5);
    const hues = new Set<number>();
    let dark = 0;
    let white = 0;
    const c = new THREE.Color();
    const hsl = { h: 0, s: 0, l: 0 };
    for (const mesh of drawn(dreamPlayer().group)) {
      const colours = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
      for (let i = 0; i < colours.count; i++) {
        c.fromBufferAttribute(colours, i).getHSL(hsl);
        if (hsl.s > 0.5) hues.add(Math.round(hsl.h * 10));
        if (hsl.l < 0.1) dark++;
        if (hsl.l > 0.99) white++;
      }
    }
    // Red through orange, yellow, green, and blue to violet, and the eyes and teeth as they were.
    expect(hues.size).toBeGreaterThanOrEqual(7);
    expect(dark).toBeGreaterThan(0);
    expect(white).toBeGreaterThan(0);
  });

  it('keeps the shape and size of the model when merging', () => {
    const plain = createBeaverModel();
    plain.update(0.1, 0);
    const a = new THREE.Box3().setFromObject(plain.group);
    const merged = createBeaverModel();
    flatten(merged.group, new THREE.MeshLambertMaterial({ vertexColors: true }));
    merged.update(0.1, 0);
    const b = new THREE.Box3().setFromObject(merged.group);
    expect(b.min.distanceTo(a.min)).toBeLessThan(1e-6);
    expect(b.max.distanceTo(a.max)).toBeLessThan(1e-6);
  });

  it('still poses after merging: the legs swing when walking', () => {
    const m = mallowModel(3);
    const legs = (): number[] => m.group.children[0]!.children.filter((c) => c instanceof THREE.Group).map((g) => g.rotation.x);
    m.update(0.1, 1);
    const first = legs();
    m.update(0.2, 1);
    expect(legs()).not.toEqual(first);
  });

  it('paints a marshmallow beaver in its pastel coat', () => {
    const coat = MALLOW_COLOURS[1]!;
    const m = mallowModel(1);
    const fur = new THREE.Color(coat.fur);
    let found = false;
    m.group.traverse((o) => {
      const c = o instanceof THREE.Mesh ? o.geometry.getAttribute('color') : undefined;
      for (let i = 0; c && i < c.count && !found; i++) found = Math.abs(c.getX(i) - fur.r) + Math.abs(c.getY(i) - fur.g) + Math.abs(c.getZ(i) - fur.b) < 1e-4;
    });
    expect(found).toBe(true);
  });

  it('draws a far marshmallow beaver in one mesh of about the same size', () => {
    const far = mallowFar(2);
    const near = mallowModel(2);
    near.update(0.1, 0);
    near.group.scale.set(1.06, 0.95, 1.06);
    const a = new THREE.Box3().setFromObject(far);
    const b = new THREE.Box3().setFromObject(near.group);
    expect(Math.abs(a.max.y - b.max.y)).toBeLessThan(0.2);
    expect(Math.abs(a.max.z - a.min.z - (b.max.z - b.min.z))).toBeLessThan(0.35);
    expect(tris(far.geometry)).toBeLessThan(1500);
    expect(FAR_MALLOW).toBeGreaterThan(10);
  });
});

describe('candy props', () => {
  const kinds: PropKind[] = ['lollipop', 'gumdrop', 'candyCane', 'cupcake', 'iceCream', 'marshmallowRock'];
  it('stands each prop on the origin, at a candy size, in few triangles', () => {
    for (const kind of kinds) {
      const g = propShape({ id: `a-${kind}`, kind, colour: 2 });
      g.computeBoundingBox();
      const box = g.boundingBox!;
      expect(box.min.y, kind).toBeGreaterThan(-0.2);
      expect(box.min.y, kind).toBeLessThan(0.1);
      expect(box.max.y, kind).toBeGreaterThan(0.9);
      expect(box.max.y, kind).toBeLessThan(3.6);
      expect(tris(g), kind).toBeLessThan(1500);
      expect(g.getAttribute('color').count, kind).toBe(g.getAttribute('position').count);
    }
  });

  it('makes a cupcake big enough to hide a beaver behind', () => {
    const g = propShape({ id: 'c', kind: 'cupcake', colour: 0 });
    g.computeBoundingBox();
    expect(g.boundingBox!.max.x - g.boundingBox!.min.x).toBeGreaterThan(2);
  });

  it('is the same every time for the same prop', () => {
    const a = propShape({ id: 'x1', kind: 'gumdrop', colour: 1 }).getAttribute('color').array;
    const b = propShape({ id: 'x1', kind: 'gumdrop', colour: 1 }).getAttribute('color').array;
    expect(Array.from(b)).toEqual(Array.from(a));
  });

  it('places, sizes and turns the props of the land', () => {
    const g = propsGeometry([{ id: 'p', kind: 'lollipop', x: 10, z: -4, size: 1.5, yaw: 1, colour: 0, hide: false }], () => 2);
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.min.y).toBeGreaterThan(1.8);
    expect(box.max.y).toBeGreaterThan(2 + 3.5 * 1.3);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(10, 0);
  });

  it('winds crisp stripes round a twisted tube, and a smooth spiral on a disc', () => {
    const curve = new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2, 0));
    const tube = twistedTube(curve, 0.1, 10, 8, 2, (i) => new THREE.Color(i % 2 ? 0xffffff : 0xff0000));
    expect(tris(tube)).toBe(10 * 8 * 2);
    const disc = swirlDisc(1, 0.2, new THREE.Color(0xffffff), [new THREE.Color(0xff0000)]);
    disc.computeBoundingBox();
    expect(disc.boundingBox!.max.x).toBeCloseTo(1, 1);
  });

  it('makes each sweet of parts that take its colour or keep their own', () => {
    const shapes = sweetShapes();
    for (const kind of ['drop', 'swirl', 'star'] as const) {
      expect(shapes[kind].length).toBeGreaterThan(0);
      for (const part of shapes[kind]) expect(tris(part.geometry)).toBeGreaterThan(10);
    }
    expect(shapes.drop.some((p) => p.tinted)).toBe(true);
    expect(shapes.swirl.some((p) => p.tinted)).toBe(true);
  });
});

describe('the path', () => {
  it('lays stepping stones about every 1.7 m along the path', () => {
    const line = [{ x: 0, z: 0 }, { x: 0, z: 10 }, { x: 10, z: 10 }];
    const spots = resample(line, 1.7);
    expect(spots.length).toBe(Math.floor(20 / 1.7) + 1);
    for (let i = 1; i < spots.length; i++) expect(Math.hypot(spots[i]!.x - spots[i - 1]!.x, spots[i]!.z - spots[i - 1]!.z)).toBeLessThan(1.71);
    const stones = pathStones(line, () => 1);
    stones.computeBoundingBox();
    expect(stones.boundingBox!.min.y).toBeGreaterThan(0.9);
  });
});

describe('the ground', () => {
  const state = newDream(7);
  const land = state.land;

  it('follows dreamHeight on a grid over the whole land', () => {
    const g = groundGeometry(land, 4);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i += 97) expect(p.getY(i)).toBeCloseTo(dreamHeight(land, p.getX(i), p.getZ(i)), 5);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.x).toBeCloseTo(land.half, 5);
  });

  it('is caramel by the chocolate and a pastel meadow on the land', () => {
    const r = land.river[Math.floor(land.river.length / 2)]!;
    const bank = groundColour(land, r.x, r.z, CHOCOLATE_LEVEL + 0.3);
    // Caramel: warm, more red than blue.
    expect(bank.r).toBeGreaterThan(bank.b + 0.2);
    const meadow = groundColour(land, 0, 0, CHOCOLATE_LEVEL + 1.5);
    // Pastel: every channel light.
    expect(Math.min(meadow.r, meadow.g, meadow.b)).toBeGreaterThan(0.45);
  });
});
