// Beavers among themselves (docs/design/27_families_and_dialog.md): what two beavers of a family say to each other where the
// player can overhear it, what a family says when it meets the player or takes a gift, and what the partner remarks on. All the
// lines are in the tables here, so the author can edit them in one place. Each is picked by a pure function of the world and a
// slot of the clock, so the same slot gives the same words and a test can step them. No DOM, no three.js.
//
// Placeholders in the lines: `{to}` is what the caller calls the other one (a name, or "Mama" and "Papa" from a kit), `{from}`
// what the other calls the caller back, `{guide}` a beaver the player dug out of the snow ("me" or "you" when it is one of the
// two), `{where}` where something is from the player ("to your left, close by"), `{pond}` a family's pond, `{speaker}` and `{kit}` members of the family.
import { groups, memoByLang, t, text, tree } from '../i18n';
import { DAY_FRACTION, DAY_SECONDS, dateAt, type Season } from './clock';
import { damNeedsRepair, damWhole } from './dam';
import { FAMILY_START_TRUST, familyMood, familyTrust } from './familyMoods';
import { stockMeals, type Food } from './food';
import { lodgeComplete, lodgeCondition } from './lodge';
import type { Mood } from './moods';
import { nameOf } from './names';
import { follower, mateOf } from './partners';
import { placeWords } from './wayToPartner';
import type { WorldState } from './state';
import { needsRepair } from './wear';

export type Role = 'mama' | 'papa' | 'kit';
/** What a family beaver is doing, and the errand it is on. Optional: a beaver without them still chats (`neighbours.ts`). */
export type Task = 'swim' | 'rest' | 'eat' | 'gnaw' | 'carry' | 'build' | 'groom' | 'play';
export type Errand = 'dam' | 'store' | 'lodge' | 'food' | 'kits' | 'play' | 'rest';
export type Carried = 'branch' | 'lily' | 'mud';

/** A family beaver as far as the chatter needs it. */
export interface Chatterer {
  id: string;
  name: string;
  family: string;
  role: Role;
  x: number;
  z: number;
  task?: Task;
  errand?: Errand | null;
  carry?: Carried | null;
}

/** One thing said, by whom ("Mama Willow"). */
export interface Said {
  who: string;
  text: string;
}

/** A call and its reply, between two beavers of one family. */
export interface Exchange {
  family: string;
  call: Said;
  reply: Said;
}

/** Who may say a line to whom: the caller's side, then the other's. `parent` is a mama or a papa. */
type Side = 'parent' | 'kit' | 'any';
type Pair = `${Side}>${Side}`;

/** A line of an exchange: who may call it, the call, and the reply. */
export interface ExchangeLine {
  pair: Pair;
  call: string;
  reply: string;
}

/** The lines of a table: each id under `prefix` is a pair of sides and a number (`parent-kit-2`), with its call and its reply. */
const exchanges = memoByLang((prefix: string): ExchangeLine[] =>
  groups(prefix).map((id) => ({ pair: id.replace(/-\d+$/, '').replace('-', '>') as Pair, call: text(`${prefix}.${id}.call`), reply: text(`${prefix}.${id}.reply`) })),
);

/** Everyday calls about the pond, for any time. Each pair of sides has at least one, and `any>any` always fits. */
export const everyday = (): readonly ExchangeLine[] => exchanges('chatter.everyday');

/** Calls about the errand the caller is on. */
export const errandLines = (e: Errand): readonly ExchangeLine[] => exchanges(`chatter.errand.${e}`);

/** Calls about what the caller is doing, or carrying, when it has no errand line that fits. Empty for a task without any. */
export const taskLines = (t: Task): readonly ExchangeLine[] => exchanges(`chatter.task.${t}`);

export const carryLines = (c: Carried): readonly ExchangeLine[] => exchanges(`chatter.carry.${c}`);

/** Calls about the season: new kits in spring, the store in autumn, the ice in winter. */
export const seasonLines = (s: Season): readonly ExchangeLine[] => exchanges(`chatter.season.${s}`);

/** What a family says about the player, by what the player did. A wary family whispers. */
export type Deed = 'wary' | 'startled' | 'gift' | 'rescue' | 'dam' | 'lodge' | 'friend';
export const playerLines = (d: Deed): readonly ExchangeLine[] => exchanges(`chatter.player.${d}`);

/** A call is made in a slot of this many clock seconds, and only in some slots. */
export const CALL_SLOT = DAY_SECONDS / 12;
const CALL_ONE_IN = 2;
/** The partner remarks in one slot of this many, at most once a slot. */
const REMARK_ONE_IN = 2;

function mix(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}

const hashText = (s: string): number => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 3);
const sideOf = (role: Role): Side => (role === 'kit' ? 'kit' : 'parent');
const fits = (pair: Pair, from: Role, to: Role): boolean => {
  const [f, t] = pair.split('>') as [Side, Side];
  return (f === 'any' || f === sideOf(from)) && (t === 'any' || t === sideOf(to));
};

/** How a beaver shows in a toast: "Mama Willow", "Papa Alder", or a kit's name. */
export const labelOf = (n: Pick<Chatterer, 'name' | 'role'>): string => (n.role === 'mama' ? t('chatter.mama', { name: n.name }) : n.role === 'papa' ? t('chatter.papa', { name: n.name }) : n.name);
/** What one beaver calls another: a kit says "Mama" or "Papa" to its parents, everyone else uses the name. */
export const addressOf = (speaker: Pick<Chatterer, 'role'>, to: Pick<Chatterer, 'name' | 'role'>): string =>
  speaker.role === 'kit' && to.role === 'mama' ? t('chatter.toMama') : speaker.role === 'kit' && to.role === 'papa' ? t('chatter.toPapa') : to.name;

/** Fills the placeholders of a line. A placeholder with no value leaves the line out (null). */
export function fill(text: string, values: Readonly<Record<string, string | undefined>>): string | null {
  let missing = false;
  const out = text.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = values[key];
    if (v === undefined) missing = true;
    return v ?? '';
  });
  return missing ? null : out;
}

/** What a family knows of the player: its mood, whether it has met the player, and what the player did near it. */
export interface Deeds {
  mood: Mood;
  /** The family has a trust record, or greeted the player this visit. */
  met: boolean;
  /** The player gave the family food this visit. */
  gift: boolean;
  /** A member the player dug out of the snow (its id), or null. */
  rescued: string | null;
  /** A whole dam of the player's stands within `DEED_NEAR` of the family's lodge. */
  dam: boolean;
  /** The player's whole lodge stands within `DEED_NEAR` of the family's lodge. */
  lodge: boolean;
  /** A tail slap of the player's startled the family: this visit, or its trust is still below the start. */
  startled: boolean;
}

/** A dam or lodge of the player's this close to a family's lodge (metres) is "near us". */
export const DEED_NEAR = 250;

/** What the game remembers of this visit only: the families given a gift, startled by a slap, and that greeted the player. */
export interface Visit {
  gifts?: ReadonlySet<string>;
  slaps?: ReadonlySet<string>;
  greeted?: ReadonlySet<string>;
}

/** What a family knows of the player, read from the world and this visit. */
export function deedsFor(world: Pick<WorldState, 'trust' | 'guides' | 'dams' | 'spots' | 'lodge' | 'neighbours'>, family: string, visit: Visit = {}): Deeds {
  const home = world.neighbours.find((n) => n.id === family)?.lodge ?? null;
  const near = (p: { x: number; z: number }): boolean => home !== null && Math.hypot(p.x - home.x, p.z - home.z) <= DEED_NEAR;
  const dam = world.dams.some((d) => {
    const spot = world.spots.find((s) => s.id === d.spot);
    return spot !== undefined && damWhole(d) && near(spot.bed);
  });
  return {
    mood: familyMood(world, family),
    met: world.trust[family] !== undefined || (visit.greeted?.has(family) ?? false),
    gift: visit.gifts?.has(family) ?? false,
    rescued: world.guides.find((g) => g.startsWith(`${family}:`)) ?? null,
    dam,
    lodge: lodgeComplete(world.lodge) && near(world.lodge),
    startled: (visit.slaps?.has(family) ?? false) || familyTrust(world, family) < FAMILY_START_TRUST - 1e-9,
  };
}

/** The lines about the player that are true for a family now. A wary family only whispers (or remembers the slap). */
function playerPools(d: Deeds): (readonly ExchangeLine[])[] {
  if (d.mood === 'wary') return d.startled ? [playerLines('wary'), playerLines('startled')] : [playerLines('wary')];
  if (!d.met) return [];
  const pools: (readonly ExchangeLine[])[] = [];
  if (d.gift) pools.push(playerLines('gift'));
  if (d.rescued) pools.push(playerLines('rescue'));
  if (d.dam) pools.push(playerLines('dam'));
  if (d.lodge) pools.push(playerLines('lodge'));
  if (d.startled) pools.push(playerLines('startled'));
  if (d.mood === 'curious') pools.push(playerLines('friend'));
  return pools;
}

/**
 * What two beavers of a family near the player say in this slot of the clock: one within `hearing` metres calls another by name,
 * and that one answers. The call follows the caller's errand, task or load when known, the season, and, once the family has met
 * the player, what the player did (`about` gives that by family; a wary family whispers about the stranger). The same slot gives
 * the same exchange, and about half the slots have one. Null when nobody talks, or fewer than two of a family are near.
 */
export function overheard(beavers: readonly Chatterer[], at: { x: number; z: number }, clock: number, about?: (family: string) => Deeds | null, hearing = 30): Exchange | null {
  const slot = Math.floor(clock / CALL_SLOT);
  const near = beavers.filter((n) => Math.hypot(n.x - at.x, n.z - at.z) <= hearing);
  const families = [...new Set(near.map((n) => n.family))].sort();
  for (const f of families) {
    const members = near.filter((n) => n.family === f).sort((a, c) => a.id.localeCompare(c.id));
    if (members.length < 2) continue;
    const h = mix(slot, hashText(f));
    if (h % CALL_ONE_IN !== 0) continue;
    const i = (h >>> 1) % members.length;
    const from = members[i]!;
    const to = members[(i + 1 + ((h >>> 4) % (members.length - 1))) % members.length]!;
    const deeds = about?.(f) ?? null;
    // The pools to pick from: the errand counts twice, as it is what the beaver is busy with.
    const pools: (readonly ExchangeLine[])[] = [everyday(), seasonLines(dateAt(clock).season)];
    if (from.errand) pools.push(errandLines(from.errand), errandLines(from.errand));
    if (from.carry) pools.push(carryLines(from.carry));
    const task = from.task ? taskLines(from.task) : [];
    if (task.length > 0) pools.push(task);
    if (deeds) pools.push(...playerPools(deeds));
    const pool = pools[(h >>> 8) % pools.length]!.filter((l) => fits(l.pair, from.role, to.role));
    const lines = pool.length > 0 ? pool : everyday().filter((l) => fits(l.pair, from.role, to.role));
    const line = lines[(h >>> 12) % lines.length]!;
    const guide = deeds?.rescued ? (deeds.rescued === from.id ? t('chatter.guideMe') : deeds.rescued === to.id ? t('chatter.guideYou') : nameOf(deeds.rescued)) : undefined;
    const call = fill(line.call, { to: addressOf(from, to), guide });
    const reply = fill(line.reply, { from: addressOf(to, from), guide });
    if (call === null || reply === null) return null;
    return { family: f, call: { who: labelOf(from), text: call }, reply: { who: labelOf(to), text: reply } };
  }
  return null;
}

/** The greeting toast when a family first comes near on a visit: by mood, and by what the player did. */
export const GREETINGS = tree<Record<'waryNew' | 'waryMet' | 'waryStartled' | 'calmNew' | 'calmMet' | 'curiousNew' | 'curious' | 'gift' | 'rescue' | 'dam' | 'lodge', readonly string[]>>('chatter.greetings');

/**
 * The greeting toast for a family: `members` are its beavers in sight (to name one), `pond` the family's pond ("north pond").
 * A first meeting with a wary family keeps the hint to put a branch down. `seed` turns the lines over.
 */
export function greetingFor(deeds: Deeds, members: readonly Pick<Chatterer, 'id' | 'name' | 'role'>[], pond: string, seed: number): string {
  const speaker = members.find((m) => m.role === 'mama') ?? members.find((m) => m.role === 'papa') ?? members[0];
  const kit = members.find((m) => m.role === 'kit');
  const values = { pond, speaker: speaker ? labelOf(speaker) : undefined, kit: kit?.name, guide: deeds.rescued ? nameOf(deeds.rescued) : undefined };
  let pool: readonly string[];
  if (deeds.mood === 'wary') pool = deeds.startled ? GREETINGS.waryStartled : deeds.met ? GREETINGS.waryMet : GREETINGS.waryNew;
  else if (deeds.mood === 'calm') pool = deeds.gift ? [...GREETINGS.calmMet, ...GREETINGS.gift] : deeds.met ? GREETINGS.calmMet : GREETINGS.calmNew;
  else {
    const done = [...(deeds.rescued ? GREETINGS.rescue : []), ...(deeds.gift ? GREETINGS.gift : []), ...(deeds.dam ? GREETINGS.dam : []), ...(deeds.lodge ? GREETINGS.lodge : [])];
    pool = done.length > 0 ? done : deeds.met ? GREETINGS.curious : GREETINGS.curiousNew;
  }
  const lines = pool.map((t) => fill(t, values)).filter((t): t is string => t !== null);
  return lines.length > 0 ? lines[seed % lines.length]! : t('chatter.greetingFallback');
}

/** The thanks for a gift, by what it is and the errand the family is on. */
export const GIFT_THANKS = tree<Record<Food, Partial<Record<Errand | 'any', readonly string[]>>>>('chatter.giftThanks');

/**
 * The toast when a family takes a gift: one of them (a parent first) thanks the player for what it is, by the family's errand
 * when one of them is on one that fits, and says that the family trusts the player more.
 */
export function giftThanks(kind: Food, members: readonly Pick<Chatterer, 'name' | 'role' | 'errand'>[], seed: number): string {
  const speaker = members.find((m) => m.role === 'mama') ?? members.find((m) => m.role === 'papa') ?? members[0];
  const table = GIFT_THANKS[kind];
  const errand = members.map((m) => m.errand).find((e): e is Errand => !!e && table[e] !== undefined);
  const lines = (errand ? table[errand] : undefined) ?? table.any ?? [];
  const line = lines[seed % Math.max(1, lines.length)] ?? t('chatter.giftFallback');
  return speaker ? t('chatter.giftSaid', { speaker: labelOf(speaker), line }) : t('chatter.giftSaidNobody', { line });
}

/** The partner remarks on what is around while it follows, and on the home once it lives there. */
export const PARTNER_LINES = tree<Record<'spot' | 'pads' | 'wornDam' | 'building' | 'dusk' | 'follow' | 'homeWorn' | 'storeLow' | 'storeFull' | 'homeDusk' | 'kits' | 'home' | Season, readonly string[]>>('chatter.partner');

/** The partner notices a free dam spot or lily pads this close (metres), and talks about the home within this of the lodge. */
export const REMARK_SPOT_RANGE = 80;
export const REMARK_PAD_RANGE = 60;
export const REMARK_HOME_RANGE = 40;
/** A store with fewer meals than this in autumn or winter is "small", from twice that it is "full". */
const SMALL_STORE = 10;
/** The last part of the day before night, when the partner says the sun is going down. */
const DUSK = 0.06;

/**
 * What the partner says now, or null. While it follows, it may point out a free dam spot or lily pads near, a worn dam, the
 * lodge being built, the nightfall or the season; once it lives in the lodge, it may talk about the home when the player is near
 * it. `facing` is where the player looks, for the words "to your left". At most once a slot of the clock and in about half the slots; the same slot gives the same remark.
 */
export function partnerRemark(world: Pick<WorldState, 'partners' | 'spots' | 'dams' | 'clock' | 'beaver' | 'lodge' | 'store' | 'inLodge'>, pad: { x: number; z: number } | null, facing: number = world.beaver.heading): Said | null {
  const p = follower(world.partners) ?? mateOf(world.partners);
  if (!p) return null;
  const b = world.beaver;
  const home = p.state === 'home';
  if (home && !world.inLodge && (!world.lodge || Math.hypot(world.lodge.x - b.x, world.lodge.z - b.z) > REMARK_HOME_RANGE)) return null;
  const h = mix(Math.floor(world.clock / CALL_SLOT), hashText(p.id) + 7);
  if (h % REMARK_ONE_IN !== 0) return null;
  const date = dateAt(world.clock);
  const dusk = date.timeOfDay < DAY_FRACTION && date.timeOfDay >= DAY_FRACTION - DUSK;
  const wornDam = world.dams.some((d) => damNeedsRepair(d, world.clock));
  const lines: string[] = [...PARTNER_LINES[date.season]];
  if (wornDam) lines.push(...PARTNER_LINES.wornDam);
  if (home) {
    const meals = stockMeals(world.store);
    const cold = date.season === 'autumn' || date.season === 'winter';
    if (world.lodge && lodgeComplete(world.lodge) && needsRepair(lodgeCondition(world.lodge, world.clock))) lines.push(...PARTNER_LINES.homeWorn);
    if (cold && meals < SMALL_STORE) lines.push(...PARTNER_LINES.storeLow);
    if (meals >= SMALL_STORE * 2) lines.push(...PARTNER_LINES.storeFull);
    if (dusk) lines.push(...PARTNER_LINES.homeDusk);
    if (date.season === 'winter') lines.push(...PARTNER_LINES.kits);
    lines.push(...PARTNER_LINES.home);
  } else {
    const used = new Set(world.dams.map((d) => d.spot));
    const spot = world.spots
      .filter((s) => !used.has(s.id))
      .map((s) => ({ s, d: Math.hypot(s.bed.x - b.x, s.bed.z - b.z) }))
      .filter((c) => c.d <= REMARK_SPOT_RANGE)
      .sort((a, c) => a.d - c.d)[0];
    if (spot) lines.push(...PARTNER_LINES.spot.map((t) => fill(t, { where: placeWords(spot.s.bed.x - b.x, spot.s.bed.z - b.z, facing) })!));
    if (pad && Math.hypot(pad.x - b.x, pad.z - b.z) <= REMARK_PAD_RANGE) lines.push(...PARTNER_LINES.pads.map((t) => fill(t, { where: placeWords(pad.x - b.x, pad.z - b.z, facing) })!));
    if (world.lodge && !lodgeComplete(world.lodge)) lines.push(...PARTNER_LINES.building);
    if (dusk) lines.push(...PARTNER_LINES.dusk);
    lines.push(...PARTNER_LINES.follow);
  }
  return { who: nameOf(p.id), text: lines[(h >>> 4) % lines.length]! };
}
