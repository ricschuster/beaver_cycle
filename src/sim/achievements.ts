// Achievements (Q38 to Q40). The wood achievement is the first: fell 30 trees. Plain data, so a save keeps what is won.
import type { WorldState } from './state';

export type AchievementId = 'wood';

/** Trees to fell for the wood achievement (Q39). */
export const WOOD_TREES = 30;

/** The achievements the world has now won that it did not have yet, in the order to show them. */
export function newlyWon(world: Pick<WorldState, 'felled' | 'achievements'>): AchievementId[] {
  return !world.achievements.includes('wood') && world.felled.length >= WOOD_TREES ? ['wood'] : [];
}
