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

## Suggested areas

`data/areas/areas.geojson` holds a first suggestion, which the editor loads
when you have no drawing of your own ("Load repo areas" brings it back):

- **Play area**: the valley floor below 630 m that connects to the lake,
  between 47.737 and 47.777 N, smoothed. About 6 km2 including the 0.85 km2
  lake. It follows the real valley, so it is long and narrow.
- **View area**: a rough box around the valley walls and the northern edge
  of the Totes Gebirge.
- **Labels**: the lake, the Aagbach inflow, the south shore bog, a suggested
  start lodge, the Weissenegg stream inflow, the Alm river outflow, and the
  Totes Gebirge. The inflow and outflow points are candidate dam sites. The
  start lodge position is a guess based on the wetland notes in
  `03_location.md`.

## Layers and legend

The side panel has an on/off checkbox for every layer: relief, water, land
cover (all of it, and each of forest, scrub, meadow, wetland and rock on its
own), play area, view area, markers, and labels. A legend on the map lists
whatever is switched on. The relief opacity slider sits above the checkboxes.

## How to use

1. Build the data once (needs GDAL Python bindings, numpy, Pillow, network):
   `python3 tools/area-editor/build_data.py`
2. Open `tools/area-editor/index.html` in a browser.
3. Draw with the toolbar on the map. Pick the layer in the side panel first.
4. Download the GeoJSON and save it as `data/areas/areas.geojson` to share it.
   The page also remembers your drawing in the browser.

## Data

The data covers the view area (13.895 to 14.025 E, 47.675 to 47.815 N) plus a
3 km buffer, so the play area can grow.

- Terrain: BEV 5 m DGM (CC BY 4.0), read from an online COG and clipped. The
  choice is recorded in `docs/decisions/0002-terrain-source.md`. The relief
  image in the editor is drawn at 15 m per pixel to keep the page light.
- Water: OpenStreetMap via Overpass (ODbL). How OSM data may be used is in
  `docs/decisions/0003-openstreetmap-data-use.md`.
- Land cover: OpenStreetMap forest, wetland, scrub, meadow and rock polygons,
  saved to `data/raw/landcover.geojson` and shown in the editor with the
  "Land cover" checkbox (simplified to 20 m). Overlaps between classes are
  merged within a class only, and the lake is not cut out of the forest class.
- Overpass responses are cached in `data/raw/` by area. `data/raw/` and
  `tools/area-editor/generated/` are not tracked.

Land cover in the buffered area, from OpenStreetMap (km2, classes may overlap):
forest 193, rock 68, meadow 12, scrub 23, wetland 0.2. The wetland figure is
very low, so the south shore bog is probably not mapped as wetland in OSM.

## Limits

- OpenStreetMap relations are drawn as outlines only, not filled.
- No server: saving is a file download, not a write into the repo.
