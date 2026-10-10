import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { COATS, SLAP_DURATION, actionPose, createBeaverModel, slapPose } from './beaverModel';
import { SHOT_SECONDS, type BeaverAction } from './beaverAction';

/** The box of what is drawn: hidden parts do not count. */
function visibleBox(group: THREE.Object3D): THREE.Box3 {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  group.traverseVisible((o) => {
    if (o instanceof THREE.Mesh) box.union(new THREE.Box3().setFromObject(o));
  });
  return box;
}

describe('createBeaverModel', () => {
  it('paints the body in the coat, and again when the coat changes', () => {
    const m = createBeaverModel(2);
    const colors = (): Set<number> => {
      const set = new Set<number>();
      m.group.traverse((o) => {
        if (o instanceof THREE.Mesh) set.add((o.material as THREE.MeshLambertMaterial).color.getHex());
      });
      return set;
    };
    expect(colors().has(COATS[2].fur)).toBe(true);
    m.setCoat(4);
    expect(colors().has(COATS[4].fur)).toBe(true);
    expect(colors().has(COATS[2].fur)).toBe(false);
    expect(colors().has(COATS[4].dark)).toBe(true);
  });

  it('paints any colours, such as a pastel coat, the same way as a coat', () => {
    const m = createBeaverModel(1);
    const colors = (): Set<number> => {
      const set = new Set<number>();
      m.group.traverse((o) => {
        if (o instanceof THREE.Mesh) set.add((o.material as THREE.MeshLambertMaterial).color.getHex());
      });
      return set;
    };
    m.setColours({ fur: 0xf7c6d9, dark: 0xe79ab8, belly: 0xfde6ee });
    expect(colors().has(0xf7c6d9)).toBe(true);
    expect(colors().has(0xe79ab8)).toBe(true);
    expect(colors().has(0xfde6ee)).toBe(true);
    expect(colors().has(COATS[1].fur)).toBe(false);
    // The body is painted in its vertices: fur on top, belly under.
    const body = new Set<number>();
    m.group.traverse((o) => {
      const c = o instanceof THREE.Mesh ? o.geometry.getAttribute('color') : undefined;
      for (let i = 0; c && i < c.count; i++) body.add(new THREE.Color(c.getX(i), c.getY(i), c.getZ(i)).getHex());
    });
    expect(body.has(0xf7c6d9)).toBe(true);
    expect(body.has(0xfde6ee)).toBe(true);
    m.setCoat(1);
    expect(colors().has(COATS[1].fur)).toBe(true);
    expect(colors().has(0xf7c6d9)).toBe(false);
  });

  it('shows a branch in the mouth only while carrying one', () => {
    const m = createBeaverModel();
    m.update(0.1, 0);
    const empty = visibleBox(m.group);
    m.update(0.2, 0, 'walk', 0, null, 'branch');
    const full = visibleBox(m.group);
    expect(full.max.x - full.min.x).toBeGreaterThan(empty.max.x - empty.min.x + 0.2);
    m.update(0.3, 0, 'walk', 0, null, null);
    expect(visibleBox(m.group).max.x).toBeCloseTo(empty.max.x);
  });

  it('shows mud or a rock in the mouth only while carrying one', () => {
    const m = createBeaverModel();
    const visibleMeshes = (): number => {
      let n = 0;
      m.group.traverse((o) => {
        let shown = o instanceof THREE.Mesh;
        for (let p: THREE.Object3D | null = o; p && shown; p = p.parent) shown = p.visible;
        if (shown) n++;
      });
      return n;
    };
    m.update(0.1, 0);
    const empty = visibleMeshes();
    m.update(0.2, 0, 'walk', 0, null, 'mud');
    expect(visibleMeshes()).toBeGreaterThan(empty);
    m.update(0.3, 0, 'walk', 0, null, 'rock');
    expect(visibleMeshes()).toBe(empty + 1);
    m.update(0.4, 0, 'walk', 0, null, null);
    expect(visibleMeshes()).toBe(empty);
  });

  it('is about a metre and a half long with its tail, and stands on its origin', () => {
    const { group } = createBeaverModel();
    const box = visibleBox(group);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
    expect(box.max.y).toBeLessThan(0.9);
    expect(box.max.z - box.min.z).toBeGreaterThan(1);
    expect(box.max.z - box.min.z).toBeLessThan(2);
  });

  it('faces +z: the head is in front of the tail', () => {
    const { group } = createBeaverModel();
    const box = visibleBox(group);
    const front = box.max.z;
    const back = box.min.z;
    expect(front).toBeGreaterThan(0.4);
    expect(back).toBeLessThan(-0.5);
  });

  it('stands still at speed 0 and bobs when walking', () => {
    const m = createBeaverModel();
    m.update(0.3, 0);
    const still = visibleBox(m.group).max.y;
    m.update(0.3, 1);
    const walking = visibleBox(m.group).max.y;
    expect(walking).toBeGreaterThanOrEqual(still);
  });

  it('changes pose to swim and keeps its head up', () => {
    const m = createBeaverModel();
    m.update(0, 0, 'walk');
    m.update(1, 0, 'walk');
    const standing = visibleBox(m.group);
    for (let t = 1.1; t < 3; t += 0.1) m.update(t, 1, 'swim');
    const swimming = visibleBox(m.group);
    expect(Math.abs(swimming.min.y - standing.min.y)).toBeGreaterThan(0.02); // the legs moved
    expect(Math.abs(swimming.max.y - standing.max.y)).toBeLessThan(0.1); // the back and head did not drop
  });

  it('points its nose down when sinking and up when rising', () => {
    // height of the frontmost part minus height of the rearmost part
    const noseOverTail = (tilt: number): number => {
      const m = createBeaverModel();
      for (let t = 0; t < 3; t += 0.05) m.update(t, 0.5, 'dive', tilt);
      m.group.updateMatrixWorld(true);
      const centres: THREE.Vector3[] = [];
      m.group.traverse((o) => {
        if (o instanceof THREE.Mesh) centres.push(o.getWorldPosition(new THREE.Vector3()));
      });
      centres.sort((a, b) => a.z - b.z);
      return centres[centres.length - 1]!.y - centres[0]!.y;
    };
    expect(noseOverTail(1)).toBeLessThan(noseOverTail(0));
    expect(noseOverTail(-1)).toBeGreaterThan(noseOverTail(0));
  });

  describe('slapPose', () => {
    it('does nothing before and after the slap', () => {
      expect(slapPose(-0.1).tail).toBeNull();
      expect(slapPose(SLAP_DURATION).tail).toBeNull();
    });

    it('raises the tail, slams it down, and settles', () => {
      const raised = slapPose(0.28).tail!;
      const slammed = slapPose(0.36).tail!;
      expect(raised).toBeGreaterThan(1);
      expect(slammed).toBeLessThan(0);
      expect(Math.abs(slapPose(SLAP_DURATION - 0.001).tail!)).toBeLessThan(0.01);
    });

    it('is continuous, with no jumps from one moment to the next', () => {
      let prev = slapPose(0).tail!;
      for (let t = 0.005; t < SLAP_DURATION; t += 0.005) {
        const cur = slapPose(t).tail!;
        // the slam is the fastest part: about 1.45 rad in 0.08 s
        expect(Math.abs(cur - prev)).toBeLessThan(0.12);
        prev = cur;
      }
    });
  });

  it('moves the tail during a slap', () => {
    // A raised tail swings up over the back, so the back end of the beaver comes forward.
    const backEnd = (age: number | null): number => {
      const m = createBeaverModel();
      m.update(1, 0, 'walk', 0, age);
      return visibleBox(m.group).min.z;
    };
    expect(backEnd(0.28)).toBeGreaterThan(backEnd(null) + 0.1);
  });
});

describe('actionPose', () => {
  const kinds = ['gnaw', 'dig', 'drag', 'build', 'eat', 'pick', 'groom'] as const;

  it('fades the one-off poses in and out, so they start and end at the walking pose', () => {
    for (const kind of ['build', 'eat', 'pick', 'groom'] as const) {
      expect(actionPose(kind, 0).weight).toBeCloseTo(0);
      expect(actionPose(kind, SHOT_SECONDS[kind]).weight).toBeCloseTo(0);
      expect(actionPose(kind, SHOT_SECONDS[kind] / 2).weight).toBeGreaterThan(0.9);
    }
  });

  it('moves smoothly, with no jumps from one moment to the next', () => {
    for (const kind of kinds) {
      let prev = actionPose(kind, 0);
      for (let t = 0.01; t < 3; t += 0.01) {
        const cur = actionPose(kind, t);
        for (const k of ['weight', 'sit', 'lean', 'head', 'turn', 'split'] as const) expect(Math.abs(cur[k] - prev[k])).toBeLessThan(0.15);
        prev = cur;
      }
    }
  });
});

describe('createBeaverModel with an action', () => {
  /** The highest point of the head after `seconds` of an action. */
  const headTop = (kind: (typeof SHOTS)[number] | 'gnaw', seconds: number): number => {
    const m = createBeaverModel();
    for (let t = 0; t <= seconds; t += 1 / 30) m.update(t, 0, 'walk', 0, null, null, { kind, age: t });
    return visibleBox(m.group).max.y;
  };
  const SHOTS = ['eat', 'groom'] as const;

  it('sits up to eat and to groom, and rears up to gnaw', () => {
    const standing = visibleBox(createBeaverModel().group).max.y;
    expect(headTop('eat', 1.2)).toBeGreaterThan(standing + 0.15);
    expect(headTop('groom', 1.6)).toBeGreaterThan(standing + 0.15);
    expect(headTop('gnaw', 1)).toBeGreaterThan(standing + 0.05);
  });

  /** The lowest point of the dark hind feet (behind the middle), which stand on the ground. */
  const hindFeet = (m: ReturnType<typeof createBeaverModel>): number => {
    m.group.updateMatrixWorld(true);
    let low = Infinity;
    m.group.traverseVisible((o) => {
      if (!(o instanceof THREE.Mesh) || (o.material as THREE.MeshLambertMaterial).color.getHex() !== COATS[0].dark) return;
      const box = new THREE.Box3().setFromObject(o);
      if (box.getCenter(new THREE.Vector3()).z < -0.1) low = Math.min(low, box.min.y);
    });
    return low;
  };

  it('keeps its hind feet on the ground while it sits up, neither in it nor above it', () => {
    const m = createBeaverModel();
    for (let t = 0; t <= 1.2; t += 1 / 30) m.update(t, 0, 'walk', 0, null, null, { kind: 'eat', age: t });
    expect(Math.abs(hindFeet(m))).toBeLessThan(0.03);
  });

  it('keeps every leg joined to the body, walking, swimming, slapping, and sitting up', () => {
    const poses: [number, 'walk' | 'swim', boolean, BeaverAction['kind'] | null][] = [
      [1, 'walk', false, null],
      [1, 'swim', false, null],
      [0, 'walk', true, null],
      [0, 'walk', false, 'eat'],
      [0, 'walk', false, 'gnaw'],
    ];
    const ray = new THREE.Raycaster();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [speed, mode, slap, kind] of poses) {
      const m = createBeaverModel();
      // The torso is the one white mesh: its colour is in its vertices. Both its sides count, so a ray from inside meets it.
      let torso: THREE.Mesh | null = null;
      const hinges: THREE.Object3D[] = [];
      m.group.traverse((o) => {
        if (o instanceof THREE.Mesh && (o.material as THREE.MeshLambertMaterial).vertexColors) torso = o;
        if (o instanceof THREE.Group && o.children.some((c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.CapsuleGeometry)) hinges.push(o);
      });
      expect(hinges).toHaveLength(4);
      (torso!.material as THREE.Material).side = THREE.DoubleSide;
      // Every frame of a walk cycle and more, so the top of each bob is seen.
      for (let t = 0; t <= 1.5; t += 1 / 30) {
        m.update(t, speed, mode, 0, slap ? t % SLAP_DURATION : null, null, kind && { kind, age: t });
        m.group.updateMatrixWorld(true);
        for (const h of hinges) {
          // A ray up from a point inside a closed shape crosses its surface an odd number of times.
          ray.set(h.getWorldPosition(new THREE.Vector3()), up);
          expect(ray.intersectObject(torso!).length % 2).toBe(1);
        }
      }
    }
  });

  it('goes back to the walking pose after the action', () => {
    const m = createBeaverModel();
    const standing = visibleBox(m.group).max.y;
    for (let t = 0; t <= 1; t += 1 / 30) m.update(t, 0, 'walk', 0, null, null, { kind: 'groom', age: t });
    for (let t = 1; t <= 2; t += 1 / 30) m.update(t, 0, 'walk', 0, null, null, null);
    expect(visibleBox(m.group).max.y).toBeCloseTo(standing, 2);
  });
});
