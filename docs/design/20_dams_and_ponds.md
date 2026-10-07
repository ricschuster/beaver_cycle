# Dams and ponds

Draft design note. It settles what a dam does, where it can go, and how the pond
behaves, from the round 4 answers (`19_round4_answers.md`, Q67 to Q76). Parts
marked "author" are from the answers. Parts marked "proposal" are mine and need
the author's yes. Wear and repair are in `15_build_and_repair.md` and are not
repeated here. It is for M5 (`13_milestone_plan.md`).

## What the author said

- A dam piles water up behind it into a pond you can see and swim in. You can
  swim in the stream too (Q67).
- The beaver builds a small dam quickly first, then the lodge in the pond (Q68).
- A pond is a safe place away from predators, and where lily pads grow (Q69).
- There is no limit on dams or ponds (Q70).
- A broken dam lets the pond shrink back to how it was. You fix the dam (Q71).
- The game marks where a dam can go, where a stream and a pond meet (Q72). There
  are three such places at first (Q74), and a new pond can create the next spot.
- The first dam is small, bigger ones come later (Q73). A bigger dam needs more
  wood, mud, and rocks (Q75).
- Rocks are everywhere where it makes sense (Q76).

## Proposal: the dam spot

A **spot** is a place where a dam can be built. It is data, not a rule the player
has to guess.

- A spot is a **bed point** (x, z), a **flow direction**, and a **crest height**
  (how high the dam can hold the water above the bed). The dam site scan in
  `tools/dam-sites/` already writes exactly this for the first spots, so it is
  the start of the list, not a throwaway.
- The game marks a free spot with a ring on the water or the bed, only when the
  beaver is near, so the valley stays calm. A gold ring is already "repair"
  (doc 15), so a free spot uses a different look, for example a calm white ring.
- **First spots.** Each play location starts with a few spots from the scan on
  the side streams. The author said three (Q74). Proposal: three per location,
  chosen so the first one is close to the start and has a pond a beaver can
  swim in, and the other two are further up the same stream. Which three is a
  tuning step on a tablet, not a design question.
- **Spots that come later.** A built dam makes a pond. The pond's edge, and the
  streams that run into it, are scanned again for new spots (Q74). So spots are
  found as ponds grow, not fixed up front. The scan runs in the sim at build
  time on the ground heights, over one window, not over the whole valley.
- **No limit** (Q70). Spots only run out where the valley has no more streams.
  The valley floor has none (the rivers are too wide), so ponds stay on the side
  streams.

## Proposal: dam size and cost

One kind of dam with a **level** from 1 to 3, so the first dam is small and later
ones are bigger (Q73) without three separate things to build.

| Level | Crest above the bed | Pond | Cost in wood / mud / rock | Unlocked by |
| --- | --- | --- | --- | --- |
| 1 | 1.0 m | small | 8 / 4 / 2 | start |
| 2 | 1.5 m | medium | 14 / 8 / 5 | a level 1 dam built and kept in good shape |
| 3 | 2.0 m | large | 22 / 12 / 9 | a level 2 dam built |

- The three crest heights are the ones the scan already tries, so a spot has a
  pond size for each level. A spot where only level 1 holds water offers only
  level 1.
- The costs are starting numbers for a tablet, in the same units as the lodge
  (wood units, a long log is 2). They follow Q75: more of everything for a
  bigger dam, wood the most.
- **Raising** a dam to the next level is the same place action as building and
  repair (doc 15). The beaver carries material to the dam and places it. The
  crest and the pond rise as the need falls to zero. There is no menu.
- **Quick first dam** (Q68). Level 1 is cheap enough to finish in one short
  round of trips. The lodge comes after it, in the new pond.
- **Mud and rocks.** Mud comes from the pond floor and bank (Q29), the same as the
  lodge. Rocks lie around on the ground where it makes sense (Q76). Proposal: a
  rock is found on a bank, a shore, or a stream bed, and on steep or stony land
  cover, drawn as a few small rocks, and none in a meadow, a bog, or a lake
  floor. Rocks need no map data beyond the tiles we already have. A pick up is
  the same carry action as a log, one at a time.

## Proposal: how the pond works

The pond is the part of the ground flooded when the dam holds the water at its
crest. It is a **flood fill** upstream of the dam line, as in the scan:

- The pond level is the crest height above the bed. The fill is the ground below
  that level, upstream of the dam. This is the same step the scan already runs.
- The level follows the dam's **condition** (doc 15):

  | Dam | Pond level |
  | --- | --- |
  | Good | Full crest height |
  | Worn | Sags toward the stream, a little lower each day it stays worn |
  | Broken | Drains to the stream level over a few game days (Q71) |

  A broken pond "gets smaller like it was before" (Q71), so it ends where the
  stream was, never worse, and fixing the dam brings the pond back up. Nothing in
  the pond is lost. Lily pads and food in a store stay, but a draining pond may
  leave a store or a lodge door in shallows, which is the gentle cost.
- The pond rises and falls slowly, over days, never in a jump, so the game
  clock does the work and a sleep or a generation away simply moves the clock.
  That is the same idea as wear (`src/sim/wear.ts`): store the dam's condition at
  a clock time, and compute the level at any later time.
- **Water is not simulated.** The level is a number per dam and the extent is a
  flood fill, so there is no flow, no spill, and no flood that surprises the
  player. A pond never rises above the crest and never floods a lodge from
  outside.
- **Two dams on one stream.** A second dam upstream of a first one makes its own
  pond. Proposal: the scan drops a spot whose pond would touch another pond's dam
  line, the way it already drops ponds that touch the window edge, so ponds
  never merge.

## Proposal: what a pond is for

- **Safe** (Q69). A beaver in a pond is safe from predators. The lodge lives in
  the deep part of a pond (doc 15, doc 16). There is no predator in the first
  version, so the game only shows "safe" in how a pond looks and sounds, and
  keeps the rule for later.
- **Lily pads** (Q69). Lily pads need 0.25 to 2.5 m of water (doc 17). A new pond
  floods ground that was bank or stream bed, so it makes new lily water. Proposal:
  pads grow in a pond over some days after the water arrives, not at once, so a
  fresh pond is bare and a mature pond is green.
- **A lodge place.** A lodge spot needs deep water at the door (doc 16). A pond
  made by a level 2 or 3 dam has deep enough water in its middle. A level 1 pond
  may not, and then the first lodge goes where the water allows it.

## Rendering and the terrain

This was an open question in doc 15. Proposal:

- **The ground does not change.** The pond is a water surface drawn at the pond
  level over the existing terrain tiles, clipped to the flood fill. The streamer
  needs no new tile format and no re-cut tile (ADR 0006).
- A pond is a new kind of water next to the lake. The lake level stays fixed, the
  pond level comes from its dam. Both use the same water material.
- The dam itself is a model along the dam line: sticks, mud, and rocks, shown by
  stage (doc 15). A bigger level is a longer and taller wall.
- The pond is part of save data (below), so a pond streams back in at the level
  its clock says.

## Across generations

- A dam and its pond keep aging while another generation plays elsewhere (Q63,
  doc 15). A pond a player returns to may be low or drained. A broken dam is the
  reason to visit.
- A new generation starts in a different pond (Q64). Its first dam is a level 1
  dam at one of its spots, so a new generation also starts small.
- A family can have many ponds (Q70). Nothing caps them, and a pond only costs
  sim work when its tile is streamed in, so far away ponds cost nothing.

## What this means for the code

In `src/sim/`, no DOM, no three.js, no input:

```ts
interface DamSpot {
  id: string;
  bed: { x: number; z: number };
  flow: { x: number; z: number }; // downstream, unit vector
  crests: number[]; // which levels hold water here, as crest heights
}
interface Dam {
  spot: string; // DamSpot id
  level: 1 | 2 | 3;
  pieces: Piece[]; // doc 15, kind 'dam'
}
```

- `Terrain` gives the ground height, so a flood fill for a dam is a pure function
  of the terrain, the spot, and the level. Tests: a known valley holds a pond,
  a wide valley holds none, a level 3 pond holds more than level 1.
- The first spots come from the Python scan, written into the tiles as
  `dam_sites.json` is now. Later spots come from a TypeScript port of the same
  walk and fill, run in the sim on the ground around a new pond. Keep the Python
  scan and the port tested against the same cases.
- The pond level is a function of the dam's condition and the clock, as in
  `wear.ts`. Tests: full when good, lower when worn, drained after the number of
  days when broken, back to full once fixed.
- The `place` action is already the plan in doc 15. A dam needs mud and rock
  added to the wood the lodge uses now.
- Render draws the dam model, the pond surface, and the free spot ring from sim
  state. It never changes them.
- Saves keep the spots found, and each dam with its level, pieces, and condition.

## Build order

1. Dam site data into the game: the first spots for the start location, the free
   spot ring, one level 1 dam (wood, mud, rock as plain piles), no pond yet.
2. The flood fill and the pond surface at the crest height.
3. Wear of the dam and the pond level that follows it. Repair (doc 15).
4. Levels 2 and 3, and new spots from a new pond.
5. Lily pads growing in a new pond, and the lodge in a pond.

Each step is playable on a tablet and small enough for one pull request.

## Decided

- The lodge can go in the lake or in a pond (the author, 2026-10-07).
- Three dam levels is enough (the author, 2026-10-07).

## Open questions

- Which three spots are the first ones for each location? A tuning step, with the
  author on the tablet.
