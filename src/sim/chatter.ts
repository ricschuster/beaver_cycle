// Beavers among themselves (docs/design/27_families_and_dialog.md): what two beavers of a family say to each other where the
// player can overhear it, what a family says when it meets the player or takes a gift, and what the partner remarks on. All the
// lines are in the tables here, so the author can edit them in one place. Each is picked by a pure function of the world and a
// slot of the clock, so the same slot gives the same words and a test can step them. No DOM, no three.js.
//
// Placeholders in the lines: `{to}` is what the caller calls the other one (a name, or "Mama" and "Papa" from a kit), `{from}`
// what the other calls the caller back, `{guide}` a beaver the player dug out of the snow ("me" or "you" when it is one of the
// two), `{dir}` a compass word, `{pond}` a family's pond, `{speaker}` and `{kit}` members of the family.
import { DAY_FRACTION, DAY_SECONDS, dateAt, type Season } from './clock';
import { damNeedsRepair, damWhole } from './dam';
import { FAMILY_START_TRUST, familyMood, familyTrust } from './familyMoods';
import { stockMeals, type Food } from './food';
import { lodgeComplete, lodgeCondition } from './lodge';
import type { Mood } from './moods';
import { nameOf } from './names';
import { compassWord, follower, mateOf } from './partners';
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

/** Everyday calls about the pond, for any time. Each pair of sides has at least one, and `any>any` always fits. */
export const EVERYDAY: readonly ExchangeLine[] = [
  { pair: 'parent>kit', call: '{to}, come back to the lodge!', reply: 'Coming, {from}!' },
  { pair: 'parent>kit', call: '{to}, do not swim so far!', reply: 'I will stay close, {from}.' },
  { pair: 'parent>kit', call: '{to}, have you eaten?', reply: 'Not yet, {from}. Soon!' },
  { pair: 'any>any', call: 'Look, {to}! A fish!', reply: 'Where? I missed it!' },
  { pair: 'kit>kit', call: '{to}, race you to the dam!', reply: 'You will never catch me!' },
  { pair: 'kit>kit', call: '{to}, you have mud on your nose!', reply: 'So do you!' },
  { pair: 'kit>kit', call: '{to}, I can hold my breath longer than you!', reply: 'No way! Let us try!' },
  { pair: 'kit>parent', call: '{to}, watch me dive!', reply: 'Well done, {from}!' },
  { pair: 'parent>parent', call: '{to}, the water is nice and calm today.', reply: 'Just right for a swim.' },
];

/** Calls about the errand the caller is on. */
export const ERRAND_LINES: Readonly<Record<Errand, readonly ExchangeLine[]>> = {
  dam: [
    { pair: 'parent>any', call: '{to}, bring me a log for the dam!', reply: 'Here comes one, {from}!' },
    { pair: 'parent>parent', call: '{to}, the dam has a little leak.', reply: 'I will fetch some mud.' },
    { pair: 'kit>parent', call: '{to}, can I help with the dam?', reply: 'Yes! Bring a small stick, {from}.' },
  ],
  store: [
    { pair: 'parent>any', call: '{to}, the store needs branches!', reply: 'Coming, {from}!' },
    { pair: 'kit>parent', call: '{to}, I put a branch in the store!', reply: 'Good job, {from}!' },
  ],
  lodge: [
    { pair: 'parent>any', call: '{to}, help me patch the roof!', reply: 'On my way, {from}!' },
    { pair: 'parent>parent', call: '{to}, the lodge needs more mud before the cold.', reply: 'I will bring some.' },
  ],
  food: [
    { pair: 'parent>kit', call: '{to}, come and eat!', reply: 'Yum! Coming, {from}!' },
    { pair: 'any>any', call: '{to}, the lily pads are sweet today.', reply: 'Save one for me!' },
  ],
  kits: [
    { pair: 'parent>kit', call: '{to}, stay where I can see you!', reply: 'I am right here, {from}!' },
    { pair: 'parent>parent', call: '{to}, where are the kits?', reply: 'Playing by the reeds.' },
  ],
  play: [
    { pair: 'kit>kit', call: '{to}, catch me if you can!', reply: 'Here I come!' },
    { pair: 'kit>kit', call: '{to}, you are it!', reply: 'Not fair, I was not ready!' },
    { pair: 'kit>parent', call: '{to}, play with us!', reply: 'Just one game, {from}.' },
  ],
  rest: [
    { pair: 'any>any', call: '{to}, shh. I am having a nap.', reply: 'Sorry! I will be quiet.' },
    { pair: 'parent>kit', call: '{to}, time for a little rest.', reply: 'But I am not tired, {from}!' },
  ],
};

/** Calls about what the caller is doing, or carrying, when it has no errand line that fits. */
export const TASK_LINES: Readonly<Partial<Record<Task, readonly ExchangeLine[]>>> = {
  gnaw: [{ pair: 'any>any', call: '{to}, this tree is nearly down!', reply: 'Watch out below!' }],
  carry: [{ pair: 'any>any', call: '{to}, look how big my branch is!', reply: 'Wow, that is a big one!' }],
  build: [{ pair: 'any>any', call: '{to}, pass me some mud, please.', reply: 'Here you go, {from}.' }],
  groom: [{ pair: 'any>any', call: '{to}, you have a twig in your fur.', reply: 'Thank you, {from}!' }],
  eat: [{ pair: 'any>any', call: '{to}, want some bark?', reply: 'Yes please, {from}!' }],
  play: [{ pair: 'kit>kit', call: '{to}, splash!', reply: 'Hey! Splash back!' }],
};

export const CARRY_LINES: Readonly<Record<Carried, readonly ExchangeLine[]>> = {
  branch: [{ pair: 'any>any', call: '{to}, I found a good branch!', reply: 'Take it to the store, {from}.' }],
  lily: [{ pair: 'any>any', call: '{to}, I have a lily pad for you!', reply: 'Thank you, {from}!' }],
  mud: [{ pair: 'any>any', call: '{to}, mind the mud!', reply: 'Too late, I am all muddy!' }],
};

/** Calls about the season: new kits in spring, the store in autumn, the ice in winter. */
export const SEASON_LINES: Readonly<Record<Season, readonly ExchangeLine[]>> = {
  spring: [
    { pair: 'parent>parent', call: '{to}, the new kits are so small!', reply: 'They grow so fast in spring.' },
    { pair: 'kit>kit', call: '{to}, the new kits are so tiny!', reply: 'We were that small once!' },
    { pair: 'any>any', call: '{to}, the ice is all gone!', reply: 'Time to swim far again!' },
  ],
  summer: [
    { pair: 'any>any', call: '{to}, the water is so warm!', reply: 'Let us swim to the reeds!' },
    { pair: 'kit>kit', call: '{to}, I saw a dragonfly!', reply: 'Where? Show me!' },
  ],
  autumn: [
    { pair: 'parent>any', call: '{to}, the store is not full yet.', reply: 'I will fetch more branches, {from}.' },
    { pair: 'kit>parent', call: '{to}, why do we fill the store?', reply: 'So we have food under the ice, {from}.' },
    { pair: 'any>any', call: '{to}, the leaves are falling!', reply: 'Winter comes soon.' },
  ],
  winter: [
    { pair: 'any>any', call: '{to}, the ice is so thick today!', reply: 'We are warm in the lodge, though.' },
    { pair: 'parent>kit', call: '{to}, stay near the lodge under the ice.', reply: 'I will, {from}.' },
    { pair: 'kit>kit', call: '{to}, look at all the snow!', reply: 'It looks like a big white blanket!' },
  ],
};

/** What a family says about the player, by what the player did. A wary family whispers. */
export type Deed = 'wary' | 'startled' | 'gift' | 'rescue' | 'dam' | 'lodge' | 'friend';
export const PLAYER_LINES: Readonly<Record<Deed, readonly ExchangeLine[]>> = {
  wary: [
    { pair: 'any>any', call: 'Shh, {to}. The stranger is here.', reply: 'I see it. Keep still.' },
    { pair: 'parent>kit', call: '{to}, stay close. Someone new is here.', reply: 'Who is it, {from}?' },
  ],
  startled: [
    { pair: 'any>any', call: '{to}, that beaver slapped its tail at us!', reply: 'It made me jump!' },
    { pair: 'parent>kit', call: '{to}, that loud beaver is back.', reply: 'Maybe it was only scared, {from}.' },
  ],
  gift: [
    { pair: 'any>any', call: '{to}, that is the beaver who brought us food!', reply: 'How kind! I hope it comes again.' },
    { pair: 'kit>parent', call: '{to}, can that nice beaver play with us?', reply: 'Ask nicely, {from}.' },
  ],
  rescue: [
    { pair: 'any>any', call: '{to}, that is the beaver who dug {guide} out of the snow!', reply: 'What a good friend.' },
  ],
  dam: [{ pair: 'any>any', call: '{to}, look! That beaver built a dam near us.', reply: 'It is a good one, too!' }],
  lodge: [{ pair: 'any>any', call: '{to}, that beaver lives close by now.', reply: 'Good. A new neighbour!' }],
  friend: [
    { pair: 'any>any', call: '{to}, our friend is back!', reply: 'Hello, friend!' },
    { pair: 'kit>kit', call: '{to}, the nice beaver is here again!', reply: 'Let us go and look!' },
  ],
};

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
export const labelOf = (n: Pick<Chatterer, 'name' | 'role'>): string => (n.role === 'mama' ? `Mama ${n.name}` : n.role === 'papa' ? `Papa ${n.name}` : n.name);
/** What one beaver calls another: a kit says "Mama" or "Papa" to its parents, everyone else uses the name. */
export const addressOf = (speaker: Pick<Chatterer, 'role'>, to: Pick<Chatterer, 'name' | 'role'>): string =>
  speaker.role === 'kit' && to.role === 'mama' ? 'Mama' : speaker.role === 'kit' && to.role === 'papa' ? 'Papa' : to.name;

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
  if (d.mood === 'wary') return d.startled ? [PLAYER_LINES.wary, PLAYER_LINES.startled] : [PLAYER_LINES.wary];
  if (!d.met) return [];
  const pools: (readonly ExchangeLine[])[] = [];
  if (d.gift) pools.push(PLAYER_LINES.gift);
  if (d.rescued) pools.push(PLAYER_LINES.rescue);
  if (d.dam) pools.push(PLAYER_LINES.dam);
  if (d.lodge) pools.push(PLAYER_LINES.lodge);
  if (d.startled) pools.push(PLAYER_LINES.startled);
  if (d.mood === 'curious') pools.push(PLAYER_LINES.friend);
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
    const pools: (readonly ExchangeLine[])[] = [EVERYDAY, SEASON_LINES[dateAt(clock).season]];
    if (from.errand) pools.push(ERRAND_LINES[from.errand], ERRAND_LINES[from.errand]);
    if (from.carry) pools.push(CARRY_LINES[from.carry]);
    const task = from.task ? TASK_LINES[from.task] : undefined;
    if (task) pools.push(task);
    if (deeds) pools.push(...playerPools(deeds));
    const pool = pools[(h >>> 8) % pools.length]!.filter((l) => fits(l.pair, from.role, to.role));
    const lines = pool.length > 0 ? pool : EVERYDAY.filter((l) => fits(l.pair, from.role, to.role));
    const line = lines[(h >>> 12) % lines.length]!;
    const guide = deeds?.rescued ? (deeds.rescued === from.id ? 'me' : deeds.rescued === to.id ? 'you' : nameOf(deeds.rescued)) : undefined;
    const call = fill(line.call, { to: addressOf(from, to), guide });
    const reply = fill(line.reply, { from: addressOf(to, from), guide });
    if (call === null || reply === null) return null;
    return { family: f, call: { who: labelOf(from), text: call }, reply: { who: labelOf(to), text: reply } };
  }
  return null;
}

/** The greeting toast when a family first comes near on a visit: by mood, and by what the player did. */
export const GREETINGS = {
  waryNew: ['A beaver family. They are shy. Put a branch down near them', 'The {pond} family hides in the water. They are shy. Put a branch down near them'],
  waryMet: ['The {pond} family peeks at you from the water. Put a branch down near them'],
  waryStartled: ['The {pond} family dives away. Your tail slap made them jump. A branch may help'],
  calmNew: ['A beaver family says hello', '{speaker} of the {pond} says hello'],
  calmMet: ['{speaker} says hello again', 'The {pond} family waves hello'],
  curiousNew: ['The {pond} family has heard of you and is happy to see you'],
  curious: ['The beaver family is happy to see you', '{kit} swims over to say hello'],
  gift: ['{speaker}: "You are back! The kits loved your gift."'],
  rescue: ['{guide} waves at you: "My friend from the snow!"'],
  dam: ['{speaker}: "We saw your dam. Good work!"'],
  lodge: ['{speaker}: "Hello, neighbour!"'],
} as const satisfies Record<string, readonly string[]>;

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
  return lines.length > 0 ? lines[seed % lines.length]! : 'A beaver family says hello';
}

/** The thanks for a gift, by what it is and the errand the family is on. */
export const GIFT_THANKS: Readonly<Record<Food, Readonly<Partial<Record<Errand | 'any', readonly string[]>>>>> = {
  branch: {
    store: ['Just what we needed for the store!'],
    dam: ['A branch for the dam. Thank you!'],
    lodge: ['Just right for the roof. Thank you!'],
    any: ['A fresh branch! Thank you.', 'Mmm, willow bark. Thank you!'],
  },
  lily: {
    food: ['Lily pads! Dinner is ready.'],
    kits: ['A lily pad! The kits will love it.'],
    any: ['A lily pad! Yum, thank you.', 'So sweet and fresh. Thank you!'],
  },
};

/**
 * The toast when a family takes a gift: one of them (a parent first) thanks the player for what it is, by the family's errand
 * when one of them is on one that fits, and says that the family trusts the player more.
 */
export function giftThanks(kind: Food, members: readonly Pick<Chatterer, 'name' | 'role' | 'errand'>[], seed: number): string {
  const speaker = members.find((m) => m.role === 'mama') ?? members.find((m) => m.role === 'papa') ?? members[0];
  const table = GIFT_THANKS[kind];
  const errand = members.map((m) => m.errand).find((e): e is Errand => !!e && table[e] !== undefined);
  const lines = (errand ? table[errand] : undefined) ?? table.any ?? [];
  const line = lines[seed % Math.max(1, lines.length)] ?? 'Thank you!';
  return speaker ? `${labelOf(speaker)}: "${line}" They trust you a little more` : `The beavers take it: "${line}" They trust you a little more`;
}

/** The partner remarks on what is around while it follows, and on the home once it lives there. */
export const PARTNER_LINES = {
  spot: ['That stream to the {dir} looks good for a dam.', 'There is a good dam spot to the {dir}. Shall we look?'],
  pads: ['I smell lily pads to the {dir}. Yum!'],
  wornDam: ['One of your dams is wearing thin. Shall we mend it?'],
  building: ['Our lodge is coming along. A few more logs!'],
  dusk: ['The sun is going down. Let us find a safe place to sleep.'],
  follow: ['I am right behind you!', 'Where are we going next?', 'I like swimming with you.'],
  homeWorn: ['Our lodge is wearing thin. Some sticks and mud would fix it.'],
  storeLow: ['Our store looks small for the winter. More branches?'],
  storeFull: ['Look how full our store is!'],
  homeDusk: ['It is getting dark. Time to come inside?'],
  kits: ['I hope we have kits in spring.'],
  home: ['I love our pond.', 'Home sweet lodge.', 'Our lodge feels warm and safe.'],
  spring: ['Everything is green again!'],
  summer: ['The water is so warm today.'],
  autumn: ['The leaves are falling. Winter comes soon.'],
  winter: ['Brr! The ice is thick today.'],
} as const satisfies Record<string, readonly string[]>;

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
 * it. At most once a slot of the clock and in about half the slots; the same slot gives the same remark.
 */
export function partnerRemark(world: Pick<WorldState, 'partners' | 'spots' | 'dams' | 'clock' | 'beaver' | 'lodge' | 'store' | 'inLodge'>, pad: { x: number; z: number } | null): Said | null {
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
    if (spot) lines.push(...PARTNER_LINES.spot.map((t) => fill(t, { dir: compassWord(spot.s.bed.x - b.x, spot.s.bed.z - b.z) })!));
    if (pad && Math.hypot(pad.x - b.x, pad.z - b.z) <= REMARK_PAD_RANGE) lines.push(...PARTNER_LINES.pads.map((t) => fill(t, { dir: compassWord(pad.x - b.x, pad.z - b.z) })!));
    if (world.lodge && !lodgeComplete(world.lodge)) lines.push(...PARTNER_LINES.building);
    if (dusk) lines.push(...PARTNER_LINES.dusk);
    lines.push(...PARTNER_LINES.follow);
  }
  return { who: nameOf(p.id), text: lines[(h >>> 4) % lines.length]! };
}
