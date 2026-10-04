// Simulation layer: game state and rules. No DOM, no three.js, no input, so
// another device can later drive or mirror it (ADR 0007).

export interface BeaverState {
  x: number;
  z: number;
  /** Heading in radians, 0 faces +z. */
  heading: number;
}

export interface WorldState {
  /** Simulated seconds since the start. */
  time: number;
  beaver: BeaverState;
}

export const WALK_SPEED = 2;

export function createWorld(): WorldState {
  return { time: 0, beaver: { x: 0, z: 0, heading: 0 } };
}
