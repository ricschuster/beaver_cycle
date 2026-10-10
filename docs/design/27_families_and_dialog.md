# Other families and dialog between beavers

Design note, session 74. It answers open question 2 of [24_npcs_and_animals.md](24_npcs_and_animals.md) (#276: how the
player interacts with other beaver families) and adds dialog between beavers, which the author asked for. Status: the family
interactions are agreed with the author (greet, gifts, partner framing, rescue later, no shared dams). The dialog is a draft
proposal; the author answered its open points in session 74 (see "Decided" at the end). All four slices are built (see "As built").

## Family interactions (agreed)

| Interaction | Decision |
| --- | --- |
| Visit and be greeted | Built first. A family notices the player coming near and reacts by trust. |
| Gift a branch or a lily pad | Built first. Same drop-near gesture as for animals (#307); the family accepts and trusts more. |
| Partner from a family's teenagers | Framing only. The lone beavers (`partners.ts`) are the grown kits of a neighbouring family who left. No new rule. |
| Rescue a stuck family member | Later, with the stuck guides (Q20 to Q22, Q53). The stuck beaver is a named member of a family the player knows. |
| Share a dam | Not built. It would break "a family keeps its home up", for little gain. |

### Trust

Trust is 0 to 1 per family, kept in the same place as the animals' trust (`world.trust`, keyed by the family id; see
`moods.ts`). A family starts wary at 0.1. Below 0.3 it keeps its distance (about 14 m), from 0.7 it is curious: the kits come
to look and the parents stay near. A gift raises trust (first guess +0.3, as for animals), a tail slap within 30 m lowers it
(-0.25). Nothing is ever lost: a wary family is only shy, never hostile (Q2, no losing).

### As built (session 74, #342)

Code: `src/sim/familyMoods.ts`, wired in `src/main.ts`. Numbers are first guesses to tune on a tablet.

- A family starts at trust 0.1 (wary). `reactFamilies` places the family's beavers for the frame: wary ones keep 12 m from the
  beaver, and a curious family's kits swim part of the way to 4 m from it (from 25 m). A move that would leave the water is not made.
- A branch or lily pad put down within 12 m of a family's beaver is taken, and trust rises by 0.3. A rock or mud is left.
- A tail slap within 30 m costs the family 0.25. Trust is kept in `world.trust` under the family id, so it is saved.
- The first time a family comes within 20 m, a toast greets the player by mood. The manual has a paragraph.
- Names (#343, `src/sim/names.ts`): each family beaver has a `name`, a pure function of its id from a list of 40 nature names, and a family is called for where its pond lies from the home, such as "north pond" (`pondName`).
- Talk (#344, `src/sim/talk.ts`, `src/ui/talkBubble.ts`): within 6 m of a beaver (a neighbour, the player's Mama or Papa outside the
  lodge, or a partner that is not alone), a card at the bottom says "Press Build to talk to Willow". Build starts the talk when
  `buildIsFree` (not in the lodge, no log or load, not at the store, not at a dam spot). The beaver says one line for 7 s, picked by
  `pickLine` from its kind, feeling (a neighbour's mood, always curious for the player's own), season, night and a counter. A wary
  neighbour only warns. The card is fixed at the bottom, not a bubble over the head, since the renderer gives no screen position yet.
  Walking 12 m away ends it. A baby cannot work, but it talks to Mama and Papa from day 1, in the lodge too (the author's answer; siblings once they exist). Neighbours and partners wait until it can work.
- Choices, hints, overheard talk (#345, `src/sim/news.ts`): each line comes with two buttons, "Any news?" and "Bye" (now up to three that fit the moment, see "Natural talk" below). News is read from the
  world and is always true: the nearest lily pads within 90 m (compass and distance to 10 m), a predator within 100 m, a dam or the
  lodge that is worn, a low store (under 10 meals) in autumn and winter, and the nearest lone beaver. Only a beaver that trusts the
  player (a curious family, or the player's own Mama, Papa and partner) tells; a calm one says to come back later. Overheard talk: once
  in a slot of a twelfth of a game day, if two beavers of a family are within 30 m, one calls the other by name (a toast), about half the
  slots. The same slot gives the same call.
- The rescue (#346, `src/sim/escort.ts`): in winter, in one winter in two for each family that is not wary (trust 0.3 and up), its mama
  or papa is stuck in a snowdrift on dry ground 9 to 18 m from its lodge (the same spot each time). A toast tells the player when it
  comes within 45 m, with the pond's name. Holding Gnaw within 3 m, standing still, for 4 s digs it out: the winter's drift goes into
  `world.rescued`, the member into `world.guides`, and the family trusts the player 0.3 more. A freed guide swims in its pond again, and
  talking to it adds the reply "Show me the way". Then `world.escort` (not saved) has it lead at 6 m/s to the nearest lone beaver if the
  player has no mate, else the nearest free dam spot over 20 m away, else home; it waits when the player is 14 m behind, gives up at
  70 m, and stays 15 s at the goal. Drawn: a white mound (renderer) with the beaver sunk in it. Q52 also names fighting off predators;
  only the snow is built. Numbers are first guesses.
- Natural talk (session 77, `src/sim/talk.ts`, all lines in `src/sim/talkLines.ts`): a beaver remembers the player. `world.met`
  keeps, by speaker id, how many talks and the clock of the last one (saved; an older save starts with none, no version bump; a new
  life starts with none, as nobody has met the baby). The first time, a neighbour says who it is ("Hello. I am Willow, from the north
  pond."), after that it is glad to see the player again, and after a season away it says "I have not seen you since the snow". A
  family that took a gift thanks "you and yours", and a guide remembers the rescue ("You dug me out of the snow!" when this life did
  it, else "Your family dug me out"). Mama, Papa and the partner speak of the player's life, each line only when true: a baby is told
  to play, a teenager that a lodge of its own comes soon, a grown beaver is asked about its lodge or praised for it, the first whole
  dam of this life is praised, and a low store in autumn and winter, a worn lodge or dam is named kindly. After the greeting come at
  most three replies, "Bye" always last: "What are you doing?" (from the beaver's errand and task, and what it carries, with a reason
  such as "Winter comes fast"; without an errand it says it is swimming or resting), "Any news?" (as before, in the beaver's voice),
  "Can I help?" (a family asks for a branch or lily pad put down near it, which `giftFamilies` rewards; a wary one says "Maybe one
  day"; Mama, Papa and the partner name the most useful true job), and "Show me the way" for a guide. A question is not offered twice,
  after two questions only "Bye" is left, and "Bye" gets a short goodbye before the card closes (3 s). The same beaver does not say the
  same line twice in a row. The card shows who the beaver is under its name ("papa of the north pond", "your mama") and fades in and
  out. The errand and task come from the families' routines when they give them (`task`, `errand`, `carry` on a neighbour beaver), and
  are left out when not known.

## Dialog between beavers (proposal)

Beavers do not talk like people, and the game is for children from 8 (the manual). So dialog is short, gentle, and
optional. It is a few lines in a speech bubble, never a wall of text, and it never blocks play.

### Who talks to whom

- **Player and a family member** (mama, papa, kit of a neighbour family). The main case.
- **Player and Mama or Papa** at home. They already say "it is time to start a family of your own" (a toast). Dialog gives
  them more to say about the day, the season and the lodge.
- **Player and a partner** once they follow the player.
- **Between the beavers themselves**, overheard. A mama calls a kit, two kits chatter. No reply from the player, just life
  around the pond. Cheap, as it only needs two lines drawn above two beavers that are already near.

### How the player talks

- Walk up to a beaver (within about 3 m). The button hint says what a press does here, like the stash: "press Build to talk".
  Build is the button that does "the thing here" (stash, lodge door, mending), so a talk takes it only when nothing else at that
  spot wants it, and the lodge, the store and mending come first. Gnaw is for trees, food, rocks and mud, and Drag for logs and for
  putting a gift down, so a Talk button would crowd the tablet screen. The author wants the buttons looked at as a whole later,
  as not all make sense and a button can change with the circumstances (#341); a talk follows whatever that gives.
- The beaver answers with one line in a bubble above its head. The player never types.
- Where the player may answer, there are **at most 2 or 3 choices** as big buttons, such as "Hello", "Here is a branch", "Bye".
  Most talks need no choice: one line, then the bubble fades after a few seconds.
- Time does not stop and the world goes on, as with the stash (Q17). Walking away ends the talk.

### What they say

Lines are picked by a pure function from the state, so a test can step it and nothing is random from frame to frame:

```text
pick(speaker, listener trust, season, time of day, news, seed) -> line id
```

- **Greeting**, by trust: wary ("Hmm... who are you?"), calm ("Hello, neighbour"), curious ("You are back! Come and see the
  kits").
- **Role**: a kit is cheeky and short, a mama is warm, a papa is practical (dams, logs).
- **News the beaver knows**, from the sim: lily pads are in the bay to the east, a fox was about, the dam is low. Only things
  that are true now, so a line is also a small hint. A high-trust family gives hints; a wary one gives none.
- **Thanks** after a gift.
- **Season and day**: snow, a warm evening, the first kits of spring.

Lines are data (ids and text in one table, one place), so the author can edit them and a language could be added. English only.

### How it is drawn

A DOM bubble in `src/ui/` over the speaker, following it on screen, like the other overlays. The sim stays free of the DOM: it
gives the current line id and speaker, and the UI turns that into text. Each line also has a short squeak or call, once the
game has sound (see "Sound" below).

### Code shape (when built)

- `src/sim/talk.ts`: `pick` and the line table, pure, with tests. Trust changes reuse `moods.ts`.
- `WorldState` gets only what must be saved: nothing for a line in progress (it is for the moment, like a predator meeting, and is
  left out of the save), and the family trust in the existing `trust` record.
- `src/ui/talkBubble.ts`: the bubble and the choice buttons.
- The manual gets a short "Talking" paragraph and the first-steps coach is not changed.

## Slices

1. Family trust, greeting by distance, and gifts. Issue to open.
2. The bubble and one-line replies, for the family members and Mama and Papa.
3. Choices, news-based hints, and overheard talk between beavers.
4. Stuck family members as guides, with the rescue (with Q20 to Q22).

## Sound

The author wants sound in the game (round 2, Q36: rushing water, animal sounds such as birds, and music), and dialog gets a
sound per line. The game has no sound yet, no code and no issue until now (#340). It needs its own note: how sound is loaded and
played in the web stack on a tablet (the browser blocks audio until the first touch), where the files come from and their licence,
a volume setting, and a budget for the tablet. Until it exists, dialog is silent text.

## Decided (author, session 74)

- The button: recommendation accepted, a talk takes Build when nothing else at that spot wants it. The buttons are to be revisited
  as a whole (#341).
- English only.
- A family with high trust gives hints.
- Family members get names, so a rescued guide can be "Willow from the north pond".
- Sound for the lines, which waits for the game to have sound.
