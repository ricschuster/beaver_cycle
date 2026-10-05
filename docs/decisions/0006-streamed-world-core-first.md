# Streamed world, core first

## Status

Accepted

## Context

The play area is six locations, 14.7 km2 (ADR 0004). The target device is a
tablet (`docs/design/08_camera_and_platform.md`), and the camera is third
person (ADR 0005). The height data for the whole area is small, about 2 MB at
5 m. The limit on a tablet is how much of the world is drawn and held in
memory at once, not the size of the data.

Three options were weighed with the camera demo in hand: the whole real area
loaded in chunks, the core only at full detail with travel to the other
locations, and a smaller hand-shaped world. The author prefers the whole real
area.

## Decision

- The world is the real play area, loaded in chunks around the beaver. Tiles
  near the beaver are drawn in full. Tiles farther away use coarser terrain
  and simpler or no trees, hidden by fog.
- It is built in stages. The core (6.3 km2) comes first, with the streaming in
  place. The other five locations are added one at a time once the core feels
  right. The chunking is the same either way, so nothing is redone.
- A test menu with a speed multiplier (x1, x5, x20, x100) and a jump to any of
  the six locations is part of the first build. It is a testing tool and not a
  game feature. Player facing fast travel is a separate design question, open
  in `docs/design/06_locations.md`.

## Consequences

- Rough effort to walk the full area smoothly is four to six working sessions:
  terrain tiles, distance detail, trees and water per tile, and tuning on a
  real tablet. These are estimates. The tablet tuning is the largest unknown,
  because only a desktop browser is available for testing here.
- Real terrain has no beaver ponds, dams, or lodges. Each place still needs
  beaver content and tuning. A bigger world means more places to fill.
- The tile and tree budgets are set by measuring on a tablet, not by guessing.
- The speed multiplier doubles as a stress test: fast movement outruns tile
  loading, so loading has to keep up or fail gracefully.
- Staging means the core could end up being the whole game. That is allowed.
  Adding or dropping a location is a new ADR that supersedes this one, since
  ADR 0004 holds the play area.
- OpenStreetMap derived layers still need a licence decision before release
  (ADR 0003).

## Addendum: far backdrop (session 15)

The play area was cut with a 640 m margin, so the valley walls and peaks beyond
it simply ended, with only tile skirts showing against the sky. The tile tool
now adds a backdrop of far tiles out to 5 km from the play area, as far as the
BEV raster reaches. A far tile has a level 2 file only, at 40 m cells (8 per
side), and the index marks it `"far": true`. The streamer never asks for a
finer level of a far tile. They cost about 6 MB of files and no extra requests
for trees, water, or fine levels. The camera far plane and the fog were raised
to match.

The download box in `tools/area-editor/build_data.py` now reaches 0.06 degrees
further south (about 6.7 km), so the backdrop is a full 5 km deep around the
Totes Gebirge marker too. The same box feeds the BEV terrain, the OpenStreetMap
land cover and water, and the editor relief, so the far ground has forest and
rock classes like the near ground.
