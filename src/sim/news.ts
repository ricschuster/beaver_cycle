// What a beaver can tell the player (docs/design/27_families_and_dialog.md, #345): hints that are true now, read from the
// world, and the calls the members of a family make to each other that the player can overhear. Pure, no DOM.
import { dateAt, DAY_SECONDS } from './clock';
import { damNeedsRepair } from './dam';
import { stockMeals } from './food';
import { lodgeComplete, lodgeCondition } from './lodge';
import { compassWord, partnerCue } from './partners';
import type { WorldState } from './state';
import type { SpeakerKind } from './talk';
import { NO_NEWS, NOT_YET } from './talkLines';
import { needsRepair } from './wear';

/** What the game looks up for the hints: the nearest lily pad, and a predator about. */
export interface Surroundings {
  pad: { x: number; z: number } | null;
  predator: { x: number; z: number; kind: string } | null;
}

/** A store with fewer meals than this in autumn or winter is "low". */
export const LOW_STORE_MEALS = 10;

const rounded = (m: number, to: number): number => Math.max(to, Math.round(m / to) * to);

/**
 * The things a beaver may truthfully tell the player now, most useful first: where lily pads are, a predator about, a dam or the
 * lodge that is worn, a store that is low before the cold, and where a lone beaver lives. Nothing is invented, so a line is a hint.
 */
export function newsFor(world: WorldState, around: Surroundings): string[] {
  const b = world.beaver;
  const out: string[] = [];
  if (around.pad) {
    const dx = around.pad.x - b.x;
    const dz = around.pad.z - b.z;
    out.push(`Lily pads grow to the ${compassWord(dx, dz)}, about ${rounded(Math.hypot(dx, dz), 10)} m from here.`);
  }
  if (around.predator) out.push(`I smelled a ${around.predator.kind} to the ${compassWord(around.predator.x - b.x, around.predator.z - b.z)}. Keep your tail ready.`);
  if (world.dams.some((d) => damNeedsRepair(d, world.clock))) out.push('One of your dams is wearing thin. A log and some mud will mend it.');
  if (lodgeComplete(world.lodge) && needsRepair(lodgeCondition(world.lodge, world.clock))) out.push('Your lodge is wearing thin. Mend it before the cold.');
  const season = dateAt(world.clock).season;
  if (lodgeComplete(world.lodge) && (season === 'autumn' || season === 'winter') && stockMeals(world.store) < LOW_STORE_MEALS) out.push('Your food store is running low. Fill it with branches before the snow.');
  const cue = partnerCue(world.partners, b);
  if (cue) out.push(`A lone beaver lives to the ${cue.direction}, about ${cue.metres} m away.`);
  return out;
}

/**
 * The answer to "Any news?": a hint by the seed, or a polite nothing in the speaker's voice. Only a beaver that trusts the player
 * (curious) tells. With two or more hints, the one in `avoid` (said last time) is not given again at once.
 */
export function answerNews(world: WorldState, around: Surroundings, trusting: boolean, seed: number, avoid = '', kind: SpeakerKind = 'mama'): string {
  if (!trusting) return NOT_YET[kind];
  const news = newsFor(world, around);
  if (news.length === 0) return NO_NEWS[kind];
  const i = seed % news.length;
  return news.length > 1 && news[i] === avoid ? news[(i + 1) % news.length]! : news[i]!;
}

/** Two members of a family and what the first calls out. */
export interface Overheard {
  who: string;
  text: string;
}

const CALLS: readonly ((to: string) => string)[] = [
  (to) => `${to}, come back to the lodge!`,
  (to) => `${to}, do not swim so far!`,
  (to) => `Look, ${to}! A fish!`,
  (to) => `${to}, race you to the dam!`,
  (to) => `${to}, have you eaten?`,
];

/** A call is made in a slot of this many clock seconds, and only in some slots. */
export const CALL_SLOT = DAY_SECONDS / 12;
const CALL_ONE_IN = 2;

function mix(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

/**
 * What a family near the player calls out in this slot of the clock: one beaver of the family, within `hearing` metres, calls to
 * another by name. The same slot gives the same call, and the caller asks once per slot, so a call is heard once. Null when
 * nobody calls, or fewer than two of a family are near.
 */
export function overheard(beavers: readonly { id: string; name: string; family: string; x: number; z: number }[], at: { x: number; z: number }, clock: number, hearing = 30): Overheard | null {
  const slot = Math.floor(clock / CALL_SLOT);
  const near = beavers.filter((n) => Math.hypot(n.x - at.x, n.z - at.z) <= hearing);
  const families = [...new Set(near.map((n) => n.family))].sort();
  for (const f of families) {
    const members = near.filter((n) => n.family === f).sort((a, c) => a.id.localeCompare(c.id));
    if (members.length < 2) continue;
    const h = mix(slot, [...f].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 3));
    if (h % CALL_ONE_IN !== 0) continue;
    const from = members[h % members.length]!;
    const to = members[(h >>> 3) % members.length]!;
    if (from.id === to.id) continue;
    return { who: from.name, text: CALLS[(h >>> 6) % CALLS.length]!(to.name) };
  }
  return null;
}
