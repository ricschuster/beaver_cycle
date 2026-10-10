// Daily routines of the beavers the player does not steer: the other families (neighbours.ts) and the player's own Mama and
// Papa (family.ts), docs/design/28_living_beavers.md. The day is cut into errand slots of an eighth of a day, five of them in
// daylight. In each slot a beaver runs one errand with a reason, picked by its role, the season, the time of day, and a hash
// of the family, the slot, and its own id: it swims to the shore, gnaws a branch, brings it to the dam, the store or the lodge
// and pats it in; or it eats, grooms, rests, calls the kits, or plays. An errand is a short list of moves and stays, so it has
// a beginning, a middle and an end. Where a beaver is stays a pure function of the clock: an errand starts where the one
// before it ended, and that end is worked out from the slot before alone, so a sleep or a long skip needs no catch-up and
// nothing is saved. Kits often keep by their mama, and two beavers of a family now and then meet at one spot.
// No three.js and no DOM.
import { DAY_FRACTION, DAY_SECONDS, dateAt, type Season } from './clock';
import type { Dam } from './dam';
import type { DamSpot } from './damSpots';
import { STORE_DISTANCE, STORE_RADIUS } from './food';
import { STAGE_RULES, type Stage } from './life';
import { DOOR_DISTANCE, LODGE_RADIUS, SOLID_RADIUS, doorPoint, type Lodge } from './lodge';
import type { NeighbourCarry, NeighbourErrand, NeighbourTask } from './neighbours';
import type { Terrain } from './terrain';

type P = { x: number; z: number };

/** Game seconds of one errand: an eighth of a day, so the five slots of daylight end at dusk. */
export const ERRAND_SECONDS = DAY_SECONDS / 8;
/** An adult swims and walks about its errands at this pace (m/s), a young one at its stage's share. Calmer than the player. */
export const ERRAND_SPEED = 2.5;
/** At least this share of an errand is spent at its work: a long way is swum faster rather than the work cut short. */
const MIN_WORK_SHARE = 0.45;
/** Each beaver sets out up to this many seconds into a slot, so a family does not all start at once. */
const SET_OFF = 6;
/** Water at least this deep is swum, shallower is walked (metres). Between the player's own swim and walk depths. */
export const SWIM_DEPTH = 0.5;
/** A swimmer's feet are this far under the surface, as for the player's beaver. */
const SINK = 0.2;
/** Ground with less water than this is dry (metres). */
export const DRY = 0.02;
/** Shore spots are looked for along this many rays from the lodge, out to this far, in steps of this (metres). */
const RAYS = 24;
export const SHORE_REACH = 36;
const RAY_STEP = 1.5;
/** A shore spot stands this far up the bank from the water's edge (metres), on a bank no higher than this over the water. */
export const SHORE_IN = 0.5;
const MAX_BANK = 1.2;
/** A beaver keeps this far from the middle of a lodge, round the solid dome; patting the lodge it sits at `RIM`. */
export const DOME_CLEAR = SOLID_RADIUS + 0.6;
const RIM = LODGE_RADIUS + 0.5;
/** A dam is worked from the pond side, this far from its middle (metres). */
const DAM_STANDOFF = 1.5;
/** The player's dam counts as the home family's within this many metres of the lodge. */
export const HOME_DAM_REACH = 90;
/** Chance that two beavers of a family meet at one spot in a slot, and the gap between two grown ones when they do (metres). */
const MEET_CHANCE = 0.35;
const MEET_GAP = 0.7;
/** A kit plays in a ring of this radius round its playmate or its mama (metres). */
const PLAY_RADIUS = 1.6;
/** A kit by its parent keeps this far off (one step more for each other kit), and catches up over this share of a slot. */
const FOLLOW_GAP = 1.3;
const CATCH_SHARE = 0.2;
/** Part of a slot's way (seconds) over which a kit grows into and out of its play ring. */
const RING_EASE = 1.5;

export interface RoutineHome {
  lodge: Lodge;
  /** Fixes the family's errands. */
  seed: number;
  /** The deep water round the lodge (`pondParts`); a routine needs at least one. */
  parts: readonly P[];
  /**
   * The dam the family keeps: a point (the player's dam near the home lodge), 'shore' for a family whose dam is not on the
   * map (it mends a stretch of its bank, the same each time), or null for none, which leaves out the 'dam' errand.
   */
  dam: P | 'shore' | null;
}

export interface RoutineMember {
  id: string;
  role: 'mama' | 'papa' | 'kit';
  stage: Stage;
}

/** What a beaver is doing at a clock value, and where. */
export interface Doing {
  x: number;
  /** Height of the feet: on the ground, or a little under the surface while swimming. */
  y: number;
  z: number;
  heading: number;
  /** 0 standing, 1 on the move. */
  pace: number;
  mode: 'walk' | 'swim';
  task: NeighbourTask;
  errand: NeighbourErrand;
  carry: NeighbourCarry;
}

/** A place to be, and the way to it from the deep water: `via` runs from the water to `at`. */
interface Anchor {
  at: P;
  via: readonly P[];
}

type Seg =
  | { kind: 'go'; to: Anchor; carry: NeighbourCarry }
  | { kind: 'stay'; at: Anchor; task: NeighbourTask; carry: NeighbourCarry; face: number | null; weight: number; ring: number | null };

interface Plan {
  errand: NeighbourErrand;
  segs: Seg[];
  /** Where the errand ends, and so where the next one starts. */
  end: Anchor;
  /** Every stop is in water to swim in, so a baby may come along. */
  wet: boolean;
  /** A kit that keeps by a parent instead: the parent's id and the kit's place beside it. */
  follow?: { leader: string; offset: P; baby: boolean };
}

function mix(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

function textSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const headingTo = (a: P, b: P): number => Math.atan2(b.x - a.x, b.z - a.z);
const dist = (a: P, b: P): number => Math.hypot(a.x - b.x, a.z - b.z);
const ease = (t: number): number => t * t * (3 - 2 * t);

function pick<T>(weights: readonly (readonly [T, number])[], r: number): T {
  const total = weights.reduce((s, [, w]) => s + Math.max(0, w), 0);
  let x = r * total;
  for (const [v, w] of weights) {
    if (w <= 0) continue;
    if (x < w) return v;
    x -= w;
  }
  return weights.find(([, w]) => w > 0)?.[0] ?? weights[0]![0];
}

/** A spot on the bank and the water's edge below it, found along one ray from the lodge. */
interface Shore {
  /** On land, `SHORE_IN` up from the edge. */
  land: Anchor;
  /** In the water at the edge, facing the bank. */
  edge: Anchor;
  /** The heading up the bank. */
  up: number;
}

/** What a routine reads from the ground, each thing found once per call. */
function placesOf(home: RoutineHome, ground: Terrain) {
  const { lodge, parts } = home;
  const wetAt = (p: P): boolean => ground.waterDepth(p.x, p.z) >= SWIM_DEPTH;
  const near = [...parts].sort((a, b) => dist(a, lodge) - dist(b, lodge));
  const shores = new Map<number, Shore | null>();

  /**
   * The first bank along ray `i`, reached through water all the way from the lodge, or null where the dome stands on dry land
   * that way or there is no bank in reach. A lodge stands at the water's edge, so the bank is often just behind it.
   */
  const ray = (i: number): Shore | null => {
    const k = ((i % RAYS) + RAYS) % RAYS;
    if (shores.has(k)) return shores.get(k)!;
    const a = (k * 2 * Math.PI) / RAYS;
    const dx = Math.sin(a);
    const dz = Math.cos(a);
    const on = (r: number): P => ({ x: lodge.x + dx * r, z: lodge.z + dz * r });
    const first = on(DOME_CLEAR);
    let found: Shore | null = null;
    let lastWet = -1;
    for (let r = DOME_CLEAR; r <= SHORE_REACH; r += RAY_STEP) {
      const p = on(r);
      if (ground.waterDepth(p.x, p.z) >= DRY) {
        lastWet = r;
        continue;
      }
      if (lastWet < 0) break;
      // The edge lies between the last wet step and this dry one: halve the gap a few times.
      let lo = lastWet;
      let hi = r;
      for (let n = 0; n < 4; n++) {
        const mid = (lo + hi) / 2;
        const q = on(mid);
        if (ground.waterDepth(q.x, q.z) >= DRY) lo = mid;
        else hi = mid;
      }
      const land = on(hi + SHORE_IN);
      const wet = on(Math.max(DOME_CLEAR, lo - 0.5));
      const surface = ground.heightAt(wet.x, wet.z) + ground.waterDepth(wet.x, wet.z);
      if (ground.waterDepth(land.x, land.z) < DRY && ground.heightAt(land.x, land.z) - surface <= MAX_BANK) {
        found = { land: { at: land, via: [first, wet] }, edge: { at: wet, via: [first] }, up: a };
      }
      break;
    }
    shores.set(k, found);
    return found;
  };
  /** The first ray from `start` on that has a bank. */
  const shore = (start: number): Shore | null => {
    for (let n = 0; n < RAYS; n++) {
      const s = ray(start + n);
      if (s) return s;
    }
    return null;
  };
  const part = (r: number): Anchor => ({ at: parts[Math.floor(r * parts.length) % parts.length]!, via: [] });
  /** One of the parts nearest the lodge. */
  const nearPart = (r: number): Anchor => ({ at: near[Math.floor(r * Math.min(4, near.length))]!, via: [] });
  const rim = (r: number): Anchor => {
    const a = lodge.door + (r < 0.5 ? 1 : -1) * (1 + 1.6 * ((r * 2) % 1));
    return { at: { x: lodge.x + Math.sin(a) * RIM, z: lodge.z + Math.cos(a) * RIM }, via: [] };
  };
  const store = doorPoint(lodge, STORE_DISTANCE);
  /** Beside the food store, on its far side from the door. */
  const storeSide = (r: number): Anchor => {
    const out = doorPoint(lodge, STORE_DISTANCE + STORE_RADIUS + 0.5);
    const side = (r - 0.5) * 2;
    return { at: { x: out.x + Math.cos(lodge.door) * side, z: out.z - Math.sin(lodge.door) * side }, via: [] };
  };
  /** In front of the door, a little apart for each beaver. */
  const door = (rank: number): Anchor => {
    const out = doorPoint(lodge, DOOR_DISTANCE + 1 + 0.5 * Math.floor(rank / 3));
    const side = ((rank % 3) - 1) * 1.1;
    return { at: { x: out.x + Math.cos(lodge.door) * side, z: out.z - Math.sin(lodge.door) * side }, via: [] };
  };
  let damSpot: { at: Anchor; face: number } | null | undefined;
  const dam = (): { at: Anchor; face: number } | null => {
    if (damSpot !== undefined) return damSpot;
    if (home.dam === 'shore') {
      const s = shore(mix(home.seed, 77) % RAYS);
      damSpot = s ? { at: s.edge, face: s.up } : null;
    } else if (home.dam) {
      const d = home.dam;
      const away = Math.max(1e-6, dist(d, lodge));
      const at = { x: d.x + ((lodge.x - d.x) / away) * DAM_STANDOFF, z: d.z + ((lodge.z - d.z) / away) * DAM_STANDOFF };
      damSpot = { at: { at, via: [] }, face: headingTo(at, d) };
    } else damSpot = null;
    return damSpot;
  };
  return { lodge, wetAt, ray, shore, part, nearPart, rim, store, storeSide, door, dam };
}

type Places = ReturnType<typeof placesOf>;

const go = (to: Anchor, carry: NeighbourCarry = null): Seg => ({ kind: 'go', to, carry });
const stay = (at: Anchor, task: NeighbourTask, weight: number, carry: NeighbourCarry = null, face: number | null = null, ring: number | null = null): Seg => ({ kind: 'stay', at, task, carry, face, weight, ring });

function planOf(errand: NeighbourErrand, segs: Seg[], places: Places): Plan {
  const anchors = segs.map((s) => (s.kind === 'go' ? s.to : s.at));
  const wet = anchors.every((a) => places.wetAt(a.at) && a.via.every(places.wetAt));
  return { errand, segs, end: anchors[anchors.length - 1]!, wet };
}

const SEASON_INDEX = { spring: 0, summer: 1, autumn: 2, winter: 3 } as const satisfies Record<Season, number>;
/** A weight by season: spring, summer, autumn, winter. */
const bySeason = (season: Season, w: readonly [number, number, number, number]): number => w[SEASON_INDEX[season]];

/** Fetch a branch from the bank (or mud from the bottom) and pat it onto the dam, the lodge, or the store pile. */
function fetchPlan(errand: 'dam' | 'lodge' | 'store', places: Places, r: (salt: string) => number): Plan | null {
  const target = errand === 'dam' ? places.dam() : errand === 'store' ? { at: places.storeSide(r('side')), face: 0 } : null;
  const at = errand === 'lodge' ? places.rim(r('rim')) : target?.at;
  if (!at) return null;
  const face = errand === 'lodge' ? headingTo(at.at, places.lodge) : errand === 'store' ? headingTo(at.at, places.store) : target!.face;
  const bank = places.shore(Math.floor(r('ray') * RAYS));
  if (bank && (errand === 'store' || r('mud') < 0.6)) {
    return planOf(errand, [go(bank.land), stay(bank.land, 'gnaw', 2, null, bank.up), go(at, 'branch'), stay(at, 'build', 1.2, 'branch', face), stay(at, 'rest', 0.5, null, face)], places);
  }
  if (errand === 'store') return null;
  // Mud from the bottom of the pond: a short dive at a deep part, then the load is patted on.
  const deep = places.part(r('deep'));
  return planOf(errand, [go(deep), stay(deep, 'rest', 0.6), go(at, 'mud'), stay(at, 'build', 1.5, 'mud', face), stay(at, 'rest', 0.4, null, face)], places);
}

function foodPlan(season: Season, baby: boolean, places: Places, r: (salt: string) => number): Plan {
  if (season === 'spring' || season === 'summer') {
    const p = places.part(r('lily'));
    return planOf('food', [go(p), stay(p, 'eat', 2, 'lily'), stay(p, r('after') < 0.5 ? 'groom' : 'rest', 0.8)], places);
  }
  const bank = baby ? null : places.shore(Math.floor(r('ray') * RAYS));
  if (bank && r('bark') < 0.5) return planOf('food', [go(bank.land), stay(bank.land, 'gnaw', 1, null, bank.up), stay(bank.land, 'eat', 1.5, 'branch', bank.up), stay(bank.land, 'rest', 0.5, null, bank.up)], places);
  const s = places.storeSide(r('side'));
  const face = headingTo(s.at, places.store);
  return planOf('food', [go(s), stay(s, 'eat', 2, 'branch', face), stay(s, 'rest', 0.6, null, face)], places);
}

function restPlan(baby: boolean, places: Places, r: (salt: string) => number): Plan {
  const bank = baby ? null : places.shore(Math.floor(r('ray') * RAYS));
  if (bank && r('bank') < 0.5) return planOf('rest', [go(bank.land), stay(bank.land, 'groom', 1, null, bank.up + Math.PI), stay(bank.land, 'rest', 2, null, bank.up + Math.PI)], places);
  // By the foot of the lodge, which may be dry, or in the deep water near it; a baby keeps to the water.
  const at = !baby && r('where') < 0.5 ? places.rim(r('rim')) : places.nearPart(r('part'));
  const face = headingTo(places.lodge, at.at);
  return planOf('rest', [go(at), stay(at, 'groom', 1, null, face), stay(at, 'rest', 2, null, face)], places);
}

/** Mama calls the kits to her at a part near the lodge and keeps an eye on them. */
function kitsPlan(places: Places, r: (salt: string) => number): Plan {
  const p = places.nearPart(r('kits'));
  return planOf('kits', [go(p), stay(p, 'rest', 1), stay(p, 'groom', 1), stay(p, 'rest', 1)], places);
}

/** A kit plays round a spot: alone it turns rings, with another kit the two chase each other round. */
function playPlan(errand: NeighbourErrand, centre: Anchor, phase: number, places: Places): Plan {
  return planOf(errand, [go(centre), stay(centre, 'play', 1, null, null, phase)], places);
}

/** Everyone home by the door for the night. */
function nightPlan(rank: number, places: Places): Plan {
  const d = places.door(rank);
  return planOf('rest', [go(d), stay(d, 'rest', 1, null, headingTo(d.at, places.lodge))], places);
}

const isNightSlot = (k: number): boolean => ((((k % 8) + 8) % 8) * ERRAND_SECONDS) / DAY_SECONDS >= DAY_FRACTION;
const isEveningSlot = (k: number): boolean => !isNightSlot(k) && isNightSlot(k + 1);

/** The errands of a family's beavers in slot `k` of the clock, by id. */
function planSlot(home: RoutineHome, members: readonly RoutineMember[], k: number, places: Places): Map<string, Plan> {
  const plans = new Map<string, Plan>();
  if (isNightSlot(k)) {
    members.forEach((m, i) => plans.set(m.id, nightPlan(i, places)));
    return plans;
  }
  const season = dateAt(Math.max(0, k) * ERRAND_SECONDS).season;
  const evening = isEveningSlot(k);
  const rnd = (salt: string): number => mix(mix(home.seed, k), textSeed(salt)) / 4294967296;
  const forMember = (m: RoutineMember) => (salt: string) => rnd(`${m.id}/${salt}`);
  const kits = members.filter((m) => m.role === 'kit');
  const mama = members.find((m) => m.role === 'mama');
  const papa = members.find((m) => m.role === 'papa');
  const hasShore = places.shore(0) !== null;

  // Two of the family meet at one spot now and then.
  if (members.length >= 2 && rnd('meet') < MEET_CHANCE) {
    const i = Math.floor(rnd('meet a') * members.length);
    const j = (i + 1 + Math.floor(rnd('meet b') * (members.length - 1))) % members.length;
    const a = members[i]!;
    const b = members[j]!;
    const spot = evening ? places.nearPart(rnd('meet at')) : places.part(rnd('meet at'));
    if (a.role === 'kit' && b.role === 'kit') {
      plans.set(a.id, playPlan('play', spot, 0, places));
      plans.set(b.id, playPlan('play', spot, Math.PI, places));
    } else if (a.role === 'kit' || b.role === 'kit') {
      const [kit, parent] = a.role === 'kit' ? [a, b] : [b, a];
      plans.set(parent.id, planOf('kits', [go(spot), stay(spot, 'rest', 0.5), stay(spot, 'groom', 1.5)], places));
      plans.set(kit.id, playPlan('kits', spot, rnd('meet ring') * 2 * Math.PI, places));
    } else {
      const axis = rnd('meet axis') * Math.PI;
      const side = (s: number): Anchor => ({ at: { x: spot.at.x + Math.sin(axis) * MEET_GAP * s, z: spot.at.z + Math.cos(axis) * MEET_GAP * s }, via: [spot.at] });
      const sa = side(1);
      const sb = side(-1);
      plans.set(a.id, planOf('rest', [go(sa), stay(sa, 'groom', 1.5, null, headingTo(sa.at, sb.at)), stay(sa, 'rest', 1, null, headingTo(sa.at, sb.at))], places));
      plans.set(b.id, planOf('rest', [go(sb), stay(sb, 'groom', 1.5, null, headingTo(sb.at, sa.at)), stay(sb, 'rest', 1, null, headingTo(sb.at, sa.at))], places));
    }
  }

  const grownUp = (m: RoutineMember, weights: readonly (readonly [NeighbourErrand, number])[]): void => {
    if (plans.has(m.id)) return;
    const r = forMember(m);
    const errand = pick(weights, r('errand'));
    const baby = m.stage === 'baby';
    let plan: Plan | null = null;
    if (errand === 'dam' || errand === 'lodge' || errand === 'store') plan = fetchPlan(errand, places, r);
    else if (errand === 'kits') plan = kitsPlan(places, r);
    else if (errand === 'food') plan = foodPlan(season, baby, places, r);
    plans.set(m.id, plan ?? restPlan(baby, places, r));
  };
  const hasDam = places.dam() !== null;
  if (papa) {
    grownUp(
      papa,
      evening
        ? [['rest', 3], ['food', 1]]
        : [
            ['dam', hasDam ? bySeason(season, [3, 2, 3, 1]) : 0],
            ['lodge', bySeason(season, [2, 1, 2, 1])],
            ['store', hasShore ? bySeason(season, [0, 0, 3, 0.5]) : 0],
            ['food', bySeason(season, [1.5, 2, 1.5, 2])],
            ['rest', bySeason(season, [1, 1.5, 0.5, 2.5])],
          ],
    );
  }
  if (mama) {
    const withKits = kits.length > 0 ? 1 : 0;
    grownUp(
      mama,
      evening
        ? [['rest', 2], ['kits', 2 * withKits], ['food', 1]]
        : [
            ['store', hasShore ? bySeason(season, [0, 0, 3, 0.5]) : 0],
            ['food', bySeason(season, [2, 3, 1.5, 2])],
            ['kits', withKits * bySeason(season, [2, 1.5, 1, 1])],
            ['lodge', bySeason(season, [1.5, 1, 1, 0.5])],
            ['rest', bySeason(season, [1, 1, 1, 2])],
          ],
    );
  }

  // The kits: with mama when she calls them, else by their own choice, which is often to keep by a parent.
  const mamaPlan = mama ? plans.get(mama.id) : undefined;
  const followers = new Map<string, number>();
  const playCentre = places.part(rnd('play'));
  kits.forEach((m, n) => {
    if (plans.has(m.id)) return;
    const r = forMember(m);
    const baby = m.stage === 'baby';
    if (mama && mamaPlan?.errand === 'kits' && (baby || r('join') < 0.5)) {
      plans.set(m.id, playPlan('kits', mamaPlan.end, (n * 2 * Math.PI) / kits.length, places));
      return;
    }
    const choice = pick<'mama' | 'papa' | 'play' | 'food' | 'help' | 'rest'>(
      evening
        ? [['mama', mama && (!baby || mamaPlan?.wet) ? 3 : 0], ['play', 1], ['rest', 1]]
        : [
            ['mama', mama && (!baby || mamaPlan?.wet) ? (baby ? 3 : 1.5) : 0],
            ['papa', papa && !baby ? 1 : 0],
            ['play', 2],
            ['food', baby ? 1 : 1.5],
            ['help', !baby && hasShore ? bySeason(season, [1, 1, 2.5, 1]) : 0],
            ['rest', baby ? 1.5 : 1],
          ],
      r('errand'),
    );
    if (choice === 'mama' || choice === 'papa') {
      const leader = (choice === 'mama' ? mama : papa)!;
      const lead = plans.get(leader.id)!;
      const rank = followers.get(leader.id) ?? 0;
      followers.set(leader.id, rank + 1);
      const a = r('side') * 2 * Math.PI;
      const offset = { x: Math.sin(a) * FOLLOW_GAP * (rank + 1), z: Math.cos(a) * FOLLOW_GAP * (rank + 1) };
      const at = beside(lead.end.at, offset, baby, places);
      plans.set(m.id, { errand: lead.errand, segs: [], end: { at, via: lead.end.via }, wet: lead.wet, follow: { leader: leader.id, offset, baby } });
    } else if (choice === 'play') plans.set(m.id, playPlan('play', playCentre, r('ring') * 2 * Math.PI, places));
    else if (choice === 'food') plans.set(m.id, foodPlan(season, baby, places, r));
    else if (choice === 'help') plans.set(m.id, fetchPlan(season === 'autumn' || season === 'winter' ? 'store' : 'lodge', places, r) ?? restPlan(baby, places, r));
    else plans.set(m.id, restPlan(baby, places, r));
  });
  return plans;
}

/** A kit's place beside its parent: a baby comes in closer rather than climb onto land. */
function beside(at: P, offset: P, baby: boolean, places: Places): P {
  for (const k of baby ? [1, 0.5, 0] : [1]) {
    const p = { x: at.x + offset.x * k, z: at.z + offset.z * k };
    if (k === 0 || places.wetAt(p)) return p;
  }
  return { x: at.x + offset.x, z: at.z + offset.z };
}

/** Where a beaver on its own errand is, `s` seconds into the slot, having started at `start`. */
interface Sample {
  x: number;
  z: number;
  heading: number;
  pace: number;
  task: NeighbourTask;
  carry: NeighbourCarry;
}

/** The way from one anchor to another: back out to the water, across, and in. */
function route(from: Anchor, to: Anchor): P[] {
  let i = 0;
  while (i < from.via.length && i < to.via.length && from.via[i] === to.via[i]) i++;
  const pts = [from.at, ...from.via.slice(i).reverse(), ...to.via.slice(i), to.at];
  return pts.filter((p, n) => n === 0 || dist(p, pts[n - 1]!) > 0.01);
}

function walkPlan(plan: Plan, start: Anchor, s: number, speed: number, setOff: number, lodge: P): Sample {
  type Piece = { seg: Seg; pts: P[]; len: number };
  const pieces: Piece[] = [];
  let cur = start;
  for (const seg of plan.segs) {
    if (seg.kind === 'go') {
      const pts = route(cur, seg.to);
      let len = 0;
      for (let n = 1; n < pts.length; n++) len += dist(pts[n - 1]!, pts[n]!);
      pieces.push({ seg, pts, len });
      cur = seg.to;
    } else pieces.push({ seg, pts: [], len: 0 });
  }
  const goLen = pieces.reduce((t, p) => t + p.len, 0);
  const avail = ERRAND_SECONDS - setOff;
  const goTime = Math.min(goLen / speed, avail * (1 - MIN_WORK_SHARE));
  const v = goTime > 0 ? goLen / goTime : speed;
  const weights = plan.segs.reduce((t, sg) => t + (sg.kind === 'stay' ? sg.weight : 0), 0);
  const stayTime = avail - goTime;
  const firstStep = pieces.find((p) => p.pts.length > 1)?.pts[1];
  let heading = firstStep ? headingTo(start.at, firstStep) : headingTo(lodge, start.at);
  if (s < setOff) return { x: start.at.x, z: start.at.z, heading, pace: 0, task: 'rest', carry: null };
  let t = setOff;
  let last: Sample = { x: start.at.x, z: start.at.z, heading, pace: 0, task: 'rest', carry: null };
  for (const { seg, pts, len } of pieces) {
    if (seg.kind === 'go') {
      const dur = len / v;
      if (len > 0) heading = headingTo(pts[pts.length - 2]!, pts[pts.length - 1]!);
      const end = pts[pts.length - 1]!;
      last = { x: end.x, z: end.z, heading, pace: 0, task: seg.carry ? 'carry' : 'swim', carry: seg.carry };
      if (s < t + dur && len > 0) {
        let d = (s - t) * v;
        for (let n = 1; n < pts.length; n++) {
          const a = pts[n - 1]!;
          const b = pts[n]!;
          const l = dist(a, b);
          if (d <= l || n === pts.length - 1) {
            const f = l > 0 ? Math.min(1, d / l) : 1;
            return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, heading: headingTo(a, b), pace: 1, task: seg.carry ? 'carry' : 'swim', carry: seg.carry };
          }
          d -= l;
        }
      }
      t += dur;
      continue;
    }
    const dur = weights > 0 ? (stayTime * seg.weight) / weights : 0;
    const face = seg.face ?? heading;
    if (seg.ring !== null) {
      const tau = Math.min(Math.max(0, s - t), dur);
      const r = PLAY_RADIUS * ease(Math.max(0, Math.min(1, tau / RING_EASE, (dur - tau) / RING_EASE)));
      const a = seg.ring + (tau * speed) / PLAY_RADIUS;
      last = { x: seg.at.at.x + Math.sin(a) * r, z: seg.at.at.z + Math.cos(a) * r, heading: a + Math.PI / 2, pace: r > 0.2 ? 1 : 0, task: 'play', carry: seg.carry };
    } else last = { x: seg.at.at.x, z: seg.at.at.z, heading: face, pace: 0, task: seg.task, carry: seg.carry };
    if (s < t + dur) return last;
    t += dur;
    heading = last.heading;
  }
  return last;
}

/** A kit that keeps by its parent does what it can of the parent's work: a teenager helps, a baby watches. */
function besideTask(lead: Sample, baby: boolean, onBank: boolean): { task: NeighbourTask; carry: NeighbourCarry } {
  switch (lead.task) {
    case 'eat':
      return { task: 'eat', carry: lead.carry };
    case 'carry':
      return baby ? { task: 'swim', carry: null } : { task: 'carry', carry: lead.carry };
    case 'gnaw':
      // Gnawing is done on the bank; one still in the water waits.
      return baby || !onBank ? { task: 'rest', carry: null } : { task: 'gnaw', carry: null };
    case 'build':
      return baby ? { task: 'rest', carry: null } : { task: 'build', carry: lead.carry };
    case 'groom':
      return { task: 'rest', carry: null };
    default:
      return { task: lead.task, carry: null };
  }
}

function besideErrand(lead: NeighbourErrand, baby: boolean): NeighbourErrand {
  if (lead === 'food') return 'food';
  if (!baby && (lead === 'dam' || lead === 'store' || lead === 'lodge')) return lead;
  return 'kits';
}

/**
 * What each of a family's beavers is doing at a clock value, in the order of `members`: where it is, its task, its errand,
 * and what it carries. The same clock always gives the same answer. At night everyone rests by the door of the lodge (the
 * other families are then inside and not drawn; see `neighboursAt`).
 */
export function routineAt(home: RoutineHome, members: readonly RoutineMember[], clock: number, ground: Terrain): Doing[] {
  if (home.parts.length === 0 || members.length === 0) return [];
  const places = placesOf(home, ground);
  const k = Math.floor(clock / ERRAND_SECONDS);
  const s = clock - k * ERRAND_SECONDS;
  const now = planSlot(home, members, k, places);
  const before = planSlot(home, members, k - 1, places);
  const lodge = home.lodge;
  const samples = new Map<string, Sample>();
  const sampleOf = (m: RoutineMember): Sample => {
    const done = samples.get(m.id);
    if (done) return done;
    const plan = now.get(m.id)!;
    const start = before.get(m.id)!.end;
    const speed = ERRAND_SPEED * STAGE_RULES[m.stage].speed;
    let out: Sample;
    if (plan.follow) {
      const leader = members.find((o) => o.id === plan.follow!.leader)!;
      const lead = sampleOf(leader);
      const target = beside(lead, plan.follow.offset, plan.follow.baby, places);
      const catchUp = CATCH_SHARE * ERRAND_SECONDS;
      if (s < catchUp && dist(start.at, target) > 0.3) {
        const f = ease(s / catchUp);
        out = { x: start.at.x + (target.x - start.at.x) * f, z: start.at.z + (target.z - start.at.z) * f, heading: headingTo(start.at, target), pace: 1, task: 'swim', carry: null };
      } else out = { x: target.x, z: target.z, heading: lead.heading, pace: lead.pace, ...besideTask(lead, plan.follow.baby, ground.waterDepth(target.x, target.z) < DRY) };
    } else out = walkPlan(plan, start, s, speed, (mix(home.seed, textSeed(m.id)) % 1000) / 1000 * SET_OFF, lodge);
    samples.set(m.id, out);
    return out;
  };
  return members.map((m) => {
    const plan = now.get(m.id)!;
    const p = sampleOf(m);
    let { x, z } = p;
    // Never through the solid dome: slide round it.
    const away = dist({ x, z }, lodge);
    if (away < DOME_CLEAR) {
      const dx = away > 1e-6 ? (x - lodge.x) / away : 1;
      const dz = away > 1e-6 ? (z - lodge.z) / away : 0;
      x = lodge.x + dx * DOME_CLEAR;
      z = lodge.z + dz * DOME_CLEAR;
    }
    const depth = ground.waterDepth(x, z);
    const swim = depth >= SWIM_DEPTH;
    const errand = plan.follow ? besideErrand(plan.errand, plan.follow.baby) : plan.errand;
    return { x, y: ground.heightAt(x, z) + (swim ? depth - SINK : 0), z, heading: p.heading, pace: p.pace, mode: swim ? 'swim' : 'walk', task: p.task, errand, carry: p.carry };
  });
}

/** The dam the home family keeps: the one whose pond the lodge stands in, else the nearest within `HOME_DAM_REACH`, or null. */
export function homeDam(lodge: Lodge | null, spots: readonly Pick<DamSpot, 'id' | 'bed'>[], dams: readonly Pick<Dam, 'spot'>[]): P | null {
  if (!lodge) return null;
  const built = spots.filter((s) => dams.some((d) => d.spot === s.id) && dist(s.bed, lodge) <= HOME_DAM_REACH);
  const own = built.find((s) => s.id === lodge.pond);
  const nearest = own ?? built.sort((a, b) => dist(a.bed, lodge) - dist(b.bed, lodge))[0];
  return nearest ? { x: nearest.bed.x, z: nearest.bed.z } : null;
}
