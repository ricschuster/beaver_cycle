import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SLAP_DURATION, createBeaverModel, slapPose } from './beaverModel';

describe('createBeaverModel', () => {
  it('is about a metre and a half long with its tail, and stands on its origin', () => {
    const { group } = createBeaverModel();
    const box = new THREE.Box3().setFromObject(group);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
    expect(box.max.y).toBeLessThan(0.9);
    expect(box.max.z - box.min.z).toBeGreaterThan(1);
    expect(box.max.z - box.min.z).toBeLessThan(2);
  });

  it('faces +z: the head is in front of the tail', () => {
    const { group } = createBeaverModel();
    const box = new THREE.Box3().setFromObject(group);
    const front = box.max.z;
    const back = box.min.z;
    expect(front).toBeGreaterThan(0.4);
    expect(back).toBeLessThan(-0.5);
  });

  it('stands still at speed 0 and bobs when walking', () => {
    const m = createBeaverModel();
    m.update(0.3, 0);
    const still = new THREE.Box3().setFromObject(m.group).max.y;
    m.update(0.3, 1);
    const walking = new THREE.Box3().setFromObject(m.group).max.y;
    expect(walking).toBeGreaterThanOrEqual(still);
  });

  it('changes pose to swim and keeps its head up', () => {
    const m = createBeaverModel();
    m.update(0, 0, 'walk');
    m.update(1, 0, 'walk');
    const standing = new THREE.Box3().setFromObject(m.group);
    for (let t = 1.1; t < 3; t += 0.1) m.update(t, 1, 'swim');
    const swimming = new THREE.Box3().setFromObject(m.group);
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
      return new THREE.Box3().setFromObject(m.group).max.y;
    };
    expect(tailTip(0.28)).toBeGreaterThan(tailTip(null) + 0.1);
  });
});
