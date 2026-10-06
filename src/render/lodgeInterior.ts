// The inside of the lodge: a round room of woven sticks with a sleeping nest and a water hole in the floor. It hangs
// high above the world at the lodge's spot (INTERIOR_LIFT), so the outside cannot show through, and the renderer
// moves the camera and the beaver there while the beaver is in. Reads state only.
import * as THREE from 'three';
import { HOLE, INTERIOR_RADIUS, NEST, type Lodge } from '../sim/lodge';

/** Metres above the lodge's floor level that the room hangs, higher than any ground in the valley. */
export const INTERIOR_LIFT = 3000;
/** Height of the dome ceiling in metres. */
export const INTERIOR_HEIGHT = 2.8;

export interface LodgeInterior {
  /** Show the room at the lodge, or hide it for null. */
  update(lodge: Lodge | null): void;
}

export function createLodgeInterior(scene: THREE.Scene): LodgeInterior {
  const group = new THREE.Group();
  group.visible = false;
  const wood = new THREE.MeshLambertMaterial({ color: 0x8a6a44, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x5a4128, flatShading: true });

  // The floor, a little bigger than the room so no gap shows at the wall.
  const floor = new THREE.Mesh(new THREE.CircleGeometry(INTERIOR_RADIUS + 0.7, 24).rotateX(-Math.PI / 2), dark);
  group.add(floor);
  // The dome, seen from inside, wider than the room the beaver walks in.
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x7a5a38, flatShading: true, side: THREE.BackSide }),
  );
  shell.scale.set(INTERIOR_RADIUS + 0.7, INTERIOR_HEIGHT, INTERIOR_RADIUS + 0.7);
  group.add(shell);
  // Ribs of sticks across the ceiling.
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 4, 16, Math.PI), wood);
    rib.scale.set(INTERIOR_RADIUS + 0.65, INTERIOR_HEIGHT - 0.05, INTERIOR_RADIUS + 0.65);
    rib.rotation.y = (i * Math.PI) / 6;
    group.add(rib);
  }
  // The nest: a low heap of shredded wood.
  const nest = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xd9c08a, flatShading: true }));
  nest.scale.set(NEST.radius, 0.28, NEST.radius);
  nest.position.set(NEST.x, 0, NEST.z);
  group.add(nest);
  // The water hole: a rim of sticks round dark water.
  const water = new THREE.Mesh(new THREE.CircleGeometry(HOLE.radius, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1d4f66 }));
  water.position.set(HOLE.x, 0.03, HOLE.z);
  group.add(water);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(HOLE.radius, 0.1, 5, 20).rotateX(Math.PI / 2), wood);
  rim.position.set(HOLE.x, 0.06, HOLE.z);
  group.add(rim);
  // A warm light, so the room is lit by day and at night alike.
  const light = new THREE.PointLight(0xffd9a0, 40, 12, 1.5);
  light.position.set(0, INTERIOR_HEIGHT - 0.8, 0);
  group.add(light);
  const glow = new THREE.AmbientLight(0xffe2b8, 0.9);
  group.add(glow);
  scene.add(group);

  return {
    update(lodge) {
      group.visible = lodge !== null;
      if (lodge) group.position.set(lodge.x, lodge.base + INTERIOR_LIFT, lodge.z);
    },
  };
}
