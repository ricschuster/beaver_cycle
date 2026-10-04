// Render layer: reads simulation state and draws it. It never changes state.
import * as THREE from 'three';
import type { WorldState } from '../sim/state';
import type { Streamer } from '../terrain/streamer';
import type { TileStore } from '../terrain/store';
import type { ViewState } from './cameraRig';
import { createTerrainView, type TerrainView } from './terrainView';

/** Tiles to draw, when they exist. Without them the game shows a flat plane. */
export interface TerrainSource {
  store: TileStore;
  streamer: Streamer;
}

export interface Renderer {
  draw(world: WorldState, view: ViewState): void;
  terrain: TerrainView | null;
  /** The element that takes drag and zoom input. */
  canvas: HTMLCanvasElement;
}

export function createRenderer(parent: HTMLElement, source: TerrainSource | null): Renderer {
  const gl = new THREE.WebGLRenderer({ antialias: true });
  gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  parent.appendChild(gl.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe3d4);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x556b4f, 1.6));

  const SKY = 0xcfe3d4;
  let terrain: TerrainView | null = null;
  if (source) {
    // Fog hides the edge of the coarsest level (ADR 0006).
    scene.fog = new THREE.Fog(SKY, 700, 3300);
    terrain = createTerrainView(scene, source.store, source.streamer);
  } else {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshLambertMaterial({ color: 0x7fa36b }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
  }

  // Placeholder beaver until the model pipeline exists (M3).
  const beaver = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.5, 1),
    new THREE.MeshLambertMaterial({ color: 0x8b5a2b }),
  );
  beaver.position.y = 0.25;
  scene.add(beaver);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, source ? 3600 : 500);

  function resize(): void {
    gl.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    terrain,
    canvas: gl.domElement,
    draw(world, view) {
      const b = world.beaver;
      beaver.position.set(b.x, b.y + 0.25, b.z);
      beaver.rotation.y = b.heading;
      const reach = view.dist * Math.cos(view.pitch);
      const camX = b.x + Math.sin(view.yaw) * reach;
      const camZ = b.z + Math.cos(view.yaw) * reach;
      // Keep the camera above the ground it swings over.
      const ground = source ? source.store.heightAt(camX, camZ) : 0;
      const camY = Math.max(b.y + 1.2 + Math.sin(view.pitch) * view.dist, ground + 1);
      camera.position.set(camX, camY, camZ);
      camera.lookAt(b.x, b.y + 1.2, b.z);
      terrain?.update(b.x, b.z);
      gl.render(scene, camera);
    },
  };
}
