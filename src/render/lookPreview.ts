// A small turning beaver for the look card, on its own canvas and renderer, so it does not touch the game's scene.
import * as THREE from 'three';
import type { Coat } from '../sim/family';
import type { Look } from '../sim/look';
import { createBeaverModel } from './beaverModel';

export interface LookPreview {
  show(coat: Coat, look: Look): void;
  dispose(): void;
}

export function createLookPreview(canvas: HTMLCanvasElement): LookPreview {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a5a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.position.set(2, 3, 2);
  scene.add(sun);
  const model = createBeaverModel(0);
  scene.add(model.group);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  camera.position.set(0, 0.85, 2.7);
  camera.lookAt(0, 0.4, 0);

  let frame = 0;
  const draw = (ms: number): void => {
    const w = canvas.clientWidth || 240;
    const h = canvas.clientHeight || 180;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    model.group.rotation.y = 0.6 + Math.sin(ms / 1800) * 0.5;
    model.update(ms / 1000, 0);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);

  return {
    show(coat, look) {
      model.setCoat(coat.coat, coat.shade);
      model.setLook(look);
    },
    dispose() {
      cancelAnimationFrame(frame);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
