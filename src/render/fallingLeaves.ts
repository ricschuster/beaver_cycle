// Leaves that drift down from broadleaf trees near the player in autumn. Pure state and numbers, so it is
// testable without three.js: the renderer reads `leaves` and draws them.
import { BROADLEAF_SHAPE } from '../terrain/trees';

export const MAX_LEAVES = 140;
/** Metres per second a leaf sinks, lowest and highest. */
const FALL_MIN = 0.6;
const FALL_MAX = 1.1;
/** Longest wait before a free leaf takes off, so they do not all fall in step. */
const MAX_DELAY = 5;

export interface Leaf {
  x: number;
  y: number;
  z: number;
  /** Height of the ground below where the leaf started. */
  ground: number;
  alive: boolean;
  /** Seconds until a free leaf may take off. */
  delay: number;
  fall: number;
  phase: number;
  spin: number;
}

export class LeafFall {
  readonly leaves: Leaf[] = [];
  private time = 0;

  /** `random` returns [0, 1). Pass a seeded one for repeatable tests. */
  constructor(private readonly random: () => number = Math.random) {
    for (let i = 0; i < MAX_LEAVES; i++) {
      this.leaves.push({ x: 0, y: 0, z: 0, ground: 0, alive: false, delay: this.random() * MAX_DELAY, fall: 0, phase: 0, spin: 0 });
    }
  }

  /**
   * Moves the leaves on by `dt` seconds. `amount` (0 to 1) says how many may be in the air, `trees` is a
   * flat list of x, y, z, scale of the broadleaf trees around the player. Leaves already falling finish
   * their fall when `amount` drops; none start without trees.
   */
  update(dt: number, amount: number, trees: readonly number[]): void {
    this.time += dt;
    const allowed = Math.round(MAX_LEAVES * Math.min(1, Math.max(0, amount)));
    const treeCount = Math.floor(trees.length / 4);
    for (let i = 0; i < this.leaves.length; i++) {
      const leaf = this.leaves[i]!;
      if (leaf.alive) {
        const t = this.time * 0.9 + leaf.phase;
        leaf.y -= leaf.fall * dt;
        leaf.x += (Math.sin(t) * 0.7 + 0.35) * dt;
        leaf.z += Math.cos(t * 0.8) * 0.5 * dt;
        if (leaf.y <= leaf.ground) leaf.alive = false;
      } else if (i < allowed && treeCount > 0) {
        leaf.delay -= dt;
        if (leaf.delay > 0) continue;
        const o = Math.floor(this.random() * treeCount) * 4;
        const s = trees[o + 3]!;
        const crown = BROADLEAF_SHAPE[0]!;
        const angle = this.random() * Math.PI * 2;
        const reach = Math.sqrt(this.random()) * crown.radius * s * 0.8;
        leaf.x = trees[o]! + Math.cos(angle) * reach;
        leaf.z = trees[o + 2]! + Math.sin(angle) * reach;
        leaf.ground = trees[o + 1]!;
        leaf.y = leaf.ground + (crown.centre + (this.random() - 0.3) * crown.radius * 0.7) * s;
        leaf.fall = FALL_MIN + this.random() * (FALL_MAX - FALL_MIN);
        leaf.phase = this.random() * Math.PI * 2;
        leaf.spin = (this.random() - 0.5) * 6;
        leaf.alive = true;
        leaf.delay = this.random() * MAX_DELAY;
      }
    }
  }

  /** How many leaves are in the air. */
  count(): number {
    return this.leaves.filter((l) => l.alive).length;
  }
}
