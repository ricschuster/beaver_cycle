// Logs: a felled tree lies where it fell. A beaver cannot carry one, only drag it by the end, one at a
// time, and it floats in deep water. Plain data and pure functions, no three.js (ADR 0007).
import type { Terrain } from './terrain';

export interface Log {
  /** The id of the tree it came from. */
  id: string;
  /** Centre of the log. */
  x: number;
  y: number;
  z: number;
  /** Direction its far end points from the near end, in radians, 0 along +z. */
  heading: number;
  /** Metres. */
  length: number;
  /** True while it lies on the water instead of the ground. */
  floating: boolean;
}

/** Metres across a log is twice this. */
export const LOG_RADIUS = 0.35;
/** Water this deep (metres) lifts a log off the bed so it floats. */
export const FLOAT_DEPTH = 0.4;
/** How far the beaver reaches to grab a log, in metres from the nearest point on the log. */
export const GRAB_REACH = 2.5;
/** Metres between the beaver and the near end of the log it drags. */
export const DRAG_GAP = 0.6;
/** Dragging a log slows the beaver to this share of its speed. Not set by the author yet. */
export const DRAG_SPEED = 0.6;
/** How quickly a dragged log swings in behind the beaver, per second. */
export const DRAG_TURN = 3;

/** Length of the log from a tree that gives this many logs of wood: big trees give longer ones. */
export function logLength(wood: number): number {
  return wood >= 2 ? 6 : 4;
}

/** Where a log's centre rests at a point: on the ground, or on the water where it is deep enough. */
export function rest(terrain: Terrain, x: number, z: number): { y: number; floating: boolean } {
  const ground = terrain.heightAt(x, z);
  const depth = terrain.waterDepth(x, z);
  if (depth >= FLOAT_DEPTH) return { y: ground + depth - LOG_RADIUS * 0.4, floating: true };
  return { y: ground + LOG_RADIUS * 0.8, floating: false };
}

/** A log lying along `heading` with its near end at (x, z), such as a tree that has just fallen. */
export function fallenLog(terrain: Terrain, id: string, x: number, z: number, heading: number, length: number): Log {
  const cx = x + Math.sin(heading) * (length / 2);
  const cz = z + Math.cos(heading) * (length / 2);
  return { id, x: cx, z: cz, heading, length, ...rest(terrain, cx, cz) };
}

/** Distance in metres from a point to the nearest point on the log, along its length. */
export function distanceToLog(log: Log, x: number, z: number): number {
  const dx = Math.sin(log.heading);
  const dz = Math.cos(log.heading);
  const along = Math.max(-log.length / 2, Math.min(log.length / 2, (x - log.x) * dx + (z - log.z) * dz));
  return Math.hypot(x - (log.x + dx * along), z - (log.z + dz * along));
}

/** The log nearest a point within `reach` metres, or null. */
export function nearestLog(logs: readonly Log[], x: number, z: number, reach: number): Log | null {
  let best: Log | null = null;
  let bestDist = reach;
  for (const log of logs) {
    const d = distanceToLog(log, x, z);
    if (d <= bestDist) {
      best = log;
      bestDist = d;
    }
  }
  return best;
}

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * The log as dragged by a beaver at (x, z) facing `heading`: it trails behind with its near end a gap from
 * the beaver's mouth, swinging in line with the beaver as it turns.
 */
export function dragged(terrain: Terrain, log: Log, x: number, z: number, heading: number, dt: number): Log {
  // The log points the way the beaver faces, so its near end is the one in the beaver's mouth.
  const h = log.heading + wrap(heading - log.heading) * Math.min(1, DRAG_TURN * dt);
  const back = DRAG_GAP + log.length / 2;
  const cx = x - Math.sin(h) * back;
  const cz = z - Math.cos(h) * back;
  return { ...log, x: cx, z: cz, heading: h, ...rest(terrain, cx, cz) };
}
