# Achievements

The achievements: the first ten, three for the family (Q38), and three more of the family list in #220. The goal of the game is to finish every task and win every achievement (Q38), and after that
play goes on, with each baby starting its own journey (Q40). So an achievement is never lost, and none can be missed for
good: each one can be won at any time by playing on. Nothing here has a timer, a fail state, or a rival.

The wood achievement (30 trees, Q39) and the three family ones (a mate, kits, the guides, Q38) are the author's. The other
nine, and the three family ones of #220, are proposals for the author to keep, change, or drop.

## Rules for all of them

- An achievement is won once, and stays won (`WorldState.achievements`, `src/sim/achievements.ts`). A toast shows the
  moment it is won (`src/ui/toast.ts`). A game loaded with some already won gives no toast.
- It is checked from state in `step`, by one rule per achievement, in `achievements.ts`. Rules are plain functions of
  the world, so they are easy to test.
- Per baby (Q40): `newLife` in `state.ts` starts the list and the counters again. `WorldState.journey` holds where the life
  started: the clock, the trees already felled, and the buildings earlier lives left (`inherited`). Those win nothing,
  since the new baby did not build them (Q63). Trees and "a full year" count from the start of the life.
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

## The family three (Q38)

The author's tasks were "get a mate, have kits, find the guides" (Q38). Built once partners, kits, and the rescue were in the
game (`23_leaving_and_next_baby.md`, `27_families_and_dialog.md`).

| Id | Name | Won when | Counted from | New state |
| --- | --- | --- | --- | --- |
| `mate` | Mate | A partner lives in the lodge | `mateOf(partners)` | none |
| `kits` | Kits | A kit is due: the first day of spring after the partner moved into a whole lodge | `kitDue` | none |
| `guide` | Guide | A stuck beaver is dug out of the snow in this life, and so becomes a guide | `world.rescued`, the year in each id | none |

- **Mate** is a partner that moved in, not one that only follows: a follower goes back to being alone when the player meets
  another, and moving in is for good. A kit's life starts with no partners (`birth`), so it finds its own.
- **Kits** is won on the step the kit is due. The player then plays the kit, whose list starts empty (Q40), so the step that
  wins it holds the birth for one step (`step.ts`): the old life's list has it for a frame, and its toast shows before the
  kit's own journey starts. It is never in the list of the life being played after that, which is how per life lists work.
- **Guide** is the reading chosen for "find the guides": a rescued beaver is the one that becomes a guide (Q20 to Q22,
  Q51), so finding a guide is digging one out (`rescue` in `escort.ts`). One rescue is enough. Another reading would be
  asking a guide to show the way once; the author can change it. A rescue's id ends in the year of its winter, and a kit is
  born on the first day of spring, so a rescue in the year the life started or later is this life's (`rescuesThisLife`, the
  same reading the talk uses for "You dug me out"). A rescue by an earlier life does not count. Old saves need no change:
  the rule reads `rescued` and `partners`, which saves already keep.

## Three more of the family (#220)

The issue's family list was "a mate, kits, raise a kit to a teenager, meet a teenager who left, welcome a visitor who noticed
a scent mound, hand a dam or lodge down". Mate and Kits are above. These three read what the game already keeps, with no new
saved state, so old saves need no change (`met`, `formerHomes`, `parentCoats`, `dams` and `journey` are all saved).

| Id | Name | Won when | Counted from | New state |
| --- | --- | --- | --- | --- |
| `grownUp` | Growing up | A life that began as a baby is a teenager | `stageAt(journey.start, bornAt)` and `stageAt(clock, bornAt)` | none |
| `visitHome` | Visit home | After leaving home, a talk with Mama or Papa at the home this life grew up in | `met`, `formerHomes`, `parentCoats` (`visitedHome`) | none |
| `handDown` | Hand down | A kit is due while a dam this life built stands whole (or is being raised) | `kitDue`, `dams`, `journey.inherited` | none |

- **Growing up** is the reading of "raise a kit to a teenager". The player plays the kit (note 23), and Mama and Papa raise
  it, so the kit that grows up is the player's own life: it began as a baby (born as a kit, `?stage=baby`, or New baby) and
  has reached the teenager stage. The first life of a game that starts as an adult never wins it, and nor does one moved on
  by the test menu's stage buttons from the start. A sleep until teenager wins it like playing the year does.
- **Visit home** is the reading of "meet a teenager who left" (Q60: a teenager who left can be met again, with Mama and Papa
  in another part of the pond). The player is the teenager who left, so the meeting is the player swimming back and talking
  to Mama or Papa at its old lodge (`formerParentsAt`). Their ids carry the place of that lodge (`formerParentIds`), so a talk
  while still at home does not count. The home is the former home whose parents are this life's parents, so a kit that
  talks to its grandparents at an older home does not win it; it wins it at its own old home once it has left. `met` starts
  again with each life, so it is won again by each life that visits.
- **Hand down** is the reading of "hand a dam or lodge down". The lodge always goes to the kit (a kit is only born in a
  whole lodge, which the life built after leaving home), so the lodge alone would be Kits again. The dam is what makes it
  its own: when the kit is due, a dam this life built stands whole, or is being raised a level (a dam is raised only when
  whole). A dam an earlier life left does not count (`journey.inherited`). The kit then has the lodge and the dam as
  inherited. Like Kits, the birth waits one step when anything was won in that step (`step.ts`), so its toast shows. It
  is a moment, not a count: a life whose kit comes while it has no whole dam of its own does not win it, and its kit can.

Not built, since the game has nothing to see it by:

- **Welcome a visitor who noticed a scent mound.** There are no scent mounds and no visitors. The author's answer (Q30, Q62)
  is that a visitor notices the scent mounds and then a new beaver lives nearby, but the beaver cannot make a scent mound,
  no beaver ever comes to the player's pond (note 28 leaves "should neighbours ever visit" open for the author), and no new
  family ever moves in. It waits for scent mounds and visitors to be designed and built.

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
- Mate: "Mate achievement: a partner lives in your lodge"
- Kits: "Kits achievement: a kit of your own"
- Guide: "Guide achievement: a beaver you dug out shows the way"
- Growing up: "Growing up achievement: from baby to teenager"
- Visit home: "Visit home achievement: you met your family again"
- Hand down: "Hand down achievement: your kit gets your lodge and dam"

## What the HUD shows

Now: the wood count up ("12 of 30 trees felled") and then the achievement. For ten achievements this does not scale in
the carry HUD line, which is already long. Proposal: an achievements panel in the test menu first (a list with won and
not won), and a proper screen in the art pass (#105). Counting up stays in the carry HUD only for wood.

## Decided and built

The author agreed on the list, and on these three points:

- **Home** is not won by the test lodge the game starts with. The start marks it won without a toast, so it shows only
  when the beaver finishes a lodge (`?lodge=0` for a new game without the test one).
- **A list of the achievements** is in the test menu (`achievementLines`), with the count for wood, water gardener, and
  hauler. A proper screen waits for the art pass (#105).
- **The family and guide achievements** (Q38) are built: Mate, Kits, and Guide, above. Which moment each one is won at
  (a partner moved in, the kit due, a rescue) is a first reading for the author to keep or change.
- **Three more of the family** (#220) are built: Growing up, Visit home, and Hand down, above, as first readings too. The
  visitor and the scent mound is not built.

Built in `src/sim/achievements.ts`: one rule per achievement, checked each step by `tally`. Counters in `WorldState`:
`padsPicked`, `mended`, `hauled`. `DamSpot.found` marks a spot a pond found. A piece counts as mended when it was worn
below 0.99 and is back above 0.999 (wear falls a little every tick), so a dam raised a level is not a mend. Not tried on the
tablet.

## The neighbours batch (#568)

Built: three more, reading state that is already saved (`met`, `rescued`, `generation`), so old saves need no change.

| Id | Name | Won when | Counted from |
| --- | --- | --- | --- |
| `neighbour` | Good neighbour | The player talked to beavers of 3 different families in this life | `met`, the family part of a `family:cx:cz:...` id (`familiesMet`) |
| `rescuer` | Rescuer | 5 stuck beavers dug out in this life | `rescuesThisLife` |
| `generations` | Long line | The life is the third after the first (`generation >= 3`) | `generation` |

Guides, partners and the parents of a former home are not neighbours: only beavers of the valley's families count. `met`
starts again with each life, so each life meets its neighbours afresh. Long line is won on the first step of the life at that
generation, so each later life wins it too. Generation 5 and 10 wait for tiers (#569).

Not built, since the game cannot see them: **Raised a kit** (a kit of this life becoming a teenager while this life still
lives in the lodge) and **Big family** (two kits in a litter, or kits in two springs). The player becomes the kit the moment
it is born (note 23), so a life never has a kit that is growing up, and a life has one kit. Growing up already is the kit's side.
They would need the parent to stay in play, or a litter, which is a design change for the author to decide.

## Next batch (#220, ideas agreed)

Ideas from session 134, kept or dropped by the author. Nothing here is built. Each one reads what the game already keeps, or
needs one small event counter like `padsPicked`. Numbers are first guesses for the tablet.

First, in this order of interest:

- **Raised a kit** (the parent's side of Growing up): a kit of this life becomes a teenager while this life still lives in the
  lodge. Needs the kit's birth time and stage, which the family state keeps.
- **Good neighbour**: talk to beavers of N different families (`met`).
- **Rescuer**: dig out 5 stuck beavers (`rescuesThisLife`; Guide asks for one).
- **Many generations**: reach generation 3, 5 and 10.
- **Tiers** (bronze, silver, gold) for the counting ones, such as wood 30, 100, 300, instead of more ids.
- **A progress screen** with bars ("17 of 30 trees") and locked ones as silhouettes, in the art pass (#105).

Then the cheap counters from the issue: diver, Almsee explorer, tail slap (10), well fed (25 pieces), stripper (50 branches),
winter store (half full going into winter), many dams (3 whole at once), big pond. And from the systems the game has now:
fixer-upper (10 mends), animal friend (each ambient kind once), pond life (N kinds of guests), four homes (a dam or lodge in
each location), big family (two kits in a litter or in two springs), sweet dreams (the first dream), long winter (a winter
with the store never empty).

Dropped by the author: a **close call** achievement (escaping a predator, which needs a new event) and a **never idle**
streak (it adds pressure to a calm game).

Not buildable yet: **welcome a visitor who noticed a scent mound** (see above, there are no scent mounds or visitors).

## Not decided

- More achievements, and a screen for them: see the issue "Later: more achievements".
