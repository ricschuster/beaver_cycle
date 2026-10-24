// Talk between beavers (docs/design/27_families_and_dialog.md, #344). Who the player can talk to, and what they say. Each line is
// a pure function of who speaks, what the world holds, how the beaver feels about the player, what it remembers of earlier
// talks, and a seed, so a test can step it and a line does not change from frame to frame. The lines are in `talkLines.ts`.
// The words come from the language tables (`talkLines.ts`). No DOM.
import { t } from '../i18n';
import { dateAt, isNight, DAY_SECONDS, DAYS_PER_SEASON, type Season } from './clock';
import { stockMeals, stockTotal, storeCapacity, storeCondition } from './food';
import { FAMILY_START_TRUST, familyMood, familyTrust } from './familyMoods';
import type { Mood } from './moods';
import { damNeedsRepair, } from './dam';
import { stageAt, type Stage } from './life';
import { lodgeComplete, lodgeCondition } from './lodge';
import { LOW_STORE_MEALS } from './news';
import { follower, mateOf } from './partners';
import type { WorldState } from './state';
import { needsRepair } from './wear';
import {
  AGAIN, DOING, FAREWELL, FIRST_MEETING, HELP, HELP_WARY, HOME_DOING, HOME_ERRANDS, HOME_HELP, KIN_RESCUE, LIFE, LONG_AWAY_LINES, REMARK, RESCUED, ROLE_WORD, SEASONAL, SINCE, STORE_WHY,
  TASK_DOING, THANKS, night, withSince, withWho, type HomeJob, type LifeFact,
} from './talkLines';

/** Who a speaker is: a member of another family by role, the player's own mama or papa, or the partner. */
export type SpeakerKind = 'mama' | 'papa' | 'kit' | 'home-mama' | 'home-papa' | 'partner';
/** A member of another family. */
export type NeighbourKind = 'mama' | 'papa' | 'kit';
type HomeKind = 'home-mama' | 'home-papa' | 'partner';

/** What a beaver is doing now, and why (its errand), as the family module gives them. Both may be missing. */
export type Task = 'swim' | 'rest' | 'eat' | 'gnaw' | 'carry' | 'build' | 'groom' | 'play';
export type Errand = 'dam' | 'store' | 'lodge' | 'food' | 'kits' | 'play' | 'rest';
/** What a beaver carries in its mouth. */
export type Carry = 'branch' | 'lily' | 'mud';

const TASKS: readonly Task[] = ['swim', 'rest', 'eat', 'gnaw', 'carry', 'build', 'groom', 'play'];
const ERRANDS: readonly Errand[] = ['dam', 'store', 'lodge', 'food', 'kits', 'play', 'rest'];
const CARRIES: readonly Carry[] = ['branch', 'lily', 'mud'];

export interface Speaker {
  id: string;
  name: string;
  kind: SpeakerKind;
  /** The family it belongs to, or null for the player's own people. */
  family: string | null;
  x: number;
  z: number;
  /** Where its pond lies from the player's home, such as "north pond", when known. */
  place?: string;
  /** What it is doing, and why. Missing when the family module does not say; the lines then fall back to swimming. */
  task?: Task;
  errand?: Errand;
  carry?: Carry | null;
}

/** The player can talk to a beaver this close (metres). A wary family keeps farther away than this, so it cannot be talked to. */
export const TALK_RANGE = 6;
/** A talk ends when the player walks this far from the speaker (metres). */
export const TALK_END = 12;
/** A line stays on screen this long (seconds of play). */
export const LINE_SECONDS = 7;
/** The goodbye stays this long, then the card closes. */
export const BYE_SECONDS = 3;
/** The player asks at most this many questions in one talk, then only "Bye" is left, so a talk stays short. */
export const MAX_ASKS = 2;
/** A beaver not talked to for this long (game seconds, a season) says it has not seen the player since then. */
export const LONG_AWAY = DAYS_PER_SEASON * DAY_SECONDS;

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

/** A small mixing function, so the same seed gives the same line. */
function mix(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

const hashOf = (seed: number, id: string): number => mix(seed, [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7));

/** A line of the pool by the hash, but not one the beaver said last time (`avoid`, which may hold more than the line). */
function pick(pool: readonly string[], h: number, avoid = ''): string {
  const i = h % pool.length;
  if (avoid === '') return pool[i]!;
  for (let k = 0; k < pool.length; k++) {
    const line = pool[(i + k) % pool.length]!;
    if (!avoid.includes(line)) return line;
  }
  return pool[i]!;
}

export interface TalkContext {
  feeling: Feeling;
  season: Season;
  clock: number;
  /** Any number that changes from one talk to the next, such as the count of talks so far. */
  seed: number;
  /** What this beaver said last time, so it does not say it twice in a row. */
  avoid?: string;
}

/**
 * A remark: a wary beaver only warns. Otherwise the beaver remarks on the player, or on the season or the night, by the seed. Mood
 * and role fix which lines are possible, so a kit never sounds like a papa.
 */
export function pickLine(speaker: Pick<Speaker, 'id' | 'kind'>, ctx: TalkContext): string {
  const own = REMARK[speaker.kind][ctx.feeling];
  const h = hashOf(ctx.seed, speaker.id);
  if (ctx.feeling === 'wary') return pick(own, h, ctx.avoid);
  return pick([...own, ...(isNight(ctx.clock) ? night() : SEASONAL[ctx.season])], h, ctx.avoid);
}

/** What a beaver remembers of the player: how many talks so far, and the clock of the last one. Saved in `world.met`. */
export interface Met {
  talks: number;
  last: number;
}

/** The world after a talk with a beaver begins: one more talk, now. */
export function noteTalk<W extends Pick<WorldState, 'met' | 'clock'>>(world: W, id: string): W {
  const before = world.met[id];
  return { ...world, met: { ...world.met, [id]: { talks: (before?.talks ?? 0) + 1, last: world.clock } } };
}

/** What a talk may speak of: all read from the world, so a line only says what is true. */
export interface TalkFacts {
  feeling: Feeling;
  season: Season;
  clock: number;
  /** The player's life stage. */
  stage: Stage;
  /** What the speaker remembers of earlier talks, or null the first time. */
  met: Met | null;
  /** The speaker's family took a gift from the player (its trust is above where it started). */
  gifted: boolean;
  /** The speaker was dug out of the snow by the player's family, and it shows the way. */
  guide: boolean;
  /** It was this life of the player that dug the speaker's family out (a rescue in a year since this life began). */
  savedByYou: boolean;
  inLodge: boolean;
  /** The player's lodge: none, being built, or whole. */
  lodge: 'none' | 'building' | 'whole';
  lodgeWorn: boolean;
  damWorn: boolean;
  /** A whole lodge's store under `LOW_STORE_MEALS` meals in autumn or winter. */
  storeLow: boolean;
  /** A whole lodge's store has room for more. */
  storeRoom: boolean;
  /** The player built a whole dam in this life. */
  firstDam: boolean;
  /** The player has a partner, following or at home. */
  mate: boolean;
  /** No partner yet, and a lone beaver lives in the valley. */
  lonely: boolean;
  /** The speaker's own state, when it is the partner. */
  partner: 'following' | 'home' | null;
}

/** The facts for a talk with a speaker now. */
export function factsFor(world: WorldState, speaker: Pick<Speaker, 'id' | 'family'>): TalkFacts {
  const { clock, lodge } = world;
  const season = dateAt(clock).season;
  const whole = lodgeComplete(lodge);
  const mate = mateOf(world.partners) ?? follower(world.partners);
  const own = world.partners.find((p) => p.id === speaker.id);
  const guide = world.guides.includes(speaker.id);
  const lifeYear = dateAt(world.journey.start).year;
  const prefix = `${speaker.family}:stuck:`;
  return {
    feeling: speaker.family ? familyMood(world, speaker.family) : 'curious',
    season,
    clock,
    stage: stageAt(clock, world.bornAt),
    met: world.met[speaker.id] ?? null,
    gifted: speaker.family !== null && familyTrust(world, speaker.family) > FAMILY_START_TRUST + 0.01,
    guide,
    savedByYou: guide && speaker.family !== null && world.rescued.some((r) => r.startsWith(prefix) && Number(r.slice(prefix.length)) >= lifeYear),
    inLodge: world.inLodge,
    lodge: whole ? 'whole' : lodge ? 'building' : 'none',
    lodgeWorn: whole && needsRepair(lodgeCondition(lodge, clock)),
    damWorn: world.dams.some((d) => damNeedsRepair(d, clock)),
    storeLow: whole && (season === 'autumn' || season === 'winter') && stockMeals(world.store) < LOW_STORE_MEALS,
    storeRoom: whole && stockTotal(world.store) < storeCapacity(storeCondition(world.storeWear, clock)),
    firstDam: world.achievements.includes('firstDam'),
    mate: mate !== null,
    lonely: mate === null && world.partners.some((p) => p.state === 'alone'),
    partner: own && own.state !== 'alone' ? own.state : null,
  };
}

const isHome = (kind: SpeakerKind): kind is HomeKind => kind === 'home-mama' || kind === 'home-papa' || kind === 'partner';

/** The true things about the player's life that Mama, Papa or the partner may speak of, as keys of `LIFE`. */
export function lifeFacts(kind: HomeKind, f: TalkFacts): LifeFact[] {
  const out: LifeFact[] = [];
  if (f.stage === 'baby') out.push('baby');
  else {
    if (f.stage === 'teenager') out.push('teen');
    if (f.storeLow) out.push('storeLow');
    if (f.lodgeWorn) out.push('lodgeWorn');
    if (f.damWorn) out.push('damWorn');
    if (f.firstDam) out.push('firstDam');
    if (f.stage === 'adult') {
      out.push(f.lodge === 'whole' ? 'ownLodge' : f.lodge === 'building' ? 'building' : 'noLodge');
      if (kind !== 'partner' && f.mate) out.push('mate');
      if (f.lonely) out.push('lonely');
    }
    if (kind === 'partner' && f.partner === 'home' && f.lodge === 'whole') out.push('kitsSoon');
  }
  return out.filter((k) => (LIFE[kind][k]?.length ?? 0) > 0);
}

/**
 * The first thing a beaver says when the player starts a talk. A wary one only warns. A beaver of another family says who it is
 * the first time, is glad to see the player again after that, and remembers a long time away, a gift and a rescue. Mama, Papa and
 * the partner speak of the player's life: its stage, its lodge, dams and store, by what is true now.
 */
export function greeting(s: Speaker, f: TalkFacts, seed: number, avoid = ''): string {
  const h = hashOf(seed, s.id);
  if (f.feeling === 'wary') return pick(REMARK[s.kind].wary, h, avoid);
  const remark = (): string => pickLine(s, { feeling: f.feeling, season: f.season, clock: f.clock, seed: seed + 7, avoid });
  const away = f.met && f.clock - f.met.last >= LONG_AWAY ? withSince(LONG_AWAY_LINES[s.kind][h % LONG_AWAY_LINES[s.kind].length]!, SINCE[dateAt(f.met.last).season]) : null;
  if (isHome(s.kind)) {
    // The player's life weighs twice as much as a general remark. A baby hears no talk of work for the season.
    const life = lifeFacts(s.kind, f).flatMap((k) => LIFE[s.kind as HomeKind][k] ?? []);
    const general = [...REMARK[s.kind].curious, ...(isNight(f.clock) ? night() : f.stage === 'baby' ? [] : SEASONAL[f.season])];
    const body = pick([...life, ...general, ...life], h >>> 3, avoid);
    return away ? `${away} ${body}` : body;
  }
  const kind = s.kind;
  const who = { name: s.name, ...(s.place ? { place: s.place } : {}) };
  if (!f.met) {
    const opener = f.savedByYou ? withWho(RESCUED[kind][0]!, who) : pick(FIRST_MEETING[kind][f.feeling].map((line) => withWho(line, who)), h, avoid);
    const then = f.guide && !f.savedByYou ? KIN_RESCUE[kind] : f.gifted && !f.guide ? pick(THANKS[kind], h >>> 4) : remark();
    return `${opener} ${then}`;
  }
  const rescue = f.savedByYou ? RESCUED[kind].slice(1).map((line) => withWho(line, who)) : f.guide ? [KIN_RESCUE[kind]] : [];
  const openers = [...AGAIN[kind], ...(f.gifted ? THANKS[kind] : []), ...rescue];
  return `${away ?? pick(openers, h >>> 2, avoid)} ${remark()}`;
}

/** A reply the player can tap. */
export type Reply = 'doing' | 'news' | 'help' | 'lead' | 'bye';

/** The order the questions are offered in: a neighbour that trusts the player has news, Mama and Papa have jobs first. */
const ORDER: Record<'curious' | 'calm' | 'home', readonly Reply[]> = {
  curious: ['lead', 'doing', 'news', 'help'],
  calm: ['lead', 'doing', 'help', 'news'],
  home: ['help', 'news', 'doing'],
};

/**
 * The replies the player can tap now, at most three, "Bye" always last. A question asked is not offered again, a wary beaver only
 * hears "Can I help?", and after `MAX_ASKS` questions only "Bye" is left. "Show me the way" is for a guide.
 */
export function choicesFor(s: Pick<Speaker, 'kind'>, f: Pick<TalkFacts, 'feeling' | 'guide'>, asked: readonly Reply[]): Reply[] {
  if (asked.length >= MAX_ASKS) return ['bye'];
  if (f.feeling === 'wary') return asked.includes('help') ? ['bye'] : ['help', 'bye'];
  const order = isHome(s.kind) ? ORDER.home : ORDER[f.feeling];
  return [...order.filter((r) => !asked.includes(r) && (r !== 'lead' || f.guide)).slice(0, 2), 'bye'];
}

/** "What are you doing?": the errand and its reason, else the task. Mama, Papa and the partner speak of the pond and the player. */
function doingLine(s: Speaker, f: TalkFacts, h: number, avoid: string): string {
  if (s.kind === 'home-mama' || s.kind === 'home-papa') {
    const t = HOME_DOING[s.kind];
    if (f.inLodge) return t.nest;
    // Out in the pond, a parent on an errand says what it is (`routines.ts`); resting, it speaks of the player as before.
    const job = s.errand && s.errand !== 'rest' ? HOME_ERRANDS[s.kind][s.errand] : undefined;
    if (job) return (s.carry ? job.carrying?.[s.carry] : undefined) ?? pick(job.lines, h, avoid);
    if (s.kind === 'home-papa' && f.lodgeWorn && f.stage !== 'adult') return HOME_DOING['home-papa'].worn;
    return f.stage === 'adult' ? t.grown : t.young;
  }
  if (s.kind === 'partner') return f.partner === 'home' ? HOME_DOING.partner.home : HOME_DOING.partner.following;
  const errand = s.errand ? DOING[s.kind][s.errand] : undefined;
  if (errand) {
    const line = (s.carry ? errand.carrying?.[s.carry] : undefined) ?? pick(errand.lines, h, avoid);
    return s.errand === 'store' && s.kind !== 'kit' ? `${line} ${STORE_WHY[f.season]}` : line;
  }
  return pick(TASK_DOING[s.kind][s.task ?? 'swim'] ?? TASK_DOING[s.kind].swim!, h, avoid);
}

/** The most useful true job for the player, for "Can I help?" to Mama, Papa or the partner. */
export function homeJob(kind: HomeKind, f: TalkFacts): HomeJob {
  if (f.stage === 'baby') return 'baby';
  if (f.storeLow) return 'storeLow';
  if (f.lodgeWorn) return 'lodgeWorn';
  if (f.damWorn) return 'damWorn';
  if (f.stage === 'adult' && f.lodge === 'none') return 'noLodge';
  if (f.stage === 'adult' && f.lodge === 'building') return 'building';
  if (f.stage === 'adult' && kind !== 'partner' && f.lonely) return 'lonely';
  if (f.storeRoom) return 'storeRoom';
  return 'none';
}

/** "Can I help?": something true the player can do. A family asks for a gift put down near it, which it takes; a wary one is not ready. */
function helpLine(s: Speaker, f: TalkFacts, h: number, avoid: string): string {
  if (isHome(s.kind)) return HOME_HELP[s.kind][homeJob(s.kind, f)];
  if (f.feeling === 'wary') return pick(HELP_WARY[s.kind], h, avoid);
  return (s.errand ? HELP[s.kind][s.errand] : undefined) ?? HELP[s.kind].any!;
}

/** A short goodbye that fits, for "Bye". */
export function farewell(s: Pick<Speaker, 'id' | 'kind'>, f: Pick<TalkFacts, 'feeling'>, seed: number, avoid = ''): string {
  const pool = FAREWELL[s.kind][f.feeling === 'wary' ? 'wary' : 'warm'];
  return pick(pool.length > 0 ? pool : FAREWELL[s.kind].warm, hashOf(seed, s.id), avoid);
}

/** The beaver's answer to "What are you doing?", "Can I help?" or "Bye". The news is `answerNews` in `news.ts`. */
export function replyLine(reply: 'doing' | 'help' | 'bye', s: Speaker, f: TalkFacts, seed: number, avoid = ''): string {
  const h = hashOf(seed, s.id);
  if (reply === 'doing') return doingLine(s, f, h, avoid);
  if (reply === 'help') return helpLine(s, f, h, avoid);
  return farewell(s, f, seed, avoid);
}

/** Who a speaker is, under its name on the card: "papa of the north pond", "your mama". */
export function roleOf(s: Pick<Speaker, 'kind' | 'place'>): string {
  return isHome(s.kind) || !s.place ? ROLE_WORD[s.kind] : t('talk.roleOf', { role: ROLE_WORD[s.kind], place: s.place });
}

/** The people of the player's own lodge or a former one, as the family module draws them. */
interface ParentLike {
  id: string;
  x: number;
  z: number;
  inside: boolean;
  /** 0 resting, 1 on the move. */
  pace?: number;
  /** What the parent is doing and why, from its routine (`routines.ts`), when known. */
  task?: string;
  errand?: string;
  carry?: string | null;
}

/** The partners the player has met, as the partner module keeps them. */
interface PartnerLike {
  id: string;
  x: number;
  z: number;
  state: 'alone' | 'following' | 'home';
}

/** A neighbour beaver as `neighboursAt` and `reactFamilies` give it. What it does and why may be missing, or a word not known here. */
interface NeighbourLike {
  id: string;
  name: string;
  family: string;
  role: 'mama' | 'papa' | 'kit';
  x: number;
  z: number;
  task?: string;
  errand?: string;
  carry?: string | null;
}

/** The task, errand and load of a neighbour or a parent, each only when it is one the lines know. */
function activityOf(n: Pick<NeighbourLike, 'task' | 'errand' | 'carry'>): Pick<Speaker, 'task' | 'errand' | 'carry'> {
  return {
    ...(TASKS.includes(n.task as Task) ? { task: n.task as Task } : {}),
    ...(ERRANDS.includes(n.errand as Errand) ? { errand: n.errand as Errand } : {}),
    ...(CARRIES.includes(n.carry as Carry) ? { carry: n.carry as Carry } : {}),
  };
}

/**
 * Everybody the player could talk to now. Parents in the lodge are here too, when the player is inside with them. `placeOf` names a
 * family's pond ("north pond"), for the first meeting and the card.
 */
export function speakersOf(neighbours: readonly NeighbourLike[], parents: readonly ParentLike[], partners: readonly PartnerLike[], nameOf: (id: string) => string, placeOf?: (family: string) => string | null): Speaker[] {
  const parentTask = (p: ParentLike): Task => (p.inside || (p.pace ?? 1) <= 0 ? 'rest' : 'swim');
  return [
    ...neighbours.map((n): Speaker => {
      const place = placeOf?.(n.family);
      return { id: n.id, name: n.name, kind: n.role, family: n.family, x: n.x, z: n.z, ...(place ? { place } : {}), ...activityOf(n) };
    }),
    ...parents.map((p): Speaker => ({ id: p.id, name: p.id.startsWith('mama') ? 'Mama' : 'Papa', kind: p.id.startsWith('mama') ? 'home-mama' : 'home-papa', family: null, x: p.x, z: p.z, task: parentTask(p), ...activityOf(p) })),
    ...partners.filter((p) => p.state !== 'alone').map((p): Speaker => ({ id: p.id, name: nameOf(p.id), kind: 'partner', family: null, x: p.x, z: p.z, task: 'swim' })),
  ];
}
