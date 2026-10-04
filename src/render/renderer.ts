// Render layer: reads simulation state and draws it. It never changes state.
import * as THREE from 'three';
import type { WorldState } from '../sim/state';

export interface Renderer {
  draw(world: WorldState): void;
}

export function createRenderer(parent: HTMLElement): Renderer {
  const gl = new THREE.WebGLRenderer({ antialias: true });
  gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  parent.appendChild(gl.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe3d4);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x556b4f, 1.6));

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshLambertMaterial({ color: 0x7fa36b }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Placeholder beaver until the model pipeline exists (M3).
  const beaver = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.5, 1),
    new THREE.MeshLambertMaterial({ color: 0x8b5a2b }),
  );
  beaver.position.y = 0.25;
  scene.add(beaver);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);

  function resize(): void {
    gl.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    draw(world) {
      const b = world.beaver;
      beaver.position.set(b.x, 0.25, b.z);
      beaver.rotation.y = b.heading;
      camera.position.set(b.x, 5, b.z - 7);
      camera.lookAt(b.x, 0.5, b.z);
      gl.render(scene, camera);
    },
  };
}
