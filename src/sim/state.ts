// Simulation layer: game state and rules. No DOM, no three.js, no input, so
// another device can later drive or mirror it (ADR 0007).
import type { Terrain } from './terrain';

export type BeaverMode = 'walk' | 'swim';

export interface BeaverState {
  x: number;
  /** Height of the feet in metres: the ground when walking, a little below the water surface when swimming. */
  y: number;
  z: number;
  mode: BeaverMode;
  /** Heading in radians, 0 faces +z. */
  heading: number;
}

export interface WorldState {
  /** Simulated seconds since the start. */
  time: number;
  beaver: BeaverState;
  /** Test setting that scales movement speed (x1, x5, x20, x100). Not a game rule. */
  speedMultiplier: number;
}

// Speeds from docs/design/09_game_length_and_speed.md. Starting values to tune on a tablet.
export const WALK_SPEED = 6;
export const SWIM_SPEED = 9;
/** Water this deep (metres) starts a swim; it ends below the lower depth, so the shore does not flicker. */
export const SWIM_ENTER_DEPTH = 0.6;
export const SWIM_EXIT_DEPTH = 0.4;
/** How far below the water surface a swimming beaver's feet hang, in metres. */
export const SWIM_SINK = 0.2;

/** Where the feet are and whether the beaver walks or swims at a point, given how it moved before. */
export function settle(terrain: Terrain, x: number, z: number, before: BeaverMode): { y: number; mode: BeaverMode } {
  const ground = terrain.heightAt(x, z);
  const depth = terrain.waterDepth(x, z);
  const mode = depth >= (before === 'swim' ? SWIM_EXIT_DEPTH : SWIM_ENTER_DEPTH) ? 'swim' : 'walk';
  return { y: mode === 'swim' ? ground + depth - SWIM_SINK : ground, mode };
}

export function createWorld(terrain: Terrain, x = 0, z = 0): WorldState {
  const { y, mode } = settle(terrain, x, z, 'walk');
  return { time: 0, beaver: { x, y, z, mode, heading: 0 }, speedMultiplier: 1 };
}

export function setSpeedMultiplier(world: WorldState, speedMultiplier: number): WorldState {
  return { ...world, speedMultiplier };
}

/** Put the beaver at a point, on the ground or on the water, keeping its heading. */
export function teleport(world: WorldState, terrain: Terrain, x: number, z: number): WorldState {
  return { ...world, beaver: { ...world.beaver, x, z, ...settle(terrain, x, z, 'walk') } };
}
