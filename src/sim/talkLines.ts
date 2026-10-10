// Every line a beaver says to the player, in one place (docs/design/27_families_and_dialog.md), so the author can edit them and
// a language could be added. Short, gentle and for children from 8: a kit is cheeky and short, a mama warm, a papa practical.
// `talk.ts` picks from these by pure functions; nothing here is chosen. The news hints live in `news.ts`. No DOM.
import type { Season } from './clock';
import type { Carry, Errand, Feeling, NeighbourKind, Reply, SpeakerKind, Task } from './talk';

/** Who is spoken of in a line: the speaker's name, and its pond ("north pond") when known. */
export interface Who {
  name: string;
  place?: string;
}

/** ", from the north pond", or nothing when the pond is not known. */
const from = (w: Who): string => (w.place ? `, from the ${w.place}` : '');

/** The words on the reply buttons. */
export const REPLY_LABEL: Record<Reply, string> = {
  doing: 'What are you doing?',
  news: 'Any news?',
  help: 'Can I help?',
  lead: 'Show me the way',
  bye: 'Bye',
};

/** A remark about the player, by role and feeling. A wary beaver only warns. */
export const REMARK: Record<SpeakerKind, Record<Feeling, readonly string[]>> = {
  mama: {
    wary: ['Hmm. Who are you?', 'Stay back, please.'],
    calm: ['The pond is calm today.', 'Good to see a new face on the pond.'],
    curious: ['Come and see the kits.', 'Our pond is your pond, friend.'],
  },
  papa: {
    wary: ['Hm.', 'We do not know you yet.'],
    calm: ['The water is high and clear.', 'Mind the dam when you swim by.'],
    curious: ['The water is good here.', 'Come by any time. We keep the dam strong.'],
  },
  kit: {
    wary: ['Eep!', 'Mama says not to talk to you.'],
    calm: ['I can swim really fast.', 'Do you have a branch?'],
    curious: ['Watch me dive!', 'Can we play? Please?'],
  },
  'home-mama': {
    wary: [],
    calm: [],
    curious: ['Have you eaten today?', 'Stay warm, my dear.', 'I love you, little beaver.'],
  },
  'home-papa': {
    wary: [],
    calm: [],
    curious: ['A beaver is only as good as its dam.', 'Mind the foxes at night.', 'Keep your tail ready and your teeth sharp.'],
  },
  partner: {
    wary: [],
    calm: [],
    curious: ['I am glad to be with you.', 'Shall we build something together?', 'This valley is lovely.'],
  },
};

/** A remark about the season, for anyone who is not wary. */
export const SEASONAL: Record<Season, readonly string[]> = {
  spring: ['The ice is gone, and the kits are coming.', 'Spring at last. The streams are loud.'],
  summer: ['The lily pads are thick this summer.', 'It is warm. Good weather for felling trees.'],
  autumn: ['Time to fill the store before the snow.', 'Cut your branches now, winter is near.'],
  winter: ['Cold. Stay near the lodge and eat well.', 'The pond is frozen at the edges. Take care.'],
};

/** A remark after dark, in place of the season. */
export const NIGHT: readonly string[] = ['It is late. The owls are out.', 'Quiet tonight. Listen to the water.'];

/** The first time a beaver of another family talks to the player: it says who it is. */
export const FIRST_MEETING: Record<NeighbourKind, Record<'calm' | 'curious', readonly ((w: Who) => string)[]>> = {
  mama: {
    calm: [(w) => `Hello. I am ${w.name}${from(w)}.`],
    curious: [(w) => `Hello, friend! I am ${w.name}${from(w)}.`],
  },
  papa: {
    calm: [(w) => `I am ${w.name}${from(w)}. Pleased to meet you.`],
    curious: [(w) => `A friend of the family! I am ${w.name}${from(w)}.`],
  },
  kit: {
    calm: [(w) => `Hi! I am ${w.name}! What is your name?`],
    curious: [(w) => `Hi hi! I am ${w.name}! Do you want to play?`],
  },
};

/** A beaver met again before long. */
export const AGAIN: Record<NeighbourKind, readonly string[]> = {
  mama: ['Hello again, dear.', 'Back again! How nice.'],
  papa: ['Back again? Good.', 'Hello again, friend.'],
  kit: ['You came back!', 'Again! Yay!'],
};

/** How a beaver names the season it last saw the player in: "I have not seen you since the snow". */
export const SINCE: Record<Season, string> = { spring: 'the spring', summer: 'the summer', autumn: 'the autumn leaves', winter: 'the snow' };

/** A beaver met again after a long time away (`LONG_AWAY`). */
export const LONG_AWAY_LINES: Record<SpeakerKind, readonly ((since: string) => string)[]> = {
  mama: [(s) => `There you are! I have not seen you since ${s}.`],
  papa: [(s) => `Well, well. Not since ${s}!`],
  kit: [(s) => `Where were you? Not since ${s}!`],
  'home-mama': [(s) => `There you are, dear! I have not seen you since ${s}.`],
  'home-papa': [(s) => `Look who it is! Not since ${s}.`],
  partner: [(s) => `I missed you. Not since ${s}!`],
};

/** A family that took a gift from the player or its family remembers it (trust is kept for the family, from life to life). */
export const THANKS: Record<NeighbourKind, readonly string[]> = {
  mama: ['You and yours have been kind to us. Thank you.'],
  papa: ['That food your family brought was good. Thank you.'],
  kit: ['Your family brings yummy food! Thank you!'],
};

/** A beaver the player dug out of the snow in this life remembers it. Only a mama or a papa gets stuck. */
export const RESCUED: Record<NeighbourKind, readonly ((w: Who) => string)[]> = {
  mama: [(w) => `You dug me out of the snow! I am ${w.name}${from(w)}.`, () => 'I will never forget the day you dug me out.'],
  papa: [(w) => `My rescuer! I am ${w.name}${from(w)}.`, () => 'I still feel the cold of that drift. Thank you.'],
  kit: [() => 'You saved my mama! Thank you!'],
};

/** A beaver an earlier life of the family dug out of the snow. */
export const KIN_RESCUE: Record<NeighbourKind, string> = {
  mama: 'Your family dug me out of the snow once. Thank you.',
  papa: 'Your family dug me out of a drift once. I do not forget.',
  kit: 'Your family saved my mama once!',
};

/** What Mama, Papa and the partner say about the player's life, each only when it is true (`talk.ts` checks). */
export type LifeFact = 'baby' | 'teen' | 'storeLow' | 'lodgeWorn' | 'damWorn' | 'firstDam' | 'ownLodge' | 'building' | 'noLodge' | 'mate' | 'lonely' | 'kitsSoon';

export const LIFE: Record<'home-mama' | 'home-papa' | 'partner', Partial<Record<LifeFact, readonly string[]>>> = {
  'home-mama': {
    baby: ['Stay close to the lodge, little one.', 'You are growing so fast!'],
    teen: ['Look at you, nearly grown!', 'Soon you will want a lodge of your own.'],
    storeLow: ['The store looks thin, dear. Some branches before the snow?'],
    lodgeWorn: ['The lodge is wearing thin. A log would mend it.'],
    damWorn: ['A dam is wearing thin. Papa says mud will mend it.'],
    firstDam: ['Papa told me about your dam. I am so proud of you!'],
    ownLodge: ['Your very own lodge! I am so proud.'],
    building: ['Your lodge is coming on. A few more logs!'],
    noLodge: ['Have you found a spot for your lodge? Calm water is best.'],
    mate: ['Your partner seems lovely.'],
    lonely: ['A lone beaver lives in the valley. Maybe one is looking for you.'],
  },
  'home-papa': {
    baby: ['One day you will build dams like me.', 'Swim and play. Work can wait.'],
    teen: ['When you are grown, build your own lodge. Start with a good dam.', 'You are strong enough to fell trees now.'],
    storeLow: ['The store is low. Branches now, and winter is easy.'],
    lodgeWorn: ['The lodge needs mending. Bring a log to it.'],
    damWorn: ['One of the dams is wearing thin. A log and some mud will fix it.'],
    firstDam: ['I saw your dam. Fine work!'],
    ownLodge: ['A lodge of your own. Well built!'],
    building: ['Your lodge is getting there. Keep the logs coming.'],
    noLodge: ['A dam first, then a lodge in its pond. That is the beaver way.'],
    mate: ['You two make a fine team.'],
  },
  partner: {
    storeLow: ['Our store is low. Shall we fill it before the snow?'],
    lodgeWorn: ['Our lodge is wearing thin. Let us mend it.'],
    damWorn: ['A dam is wearing thin. Some mud would mend it.'],
    firstDam: ['Your dam holds well. Clever you.'],
    ownLodge: ['I love our lodge.'],
    building: ['Our lodge is coming on. A few more logs!'],
    noLodge: ['Where shall we build our lodge?'],
    kitsSoon: ['Kits come on the first day of spring. I can hardly wait!'],
  },
};

/** "What are you doing?" for a beaver of another family on an errand: one line, or one for what it carries. */
export interface ErrandLines {
  lines: readonly string[];
  carrying?: Partial<Record<Carry, string>>;
}

export const DOING: Record<NeighbourKind, Partial<Record<Errand, ErrandLines>>> = {
  mama: {
    store: { lines: ['I am looking for branches for our store.'], carrying: { branch: 'I am taking this branch to our store.', lily: 'This lily pad goes in our store.' } },
    food: { lines: ['Looking for something to eat.'], carrying: { lily: 'I found a lily pad. The kits love them.', branch: 'A juicy branch for supper.' } },
    kits: { lines: ['Keeping an eye on the kits. They swim everywhere!'] },
    lodge: { lines: ['Patching our lodge. A cosy home is a happy home.'], carrying: { mud: 'Mud for our lodge, to keep it warm.' } },
    dam: { lines: ['Checking the dam. It holds well.'], carrying: { mud: 'Bringing mud for the dam.', branch: 'This branch is for the dam.' } },
    play: { lines: ['Playing with the kits. Mamas need fun too.'] },
    rest: { lines: ['Resting a little. It has been a busy day.'] },
  },
  papa: {
    dam: { lines: ['The dam leaks at one end. I need one more log.', 'Checking the dam. Water finds every gap.'], carrying: { branch: 'This branch goes in the dam. Water finds every gap.', mud: 'Mud for the dam. It stops the leaks.' } },
    store: { lines: ['Filling the store. A full store means a warm winter.'], carrying: { branch: 'Taking this branch to the store.' } },
    lodge: { lines: ['Mending the lodge roof before the cold.'], carrying: { mud: 'Mud for the lodge. It keeps the wind out.' } },
    food: { lines: ['Finding food. A papa gets hungry too.'], carrying: { lily: 'A lily pad for the kits.' } },
    kits: { lines: ['Watching the kits. Somebody has to.'] },
    play: { lines: ['Wrestling with the kits. They always win.'] },
    rest: { lines: ['Resting my tail. Good work needs good rest.'] },
  },
  kit: {
    play: { lines: ['I am playing chase! Catch me!', 'Watch me dive! Splash!'] },
    food: { lines: ['Eating! Lily pads are yummy.'], carrying: { lily: 'Look, my own lily pad!' } },
    store: { lines: ['I am helping fill the store!'], carrying: { branch: 'Look! I am helping Mama with the store!' } },
    dam: { lines: ['I am helping Papa with the dam. Kind of.'], carrying: { mud: 'I have mud for the dam. Splat!' } },
    lodge: { lines: ['Patting mud on the lodge. Splat!'] },
    kits: { lines: ['Staying close to Mama and Papa.', 'I am keeping near Mama. She says so.'] },
    rest: { lines: ['Having a nap. Shhh.'] },
  },
};

/** Why the store matters, by season, after a store line. */
export const STORE_WHY: Record<Season, string> = {
  spring: 'The winter ate it all.',
  summer: 'Never too early for winter.',
  autumn: 'Winter comes fast.',
  winter: 'It is cold, and we are hungry.',
};

/** "What are you doing?" when the beaver has no errand, by what it does. */
export const TASK_DOING: Record<NeighbourKind, Partial<Record<Task, readonly string[]>>> = {
  mama: { swim: ['Just swimming round our pond.'], rest: ['Resting in the sun.'], eat: ['Having a snack.'], gnaw: ['Gnawing a branch. Crunch!'], groom: ['Combing my fur. It keeps me dry.'], build: ['Building. A beaver is never done.'], play: ['Playing with the kits.'] },
  papa: { swim: ['Swimming the pond, checking all is well.'], rest: ['Resting my tail.'], eat: ['Having a snack. Work makes you hungry.'], gnaw: ['Gnawing. Good teeth, good dams.'], groom: ['Combing my fur. A dry beaver is a warm beaver.'], build: ['Building. A beaver is never done.'], play: ['Playing with the kits.'] },
  kit: { swim: ['Swimming! I am really fast.'], rest: ['Resting. Shhh.'], eat: ['Eating! Yum.'], gnaw: ['Gnawing! My teeth are growing.'], groom: ['Combing my fur. Mama says so.'], build: ['Building a tiny dam!'], play: ['Playing! Catch me!'] },
};

/** "What are you doing?" for Mama and Papa out in the pond on an errand (`routines.ts`). */
export const HOME_ERRANDS: Record<'home-mama' | 'home-papa', Partial<Record<Errand, ErrandLines>>> = {
  'home-mama': {
    store: { lines: ['Looking for branches for the store.'], carrying: { branch: 'Taking this branch to the store, so nobody goes hungry.' } },
    food: { lines: ['Finding a snack. Lily pads are best.'], carrying: { lily: 'I found a lily pad. Do you want half?' } },
    lodge: { lines: ['Patting mud on the lodge. It keeps the wind out.'], carrying: { mud: 'Mud for the lodge, to keep it warm.' } },
    dam: { lines: ['Looking over the dam. It must stay strong.'], carrying: { mud: 'Mud for the dam. It stops the leaks.', branch: 'This branch is for the dam.' } },
    kits: { lines: ['Keeping an eye on you, as mamas do.'] },
    play: { lines: ['Having a little swim for fun.'] },
  },
  'home-papa': {
    dam: { lines: ['Checking the dam. Water finds every gap.'], carrying: { branch: 'This branch goes in the dam. Water finds every gap.', mud: 'Mud for the dam. It stops the leaks.' } },
    store: { lines: ['Filling the store. A full store means a warm winter.'], carrying: { branch: 'Taking this branch to the store.' } },
    lodge: { lines: ['Mending the lodge before the cold.'], carrying: { mud: 'Mud for the lodge. It keeps the wind out.' } },
    food: { lines: ['Finding food. Work makes a papa hungry.'], carrying: { lily: 'A lily pad. Good food for a busy beaver.' } },
    kits: { lines: ['Watching over you. Somebody has to.'] },
    play: { lines: ['Just splashing about. Do not tell anyone.'] },
  },
};

/** "What are you doing?" for Mama, Papa and the partner. */
export const HOME_DOING = {
  'home-mama': { nest: 'Resting on the nest, with you near.', young: 'Swimming round our pond, keeping an eye on you.', grown: 'Swimming in our old pond. It is quiet without you.' },
  'home-papa': { nest: 'Resting. Even papas need a nap.', young: 'Checking the pond and the lodge. All is well.', grown: 'Keeping our old pond tidy, as always.', worn: 'Looking at the lodge. It needs a log or two.' },
  partner: { following: 'Following you, of course!', home: 'Keeping our lodge cosy.' },
} as const;

/** "Can I help?" to a family that is wary of the player. */
export const HELP_WARY: Record<NeighbourKind, readonly string[]> = {
  mama: ['Maybe one day. We do not know you yet.'],
  papa: ['Maybe one day.'],
  kit: ['Mama says wait and see.'],
};

/** "Can I help?" to a family that knows the player: a gift put down near them, which they take (`giftFamilies`). */
export const HELP: Record<NeighbourKind, Partial<Record<Errand | 'any', string>>> = {
  mama: {
    store: 'Put a branch down near us. It will go in our store.',
    food: 'A lily pad for the kits would be lovely. Put it down near us.',
    kits: 'The kits love lily pads. Put one down near us.',
    any: 'Bring us a branch or a lily pad, and put it down near us.',
  },
  papa: {
    dam: 'Bring a branch and put it down near us. It will go in the dam.',
    lodge: 'A branch would help. Put it down near us.',
    store: 'A branch for our store would help. Put it down near us.',
    any: 'A branch always helps. Put it down near us.',
  },
  kit: {
    play: 'Bring me a lily pad! Put it down near me!',
    any: 'Bring me a lily pad! Please?',
  },
};

/** "Can I help?" to Mama, Papa and the partner: one true job, most useful first. */
export type HomeJob = 'baby' | 'storeLow' | 'lodgeWorn' | 'damWorn' | 'noLodge' | 'building' | 'lonely' | 'storeRoom' | 'none';

export const HOME_HELP: Record<'home-mama' | 'home-papa' | 'partner', Record<HomeJob, string>> = {
  'home-mama': {
    baby: 'Just swim and play, little one. That is your job.',
    storeLow: 'Fill the store with branches, dear. Winter is long.',
    lodgeWorn: 'Bring a log to the lodge and mend it.',
    damWorn: 'Mend the worn dam with mud or a log.',
    noLodge: 'Build your own lodge. A dam first makes a good pond.',
    building: 'Bring more logs to your lodge.',
    lonely: 'Find a partner. Listen for a tail slap far away.',
    storeRoom: 'Bring some branches for the store. Thank you, dear.',
    none: 'All is well. Go and explore!',
  },
  'home-papa': {
    baby: 'Grow first. Then I will teach you to build.',
    storeLow: 'Branches for the store. That is the job now.',
    lodgeWorn: 'The lodge needs a log. Bring one and press Build.',
    damWorn: 'A dam is wearing thin. Bring mud or a log to it.',
    noLodge: 'Build a dam, then your own lodge in its pond.',
    building: 'More logs for your lodge. You are nearly there.',
    lonely: 'Go and find a partner. Follow the tail slaps.',
    storeRoom: 'The store has room. Bring branches.',
    none: 'Everything holds. Good work.',
  },
  partner: {
    baby: 'Just play, little one.',
    storeLow: 'Let us fill our store before the snow.',
    lodgeWorn: 'Our lodge needs a log. Bring one and press Build.',
    damWorn: 'Mend the worn dam with mud or a log.',
    noLodge: 'Let us build a lodge. Drag a log to the water.',
    building: 'Bring more logs, and our lodge is done.',
    lonely: 'Stay close. That helps.',
    storeRoom: 'Some branches for our store would be nice.',
    none: 'Just stay close. That helps.',
  },
};

/** The answer to "Bye": a short goodbye, then the card closes. */
export const FAREWELL: Record<SpeakerKind, Record<'wary' | 'warm', readonly string[]>> = {
  mama: { wary: ['Goodbye.'], warm: ['Take care, dear.', 'Come back soon!'] },
  papa: { wary: ['Hm. Goodbye.'], warm: ['Mind the foxes.', 'See you on the water.'] },
  kit: { wary: ['Eep! Bye!'], warm: ['Bye bye! Come back soon!', 'See you! Splash!'] },
  'home-mama': { wary: [], warm: ['Off you go, dear.', 'Be careful out there.'] },
  'home-papa': { wary: [], warm: ['Good. Off you go.', 'Keep your tail ready.'] },
  partner: { wary: [], warm: ['See you soon.', 'Do not go too far.'] },
};

/** "Any news?" to a beaver that does not trust the player enough to tell. */
export const NOT_YET: Record<SpeakerKind, string> = {
  mama: 'I have nothing to tell yet. Come by again when we know each other better.',
  papa: 'Maybe another day, when we know you better.',
  kit: 'Mama says I cannot tell you secrets yet!',
  'home-mama': 'Nothing yet, dear.',
  'home-papa': 'Nothing yet.',
  partner: 'Nothing yet.',
};

/** "Any news?" when nothing is true to tell. */
export const NO_NEWS: Record<SpeakerKind, string> = {
  mama: 'Nothing new on the pond today.',
  papa: 'All quiet. The water is calm.',
  kit: 'Nothing! It is boring today.',
  'home-mama': 'Nothing new on the pond today, dear.',
  'home-papa': 'All quiet. Good.',
  partner: 'Nothing new. It is a calm day.',
};

/** Who a speaker is, under its name on the card. */
export const ROLE_WORD: Record<SpeakerKind, string> = { mama: 'mama', papa: 'papa', kit: 'kit', 'home-mama': 'your mama', 'home-papa': 'your papa', partner: 'your partner' };
