#!/usr/bin/env python3
"""Record the play area options as locations and work out travel between them.

Reads data/areas/areas.geojson (play options) and the 5 m terrain clip in
data/raw/. Writes ids and neighbours back into the GeoJSON and writes
data/areas/travel.json: one node per location and one edge per pair of
neighbouring locations, with the length of the easiest route between their
anchor points and the time at a given speed.

Route cost is 1 + (slope / 6 degrees) squared per metre, so the easiest route
prefers gentle ground. Needs GDAL Python bindings and numpy. Run after
build_data.py.
"""
import heapq
import json
import math
from pathlib import Path

import numpy as np
from osgeo import gdal, ogr, osr

gdal.UseExceptions()
ROOT = Path(__file__).resolve().parents[2]
AREAS = ROOT / "data" / "areas" / "areas.geojson"
OUT = ROOT / "data" / "areas" / "travel.json"
DEM = ROOT / "data" / "raw" / "almsee_dgm5_31287.tif"
CELL = 15.0  # metres, the 5 m terrain averaged 3 x 3
SPEED = 2.0  # m/s, the speed used in the editor

IDS = {
    "Core": "core",
    "North extension": "north",
    "South extension": "south",
    "East extension to the Oedseen": "east-oedseen",
    "Vorderer Springbach valley": "vorderer-springbach",
    "Hinterer Springbach valley": "hinterer-springbach",
}

wgs = osr.SpatialReference(); wgs.ImportFromEPSG(4326); wgs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
aut = osr.SpatialReference(); aut.ImportFromEPSG(31287); aut.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
fwd = osr.CoordinateTransformation(wgs, aut)
inv = osr.CoordinateTransformation(aut, wgs)


def metric(geojson_geom):
    g = ogr.CreateGeometryFromJson(json.dumps(geojson_geom))
    g.Transform(fwd)
    return g


def anchor(g):
    """Point inside g furthest from its edge, found on a 40 m grid."""
    minx, maxx, miny, maxy = g.GetEnvelope()
    edge = g.Boundary()
    best, best_d = None, -1
    for x in np.arange(minx, maxx, 40.0):
        for y in np.arange(miny, maxy, 40.0):
            p = ogr.Geometry(ogr.wkbPoint); p.AddPoint_2D(float(x), float(y))
            if g.Contains(p):
                d = p.Distance(edge)
                if d > best_d:
                    best, best_d = (float(x), float(y)), d
    return best


def main():
    fc = json.loads(AREAS.read_text())
    play = [f for f in fc["features"] if f["properties"]["layer"] == "play"]
    geoms = {IDS[f["properties"]["option"]]: metric(f["geometry"]) for f in play}

    # slope on a 15 m grid
    ds = gdal.Open(str(DEM)); gt = ds.GetGeoTransform()
    z = ds.GetRasterBand(1).ReadAsArray().astype(float)
    h, w = (z.shape[0] // 3) * 3, (z.shape[1] // 3) * 3
    z3 = z[:h, :w].reshape(h // 3, 3, w // 3, 3).mean(axis=(1, 3))
    dy, dx = np.gradient(z3, CELL)
    slope = np.degrees(np.arctan(np.hypot(dx, dy)))
    cost = 1 + (slope / 6.0) ** 2
    to_rc = lambda x, y: (int((gt[3] - y) / CELL), int((x - gt[0]) / CELL))
    to_xy = lambda r, c: (gt[0] + (c + .5) * CELL, gt[3] - (r + .5) * CELL)

    union = None
    for g in geoms.values():
        union = g.Clone() if union is None else union.Union(g)
    minx, maxx, miny, maxy = union.Buffer(300).GetEnvelope()
    r0, c0 = to_rc(minx, maxy); r1, c1 = to_rc(maxx, miny)
    sub = cost[r0:r1, c0:c1]
    H, W = sub.shape

    nodes, anchors = [], {}
    for lid, g in geoms.items():
        ax, ay = anchor(g)
        anchors[lid] = (ax, ay)
        lon, lat, _ = inv.TransformPoint(ax, ay)
        r, c = to_rc(ax, ay)
        nodes.append({"id": lid, "name": next(f["properties"]["option"] for f in play if IDS[f["properties"]["option"]] == lid),
                      "area_km2": round(g.Area() / 1e6, 2), "anchor": [round(lon, 5), round(lat, 5)],
                      "anchor_elevation_m": round(float(z3[r, c]))})

    def route(src, dst):
        s = to_rc(*anchors[src]); s = (s[0] - r0, s[1] - c0)
        t = to_rc(*anchors[dst]); t = (t[0] - r0, t[1] - c0)
        dist = np.full((H, W), np.inf); prev = {}; dist[s] = 0; pq = [(0, s)]
        while pq:
            d, (r, c) = heapq.heappop(pq)
            if d > dist[r, c]:
                continue
            if (r, c) == t:
                break
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    if dr == dc == 0:
                        continue
                    rr, cc = r + dr, c + dc
                    if 0 <= rr < H and 0 <= cc < W:
                        nd = d + (sub[r, c] + sub[rr, cc]) / 2 * math.hypot(dr, dc)
                        if nd < dist[rr, cc]:
                            dist[rr, cc] = nd; prev[(rr, cc)] = (r, c); heapq.heappush(pq, (nd, (rr, cc)))
        path = [t]
        while path[-1] in prev:
            path.append(prev[path[-1]])
        length = sum(math.hypot(a[0] - b[0], a[1] - b[1]) for a, b in zip(path, path[1:])) * CELL
        gain = sum(max(0.0, z3[r0 + b[0], c0 + b[1]] - z3[r0 + a[0], c0 + a[1]]) for a, b in zip(path[::-1], path[::-1][1:]))
        pts = []
        for r, c in path[::-1][::4] + [path[0]]:
            lon, lat, _ = inv.TransformPoint(*to_xy(r + r0, c + c0))
            pts.append([round(lon, 5), round(lat, 5)])
        return length, gain, pts

    edges, neighbours = [], {lid: [] for lid in geoms}
    ids = list(geoms)
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            if geoms[a].Buffer(5).Intersects(geoms[b]):
                length, climb, pts = route(a, b)
                straight = math.dist(anchors[a], anchors[b])
                edges.append({"from": a, "to": b, "route_m": round(length), "straight_m": round(straight),
                              "climb_m": round(climb), "minutes_at_2ms": round(length / SPEED / 60, 1),
                              "route": pts})
                neighbours[a].append(b); neighbours[b].append(a)

    for f in play:
        lid = IDS[f["properties"]["option"]]
        f["properties"]["id"] = lid
        f["properties"]["neighbours"] = sorted(neighbours[lid])
    AREAS.write_text(json.dumps(fc, indent=1, ensure_ascii=False) + "\n")
    OUT.write_text(json.dumps({"speed_m_per_s": SPEED, "nodes": nodes, "edges": edges}, indent=1) + "\n")
    for n in nodes:
        print(n["id"], n["area_km2"], "km2, anchor", n["anchor"], n["anchor_elevation_m"], "m")
    for e in edges:
        print(e["from"], "<->", e["to"], e["route_m"], "m route,", e["straight_m"], "m straight,", e["climb_m"], "m climb,", e["minutes_at_2ms"], "min")


if __name__ == "__main__":
    main()
