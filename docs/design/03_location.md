# 03 Location: the Almsee, Austria

Status: draft, exploring. Nothing here is a final decision.

## The place

The game is set in a real place: the area around the Almsee in the Almtal,
Upper Austria (see https://en.wikipedia.org/wiki/Almsee). The setting is
the lake, the valley around it, and the mountains above it.

## Decisions so far

- **Natural only.** No buildings, roads, boats, or people. The map shows
  the place as if humans were not there.
- **Stylized, based on the real world.** The lake, valley, and mountains
  should be recognizable as this place, but are not a true-scale or
  photo-realistic copy.
- **Mountains are mostly visual.** Beavers can probably go up them anyway,
  so the mountains frame the play area and do not need to be fully
  playable at true scale.
- **Generic beaver.** The beaver is not tied to a species, so we are not
  limited to local animals and plants. Lily pads, cattails and the like
  stay as in the game notes, while the look of the place stays Almsee.
- **Deepen the lake for gameplay.** The real lake is at most 5 m deep
  (about 9 m at one spring funnel), which is too shallow for the swimming
  and breath mechanics. The game lake is deeper than the real one.
- **Scale is open.** True size does not make sense for a game a beaver
  crosses in minutes. We are still exploring how much to compress.

## Open questions

- **Play area.** The whole lake and valley, or a smaller piece such as the
  northern end?
- **Scale.** How much to shrink the lake and valley. Ties to game length
  (round 1, Q3).
- **Look.** Cartoon or natural (round 2, Q35). The current lean is
  stylized because it is easier to produce.
- **Predators.** Which predators actually live in the Almtal (round 1, Q9).

## Data we want

| Layer | Used for | Priority |
| --- | --- | --- |
| Terrain (DEM) | Lake basin, valley shape, stylized mountains | Must |
| Water: lake outline, Alm river, inflowing streams | Dam sites, swimming, lodge placement | Must |
| Land cover: forest, meadow, wetland, rock | Trees to chop, reeds and cattails, open ground and predator exposure | Must |
| Tree species | Which trees are food or building material | Nice |
| Aerial imagery | Reference for drawing and placing things only | Nice |
| Local wildlife | Predator list | Nice |

## Data sources and licences

Checked 2026-10-04 from web search results and page fetches. Licence terms
below are as reported by those pages and should be re-read on the source
page before we ship anything. Each source needs attribution.

| Source | Link | Licence | Notes |
| --- | --- | --- | --- |
| Austria DGM 10 m (geoland.at, via data.gv.at) | https://www.data.gv.at/katalog/dataset/d88a1246-9684-480b-a480-ff63286b35b7 | CC BY 4.0 | GeoTIFF in ZIP files, from airborne laser scan data. Projection EPSG:31287 (MGI Austria Lambert). Whole-country download, so we crop. |
| Upper Austria DGM and other ALS products (Land OÖ) | https://data.ooe.gv.at | CC BY (the Land OÖ press page says 3.0; search results say 4.0, to be confirmed) | Finer terrain than 10 m. Resolution not confirmed. Clip tool guide: https://e-gov.ooe.gv.at/at.gv.ooe.dorisdaten/Anleitung_clipDGM.pdf |
| Copernicus DEM GLO-30 | https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM | Free and open, free account for the Copernicus Data Space download | 30 m, global. Also on AWS (https://registry.opendata.aws/copernicus-dem/) and OpenTopography. Fallback only. |
| CORINE Land Cover 2018 | https://land.copernicus.eu/en/products/corine-land-cover/clc2018 | Free for any purpose (Copernicus Land Monitoring Service terms) | 100 m raster or vector, 25 ha minimum mapping unit. Too coarse for a lake this small, so useful only for a rough forest and meadow split. |
| OpenStreetMap | https://www.openstreetmap.org | ODbL 1.0 (not looked up this session, from general knowledge) | Lake outline, streams, wetland and forest polygons. Share-alike applies to derived databases, so check before building a data layer from it. |
| Land OÖ lake profile, Almsee | https://www.land-oberoesterreich.gv.at/Mediendateien/Formulare/Dokumente%20UWD%20Abt_WW/Almsee-2021.pdf | Not stated | Facts only (see below). We would cite it, not copy it. |
| Naturschauspiel, Almsee und Umgebung | https://naturschauspiel.at/schutzgebiet/almsee-und-umgebung/ | Not stated | Habitat and wildlife notes (see below). Cite only. |

Not yet found: orthophoto terms for Upper Austria, tree species data, and
a predator list for the Almtal. The Nationalpark Kalkalpen next door has
lynx, but I found no source for wolf or bear in the Almtal itself.

## What the sources tell us about the place

These shape the design, so they are worth knowing before we pick a scale.

- **The lake is small and shallow.** About 0.85 km2 (roughly 2.1 km long
  and 700 m wide), at 589 m above sea level. The official lake profile
  gives a maximum depth of 5 m and a mean of 2.5 m. Other sources quote
  9 m for a spring funnel. The game lake will be deeper (see decisions).
- **Flow is fast.** The lake renews its water in about 10 days. It is fed
  by streams (the Aagbach is named) and by underwater springs, mostly on
  the east side, so the gravel near the springs is real.
- **The south end is wetland.** Flat, boggy ground with floating moss
  mats, a silting-up zone with water mostly under 50 cm, muddy bottom, and
  alder swamp forest. This is the natural beaver spot and a strong
  candidate for the starting area.
- **Beavers are documented there**, especially around the floodplain
  forest on the south shore (Naturschauspiel).
- **The lake was made by a rockslide** at the end of the last ice age,
  which dammed the Alm river. That is a nice story for a game about dams.
- **It is protected**, with nature reserve status since 1965. That fits
  the "natural only, no humans" setting.
- **The surroundings are almost all natural.** The lake profile puts the
  catchment at 96% forest, meadow and natural land, 3.3% water, and
  under 1% built up or farmed. Removing the human parts costs us little.
- **The mountains are the Totes Gebirge** to the south, whose northern
  slopes feed the streams.

## Next steps

1. Confirm the Upper Austria licence version, orthophoto terms, and OSM
   share-alike impact.
2. Decide scale and play area once round 1 answers are in.
3. If we commit to a data pipeline or a specific DEM, record it in an ADR
   in `docs/decisions/`.
