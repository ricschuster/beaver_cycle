// Render layer: reads simulation state and draws it. It never changes state.
import * as THREE from 'three';
import { DIVE_RATE, SWIM_SINK, type Slap, type WorldState } from '../sim/state';
import type { Streamer } from '../terrain/streamer';
import type { TileStore } from '../terrain/store';
import { createBeaverModel } from './beaverModel';
import { clearDistance, clearSurface, easeReach } from './cameraClear';
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
  // Fog starts well out so far ridges stay readable, and ends just inside the camera far plane.
  const FOG_NEAR = 2500;
  const FOG_FAR = 8500;
  const SKY_COLOR = new THREE.Color(SKY);
  let terrain: TerrainView | null = null;
  if (source) {
    // Fog hides the edge of the coarsest level (ADR 0006).
    scene.fog = new THREE.Fog(SKY, FOG_NEAR, FOG_FAR);
    terrain = createTerrainView(scene, source.store, source.streamer);
  } else {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshLambertMaterial({ color: 0x7fa36b }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
  }

  const beaverModel = createBeaverModel();
  const beaver = beaverModel.group;
  scene.add(beaver);

  // A ring that spreads over the water where the beaver slapped its tail.
  const SPLASH_SECONDS = 0.9;
  const splashMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const splash = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 32).rotateX(-Math.PI / 2), splashMaterial);
  splash.visible = false;
  scene.add(splash);
  let seenSlap: Slap | null = null;
  let splashAt: { slap: Slap; y: number } | null = null;

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, source ? 9000 : 500);

  function resize(): void {
    gl.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let lastX = 0;
  let lastZ = 0;
  let pace = 0;
  let lastY: number | null = null;
  let lastTime = 0;
  let reach = 6.5;
  let lastFrame = 0;
  const UNDERWATER = new THREE.Color(0x2c7a96);

  return {
    terrain,
    canvas: gl.domElement,
    draw(world, view) {
      const b = world.beaver;
      const moved = Math.hypot(b.x - lastX, b.z - lastZ);
      lastX = b.x;
      lastZ = b.z;
      // Pace from the distance moved this frame, so the legs follow the sim, not the keys.
      pace += ((moved > 0.001 && moved < 5 ? 1 : 0) - pace) * 0.2;
      const now = performance.now() / 1000;
      const rate = lastY === null || now <= lastTime ? 0 : (b.y - lastY) / (now - lastTime);
      lastY = b.y;
      lastTime = now;
      // Only a diver pitches: -1 rising and 1 sinking at the dive rate.
      const tilt = b.mode === 'dive' ? Math.max(-1, Math.min(1, -rate / DIVE_RATE)) : 0;
      const slapAge = world.lastSlap ? world.time - world.lastSlap.time : null;
      beaverModel.update(now, pace, b.mode, tilt, slapAge);
      if (world.lastSlap !== seenSlap) {
        seenSlap = world.lastSlap;
        splashAt = seenSlap && b.mode === 'swim' ? { slap: seenSlap, y: b.y + SWIM_SINK + 0.03 } : null;
      }
      const splashAge = splashAt ? world.time - splashAt.slap.time : SPLASH_SECONDS;
      splash.visible = splashAt !== null && splashAge >= 0 && splashAge < SPLASH_SECONDS;
      if (splash.visible && splashAt) {
        const f = splashAge / SPLASH_SECONDS;
        splash.position.set(splashAt.slap.x, splashAt.y, splashAt.slap.z);
        splash.scale.setScalar(0.4 + f * 2.6);
        splashMaterial.opacity = 0.8 * (1 - f);
      }
      beaver.position.set(b.x, b.y, b.z);
      beaver.rotation.y = b.heading;
      const look = { x: b.x, y: b.y + 1.2, z: b.z };
      const flat = Math.cos(view.pitch);
      const want = {
        x: b.x + Math.sin(view.yaw) * view.dist * flat,
        y: look.y + Math.sin(view.pitch) * view.dist,
        z: b.z + Math.cos(view.yaw) * view.dist * flat,
      };
      // Pull in before a tree, shortening at once and easing back out.
      const clear = terrain ? clearDistance(look, want, view.dist, terrain) : view.dist;
      const dt = Math.min(0.1, Math.max(0, now - lastFrame));
      lastFrame = now;
      reach = easeReach(reach, clear, dt);
      const f = reach / view.dist;
      const camX = look.x + (want.x - look.x) * f;
      const camZ = look.z + (want.z - look.z) * f;
      // Keep the camera above the ground it swings over, and out of the water surface band.
      const ground = source ? source.store.heightAt(camX, camZ) : 0;
      const level = source && source.store.isWater(camX, camZ) ? ground + source.store.waterDepth(camX, camZ) : null;
      const camY = clearSurface(Math.max(look.y + (want.y - look.y) * f, ground + 1), level);
      camera.position.set(camX, camY, camZ);
      camera.lookAt(look.x, look.y, look.z);
      // Under the surface the view turns blue and short.
      const under = level !== null && camY < level;
      scene.background = under ? UNDERWATER : SKY_COLOR;
      if (scene.fog) {
        scene.fog.color.copy(under ? UNDERWATER : SKY_COLOR);
        (scene.fog as THREE.Fog).near = under ? 2 : FOG_NEAR;
        (scene.fog as THREE.Fog).far = under ? 45 : FOG_FAR;
      }
      terrain?.update(b.x, b.z);
      gl.render(scene, camera);
    },
  };
}
