// Talk between beavers (docs/design/27_families_and_dialog.md, #344). Who the player can talk to, and what they say. The line
// is a pure function of who speaks, how they feel about the player, the season, the time of day and a seed, so a test can step
// it and a line does not change from frame to frame. English only; the lines are one table so they are easy to edit. No DOM.
import { isNight, type Season } from './clock';
import { atStore } from './food';
import type { Mood } from './moods';
import { spotAt } from './dam';
import type { WorldState } from './state';

/** Who a speaker is: a member of another family by role, the player's own mama or papa, or the partner. */
export type SpeakerKind = 'mama' | 'papa' | 'kit' | 'home-mama' | 'home-papa' | 'partner';

export interface Speaker {
  id: string;
  name: string;
  kind: SpeakerKind;
  /** The family it belongs to, or null for the player's own people. */
  family: string | null;
  x: number;
  z: number;
}

/** The player can talk to a beaver this close (metres). A wary family keeps farther away than this, so it cannot be talked to. */
export const TALK_RANGE = 6;
/** A talk ends when the player walks this far from the speaker (metres). */
export const TALK_END = 12;
/** A line stays on screen this long (seconds of play). */
export const LINE_SECONDS = 7;

/** The nearest speaker within reach of a point, or null. */
export function nearestSpeaker(speakers: readonly Speaker[], at: { x: number; z: number }, reach = TALK_RANGE): Speaker | null {
  let best: Speaker | null = null;
  let bestDist = reach;
  for (const s of speakers) {
    const d = Math.hypot(s.x - at.x, s.z - at.z);
    if (d <= bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

/** What a speaker feels toward the player: the player's own people are always at ease (curious), the others by trust. */
export type Feeling = Mood;

const GREETING: Record<SpeakerKind, Record<Feeling, readonly string[]>> = {
  mama: {
    wary: ['Hmm. Who are you?', 'Stay back, please.'],
    calm: ['Hello, neighbour.', 'Good to see a new face on the pond.'],
    curious: ['You are back! Come and see the kits.', 'Our pond is your pond, friend.'],
  },
  papa: {
    wary: ['Hm.', 'We do not know you yet.'],
    calm: ['Hello there. The pond is calm today.', 'Mind the dam, it needs a log or two.'],
    curious: ['A friend! The water is good here.', 'Come by any time. We keep the dam strong.'],
  },
  kit: {
    wary: ['Eep!', 'Mama says not to talk to you.'],
    calm: ['Hi! I can swim really fast.', 'Do you have a branch?'],
    curious: ['You came back! Watch me dive!', 'Can we play? Please?'],
  },
  'home-mama': {
    wary: [],
    calm: [],
    curious: ['There you are. Have you eaten today?', 'Stay warm, my dear.', 'The lodge is yours to look after now.'],
  },
  'home-papa': {
    wary: [],
    calm: [],
    curious: ['Good work on the lodge. Keep the dam up.', 'A beaver is only as good as its dam.', 'Mind the foxes at night.'],
  },
  partner: {
    wary: [],
    calm: [],
    curious: ['I am glad to be with you.', 'Shall we build something together?', 'The pond is lovely tonight.'],
  },
};

const SEASONAL: Record<Season, readonly string[]> = {
  spring: ['The ice is gone, and the kits are coming.', 'Spring at last. The streams are loud.'],
  summer: ['The lily pads are thick this summer.', 'It is warm. Good weather for felling trees.'],
  autumn: ['Time to fill the store before the snow.', 'Cut your branches now, winter is near.'],
  winter: ['Cold. Stay near the lodge and eat well.', 'The pond is frozen at the edges. Take care.'],
};

const NIGHT = ['It is late. The owls are out.', 'Quiet tonight. Listen to the water.'];

/** A small mixing function, so the same seed gives the same line. */
function mix(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

export interface TalkContext {
  feeling: Feeling;
  season: Season;
  clock: number;
  /** Any number that changes from one talk to the next, such as the count of talks so far. */
  seed: number;
}

/**
 * The line a speaker says. A wary beaver only warns. Otherwise the beaver gives a greeting about the player, or a remark about the
 * season or the night, by the seed. Mood and role fix which lines are possible, so a kit never sounds like a papa.
 */
export function pickLine(speaker: Pick<Speaker, 'id' | 'kind'>, ctx: TalkContext): string {
  const own = GREETING[speaker.kind][ctx.feeling];
  const h = mix(ctx.seed, [...speaker.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7));
  if (ctx.feeling === 'wary') return own[h % own.length]!;
  const pool: string[] = [...own, ...(isNight(ctx.clock) ? NIGHT : SEASONAL[ctx.season])];
  return pool[h % pool.length]!;
}

/** The people of the player's own lodge or a former one, as the family module draws them. */
interface ParentLike {
  id: string;
  x: number;
  z: number;
  inside: boolean;
}

/** The partners the player has met, as the partner module keeps them. */
interface PartnerLike {
  id: string;
  x: number;
  z: number;
  state: 'alone' | 'following' | 'home';
}

/** A neighbour beaver as `neighboursAt` and `reactFamilies` give it. */
interface NeighbourLike {
  id: string;
  name: string;
  family: string;
  role: 'mama' | 'papa' | 'kit';
  x: number;
  z: number;
}

/** Everybody the player could talk to now. Beavers asleep in a lodge are not drawn and are not here. */
export function speakersOf(neighbours: readonly NeighbourLike[], parents: readonly ParentLike[], partners: readonly PartnerLike[], nameOf: (id: string) => string): Speaker[] {
  return [
    ...neighbours.map((n): Speaker => ({ id: n.id, name: n.name, kind: n.role, family: n.family, x: n.x, z: n.z })),
    ...parents.filter((p) => !p.inside).map((p): Speaker => (p.id.startsWith('mama') ? { id: p.id, name: 'Mama', kind: 'home-mama', family: null, x: p.x, z: p.z } : { id: p.id, name: 'Papa', kind: 'home-papa', family: null, x: p.x, z: p.z })),
    ...partners.filter((p) => p.state !== 'alone').map((p): Speaker => ({ id: p.id, name: nameOf(p.id), kind: 'partner', family: null, x: p.x, z: p.z })),
  ];
}

/**
 * True when the Build button has no other job where the player stands, so a press may start a talk: not inside the lodge (the water
 * hole), not with a log or load in hand (it goes on the lodge or dam), not at the food store (the stash), and not at a dam spot.
 */
export function buildIsFree(world: Pick<WorldState, 'inLodge' | 'drag' | 'haul' | 'lodge' | 'spots' | 'beaver' | 'stashOpen'>): boolean {
  const b = world.beaver;
  return !world.inLodge && !world.drag && !world.haul && !world.stashOpen && !atStore(world.lodge, b.x, b.z) && !spotAt(world.spots, b.x, b.z);
}
