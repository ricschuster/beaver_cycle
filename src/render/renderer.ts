// Render layer: reads simulation state and draws it. It never changes state.
import * as THREE from 'three';
import { CSM } from 'three/addons/csm/CSM.js';
import { dateAt, daylight } from '../sim/clock';
import { LeafFall, MAX_LEAVES } from './fallingLeaves';
import { seasonLook } from './seasonLook';
import { moonDirection, nightness, starDirections } from './nightSky';
import { skyLook } from './skyLook';
import { sunDirection } from './sunShadow';
import { DIVE_RATE, SWIM_SINK, type Slap, type WorldState } from '../sim/state';
import type { Streamer } from '../terrain/streamer';
import type { TileStore } from '../terrain/store';
import { STAGE_RULES, stageAt } from '../sim/life';
import { createBeaverModel } from './beaverModel';
import { clearDistance, clearSurface, easeReach } from './cameraClear';
import type { ViewState } from './cameraRig';
import { lookDir } from './flyCam';
import { INTERIOR_HEIGHT, createLodgeInterior } from './lodgeInterior';
import { INTERIOR_RADIUS, lodgeCondition } from '../sim/lodge';
import { storeCondition } from '../sim/food';
import { createLodgeView } from './lodgeView';
import { createLilyView } from './lilyView';
import { createLogView } from './logView';
import { createDamView } from './damView';
import { createPondView } from './pondView';
import { createRockView } from './rockView';
import { createStoreView } from './storeView';
import type { DamSite } from './damSites';
import { createDamSiteView } from './damSites';
import { createSpotRings, type SpotRings } from './spotRing';
import type { DamSpot } from '../sim/damSpots';
import { createTerrainView, type TerrainView } from './terrainView';

/** Tiles to draw, when they exist. Without them the game shows a flat plane. */
export interface TerrainSource {
  store: TileStore;
  streamer: Streamer;
}

export interface Renderer {
  draw(world: WorldState, view: ViewState): void;
  terrain: TerrainView | null;
  /** Turn the sun shadows on or off while running. Does nothing if the game started without them. */
  setShadows(on: boolean): void;
  /** Show or hide the ring where a lodge would start (see `LodgeView.preview`). */
  setLodgePreview(at: { x: number; y: number; z: number; ok: boolean } | null): void;
  /** Debug: put the marks of the scanned dam sites in the scene, once. Shown at first. */
  addDamSites(sites: DamSite[]): void;
  /** Show or hide those marks. */
  setDamSitesVisible(on: boolean): void;
  /** Mark the free dam spots with rings that show when the beaver is near. */
  setDamSpots(spots: readonly DamSpot[]): void;
  /** The element that takes drag and zoom input. */
  canvas: HTMLCanvasElement;
}

export interface RenderOptions {
  /** Sun shadows around the beaver. On by default. */
  shadows?: boolean;
  /** The sun disc in the sky. On by default (the light stays either way). */
  sunDisc?: boolean;
  /** Draw the land and water only, without the beaver, lodge, store, logs, lily pads, rocks and leaves (the free fly view). Off by default. */
  bare?: boolean;
  /** Shadow map size in pixels, a side, for each cascade. */
  shadowMap?: number;
  /** Shadow cascades: 1 is the near box only, 2 adds a coarser one that reaches out over the valley. */
  cascades?: number;
}

/** The near cascade ends this far (metres) from the camera, and the far one at SHADOW_REACH. */
const SHADOW_NEAR_SPLIT = 70;
const SHADOW_REACH = 800;

const STAR_COUNT = 700;

/** A pale disc with a faint halo, as one texture for the moon sprite. */
function createMoonTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d');
  if (c) {
    const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(240,245,255,1)');
    g.addColorStop(0.26, 'rgba(232,238,252,1)');
    g.addColorStop(0.3, 'rgba(210,222,245,0.35)');
    g.addColorStop(0.55, 'rgba(190,205,235,0.08)');
    g.addColorStop(1, 'rgba(190,205,235,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A bright core with a soft glow, as one texture for the sun sprite. */
function createSunTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d');
  if (c) {
    const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.12, 'rgba(255,252,235,1)');
    g.addColorStop(0.16, 'rgba(255,240,200,0.55)');
    g.addColorStop(0.4, 'rgba(255,230,170,0.16)');
    g.addColorStop(1, 'rgba(255,230,170,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createRenderer(parent: HTMLElement, source: TerrainSource | null, options: RenderOptions = {}): Renderer {
  const shadows = options.shadows ?? true;
  const shadowMap = options.shadowMap ?? 2048;
  const sunDisc = options.sunDisc ?? true;
  const bare = options.bare ?? false;
  const gl = new THREE.WebGLRenderer({ antialias: true });
  gl.shadowMap.enabled = shadows;
  gl.shadowMap.type = THREE.PCFShadowMap;
  gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  parent.appendChild(gl.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe3d4);
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x556b4f, 1.6);
  scene.add(hemisphere);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, source ? 9000 : 500);
  // Cascaded shadows: a sharp box near the camera and a coarser one out to SHADOW_REACH, faded into each other.
  const cascades = Math.max(1, Math.min(3, Math.round(options.cascades ?? 2)));
  const csm = shadows
    ? new CSM({
        camera,
        parent: scene,
        cascades,
        maxFar: cascades === 1 ? SHADOW_NEAR_SPLIT : SHADOW_REACH,
        mode: 'custom',
        customSplitsCallback: (count, near, far, target) => {
          const first = Math.min(1, SHADOW_NEAR_SPLIT / far);
          for (let i = 0; i < count; i++) target.push(i === count - 1 ? 1 : first + ((1 - first) * i) / (count - 1));
        },
        shadowMapSize: shadowMap,
        shadowBias: -0.0005,
        lightIntensity: 0,
        lightDirection: new THREE.Vector3(0, -1, 0),
        lightMargin: 800,
        lightFar: 3000,
      })
    : null;
  if (csm) {
    csm.fade = true;
    // Coarser texels need a bigger push along the surface normal against stripes.
    csm.lights.forEach((l, i) => (l.shadow.normalBias = 0.4 + i * 0.8));
  }
  let shadowsOn = shadows;
  const prepare = (m: THREE.Material): void => csm?.setupMaterial(m);

  const SKY = 0xcfe3d4;
  // Fog starts well out so far ridges stay readable, and ends just inside the camera far plane.
  const FOG_NEAR = 2500;
  const FOG_FAR = 8500;
  const SKY_COLOR = new THREE.Color(SKY);
  let lastSky = SKY;
  let terrain: TerrainView | null = null;
  if (source) {
    // Fog hides the edge of the coarsest level (ADR 0006).
    scene.fog = new THREE.Fog(SKY, FOG_NEAR, FOG_FAR);
    terrain = createTerrainView(scene, source.store, source.streamer, prepare);
  } else {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshLambertMaterial({ color: 0x7fa36b }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
  }

  const logView = createLogView(scene, shadows, prepare);
  const lodgeView = createLodgeView(scene, shadows, prepare);
  const storeView = createStoreView(scene, shadows, prepare);
  const lilyView = createLilyView(scene, prepare);
  const rockView = createRockView(scene, prepare);
  const damView = createDamView(scene, shadows, prepare);
  const pondView = createPondView(scene, prepare);
  const interior = createLodgeInterior();
  const beaverModel = createBeaverModel();
  const beaver = beaverModel.group;
  scene.add(beaver);
  beaver.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = shadows;
      prepare(o.material as THREE.Material);
    }
  });

  // A ring that spreads over the water where the beaver slapped its tail.
  const SPLASH_SECONDS = 0.9;
  const splashMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const splash = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 32).rotateX(-Math.PI / 2), splashMaterial);
  splash.visible = false;
  scene.add(splash);
  let seenSlap: Slap | null = null;
  let splashAt: { slap: Slap; y: number } | null = null;

  // The sun itself: a soft disc far out in its direction, drawn behind the land (it takes part in the depth test).
  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: createSunTexture(), transparent: true, fog: false, depthWrite: false }),
  );
  sunSprite.renderOrder = -1;
  sunSprite.visible = false;
  scene.add(sunSprite);

  // Autumn leaves drifting down from the broadleaf trees around the beaver.
  const leafFall = new LeafFall();
  const leafMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.42, 0.3),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    MAX_LEAVES,
  );
  const LEAF_COLOURS = [0xc9782a, 0xb8501f, 0xd9a032, 0x8f5a22].map((c) => new THREE.Color(c));
  for (let i = 0; i < MAX_LEAVES; i++) leafMesh.setColorAt(i, LEAF_COLOURS[i % LEAF_COLOURS.length]!);
  leafMesh.frustumCulled = false;
  leafMesh.visible = false;
  scene.add(leafMesh);
  const leafTrees: number[] = [];
  let leafTreesAt = -Infinity;
  const leafMatrix = new THREE.Matrix4();
  const leafEuler = new THREE.Euler();
  const leafQuat = new THREE.Quaternion();
  const leafScale = new THREE.Vector3(1, 1, 1);
  const leafPos = new THREE.Vector3();

  // The moon and the stars, hung the same way as the sun and faded in as the light goes.
  const moonSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: createMoonTexture(), transparent: true, fog: false, depthWrite: false }),
  );
  moonSprite.renderOrder = -1;
  moonSprite.visible = false;
  scene.add(moonSprite);
  const starGeometry = new THREE.BufferGeometry();
  const starUnit = starDirections(STAR_COUNT);
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starUnit.map((v) => v * camera.far * 0.9), 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }),
  );
  stars.renderOrder = -1;
  stars.frustumCulled = false;
  stars.visible = false;
  scene.add(stars);

  function resize(): void {
    gl.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    csm?.updateFrustums();
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
  let damSiteGroup: THREE.Group | null = null;
  let spotRings: SpotRings | null = null;
  let ringSpots: readonly DamSpot[] = [];
  const showRings = (spots: readonly DamSpot[]): void => {
    spotRings?.dispose();
    ringSpots = spots;
    spotRings = createSpotRings(scene, spots);
  };
  const UNDERWATER = new THREE.Color(0x2c7a96);
  let lastUnderwater = 0x2c7a96;

  return {
    terrain,
    canvas: gl.domElement,
    setLodgePreview(at) {
      lodgeView.preview(at);
    },
    addDamSites(sites) {
      damSiteGroup?.removeFromParent();
      damSiteGroup = createDamSiteView(scene, sites);
    },
    setDamSpots(spots) {
      showRings(spots);
    },
    setDamSitesVisible(on) {
      if (damSiteGroup) damSiteGroup.visible = on;
    },
    setShadows(on) {
      shadowsOn = on && shadows;
    },
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
      beaverModel.update(now, pace, b.mode, tilt, slapAge, world.carry ?? world.haul?.kind ?? null);
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
      // In the lodge the beaver moves to the room's own scene, which is drawn instead of the world.
      const inside = world.inLodge && world.lodge !== null;
      const drawn = inside ? interior.scene : scene;
      if (beaver.parent !== drawn) drawn.add(beaver);
      beaver.visible = !bare;
      beaver.position.set(b.x, b.y, b.z);
      beaver.rotation.y = b.heading;
      beaver.scale.setScalar(STAGE_RULES[stageAt(world.clock, world.bornAt)].scale);
      // The fly view orbits a free point on the ground, or on the water over it, not the beaver.
      const free = view.free && !inside ? view.free : null;
      const fx = view.focus && !inside && !free ? view.focus : null;
      const flyY = fx && source ? source.store.heightAt(fx.x, fx.z) + (source.store.isWater(fx.x, fx.z) ? source.store.waterDepth(fx.x, fx.z) : 0) : 0;
      const look = free ? { x: free.x, y: free.y, z: free.z } : fx ? { x: fx.x, y: flyY + 1.0, z: fx.z } : { x: b.x, y: b.y + 1.0, z: b.z };
      const flat = Math.cos(view.pitch);
      const want = {
        x: b.x + Math.sin(view.yaw) * view.dist * flat,
        y: look.y + Math.sin(view.pitch) * view.dist,
        z: b.z + Math.cos(view.yaw) * view.dist * flat,
      };
      // Pull in before a tree, easing in over a quarter second and back out over a second.
      const clear = terrain && !inside && !fx && !free ? clearDistance(look, want, view.dist, terrain) : view.dist;
      const dt = Math.min(0.1, Math.max(0, now - lastFrame));
      lastFrame = now;
      reach = easeReach(reach, clear, dt);
      const f = reach / view.dist;
      const camX = free ? free.x : look.x + (want.x - look.x) * f;
      const camZ = free ? free.z : look.z + (want.z - look.z) * f;
      // Keep the camera above the ground it swings over, and out of the water surface band.
      const ground = source && !inside ? source.store.heightAt(camX, camZ) : 0;
      const level = source && !inside && source.store.isWater(camX, camZ) ? ground + source.store.waterDepth(camX, camZ) : null;
      let camY = free ? free.y : clearSurface(Math.max(look.y + (want.y - look.y) * f, ground + 1), level);
      let cx = camX;
      let cz = camZ;
      if (inside && world.lodge) {
        // Keep the camera inside the dome: under the ceiling, and within the dome's width at the camera's height.
        const l = world.lodge;
        camY = Math.min(Math.max(camY, l.base + 0.8), l.base + INTERIOR_HEIGHT * 0.7);
        const up = (camY - l.base) / INTERIOR_HEIGHT;
        const max = (INTERIOR_RADIUS + 0.6) * Math.sqrt(Math.max(0, 1 - up * up)) - 0.2;
        const dx = cx - l.x;
        const dz = cz - l.z;
        const d = Math.hypot(dx, dz);
        if (d > max) {
          cx = l.x + (dx / d) * max;
          cz = l.z + (dz / d) * max;
        }
      }
      camera.position.set(cx, camY, cz);
      if (free) {
        const d = lookDir(view.yaw, view.pitch);
        camera.lookAt(cx + d.x, camY + d.y, cz + d.z);
      } else camera.lookAt(look.x, look.y, look.z);
      // Under the surface the view turns blue and short.
      const under = level !== null && camY < level;
      interior.update(inside ? world.lodge : null);
      const date = dateAt(world.clock);
      const sky = skyLook(date.season, date.timeOfDay);
      if (sky.sky !== lastSky) {
        lastSky = sky.sky;
        SKY_COLOR.set(sky.sky);
      }
      hemisphere.intensity = sky.ambient;
      const season = seasonLook(date.dayOfYear + date.timeOfDay);
      terrain?.setSeason(season);
      terrain?.setFelled(world.felled);
      logView.update(bare ? [] : world.logs, world.stripped);
      if (terrain && !bare && season.leafFall > 0 && now - leafTreesAt > 1) {
        leafTreesAt = now;
        leafTrees.length = 0;
        terrain.broadleafNear(b.x, b.z, 45, leafTrees);
      }
      leafFall.update(dt, season.leafFall, season.leafFall > 0 ? leafTrees : []);
      leafMesh.visible = leafFall.count() > 0 && !under && !inside;
      (leafMesh.material as THREE.MeshBasicMaterial).color.setScalar(0.3 + 0.7 * Math.min(1, sky.sun / 1.3));
      if (leafMesh.visible) {
        leafFall.leaves.forEach((l, i) => {
          leafScale.setScalar(l.alive ? 1 : 0);
          leafEuler.set(now * l.spin + l.phase, l.phase, now * l.spin * 0.7);
          leafQuat.setFromEuler(leafEuler);
          leafMatrix.compose(leafPos.set(l.x, l.y, l.z), leafQuat, leafScale);
          leafMesh.setMatrixAt(i, leafMatrix);
        });
        leafMesh.instanceMatrix.needsUpdate = true;
      }
      const toSun = sunDirection(date.season, date.timeOfDay);
      if (csm) {
        csm.lightDirection.set(-toSun.x, -toSun.y, -toSun.z);
        for (const l of csm.lights) {
          l.intensity = sky.sun;
          l.castShadow = shadowsOn && sky.sun > 0.01 && !inside;
        }
      }
      // Placed from the camera, not the beaver, so it hangs at the same spot in the sky. Redder and bigger near the horizon.
      const sunAt = camera.far * 0.95;
      const low = 1 - Math.min(1, toSun.y / 0.4);
      sunSprite.visible = sunDisc && sky.sun > 0.01 && !under && !inside;
      sunSprite.position.set(camera.position.x + toSun.x * sunAt, camera.position.y + toSun.y * sunAt, camera.position.z + toSun.z * sunAt);
      sunSprite.scale.setScalar(sunAt * (0.3 + 0.1 * low));
      sunSprite.material.color.setRGB(1, 1 - 0.35 * low, 1 - 0.65 * low);
      sunSprite.material.opacity = Math.min(1, sky.sun / 0.6);
      if (sky.underwater !== lastUnderwater) {
        lastUnderwater = sky.underwater;
        UNDERWATER.set(sky.underwater);
      }
      const dark = nightness(daylight(date.timeOfDay));
      const toMoon = moonDirection(date.timeOfDay);
      moonSprite.visible = dark > 0.01 && !under && !inside;
      moonSprite.position.set(camera.position.x + toMoon.x * sunAt, camera.position.y + toMoon.y * sunAt, camera.position.z + toMoon.z * sunAt);
      moonSprite.scale.setScalar(sunAt * 0.12);
      moonSprite.material.opacity = dark;
      stars.visible = dark > 0.01 && !under && !inside;
      stars.position.copy(camera.position);
      stars.material.opacity = dark * 0.9;
      scene.background = under ? UNDERWATER : SKY_COLOR;
      if (scene.fog) {
        scene.fog.color.copy(under ? UNDERWATER : SKY_COLOR);
        (scene.fog as THREE.Fog).near = under ? 2 : FOG_NEAR;
        (scene.fog as THREE.Fog).far = under ? 45 : FOG_FAR;
      }
      // The land and the spot rings are drawn around the view's point: the beaver, or the free point of the fly view.
      terrain?.update(look.x, look.z);
      // Spots found as ponds grow (newSpots.ts) get their rings.
      if (world.spots !== ringSpots && world.spots.length !== ringSpots.length) showRings(world.spots);
      spotRings?.update(look.x, look.z, world.dams, world.clock);
      pondView.update(world.ponds);
      if (source) damView.update(world.dams, world.spots, (x, z) => source.store.heightAt(x, z), world.clock, world.ponds);
      lodgeView.update(inside || bare ? null : world.lodge, world.lodge ? lodgeCondition(world.lodge, world.clock) : 1);
      storeView.update(inside || bare ? null : world.lodge, world.store, (x, z) => (source ? source.store.heightAt(x, z) : 0), storeCondition(world.storeWear, world.clock));
      if (source && !bare) lilyView.update(source.store, b.x, b.z, world.clock, world.picked);
      if (source && !bare) rockView.update(source.store, b.x, b.z, world.rocksTaken, world.dropped);
      csm?.update();
      gl.render(drawn, camera);
    },
  };
}
