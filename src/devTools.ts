// What the release build leaves out (ADR 0013). `__DEV_TOOLS__` is replaced by a constant at build time, so the code behind it
// is removed from the release bundle, not only hidden.

import type { TestMenu } from './ui/testMenu';

/** The URL parameters a player's build still reads: touch controls, no sound, and no film grain. */
export const RELEASE_PARAMS: readonly string[] = ['touch', 'sound', 'grain'];

/** The URL parameters the game reads. A release build ignores all but `RELEASE_PARAMS`, so a link cannot start a dream, jump the clock or switch the life stage. */
export function gameQuery(search: string, devTools: boolean): URLSearchParams {
  const all = new URLSearchParams(search);
  if (devTools) return all;
  const kept = new URLSearchParams();
  for (const key of RELEASE_PARAMS) {
    const value = all.get(key);
    if (value !== null) kept.set(key, value);
  }
  return kept;
}

/** Stands in for the test menu in the release build, so the frame loop keeps its calls. */
export const NO_TEST_MENU: TestMenu = {
  setReadout() {},
  setAchievements() {},
  setSpeed() {},
  setInLodge() {},
  setStatus() {},
  toggle() {},
};
