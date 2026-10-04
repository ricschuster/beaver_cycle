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

## Play area options

**Locked in (2026-10-04):** all six options below together are the play area,
14.7 km2. The reasoning is in `docs/decisions/0004-play-and-view-area.md`. The
options stay switchable in the editor so a smaller area can still be tried.

The play area is a set of options, each a shape with an `option` name, an
`active` flag, and a `status` (draft or approved) in
`data/areas/areas.geojson`. The side panel lists them under "Play area", and
each checkbox switches an option on or off. Only the options switched on are
drawn and counted. The stats cover the combined area, and the longest distance
and crossing time are measured across everything switched on, not within each
shape alone. The on/off choice is saved with the file.

| Option | Status | Area | What it is |
| --- | --- | --- | --- |
| Core | approved | 6.3 km2 | The suggested play area around the lake. |
| North extension | approved | 1.6 km2 | Flat ground (slope under 7 degrees) on the Alm valley floor, cut at 47.797 N. The flat strip continues to the edge of the view area at 47.815 N. |
| South extension | approved | 2.5 km2 | Flat valley floor south of the Aagbach delta, between 47.713 and 47.736 N. |
| East extension to the Oedseen | approved | 2.4 km2 | Gentle ground along a 4.7 km route east from the core, plus the shores of both lakes. |
| Vorderer Springbach valley | approved | 1.1 km2 | Side valley south of the east corridor, linked to it along the stream. |
| Hinterer Springbach valley | approved | 0.8 km2 | The next side valley east, higher and steeper. |

The extensions come from a slope map of the 5 m terrain, smoothed to 15 m, and
all sit inside the view area. Each sits flush against the others without
overlapping.

### The east route to the Oedseen

A gentle route exists from the core to the west shore of the Grosser Oedsee,
along the Straneggbach valley. It is 4.7 km long and climbs from about 600 m to
about 700 m, an average grade under 3 percent. The median slope along it is
2.5 degrees, the steepest 100 m stretch is a 15 percent grade, and 1 percent of
the route is steeper than 15 degrees. The east extension is that route widened
to the gentle ground within 450 m of it (slope under 10 degrees), plus the lake
shores (slope under 15 degrees within 500 m). Both lakes lie fully inside it.

The Springbach valleys are real streams that join the corridor from the south.
They are small, climb to 840 to 880 m, and are steeper than the core (median
slope about 8 degrees against 3.6), with only about a third flat. They are
offered as side branches, not as part of the main area.

### Combined numbers

At 2 m/s with no compression:

| Options on | Area | Longest straight line | Crossing time |
| --- | --- | --- | --- |
| Core | 6.3 km2 | 5.1 km | 43 min |
| Core, North, South | 10.4 km2 | 9.7 km | 81 min |
| Core, North, South, East | 12.8 km2 | 9.7 km | 81 min |
| All six | 14.7 km2 | 9.7 km | 81 min |

The longest straight line does not grow when the east is added, because the
north to south stretch is already the longest. It also ignores winding routes:
the walk from the core to the Oedseen is 4.7 km of travel. A route based travel
time would need a different measure.

A draw of your own gets an option named from its label. Shapes that share a
label are one option.

## Locations and travel links

Each option is also a named location with an `id` (`core`, `north`, `south`,
`east-oedseen`, `vorderer-springbach`, `hinterer-springbach`) and a list of
`neighbours` in `data/areas/areas.geojson`. The editor draws each location in
its own colour with its name and area on the map, and lists them in the legend.
A "Travel links" layer draws the easiest route between neighbouring locations
as dashed lines. Hover a line for its length, time, and climb. A link shows
only when both of its locations are switched on. The locations and links are
described in `06_locations.md`. `tools/area-editor/travel_graph.py` rebuilds
`data/areas/travel.json` and the ids from the shapes.

## Layers and legend

The side panel has an on/off checkbox for every layer: relief, water, land
cover (all of it, and each of forest, scrub, meadow, wetland and rock on its
own), play area, view area, travel links, markers, and labels. A legend on the map lists
whatever is switched on. The relief opacity slider sits above the checkboxes.

## How to use

1. Build the data once (needs GDAL Python bindings, numpy, Pillow, network):
   `python3 tools/area-editor/build_data.py`. After changing a play shape, run
   `python3 tools/area-editor/travel_graph.py` and then build again, so the ids
   and travel links follow the shapes.
2. Open `tools/area-editor/index.html` in a browser.
3. Draw with the toolbar on the map. Pick the layer in the side panel first.
4. Download the GeoJSON and save it as `data/areas/areas.geojson` to share it.
   The page also remembers your drawing in the browser.

## Data

The data covers the view area (13.895 to 14.06 E, 47.675 to 47.815 N) plus a
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
forest 224, rock 77, meadow 13, scrub 28, wetland 0.2. The wetland figure is
very low, so the south shore bog is probably not mapped as wetland in OSM.

## Limits

- OpenStreetMap relations are drawn as outlines only, not filled.
- No server: saving is a file download, not a write into the repo.
