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
- Revisit this ADR before the game or its data is shared beyond the author and
  friends. The ODbL obligations apply to public use, so a private build on the
  author's own tablets has none yet. Generated tiles stay untracked and are
  rebuilt by a script (M2). Whether handing the APK to a few friends counts as
  public is unconfirmed, so check before doing it.

## Update 2026-10-11: public repository

The source repository may become public. A check of the tree and the full git
history found no OSM extract, tile, or OSM geometry: `data/areas/` holds play
polygons and travel routes computed on BEV terrain. What goes public:

- The tools that download OSM at build time (code only).
- Six manual screenshots drawn from OSM-derived tiles. They are Produced Works,
  so the manual and README now credit OpenStreetMap contributors and link the
  copyright page.

The play polygons in `data/areas/` come from a BEV elevation rule (valley floor
below 630 m, smoothed), not from OSM geometry.

Tiles, `data/raw/`, and any APK stay unpublished. The release decision above
still applies to them, and to handing the APK to friends.

## Update 2026-10-11: tiles published

The author decided to publish the game at <https://ricschuster.github.io/beaver_cycle/>,
and with it the tiles (release `tiles`, `.github/workflows/pages.yml`). The
tiles are OSM-derived, so they are published as an ODbL database:

- `NOTICE.md` states that the tiles are ODbL and must be credited and shared
  alike. The source code is AGPL-3.0, which is a separate work that only reads
  the tiles at run time.
- The credit is in the manual (the ? button), the README and `NOTICE.md`.
- The tools that rebuild the tiles are public, so the data can be remade.
- Not settled: whether a game counts as a Produced Work (the guidelines are
  silent). Publishing the tiles as ODbL data makes that question moot for the
  tiles. The APK stays a local debug build.

## Consequences

- No licence risk today, and the editor stays simple.
- A release decision is deferred, not made. Hand-drawn features or non-OSM
  replacements cost extra work, and shipping OSM-derived data costs openness of
  that one dataset.
- A game's rendered stylized visuals are likely Produced Works, but because the
  guidelines are silent on games, confirm with the OSM community or a lawyer
  before release.
