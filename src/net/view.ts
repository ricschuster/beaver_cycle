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
  const next: WorldState = { ...world, clock: snap.clock, felled: snap.felled, logs: snap.logs, dams: snap.dams ?? world.dams, rocksTaken: snap.rocksTaken ?? world.rocksTaken, dropped: snap.dropped ?? world.dropped, picked: snap.picked ?? world.picked, stripped: snap.stripped ?? world.stripped, lodge: snap.lodge === undefined ? world.lodge : snap.lodge, pairLodges: snap.pairLodges ?? world.pairLodges };
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

/** The nearest beaver of a snapshot but this one, within `GIVE_REACH` of (x, z), that could be asked to be partners, or say yes: grown and with no partner yet. Null when this beaver has a partner. */
export function partnerCandidate(snap: Snapshot | null, me: string, at: { x: number; z: number }): BeaverView | null {
  if (!snap || (snap.pairs ?? []).some((p) => p.includes(me))) return null;
  let best: BeaverView | null = null;
  let bestD = GIVE_REACH;
  for (const v of snap.beavers) {
    const d = Math.hypot(v.x - at.x, v.z - at.z);
    if (v.id !== me && v.grown !== false && !(snap.pairs ?? []).some((p) => p.includes(v.id)) && d <= bestD) {
      best = v;
      bestD = d;
    }
  }
  return best;
}

/** What the pairing in a snapshot says to the beaver `me`: who asked it, whom it asked, and its partner (ids). */
export function pairingOf(snap: Snapshot | null, me: string): { askedBy: string[]; asking: string[]; partner: string | null } {
  const asks = snap?.asks ?? [];
  const pair = (snap?.pairs ?? []).find((p) => p.includes(me));
  return { askedBy: asks.filter(([, to]) => to === me).map(([from]) => from), asking: asks.filter(([from]) => from === me).map(([, to]) => to), partner: pair ? (pair[0] === me ? pair[1] : pair[0]) : null };
}
