// The inside of the lodge: a round room of woven sticks with a water hole in the floor and a sleeping nest for each
// of up to 7 beavers. It lives in a scene of its own, which the renderer draws instead of the world while the beaver
// is in, so no ground or sky can show through at any angle. The room is placed at the lodge's spot so the beaver and
// the camera keep their world coordinates. Reads state only.
import * as THREE from 'three';
import { HOLE, INTERIOR_RADIUS, NEST_SPOTS, type Lodge } from '../sim/lodge';

/** Height of the dome ceiling in metres. */
export const INTERIOR_HEIGHT = 3.5;
/** Background of the interior scene, a dark warm brown. It is never seen through the sealed room. */
export const INTERIOR_BACKGROUND = 0x1c140d;

export interface LodgeInterior {
  /** The scene to draw while the beaver is in. */
  scene: THREE.Scene;
  /** Place the room at the lodge, or hide it for null. */
  update(lodge: Lodge | null): void;
}

export function createLodgeInterior(): LodgeInterior {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(INTERIOR_BACKGROUND);
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
  // The nests: low heaps of shredded wood round the wall.
  const nestGeometry = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const nestMaterial = new THREE.MeshLambertMaterial({ color: 0xd9c08a, flatShading: true });
  for (const spot of NEST_SPOTS) {
    const nest = new THREE.Mesh(nestGeometry, nestMaterial);
    nest.scale.set(spot.radius, 0.28, spot.radius);
    nest.position.set(spot.x, 0, spot.z);
    group.add(nest);
  }
  // The water hole: a rim of sticks round dark water.
  const water = new THREE.Mesh(new THREE.CircleGeometry(HOLE.radius, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1d4f66 }));
  water.position.set(HOLE.x, 0.03, HOLE.z);
  group.add(water);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(HOLE.radius, 0.1, 5, 20).rotateX(Math.PI / 2), wood);
  rim.position.set(HOLE.x, 0.06, HOLE.z);
  group.add(rim);
  // A warm light, so the room is lit by day and at night alike.
  const light = new THREE.PointLight(0xffd9a0, 55, 20, 1.5);
  light.position.set(0, INTERIOR_HEIGHT - 0.8, 0);
  group.add(light);
  const glow = new THREE.AmbientLight(0xffe2b8, 0.9);
  group.add(glow);
  scene.add(group);

  return {
    scene,
    update(lodge) {
      group.visible = lodge !== null;
      if (lodge) group.position.set(lodge.x, lodge.base, lodge.z);
    },
  };
}
