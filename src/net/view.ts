// What a guest does with the state it gets (ADR 0014, #678): its own copy of the world follows the host's, and the other beavers
// are drawn where the host says they stand. Pure, so a test can check it without a socket.
import type { NeighbourBeaver } from '../sim/neighbours';
import { STAGE_RULES } from '../sim/life';
import type { WorldState } from '../sim/state';
import type { BeaverView, Snapshot } from './protocol';

/** The world a guest shows: the host's clock, felled trees, and logs, and this guest's beaver where the host put it. */
export function applySnapshot(world: WorldState, snap: Snapshot, me: string): WorldState {
  const mine = snap.beavers.find((b) => b.id === me);
  const next: WorldState = { ...world, clock: snap.clock, felled: snap.felled, logs: snap.logs, dams: snap.dams ?? world.dams, lodge: snap.lodge === undefined ? world.lodge : snap.lodge };
  if (!mine) return next;
  return { ...next, beaver: { ...world.beaver, x: mine.x, y: mine.y, z: mine.z, mode: mine.mode, heading: mine.heading } };
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
    carry: null,
    mode: v.mode === 'walk' ? 'walk' : 'swim',
    scale: STAGE_RULES.adult.scale,
    look: { hat: v.look.hat, scarf: v.look.scarf, tail: v.look.tail },
  };
}

/** The other beavers of the valley, for drawing: everyone but this tablet's own beaver. */
export function othersOf(snap: Snapshot | null, me: string): NeighbourBeaver[] {
  return snap ? snap.beavers.filter((b) => b.id !== me).map(friendBeaver) : [];
}
