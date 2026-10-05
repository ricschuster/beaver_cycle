// Simulation layer: game state and rules. No DOM, no three.js, no input, so
// another device can later drive or mirror it (ADR 0007).
import { START_CLOCK, nextDawn, isNight } from './clock';
import type { Terrain } from './terrain';

export type BeaverMode = 'walk' | 'swim' | 'dive';

export interface BeaverState {
  x: number;
  /** Height of the feet in metres: the ground when walking, a little below the water surface when swimming, and deeper when diving. */
  y: number;
  z: number;
  mode: BeaverMode;
  /** Heading in radians, 0 faces +z. */
  heading: number;
  /** Breath left, 0 to 1. Drains under water, refills at the surface and on land. */
  breath: number;
}

/** A tail slap other beavers can hear: when and where it happened, in simulated time. */
export interface Slap {
  time: number;
  x: number;
  z: number;
}

export interface WorldState {
  /** Simulated seconds since the start. */
  time: number;
  /** Game clock in seconds from day 0 dawn. Runs at half rate in the lodge, and sleep skips it ahead. */
  clock: number;
  /** True while the beaver is in its lodge. A test toggle until the lodge exists (M5). */
  inLodge: boolean;
  beaver: BeaverState;
  /** The most recent tail slap, or null before the first. */
  lastSlap: Slap | null;
  /** Test setting that scales movement speed (x1, x5, x20, x100). Not a game rule. */
  speedMultiplier: number;
}

// Speeds from docs/design/09_game_length_and_speed.md. Walk and swim were set by the author on desktop (2x the first values), still to tune on a tablet.
export const WALK_SPEED = 12;
export const SWIM_SPEED = 18;
/** Water this deep (metres) starts a swim; it ends below the lower depth, so the shore does not flicker. */
export const SWIM_ENTER_DEPTH = 0.6;
export const SWIM_EXIT_DEPTH = 0.4;
/** How far below the water surface a swimming beaver's feet hang, in metres. */
export const SWIM_SINK = 0.2;
/** Simulated seconds before the beaver can slap its tail again. */
export const SLAP_COOLDOWN = 1;
export const DIVE_SPEED = 14;
/** Metres per second the beaver sinks and rises. Not scaled by the test speed multiplier. */
export const DIVE_RATE = 2;
/** The beaver dives only in water at least this deep (metres), so there is room under it. */
export const DIVE_MIN_DEPTH = 1;
/** Feet height above the lake bed when diving along the bottom, in metres. */
export const DIVE_FLOOR = 0.15;

/** Simulated seconds of breath under water. A short time on purpose (Q24); the real beaver holds 15 minutes. Not set by the author yet. */
export const BREATH_TIME = 60;
/** Seconds to refill from empty at the surface or on land. */
export const BREATH_REFILL_TIME = 8;
/** An empty beaver must recover this much breath before it dives again, so it does not bob at the limit. */
export const BREATH_MIN_START = 0.2;

/**
 * Where the feet are and which mode the beaver is in at a point, given how it was
 * before. Walks on dry ground and in shallows, floats in deep water, and goes
 * down toward the bed while `dive` is held, up to the surface when it is not.
 */
export function settle(
  terrain: Terrain,
  x: number,
  z: number,
  before: { mode: BeaverMode; y: number },
  dive = false,
  dt = 0,
): { y: number; mode: BeaverMode } {
  const ground = terrain.heightAt(x, z);
  const depth = terrain.waterDepth(x, z);
  if (depth < (before.mode === 'walk' ? SWIM_ENTER_DEPTH : SWIM_EXIT_DEPTH)) return { y: ground, mode: 'walk' };
  const surface = ground + depth - SWIM_SINK;
  const floor = ground + DIVE_FLOOR;
  const from = before.mode === 'dive' ? before.y : surface;
  const target = dive && depth >= DIVE_MIN_DEPTH ? floor : surface;
  const reach = DIVE_RATE * dt;
  const y = Math.min(surface, Math.max(floor, from + Math.max(-reach, Math.min(reach, target - from))));
  return { y, mode: y < surface - 1e-6 ? 'dive' : 'swim' };
}

export function createWorld(terrain: Terrain, x = 0, z = 0): WorldState {
  const { y, mode } = settle(terrain, x, z, { mode: 'walk', y: 0 });
  return { time: 0, clock: START_CLOCK, inLodge: false, beaver: { x, y, z, mode, heading: 0, breath: 1 }, lastSlap: null, speedMultiplier: 1 };
}

export function setSpeedMultiplier(world: WorldState, speedMultiplier: number): WorldState {
  return { ...world, speedMultiplier };
}

/** Put the beaver at a point, on the ground or on the water, keeping its heading. */
export function teleport(world: WorldState, terrain: Terrain, x: number, z: number): WorldState {
  return { ...world, beaver: { ...world.beaver, x, z, ...settle(terrain, x, z, { mode: 'walk', y: 0 }) } };
}

/** Test toggle until there is a lodge to enter: the clock runs at half speed while in. */
export function setInLodge(world: WorldState, inLodge: boolean): WorldState {
  return { ...world, inLodge };
}

/** Sleep through the night: in the lodge at night, jump the clock to the next dawn. Otherwise nothing happens. */
export function sleep(world: WorldState): WorldState {
  if (!world.inLodge || !isNight(world.clock)) return world;
  return { ...world, clock: nextDawn(world.clock) };
}
