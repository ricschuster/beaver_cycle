#!/usr/bin/env python3
"""Cut a small scene for the camera demo out of the area editor data.

Reads the BEV 5 m terrain in data/raw/ and the editor's water and land cover in
tools/area-editor/generated/data.js (run tools/area-editor/build_data.py first).
Writes scene.json: a height grid around the south end of the Almsee, class
codes per cell, stream lines and landmarks, all in metres from the grid centre.
Throwaway prototype data, not tracked.
"""
import json
from pathlib import Path

import numpy as np
from osgeo import gdal, osr
from PIL import Image, ImageDraw

gdal.UseExceptions()
ROOT = Path(__file__).resolve().parents[2]
CENTER = (13.954, 47.7500)  # lon, lat
HALF = 1000.0  # metres from centre to edge
CELL = 8.0
N = int(2 * HALF / CELL)

wgs = osr.SpatialReference()
wgs.ImportFromEPSG(4326)
wgs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
aut = osr.SpatialReference()
aut.ImportFromEPSG(31287)
aut.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
to_aut = osr.CoordinateTransformation(wgs, aut)
E0, N0, _ = to_aut.TransformPoint(*CENTER)
west, north = E0 - HALF, N0 + HALF


def local(lon, lat):
    e, n, _ = to_aut.TransformPoint(lon, lat)
    return e - E0, -(n - N0)  # x east, z south (three.js)


def pix(x, z):
    return (x + HALF) / CELL, (z + HALF) / CELL


# terrain
ds = gdal.Warp("", str(ROOT / "data/raw/almsee_dgm5_31287.tif"), format="MEM",
               outputBounds=(west, N0 - HALF, E0 + HALF, north), xRes=CELL, yRes=CELL,
               resampleAlg="bilinear")
h = ds.GetRasterBand(1).ReadAsArray().astype(float)
assert h.shape == (N, N), h.shape

src = Path(ROOT / "tools/area-editor/generated/data.js").read_text()
data = json.loads(src[src.index("=") + 1:].strip().rstrip(";"))


def polys(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    return geom["coordinates"] if geom["type"] == "MultiPolygon" else []


def raster(features):
    img = Image.new("L", (N, N), 0)
    d = ImageDraw.Draw(img)
    for f in features:
        for rings in polys(f["geometry"]):
            for i, ring in enumerate(rings):
                pts = [pix(*local(*p)) for p in ring]
                d.polygon(pts, fill=255 if i == 0 else 0)
    return np.array(img) > 0


lake = raster([f for f in data["water"]["features"] if f["geometry"]["type"] == "Polygon"])
cover = {f["properties"]["class"]: raster([f]) for f in data["landcover"]["features"]}

# lake level and a made up lake bed: deeper with distance from the shore
level = float(np.median(h[lake])) if lake.any() else float(h.min())
dist = np.where(lake, 1e6, 0.0)
for _ in range(2):  # two pass chamfer distance in cells
    for j in range(N):
        for i in range(N):
            if dist[j, i]:
                if j: dist[j, i] = min(dist[j, i], dist[j - 1, i] + 1)
                if i: dist[j, i] = min(dist[j, i], dist[j, i - 1] + 1)
    for j in range(N - 1, -1, -1):
        for i in range(N - 1, -1, -1):
            if dist[j, i]:
                if j < N - 1: dist[j, i] = min(dist[j, i], dist[j + 1, i] + 1)
                if i < N - 1: dist[j, i] = min(dist[j, i], dist[j, i + 1] + 1)
depth = np.minimum(dist * CELL * 0.12, 14.0)
h = np.where(lake, level - 0.5 - depth, h)

# class code per cell: 0 ground, 1 meadow, 2 forest, 3 scrub, 4 rock, 5 wetland, 9 lake
code = np.zeros((N, N), dtype=int)
for c, k in ((1, "meadow"), (3, "scrub"), (2, "forest"), (5, "wetland"), (4, "rock")):
    if k in cover:
        code[cover[k]] = c
code[lake] = 9

streams = []
for f in data["water"]["features"]:
    if f["geometry"]["type"] != "LineString":
        continue
    pts = [local(*p) for p in f["geometry"]["coordinates"]]
    if any(abs(x) < HALF and abs(z) < HALF for x, z in pts):
        streams.append({"name": f["properties"].get("name", ""),
                        "pts": [[round(x, 1), round(z, 1)] for x, z in pts]})

marks = {}
for f in data["areas"]["features"]:
    if f["geometry"]["type"] == "Point":
        x, z = local(*f["geometry"]["coordinates"])
        marks[f["properties"]["name"]] = [round(x, 1), round(z, 1)]

out = {"n": N, "cell": CELL, "half": HALF, "lakeLevel": round(level, 2),
       "heights": [round(v, 1) for v in h.flatten()],
       "codes": "".join(str(c) for c in code.flatten()),
       "streams": streams, "marks": marks}
(Path(__file__).parent / "scene.json").write_text(json.dumps(out, separators=(",", ":")))
print(f"{N}x{N} cells, lake level {level:.1f} m, relief {h.min():.0f} to {h.max():.0f} m, "
      f"{len(streams)} streams, marks {marks}")
