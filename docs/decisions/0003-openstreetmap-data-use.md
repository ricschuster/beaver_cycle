# Use of OpenStreetMap data

## Status

Proposed

## Context

The area editor uses OpenStreetMap (OSM) for water and land cover (forest,
wetland, scrub, meadow, rock). OSM data is licensed under the ODbL. The OSM
Foundation community guidelines, read on 2026-10-04, say:

- A rendered result such as a PNG, JPG, PDF, SVG or other raster image is
  normally a Produced Work. It needs attribution, and the underlying database
  has to be published as well.
- If the published result is intended for extracting the original data, it is a
  database, not a Produced Work.
- OSM data combined with other data stays an independent (collective) database
  only if each data type is all OSM or all non-OSM within the same region.
  Mixing them for one feature type makes a derivative database, and share-alike
  then applies when the data is publicly used.
- The guidelines give no example for games, 3D models or stylized maps.

This is not legal advice. Nothing is released yet, so no obligation applies yet.

## Decision

- Use OSM only as a reference and a separate layer for now. Do not mix OSM and
  non-OSM data inside one feature type (for example, no lake outline half from
  OSM and half from another source).
- Credit OpenStreetMap contributors wherever OSM-derived data or images are
  shown, as the editor does now.
- Before any public release, decide for each OSM-derived dataset: ship it as
  game data (then treat it as ODbL and publish that dataset), or replace it with
  a non-OSM source (check Austrian open data for water and land cover first), or
  hand-draw the feature so the game holds no OSM geometry.
- Do not commit raw OSM extracts to the repo. Rebuild them with the script.

## Consequences

- No licence risk today, and the editor stays simple.
- A release decision is deferred, not made. Hand-drawn features or non-OSM
  replacements cost extra work, and shipping OSM-derived data costs openness of
  that one dataset.
- A game's rendered stylized visuals are likely Produced Works, but because the
  guidelines are silent on games, confirm with the OSM community or a lawyer
  before release.
