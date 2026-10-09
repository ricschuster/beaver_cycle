# Life stages (M6, first slice)

Status: draft for the author's review. Nothing here is built. It covers only the
age of the player beaver. Family beavers, the handover to the next baby, and
other beavers (`13_milestone_plan.md`, M6) come after this slice.

## What the author has said

- A baby takes a year to become a teenager. You can play the whole year, or skip
  ahead (Q47). The teenager stays a year to help at the pond, and then the
  mama and papa say it must start a family of its own (Q8, Q50).
- You can play as a baby, and it starts all over again (Q34).
- The game never ends, and each baby has its own achievements (Q40).
- Teenagers repair the lodge, dams, and food store (`10_variety.md`).

## The numbers that matter

A game year is 40 days (`src/sim/clock.ts`). A day is 8 real minutes, so one year
is 320 minutes, about 5.3 hours. Baby, teenager, and own family is three years,
about 16 hours before any skipping. `09_game_length_and_speed.md` counted 8
hours at the older 4 minute day. So skipping (Q47) is not a nicety, it decides
whether a generation is playable in a few sittings.

## Proposal

### Stages

Three stages, kept as plain data in the sim (a new `src/sim/life.ts`, no DOM and
no three.js, like `clock.ts`):

| Stage | Length | What the player can do |
| --- | --- | --- |
| Baby | 1 year | Stay near the lodge and pond, eat, learn. No felling, no hauling, no building. |
| Teenager | 1 year | Everything a beaver does today, with repair as the main job. |
| Adult | until the next baby | Leaves, builds its own lodge, finds a mate (later slices). |

The beaver today is effectively an adult. Existing games and tests keep working
if a new game starts as an adult unless a flag says otherwise (`?stage=baby`).

### Age

The sim stores `bornAt`, a clock value, and the stage is a pure function of
`clock - bornAt`, the same way `dateAt` is a pure function of the clock. Time in
the lodge runs at half rate (`LODGE_CLOCK_RATE`), so the clock is the one
source and age follows it with no second counter.

### Skipping ahead

An explicit "sleep until" action in the lodge, to the next season or to the end
of the stage. It reuses the day skip that sleeping already needs (Q65). The
stage then changes at a clear moment with a toast, and the list of
achievements for that life carries on.

### Looks

The beaver model scales by stage, about 0.45 for a baby, 0.75 for a teenager,
1.0 for an adult, with the camera distance following. Colour is not part of
this slice. It belongs to the family slice (Q59).

### Rules per stage

- Speed: a baby walks slower and swims slower, a teenager a little slower than an
  adult. Numbers are a first guess to tune by playing.
- Carry weight and chop time follow the stage, so a baby cannot fell a tree.
- Achievements: the existing ten are for an adult life. A new life starts them
  again (Q40), which needs `achievements.ts` to be keyed by life.

## Open questions for the author

1. Is a full year of baby play right at 5.3 hours, with skipping, or should
   the baby and teenager years be shorter than the adult year?
2. What can a baby do besides walk and eat? Learn from the parents, play, or
   follow them? This decides whether the baby year is fun or only waiting.
3. Can the baby leave the pond, or is it kept near the lodge, with a gentle wall
   such as a parent calling it back?
4. Does the teenager year need tasks (repair a worn dam), or is it free play
   until the parents say it is time?
5. Is the age shown to the player (a small bar or a season count), or only felt
   by the beaver growing?

## Built so far

- Step 1 and 2: `src/sim/life.ts`, `bornAt` in the world, the HUD bar, and the
  test menu row.
- Step 3: `STAGE_RULES` in `life.ts`. Speed is 0.5 for a baby and 0.85 for a
  teenager. A baby cannot fell, grab, gnaw food, build, or use the store, and
  stays within 60 m of its lodge. Model scale is 0.45, 0.75, and 1.
- Step 4: sleeping ahead. In the lodge on the nest, at any hour, a panel offers
  "Sleep until next season" and, for a baby or teenager, "Sleep until
  teenager" or "adult". Both wake at dawn. At night the old morning and dream
  choices stay. `sleepUntil` in `state.ts`, `growUpDawn` in `life.ts`.
- Step 5: achievements per life. `newLife` (test menu "New baby") makes the
  beaver a baby again with a clean list. The handover itself, where the baby is
  born and who its family are, is the next slice.
- Small gaps: the camera follows a young beaver closer and lower (the square
  root of its size). Over the last 12 m before the range the baby slows to a
  stop and a toast says "Mama calls you back". There are no parent beavers yet,
  so it is only the voice. The range is still a distance from the lodge, not
  the pond shape.
- Water only: a baby in the water does not go ashore. The step is stopped and
  slides along the shore. A baby that already stands on land can walk, so it
  can reach the water (a baby is born in the lodge, on its own nest, so a new game with `?stage=baby`,
  the test menu Baby button, and New baby all start inside, when a whole lodge
  stands).

## Not in this slice

- Mama, papa, and siblings, and their colours (Q58 to Q61).
- Leaving, the mate, kits, and the new pond (Q63, Q64).
- Other beavers (Q62).

## Steps once the author agrees

1. `life.ts` with stages, `stageAt`, and tests.
2. `bornAt` in the world state, a stage in the HUD and the test menu (set stage).
3. Model scale, speed, and what each stage may do.
4. The skip action.
5. Achievements per life (done).
