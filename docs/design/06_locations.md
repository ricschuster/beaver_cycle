# 06 Locations and travel

Status: the six play locations are approved (2026-10-04). Travel between them
is an idea, not a decision. Round 2 and later sessions decide how, or whether,
the beaver travels.

## The six locations

Together these are the play area, 14.7 km2. Each is a named place that could
become a zone in the game. The shapes and ids live in
`data/areas/areas.geojson`, and the editor draws them (`04_area_editor.md`).

| Id | Name | Area | Anchor elevation | What it is |
| --- | --- | --- | --- | --- |
| `core` | Core | 6.3 km2 | 592 m | The Almsee and the valley floor around it, with the south wetland and the lake outflow. The natural starting place. |
| `north` | North extension | 1.6 km2 | 574 m | Flat Alm valley floor below the outflow. |
| `south` | South extension | 2.5 km2 | 604 m | Flat valley floor south of the Aagbach delta, where several streams join, at the foot of the Totes Gebirge. |
| `east-oedseen` | East extension to the Oedseen | 2.4 km2 | 706 m | A gentle corridor east along the Straneggbach, and both Oedsee lakes. |
| `vorderer-springbach` | Vorderer Springbach valley | 1.1 km2 | 768 m | Side valley with a stream, joining the east corridor from the south. |
| `hinterer-springbach` | Hinterer Springbach valley | 0.8 km2 | 808 m | The next side valley east, higher and steeper. |

The anchor is the point inside each area that is furthest from its edge. It is
a stand-in for "the middle of the place", not a gateway, so edge to edge routes
are shorter than the figures below.

## How they connect

Core is the hub. North, south, and east each touch it. East touches both
Springbach valleys, and the two valleys touch each other.

| From | To | Route | Straight line | Climb | Time at 2 m/s |
| --- | --- | --- | --- | --- | --- |
| Core | North | 2.5 km | 2.1 km | 8 m | 21 min |
| Core | South | 3.6 km | 3.5 km | 20 m | 30 min |
| Core | East | 7.7 km | 4.9 km | 173 m | 64 min |
| East | Vorderer Springbach | 5.6 km | 3.2 km | 208 m | 47 min |
| East | Hinterer Springbach | 2.8 km | 1.7 km | 222 m | 23 min |
| Vorderer Springbach | Hinterer Springbach | 1.9 km | 1.5 km | 112 m | 16 min |

The route is the easiest path between the two anchors on the 5 m terrain, where
steep ground costs more, and it does not account for water, snow, or obstacles.
The times assume 2 m/s and no compression of distances. Between the lake and
the Oedsee, the gentle corridor itself is 4.7 km from the edge of the core.
The data is in `data/areas/travel.json`, rebuilt by
`tools/area-editor/travel_graph.py`.

## Idea: travel between locations

Making each location a place the beaver can travel between fits the shape of
the area: one hub and a few branches. Options to weigh later:

- Walk or swim the whole way, with the travel times above as the cost.
- Quick travel between places the beaver has already visited.
- Loading zones at the edges, with each location as its own small map.

Open questions for later sessions:

- Does travel matter for the game, or is the whole area one connected map?
- How does a baby, a teenager, and a parent travel? Who comes along?
- How do seasons change travel (snow on the climbs, ice on the lakes)?
- Are the Springbach valleys part of the main game or optional side places?
- Does a grown beaver move to a new location to start its own family
  (round 1, Q8)?
