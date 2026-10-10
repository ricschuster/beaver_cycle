// A page that shows one ambient animal under game-like light, for the art pass (#105).
// Run `npm run dev` and open /tools/model-preview/animals.html. Query: ?kind=deer|fox|duck|heron|owl|lynx|bear|frog|otter|kingfisher
// &moving=1&seed=0..7&yaw=degrees&pitch=degrees&dist=metres&t=seconds. Drag to turn the camera.
import * as THREE from 'three';
import { createAnimalModel } from '../../src/render/animalView';
import { triangles } from '../../src/render/modelKit';
import type { AnimalKind } from '../../src/sim/animals';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number): number => (q.has(k) ? Number(q.get(k)) : d);
const kind = (q.get('kind') ?? 'deer') as AnimalKind;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc3d8);
scene.add(new THREE.HemisphereLight(0xdfefff, 0x5a6a3a, 1.4));
const sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
sun.position.set(3, 5, 2);
sun.castShadow = true;
scene.add(sun);
// Ducks and otters float, so they get a pond instead of a meadow.
const water = kind === 'duck' || kind === 'otter';
const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 32).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: water ? 0x4f7f8f : 0x7f9f55 }));
ground.receiveShadow = true;
scene.add(ground);

const model = createAnimalModel(kind);
model.group.traverse((o) => {
  o.castShadow = true;
});
scene.add(model.group);
const seed = num('seed', 0);
const moving = q.get('moving') === '1';
model.pose(0, moving, seed);
model.group.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(model.group);
const centre = box.getCenter(new THREE.Vector3());
const size = box.getSize(new THREE.Vector3()).length();
sun.shadow.camera.left = sun.shadow.camera.bottom = -size;
sun.shadow.camera.right = sun.shadow.camera.top = size;

const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.01, 50);
let yaw = num('yaw', 50);
let pitch = num('pitch', 12);
const dist = num('dist', size * 1.9);
function place(): void {
  const y = (yaw * Math.PI) / 180;
  const p = (pitch * Math.PI) / 180;
  camera.position.set(centre.x + Math.sin(y) * Math.cos(p) * dist, centre.y + Math.sin(p) * dist, centre.z + Math.cos(y) * Math.cos(p) * dist);
  camera.lookAt(centre);
}
let drag: { x: number; y: number } | null = null;
addEventListener('pointerdown', (e) => (drag = { x: e.clientX, y: e.clientY }));
addEventListener('pointerup', () => (drag = null));
addEventListener('pointermove', (e) => {
  if (!drag) return;
  yaw -= (e.clientX - drag.x) * 0.4;
  pitch = Math.min(80, Math.max(-10, pitch + (e.clientY - drag.y) * 0.4));
  drag = { x: e.clientX, y: e.clientY };
});

let meshes = 0;
model.group.traverse((o) => {
  if (o instanceof THREE.Mesh) meshes++;
});
document.getElementById('info')!.textContent = `${kind}: ${triangles(model.group)} triangles, ${meshes} meshes`;

const frozen = q.has('t');
const start = performance.now();
function frame(): void {
  const now = frozen ? num('t', 1) : (performance.now() - start) / 1000;
  // Step up to the frozen time so the eased poses settle.
  if (frozen) for (let t = 0; t <= now; t += 1 / 30) model.pose(t, moving, seed);
  else model.pose(now, moving, seed);
  place();
  renderer.render(scene, camera);
  if (!frozen) requestAnimationFrame(frame);
  else document.body.dataset.ready = '1';
}
frame();
