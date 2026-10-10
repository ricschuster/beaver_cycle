// Action layer: what the player pressed, as plain data. Input devices (touch
// and keyboard) produce actions; the frame loop turns Do and Take into what they
// mean here (sim/buttons.ts) for the simulation. Neither side knows about the other.

export interface Actions {
  /** Desired movement on the ground plane, each axis in -1..1. */
  move: { x: number; z: number };
  /** Held to go under water, released to come up. False when missing. */
  dive?: boolean;
  /** True on the frame the dive button goes down, not while it is held: at the water hole in the lodge it dives out. False when missing. */
  diveTap?: boolean;
  /** True on the frame the player presses the tail slap button, not while it is held. False when missing. */
  slap?: boolean;
  /** True on the frame the player presses Do, the button for the thing at hand (`sim/buttons.ts` says what that is). False when missing. */
  act?: boolean;
  /** True on the frame the player presses Take: picks up or puts down. False when missing. */
  take?: boolean;
  /** The place of the stash screen the player tapped this frame (0 to 39), or missing. Only used while the stash is open. */
  stashTap?: number;
  /** True on the frame the player closes the stash screen. False when missing. */
  stashClose?: boolean;
}

export const noActions = (): Actions => ({ move: { x: 0, z: 0 }, dive: false, diveTap: false, slap: false, act: false, take: false });

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
  return { move: { x: x * k, z: z * k }, dive: !!(a.dive || b.dive), diveTap: !!(a.diveTap || b.diveTap), slap: !!(a.slap || b.slap), act: !!(a.act || b.act), take: !!(a.take || b.take), stashTap: a.stashTap ?? b.stashTap, stashClose: !!(a.stashClose || b.stashClose) };
}
