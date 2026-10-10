# 14 M2 plan: the streamed core

Status: draft for the author's review. It turns the M2 bullets in
`13_milestone_plan.md` into a build order, using ADR 0006 (streamed world, core
first) and ADR 0007 (web stack). The numbers marked "proposed" are starting
points, to be set by measuring on the tablet.

## Goal

Walk a placeholder beaver across the whole core on a tablet, with real terrain,
the lake, streams, and trees appearing around it and fading into fog, without
hitches. A test menu sets the speed and jumps to any location. The beaver is
still a box. Real movement is M3.

## Decisions to make first

These shape the tile format, so they come before code. The recommendations are
mine.

1. **Tile size and detail levels.** Proposed: tiles of 320 m. Level 0 is the
   5 m source (65 x 65 vertices, about 8,000 triangles), level 1 is 10 m, and
   level 2 is 20 m. A 5 m grid is the finest the data has (ADR 0002).
2. **Where trees come from.** Recommended: not stored. A tile holds a land
   cover class per cell, and trees are placed at load time from that class map
   with a seeded random generator. This keeps the data small and makes every
   device place the same trees, which multiplayer will need. The alternative,
   baked tree positions, gives hand control but bloats the data.
3. **Height queries belong to the simulation.** The beaver walks on the ground,
   so the simulation needs `heightAt(x, z)` and a water test. It gets them
   through a small `Terrain` interface that the tile loader fills in. The
   simulation never imports three.js or the loader.
4. **Scope of the data.** Recommended: the tile tool takes any area id from
   `data/areas/areas.geojson`, but M2 builds and tests the core only, as ADR
   0006 says. The test menu lists all six locations and greys out the five
   that have no tiles yet.
5. **Licence.** The land cover and water come from OpenStreetMap (ADR 0003 is
   still Proposed). Generated tiles stay untracked in the repo like
   `data/raw/`, are rebuilt by a script, and go only into the author's own APK.

## Look and scale

M2 uses the real BEV heights at 1:1 scale and the camera demo's look (colour
per land cover class, a deeper made up lake). Neither is final. The tile tool
is the one place that shapes the terrain (vertical exaggeration, smoothing,
lake depth, colours), so the look can change later by rebuilding the tiles.

Scale is different. Compressing distances changes every walking time, so it has
to be settled after the first walk through the M2 terrain and before M3 tunes
movement and M5 places dams and lodges. It is open in `03_location.md` and
ties to `09_game_length_and_speed.md`. Until then, distances are real and the
walking times in `06_locations.md` hold.

## Building blocks

### 1. Tile tool (Python)

`tools/tiles/build_tiles.py`, reusing the BEV and OpenStreetMap data in
`data/raw/` from `build_data.py`.

- One local coordinate system for the game: metres, x east, z south, origin at
  the core anchor, as in the camera demo. Fixed in the tool and in the doc.
- Per tile and level: heights as 16 bit integers with an offset and scale, a
  land cover class per cell (0 ground, 1 meadow, 2 forest, 3 scrub, 4 rock,
  5 wetland, 9 lake, as in the demo), and a water polygon or stream line list.
- A made up lake bed, deeper with distance from the shore, as the demo does,
  because BEV has a flat lake. Heights are the same on both sides of a tile
  edge so tiles join without cracks.
- An `index.json` with the origin, tile size, levels, and the tiles that
  exist. Output goes to `public/tiles/` (untracked).
- Tests: a small pytest or script check that neighbouring edges match and that
  a known point has the known height.

### 2. Terrain streaming (render side)

- A loader that keeps tiles around the beaver at the right level: level 0 near,
  level 1 and 2 farther out. Proposed rings: level 0 within 640 m, level 1 to
  1.3 km, level 2 beyond. Fog hides the outer edge.
- The whole core at level 2 stays loaded as a horizon. It is small (20 m cells
  over 6.3 km2 is about 16,000 cells), so a fast beaver always has ground
  under it and tiles refine as they arrive.
- Tile builds are limited per frame (one tile) so loading does not freeze the
  game. Move geometry building into a Web Worker if the tablet shows hitches.
- Evict tiles far away, and reuse buffers, to keep memory flat.
- Level edges get a short skirt so a level 0 tile beside a level 1 tile shows
  no gap.

### 3. Simulation hooks

- `Terrain` interface: `heightAt`, `isWater`, `waterDepth`. The loader supplies
  the data, a flat test terrain supplies it in unit tests.
- The box beaver follows the ground height. A speed multiplier (x1, x5, x20,
  x100) scales movement speed. It is a test setting in the world state, not a
  game rule.

### 4. Water

- The lake is a flat plane at its level, drawn per tile where the lake class
  shows. Streams are ribbons following the stream lines. Simple shading
  first. No animation yet (it costs frame time and can wait for the budgets).

### 5. Trees

- Instanced meshes per tile, placed from the class map. Level 0 uses a low poly
  tree, level 1 a cheaper one or a billboard, level 2 none.
- Proposed density from the demo: its 14,000 trees came to about 400,000
  triangles, already near the limit. Aim lower, and set the tree and triangle
  budgets from the tablet run.

### 6. Test menu

- An overlay opened by a small button (and a key on desktop). Speed buttons,
  a jump to each location anchor, and a readout of frame rate, loaded tiles,
  triangles, and memory.
- Anchors come from `data/areas/areas.geojson` and `travel.json`, copied by the
  tile tool into `index.json` so the game does not parse GeoJSON.

## Order of work

Each step ends with something to run. The sessions are rough, per ADR 0006.

1. **Tile tool and format**, with the edge test and one level 0 tile viewed in
   the game. (Session 1)
2. **Streaming**: rings, levels, fog, eviction, and the `Terrain` interface
   with unit tests. Walk the core with a keyboard. (Session 2)
3. **Water and trees** per tile. (Session 3)
4. **Test menu, speed multiplier, and jumps.** Check the x100 case: the beaver
   outruns loading, so the horizon layer has to carry it. (Session 4)
5. **Tablet pass**: build the APK, walk the core, fix hitches and heat, and
   record the budgets. (Session 5, maybe 6)

## Tests

- Unit tests (Vitest): ring selection from a position, eviction, `heightAt`
  across a tile edge, the speed multiplier.
- Python check: tile edges match, heights agree with the source raster.
- Playwright: load the game, jump to each active location, and check there are
  no page errors and that tiles loaded. Screenshots for a visual look.
- Tablet: frame rate, memory, and load time over at least ten minutes, since
  M0 only ran two.

## Budgets to set on the tablet

M0 gave 74 to 77 fps, 150 MB of memory, and 52 C after two minutes on an empty
scene. Proposed targets for the full M2 scene, to be confirmed or changed:

| Measure | Proposed |
| --- | --- |
| Frame rate while walking | at least 45 fps, no stalls over 100 ms |
| Triangles per frame | at most 2.5 million (set from the stress tests below; the far backdrop uses about 1.1 million) |
| Trees drawn | at most 100,000 |
| Memory | under 400 MB |
| Temperature after ten minutes | under 45 C at the back (to be measured) |
| First tile on screen | under 3 seconds after the app opens |

### Measured on the tablet (2026-10-04)

Galaxy Tab A9+ (SM-X210, 90 Hz screen) running the game in the live shell
(`tools/tablet-live/`), started at the core and read over the WebView debug
socket. The frame rate is capped by the screen at 89.8 fps, so the runs show
how much load fits before it drops, not the true frame cost.

- **Normal play:** 0.5 to 0.75 million triangles and 27,000 to 44,000 trees in
  every location, walking at x1 or jumping at x100. 89.8 fps, worst frame
  11.3 ms, apart from one 22 ms frame after a jump. The ground kept up with x100
  (the level 2 horizon carries it) and a location jump takes about 0.5 s.
- **Ten minutes of walking at x5** with turns and camera swings: 89.8 fps the
  whole time, memory flat at 170 to 177 MB (65 MB of it graphics), no growth.
  The board's skin sensor rose from 24.7 to 29.4 C (throttling starts at 40 C),
  CPU and GPU stayed at 45 to 49 C.
- **Stress test**, in the dense forest at Vorderer Springbach, with `?rings=`
  and `?trees=` in the URL:

| Setting | Triangles | Trees | Result |
| --- | --- | --- | --- |
| Rings x1.6, x2.5, x4 | 1.1, 2.0, 3.1 million | 76,000 to 230,000 | 89.8 fps, no hitches |
| Trees x2, x4, x8 | 0.9, 1.4, 2.4 million | 87,000 to 348,000 | 89.8 fps |
| Trees x16 | 4.3 million | 695,000 | 60 fps, worst frame 45 ms |

The tablet holds 90 fps up to about 3 million triangles and drops at about
4 million. The budgets above keep half of that as margin, because the friends'
tablets are not known and may be weaker, and because the beaver, water
animation, and lodge will cost frames later. Not measured: battery drain, load
time from a cold start, and a weaker device.

### Measured with the far backdrop (2026-10-05)

Same tablet and method, after the 5 km far backdrop (2,164 coarse tiles) was
added. The backdrop adds about 1.1 million triangles, so normal play is now 1.3
to 1.9 million triangles.

- **One mesh per far tile** (about 2,200 draw calls): 82 to 88 fps, p99 frame
  time 22 ms in the core and while walking, and a 67 ms worst frame on the first
  idle run.
- **Far tiles merged into chunks** of 8 x 8 tiles, one mesh per chunk: 89.3 to
  89.8 fps and p99 11 ms at the core, walking, and at x100. The worst frame on
  the first idle run fell to 22 ms. The cost was draw calls, not triangles.
  Heap rose from 32 to 36 MB. A jump to a new place still dips to about 78 fps
  while its tiles load.
- **Stress test** with the backdrop (`?rings=` and `?trees=`, still / moving at
  x20):

| Setting | Triangles | Trees | fps | Worst frame |
| --- | --- | --- | --- | --- |
| Base | 1.5 million | 49,000 | 89.8 / 85.6 | 22 ms |
| Rings x1.6, x2.5, x4 | 2.1, 3.4, 5.5 million | 94,000 to 360,000 | 87 to 75 / 80 to 67 | 22 to 44 ms |
| Trees x2, x4, x8 | 1.8, 2.3, 3.3 million | 95,000 to 383,000 | 84 to 88 / 75 to 80 | 22 ms |
| Trees x16 | 5.4 million | 765,000 | 61.5 / 65 | 33 ms |

The first stress rows above were taken before the chunk merge, so they show the
old draw call cost on top of the triangles. The re-run below replaces them.

### Re-run with the chunk merge (2026-10-05)

The stress sweep and a ten minute soak, repeated after the far tiles were merged
into chunks (still / moving at x20):

| Setting | Triangles | Trees | fps | Worst frame |
| --- | --- | --- | --- | --- |
| Base | 1.5 million | 48,000 | 89.8 / 89.6 | 22 ms |
| Rings x1.6, x2.5, x4 | 2.1, 3.4, 5.5 million | 94,000 to 360,000 | 89.8 / 89.3 to 89.8 | 11 to 22 ms |
| Trees x2, x4, x8 | 1.8, 2.3, 3.3 million | 95,000 to 383,000 | 89.8 / 89.1 to 89.6 | 22 to 33 ms |
| Trees x16 | 5.4 million | 765,000 | 66 / 72.8 | 33 ms |
| Rings x1.6, trees x4 | 3.6 million | 375,000 | 89.8 / 89.1 | 22 ms |

- **Limit:** the first drop is at trees x16 (5.4 million triangles). Up to 5.5
  million triangles with rings x4 the rate held at 89 fps or more, so the old
  rows were dominated by draw calls. The budget stays at 2.5 million, which is
  still more than twice below the limit.
- **Ten minutes of walking at x5:** 87 to 90 fps after the first sample (80 fps
  while tiles loaded), worst frames of 11 to 56 ms every few samples, and 1.4 to
  2.0 million triangles. Heap stayed at 36 MB, then rose once to 78 MB at about
  470 s and held. Total process memory (PSS) was 190 to 232 MB with no trend.
- **Temperature:** skin 29.3 to 29.7 C (throttling starts at 40 C), battery
  26.8 to 27.2 C, CPU 54 to 66 C and GPU 54 to 64 C, flat. CPU and GPU are
  higher than in the first soak (45 to 49 C), probably the backdrop, not compared
  under the same conditions.
- **Not measured:** draw calls (the bench does not report them), what causes the
  heap step and the 44 to 56 ms spikes.

## Risks

- The tablet may not hold the budgets with trees and water. Fallbacks, in
  order: fewer and simpler trees, a shorter level 0 ring, then revisit ADR 0007.
- Skirts and level changes can pop or shimmer. Fog and a short blend usually
  hide it. Check on the tablet, not only on the desktop.
- Hitches from building geometry on the main thread. The Web Worker is the
  planned fix.
- Land cover is a rough guide. Odd forest or lake edges in OSM show up as odd
  tiles, and are fixed by hand in the tool rather than in the game.

## Out of scope for M2

The real beaver and controls (M3), seasons and time (M4), lodge and dam pieces
(M5), the other five locations' tiles, and any game rules.

## Update: all six locations have tiles

The tile tool now cuts the whole play area, not only the core (session 13). The
core rectangle is unchanged. The other locations get the tiles within 640 m of
their shapes, and the named markers (the Totes Gebirge, 8 km south) get the
tiles around them, so the grid is sparse and about 570 tiles (17 MB). All
buttons in the test menu are enabled. Fine 2 m tiles still exist only near the
core lakes, because the BEV 1 m terrain is cached for the core only. The Oedsee
and the other lakes have 5 m ground.

## Update: fine tiles for every lake in the play area

The fine level is no longer limited to the core (session 18). The tile tool now
caches the BEV 1 m terrain per region, one file for each group of touching fine
tiles, padded by one tile, in `data/raw/dtm1_<tx>_<tz>_<w>x<h>_31287.tif`. It
reads both 50 km BEV tiles (`N2700000` and `N2750000`), because the north end of
the Almsee reaches past the first. Each region has its own datum correction, and
regions do not touch each other, so no seam has a step.

- Fine tiles went from 37 to 70 (5.2 MB), in four regions: the north end of
  the Almsee with the Alm outflow (a dam site), the Almsee shore in the core, the
  south delta, and the Grosser and Kleiner Oedsee (9 tiles).
- The cache is about 82 MB in four files (it was 99 MB for the core alone). The
  old `dtm1_core_31287.tif` can be deleted.
- `build_tiles.py` checks that fine tiles join and sit on the 5 m ground, and
  passes for all 70.
- 1 m cells for dam sites stay open (M5, ADR 0008).

## How a fine tile is meshed, and where it hitches

Written in session 19 from the code (`src/terrain/streamer.ts`,
`src/render/terrainView.ts`) and the `lakes` bench run. It describes what
happens today, so a later fix has something to compare against.

### The path from file to mesh

1. The streamer wants a fine tile when the tile has a fine level and the beaver
   is within `fineRing` (200 m) of it, plus 40 m of hysteresis once it is held.
   Beyond that the tile is dropped. It fetches the file (nearest first, at most
   four in flight) and `decodeTile` runs in the promise callback, so decoding is
   on the main thread too.
2. Each frame `TerrainView.update` compares what each tile shows with what is
   wanted. A tile is rebuilt when its level changes (so a fine tile arriving
   replaces the level 0 mesh) or when its stream data arrives. The old group is
   disposed and a new one built.
3. A rebuilt tile gets a group of up to four parts: the ground
   (`buildTileGeometry`), the lake surface (`buildLakeGeometry`, only for tiles
   with a lake level), the stream ribbons (`buildStreamGeometry`), and the
   instanced trees (`placeTrees` then `buildTrees`). Trees are placed again on
   the fine ground, so they move when the tile loads.
4. Building is on the main thread, nearest tile first. `BUILD_BUDGET_MS` is 4 ms,
   but it is only checked after a tile is finished, and at least one tile is
   always built. A tile that takes longer than 4 ms therefore takes the whole
   frame, and the budget cannot split it.

### Size of one fine tile

A fine tile is 320 m with 160 cells of 2 m, so 161 x 161 = 25,921 vertices and
about 51,000 ground triangles, plus 640 skirt vertices with four triangles each.
The ground builder walks every vertex, averages the colours of up to four cells
and takes a height difference for the normal, and it fills the index in a plain
JavaScript array that has about 300,000 entries before it is copied into a typed
array. A level 0 tile has 65 x 65 vertices, about six times fewer. Trees on a
fine tile use the level 0 density over 25,600 cells.

### What the tablet showed

The `lakes` bench mode (`node tools/tablet-live/bench.mjs lakes`, Tab A9+, 90 Hz)
jumps to each fine tile region, waits for the tiles to settle, then samples
standing still and walking at x5.

| Place | Walking x5 fps | p99 ms | Worst frame ms |
| --- | --- | --- | --- |
| Alm outflow | 88.9 | 11.3 | 44.6 |
| Almsee | 87.2 | 22.3 | 111.3 |
| South shore bog | 89.8 | 11.3 | 11.3 |
| Aagbach inflow | 89.8 | 11.3 | 11.3 |
| East Oedseen | 89.8 | 11.3 | 11.3 |

Standing still is clean everywhere (11.3 ms worst frame, 1.6 to 1.8 million
triangles, heap 36 MB). The two spikes happened while walking, when the number
of tiles held changed, which fits a fine tile being built. Session 18 saw the
same kind of frame (33 ms) in the `fine` mode (ADR 0008). It is a single run per
place, and nothing has been profiled, so the share of the time that goes to
decoding, the ground, the lake, or the trees is not known. The Almsee shore has
the largest tile count and lake surface to clip, which may be why it is worst.

### Build times on the tablet (session 72)

`bench.mjs lakes` now prints the time of each build part per tile (the game keeps
them in `src/terrain/buildTimes.ts`, read with `__game.buildTimes()`). One run on
the Tab A9+ over the five places, fine tiles (6 to 10 per place), in ms:

| Part | Mean | Slowest |
| --- | --- | --- |
| Ground | 12 to 16 | 37 |
| Lake surface | 9 to 19 | 48 |
| Trees | 1.5 to 4.6 | 22 |
| Streams | 0.1 to 0.2 | 0.4 |
| Decode | 0.1 to 0.2 | 0.3 |

A whole fine tile is therefore about 25 to 35 ms on average and up to about
90 ms, against a 4 ms budget and an 11 ms frame. Ground and the lake surface are
nearly all of it; decode and streams do not matter. Level 0 tiles take 2 to 3 ms
for ground and trees, level 1 under 1 ms.

Caveat: that run, and the session 19 style runs before it, had the beaver
inside the lodge (a saved game starts there). Walking then goes nowhere, so the
walking part built almost no tiles, and the camera saw the inside of the lodge.
The bench now clicks "Outside" after each load and jump. With the beaver
outside and swimming or walking at x5 on the lakes, the same tablet gives only
33 to 41 fps, p99 45 to 78 ms and worst frames of 78 to 245 ms, at night, with
shadows on. That is a bigger problem than the tile builds and is not explained
yet.

After typed arrays and no per cell lookups in the ground builder, and scalar
clipping in the lake builder (same output, checked against the old code), the
fine tile ground takes about 4 to 5 ms (was 12 to 16) and the lake surface 5 to
12 ms, up to 30 (was 9 to 19, up to 48). The lake surface is now the largest
part, so it is next.

### Options, not yet decided

- Measured (session 72, #109, below). Build the parts apart first.
- Build the parts of one tile on different frames (ground, then lake and
  streams, then trees), so no frame builds the whole tile.
- Build the ground in typed arrays from the start rather than a number array.
- Smaller fine tiles (for example 80 m), as ADR 0008 suggests for 1 m cells.
- Move decoding and the geometry work to a Web Worker, which is the plan in the
  Risks section above.
- Do the work spread over several frames only for tiles that are not under the
  beaver, since the one it stands on is needed at once.
