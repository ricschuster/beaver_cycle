#!/usr/bin/env python3
"""Fetch terrain and water for the Almsee area and write generated/data.js.

Needs: GDAL Python bindings, numpy, Pillow, network access.
Terrain: Copernicus DEM GLO-30 (public AWS bucket). Water: OpenStreetMap via
Overpass. Output goes to tools/area-editor/generated/ (not tracked).
"""
import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from osgeo import gdal, osr
from PIL import Image

gdal.UseExceptions()

# west, south, east, north (degrees). Wider than the lake so the mountains show.
BBOX = (13.85, 47.65, 14.15, 47.85)
HERE = Path(__file__).parent
OUT = HERE / "generated"
RAW = HERE.parent.parent / "data" / "raw"
DEM_BASE = "/vsicurl/https://copernicus-dem-30m.s3.amazonaws.com"
USER_AGENT = "beaver-cycle-area-editor/0.1 (ric.schuster@proton.me)"


def tile_url(lon_deg):
    name = f"Copernicus_DSM_COG_10_N47_00_E{lon_deg:03d}_00_DEM"
    return f"{DEM_BASE}/{name}/{name}.tif"


def fetch_dem():
    RAW.mkdir(parents=True, exist_ok=True)
    path = RAW / "almsee_copdem30_3857.tif"
    gdal.Warp(
        str(path),
        [tile_url(13), tile_url(14)],
        dstSRS="EPSG:3857",
        outputBounds=to_mercator_bounds(),
        xRes=30,
        yRes=30,
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
    cache = RAW / "osm_water.json"
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
    w, s, e, n = BBOX
    data = {"bounds": [[s, w], [n, e]], "zmin": zmin, "zmax": zmax, "water": water}
    (OUT / "data.js").write_text("window.AREA_DATA = " + json.dumps(data) + ";\n")
    print(f"relief {size}, elevation {zmin:.0f} to {zmax:.0f} m, {len(water['features'])} water features")


if __name__ == "__main__":
    main()
