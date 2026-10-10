# Living beavers

Design note, session 77. The author asked for the other beavers to feel alive: to have their own reasons to do things, and
to talk in a way that feels natural. This note says what that means here and how the work is split. It builds on
[24_npcs_and_animals.md](24_npcs_and_animals.md) (the families) and [27_families_and_dialog.md](27_families_and_dialog.md)
(trust, talk, news, the rescue). Status: proposal by me, built in three parallel slices; numbers are first guesses to tune
on a tablet.

## What was missing

- A family beaver drifts between random spots of its pond every eighth of a day, always swimming. It never gnaws, carries,
  builds, or eats, so it has no visible reason to be where it is. Mama and Papa at home do the same.
- A talk is one random line from a small pool and the same two buttons. The beaver does not know the player from one talk to
  the next, and never says what it is doing.
- An overheard call is one line with no answer. Families do not hear about the player from each other, and the partner is silent.

## The idea: errands with a reason

Every beaver has an errand at each moment, and the errand has a reason the player can see and ask about:

| Errand | Who, mostly | What you see | Why, in its own words |
| --- | --- | --- | --- |
| dam | papa | swims to the shore, gnaws, brings a branch to the dam | the dam leaks, the pond must stay deep |
| store | mama, teens | gathers branches in autumn, carries them to the lodge | winter is coming |
| lodge | papa, mama | pats mud on the lodge | a warm, safe home |
| food | everyone | eats lily pads or bark | hungry |
| kits | mama | calls or leads the kits | keeping them safe |
| play | kits | chases a sibling, dives | being young |
| rest | everyone | rests by the lodge, grooms | a long day |

The rules that keep this cheap and calm:

- **A pure function of the clock**, like the families' places now. Nothing is stored, so a sleep or a long skip needs no
  catch-up, and only beavers near the player are worked out. No save change for the routines.
- **Errands have phases** (go, work, bring back), so the player can watch one from start to end.
- **A family moves as a family**: kits stay near mama, and two beavers sometimes meet at one spot.
- **The player's trust still wins**: a wary family keeps away and curious kits come to look, over any errand.

## Talk that remembers

- A beaver remembers how often it has talked with the player, and what the player did for its family (a gift, a rescue). A
  first meeting, a return, and a long absence sound different. This small record is saved.
- "What are you doing?" is answered from the errand and its reason. "Can I help?" names something true the player can do now,
  such as putting a branch by the lodge of a family that fills its store, which the gift rule already rewards.
- At most three choices, and "Bye" is always one. A talk is two or three exchanges at most. Lines never claim what is not true.

## Life among themselves

- Overheard talk is a call and an answer, by role, errand, and season.
- Families talk about the player: kindly after a gift or a rescue, in a whisper while still wary.
- Word gets around: a gift or a rescue for one family raises the trust of the other families the player has met a little
  (about a third of the direct gain). Trust never falls below the start (Q2, no losing).
- The partner remarks now and then on what is near while following (a free dam spot, lily pads, nightfall), and on the home
  once moved in. Rare enough not to nag.

## Slices

1. Routines and errands, drawn with poses and carried items (`src/sim/routines.ts`, `neighbours.ts`, `family.ts`, the renderer).
2. Talk with memory, errand answers, and new choices (`talk.ts`, `news.ts` answers, `talkBubble.ts`, the manual).
3. Chatter, reputation, greetings and thanks, and partner remarks (`src/sim/chatter.ts`, `partners.ts`).

Each slice works without the others: talk and chatter read the errand when it is there and fall back to today's lines when it
is not. The "As built" parts go in note 24 (routines) and note 27 (talk and chatter).

## Open for the author

- Should neighbours ever visit the player's pond, or always stay at their own?
- Sound for the lines still waits for the game to have sound (#340).
- A speech bubble over the head waits for the renderer to give a screen position.
