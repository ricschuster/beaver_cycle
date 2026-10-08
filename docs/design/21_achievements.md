# Achievements

The first ten achievements. The goal of the game is to finish every task and win every achievement (Q38), and after that
play goes on, with each baby starting its own journey (Q40). So an achievement is never lost, and none can be missed for
good: each one can be won at any time by playing on. Nothing here has a timer, a fail state, or a rival.

Only the wood achievement (30 trees, Q39) is the author's. The other nine are proposals for the author to keep, change,
or drop. The family achievements (a mate, kits, the guides, Q38) wait for M6 and are not in this list.

## Rules for all of them

- An achievement is won once, and stays won (`WorldState.achievements`, `src/sim/achievements.ts`). A toast shows the
  moment it is won (`src/ui/toast.ts`). A game loaded with some already won gives no toast.
- It is checked from state in `step`, by one rule per achievement, in `achievements.ts`. Rules are plain functions of
  the world, so they are easy to test.
- Per baby (Q40): when generations arrive, `achievements` and the counters below are kept per beaver. Until then there
  is one set for the world.
- A goal that counts something (trees, pads, loads) counts what was done, not what stands now, so a worn or lost piece
  never takes it back. Goals that read the world as it is (a whole dam, a full store) are won the moment they are true.
- The numbers are first guesses to feel on the tablet.

## The ten

| Id | Name | Won when | Counted from | New state |
| --- | --- | --- | --- | --- |
| `wood` | Wood | 30 trees felled | `felled.length` | none (built) |
| `home` | Home | The lodge is whole | `lodgeComplete(lodge)` | none |
| `firstDam` | First dam | A dam is whole, at any level | `damWhole` on any of `dams` | none |
| `highDam` | Higher dam | A dam is whole at the top level its spot holds, for a spot that holds level 2 or 3 | `Dam.level` against `maxLevel(spot)` | none |
| `pioneer` | Pioneer | A dam is started at a spot that a pond found (`newSpots.ts`) | a spot's origin | `DamSpot.found?: true`, set by `withNewSpots` |
| `pantry` | Pantry | Every one of the 40 places of the store holds a piece | `stockTotal(store) === STORE_CAPACITY` | none |
| `gardener` | Water gardener | 20 lily pads picked | each pad picked | `WorldState.padsPicked: number`, counted when a pad is picked (a pad that grew back counts again) |
| `handy` | Handy beaver | A worn dam, store, or lodge is mended back to new | the end of a mend (`repairing` turns off, the store or lodge wear returns to 1) | `WorldState.mended: number`, counted at that moment |
| `hauler` | Hauler | 30 loads of mud and rock put down on dams | each mud or rock placed at a dam | `WorldState.hauled: number`, counted in the build step |
| `year` | A full year | The game clock is one year (`DAYS_PER_YEAR`) past the start | `clock - START_CLOCK` | none |

## Notes on each

- **Home** is the lodge toast in every game that starts with a whole test lodge (`?lodge=0` leaves it out). It is won on
  the first frame there. Better: win it only when the beaver finishes a lodge, so a pre-built test lodge gives no toast,
  and the test lodge counts as already won. Decide when building.
- **Higher dam** is not offered at a spot that holds only level 1, since that is First dam again. The HUD already says
  "as high as a dam can go here" at the top level.
- **Pioneer** needs the spot to remember it was found by a pond. `DamSpot` has `rough` for a spot not yet refined, which
  is not the same: it goes when the beaver comes near. A new `found` flag stays.
- **Pantry** is checked as it stands, so a store that wears down and loses places can still be filled again. Winning
  once is enough.
- **Water gardener** uses its own counter, not `picked`, because `picked` holds one entry per pad and forgets a pad picked
  again after it grew back.
- **Handy beaver** is the one the author's repair idea (Q57) points at: repair is the same carry and place action as
  building, so the achievement says the chore was done once.
- **Hauler** counts mud and rock placed at a dam, not dropped on the ground, so it is a measure of building.
- **A full year** reads the clock, which sleep and the lodge rate both move, so a beaver that sleeps through winter still
  gets it. It is the one that cannot be rushed except by sleeping.

## Toasts

Short, in the game's plain voice, no em dashes:

- Wood: "Wood achievement: 30 trees felled"
- Home: "Home achievement: a lodge of your own"
- First dam: "First dam achievement: the stream holds water"
- Higher dam: "Higher dam achievement: as high as it goes here"
- Pioneer: "Pioneer achievement: a new pond opens a new spot"
- Pantry: "Pantry achievement: the store is full"
- Water gardener: "Water gardener achievement: 20 lily pads"
- Handy beaver: "Handy beaver achievement: mended and good as new"
- Hauler: "Hauler achievement: 30 loads on the dams"
- A full year: "A full year achievement: all four seasons"

## What the HUD shows

Now: the wood count up ("12 of 30 trees felled") and then the achievement. For ten achievements this does not scale in
the carry HUD line, which is already long. Proposal: an achievements panel in the test menu first (a list with won and
not won), and a proper screen in the art pass (#105). Counting up stays in the carry HUD only for wood.

## Not decided

- Whether Home should be won by a test lodge (see above).
- Whether a screen listing the achievements and their progress is wanted before M6.
- The family and guide achievements, and their toasts, in M6.
