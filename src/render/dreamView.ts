// The dream's scene (docs/design/29_dream_candy_land.md): candy land drawn with three.js on its own canvas, made when a dream
// starts and thrown away on waking. It reads the dream's state and never changes it.
import * as THREE from 'three';
import type { Coat } from '../sim/family';
import { CHOCOLATE, CHOCOLATE_LEVEL, dreamHeight, type DreamBeaver, type DreamEvent, type DreamLand, type DreamState, type Sweet, type SweetKind } from '../sim/dream';
import { SWIM_SINK } from '../sim/state';
import type { ViewState } from './cameraRig';
import { SLAP_DURATION, type BeaverModel } from './beaverModel';
import { FAR_MALLOW, disposeModel, dreamPlayer, leapPitch, mallowFar, mallowModel, placeMallow } from './dreamBeavers';
import { candy, pathStones, propsGeometry, starShape, sweetShapes } from './dreamProps';
import { DREAM_FOG, cloudRing, createChocolateRiver, farScoops, groundGeometry, hillScoops, skyDome, sunTexture } from './dreamScenery';
import { createParticles, dotTexture, giggleTexture, shadowTexture, sparkleTexture } from './dreamEffects';
import { seedOf } from './propShapes';

export interface DreamView {
  /** The canvas, which also takes the camera's drag and zoom input (`createCameraRig`). */
  canvas: HTMLCanvasElement;
  /** Draw the dream as it is, from the view. `events` are this step's, for little effects such as a sparkle on a sweet. */
  draw(state: DreamState, view: ViewState, events: readonly DreamEvent[]): void;
  /** Free the GPU memory and remove the canvas. */
  dispose(): void;
  /** Draw calls and triangles of the last frame, for the preview page and tuning. */
  stats?(): { calls: number; triangles: number };
}

/** The highest pixel ratio the dream draws at: sharp enough on a tablet, and kinder to its GPU than 2 or 3. */
export const DREAM_PIXEL_RATIO = 1.5;
/** How high over the ground (or the chocolate) the camera keeps. */
const CAMERA_CLEAR = 0.7;
/** How far inside the edge of the land the camera keeps, clear of the scoops on the edge hills (metres). */
const CAMERA_EDGE = 13;
/** Seconds a giggle shows, a splash spreads, and a tail slap can still start a splash. */
const GIGGLE_SECONDS = 1.5;
const SPLASH_SECONDS = 0.8;

/**
 * Where the camera goes and what it looks at: orbiting the beaver at the view's yaw, pitch and distance, as the waking
 * game's camera does, and kept `CAMERA_CLEAR` over the ground and the chocolate that `groundAt` gives under it. With `limit`,
 * the camera comes in along its line to the beaver rather than go further than that from the middle on x or z (into the
 * scoops on the edge hills).
 */
export function cameraSpot(
  b: { x: number; y: number; z: number },
  view: Pick<ViewState, 'yaw' | 'pitch' | 'dist'>,
  groundAt: (x: number, z: number) => number,
  limit = Infinity,
): { eye: THREE.Vector3; look: THREE.Vector3 } {
  const look = new THREE.Vector3(b.x, b.y + 0.9, b.z);
  const flat = Math.cos(view.pitch);
  let dx = Math.sin(view.yaw) * view.dist * flat;
  let dz = Math.cos(view.yaw) * view.dist * flat;
  let dy = Math.sin(view.pitch) * view.dist;
  // The share of the way out that stays inside the limit on both axes, never nearer than about a metre and a half.
  let share = 1;
  for (const [at, d] of [[b.x, dx], [b.z, dz]] as const) {
    const room = Math.max(limit, Math.abs(at) + 1.5) - Math.sign(d) * at;
    if (Math.abs(d) > 1e-9 && room < Math.abs(d)) share = Math.min(share, room / Math.abs(d));
  }
  share = Math.max(share, Math.min(1, 1.5 / view.dist));
  dx *= share;
  dz *= share;
  dy *= share;
  const x = b.x + dx;
  const z = b.z + dz;
  const y = Math.max(look.y + dy, groundAt(x, z) + CAMERA_CLEAR);
  return { eye: new THREE.Vector3(x, y, z), look };
}

/** Where a sweet floats or rests at dream time `time`: bobbing on the chocolate, or hovering over the ground. */
export function sweetHeight(sweet: Pick<Sweet, 'floating'>, ground: number, time: number, phase: number): number {
  return sweet.floating ? CHOCOLATE_LEVEL + 0.16 + 0.05 * Math.sin(time * 1.8 + phase) : ground + 0.5 + 0.09 * Math.sin(time * 2.2 + phase);
}

/** The scene for one night's land, with the player's beaver in its own coat. The canvas fills `parent`. */
export function createDreamView(parent: HTMLElement, land: DreamLand, coat: Coat): DreamView {
  const gl = new THREE.WebGLRenderer({ antialias: true });
  gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, DREAM_PIXEL_RATIO));
  const canvas = gl.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  parent.append(canvas);

  const heightAt = (x: number, z: number): number => dreamHeight(land, x, z);
  /** The top of what is under a point: the ground, or the chocolate over the river bed. */
  const surfaceAt = (x: number, z: number): number => Math.max(heightAt(x, z), CHOCOLATE_LEVEL);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(DREAM_FOG);
  scene.fog = new THREE.Fog(DREAM_FOG, 45, 290);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
  const textures: THREE.Texture[] = [];
  const keep = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  // Soft light: a warm pink white sky over a pink ground glow, and a gentle sun from high on one side.
  scene.add(new THREE.HemisphereLight(0xfff6fb, 0xf3c3d6, 2.2));
  const sunDir = new THREE.Vector3(-0.4, 0.8, -0.45).normalize();
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.35);
  sun.position.copy(sunDir).multiplyScalar(100);
  scene.add(sun);

  const sky = skyDome(600);
  scene.add(sky);
  const clouds = cloudRing(380, land.seed);
  scene.add(clouds);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: keep(sunTexture()), fog: false, depthWrite: false, transparent: true }));
  sunSprite.scale.setScalar(150);
  sunSprite.renderOrder = -1;
  scene.add(sunSprite);
  scene.add(farScoops(land));
  for (let side = 0; side < 4; side++) scene.add(hillScoops(land, side));

  const ground = new THREE.Mesh(groundGeometry(land), new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(ground);
  const river = createChocolateRiver(land);
  scene.add(river.mesh);
  const candyMaterial = (shininess: number): THREE.MeshPhongMaterial => new THREE.MeshPhongMaterial({ vertexColors: true, shininess, specular: 0x3a3a3a });
  scene.add(new THREE.Mesh(pathStones(land.path, heightAt), candyMaterial(50)));

  // The props, merged by patches of land, so the patches behind the camera are not drawn.
  const PATCHES = 3;
  const patchOf = (v: number): number => Math.min(PATCHES - 1, Math.max(0, Math.floor(((v + land.half) / (land.half * 2)) * PATCHES)));
  const propMaterial = candyMaterial(40);
  for (let i = 0; i < PATCHES * PATCHES; i++) {
    const props = land.props.filter((p) => patchOf(p.x) + patchOf(p.z) * PATCHES === i);
    if (props.length === 0) continue;
    const geo = propsGeometry(props, (p) => {
      // Stand on the lowest ground under the foot, a little sunk, so it never floats on a slope.
      const r = 0.5 * p.size;
      return Math.min(heightAt(p.x, p.z), heightAt(p.x + r, p.z), heightAt(p.x - r, p.z), heightAt(p.x, p.z + r), heightAt(p.x, p.z - r)) - 0.06;
    });
    geo.computeBoundingSphere();
    scene.add(new THREE.Mesh(geo, propMaterial));
  }

  // Sugar twinkles over the meadow: tiny points that flash now and then, each at its own beat.
  const twinkleTime = { value: 0 };
  {
    const n = 1400;
    const pos: number[] = [];
    const phase: number[] = [];
    let s = land.seed * 9301 + 49297;
    const random = (): number => {
      s = (s * 16807 + 11) % 2147483647;
      return (s & 0xffff) / 0x10000;
    };
    for (let i = 0; pos.length < n * 3 && i < n * 4; i++) {
      const x = (random() * 2 - 1) * (land.half - 14);
      const z = (random() * 2 - 1) * (land.half - 14);
      const h = heightAt(x, z);
      if (h < CHOCOLATE_LEVEL + 0.2) continue;
      pos.push(x, h + 0.12, z);
      phase.push(random() * 40);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('phase', new THREE.Float32BufferAttribute(phase, 1));
    const material = new THREE.PointsMaterial({ size: 0.32, map: keep(sparkleTexture()), color: 0xffffff, transparent: true, depthWrite: false });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = twinkleTime;
      shader.vertexShader = `attribute float phase;\nuniform float uTime;\n${shader.vertexShader}`.replace(
        'gl_PointSize = size;',
        'gl_PointSize = size * pow(max(0.0, sin(uTime * 1.3 + phase)), 8.0);',
      );
    };
    scene.add(new THREE.Points(geo, material));
  }

  // The beavers: the player's own, and a marshmallow beaver for each one in the dream, made when first seen.
  const player = dreamPlayer(coat);
  scene.add(player.group);
  const mallows = new Map<string, { model: BeaverModel; far: THREE.Mesh }>();

  // A soft round shadow under each beaver, all in one instanced mesh.
  const shadowCount = 16;
  const shadows = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: keep(shadowTexture()), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    shadowCount,
  );
  shadows.frustumCulled = false;
  scene.add(shadows);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const normal = new THREE.Vector3();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  const putShadow = (i: number, b: DreamBeaver, scale: number): void => {
    if (i >= shadowCount) return;
    // Only on land: on the chocolate it would not show.
    const g = heightAt(b.x, b.z);
    const lift = b.y - g;
    const shown = b.mode === 'walk' && g > CHOCOLATE_LEVEL - 0.05;
    const f = shown ? Math.max(0.35, 1 - lift / 2) * scale : 0;
    normal.set(heightAt(b.x - 0.5, b.z) - heightAt(b.x + 0.5, b.z), 1, heightAt(b.x, b.z - 0.5) - heightAt(b.x, b.z + 0.5)).normalize();
    q.setFromUnitVectors(up, normal).multiply(turn.setFromAxisAngle(up, b.heading));
    // High enough to lie over a stepping stone of the path.
    m4.compose(v3.set(b.x, g + 0.13, b.z), q, s3.set(0.75 * f, 1, 1.3 * f));
    shadows.setMatrixAt(i, m4);
  };

  // The marker over whoever is it in tag: a little gold star with a glow.
  const marker = new THREE.Group();
  const markerStar = new THREE.Mesh(starShape(0.17, 0.06, new THREE.Color(0xffd84d)), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xc89a10, emissiveIntensity: 0.8 }));
  marker.add(markerStar);
  const markerGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: keep(dotTexture()), color: 0xfff2a0, transparent: true, opacity: 0.55, depthWrite: false }));
  markerGlow.scale.setScalar(0.7);
  marker.add(markerGlow);
  marker.visible = false;
  scene.add(marker);

  // The sweets, one instanced mesh per part of each kind, grown when there are more sweets than room.
  const shapes = sweetShapes();
  const sweetMaterials = {
    plain: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 90, specular: 0x555555 }),
    star: new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xd8a018, emissiveIntensity: 0.7 }),
  };
  const sweetMeshes: Record<SweetKind, THREE.InstancedMesh[]> = { drop: [], swirl: [], star: [] };
  const makeSweetMeshes = (kind: SweetKind, room: number): void => {
    for (const old of sweetMeshes[kind]) {
      scene.remove(old);
      old.dispose();
    }
    sweetMeshes[kind] = shapes[kind].map((part) => {
      const mesh = new THREE.InstancedMesh(part.geometry, kind === 'star' ? sweetMaterials.star : sweetMaterials.plain, room);
      mesh.frustumCulled = false;
      if (part.tinted) mesh.setColorAt(0, new THREE.Color(0xffffff));
      mesh.userData.tinted = part.tinted;
      scene.add(mesh);
      return mesh;
    });
  };
  for (const kind of ['drop', 'swirl', 'star'] as const) makeSweetMeshes(kind, 48);
  const starGlowTex = keep(dotTexture());
  const STAR_GLOWS = 64;
  const starGlowGeo = new THREE.BufferGeometry();
  starGlowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STAR_GLOWS * 3), 3));
  const starGlow = new THREE.Points(starGlowGeo, new THREE.PointsMaterial({ size: 1.3, map: starGlowTex, color: 0xfff0a0, transparent: true, opacity: 0.6, depthWrite: false }));
  starGlow.frustumCulled = false;
  scene.add(starGlow);
  const phases = new Map<string, number>();
  const phaseOf = (id: string): number => {
    let p = phases.get(id);
    if (p === undefined) {
      p = (seedOf(id) % 1000) / 159.15;
      phases.set(id, p);
    }
    return p;
  };
  const tint = new THREE.Color();
  const e = new THREE.Euler();
  const drawSweets = (state: DreamState): void => {
    const time = state.time;
    const glow = starGlowGeo.getAttribute('position') as THREE.BufferAttribute;
    let glows = 0;
    for (const kind of ['drop', 'swirl', 'star'] as const) {
      const shown = state.sweets.filter((s) => s.kind === kind && !s.taken);
      if (shown.length > (sweetMeshes[kind][0]?.instanceMatrix.count ?? 0)) makeSweetMeshes(kind, Math.ceil(shown.length * 1.5));
      shown.forEach((s, i) => {
        const phase = phaseOf(s.id);
        const y = sweetHeight(s, heightAt(s.x, s.z), time, phase);
        // Spin about the upright, a star faster; a drop also rocks a little.
        e.set(kind === 'drop' ? 0.25 * Math.sin(time * 2 + phase) : 0, time * (kind === 'star' ? 2.2 : 1.3) + phase, 0);
        m4.compose(v3.set(s.x, y, s.z), q.setFromEuler(e), s3.set(1, 1, 1));
        tint.copy(candy(s.colour, 0.04));
        for (const mesh of sweetMeshes[kind]) {
          mesh.setMatrixAt(i, m4);
          if (mesh.userData.tinted) mesh.setColorAt(i, tint);
        }
        if (kind === 'star' && glows < STAR_GLOWS) glow.setXYZ(glows++, s.x, y, s.z);
      });
      for (const mesh of sweetMeshes[kind]) {
        mesh.count = shown.length;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
    glow.needsUpdate = true;
    starGlowGeo.setDrawRange(0, glows);
    starGlow.visible = glows > 0;
  };

  // Sparkles for sweets and cheers, and chocolate drops for splashes.
  const sparkles = createParticles(160, keep(sparkleTexture()), 0.6, 1.2);
  scene.add(sparkles.points);
  const drops = createParticles(60, keep(dotTexture()), 0.16, 9);
  scene.add(drops.points);
  const GOLD = [0xffe066, 0xfff4c2, 0xffffff].map((c) => new THREE.Color(c));
  const CONFETTI = [0, 1, 2, 3, 4, 5].map((i) => candy(i, 0)).concat(new THREE.Color(0xffffff));
  const CHOC = [new THREE.Color(CHOCOLATE), new THREE.Color(0x8a5030)];
  const ringGeo = new THREE.RingGeometry(0.7, 1, 32).rotateX(-Math.PI / 2);
  const rings = [0, 1, 2].map(() => {
    const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x9a6038, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, at: -Infinity };
  });
  let nextRing = 0;
  const splash = (x: number, z: number, time: number): void => {
    const r = rings[nextRing]!;
    nextRing = (nextRing + 1) % rings.length;
    r.at = time;
    r.mesh.position.set(x, CHOCOLATE_LEVEL + 0.06, z);
    drops.emit(x, CHOCOLATE_LEVEL + 0.1, z, time, 14, CHOC, 3.2, 1.6, 0.9);
  };
  const seenSlap = new Map<string, number | null>();
  const watchSlap = (id: string, b: DreamBeaver, time: number): void => {
    const last = seenSlap.get(id);
    seenSlap.set(id, b.slapAt);
    if (b.slapAt === null || b.slapAt === last || last === undefined) return;
    if (b.mode === 'swim' && time - b.slapAt < SLAP_DURATION) splash(b.x, b.z, time);
  };

  // A "hee hee" over each hidden marshmallow beaver that has just giggled.
  const giggleTex = keep(giggleTexture());
  const giggles = new Map<string, THREE.Sprite>();
  const giggleOf = (id: string): THREE.Sprite => {
    let s = giggles.get(id);
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ map: giggleTex, transparent: true, depthWrite: false, fog: false }));
      s.scale.set(2, 1, 1);
      scene.add(s);
      giggles.set(id, s);
    }
    return s;
  };

  let lastTrail = -Infinity;
  const effects = (state: DreamState, events: readonly DreamEvent[]): void => {
    const time = state.time;
    const b = state.beaver;
    const near = (who: string): DreamBeaver => state.mallows.find((m) => m.id === who || m.name === who) ?? b;
    for (const ev of events) {
      if (ev.what === 'sweet') sparkles.emit(ev.x, surfaceAt(ev.x, ev.z) + 0.5, ev.z, time, ev.kind === 'star' ? 26 : 14, ev.kind === 'star' ? GOLD : CONFETTI, 2.6, 1.6, 0.9);
      else if (ev.what === 'rush') sparkles.emit(b.x, b.y + 0.5, b.z, time, 24, GOLD, 3, 2.2, 1);
      else if (ev.what === 'shower' || ev.what === 'tagEnd' || ev.what === 'seekEnd') sparkles.emit(b.x, b.y + 1.5, b.z, time, 50, CONFETTI, 4.5, 3.5, 1.4);
      else if (ev.what === 'found' || ev.what === 'greet') {
        const m = near(ev.who);
        sparkles.emit(m.x, m.y + 0.8, m.z, time, ev.what === 'found' ? 18 : 8, CONFETTI, 2.4, 1.2, 0.9);
      }
    }
    // A trail of gold while the sugar rush lasts.
    if (time < state.rushUntil && time - lastTrail > 0.07) {
      lastTrail = time;
      sparkles.emit(b.x, b.y + 0.35, b.z, time, 2, GOLD, 0.8, 0.5, 0.7);
    }
    sparkles.update(time);
    drops.update(time);
    for (const r of rings) {
      const f = (time - r.at) / SPLASH_SECONDS;
      r.mesh.visible = f >= 0 && f < 1;
      if (r.mesh.visible) {
        r.mesh.scale.setScalar(0.4 + f * 2.4);
        (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - f);
      }
    }
  };

  let lastW = 0;
  let lastH = 0;
  const resize = (): void => {
    const w = parent.clientWidth || window.innerWidth;
    const h = parent.clientHeight || window.innerHeight;
    if (w === lastW && h === lastH) return;
    lastW = w;
    lastH = h;
    gl.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  observer?.observe(parent);
  resize();

  return {
    canvas,
    draw(state, view, events) {
      resize();
      const time = state.time;
      const b = state.beaver;
      const { eye, look } = cameraSpot(b, view, surfaceAt, land.half - CAMERA_EDGE);
      camera.position.copy(eye);
      camera.lookAt(look);
      watchSlap('player', b, time);
      const slapAge = (at: number | null): number | null => (at === null || time - at >= SLAP_DURATION || time < at ? null : time - at);
      player.update(time, Math.min(1, b.speed / 4), b.mode, 0, slapAge(b.slapAt), null, null);
      player.group.position.set(b.x, b.y - (b.mode === 'swim' ? SWIM_SINK : 0), b.z);
      player.group.rotation.set(leapPitch(b, time), b.heading, 0, 'YXZ');
      putShadow(0, b, 1);

      const it = state.game.kind === 'tag' ? state.game.it : null;
      let marked: { x: number; y: number; z: number } | null = it === 'player' ? player.group.position : null;
      const seen = new Set<string>();
      state.mallows.forEach((m, i) => {
        seen.add(m.id);
        let entry = mallows.get(m.id);
        if (!entry) {
          entry = { model: mallowModel(m.colour), far: mallowFar(m.colour) };
          mallows.set(m.id, entry);
          scene.add(entry.model.group, entry.far);
        }
        const { model, far } = entry;
        watchSlap(m.id, m, time);
        const y = m.y - (m.mode === 'swim' ? SWIM_SINK : 0);
        // Far away, the plain few triangle marshmallow beaver; near, the posed one.
        const near = Math.hypot(m.x - eye.x, m.z - eye.z) < FAR_MALLOW || it === m.id;
        model.group.visible = near;
        far.visible = !near;
        if (near) placeMallow(model, m, time, y, slapAge(m.slapAt));
        else {
          far.position.set(m.x, y, m.z);
          far.rotation.y = m.heading;
        }
        putShadow(i + 1, m, 1.05);
        if (it === m.id) marked = model.group.position;
        const age = m.giggleAt === null ? Infinity : time - m.giggleAt;
        const showGiggle = m.state === 'hidden' && age >= 0 && age < GIGGLE_SECONDS;
        const giggle = showGiggle || giggles.has(m.id) ? giggleOf(m.id) : null;
        if (giggle) {
          giggle.visible = showGiggle;
          if (showGiggle) {
            const f = age / GIGGLE_SECONDS;
            giggle.position.set(m.x, m.y + 1.4 + f * 0.8, m.z);
            giggle.material.opacity = Math.min(1, age * 6) * (1 - f * f);
          }
        }
      });
      for (const [id, entry] of mallows) {
        if (seen.has(id)) continue;
        entry.model.group.visible = false;
        entry.far.visible = false;
      }
      shadows.count = Math.min(shadowCount, state.mallows.length + 1);
      shadows.instanceMatrix.needsUpdate = true;

      marker.visible = marked !== null;
      if (marked) {
        const p = marked as { x: number; y: number; z: number };
        marker.position.set(p.x, p.y + 1.05 + 0.06 * Math.sin(time * 4), p.z);
        // The star faces the camera, so it always reads as a star, and rocks a little.
        markerStar.quaternion.copy(camera.quaternion);
        markerStar.rotateZ(0.3 * Math.sin(time * 3));
      }

      drawSweets(state);
      effects(state, events);
      river.update(time);
      twinkleTime.value = time;
      clouds.rotation.y = time * 0.004;

      sky.position.copy(eye);
      sunSprite.position.copy(eye).addScaledVector(sunDir, 500);
      gl.render(scene, camera);
    },
    stats() {
      return { calls: gl.info.render.calls, triangles: gl.info.render.triangles };
    },
    dispose() {
      observer?.disconnect();
      for (const model of [player, ...[...mallows.values()].map((e) => e.model)]) {
        scene.remove(model.group);
        disposeModel(model.group);
      }
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((o) => {
        if (o instanceof THREE.InstancedMesh) o.dispose();
        if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Sprite) {
          geometries.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
        }
      });
      for (const kind of ['drop', 'swirl', 'star'] as const) for (const part of shapes[kind]) geometries.add(part.geometry);
      river.dispose();
      sparkles.dispose();
      drops.dispose();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      gl.dispose();
      gl.forceContextLoss();
      canvas.remove();
    },
  };
}
