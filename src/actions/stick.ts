import type { Actions } from './actions';

/** Sizes of the touch controls in CSS pixels. Kept in one place so they are easy to tune on the tablet. */
export const touchTuning = {
  /** How far the knob can travel from the stick centre; a push this far is full speed. */
  stickRadius: 70,
  /** Fraction of the radius below which a push counts as nothing. */
  deadZone: 0.15,
  /** Diameter of the dive and slap buttons. */
  buttonSize: 88,
};

/**
 * Turn a knob offset in screen pixels (x right, y down) into a move in the
 * default view, where forward is +z and left is +x. Inside the dead zone it is
 * zero; outside, the push is rescaled so speed grows smoothly from zero.
 */
export function stickMove(dx: number, dy: number, radius = touchTuning.stickRadius, deadZone = touchTuning.deadZone): Actions['move'] {
  const len = Math.hypot(dx, dy);
  const frac = Math.min(1, len / radius);
  if (frac <= deadZone || len === 0) return { x: 0, z: 0 };
  const mag = (frac - deadZone) / (1 - deadZone);
  return { x: (-dx / len) * mag, z: (-dy / len) * mag };
}
