// What the simulation needs to know about trees, for chopping. The terrain layer fills it in
// (src/terrain/); the simulation never sees how trees are placed or drawn (ADR 0007).

/** A tree that can be felled. The id is stable, so a felled tree stays felled when its tile is rebuilt. */
export interface TreeRef {
  id: string;
  x: number;
  z: number;
  /** Wood it gives when felled (Q16: bigger trees give more), which sets how long its log is. */
  wood: number;
}

/** A standing trunk the beaver cannot walk through. */
export interface Trunk {
  x: number;
  z: number;
  radius: number;
}

export interface TreeSource {
  /** The trunks within `reach` metres of a point, ignoring ids in `felled`. */
  trunksNear(x: number, z: number, reach: number, felled: ReadonlySet<string>): readonly Trunk[];
  /** The nearest standing tree within `reach` metres of a point, ignoring ids in `felled`, or null. */
  nearest(x: number, z: number, reach: number, felled: ReadonlySet<string>): TreeRef | null;
}

export const noTrees: TreeSource = { nearest: () => null, trunksNear: () => [] };

/** The widest trunk radius in metres, for looking far enough for trunks. */
export const MAX_TRUNK = 1.5;

/** Half the width of the beaver's body in metres, for bumping into trunks and logs. */
export const BEAVER_RADIUS = 0.5;

/** The point nearest (x, z) that is clear of every trunk, so the beaver slides round a tree instead of through it. */
export function avoidTrunks(x: number, z: number, trunks: readonly Trunk[]): { x: number; z: number } {
  for (const t of trunks) {
    const dx = x - t.x;
    const dz = z - t.z;
    const d = Math.hypot(dx, dz);
    const min = t.radius + BEAVER_RADIUS;
    if (d >= min) continue;
    // exactly on the axis, step out along +z
    if (d < 1e-6) z = t.z + min;
    else {
      x = t.x + (dx / d) * min;
      z = t.z + (dz / d) * min;
    }
  }
  return { x, z };
}

/** How far the beaver reaches to gnaw a tree, in metres from the tree's trunk. */
export const CHOP_REACH = 3;
/** Seconds of standing and gnawing to fell a tree. Not set by the author yet. */
export const CHOP_TIME = 3;
