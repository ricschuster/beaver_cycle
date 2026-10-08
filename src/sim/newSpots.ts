// New dam spots from a pond (docs/design/20_dams_and_ponds.md, "Spots that come later"): a built dam makes a pond, and the stream
// lines round its edge, and the ones that run into it, are scanned again for places a dam would hold a pond. A port of
// tools/dam-sites/scan_dam_sites.py (`scan_point`, `evaluate`) over the stream lines of the Terrain, which the tile build has
// already snapped to the channel (ADR 0010). The pond fill is `floodPond` itself, so a new spot floods in the game as it was judged.
// No three.js and no DOM here.

import { LEVEL_CREST, type DamSpot } from './damSpots';
import { POND_CELL, floodPond, type Pond } from './pond';
import type { StreamPoint, Terrain } from './terrain';

/** Metres between the stream points tested, and between kept spots (the scan's STEP and SPACING). */
const STEP = 15;
export const NEW_SPACING_M = 45;
/** The search for the channel bed around a line point, the longest dam, and the smallest pond worth a spot (the scan's SNAP, MAX_DAM, MIN_POND). */
const SNAP = 6;
const MAX_DAM = 40;
const MIN_POND = 200;
/** The line gate, as in the scan: the pond lies on the drawn stream. */
const LINE_NEAR = 5;
const MIN_NEAR_SHARE = 0.3;
const MIN_LINE_IN_POND = 0.5;
const LINE_REACH = 60;
/** A stream point is searched this far from the pond's flooded ground: the edge, and the streams that run into it. */
const EDGE_REACH = 40;
/** The ground must fall this much over 60 m along the line to be a stream and not a flat or a bog. */
const MIN_FALL = 0.2;

const inPond = (p: Pond, x: number, z: number): boolean => {
  const i = Math.round((x - p.x0) / POND_CELL);
  const j = Math.round((z - p.z0) / POND_CELL);
  return i >= 0 && j >= 0 && i < p.n && j < p.n && p.flooded[j * p.n + i] === 1;
};

/** Metres from a point to the nearest flooded cell of the pond, Infinity for an empty one. */
function edgeDistance(p: Pond, x: number, z: number): number {
  let best = Infinity;
  for (let j = 0; j < p.n; j++) for (let i = 0; i < p.n; i++) if (p.flooded[j * p.n + i]) best = Math.min(best, Math.hypot(p.x0 + i * POND_CELL - x, p.z0 + j * POND_CELL - z));
  return best;
}

/** The dam length across the stream at a crest, or null when the valley is wider than MAX_DAM (the scan's `reach`). */
function damWidth(terrain: Terrain, bed: { x: number; z: number }, flow: { x: number; z: number }, level: number): number | null {
  const reach = (sign: number): number | null => {
    for (let s = POND_CELL; s < MAX_DAM; s += POND_CELL / 2) {
      if (terrain.heightAt(bed.x - sign * flow.z * s, bed.z + sign * flow.x * s) >= level) return s;
    }
    return null;
  };
  const left = reach(1);
  const right = reach(-1);
  return left === null || right === null || left + right > MAX_DAM ? null : left + right;
}

/** Whether a pond lies on the drawn stream: enough of its cells near a line, and enough of the line upstream of the dam inside it. */
function onTheLine(terrain: Terrain, pond: Pond, dam: { x: number; z: number }, flow: { x: number; z: number }): boolean {
  if (!terrain.streamDistance || !terrain.streamPoints) return true;
  let cells = 0;
  let near = 0;
  for (let j = 0; j < pond.n; j++) {
    for (let i = 0; i < pond.n; i++) {
      if (!pond.flooded[j * pond.n + i]) continue;
      cells++;
      if (terrain.streamDistance(pond.x0 + i * POND_CELL, pond.z0 + j * POND_CELL) < LINE_NEAR) near++;
    }
  }
  if (cells === 0 || near / cells < MIN_NEAR_SHARE) return false;
  const up = terrain.streamPoints(dam.x, dam.z, LINE_REACH, 1).filter((p) => -((p.x - dam.x) * flow.x + (p.z - dam.z) * flow.z) > 2);
  return up.length === 0 || up.filter((p) => inPond(pond, p.x, p.z)).length / up.length >= MIN_LINE_IN_POND;
}

/** The best dam at one stream point: the spot with its widths, or null when no crest holds a pond on the stream. */
function spotAtPoint(terrain: Terrain, p: StreamPoint, near: string): DamSpot | null {
  // Snap to the lowest ground within SNAP metres, the channel bed.
  let bed = { x: p.x, z: p.z };
  let bedY = Infinity;
  for (let dz = -SNAP; dz <= SNAP; dz += POND_CELL) {
    for (let dx = -SNAP; dx <= SNAP; dx += POND_CELL) {
      const h = terrain.heightAt(p.x + dx, p.z + dz);
      if (h < bedY) {
        bedY = h;
        bed = { x: p.x + dx, z: p.z + dz };
      }
    }
  }
  if (terrain.waterDepth(bed.x, bed.z) > 0) return null;
  // Downstream is where the ground falls along the line.
  const ahead = terrain.heightAt(bed.x + p.ux * 30, bed.z + p.uz * 30);
  const behind = terrain.heightAt(bed.x - p.ux * 30, bed.z - p.uz * 30);
  if (Math.abs(ahead - behind) < MIN_FALL) return null;
  const flow = ahead < behind ? { x: p.ux, z: p.uz } : { x: -p.ux, z: -p.uz };
  const draft: DamSpot = {
    id: `${near}:${Math.round(p.x)}:${Math.round(p.z)}`,
    bed: { x: p.x, z: p.z },
    channel: bed,
    bedY,
    flow,
    maxCrest: LEVEL_CREST[LEVEL_CREST.length - 1]!,
    pondM2: 0,
    rough: true,
  };
  return holdOf(terrain, draft);
}

/** The spot with the crests it holds worked out on the ground as it is now: null when not even level 1 holds a pond on the stream. */
function holdOf(terrain: Terrain, draft: DamSpot): DamSpot | null {
  const bed = draft.channel ?? draft.bed;
  const widths: (number | null)[] = [];
  let best: { crest: number; area: number } | null = null;
  let first = false;
  for (const [i, crest] of LEVEL_CREST.entries()) {
    const w = damWidth(terrain, bed, draft.flow, draft.bedY + crest);
    const pond = w === null ? null : floodPond(terrain, { ...draft, maxCrest: LEVEL_CREST[LEVEL_CREST.length - 1]! }, crest);
    const ok = pond !== null && pond.area >= MIN_POND && onTheLine(terrain, pond, bed, draft.flow);
    widths.push(ok ? Math.round(w! * 10) / 10 : null);
    if (ok && i === 0) first = true;
    if (ok && (best === null || pond!.area > best.area)) best = { crest, area: pond!.area };
  }
  if (!best || !first) return null; // the first dam must hold a pond on the stream too
  return { ...draft, maxCrest: best.crest, pondM2: Math.round(best.area), widths };
}

/** A rough spot is worked out again when the beaver is this close, metres: the ground there is the fine detail by then. */
export const REFINE_RANGE_M = 100;

/**
 * The spots of a list with the rough ones near a point worked out again. A new spot is found while the beaver may be far
 * away, on the coarse ground, which can promise a bigger dam than the fine ground holds. A spot with a dam started keeps what
 * it has (its price is fixed), and one that no longer holds a pond keeps its old figures. Either way it is no longer rough.
 * The list itself when nothing changed.
 */
export function refineNear(spots: DamSpot[], x: number, z: number, terrain: Terrain, dams: readonly { spot: string }[]): DamSpot[] {
  if (!spots.some((s) => s.rough && Math.hypot(s.bed.x - x, s.bed.z - z) <= REFINE_RANGE_M)) return spots;
  const settled = (s: DamSpot): DamSpot => {
    const { rough: _rough, ...rest } = s;
    return rest;
  };
  return spots.map((s) => {
    if (!s.rough || Math.hypot(s.bed.x - x, s.bed.z - z) > REFINE_RANGE_M) return s;
    return dams.some((d) => d.spot === s.id) ? settled(s) : settled(holdOf(terrain, s) ?? s);
  });
}

/**
 * The new spots a pond makes possible: dam spots on the stream lines round its edge and the lines running into it, each at
 * least NEW_SPACING_M from a spot already known and from each other, the biggest pond first. Needs a ground with stream
 * lines (`Terrain.streamPoints`), and gives none without. `known` are the spots already there, which are never returned again.
 */
export function newSpotsFrom(terrain: Terrain, pond: Pond, known: readonly DamSpot[]): DamSpot[] {
  if (!terrain.streamPoints) return [];
  const parent = known.find((s) => s.id === pond.spot);
  if (!parent) return [];
  const near = parent.id.split(':')[0]!;
  const cx = pond.x0 + (pond.n / 2) * POND_CELL;
  const cz = pond.z0 + (pond.n / 2) * POND_CELL;
  const taken = [...known];
  const found: DamSpot[] = [];
  const points = terrain
    .streamPoints(cx, cz, (pond.n / 2) * POND_CELL + EDGE_REACH, STEP)
    .filter((p) => !inPond(pond, p.x, p.z) && edgeDistance(pond, p.x, p.z) <= EDGE_REACH && known.every((s) => Math.hypot(s.bed.x - p.x, s.bed.z - p.z) >= NEW_SPACING_M));
  const spots = points.flatMap((p) => spotAtPoint(terrain, p, near) ?? []);
  for (const s of spots.sort((a, b) => b.pondM2 - a.pondM2)) {
    if (taken.some((o) => Math.hypot(o.bed.x - s.bed.x, o.bed.z - s.bed.z) < NEW_SPACING_M)) continue;
    taken.push(s);
    found.push(s);
  }
  return found;
}

/** The spots with the ones new ponds make possible added; the list itself when there are none. */
export function withNewSpots(spots: DamSpot[], ponds: readonly Pond[], terrain: Terrain): DamSpot[] {
  let all = spots;
  for (const pond of ponds) {
    const more = newSpotsFrom(terrain, pond, all);
    if (more.length > 0) all = [...all, ...more];
  }
  return all;
}
