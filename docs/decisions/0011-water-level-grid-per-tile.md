# Sloping river water gets a level per point

## Status

Accepted (2026-10-15). Builds on ADR 0002 (terrain) and ADR 0008 (fine tiles). Fixes #518.

## Context

The tile tool gave each OpenStreetMap water polygon one level, the median of its BEV heights, and the tile files kept one
lake level per tile, the median of its lake cells. The game drew one flat water plane at that level. That is right for a
lake and wrong for a river polygon, which slopes: BEV has the river surface, and in the Alm and Aagbach inflow delta it drops
about 10 m over a few tiles. So the plane floated over the floodplain at the low end of a polygon, tile levels jumped at tile
edges (549.5 m, then 557.3 m, then 558.2 m, the straight seam), and ground below the plane that the land cover did not mark as
lake was flooded only 8 m past the marked cells (the square edges).

## Decision

- **Tile tool.** A polygon whose BEV heights spread over more than 1 m (10th to 90th percentile) is a sloping river. Its
  level is the local mean of those heights over 40 m (`local_surface`), not one number. The shore carving and the bed use that
  level per vertex. A fine window samples the same surface from the 5 m build (`Surface`), so fine tiles agree on their edges.
  Lakes stay flat, with one level.
- **Tile files.** A tile whose water differs in level by 5 cm or more carries a grid of levels in its water file
  (`public/tiles/water/<tx>_<tz>.json`, key `levels`): `step` (20 m), `n` (17 samples per side) and `v` (row major, metres,
  null where no water is near). Samples on a tile edge are the same in both tiles. Other tiles keep one level, as before. The
  index and the height tile format do not change.
- **Game.** `waterLevelAt` (`src/terrain/format.ts`) blends the samples round a point that have a level and falls back to the
  tile's `lakeLevel_m`. `TileStore.waterLevel` and `waterDepth` use it, so swimming and the drawn shore agree.
  `buildLakeGeometry` clips each ground triangle against the level at its vertices, so the water surface follows the slope and
  meets the ground at the true shoreline. Trees, shrubs and stream mouths read the level per point.

## Consequences

- 16 tiles along the Alm river have a grid, about 3 KB each. The Almsee and the Oedsee are unchanged.
- The delta shores are smooth, with no staircase and no seam. The water surface there is a little sloped, not flat.
- The threshold and the smoothing length were set by looking at the delta and at the Almsee, which must not get a grid.
  `tools/tiles/test_build_tiles.py` checks that the Almsee tiles have none and that grids agree along tile edges.
