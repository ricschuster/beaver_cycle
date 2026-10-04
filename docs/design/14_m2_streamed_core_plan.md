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
| Triangles per frame | to be set (the demo's 400,000 is the ceiling) |
| Memory | under 400 MB |
| Temperature after ten minutes | under 45 C at the back (to be measured) |
| First tile on screen | under 3 seconds after the app opens |

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
