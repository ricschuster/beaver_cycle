// The free fly camera (?fly=free): a drone that moves in 3D, with no beaver and no orbit point. Pure on its numbers: no
// three.js, no DOM. The yaw and pitch mean what they do in cameraRig: yaw 0 looks north (-z), pitch is the angle down.

import { relativeToView } from '../actions/actions';
import type { ViewState } from './cameraRig';

export const FLY_MIN_PITCH = -1.4;
export const FLY_MAX_PITCH = 1.5;
/** Metres the drone keeps over the ground (and the water surface) below it, and the highest it may climb (metres above sea). */
export const FLY_MIN_HEIGHT = 3;
export const FLY_CEILING = 3500;
/** Speed in metres per second: a base plus a share of the height over the ground, so a high view covers the valley. */
const BASE_SPEED = 10;
const SPEED_PER_M = 0.8;
const CLIMB_SHARE = 0.6;
const LOOK_YAW = 0.006;
const LOOK_PITCH = 0.004;
/** Per second easing rate of a tap's flight, and the nearest the drone stops to the tapped point (metres). */
const GLIDE_RATE = 2.2;
const STAND_MIN = 40;
const STAND_SHARE = 0.3;
/** A wheel notch (100 units) moves this share of the height over the ground plus a base (metres). */
const WHEEL_SHARE = 0.002;
const WHEEL_BASE = 10;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Height of the ground, or of the water over it. */
export type Surface = (x: number, z: number) => number;

/** The direction the drone looks. */
export function lookDir(yaw: number, pitch: number): Vec3 {
  const c = Math.cos(pitch);
  return { x: -Math.sin(yaw) * c, y: -Math.sin(pitch), z: -Math.cos(yaw) * c };
}

/** Turn the view by a drag in pixels, inverted both ways: dragging right looks right and dragging down looks down. */
export function look(v: ViewState, dx: number, dy: number): void {
  v.yaw = wrap(v.yaw - dx * LOOK_YAW);
  v.pitch = clamp(v.pitch + dy * LOOK_PITCH, FLY_MIN_PITCH, FLY_MAX_PITCH);
}

/** Keep a height above the surface and under the ceiling. */
function keepAbove(y: number, surface: number): number {
  return Math.min(FLY_CEILING, Math.max(surface + FLY_MIN_HEIGHT, y));
}

/** Fly one frame: `move` is the stick (x left, z forward, along the view, climbing with the pitch), `climb` is -1..1 straight up. */
export function fly(v: ViewState, move: { x: number; z: number }, climb: number, dt: number, surface: Surface): void {
  const p = v.free;
  if (!p) return;
  const speed = (BASE_SPEED + Math.max(0, p.y - surface(p.x, p.z)) * SPEED_PER_M) * dt;
  const side = relativeToView({ x: move.x, z: 0 }, v.yaw);
  const ahead = lookDir(v.yaw, v.pitch);
  const x = p.x + (side.x + ahead.x * move.z) * speed;
  const z = p.z + (side.z + ahead.z * move.z) * speed;
  const y = p.y + (ahead.y * move.z + climb * CLIMB_SHARE) * speed;
  v.free = { x, y: keepAbove(y, surface(x, z)), z };
}

/** Zoom with the wheel: move along the look, in on a roll forward (negative delta), out on a roll back, by a share of the height over the ground. */
export function zoomFree(v: ViewState, delta: number, surface: Surface): void {
  const p = v.free;
  if (!p) return;
  const reach = -delta * WHEEL_SHARE * (WHEEL_BASE + Math.max(0, p.y - surface(p.x, p.z)));
  const ahead = lookDir(v.yaw, v.pitch);
  const x = p.x + ahead.x * reach;
  const z = p.z + ahead.z * reach;
  v.free = { x, y: keepAbove(p.y + ahead.y * reach, surface(x, z)), z };
}

/** Where a screen point (-1..1 each way, up and right positive) hits the ground, or null if it looks at the sky. */
export function pickGround(v: ViewState, ndcX: number, ndcY: number, aspect: number, vfov: number, surface: Surface, maxDist = 8000): Vec3 | null {
  const p = v.free;
  if (!p) return null;
  const f = lookDir(v.yaw, v.pitch);
  const h = Math.hypot(f.x, f.z) || 1;
  const r = { x: -f.z / h, y: 0, z: f.x / h };
  const u = { x: r.y * f.z - r.z * f.y, y: r.z * f.x - r.x * f.z, z: r.x * f.y - r.y * f.x };
  const t = Math.tan(vfov / 2);
  const a = ndcX * t * aspect;
  const b = ndcY * t;
  const d = { x: f.x + r.x * a + u.x * b, y: f.y + r.y * a + u.y * b, z: f.z + r.z * a + u.z * b };
  const len = Math.hypot(d.x, d.y, d.z);
  d.x /= len;
  d.y /= len;
  d.z /= len;
  const below = (s: number): boolean => p.y + d.y * s < surface(p.x + d.x * s, p.z + d.z * s);
  if (below(0)) return null;
  let lo = 0;
  let hi = 0;
  let step = 5;
  for (let s = 0; s < maxDist; s += step) {
    if (below(s + step)) {
      lo = s;
      hi = s + step;
      break;
    }
    step = Math.min(200, step * 1.04);
  }
  if (hi === 0) return null;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (below(mid)) hi = mid;
    else lo = mid;
  }
  return { x: p.x + d.x * hi, y: p.y + d.y * hi, z: p.z + d.z * hi };
}

export interface FlyTarget extends Vec3 {
  yaw: number;
  pitch: number;
}

/** Where to stop for a tapped point: on the line to it, a fraction of the way there but not nearer than the stand-off, facing it. */
export function flyTarget(from: Vec3, hit: Vec3, surface: Surface): FlyTarget {
  const dx = from.x - hit.x;
  const dy = from.y - hit.y;
  const dz = from.z - hit.z;
  const dist = Math.hypot(dx, dy, dz) || 1;
  const stand = Math.min(dist, Math.max(STAND_MIN, dist * STAND_SHARE));
  const x = hit.x + (dx / dist) * stand;
  const z = hit.z + (dz / dist) * stand;
  const y = keepAbove(hit.y + (dy / dist) * stand, surface(x, z));
  const tx = hit.x - x;
  const ty = hit.y - y;
  const tz = hit.z - z;
  return { x, y, z, yaw: Math.atan2(-tx, -tz), pitch: clamp(Math.asin(-ty / (Math.hypot(tx, ty, tz) || 1)), FLY_MIN_PITCH, FLY_MAX_PITCH) };
}

/** Glide toward the target for one frame. True once it has arrived. */
export function glide(v: ViewState, to: FlyTarget, dt: number): boolean {
  const p = v.free;
  if (!p) return true;
  const k = 1 - Math.exp(-GLIDE_RATE * dt);
  v.free = { x: p.x + (to.x - p.x) * k, y: p.y + (to.y - p.y) * k, z: p.z + (to.z - p.z) * k };
  v.yaw = wrap(v.yaw + wrap(to.yaw - v.yaw) * k);
  v.pitch += (to.pitch - v.pitch) * k;
  return Math.hypot(to.x - v.free.x, to.y - v.free.y, to.z - v.free.z) < 0.5 && Math.abs(wrap(to.yaw - v.yaw)) < 0.01;
}
