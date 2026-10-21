# Beaver game fix up: the author's first two lists

Design note, session 156. The author handed in two handwritten pages titled "beaver game fix up #1" and "#2", eleven
numbered wishes. Status: the wishes are the author's own words, the notes under them are my reading and wait for the
author. Numbers are first guesses to tune on a tablet.

## The list, as written (spelling tidied)

| No. | Wish | Where | Issue |
| --- | --- | --- | --- |
| 1 | In the dream, cotton candy bushes and trees, and cotton candy boats to ride on the chocolate river. | Dream | #648 |
| 2 | More rocks in the pond, and trees die in pond water so fewer trees are in the way of the dam and lodge. | Crossed out | none |
| 3 | Rocks respawn after 2 or 3 minutes, and rocks lie on the pond bottom. | Crossed out | none |
| 4 | The dam does not just disappear when mending it. You do not start from scratch. | Waking game | #646 |
| 5 | You can go into the lodge when the pond water is low. | Waking game | #647 |
| 6 | In the dream, build a dam and a lodge, eat candies, chop down trees. | Dream | #649 |
| 7 | In the dream, white chocolate lily pads that you can eat outside the lodge. | Dream | #650 |
| 8 | In the dream, other ponds to play in. | Dream | #650 |
| 9 | Another dream in a veggie garden. The beavers are vegetables, and the player is a mix of vegetables. | New dream | #652 |
| 10 | A golden beaver statue with a piece of wood in its mouth. Touching it gives a super speed boost. | Dream | #651 |
| 11 | In the dream, lettuce trees and a carrot juice river, and a dream bigger than candy land. | New dream | #652 |

Items 2 and 3 are crossed out on the page. They are not built and not tracked.

## The waking game

### 4. Mending a dam

A worn or broken dam is mended with wood, mud, and rock and keeps its level. A broken dam (condition below 0.15) used to be built
again from nothing at level 1, which is the vanishing the author saw. Done (#646): `settled` is gone, so a broken dam is mended
like a worn one, for the units that bring it back to new (about 5 wood units at most since Q78, #706), and the HUD line says "dam broken, mend it".

### 5. Going into the lodge at low water

The lodge entrance is under water, so the beaver dives in, and the water at the door must be deep enough
(`src/sim/lodge.ts`). When the pond sinks (a worn or broken dam, a dry spell) the door is too shallow and the beaver
cannot enter, so it cannot eat, sleep, or hide. The author wants to get in anyway. Proposal: when the water at the door is
too shallow to dive, the beaver walks in over the mud, with the same Do or move-in control, and the lodge looks the same
inside. Built (#647): entry in `build` in `src/sim/step.ts` also lets a walking beaver in when the water at the door is under
`DIVE_MIN_DEPTH`, and the water hole walks it out when the water outside is that shallow. Q79 may still change the rule.

## The dream

The dream is its own small world ([29_dream_candy_land.md](29_dream_candy_land.md)), so everything here lives in
`src/sim/dream.ts`, `src/render/dream*.ts`, and `src/ui/dreamScreen.ts` and never touches the waking game's state.

### Candy land additions (1, 6, 7, 8, 10)

- **1. Cotton candy bushes and boats.** Cotton candy trees exist already. Add cotton candy bushes among the props. Add
  cotton candy boats at the river bank: the beaver gets in with Do and rides along the chocolate river. Needs a rule for
  steering (the stick moves the boat) and for getting out.
- **6. Build and chop in the dream.** Chopping a candy tree, building a small dam and lodge from candy, and eating candies.
  Eating sweets is close to collecting them now (they only count). Chop and build are new rules in the dream sim. Proposal:
  keep them playful and simple, a candy log from a tree, a candy dam across the river, a candy lodge on the bank, with no
  wear and no saving.
- **7. White chocolate lily pads.** Lily pads on the chocolate river that the beaver eats when it swims up, as the
  waking game's lily pads. The author says "outside the lodge", which fits item 6: they float near the dream lodge.
- **8. Other ponds.** More water to play in than the one river. Proposal: two or three chocolate ponds beside the river,
  each with its own lily pads and marshmallow beavers.
- **10. Golden beaver statue.** A golden beaver with a piece of wood in its mouth, found somewhere in the land (new place
  each night). Touching it gives a longer super speed boost than a golden star's sugar rush. Proposal: about 20 s, and the
  statue is found only a few steps off the path so it is a find, not a hunt.

### A second dream, the veggie garden (9, 11)

- **A veggie garden dream.** The garden is a land like candy land with its own props: lettuce trees (11), a river of carrot
  juice (11), beds of vegetables. The other beavers are vegetables (a carrot beaver, a pea, a radish). The player is a mix of
  vegetables, as the candy land player is a rainbow. Tag and hide and seek play as in candy land.
- **Bigger.** The author wants it bigger than candy land (about 160 m across), so something like 240 m. That raises the
  frame rate question on tablets (see #603 and the stress run), so the scene needs the same background shader compile.
- **Which dream.** The author chose: the player chooses. The bedtime panel (`src/ui/sleepPrompt.ts`) has "Sleep until
  morning" and "Dream" today. Proposal: "Dream" asks "Candy land or veggie garden?" with two big buttons, as hide and seek
  asks. Open: does the veggie garden need to be unlocked, or are both there from the start?

## Open questions for the author

1. Item 4: what exactly happens when you mend, does the dam really vanish, or is it the broken dam being built from
   scratch? Should a broken dam be mended for part of the cost?
2. Item 5: is walking into the lodge over the mud at low water what you mean, or should the water in the pond not be able
   to get that low?
3. Items 6 and 8: should the dream lodge and the dream dam stay for the next dream, or are they new every night as the land
   is?
4. Item 10: should the statue be a rare find, or always in the land?
5. Are both dreams open from the start, or is the veggie garden a reward?
6. The empty lines 12 to 15: more wishes to come?

## Not done

Nothing is built. The issues are #646 to #652. Later lists get their own note.
