// Simulation layer: game state and rules. No DOM, no three.js, no input, so
// another device can later drive or mirror it (ADR 0007).
import type { Terrain } from './terrain';

export interface BeaverState {
  x: number;
  /** Ground height in metres, set from the terrain each step. */
  y: number;
  z: number;
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

export const WALK_SPEED = 2;

export function createWorld(terrain: Terrain, x = 0, z = 0): WorldState {
  return { time: 0, beaver: { x, y: terrain.heightAt(x, z), z, heading: 0 }, speedMultiplier: 1 };
}

export function setSpeedMultiplier(world: WorldState, speedMultiplier: number): WorldState {
  return { ...world, speedMultiplier };
}

/** Put the beaver on the ground at a point, keeping its heading. */
export function teleport(world: WorldState, terrain: Terrain, x: number, z: number): WorldState {
  return { ...world, beaver: { ...world.beaver, x, y: terrain.heightAt(x, z), z } };
}
