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
- The game marks where a dam can go, where a stream and a pond meet (Q72). The author
  said three such places at first (Q74), changed to six per area in session 38, and a new pond can create the next spot.
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
- **First spots.** Each play location starts with six spots from the scan on the
  side streams (the author said three in Q74 and changed it to six in session 38).
  They are the swimmable ponds nearest the start, at least 150 m apart. Which six
  is a tuning step on a tablet, not a design question.
  The scan drops a site whose level 1 pond does not lie on the drawn stream (at least 30 percent of
  its cells within 5 m of the line, and half of the upstream line points inside it), because the 5 m
  terrain can fill a basin beside the line. The cell share is low on purpose: a wide basin that holds the whole
  upstream line still has most of its cells more than 5 m off it, while a pond beside the line misses the line
  points. Swept on the 174 ungated sites (0.5 to 0.3 gives 74 to 97 sites, east-oedseen 1 to 3 first spot candidates). The tile build snaps the stream lines to the
  channel first ([ADR 0010](../decisions/0010-snap-streams-to-the-channel.md)), so most sites pass.
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

1. Dam site data into the game: the first spots for every location, the free
   spot ring, one level 1 dam (wood, mud, rock as plain piles), no pond yet.
2. The flood fill and the pond surface at the crest height.
3. Wear of the dam and the pond level that follows it. Repair (doc 15). Done.
4. Levels 2 and 3 (done, see step 4 below), and new spots from a new pond.
5. Lily pads growing in a new pond, and the lodge in a pond.

Each step is playable on a tablet and small enough for one pull request.

## Built so far (step 1, dam spots)

- `src/sim/damSpots.ts`: the `DamSpot` data, `firstSpots` and `spotsNear`. The first
  spots of a location are the six (the author, session 38, instead of the three
  in Q74) nearest the start that hold a pond of at least
  600 m2 and 1 m deep (a swimmable pond, Q67), at least 150 m apart.
- `src/render/spotRing.ts`: a calm white ring on each first spot, shown within
  120 m of the beaver.
- The core spots are on side streams 1.0 to 1.5 km from the start, since the scan
  finds nothing on the valley floor. The other areas have a first spot close to
  their start (below). Tune on the tablet.
- Start places (the author, session 38): the core start stays where it is. Every
  other location starts on dry, gentle ground within 200 m of a qualifying dam
  spot (`spawnNear`), moved there when you jump to the location. North, south, and
  east-oedseen anchors were 330 to 460 m from the nearest spot, so those move.
  Vorderer and Hinterer Springbach already had one within 200 m. The nearest
  qualifying spot is always the first of the six, so the start is near a first spot.
- Number of dams per area: six first spots per location, then no limit (Q70). The
  scan found 295 sites, 132 of them swimmable ponds: core 23, north 31, south 21,
  Vorderer Springbach 19, Hinterer Springbach 32, east-oedseen 6. All six areas
  give six spots at 150 m spacing.
- Mud and rocks (`src/sim/haul.ts`, `src/render/rockView.ts`; the beaver shows the lump in its mouth; streams count as wet ground through `Terrain.streamDistance`, 1.5 m each side of the line): one thing in the mouth at a time, like food.
  Gnaw at the water's edge scoops mud. Gnaw next to a rock picks it up. The Drag button puts it down
  in front of the beaver, where it lies and can be picked up again (the author, session 39). Rocks are worked out from the ground like lily pads
  (10 m cells, 40 percent of them), on stream beds, banks, and steep ground, none on a lake floor or flat
  dry land. The land cover class is not used yet, so a rock can lie in a meadow bank. Tune on the tablet.
- The level 1 dam (`src/sim/dam.ts`, `src/render/damView.ts`): within 5 m of a spot (the ring) the Build
  button puts a dragged log (wood, a long one is 2), the mud, or the rock in the mouth onto the dam, up to
  8 wood, 4 mud, and 2 rocks. The HUD shows the percent and what is still needed. The dam is drawn as sticks,
  mud mounds, and rocks across the stream. The ring turns green once started and goes when the dam is whole.
  No pond yet. The test menu has "To nearest spot" and "Finish dam here". The mouth holds one piece, so a
  stack of materials in the test menu was not possible; "Finish dam here" stands in for it.
- The pond (`src/sim/pond.ts`, `src/render/pondView.ts`): the flood fill of the scan, run in the sim on the
  ground around a spot (2 m cells, an 80 m half window). The water level is the crest above the bed, and the
  crest rises with the dam's progress up to 1.0 m when the dam is whole, so the pond grows as you build. Only
  upstream ground connected to the stream floods, and a fill that reaches the window edge or 12000 m2 is no
  pond. The fill is kept as a grid in `world.ponds` and drawn as flat water clipped to the ground, in the lake's
  look. `withPonds` adds the pond water to the ground, so the beaver swims, dives, and floats logs in it. Lily
  pads do not grow in ponds yet. On the real core data the nearest first spot holds 1100 m2 at full height. The
  edge across the dam line is stepped at the 2 m grid.
- A spot lies on the drawn stream line (the scan reports the OSM line point, not the channel bed it
  found a few metres off), so the ring, the dam, and the pond sit on the stream the player sees. The fill
  seeds from the lowest upstream ground within 8 m of the channel point, since the real channel is a little off the line.
  The scan also writes that channel point (`channel`), and the fill puts the dam line and the seed there, as the scan does.
  Before that the game flooded a median 14 percent less than the scan promised; on the 74 sites it is now within 1.3 percent
  for 9 in 10 (the rest is the seed cell). A file from an older scan has no `channel` and falls back to the line point.
- Rocks do not lie on a dry meadow (the land cover class of the tile), whether a bank or steep ground. The wet stream bed
  may cross a meadow and keeps its rocks.
- New spots from a new pond: see "Built so far (new spots)" below. Not built yet: lily pads, the lodge in a pond.

## Built so far (step 3, wear of the dam)

Code in `src/sim/dam.ts` (wear and mend) and `src/sim/pond.ts` (the level that follows).

- A dam gets a `wear` record (`wear.ts`) the moment its last piece goes on, and its condition falls on the game
  clock like the lodge's: worn (0.5) after a season, 10 days. A sleep or a generation away ages it the same way.
- The pond level is the full crest while the dam is good, then falls in step with the condition: at 0.5 it
  starts to sag, and at 0 the pond is gone and the water is back to the stream. So a worn dam sags for about 7
  days, and a broken one (below 0.15) drains in the last 3. Nothing is lost, and mending lifts the level again.
- The crest is worked out in steps of 5 cm, and a pond is flooded again only when a dam's crest moves a step
  (`pondsAt`), so the level never jumps and the fill is not redone every frame.
- Repair is the build button with a log, mud, or a rock at a worn dam. A wood unit mends 0.1, mud 0.1, a rock
  0.2 (a long log is 2 units). A good dam takes nothing. A broken dam is built again with the full set (8 wood,
  4 mud, 2 rocks), starting from nothing, and the pond grows back as it goes up. It is a chore, never a loss.
- A worn dam loses sticks and mounds in the view, down to a third when gone, and shows the gold repair glow
  (brighter when broken). The HUD line at the spot says how worn it is and how many units it needs. The mark
  comes on when the condition falls below 0.5 and stays until the dam is back at 1.0, so the units shown are
  always what is left (`Dam.repairing`). A good dam that is mended a little is never marked.
- To try it: `?age=N` makes a dam N days old when the test menu fills it in (worn at 10, broken at 17).
- Not built: teenagers who repair the dam, a worn dam's effect on fish and lily pads (there are none in ponds
  yet), the cost of a wear step on the shore (a lodge door left in shallows).

## Built so far (step 4, levels 2 and 3)

Code in `src/sim/dam.ts` (`Dam.level`, `LEVEL_COST`, `raised`) and `src/sim/pond.ts` (`crestOf`).

- A dam has a level, 1 to 3 (missing means 1). It holds the wood, mud, and rock of its level in all: 8/4/2, 14/8/5,
  22/12/9. The crest is 1.0, 1.5, and 2.0 m, up to what the spot holds (`maxLevel`).
- Raising is the build button at the dam, as for building and mending. A whole dam that is good (condition 0.5 or
  more, and not marked for repair) and below the spot's biggest level is raised by the next piece placed: it keeps
  what it has, takes the rest of the next level's cost, and the pond rises from the old crest to the new one as it
  goes (`crestOf`), the same as level 1. A worn dam is mended first. The spot ring shows again on a dam that can
  be raised, and the HUD line says "dam level 1 done, raise it to level 2: needs ...".
- While a dam is raised it does not wear, and it is new when the bigger level is whole (the wear record is made
  again). So raising also renews it.
- A broken dam is built again from nothing at level 1 (14 units, not 43), so a bad run never costs a big dam twice. To tune.
- **Cost follows the wall.** The table price is for a typical wall (`REF_WIDTH`, the scan's median: 16, 20, and 22 m
  at the three crests). A dam costs the table price times its wall length at that crest over the typical one,
  clamped to 0.6 to 2 (`widthFactor`), each material rounded, at least 1. The scan writes the length at each crest
  (`dam_widths` in `dam_sites.json`, rerun `scan_dam_sites.py`); a file without it prices every spot at 1. The
  factor is kept on the dam (`Dam.scale`), so the price is fixed once the dam is started. Raising never lowers it
  (it takes the bigger of the old and the new level's factor), so what is placed is never more than the next level
  asks. Mending is scaled the same way: one wood unit mends 0.1 divided by the factor, so a long wall takes more
  units to mend and a short one fewer. Rocks scale like the rest for now; more with height than length is open.
- To try it: the test menu "Finish dam here" fills a dam to level 1, and each press after raises it and fills the
  next level, up to what the spot holds.
- Not built: the view of a bigger dam is the same piles, more of them and higher. A shaped wall comes with the
  art.

## Built so far (step 5, the lodge in a pond)

Code in `src/sim/pond.ts` (`lodgeGround`, `pondAt`), `src/sim/lodge.ts` (`Lodge.pond`, `followPond`), `src/sim/step.ts`
(`newLodge`).

- A new lodge can start in the water of a pond, with the same checks as in the lake (0.1 to 1.2 m at the site,
  1.2 m at the door and 3 m beyond). The lodge sees only ponds of a level 2 dam or higher (`lodgeGround`, crest 1.5 m),
  as a level 1 pond is too shallow for the door (the author, 2026-10-08). The lake is unchanged.
- A lodge started in a pond is tagged with its dam spot (`Lodge.pond`). Its floor follows the pond: it rises with the
  water when the dam is raised and falls when the dam wears, so the room stays dry and the door under water. When the
  pond has drained it rests on the ground. A lodge in the lake is not touched.
- To try it: the game starts with a whole test lodge near the start, and the lodge preview shows only when there is no
  lodge. Start with `?lodge=0` or press "Remove lodge" in the test menu (Lodge row), finish a dam to level 2 or 3, and
  drag a log into the pond. `?fly=1` frees the view from the beaver, which stands still: a top down view with north up, starting 250 m over the
  start. W, A, S, D (or the stick) pan it north, west, south, east, a one finger drag slides the map, and the wheel
  zooms (also pinch, up to 600 m). The land and the spot rings follow the view. For looking at ponds and spots from above.
  `?fly=free` is a drone instead, with the sun disc, the shadows, the beaver's screens, and the beaver, lodge, logs, lily pads and rocks left out (land, water, trees, dams and ponds stay): the stick or W, A, S, D flies it level over the ground (W and S go forward and back whatever the pitch), Space or E
  (the Up button on a tablet) climbs, Shift or Q (Down) descends, the wheel flies in and out along the look, a drag turns it (inverted: dragging right looks right, down looks down), and a tap on the land glides it there and
  faces it. It keeps 3 m over the ground and the water, speeds up with its height, and the land streams in around it.
  The test menu has a View row (Beaver, Map, Drone) that picks between them without a URL flag, for the tablet shell: it
  reloads the page with `fly` set and the other settings kept.
- Not built yet: the door depth when a pond sags below 1.2 m, new spots
  from a new pond, and lily pads in a new pond.

## Built so far (new spots)

Code in `src/sim/newSpots.ts`, `Terrain.streamPoints` (`src/terrain/store.ts`), and the hook in `src/sim/step.ts`.

- When a pond is flooded again (its crest moved a step), the stream lines within 40 m of its water, and the lines running into it,
  are scanned for spots. It is a port of the scan: snap to the lowest ground within 6 m, the downstream side, the dam length at each
  crest (40 m at most), the pond by `floodPond` itself, 200 m2 at least, and the same line gate. The lines are the snapped ones the
  tile store holds, so ADR 0010 holds here too. Level 1 must pass, and the spot's biggest level is the crest with the biggest pond.
- A new spot lies at least 45 m from any known spot and from the others found, the biggest pond first. Spots stay when a pond
  sinks, so nothing is taken away. The spot ring view is made again when the list grows.
- A new spot is found while the beaver may be far away, on the coarse ground, which can promise a bigger dam than the fine
  ground holds (one spot read level 2 on the 5 m tiles and level 1 on all of them). So it is `rough` until the beaver comes
  within 100 m (`refineNear`), when its levels and dam lengths are worked out again on the ground loaded then. A spot with a
  dam started keeps its figures, since the price is fixed.
- The HUD line of a whole dam at the biggest level its spot holds ends with "as high as a dam can go here".
- A ground without stream lines (a test stand-in) finds none. Nothing saves the spots yet, so they are found again from the dams.
- Saving (open, for when saves exist): the found spots are derived data. Each one comes from a pond, so a game loaded from dams and
  their levels finds them again by the same search. Two choices then: keep them derived (no save format cost, but the result can
  differ if other tiles are loaded when the search runs, and costs the search again), or store them in the save as doc 20 says
  above (exact, and a spot stays even if its pond is gone). When saving is built, check that the search gives the same spots
  after a reload, and store them if it does not.
- Not yet tried on the real tiles on screen. The cost per pond change is a few dozen fills of an 81 by 81 window; measure it on the tablet.

## Decided

- The lodge can go in the lake or in a pond (the author, 2026-10-07).
- Three dam levels is enough (the author, 2026-10-07).
- A lodge in a pond needs a level 2 or 3 dam, and its floor follows the pond (the author, 2026-10-08).

## Open questions

- Which six spots are the first ones for each location? A tuning step, with the
  author on the tablet.
