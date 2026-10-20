// What a guest does with the state it gets (ADR 0014, #678): its own copy of the world follows the host's, and the other beavers
// are drawn where the host says they stand. Pure, so a test can check it without a socket.
import type { NeighbourBeaver } from '../sim/neighbours';
import { GIVE_REACH } from '../sim/familyMoods';
import { STAGE_RULES } from '../sim/life';
import type { WorldState } from '../sim/state';
import type { BeaverView, Snapshot } from './protocol';

/** The world a guest shows: the host's clock, felled trees, and logs, and this guest's beaver where the host put it. */
export function applySnapshot(world: WorldState, snap: Snapshot, me: string): WorldState {
  const mine = snap.beavers.find((b) => b.id === me);
  const next: WorldState = { ...world, clock: snap.clock, felled: snap.felled, logs: snap.logs, dams: snap.dams ?? world.dams, rocksTaken: snap.rocksTaken ?? world.rocksTaken, dropped: snap.dropped ?? world.dropped, picked: snap.picked ?? world.picked, stripped: snap.stripped ?? world.stripped, lodge: snap.lodge === undefined ? world.lodge : snap.lodge };
  if (!mine) return next;
  return { ...next, beaver: { ...world.beaver, x: mine.x, y: mine.y, z: mine.z, mode: mine.mode, heading: mine.heading }, haul: mine.haul ? { kind: mine.haul } : null, carry: mine.carry ?? null, drag: mine.drag ?? null };
}

/** A beaver of a friend as the renderer draws a beaver of another family. */
export function friendBeaver(v: BeaverView): NeighbourBeaver {
  return {
    id: `friend:${v.id}`,
    name: v.look.name,
    family: `friend:${v.id}`,
    role: 'papa',
    stage: 'adult',
    coat: v.coat,
    x: v.x,
    y: v.y,
    z: v.z,
    heading: v.heading,
    pace: v.pace,
    task: v.chopping ? 'gnaw' : v.mode === 'walk' ? 'rest' : 'swim',
    errand: 'rest',
    carry: v.carry ?? (v.haul === 'mud' ? 'mud' : null),
    mode: v.mode === 'walk' ? 'walk' : 'swim',
    scale: STAGE_RULES.adult.scale,
    look: { hat: v.look.hat, scarf: v.look.scarf, tail: v.look.tail },
  };
}

/** The other beavers of the valley, for drawing: everyone but this tablet's own beaver. */
export function othersOf(snap: Snapshot | null, me: string): NeighbourBeaver[] {
  return snap ? snap.beavers.filter((b) => b.id !== me).map(friendBeaver) : [];
}

/** The nearest of the beavers in a snapshot but this one, within `GIVE_REACH` of (x, z) with an empty mouth: someone food can be handed to. */
export function friendTaker(snap: Snapshot | null, me: string, at: { x: number; z: number }): BeaverView | null {
  let best: BeaverView | null = null;
  let bestD = GIVE_REACH;
  for (const v of snap?.beavers ?? []) {
    const d = Math.hypot(v.x - at.x, v.z - at.z);
    if (v.id !== me && !v.carry && !v.haul && d <= bestD) {
      best = v;
      bestD = d;
    }
  }
  return best;
}
