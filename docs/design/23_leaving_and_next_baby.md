# Leaving home and the next baby (M6, next slice)

Status: the author chose the shape (below); steps 2 to 5 are not built. It follows
`22_life_stages.md`, which has the stages, Mama and Papa, and the coats.

## What the author has said

- When you are done being a baby, mama tells you it is time to start your own
  family (Q8, Q50).
- The game never ends, and each baby starts its own journey (Q34, Q40).
- The dam and lodge from before stay and get old (Q63).
- The next generation starts in a different pond (Q64).
- A teenager who left can be met again, and the parents have moved to another part
  of the pond (Q60, Q61).

## What the author chose

The grown beaver stays in the world, and the next baby is its child:

- **The adult years are real play.** The player explores to find a partner, then
  builds and repairs, and only then are there kits.
- **You play the child of the beaver you were.** The adult becomes the new Mama
  or Papa in the new lodge, and the partner is the other parent.
- **The new pond is swum to as an adult.** The story is continuous: nobody wakes
  up somewhere else.

## Proposed steps

1. **Mama says go (built).** When the teenager year ends, a toast says it is time
   to start a family of one's own, and Mama and Papa are no longer drawn. The
   player beaver is an adult. The lodge it grew up in moves to
   `world.formerHomes` (`leaveHome`): it stays solid and drawn, gets old, and
   cannot be used, and the food store goes with it. The world has no home, so
   building a new lodge is the old flow, unchanged.
2. **Explore for a partner (built, `src/sim/partners.ts`).** One lone beaver lives in another pond of the play
   area, far enough that the player has to look for it (Q62). Finding it is
   swimming near it, and it answers with a tail slap. Which pond is picked from
   the dam spots or the lake edge, and by the game, so it is the same every
   time for a given start. Built as three lone beavers at dam spots at least
   120 m from the old home and 150 m from each other, each with a coat and a
   shade. The one the player comes within 8 m of slaps its tail and follows; meet
   another and that one follows instead, and the first stays where it stood. A
   follower moves into the lodge when it is whole. To try it, press Teenager and
   then Adult in the test menu: the lodge becomes a former home and the beavers
   appear. The shade is drawn.
3. **Build a home.** The player builds a lodge (as now) in a pond near the
   partner, or in the partner's pond. The partner moves in when the lodge is
   whole. The dam, lodge, and store need repair, as now, and the partner helps
   (Q57).
4. **Kits (built).** After a season in a whole lodge, a kit is born (Q58). `newLife`
   starts for it, in the new lodge on its nest. The kit's coat is the player's or
   the partner's, so the child looks like a child of the beaver (Q59, and
   `coatOf` gets the parents' coats instead of a hash of the birth time).
5. **The old you is Mama or Papa (built, with step 4).** The player beaver is kept, with its coat, as
   one of the two parents the family module draws, and the partner is the
   other. A parent's sex is only a name for the first form (Mama or Papa follows
   which of the two it is, and is not tied to the player's old gender).
6. **The first lodge and its family** stay and get old (Q63) (built). Mama and
   Papa stay at the former home with the coats they had, and swim about its pond
   like the parents of a young player (`formerParentsAt`, Q60, Q61), so a
   grown player can swim back and meet them. Their pond may not be one the player
   can swim to when the lodge stood on a lake edge; it is the same water.

## What this changes in the code

- `parentsAt` takes the parents from the world instead of using fixed coats. The
  first family has the two default coats, and later ones the coats of the
  player's old beaver and its partner.
- The world needs a list of lodges and families, or at least the current
  family. Today there is one lodge, and the world has `lodge: Lodge | null`. The
  new home is the second lodge, so "one lodge per world" ends here. Everything
  that reads `world.lodge` (the store, wear, the HUD, the sleep rules) needs a
  "current home" idea.
- The partner is a plain data beaver with a place and a coat, like a parent.

## How kits work in the code (built)

- A coat is a base colour and a shade (`Coat` in `family.ts`). The world has the
  player's `coat`, and `parentCoats` for Mama and Papa (the first family's, then the
  player's and the partner's).
- `kitDue`: the partner is at home, the lodge is whole, the player is an adult,
  and the clock has reached the first day of spring after the partner moved in.
  `step` then calls `birth`: the old player and the partner become Mama and
  Papa in their coats, the baby has the coat of one of them in a shade up to 0.5
  away, is born in the lodge on its nest (`intoLodge`), and the lone beavers are
  done. `generation` counts the lives, and the game shows a toast.
- A partner who moves in on day 39 gives a kit the next morning. The author said
  there is no minimum wait: the first day of spring it is.
- Nudges so the player meets a partner in time: the nearest lone beaver is always
  the first one seeded (120 m or more from home), and every lone beaver lives at a spot with a lodge site within 300 m, so the
  player can lead it to a lake and build there (#254), an unmet beaver slaps its tail
  every 20 game seconds while the player is within 150 m, with a toast the first
  time. Out of earshot a toast names the compass direction and distance of the nearest lone beaver, every 45 s of play
  (`partnerCue`, #254). A toast at the start of winter says kits are born on the first day of
  spring when no partner lives in the lodge yet. Missing a spring only moves the kit to the next one.
- "New baby" in the test menu is the same without a partner: a kit of the
  current parents' coats.

## Answers (the author)

1. **Several partners.** Lone beavers live in different ponds, and the player
   picks one. Each has its own coat.
2. **A lone beaver, with no home.** It moves into the lodge the player builds.
3. **The kit's coat is a slightly different shade at random** of the parents'
   coats, so a family keeps a look and no two kits are the same. `COATS` as five
   fixed browns is not enough for this: a coat becomes a base colour and a
   random shade (`coatOf` gives a colour, not an index).
4. **Kits are born on the first day of spring** after the lodge is whole.
5. **The new lodge is the baby's only home,** and the baby is restricted as
   before (a 60 m range, water only, the lodge as the centre).

## A way to build it

`world.lodge` stays "the home" and everything keeps reading it. The adult has none
after leaving (`leaveHome`), so the new lodge is built with the existing flow, and
when the kit is born it is the home of the baby. Former homes are in
`world.formerHomes`.
