#!/usr/bin/env python3
"""Fetch terrain, water and land cover for the Almsee area.

Needs: GDAL Python bindings, numpy, Pillow, network access.
Terrain: BEV DGM 5 m (CC BY 4.0, online COG), clipped to BBOX and kept in
data/raw/. Water and land cover: OpenStreetMap via Overpass (ODbL), cached in
data/raw/. The editor files go to tools/area-editor/generated/ (not tracked).
"""
import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from osgeo import gdal, ogr, osr
from PIL import Image

gdal.UseExceptions()

# west, south, east, north (degrees). The view area (13.895, 47.675, 14.025,
# 47.815) plus a 3 km buffer in case the play area grows.
BBOX = (13.855, 47.648, 14.065, 47.842)
HERE = Path(__file__).parent
OUT = HERE / "generated"
RAW = HERE.parent.parent / "data" / "raw"
BEV_DGM5 = "/vsicurl/https://data.bev.gv.at/download/DGM/Hoehenraster/DGM_R5.tif"
RELIEF_RES = 15  # metres per pixel in Web Mercator for the editor image
DEM_BASE = "/vsicurl/https://copernicus-dem-30m.s3.amazonaws.com"
USER_AGENT = "beaver-cycle-area-editor/0.1 (ric.schuster@proton.me)"


def tile_url(lon_deg):
    name = f"Copernicus_DSM_COG_10_N47_00_E{lon_deg:03d}_00_DEM"
    return f"{DEM_BASE}/{name}/{name}.tif"


def fetch_dem():
    """Clip the BEV 5 m DGM to BBOX (native CRS), then warp to Web Mercator."""
    RAW.mkdir(parents=True, exist_ok=True)
    native = RAW / "almsee_dgm5_31287.tif"
    if not native.exists():
        gdal.Warp(
            str(native),
            BEV_DGM5,
            outputBounds=BBOX,
            outputBoundsSRS="EPSG:4326",
            creationOptions=["COMPRESS=DEFLATE", "TILED=YES", "PREDICTOR=3"],
        )
    path = RAW / "almsee_dgm5_3857.tif"
    gdal.Warp(
        str(path),
        str(native),
        dstSRS="EPSG:3857",
        outputBounds=to_mercator_bounds(),
        xRes=RELIEF_RES,
        yRes=RELIEF_RES,
        resampleAlg="cubic",
    )
    return path


def to_mercator_bounds():
    src = osr.SpatialReference()
    src.ImportFromEPSG(4326)
    src.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    dst = osr.SpatialReference()
    dst.ImportFromEPSG(3857)
    dst.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    tr = osr.CoordinateTransformation(src, dst)
    x0, y0, _ = tr.TransformPoint(BBOX[0], BBOX[1])
    x1, y1, _ = tr.TransformPoint(BBOX[2], BBOX[3])
    return (x0, y0, x1, y1)


def hillshade(z, cell, azimuth=315.0, altitude=40.0, exaggeration=1.6):
    dzdy, dzdx = np.gradient(z * exaggeration, cell)
    slope = np.arctan(np.hypot(dzdx, dzdy))
    aspect = np.arctan2(dzdy, -dzdx)
    az = math.radians(360.0 - azimuth + 90.0)
    alt = math.radians(altitude)
    shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    return np.clip(shade, 0, 1)


RAMP = [  # elevation (m), colour
    (480, (86, 120, 72)),
    (800, (122, 150, 84)),
    (1200, (96, 110, 70)),
    (1600, (150, 140, 112)),
    (2000, (184, 178, 168)),
    (2500, (240, 240, 240)),
]


def tint(z):
    elevs = [e for e, _ in RAMP]
    rgb = np.zeros(z.shape + (3,))
    for c in range(3):
        rgb[..., c] = np.interp(z, elevs, [col[c] for _, col in RAMP])
    return rgb


def render_relief(dem_path):
    ds = gdal.Open(str(dem_path))
    z = ds.GetRasterBand(1).ReadAsArray().astype(float)
    gt = ds.GetGeoTransform()
    # Web Mercator stretches distances by 1/cos(lat); undo that for slopes.
    cell = abs(gt[1]) * math.cos(math.radians((BBOX[1] + BBOX[3]) / 2))
    shade = hillshade(z, cell)
    rgb = tint(z) * (0.45 + 0.75 * shade[..., None])
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / "relief.png", optimize=True)
    return z.min(), z.max(), img.size


def fetch_water():
    w, s, e, n = BBOX
    box = f"{s},{w},{n},{e}"
    query = (
        "[out:json][timeout:90];("
        f'way["natural"="water"]({box});'
        f'relation["natural"="water"]({box});'
        f'way["waterway"~"^(river|stream)$"]({box});'
        ");out geom;"
    )
    return overpass(query, "osm_water")


def overpass(query, stem):
    """Run an Overpass query, cached in data/raw/ by name and BBOX."""
    tag = "_".join(f"{v:.3f}" for v in BBOX)
    cache = RAW / f"{stem}_{tag}.json"
    if cache.exists():
        return json.loads(cache.read_text())
    body = urllib.parse.urlencode({"data": query}).encode()
    for attempt in range(4):
        req = urllib.request.Request(
            "https://overpass-api.de/api/interpreter",
            data=body,
            headers={"User-Agent": USER_AGENT},
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                osm = json.load(resp)
            cache.write_text(json.dumps(osm))
            return osm
        except urllib.error.URLError as err:
            print(f"Overpass attempt {attempt + 1} failed: {err}")
            time.sleep(10 * (attempt + 1))
    raise SystemExit("Overpass unavailable. Try again later.")


LANDCOVER = {  # OSM tag -> game-relevant class
    ("natural", "wood"): "forest",
    ("landuse", "forest"): "forest",
    ("natural", "wetland"): "wetland",
    ("natural", "scrub"): "scrub",
    ("natural", "heath"): "scrub",
    ("natural", "grassland"): "meadow",
    ("landuse", "meadow"): "meadow",
    ("natural", "scree"): "rock",
    ("natural", "bare_rock"): "rock",
    ("natural", "shingle"): "rock",
}


def fetch_landcover():
    w, s, e, n = BBOX
    box = f"{s},{w},{n},{e}"
    parts = []
    for (key, val) in LANDCOVER:
        parts.append(f'way["{key}"="{val}"]({box});relation["{key}"="{val}"]({box});')
    query = "[out:json][timeout:180];(" + "".join(parts) + ");out geom;"
    return overpass(query, "osm_landcover")


def join_rings(segments):
    """Join way segments (lists of [lon, lat]) end to end into closed rings."""
    segs = [list(sg) for sg in segments if len(sg) > 1]
    rings = []
    while segs:
        ring = segs.pop()
        grew = True
        while grew and ring[0] != ring[-1]:
            grew = False
            for i, sg in enumerate(segs):
                if sg[0] == ring[-1]:
                    ring += sg[1:]
                elif sg[-1] == ring[-1]:
                    ring += sg[::-1][1:]
                elif sg[-1] == ring[0]:
                    ring = sg[:-1] + ring
                elif sg[0] == ring[0]:
                    ring = sg[::-1][:-1] + ring
                else:
                    continue
                segs.pop(i)
                grew = True
                break
        if ring[0] == ring[-1] and len(ring) > 3:
            rings.append(ring)
    return rings


def landcover_geojson(osm):
    feats = []
    for el in osm["elements"]:
        tags = el.get("tags", {})
        cls = next((c for (k, v), c in LANDCOVER.items() if tags.get(k) == v), None)
        if cls is None:
            continue
        if el["type"] == "way" and "geometry" in el:
            rings = join_rings([[[p["lon"], p["lat"]] for p in el["geometry"]]])
        elif el["type"] == "relation":
            outers = [[[p["lon"], p["lat"]] for p in m["geometry"]]
                      for m in el.get("members", []) if m.get("role") == "outer" and m.get("geometry")]
            rings = join_rings(outers)
            inners = [[[p["lon"], p["lat"]] for p in m["geometry"]]
                      for m in el.get("members", []) if m.get("role") == "inner" and m.get("geometry")]
            for ring in join_rings(inners):
                feats.append({"type": "Feature", "properties": {"class": cls, "hole": True},
                              "geometry": {"type": "Polygon", "coordinates": [ring]}})
        else:
            continue
        for ring in rings:
            feats.append({"type": "Feature", "properties": {"class": cls},
                          "geometry": {"type": "Polygon", "coordinates": [ring]}})
    return {"type": "FeatureCollection", "features": feats}


def landcover_summary(fc):
    """Area per class in km2: overlaps merged, holes removed, clipped to BBOX."""
    wgs = osr.SpatialReference()
    wgs.ImportFromEPSG(4326)
    wgs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    aut = osr.SpatialReference()
    aut.ImportFromEPSG(31287)
    aut.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    to_aut = osr.CoordinateTransformation(wgs, aut)
    w, s, e, n = BBOX
    box = ogr.CreateGeometryFromWkt(f"POLYGON(({w} {s},{e} {s},{e} {n},{w} {n},{w} {s}))")
    solid, holes = {}, {}
    for f in fc["features"]:
        geom = ogr.CreateGeometryFromJson(json.dumps(f["geometry"])).MakeValid()
        bucket = holes if f["properties"].get("hole") else solid
        cls = f["properties"]["class"]
        bucket[cls] = geom if cls not in bucket else bucket[cls].Union(geom)
    totals = {}
    for cls, geom in solid.items():
        if cls in holes:
            geom = geom.Difference(holes[cls])
        geom = geom.Intersection(box)
        geom.Transform(to_aut)
        totals[cls] = round(geom.Area() / 1e6, 1)
    return dict(sorted(totals.items()))


def to_geojson(osm):
    feats = []

    def coords(geom):
        return [[p["lon"], p["lat"]] for p in geom]

    for el in osm["elements"]:
        tags = el.get("tags", {})
        if el["type"] == "way" and "geometry" in el:
            pts = coords(el["geometry"])
            closed = len(pts) > 3 and pts[0] == pts[-1] and tags.get("natural") == "water"
            geom = {"type": "Polygon", "coordinates": [pts]} if closed else {"type": "LineString", "coordinates": pts}
            kind = "water" if tags.get("natural") == "water" else "stream"
            feats.append({"type": "Feature", "properties": {"kind": kind, "name": tags.get("name", "")}, "geometry": geom})
        elif el["type"] == "relation":
            for m in el.get("members", []):
                if m.get("geometry") and m.get("role") == "outer":
                    feats.append({
                        "type": "Feature",
                        "properties": {"kind": "water-outline", "name": tags.get("name", "")},
                        "geometry": {"type": "LineString", "coordinates": coords(m["geometry"])},
                    })
    return {"type": "FeatureCollection", "features": feats}


def main():
    dem = fetch_dem()
    zmin, zmax, size = render_relief(dem)
    water = to_geojson(fetch_water())
    lc = landcover_geojson(fetch_landcover())
    (RAW / "landcover.geojson").write_text(json.dumps(lc))
    print("land cover km2 in the box (classes may overlap each other):", landcover_summary(lc))
    w, s, e, n = BBOX
    data = {"bounds": [[s, w], [n, e]], "zmin": zmin, "zmax": zmax, "water": water}
    (OUT / "data.js").write_text("window.AREA_DATA = " + json.dumps(data) + ";\n")
    print(f"relief {size}, elevation {zmin:.0f} to {zmax:.0f} m, {len(water['features'])} water features")


if __name__ == "__main__":
    main()
