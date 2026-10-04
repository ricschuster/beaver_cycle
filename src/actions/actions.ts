// Action layer: what the player wants, as plain data. Input devices (touch
// now, keyboard later) produce actions; the simulation consumes them. Neither
// side knows about the other.

export interface Actions {
  /** Desired movement on the ground plane, each axis in -1..1. */
  move: { x: number; z: number };
}

export const noActions = (): Actions => ({ move: { x: 0, z: 0 } });

/**
 * Turn a move given in the default view (forward is +z, left is +x) into a
 * ground move for a camera at the given yaw, so a push forward always goes away
 * from the camera. Controls never change meaning with the view (ADR 0005).
 */
export function relativeToView(move: Actions['move'], yaw: number): Actions['move'] {
  const t = yaw - Math.PI;
  const s = Math.sin(t);
  const c = Math.cos(t);
  return { x: move.x * c + move.z * s, z: -move.x * s + move.z * c };
}
