// What a beaver can tell the player (docs/design/27_families_and_dialog.md, #345): hints that are true now, read from the
// world. What the beavers say to each other is in chatter.ts. Pure, no DOM.
import { dateAt } from './clock';
import { damNeedsRepair } from './dam';
import { stockMeals } from './food';
import { lodgeComplete, lodgeCondition } from './lodge';
import type { WorldState } from './state';
import type { SpeakerKind } from './talk';
import { NO_NEWS, NOT_YET } from './talkLines';
import { t, text } from '../i18n';
import { loneBeaverWay, loneNewsLine, sideWord } from './wayToPartner';
import { needsRepair } from './wear';

/** What the game looks up for the hints: the nearest lily pad, and a predator about. */
export interface Surroundings {
  pad: { x: number; z: number } | null;
  predator: { x: number; z: number; kind: string } | null;
  /** Where the player looks (the heading convention, 0 along +z), for "to your left". The beaver's heading when missing. */
  facing?: number;
}

/** A store with fewer meals than this in autumn or winter is "low". */
export const LOW_STORE_MEALS = 10;

/**
 * The things a beaver may truthfully tell the player now, most useful first: where lily pads are, a predator about, a dam or the
 * lodge that is worn, a store that is low before the cold, and where a lone beaver lives. Nothing is invented, so a line is a hint.
 */
export function newsFor(world: WorldState, around: Surroundings): string[] {
  const b = world.beaver;
  const out: string[] = [];
  const facing = around.facing ?? b.heading;
  if (around.pad) out.push(t('news.pad', { side: sideWord(around.pad.x - b.x, around.pad.z - b.z, facing) }));
  if (around.predator) out.push(t('news.predator', { kind: text(`animal.${around.predator.kind}`), side: sideWord(around.predator.x - b.x, around.predator.z - b.z, facing) }));
  if (world.dams.some((d) => damNeedsRepair(d, world.clock))) out.push(t('news.damWorn'));
  if (lodgeComplete(world.lodge) && needsRepair(lodgeCondition(world.lodge, world.clock))) out.push(t('news.lodgeWorn'));
  const season = dateAt(world.clock).season;
  if (lodgeComplete(world.lodge) && (season === 'autumn' || season === 'winter') && stockMeals(world.store) < LOW_STORE_MEALS) out.push(t('news.storeLow'));
  const lone = loneBeaverWay(world, facing);
  if (lone) out.push(loneNewsLine(lone.words));
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
