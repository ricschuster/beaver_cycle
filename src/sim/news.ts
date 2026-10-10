// What a beaver can tell the player (docs/design/27_families_and_dialog.md, #345): hints that are true now, read from the
// world. What the beavers say to each other is in chatter.ts. Pure, no DOM.
import { dateAt } from './clock';
import { damNeedsRepair } from './dam';
import { stockMeals } from './food';
import { lodgeComplete, lodgeCondition } from './lodge';
import { compassWord, partnerCue } from './partners';
import type { WorldState } from './state';
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

/** The answer to "Any news?": a hint by the seed, or a polite nothing. Only a beaver that trusts the player (curious) tells. */
export function answerNews(world: WorldState, around: Surroundings, trusting: boolean, seed: number): string {
  if (!trusting) return 'I have nothing to tell yet. Come by again when we know each other better.';
  const news = newsFor(world, around);
  return news.length === 0 ? 'Nothing new on the pond today.' : news[seed % news.length]!;
}
