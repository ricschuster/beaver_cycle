# Play area and view area

## Status

Accepted

## Context

The game is set around the Almsee (see `docs/design/03_location.md`). We needed a
play area, where the beaver can go, and a view area, the visual backdrop. The
area editor (`docs/design/04_area_editor.md`) let us draw and compare options on
real terrain. The game length is still parked, so the area may be revisited
after round 2.

## Decision

- The play area is six locations together, 14.7 km2: Core, North extension,
  South extension, East extension to the Oedseen, Vorderer Springbach valley,
  and Hinterer Springbach valley. They are described in
  `docs/design/06_locations.md` and stored in `data/areas/areas.geojson`.
- The extensions are on gentle ground (slope under 7 degrees for north and
  south, under 10 for the east corridor). The east extension follows a 4.7 km
  route along the Straneggbach to both Oedsee lakes.
- The view area is the box 13.895 to 14.06 E, 47.675 to 47.815 N, about 2.5 km
  of margin either side of the play area. Source data covers it plus 3 km.
- Each location stays a separate, switchable option in the editor, so smaller
  areas can still be tried.

## Consequences

- The longest straight line across the play area is 9.7 km, about 81 minutes at
  2 m/s with no compression. Game length is parked, so compression may change.
- The east extension is a corridor, and the Springbach valleys are higher and
  steeper than the core. Most of the flat, pond-friendly ground is in the core,
  north and south.
- The data covers a larger box than before, so the terrain and OpenStreetMap
  downloads were redone. Raw data stays untracked and rebuilds with
  `tools/area-editor/build_data.py`.
- The locations suggest travel between places, recorded as an idea in
  `docs/design/06_locations.md` and not decided here.
- Changing the play area later is a new ADR that supersedes this one.
