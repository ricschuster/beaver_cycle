# 04 Area editor

Status: first version, exploring.

## Why

The play area, the scale, and the look of the Almsee setting (see
`03_location.md`) are all open. Drawing the boundaries on the real terrain
should settle them faster than discussing them.

## What it is

A single local web page, `tools/area-editor/index.html`, that shows shaded
relief of the Almsee area with water from OpenStreetMap on top. You draw:

- **Play area**: where the beaver can go.
- **View area**: the visual backdrop, including mountains the beaver does not
  need to reach.
- **Markers**: points such as the start, dam sites, or lodge spots.

The side panel shows the area of each layer, the longest distance across it,
and a crossing time. Crossing time is longest distance, divided by a
compression factor, divided by beaver speed. Both numbers are inputs, so the
tool ties the drawing to game length (round 1, Q3).

## How to use

1. Build the data once (needs GDAL Python bindings, numpy, Pillow, network):
   `python3 tools/area-editor/build_data.py`
2. Open `tools/area-editor/index.html` in a browser.
3. Draw with the toolbar on the map. Pick the layer in the side panel first.
4. Download the GeoJSON and save it as `data/areas/areas.geojson` to share it.
   The page also remembers your drawing in the browser.

## Data

- Terrain: Copernicus DEM GLO-30 (30 m), fetched from the public AWS bucket.
  The 10 m Austrian data would look better but is a whole-country download.
- Water: OpenStreetMap via Overpass (ODbL). Responses are cached in
  `data/raw/`.
- `data/raw/` and `tools/area-editor/generated/` are not tracked.

## Limits

- The 30 m terrain makes the mountains look blocky at close zoom.
- OpenStreetMap relations are drawn as outlines only, not filled.
- No server: saving is a file download, not a write into the repo.
