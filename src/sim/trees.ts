// What the simulation needs to know about trees, for chopping. The terrain layer fills it in
// (src/terrain/); the simulation never sees how trees are placed or drawn (ADR 0007).

/** A tree that can be felled. The id is stable, so a felled tree stays felled when its tile is rebuilt. */
export interface TreeRef {
  id: string;
  x: number;
  z: number;
  /** Logs it gives when felled (Q16: bigger trees give more). */
  wood: number;
}

export interface TreeSource {
  /** The nearest standing tree within `reach` metres of a point, ignoring ids in `felled`, or null. */
  nearest(x: number, z: number, reach: number, felled: ReadonlySet<string>): TreeRef | null;
}

export const noTrees: TreeSource = { nearest: () => null };

/** How far the beaver reaches to gnaw a tree, in metres from the tree's trunk. */
export const CHOP_REACH = 3;
/** Seconds of standing and gnawing to fell a tree. Not set by the author yet. */
export const CHOP_TIME = 3;
/** Logs the beaver carries at most. Not set by the author yet. */
export const CARRY_MAX = 4;
