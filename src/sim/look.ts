// How a beaver looks, chosen by the player at the start of each life (docs/design/42_multiplayer.md, Q93, Q109). The sim keeps plain
// indices; the renderer's palettes (`beaverModel.ts`) give them colours and shapes, and a test keeps the counts in step.
import { COAT_COUNT, type Coat } from './family';

/** Steps of shade for the fur, -1 darker to 1 lighter. With the five browns that makes 25 furs. */
export const SHADE_STEPS: readonly number[] = [-1, -0.5, 0, 0.5, 1];
/** Hats: none, then four shapes. */
export const HAT_COUNT = 5;
/** Scarves: none, then five colours. */
export const SCARF_COUNT = 6;
/** Tail colours: the natural dark one, then four. */
export const TAIL_COUNT = 5;

/** What the player chooses besides the fur (`WorldState.coat`). 0 is no hat, no scarf, and the natural tail. */
export interface Look {
  hat: number;
  scarf: number;
  tail: number;
  /** What the beaver is called, possibly empty. */
  name: string;
}

export const DEFAULT_LOOK: Look = { hat: 0, scarf: 0, tail: 0, name: '' };

/** The 25 furs: each brown in each shade step. */
export function furChoices(): Coat[] {
  const all: Coat[] = [];
  for (let coat = 0; coat < COAT_COUNT; coat++) for (const shade of SHADE_STEPS) all.push({ coat, shade });
  return all;
}

/** The step of `SHADE_STEPS` nearest a shade, since a kit's inherited shade falls between them. */
export function nearestShade(shade: number): number {
  return SHADE_STEPS.reduce((best, s) => (Math.abs(s - shade) < Math.abs(best - shade) ? s : best), 0);
}

const within = (n: number, count: number): number => (Number.isInteger(n) && n >= 0 && n < count ? n : 0);

/** A look with every choice inside its range, whatever a damaged save or a bad call holds. */
export function cleanLook(look: Partial<Look> | undefined): Look {
  return { hat: within(look?.hat ?? 0, HAT_COUNT), scarf: within(look?.scarf ?? 0, SCARF_COUNT), tail: within(look?.tail ?? 0, TAIL_COUNT), name: typeof look?.name === 'string' ? look.name : '' };
}
