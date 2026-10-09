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
   player beaver is an adult.
2. **Explore for a partner.** One lone beaver lives in another pond of the play
   area, far enough that the player has to look for it (Q62). Finding it is
   swimming near it, and it answers with a tail slap. Which pond is picked from
   the dam spots or the lake edge, and by the game, so it is the same every
   time for a given start.
3. **Build a home.** The player builds a lodge (as now) in a pond near the
   partner, or in the partner's pond. The partner moves in when the lodge is
   whole. The dam, lodge, and store need repair, as now, and the partner helps
   (Q57).
4. **Kits.** After a season in a whole lodge, a kit is born (Q58). `newLife`
   starts for it, in the new lodge on its nest. The kit's coat is the player's or
   the partner's, so the child looks like a child of the beaver (Q59, and
   `coatOf` gets the parents' coats instead of a hash of the birth time).
5. **The old you is Mama or Papa.** The player beaver is kept, with its coat, as
   one of the two parents the family module draws, and the partner is the
   other. A parent's sex is only a name for the first form (Mama or Papa follows
   which of the two it is, and is not tied to the player's old gender).
6. **The first lodge and its family** stay and get old (Q63). A teenager who
   left can be met again, in another part of the pond (Q60).

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

## Questions for the author

1. Is one partner far away right, or are several beavers about, so the player
   can choose? One is far simpler.
2. Does the partner live in a lodge already (so the player moves in or builds
   next door), or is it a lone beaver without a home?
3. Is the kit's coat the player's or the partner's, picked by chance? Or a mix?
4. How long between the lodge being whole and the kit: one season (10 days)?
5. Can the player move house, or is the first lodge the only one the new baby
   knows? The note assumes the new lodge is the baby's home.
