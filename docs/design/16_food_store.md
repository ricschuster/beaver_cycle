# Food store

Design note, agreed with the author in session 28. It settles where the food
store is, what goes in, and how it is used. Wear and repair of the store are in
[15_build_and_repair.md](15_build_and_repair.md) and are not repeated here.

## What a real beaver does

A beaver keeps its winter food in a cache outside the lodge, under the water. In
autumn it pushes cut branches into the mud near the lodge entrance, and the pile
grows into a mass of branches. When the pond freezes, the family swims out under
the ice, takes a branch, and eats the bark inside the dry room. The room is not
used to store food.

## Decisions

| Question | Answer |
| --- | --- |
| Where | Outside the lodge, underwater, at a fixed spot beside the lodge door. It is placed when the lodge is built. |
| Water depth | The same deep water as the lodge door. One deep area serves both. |
| What goes in | Branches and lily pads (round 2, Q45: lily pads die in winter and must be stored ahead). |
| Carrying | One piece at a time in the mouth, like a log. Swim to the store and drop it in. |
| Capacity | A fixed number, big enough for the whole family of 7 through the winter, with some left over. A worn store holds less (doc 15). |
| Eating | Swim to the store, take a piece, eat it inside the lodge. |
| Empty store in winter | Nothing bad happens (Q17: not eating has no effect). The cost is gentle: food has to be found under the ice or on the bank, which is slower and limited by breath. |

## Lodge entrance change

The lodge spot check used to ask only for deep water somewhere within 6 m. The
door could then open onto shallows, which made it hard to dive in. A lodge spot
now needs at least `DOOR_MIN_DEPTH` (1.2 m, a little over the dive minimum of
1 m) at the door and `DOOR_RUN` (3 m) further out along the same heading. The
door faces the best heading found. The run is the way in and the place for the
store.

Near the start the shore is shallow, so the test lodge moved from 132 m to
144 m away. A depth of 1.5 m found no spot within 300 m.

## How it works in the game

Built in session 28. The sim is in `src/sim/food.ts`, the heap is drawn by
`src/render/storeView.ts`.

- The store lies `STORE_DISTANCE` (about 4.4 m) from the lodge's centre toward
  the door, once the lodge is whole. It is a heap of branches on the lake bed
  that grows as it fills, and a few sticks mark it when empty.
- **Branches come from felled logs.** Pressing Gnaw next to a log, with no tree
  to gnaw and nothing in the mouth, strips one branch into the mouth. A log
  gives one branch a metre of its length (4 or 6), then it is bare.
- **Drop in:** Build at the store (within 3.5 m, at the surface or diving) puts
  the piece in. A full store keeps the piece in the mouth.
- **Take out:** Drag at the store with an empty mouth takes a piece, branches
  first. A beaver with a piece in its mouth cannot take hold of a log.
- **Eat:** inside the lodge, Gnaw eats the piece in the mouth. Eating only
  counts (`eaten`), as not eating has no effect (Q17).
- The HUD shows the piece in the mouth, the store as "12 of 40", and what a
  press would do here.

- **Lily pads** (`src/sim/lily.ts`, `src/render/lilyView.ts`; the clusters are
  the author's call from session 30, the numbers are my defaults): green discs
  float in patches, like a bay full of them. A patch is 7 to 15 m from its
  centre, thick in the middle and thin at the edge. About 7 in 10 cells of 40 m
  hold a patch, but only where the water at its centre is 0.3 to 2.5 m deep, so
  patches lie in shallow bays and not on steep banks. The same places every
  time, nothing saved. Gnaw within 1.8 m of a pad, at the surface or on foot,
  with an empty mouth, picks it into the mouth. It goes in the store and is
  eaten like a branch. They die back in winter (Q45) and a picked pad grows
  back the next year (`WorldState.picked`).
- Session 30 fix: the first version used 0.6 m as the least depth and spread
  pads evenly, and the lake near the start is steep, so none lay within 100 m
  of the start. With patches and 0.3 m the nearest lie about 90 m away.

## Open numbers

First guesses, to tune on the tablet:

- Capacity: 40 pieces (`STORE_CAPACITY`) for 7 beavers over a winter. No winter
  need is simulated yet, so it is a guess.
- Portions: a branch is worth 2 meals and a lily pad 1 (session 34, #155). The note below
  has the stash that makes the difference matter.
- Lily pads stay in the store until eaten, since they would die outside.

## Not decided

- How many pads a year the lake gives, and whether the lake near the lodge has
  a bay for them.
- The wear of the store (doc 15) is not built.
- How the store looks as it fills and as it wears.

## The stash (session 34, the author's decisions)

Answers #155 (should branches and lily pads differ). They do, and the player picks
which one to take, so the store becomes a place you open, like a chest in
Stardew Valley.

Decided by the author:

- A branch and a lily pad have **different effects**, and a branch is worth 2 meals
  against 1 for a pad.
- The store has **fixed places** (`STORE_CAPACITY`, 40), each holding one piece or
  empty. A piece goes in a place and comes out of it.
- **Every visit opens the stash.** At the store, pressing Build or Drag opens it
  whether the mouth is full or empty, and the beaver chooses what to do. Nothing is
  put in or taken out without opening it.
- The heap on the lake bed **shows pads and branches differently**, for example
  green on top of brown, in the share the store holds.
- The repair glow shows **just outside the lodge, not inside**, and the **store keeps
  its own glow** as it has now. The wear rates stay as they are.
- A broken store holds nothing: what was in it is gone and food is stored again
  after the rebuild (`15_build_and_repair.md`).

### How it works

- A DOM overlay in `src/ui/`, in the form of a chest screen. The top is the store as
  a grid of 40 places, five a row. Under it is the mouth, one place for the piece the
  beaver carries. Branches are drawn as small sticks and pads as green discs.
- Tap a filled place with an empty mouth: the piece goes to the mouth. Tap an empty
  place with a piece in the mouth: it goes in that place. Tap a filled place with a
  full mouth: the two swap. The panel stays open until the player closes it, so
  several pieces can be moved in one visit.
- Places lost to wear show greyed and cannot be used. A broken store opens grey and
  empty.
- The panel shows the pieces and the meals, for example "12 of 40, 18 meals".
- The sim stays free of the DOM. The store becomes a list of 40 places (a food or
  empty), and the player's choice arrives as plain data in `src/actions/`, for example
  "put the mouth piece in place N" and "take place N". The renderer draws the heap from
  the share of branches and pads.
- The world is paused to the extent that the beaver does not move while the panel is
  open, but time is not stopped, since the world keeps its clock (Q17).

### Not decided

- **The two effects.** Nothing eats from the store yet, so there is nothing to
  attach them to. A starting idea, to confirm: a branch is a full meal, and a pad
  is a light one with a small extra, such as a short burst of swim speed. Needs the
  author's call when eating gets an effect.
- When a worn store loses places, what happens to the pieces in them. Consistency
  with a broken store says they are lost. A gentler choice keeps them locked until
  the store is mended.
- Which input opens the stash on a tablet, since Build and Drag are both on the
  screen: either one at the store, as written above, is the starting point.
