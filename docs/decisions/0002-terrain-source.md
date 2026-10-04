# Terrain source: BEV 5 m DGM

## Status

Accepted

## Context

The game map is stylized from real terrain around the Almsee (see
`docs/design/03_location.md`). The first area editor used the Copernicus 30 m
DEM, which looks blocky in the mountains. We need a finer source with a licence
that allows use in a game, and a way to fetch only our area, not a whole-country
download.

## Decision

Use the BEV (Austrian Federal Office of Metrology and Surveying) Digitales
Geländehöhenmodell, 5 m grid, as the terrain source for the view area plus a 3 km
buffer. It is published as one online Cloud Optimized GeoTIFF
(`https://data.bev.gv.at/download/DGM/Hoehenraster/DGM_R5.tif`), so GDAL reads
just our area over HTTP. The BEV record states CC-BY-4.0. The data is EPSG:31287
with the Adria Triest vertical datum. Raw downloads stay untracked in
`data/raw/`, and `tools/area-editor/build_data.py` rebuilds them.

Copernicus GLO-30 stays as the fallback if the BEV service is unavailable.

## Consequences

- Terrain is about six times finer than before, and the licence is settled
  (attribution to BEV required).
- The build depends on a BEV URL that could move. The 5 m DGM is also no longer
  updated, which is fine for a fixed landscape.
- Heights are in a national vertical datum. Measured shoreline height is about
  587 m against the published lake level of 589 m, a difference we treat as
  unimportant for a stylized game.
- The OpenStreetMap layers (water, land cover) are a separate decision, still
  open because of ODbL share-alike.
