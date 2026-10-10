# Other families and dialog between beavers

Design note, session 74. It answers open question 2 of [24_npcs_and_animals.md](24_npcs_and_animals.md) (#276: how the
player interacts with other beaver families) and adds dialog between beavers, which the author asked for. Status: the family
interactions are agreed with the author (greet, gifts, partner framing, rescue later, no shared dams). The dialog is a draft
proposal; the points marked **Open** wait for the author. Nothing is built yet.

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

- Walk up to a beaver (within about 3 m). The button hint says what a press does here, like the stash: "press Build to talk"
  (**Open:** Build is the stash and lodge button, and Gnaw and Drag are taken; a dedicated Talk button is the other choice, but
  the screen is already full on a tablet).
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

Lines are data (ids and text in one table, one place), so they can be translated and the author can edit them. English first
(**Open:** German as well, since the valley is Austrian and the friends are there).

### How it is drawn

A DOM bubble in `src/ui/` over the speaker, following it on screen, like the other overlays. The sim stays free of the DOM: it
gives the current line id and speaker, and the UI turns that into text. A small sound or a short squeak per line is nice but
optional (**Open**).

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

## Open for the author

- The button that starts a talk (Build or a new Talk button).
- English only, or German as well.
- Whether a high-trust family gives hints, or trust is only felt in how they move.
- Names for family members, so a rescued guide can be "Willow from the north pond".
- Sound: a squeak per line, or silent text.
