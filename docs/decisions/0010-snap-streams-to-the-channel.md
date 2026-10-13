# Snap the stream lines to the terrain channel

## Status

Accepted (2026-10-08). Builds on ADR 0002 (terrain) and ADR 0003 (OpenStreetMap use).

## Context

Dams, ponds, swimming and the wet ground rule read the terrain, but the drawn stream is an OpenStreetMap
line. On the 5 m terrain the line lies a median 4 m from the lowest ground across it, and at the dam
sites 54 percent of the line points were more than 3 m off. A pond is a flood fill of the terrain, so
it often filled a basin beside the line: at the first core spot only 3 percent of the pond lay within
3 m of the line. A fix in the pond (a corridor along the line) would give the water a second source of
truth and topological trouble at bends and where streams run close.

## Decision

The tile build moves each OSM stream line onto the channel of the terrain. OSM still says which streams
exist, their names and their rough route. The terrain decides the exact line.

- `tools/tiles/snap_streams.py`: each line is resampled every 5 m and moved sideways, at most 15 m, to
  the lowest ground across it. The path is a least cost path (Viterbi over the offsets): low ground is
  cheap, a large offset costs a little, and the offset may change by 3 m per step, so the line stays
  smooth and in order.
- Where the ground across the line is flat (under 1 m of relief), in a lake, or off the data, the OSM
  position is kept. The ends of a line stay put.
- It runs on the 5 m lattice in `build_tiles.py`, before the lines are cut per tile, so every consumer
  inherits it: the water files, `streamDistance`, the dam site scan and the pond. `--no-snap` turns it
  off. The build prints how far the lines moved and the points that moved more than 8 m.
- A second pass runs on the 2 m fine ground (BEV 1 m on the 5 m datum, `snap_fine_lines` in `build_tiles.py`),
  inside the fine tiles only: the already snapped lines are resampled every 2 m and searched 6 m each side, the
  offset changing by 1.5 m per step. Outside the fine tiles the heights are NaN, so the 5 m line stays there and
  the line agrees with the 5 m terrain of the coarse tiles. Lakes use the same 5 m mask. `--no-snap` skips both.
- The heights are not changed. The terrain keeps the BEV values.
- The dam site scan has a line gate (docs/design/20_dams_and_ponds.md): a site whose level 1 pond is not
  on the drawn stream is dropped.

## Consequences

- At the dam sites the median offset fell from 4 m to 1 m, and the share within 3 m rose from 46 to 87
  percent on the coarse tiles. With the gate, 48 sites qualify as first spots (13 in the core, at
  least 7 in every other location except east-oedseen, which has 1).
- The 5 m terrain resolves a channel only to about a cell, so lines can still sit 2 to 3 m off. The 2 m
  fine tiles near the lake are better, and the snap there still runs on the 5 m data.
- The lines are a mix of OSM geometry and terrain, which does not change ADR 0003: they stay an OSM
  derived dataset.
- Spot ids come from rounded positions, so they changed with the new lines. Nothing saves them yet.
- Measured on the tiles (lines every 3 m, lowest ground across the line within 8 m, flat spots skipped): on the
  fine tiles the share of line points within 3 m of the channel rose from 58 to 81 percent and the median offset
  fell from 2.5 to 1.0 m. Dam sites that pass the line gate rose from 107 to 115.
- Burning the channel into the heights is not needed: since #489 the fine tiles cover every tile within 100 m
  of a stream line, so the coarse tiles that keep a stream are the far backdrop, where nothing is built. The
  heights stay the BEV values. Revisit only if streams get dams outside the fine band.
- The 5 m snap moves about 12000 of 74000 points over 8 m, 88 percent of them in the far backdrop and about
  1400 in the play tiles, on steep gullies (median slope 28 degrees). In the play tiles the fine pass brings the
  share within 3 m of the channel on those points from 27 to 53 percent. A third still sit at the edge of the
  8 m window of the check, which on a one sided slope the check cannot judge; they want a look on screen.
