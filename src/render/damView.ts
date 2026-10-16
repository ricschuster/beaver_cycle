// Draws the dams of the sim at their spots: sticks laid across the whole width the water reaches at the dam line, in rows up to
// the crest, with mud mounds along the foot and rocks on top, as many of each as have been placed. A worn dam loses sticks and mounds and shows the gold repair glow (Q55), a broken one
// is mostly gone. The pond is drawn by pondView. Reads state only.
import * as THREE from 'three';
import { costOf, damCondition, damNeedsRepair, type Dam } from '../sim/dam';
import { POND_CELL, crestOf, type Pond } from '../sim/pond';
import type { DamSpot } from '../sim/damSpots';
import { WORN_BELOW, stageOf } from '../sim/wear';
import { createRepairGlow, type RepairGlow } from './repairGlow';
import { BARK, PEELED, lump, mergeParts, paintLump, place, seedOf, seeded, stick, vary } from './propShapes';
import { grainMaterial } from './grain';

export interface DamView {
  /** Draw the dams at their spots at game time `clock`. Rebuilds only when what has been placed or the wear shown changes. */
  update(dams: readonly Dam[], spots: readonly DamSpot[], heightAt: (x: number, z: number) => number, clock?: number, ponds?: readonly Pond[]): void;
}

/** The flooded cells within this many metres of the dam line (either side) decide how wide the wall is. */
const NEAR_LINE = 3 * POND_CELL;

/**
 * Where the dam stands: across the channel the pond is worked out from, not on the drawn stream line (`bed`), which lies up to
 * 8 m off it. The pond starts at the dam line through the channel point, so a dam drawn on the stream line leaves a dry strip of
 * stream between it and the water, or sits inside the pond. On a steep bank the stream line is also above the bed (#315).
 */
export function damAt(spot: DamSpot): { x: number; z: number } {
  return spot.channel ?? spot.bed;
}

/**
 * How far the pond's front reaches along the dam line each way from the bed point (metres), for the part of it under `bedY + top`,
 * or null when the pond has no such cell near the line. Read off the flood fill, so a bump on the line or a bank that lies off the
 * drawn stream line cannot cut the wall short; a cell's half width is added so the wall ends in the bank.
 */
export function wallSpan(pond: Pond, spot: DamSpot, top: number, at: { x: number; z: number } = spot.bed): { left: number; right: number } | null {
  const lateral = { x: -spot.flow.z, z: spot.flow.x };
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < pond.n; j++) {
    for (let i = 0; i < pond.n; i++) {
      if (!pond.flooded[j * pond.n + i] || pond.heights[j * pond.n + i]! >= spot.bedY + top) continue;
      const dx = pond.x0 + i * POND_CELL - at.x;
      const dz = pond.z0 + j * POND_CELL - at.z;
      const up = -(dx * spot.flow.x + dz * spot.flow.z);
      if (up > NEAR_LINE) continue;
      const t = dx * lateral.x + dz * lateral.z;
      min = Math.min(min, t);
      max = Math.max(max, t);
    }
  }
  if (min > max) return null;
  return { left: Math.max(0, -min) + POND_CELL, right: Math.max(0, max) + POND_CELL };
}

/** Share of its pieces a dam of this condition still shows: all while good, down to a third when it is gone. */
export function shownShare(level: number): number {
  return 1 / 3 + (2 / 3) * Math.min(1, level / WORN_BELOW);
}

/** The glow ring is about the size of the spot ring. */
const GLOW_RADIUS = 5.5;

/** A stick is this long (metres) and lies along the dam line. */
const STICK = 2.6;
/** Sticks are laid every SPACING metres along the wall, in rows ROW_HEIGHT apart up to the crest. */
const SPACING = 2;
const ROW_HEIGHT = 0.3;
const MOUND_SPACING = 2.4;
const ROCK_SPACING = 3.2;
/** The wall reaches the bank, at most this far each way from the bed point (metres). */
const MAX_REACH = 40;

const MUD = new THREE.Color(0x5a3f28);
const WET_MUD = new THREE.Color(0x3a2818);
const STONE = new THREE.Color(0x8d8f8c);
const MOSS = new THREE.Color(0x6f7d4a);

/** The pieces of one stick place in the wall, at `at` along it and turned `turn` about the vertical: a thick stick, a thinner one across it, and sometimes one that pokes out of the face. */
function stickBundle(random: () => number, at: THREE.Vector3, turn: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const bark = (): THREE.Color => (random() < 0.35 ? vary(PEELED, random, 0.1) : vary(BARK[Math.floor(random() * BARK.length)]!, random, 0.1));
  parts.push(place(stick(STICK * (0.85 + 0.3 * random()), 0.13 + 0.05 * random(), 6, bark(), random), at, new THREE.Euler(0, turn, (random() - 0.5) * 0.12)));
  const across = (random() < 0.5 ? -1 : 1) * (0.2 + 0.35 * random());
  parts.push(place(stick(1.5 + 0.9 * random(), 0.07 + 0.03 * random(), 5, bark(), random), new THREE.Vector3(at.x + (random() - 0.5), at.y + 0.1, at.z + (random() - 0.5) * 0.3), new THREE.Euler(0, turn + across, (random() - 0.5) * 0.2)));
  if (random() < 0.3) {
    // A stick pushed in across the wall, one end standing out of the face.
    const side = random() < 0.5 ? 0 : Math.PI;
    parts.push(place(stick(1.2 + 0.6 * random(), 0.06 + 0.03 * random(), 5, bark(), random), new THREE.Vector3(at.x + (random() - 0.5), at.y + 0.1, at.z), new THREE.Euler(0, side + Math.PI / 2 + (random() - 0.5) * 0.8, 0.35 + 0.3 * random())));
  }
  return parts;
}

export function createDamView(scene: THREE.Scene, shadows: boolean, prepare: (m: THREE.Material) => void): DamView {
  // Each dam is one mesh: its sticks, mud, and rocks merged, coloured by vertex.
  const material = grainMaterial();
  prepare(material);
  const root = new THREE.Group();
  scene.add(root);
  let shown = '';
  const glows = new Map<string, { glow: RepairGlow; at: { x: number; y: number; z: number } }>();
  return {
    update(dams, spots, heightAt, clock = 0, ponds = []) {
      // The glow pulses every frame, the piles are rebuilt only when what they show changes.
      for (const dam of dams) {
        const level = damCondition(dam, clock);
        const entry = glows.get(dam.spot);
        const spot = spots.find((s) => s.id === dam.spot);
        if (!spot) continue;
        const site = damAt(spot);
        const at = { x: site.x, y: heightAt(site.x, site.z), z: site.z };
        const glow = entry?.glow ?? createRepairGlow(scene, GLOW_RADIUS);
        if (!entry) glows.set(dam.spot, { glow, at });
        glow.set(damNeedsRepair(dam, clock) ? { ...at, broken: stageOf(level) === 'broken' } : null);
      }
      const crests = dams.map((d) => {
        const { wear: _wear, ...fresh } = d;
        return crestOf(fresh);
      });
      const key = dams.map((d, i) => `${d.spot}:${d.wood}:${d.mud}:${d.rock}:${d.level ?? 1}:${crests[i]}:${Math.round(shownShare(damCondition(d, clock)) * 20)}:${ponds.find((p) => p.spot === d.spot)?.area ?? 0}`).join('|');
      if (key === shown) return;
      shown = key;
      for (const o of root.children) if (o instanceof THREE.Mesh) o.geometry.dispose();
      root.clear();
      dams.forEach((dam, di) => {
        const spot = spots.find((s) => s.id === dam.spot);
        if (!spot) return;
        const share = shownShare(damCondition(dam, clock));
        // Pieces are thinned evenly as the dam wears: piece i of a row shows when its fixed pseudo-random draw is under the share.
        const shows = (i: number): boolean => ((i * 37 + 11) % 100) / 100 < share;
        // The dam line runs across the stream; `lateral` points along it.
        const lateral = { x: -spot.flow.z, z: spot.flow.x };
        const site = damAt(spot);
        const base = heightAt(site.x, site.z);
        // How far the water at `top` metres above the bed reaches along the dam line each way from the bed point, so the wall spans the whole pond front: from the pond fill when there is one, else by walking the ground.
        const pond = ponds.find((p) => p.spot === dam.spot);
        const reach = (sign: number, top: number): number => {
          const span = pond ? wallSpan(pond, spot, top, site) : null;
          if (span) return sign < 0 ? span.left : span.right;
          let t = 0;
          while (t < MAX_REACH && heightAt(site.x + lateral.x * sign * (t + 1), site.z + lateral.z * sign * (t + 1)) < spot.bedY + top) t++;
          return t + 1;
        };
        // Every piece has its own seeded draw for its size, turn, and colour, so it looks the same each time the dam is rebuilt.
        const seed = seedOf(dam.spot);
        const randomFor = (kind: number, i: number): (() => number) => seeded(seed + kind * 7919 + i * 104729);
        const parts: THREE.BufferGeometry[] = [];
        const crest = crests[di]!;
        const rows = dam.wood > 0 ? Math.max(1, Math.ceil(crest / ROW_HEIGHT - 1e-9)) : 0;
        let first = { left: 0, right: 0 };
        let last = { left: 0, right: 0 };
        for (let r = 0; r < rows; r++) {
          const h = 0.17 + r * ROW_HEIGHT;
          const top = r === rows - 1 ? Math.max(crest, h + 0.15) : h + 0.15;
          const span = { left: reach(-1, top), right: reach(1, top) };
          if (r === 0) first = span;
          last = span;
          const n = Math.max(1, Math.ceil((span.left + span.right) / SPACING));
          for (let i = 0; i < n; i++) {
            if (!shows(i + r * 13)) continue;
            const at = new THREE.Vector3(-span.left + (i + 0.5) * ((span.left + span.right) / n) + (r % 2) * 0.5, spot.bedY + h - base, ((i * 7) % 3) * 0.08);
            parts.push(...stickBundle(randomFor(1, r * 1000 + i), at, ((i * 5) % 7) * 0.03 - 0.1));
          }
        }
        const mounds = Math.max(1, Math.ceil((first.left + first.right) / MOUND_SPACING));
        const mudShare = Math.min(1, dam.mud / costOf(dam).mud);
        for (let i = 0; i < Math.ceil(mounds * mudShare - 1e-9); i++) {
          if (!shows(i + 5)) continue;
          const random = randomFor(2, i);
          const size = 0.9 + 0.25 * random();
          const mound = paintLump(lump(random, 0.12, 1, -0.6), MUD, random, { color: WET_MUD, share: 0.3 });
          parts.push(place(mound, new THREE.Vector3(-first.left + (i + 0.5) * ((first.left + first.right) / mounds), spot.bedY + 0.4 - base, 0.35), new THREE.Euler(0, random() * Math.PI, 0), new THREE.Vector3(1.05 * size, 0.45 * size, 0.85 * size)));
        }
        const rocks = Math.max(1, Math.ceil((last.left + last.right) / ROCK_SPACING));
        const rockShare = Math.min(1, dam.rock / costOf(dam).rock);
        for (let i = 0; i < Math.ceil(rocks * rockShare - 1e-9); i++) {
          if (!shows(i + 9)) continue;
          const random = randomFor(3, i);
          const size = 0.45 + 0.15 * random();
          const rock = paintLump(lump(random, 0.22), STONE, random, { color: MOSS, share: 0.2 }, true);
          parts.push(place(rock, new THREE.Vector3(-last.left + (i + 0.5) * ((last.left + last.right) / rocks), spot.bedY + Math.max(rows, 1) * ROW_HEIGHT + 0.3 - base, -0.3), new THREE.Euler(0, random() * Math.PI * 2, (random() - 0.5) * 0.4), new THREE.Vector3(size * 1.1, size * 0.8, size)));
        }
        if (parts.length === 0) return;
        const o = new THREE.Mesh(mergeParts(parts), material);
        o.castShadow = shadows;
        o.receiveShadow = shadows;
        o.position.set(site.x, base, site.z);
        o.rotation.y = Math.atan2(-lateral.z, lateral.x);
        root.add(o);
      });
    },
  };
}
