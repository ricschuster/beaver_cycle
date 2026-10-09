import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { COATS, SLAP_DURATION, createBeaverModel, slapPose } from './beaverModel';

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
    const tailTip = (age: number | null): number => {
      const m = createBeaverModel();
      m.update(1, 0, 'walk', 0, age);
      return visibleBox(m.group).max.y;
    };
    expect(tailTip(0.28)).toBeGreaterThan(tailTip(null) + 0.1);
  });
});
