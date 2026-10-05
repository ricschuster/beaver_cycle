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
- In the first test window the 1 m heights averaged 2.3 m above our 5 m data.
  That window was mostly steep mountain. The datum check below covers the whole
  core.

### Datum check (2026-10-04)

Read the 1 m model for the whole core shape (2870 x 4680 m, no nodata cells)
and compared it with the 5 m model, both in EPSG:31287, the 5 m data resampled
to 1 m with a cubic spline. Difference is 1 m minus 5 m, lake cells left out
(OSM outlines).

| Ground | Median | Spread (std) |
| --- | --- | --- |
| Valley floor (slope under 2 degrees, under 620 m) | +0.28 m | 1.3 m |
| Slope under 1 degree | +0.36 m | 1.3 m |
| Slope 8 to 20 degrees | +0.88 m | 4.0 m |
| Slope over 20 degrees | +2.40 m | 6.6 m |
| Land 0 to 15 m from a lake | +0.70 m | 0.8 m |

- Almsee surface: 587.32 m in the 1 m model, 586.65 m in the 5 m model, so
  +0.67 m. The published level is 589 m, so neither model reads it.
- It is not one constant datum shift. Along the valley floor the median runs
  from -0.2 m to +1.3 m in 1 km strips (north end +1.3, middle -0.2, south end
  +0.5 to +0.8). On slopes the 1 m model is higher, up to +2.4 m on steep
  ground, which fits a smoothed 5 m model that cuts ridges and fills gullies.
- No horizontal shift: moving the 1 m grid by up to 6 m in any direction does
  not improve the match.
- The 1 m model is therefore a better fit for the valley floor than a datum
  guess suggested, but the two sources differ by about 1 m, and by more than
  the 0.5 to 1 m features (banks, channels) the finer ring is meant to show.
  Joining a 1 m ring to 5 m ground with no correction would leave a visible step
  of up to about 1 m at the ring edge.

## Decision

Not yet taken. The proposal:

- Keep 5 m for M2 (issues #49 to #53) and judge the look on the tablet.
- If the ground looks too coarse at beaver scale, add the 1 m model as a second
  source in the tile tool, for a new level in front of level 0 (1 m or 2.5 m
  cells) used only in a small ring around the beaver. The farther levels stay
  derived from the 5 m data, so the shipped data stays small.
- Fix the datum before mixing the sources. The check above shows a single
  offset will not do, so either blend the ring into the 5 m ground with a
  smooth correction (the 1 m minus 5 m difference, low pass filtered over about
  100 m, subtracted from the 1 m heights, so the fine detail stays and the ring
  edge has no step), or switch the whole build to the 1 m model where it exists.
  The lake level should come from the same source as the ground around it.

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
