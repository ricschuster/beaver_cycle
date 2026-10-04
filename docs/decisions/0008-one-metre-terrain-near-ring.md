# One metre terrain for the near ring

## Status

Proposed. Decide together with the scale question (issue #54), after the first
walk through the M2 terrain on a tablet and before M3.

## Context

ADR 0002 chose the BEV 5 m terrain. A beaver is about 1 m long, so a 5 m cell
cannot show stream banks, a 1 to 3 m channel, or a dam site. The streamed world
(ADR 0006) already has detail levels, so a finer source would only need to feed
the nearest ring.

On 2026-10-04 we checked the BEV 1 m terrain model (ALS-DGM, from airborne laser
scanning):

- Free, licence CC-BY-4.0, the same as the 5 m model. Stated vertical accuracy
  is 0.5 m.
- Published as 50 x 50 km tiles in EPSG:3035 (not EPSG:31287) with orthometric
  heights. Yearly versions exist (2023, 2024, 2025).
- The core lies in one tile:
  `https://data.bev.gv.at/download/ALS/DTM/20250915/ALS_DTM_CRS3035RES50000mN2700000E4600000.tif`.
  The bounding box of the whole view area also touches the tile to the north
  (`N2750000`).
- The file is a Cloud Optimized GeoTIFF (LZW, float32, 512 px blocks, nodata
  -9999, 8 GB) and the server accepts range requests, so GDAL reads only our
  window through `/vsicurl/`. A 1.5 x 1.5 km window took about 22 s and 9 MB, with
  no nodata cells.
- Upper Austria also offers 1 m data under CC-BY-3.0 at `data.ooe.gv.at`. Not
  needed for now.
- In the test window the 1 m heights averaged 2.3 m above our 5 m data. This is
  probably the vertical datum difference (ADR 0002 notes the 5 m lake reads 587 m
  against a published 589 m), but it was not verified. The test window was
  mostly steep mountain, so the spread there says little about the valley floor.

## Decision

Not yet taken. The proposal:

- Keep 5 m for M2 (issues #49 to #53) and judge the look on the tablet.
- If the ground looks too coarse at beaver scale, add the 1 m model as a second
  source in the tile tool, for a new level in front of level 0 (1 m or 2.5 m
  cells) used only in a small ring around the beaver. The farther levels stay
  derived from the 5 m data, so the shipped data stays small.
- Fix the datum before mixing the sources: compare both models on flat valley
  floor and on the lake shore, and apply a measured offset, or switch the whole
  build to the 1 m model where it exists.

## Consequences

- Cost if adopted: roughly 70 million cells for the core and margin, about
  280 MB as raw float32 during the build, plus a second reader and a projection
  step in `tools/tiles/build_tiles.py`. Shipped size grows with the near level
  only. The tile format has a level number in its header, so a finer level is an
  addition, not a break.
- Gain: banks, channels, and dam sites become visible at beaver scale, and the
  lake shore is better defined.
- Risk: the datum offset, pop between a 1 m ring and the 5 m ground, and more
  triangles near the camera on a tablet with a budget still to be measured.
- Attribution to BEV is required in both cases.
