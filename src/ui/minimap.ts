// A round minimap at the top right, a trial (docs/design/31_minimap.md): the ground around the beaver (land cover, a
// little hill shade, the lake and the ponds, the streams), the home lodge, and the beaver as an arrow. It turns with the
// camera, so up on the map is ahead on the screen and up on the stick, with an N on the rim. ?minimap=north keeps north up,
// and ?minimap=0 or the test menu turns it off (an automated browser starts with it off). All of it lives in this file, so
// the trial can be deleted in one go (and its few lines in main.ts and the test menu).
// The ground is sampled into a small image only when the beaver has moved a little or the ponds change, a few rows a frame;
// the map itself is redrawn a few times a second from that image, which is cheap on a tablet.

import type { Terrain } from '../sim/terrain';

/** How the map turns: north always up, or turning so the camera looks up the map. */
export type MinimapMode = 'off' | 'north' | 'turn';

/** Metres from the centre to the rim of the map: the map is 300 m across. */
export const MAP_RADIUS = 150;
/** The ground image is sampled every this many metres. */
export const CELL = 5;
/** The ground image reaches this far from where it was sampled, so it still fills the circle after a move or a turn. */
const SAMPLE_HALF = 180;
/** Resample the ground when the beaver is this far from where it was last sampled, metres. */
const RESAMPLE_MOVE = 15;
/** Resample anyway this often, for ground tiles that were still loading, milliseconds. A pond that changes resamples at once. */
const RESAMPLE_EVERY = 8000;
/** Rows of the ground image sampled each frame while a sampling is under way (of 72). */
const ROWS_PER_FRAME = 8;
/** Redraw the map this often, milliseconds. */
const REDRAW_EVERY = 100;
/** The map's size on the screen, CSS pixels. */
const SIZE = 140;

/**
 * What ?minimap= asks for: 0 or off turns it off, north keeps north up, anything else turns it with the camera. Without the
 * parameter it is on and turning, except in an automated browser, so the tests and the manual's pictures stay as they were.
 */
export function minimapMode(param: string | null, automated = false): MinimapMode {
  if (param === null) return automated ? 'off' : 'turn';
  if (param === '0' || param === 'off') return 'off';
  if (param === 'north') return 'north';
  return 'turn';
}

/** The next mode for the test menu button: turning, north up, off, and round again. */
export function nextMode(mode: MinimapMode): MinimapMode {
  return mode === 'turn' ? 'north' : mode === 'north' ? 'off' : 'turn';
}

/**
 * How far the map is turned on the screen, radians clockwise. North up does not turn. Turning puts the way the camera looks
 * at the top: the camera sits at `yaw` from the beaver (yaw 0 is south of it, cameraRig.ts), so it looks toward heading yaw + pi.
 */
export function mapRotation(mode: MinimapMode, yaw: number): number {
  return mode === 'turn' ? yaw : 0;
}

/**
 * A point `dx`, `dz` metres from the beaver as pixels from the map centre, with `scale` pixels per metre. North (-z) is up
 * and east (+x) right before the map turns by `rotation` (clockwise on the screen).
 */
export function toMap(dx: number, dz: number, scale: number, rotation: number): { x: number; y: number } {
  const x = dx * scale;
  const y = dz * scale;
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  return { x: x * c - y * s, y: x * s + y * c };
}

/**
 * The screen angle of the beaver's arrow, radians clockwise from straight up. A heading points along (sin h, cos h) in
 * x and z (step.ts), so heading 0 is south, down the map.
 */
export function arrowAngle(heading: number, rotation: number): number {
  const a = Math.PI - heading + rotation;
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** The colour of a ground cell as [r, g, b]: water, or the land cover class (tools/tiles/build_tiles.py CLASSES). */
export function groundColour(water: boolean, cover: number): [number, number, number] {
  if (water) return [78, 140, 196];
  switch (cover) {
    case 1:
      return [168, 200, 112]; // meadow
    case 2:
      return [78, 128, 72]; // forest
    case 3:
      return [138, 160, 92]; // scrub
    case 4:
      return [176, 170, 160]; // rock
    case 5:
      return [120, 160, 130]; // wetland
    default:
      return [190, 180, 140]; // bare ground
  }
}

export interface MinimapInput {
  /** The ground with the ponds' water in it (`withPonds`). */
  ground: Terrain;
  /** Changes when the ponds change, so the ground is sampled again (the `world.ponds` array works). */
  pondsKey: unknown;
  beaver: { x: number; z: number; heading: number };
  /** The camera's yaw, for the turning map. */
  yaw: number;
  lodge: { x: number; z: number } | null;
}

export interface Minimap {
  /** Call every frame; it samples and draws only when it is time. */
  update(now: number, input: MinimapInput): void;
  mode(): MinimapMode;
  setMode(mode: MinimapMode): void;
}

export function createMinimap(parent: HTMLElement, initial: MinimapMode): Minimap {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.id = 'minimap';
  canvas.width = Math.round(SIZE * dpr);
  canvas.height = Math.round(SIZE * dpr);
  // Under the ? and Test buttons at the top right (44 px high at top 8), clear of the touch buttons at the bottom.
  canvas.style.cssText = `position:fixed;top:60px;right:max(8px,env(safe-area-inset-right));z-index:5;width:${SIZE}px;height:${SIZE}px;border-radius:50%;box-shadow:0 0 0 3px rgba(0,0,0,.45);pointer-events:none;`;
  const ctx = canvas.getContext('2d');

  const n = Math.round((2 * SAMPLE_HALF) / CELL);
  const ground = document.createElement('canvas');
  ground.width = n;
  ground.height = n;
  const gctx = ground.getContext('2d');
  const image = gctx?.createImageData(n, n) ?? null;
  const heights = new Float32Array(n * n);
  let sampled: { x: number; z: number; at: number; pondsKey: unknown } | null = null;
  // A sampling under way: a few rows each frame, so a tablet never pays for the whole image in one frame.
  let pending: { x: number; z: number; row: number; heightRows: number; pondsKey: unknown } | null = null;
  let streams: { x: number; z: number; ux: number; uz: number }[] = [];
  let drawnAt = -Infinity;
  let mode = initial;

  const sampleRows = (now: number, g: Terrain): void => {
    const p = pending;
    if (!p || !image || !gctx) return;
    const x0 = p.x - SAMPLE_HALF;
    const z0 = p.z - SAMPLE_HALF;
    const d = image.data;
    const end = Math.min(n, p.row + ROWS_PER_FRAME);
    // The shade of a row needs the heights of the row south of it too.
    for (; p.heightRows < Math.min(n, end + 1); p.heightRows++) {
      const j = p.heightRows;
      for (let i = 0; i < n; i++) heights[j * n + i] = g.heightAt(x0 + (i + 0.5) * CELL, z0 + (j + 0.5) * CELL);
    }
    for (let j = p.row; j < end; j++) {
      for (let i = 0; i < n; i++) {
        const x = x0 + (i + 0.5) * CELL;
        const z = z0 + (j + 0.5) * CELL;
        const water = g.waterDepth(x, z) > 0;
        const [r, gr, bl] = groundColour(water, g.coverAt?.(x, z) ?? 0);
        // A soft hill shade lit from the north west, so the valley sides read.
        const h = heights[j * n + i]!;
        const east = heights[j * n + Math.min(i + 1, n - 1)]! - h;
        const south = heights[Math.min(j + 1, n - 1) * n + i]! - h;
        const shade = water ? 1 : Math.max(0.65, Math.min(1.25, 1 + (east + south) * 0.04));
        const k = (j * n + i) * 4;
        d[k] = Math.min(255, r * shade);
        d[k + 1] = Math.min(255, gr * shade);
        d[k + 2] = Math.min(255, bl * shade);
        d[k + 3] = 255;
      }
    }
    p.row = end;
    if (p.row < n) return;
    gctx.putImageData(image, 0, 0);
    streams = g.streamPoints?.(p.x, p.z, SAMPLE_HALF, 6) ?? [];
    sampled = { x: p.x, z: p.z, at: now, pondsKey: p.pondsKey };
    pending = null;
    drawnAt = -Infinity;
  };

  const draw = (input: MinimapInput): void => {
    if (!ctx || !sampled) return;
    const w = canvas.width;
    const r = w / 2;
    const scale = r / MAP_RADIUS;
    const rot = mapRotation(mode, input.yaw);
    const b = input.beaver;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, w);
    ctx.save();
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#bdb48c';
    ctx.fillRect(0, 0, w, w);
    // The world, north up and centred on the beaver, then turned about the centre.
    ctx.translate(r, r);
    ctx.rotate(rot);
    ctx.imageSmoothingEnabled = true;
    const half = SAMPLE_HALF * scale;
    ctx.drawImage(ground, (sampled.x - b.x) * scale - half, (sampled.z - b.z) * scale - half, half * 2, half * 2);
    ctx.strokeStyle = 'rgb(70,130,190)';
    ctx.lineWidth = 2 * dpr;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const p of streams) {
      const x = (p.x - b.x) * scale;
      const y = (p.z - b.z) * scale;
      ctx.moveTo(x - p.ux * 3.5 * scale, y - p.uz * 3.5 * scale);
      ctx.lineTo(x + p.ux * 3.5 * scale, y + p.uz * 3.5 * scale);
    }
    ctx.stroke();
    if (input.lodge) {
      const x = (input.lodge.x - b.x) * scale;
      const y = (input.lodge.z - b.z) * scale;
      // A lodge beyond the rim sits on the rim, so the way home always shows.
      const d = Math.hypot(x, y);
      const k = d > r - 11 * dpr ? (r - 11 * dpr) / d : 1;
      ctx.save();
      ctx.translate(x * k, y * k);
      ctx.rotate(-rot);
      ctx.fillStyle = '#7a4a24';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.arc(0, 3 * dpr, 9 * dpr, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    // The camera's view, a faint wedge, and the beaver, an arrow at the centre.
    ctx.setTransform(1, 0, 0, 1, r, r);
    ctx.rotate(rot - mapRotation('turn', input.yaw));
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r * 0.55, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.setTransform(1, 0, 0, 1, r, r);
    ctx.rotate(arrowAngle(b.heading, rot));
    const a = 8 * dpr;
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#3a2a10';
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    ctx.moveTo(0, -a * 1.3);
    ctx.lineTo(a * 0.85, a);
    ctx.lineTo(0, a * 0.45);
    ctx.lineTo(-a * 0.85, a);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // An N on the rim where north is.
    const north = toMap(0, -1, r - 11 * dpr, rot);
    ctx.setTransform(1, 0, 0, 1, r + north.x, r + north.y);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.beginPath();
    ctx.arc(0, 0, 8 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${11 * dpr}px system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, 0.5 * dpr);
  };

  // Off, the canvas leaves the page altogether, so the page has only the game's own canvas (the browser tests look for it).
  const show = (): void => {
    if (mode === 'off') canvas.remove();
    else if (!canvas.isConnected) parent.appendChild(canvas);
  };
  show();

  return {
    update(now, input) {
      if (mode === 'off') return;
      const b = input.beaver;
      if (pending) sampleRows(now, input.ground);
      else if (!sampled || Math.hypot(b.x - sampled.x, b.z - sampled.z) > RESAMPLE_MOVE || now - sampled.at > RESAMPLE_EVERY || input.pondsKey !== sampled.pondsKey) {
        pending = { x: b.x, z: b.z, row: 0, heightRows: 0, pondsKey: input.pondsKey };
      }
      if (now - drawnAt < REDRAW_EVERY) return;
      drawnAt = now;
      draw(input);
    },
    mode: () => mode,
    setMode(next) {
      mode = next;
      drawnAt = -Infinity;
      show();
    },
  };
}
