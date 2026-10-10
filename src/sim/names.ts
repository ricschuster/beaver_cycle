// Names for the beavers of the other families (docs/design/27_families_and_dialog.md, #343). A name is a pure function of the
// beaver's id, so it is the same every visit and needs no saving. A family is named for where its pond lies from the player's home.
import { compassWord } from './partners';

/** Nature names, mixed so that a family of five is unlikely to repeat one. */
export const NAMES = [
  'Willow', 'Alder', 'Hazel', 'Birch', 'Rowan', 'Aspen', 'Maple', 'Reed', 'Sedge', 'Clover', 'Fern', 'Moss', 'Pebble', 'Brook', 'Ripple',
  'Marsh', 'Sorrel', 'Juniper', 'Linden', 'Poppy', 'Thistle', 'Acorn', 'Bramble', 'Heather', 'Ivy', 'Larch', 'Nettle', 'Olive', 'Pine', 'Quill',
  'Rush', 'Sage', 'Tansy', 'Violet', 'Yarrow', 'Basil', 'Cedar', 'Dill', 'Elder', 'Flint',
] as const;

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

/** The name of a family member from its id. The same id always gives the same name. */
export const nameOf = (id: string): string => NAMES[hashString(id) % NAMES.length]!;

/** "north pond": where a family's pond lies from a point, such as the player's home. */
export function pondName(lodge: { x: number; z: number }, from: { x: number; z: number }): string {
  return `${compassWord(lodge.x - from.x, lodge.z - from.z)} pond`;
}
