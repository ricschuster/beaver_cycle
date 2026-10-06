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

Lily pads are in the store's data (`Stock.lily`) but nothing gives the beaver
one yet. Lily pads need a source in the water, which is not built.

## Open numbers

First guesses, to tune on the tablet:

- Capacity: 40 pieces (`STORE_CAPACITY`) for 7 beavers over a winter. No winter
  need is simulated yet, so it is a guess.
- Portions: a branch gives more than a lily pad.
- Lily pads stay in the store until eaten, since they would die outside.

## Not decided

- Where lily pads come from, and when they are picked.
- The wear of the store (doc 15) is not built.
- How the store looks as it fills and as it wears.
- Whether the store has its own repair glow, or shares the lodge's.
