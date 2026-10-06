// Action layer: what the player wants, as plain data. Input devices (touch
// now, keyboard later) produce actions; the simulation consumes them. Neither
// side knows about the other.

export interface Actions {
  /** Desired movement on the ground plane, each axis in -1..1. */
  move: { x: number; z: number };
  /** Held to go under water, released to come up. False when missing. */
  dive?: boolean;
  /** True on the frame the player presses the tail slap button, not while it is held. False when missing. */
  slap?: boolean;
  /** True on the frame the player presses the gnaw button, not while it is held. False when missing. */
  chop?: boolean;
  /** True on the frame the player presses the drag button: grabs a log in reach, or lets go of the one it drags. False when missing. */
  grab?: boolean;
  /** True on the frame the player presses the build button: places the dragged log at the lodge, or goes into or out of a whole lodge. False when missing. */
  build?: boolean;
}

export const noActions = (): Actions => ({ move: { x: 0, z: 0 }, dive: false, slap: false, chop: false, grab: false, build: false });

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

/** Combine two input devices: moves add up (capped at full speed), buttons are on if either is. */
export function mergeActions(a: Actions, b: Actions): Actions {
  const x = a.move.x + b.move.x;
  const z = a.move.z + b.move.z;
  const len = Math.hypot(x, z);
  const k = len > 1 ? 1 / len : 1;
  return { move: { x: x * k, z: z * k }, dive: !!(a.dive || b.dive), slap: !!(a.slap || b.slap), chop: !!(a.chop || b.chop), grab: !!(a.grab || b.grab), build: !!(a.build || b.build) };
}
