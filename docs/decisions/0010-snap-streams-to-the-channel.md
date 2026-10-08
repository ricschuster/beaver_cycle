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
- Open: snap on the 2 m data where a tile has it, and burn the channel into the heights if ponds still
  run beside the line on the coarse tiles. Neither is needed so far.
