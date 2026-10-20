// A page that shows one beaver model under game-like light, for the art pass (#105).
// Run `npm run dev` and open /tools/model-preview/. Query: ?mode=walk|swim|dive&speed=0..1&carry=branch|lily|mud|rock
// &coat=0..4&hat=0..4&scarf=0..5&tail=0..4&yaw=degrees&pitch=degrees&dist=metres&t=seconds&slap=seconds&action=gnaw|dig|drag|build|eat|pick|groom.
// Drag to turn the camera.
import * as THREE from 'three';
import { createBeaverModel } from '../../src/render/beaverModel';
import { SHOT_SECONDS, type ActionKind } from '../../src/render/beaverAction';
import type { BeaverMode } from '../../src/sim/state';
import type { Food } from '../../src/sim/food';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number): number => (q.has(k) ? Number(q.get(k)) : d);

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
const ground = new THREE.Mesh(new THREE.CircleGeometry(4, 32).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x7f9f55 }));
ground.receiveShadow = true;
scene.add(ground);

const model = createBeaverModel(num('coat', 0));
model.setLook({ hat: num('hat', 0), scarf: num('scarf', 0), tail: num('tail', 0) });
model.group.traverse((o) => {
  o.castShadow = true;
});
scene.add(model.group);

const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 50);
let yaw = num('yaw', 35);
let pitch = num('pitch', 15);
const dist = num('dist', 3);
function place(): void {
  const y = (yaw * Math.PI) / 180;
  const p = (pitch * Math.PI) / 180;
  camera.position.set(Math.sin(y) * Math.cos(p) * dist, 0.35 + Math.sin(p) * dist, Math.cos(y) * Math.cos(p) * dist);
  camera.lookAt(0, 0.35, 0);
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

const mode = (q.get('mode') ?? 'walk') as BeaverMode;
const speed = num('speed', 0);
const carry = (q.get('carry') ?? null) as Food | 'mud' | 'rock' | null;
const frozen = q.has('t');
const slap = q.has('slap') ? num('slap', 0) : null;
const act = q.get('action') as ActionKind | null;
// A one-off action plays over and over, with a short rest between.
const cycle = act && act in SHOT_SECONDS ? SHOT_SECONDS[act as keyof typeof SHOT_SECONDS] + 0.8 : Infinity;
const action = (t: number) => (act ? { kind: act, age: t % cycle, food: carry === 'branch' || carry === 'lily' ? carry : null } : null);
let tris = 0;
model.group.traverse((o) => {
  if (o instanceof THREE.Mesh) tris += (o.geometry.index?.count ?? o.geometry.attributes.position!.count) / 3;
});
document.getElementById('info')!.textContent = `${tris} triangles`;

const start = performance.now();
function frame(): void {
  const now = frozen ? num('t', 1) : (performance.now() - start) / 1000;
  // Step up to the frozen time so the eased poses settle.
  if (frozen) for (let t = 0; t <= now; t += 1 / 30) model.update(t, speed, mode, 0, slap, carry, action(t));
  else model.update(now, speed, mode, 0, slap === null ? null : now % 2, carry, action(now));
  place();
  renderer.render(scene, camera);
  if (!frozen) requestAnimationFrame(frame);
  else document.body.dataset.ready = '1';
}
frame();
