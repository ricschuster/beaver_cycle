// Render layer: reads simulation state and draws it. It never changes state.
import * as THREE from 'three';
import { CSM } from 'three/addons/csm/CSM.js';
import { dateAt, daylight } from '../sim/clock';
import { LeafFall, MAX_LEAVES } from './fallingLeaves';
import { seasonLook } from './seasonLook';
import { moonDirection, nightness, starDirections } from './nightSky';
import { skyLook } from './skyLook';
import { sunDirection } from './sunShadow';
import { DIVE_RATE, SWIM_ENTER_DEPTH, SWIM_SINK, type Slap, type WorldState } from '../sim/state';
import type { Streamer } from '../terrain/streamer';
import type { TileStore } from '../terrain/store';
import { STAGE_RULES, stageAt } from '../sim/life';
import { SLAP_DURATION, createBeaverModel, type BeaverModel } from './beaverModel';
import { createActionWatcher, idleGroom, seedOf, taskAction } from './beaverAction';
import { HEARD_DISTANCE, SLAP_EVERY } from '../sim/partners';
import type { Parent, ParentId } from '../sim/family';
import { clearDistance, clearSurface, easeReach } from './cameraClear';
import type { ViewState } from './cameraRig';
import { lookDir } from './flyCam';
import { INTERIOR_HEIGHT, createLodgeInterior } from './lodgeInterior';
import { INTERIOR_RADIUS, NEST_SPOTS, lodgeCondition } from '../sim/lodge';
import { keptStock, storeCondition } from '../sim/food';
import { createLodgeView, type LodgeView } from './lodgeView';
import { createLilyView } from './lilyView';
import { createAnimalView } from './animalView';
import type { Animal } from '../sim/animals';
import type { NeighbourBeaver } from '../sim/neighbours';
import { createLogView } from './logView';
import { createDamView } from './damView';
import { createPondView } from './pondView';
import { createRockView } from './rockView';
import { createStoreView, type StoreView } from './storeView';
import type { DamSite } from './damSites';
import { createDamSiteView } from './damSites';
import { createSpotRings, type SpotRings } from './spotRing';
import { createWayPointer } from './wayPointer';
import { keepCompileHook } from './grain';
import type { DamSpot } from '../sim/damSpots';
import { clearingsOf, createTerrainView, type Clearing, type TerrainView } from './terrainView';

/** Tiles to draw, when they exist. Without them the game shows a flat plane. */
export interface TerrainSource {
  store: TileStore;
  streamer: Streamer;
}

export interface Renderer {
  /** Draw the world. `parents` are Mama and Papa from `parentsAt`, none when the player beaver is grown. */
  draw(
    world: WorldState,
    view: ViewState,
    parents?: readonly Parent[],
    animals?: readonly Animal[],
    neighbours?: readonly NeighbourBeaver[],
    drifts?: readonly { x: number; y: number; z: number }[],
    /** True while the player digs at a snowdrift, which the sim does not keep. */
    digging?: boolean,
  ): void;
  terrain: TerrainView | null;
  /** Turn the sun shadows on or off while running. Does nothing if the game started without them. */
  setShadows(on: boolean): void;
  /** What the GPU side holds now: geometries, textures and shader programs (three.js `info`), for the memory readout. */
  memory(): { inScene: number; top: number; groups: number[]; geometries: number; textures: number; programs: number; calls: number; triangles: number };
  /** Show or hide the ring where a lodge would start (see `LodgeView.preview`). */
  setLodgePreview(at: { x: number; y: number; z: number; ok: boolean } | null): void;
  /** Debug: put the marks of the scanned dam sites in the scene, once. Shown at first. */
  addDamSites(sites: DamSite[]): void;
  /** Show or hide those marks. */
  setDamSitesVisible(on: boolean): void;
  /** Mark the free dam spots with rings that show when the beaver is near. */
  setDamSpots(spots: readonly DamSpot[]): void;
  /** The sparkles toward a lone beaver at these points (none hides them), twinkling by `time` (seconds). */
  setWayDots(dots: readonly { x: number; y: number; z: number }[], time: number): void;
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

/** Moves the entries of `models` whose id is not in `now` to `spare`, hidden, to be taken by the next new id. */
function recycle<K extends string, E extends { model: BeaverModel }>(models: Map<K, E>, spare: E[], now: readonly { id: string }[]): void {
  for (const [id, entry] of models) {
    if (now.some((b) => b.id === id)) continue;
    entry.model.group.visible = false;
    spare.push(entry);
    models.delete(id);
  }
}

function sceneGeometries(scene: THREE.Scene): number {
  const seen = new Set<THREE.BufferGeometry>();
  scene.traverse((o) => {
    const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (g) seen.add(g);
  });
  return seen.size;
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
  // Without shadows the sun is a plain directional light, which costs next to nothing, so the shading still follows the sun.
  const sunLight = csm ? null : new THREE.DirectionalLight(0xffffff, 0);
  if (sunLight) scene.add(sunLight);
  let shadowsOn = shadows;
  const prepare = (m: THREE.Material): void => {
    if (csm) keepCompileHook(m, (x) => csm.setupMaterial(x));
  };

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
  const wayPointer = createWayPointer(scene);
  const storeView = createStoreView(scene, shadows, prepare);
  const formerStoreViews: StoreView[] = [];
  const kept = keptStock();
  // The lodges the family has left, one view each, made when first needed.
  const formerViews: LodgeView[] = [];
  const lilyView = createLilyView(scene, prepare);
  const animalView = createAnimalView(scene, prepare);
  const rockView = createRockView(scene, prepare);
  const damView = createDamView(scene, shadows, prepare);
  const pondView = createPondView(scene, prepare);
  const interior = createLodgeInterior();
  const beaverModel = createBeaverModel();
  // What the player's beaver is doing, for its poses: the sim keeps no state for most of it.
  const actions = createActionWatcher();
  const beaver = beaverModel.group;
  scene.add(beaver);
  const prepareBeaver = (group: THREE.Group): void =>
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = shadows;
        prepare(o.material as THREE.Material);
      }
    });
  prepareBeaver(beaver);
  // Mama and Papa, and the parents of lodges the family left, each in a coat of their own, made when first seen. They are
  // drawn where the player is: in the room while the player is in, else in the world.
  const parentModels = new Map<ParentId, { model: BeaverModel; pace: number; coat: string }>();
  // The lone beavers of the valley, one model each, made when first seen.
  const partnerModels = new Map<string, { model: BeaverModel; pace: number; x: number; z: number }>();
  // The beavers of the other families, one model each, made when first seen, and the lodges they live in.
  const neighbourModels = new Map<string, { model: BeaverModel; coat: string; pace: number }>();
  // Models whose beaver is gone (a kit's id carries the year, so a new year brings new ids): the next new id takes one, so the
  // scene does not grow with the years played (#604).
  const neighbourSpare: { model: BeaverModel; coat: string; pace: number }[] = [];
  const parentSpare: { model: BeaverModel; pace: number; coat: string }[] = [];
  const neighbourViews: LodgeView[] = [];
  const driftMeshes: THREE.Mesh[] = [];
  const driftGeometry = new THREE.SphereGeometry(1, 14, 9);
  const driftMaterial = new THREE.MeshStandardMaterial({ color: 0xf2f6fa, roughness: 1 });
  let coatShown = '';

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
  // Patches kept clear of shrubs round the dams and the lodges, worked out again only when one of them changes.
  let clearingsFrom: unknown[] = [];
  let clearings: Clearing[] = [];
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
    setWayDots(dots, time) {
      wayPointer.set(dots, time);
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
    memory: () => ({
      // Geometries a mesh in the scene uses; `geometries` above this is held on the GPU for meshes that are gone (a leak).
      inScene: sceneGeometries(scene),
      top: scene.children.length,
      groups: scene.children.map((c) => { let n = 0; c.traverse(() => n++); return n; }),
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      programs: gl.info.programs?.length ?? 0,
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
    }),
    draw(world, view, parents = [], animals = [], neighbours = [], drifts = [], digging = false) {
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
      const action = actions.next(world, digging, pace < 0.05 && b.mode === 'walk');
      // While it eats, the food it has just taken from the mouth is still shown in its paws.
      const held = world.carry ?? world.haul?.kind ?? (action?.kind === 'eat' ? action.food ?? null : null);
      beaverModel.update(now, pace, b.mode, tilt, slapAge, held, action);
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
      // In the lodge the beaver moves to the room's own scene, which is drawn instead of the world. The fly views always show the
      // world, even when the beaver is in the lodge (a new game starts there as a baby).
      const inside = world.inLodge && world.lodge !== null && !view.free && !view.focus;
      const drawn = inside ? interior.scene : scene;
      if (beaver.parent !== drawn) drawn.add(beaver);
      const coat = `${world.coat.coat}:${world.coat.shade}`;
      if (coat !== coatShown) {
        coatShown = coat;
        beaverModel.setCoat(world.coat.coat, world.coat.shade);
      }
      for (const entry of parentModels.values()) entry.model.group.visible = false;
      recycle(parentModels, parentSpare, parents);
      for (const p of parents) {
        let entry = parentModels.get(p.id);
        if (!entry) {
          entry = parentSpare.pop();
          if (!entry) {
            const model = createBeaverModel(p.coat.coat);
            scene.add(model.group);
            prepareBeaver(model.group);
            entry = { model, pace: 0, coat: '' };
          }
          parentModels.set(p.id, entry);
        }
        const g = entry.model.group;
        g.visible = !bare && p.inside === inside;
        if (!g.visible) continue;
        if (g.parent !== drawn) drawn.add(g);
        const parentCoat = `${p.coat.coat}:${p.coat.shade}`;
        if (parentCoat !== entry.coat) {
          entry.coat = parentCoat;
          entry.model.setCoat(p.coat.coat, p.coat.shade);
        }
        entry.pace += (p.pace - entry.pace) * 0.1;
        const parentStill = entry.pace < 0.05 && p.mode !== 'swim';
        // The pose of the errand's task (routines.ts), else a groom now and then while it stands.
        const parentAction = taskAction(p.task, world.time, seedOf(p.id)) ?? idleGroom(world.time, parentStill, seedOf(p.id));
        entry.model.update(now, entry.pace, p.mode === 'swim' ? 'swim' : 'walk', 0, null, p.carry ?? null, parentAction);
        g.position.set(p.x, p.y, p.z);
        g.rotation.y = p.heading;
      }
      // The snowdrifts that hold a stuck beaver (escort.ts): white mounds that hide most of it.
      while (driftMeshes.length < drifts.length) {
        const m = new THREE.Mesh(driftGeometry, driftMaterial);
        m.scale.set(1.5, 0.8, 1.5);
        scene.add(m);
        driftMeshes.push(m);
      }
      driftMeshes.forEach((m, i) => {
        const d = drifts[i];
        m.visible = !!d && !bare && !inside;
        if (d) m.position.set(d.x, d.y + 0.2, d.z);
      });
      for (const entry of neighbourModels.values()) entry.model.group.visible = false;
      recycle(neighbourModels, neighbourSpare, neighbours);
      for (const n of neighbours) {
        let entry = neighbourModels.get(n.id);
        if (!entry) {
          entry = neighbourSpare.pop();
          if (!entry) {
            const model = createBeaverModel(n.coat.coat);
            scene.add(model.group);
            prepareBeaver(model.group);
            entry = { model, coat: '', pace: 0 };
          }
          neighbourModels.set(n.id, entry);
        }
        const g = entry.model.group;
        g.visible = !bare && !inside;
        if (!g.visible) continue;
        const nCoat = `${n.coat.coat}:${n.coat.shade}`;
        if (nCoat !== entry.coat) {
          entry.coat = nCoat;
          entry.model.setCoat(n.coat.coat, n.coat.shade);
        }
        entry.pace += (n.pace - entry.pace) * 0.1;
        // Walking on the bank or swimming, with the load of its errand and the pose of its task (routines.ts).
        const nMode = n.mode ?? 'swim';
        const nSeed = seedOf(n.id);
        const nAction = taskAction(n.task, world.time, nSeed) ?? (n.task === 'rest' ? idleGroom(world.time, entry.pace < 0.05 && nMode === 'walk', nSeed) : null);
        entry.model.update(now, entry.pace, nMode, 0, null, n.carry, nAction);
        g.position.set(n.x, n.y, n.z);
        g.rotation.y = n.heading;
        g.scale.setScalar(n.scale);
      }
      while (neighbourViews.length < world.neighbours.length) neighbourViews.push(createLodgeView(scene, shadows, prepare, false));
      neighbourViews.forEach((view, i) => view.update(bare || inside ? null : world.neighbours[i]?.lodge ?? null, 1));
      for (const p of world.partners) {
        let entry = partnerModels.get(p.id);
        if (!entry) {
          const model = createBeaverModel(p.coat);
          model.setCoat(p.coat, p.shade);
          scene.add(model.group);
          prepareBeaver(model.group);
          entry = { model, pace: 0, x: p.x, z: p.z };
          partnerModels.set(p.id, entry);
        }
        const g = entry.model.group;
        // One in the lodge is drawn on its nest while the player is in, else it is out of sight.
        const home = p.state === 'home';
        g.visible = !bare && (home ? inside : !inside);
        if (!g.visible) continue;
        const ground = source ? source.store.heightAt(p.x, p.z) : 0;
        const depth = source ? source.store.waterDepth(p.x, p.z) : 0;
        const swim = !home && depth >= SWIM_ENTER_DEPTH;
        const nest = NEST_SPOTS[1]!;
        const at = home && world.lodge ? { x: world.lodge.x + nest.x, y: world.lodge.base, z: world.lodge.z + nest.z } : { x: p.x, y: swim ? ground + depth - SWIM_SINK : ground, z: p.z };
        const moved = Math.hypot(at.x - entry.x, at.z - entry.z);
        entry.x = at.x;
        entry.z = at.z;
        entry.pace += ((moved > 0.001 && moved < 5 ? 1 : 0) - entry.pace) * 0.2;
        // One the player has not met slaps its tail now and then while the player is within earshot, which is the nudge to go and look.
        const heard = p.state === 'alone' && Math.hypot(p.x - b.x, p.z - b.z) <= HEARD_DISTANCE;
        const phase = (p.id.length * 7 + p.id.charCodeAt(p.id.length - 1)) % SLAP_EVERY;
        const slapAge = heard ? (world.time + phase) % SLAP_EVERY : p.metAt === null ? null : world.time - p.metAt;
        const slapping = slapAge !== null && slapAge >= 0 && slapAge < SLAP_DURATION;
        const groom = slapping ? null : idleGroom(world.time, entry.pace < 0.05 && !swim, seedOf(p.id));
        entry.model.update(now, entry.pace, swim ? 'swim' : 'walk', 0, slapAge, null, groom);
        const wanted = home && world.lodge ? Math.atan2(-nest.x, -nest.z) : p.heading;
        if (g.parent !== drawn) drawn.add(g);
        g.position.set(at.x, at.y, at.z);
        g.rotation.y = wanted;
      }
      beaver.visible = !bare;
      beaver.position.set(b.x, b.y, b.z);
      beaver.rotation.y = b.heading;
      const size = STAGE_RULES[stageAt(world.clock, world.bornAt)].scale;
      beaver.scale.setScalar(size);
      // The fly view orbits a free point on the ground, or on the water over it, not the beaver.
      const free = view.free ?? null;
      const fx = view.focus && !free ? view.focus : null;
      const flyY = fx && source ? source.store.heightAt(fx.x, fx.z) + (source.store.isWater(fx.x, fx.z) ? source.store.waterDepth(fx.x, fx.z) : 0) : 0;
      // A young beaver is small, so the camera follows it closer and lower (the square root of its size, so a baby is not too near).
      const follow = free || fx ? 1 : Math.sqrt(size);
      const dist = view.dist * follow;
      const look = free ? { x: free.x, y: free.y, z: free.z } : fx ? { x: fx.x, y: flyY + 1.0, z: fx.z } : { x: b.x, y: b.y + follow, z: b.z };
      const flat = Math.cos(view.pitch);
      const want = {
        x: b.x + Math.sin(view.yaw) * dist * flat,
        y: look.y + Math.sin(view.pitch) * dist,
        z: b.z + Math.cos(view.yaw) * dist * flat,
      };
      // Pull in before a tree, easing in over a quarter second and back out over a second.
      const clear = terrain && !inside && !fx && !free ? clearDistance(look, want, dist, terrain) : dist;
      const dt = Math.min(0.1, Math.max(0, now - lastFrame));
      lastFrame = now;
      reach = easeReach(reach, clear, dt);
      const f = reach / dist;
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
      pondView.setSeason(season);
      terrain?.setFelled(world.felled);
      if (terrain) {
        const from = [world.dams, world.spots, world.lodge, world.formerHomes, world.neighbours];
        if (from.some((f, i) => f !== clearingsFrom[i])) {
          clearingsFrom = from;
          clearings = clearingsOf(world.dams, world.spots, [world.lodge, ...world.formerHomes, ...world.neighbours.map((n) => n.lodge)]);
        }
        terrain.setClearings(world.ponds, clearings);
      }
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
      if (sunLight) {
        sunLight.position.copy(toSun);
        sunLight.intensity = sky.sun;
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
      pondView.update(world.ponds, world.spots);
      if (source) damView.update(world.dams, world.spots, (x, z) => source.store.heightAt(x, z), world.clock, world.ponds);
      while (formerViews.length < world.formerHomes.length) formerViews.push(createLodgeView(scene, shadows, prepare, false));
      while (formerStoreViews.length < world.formerHomes.length) formerStoreViews.push(createStoreView(scene, shadows, prepare));
      formerViews.forEach((view, i) => {
        const old = world.formerHomes[i];
        view.update(bare || !old ? null : old, old ? lodgeCondition(old, world.clock) : 1);
        // The parents who live there keep the lodge whole and its store full.
        formerStoreViews[i]?.update(bare || !old ? null : old, kept, (x, z) => (source ? source.store.heightAt(x, z) : 0), 1);
      });
      lodgeView.update(inside || bare ? null : world.lodge, world.lodge ? lodgeCondition(world.lodge, world.clock) : 1);
      storeView.update(inside || bare ? null : world.lodge, world.store, (x, z) => (source ? source.store.heightAt(x, z) : 0), storeCondition(world.storeWear, world.clock));
      if (!bare) animalView.update(animals, now);
      if (source && !bare) lilyView.update(source.store, b.x, b.z, world.clock, world.picked);
      if (source && !bare) rockView.update(source.store, b.x, b.z, world.rocksTaken, world.dropped, world.scents, world.clock);
      csm?.update();
      gl.render(drawn, camera);
    },
  };
}
