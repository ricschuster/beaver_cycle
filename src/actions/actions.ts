// Action layer: what the player wants, as plain data. Input devices (touch
// now, keyboard later) produce actions; the simulation consumes them. Neither
// side knows about the other.

export interface Actions {
  /** Desired movement on the ground plane, each axis in -1..1. */
  move: { x: number; z: number };
}

export const noActions = (): Actions => ({ move: { x: 0, z: 0 } });
