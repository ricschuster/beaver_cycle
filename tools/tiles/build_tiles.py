#!/usr/bin/env python3
"""Cut the core of the game world into tiles the game can stream.

Reads the BEV 5 m terrain and the OpenStreetMap water and land cover in
data/raw/ (run tools/area-editor/build_data.py first). Writes public/tiles/
(untracked, see docs/design/14_m2_streamed_core_plan.md):

  index.json            origin, tile grid, class codes, lakes, anchors, tile list
  L0/<tx>_<tz>.bin      5 m tiles, L1 at 10 m, L2 at 20 m
  water/<tx>_<tz>.json  lake level and stream lines for tiles that have water

Local coordinates: metres, x east, z south, origin at the core anchor from
data/areas/travel.json. Tile (tx, tz) covers x from tx*320 to (tx+1)*320 and
the same for z. All levels are cut from one global 5 m vertex grid, so
neighbouring tiles share their edge vertices exactly and a coarser level only
drops every second or fourth vertex.

Tile file, little endian:
  bytes 0-3    magic "BCT1"
  byte 4       level (0, 1, 2)
  byte 5       0
  bytes 6-7    uint16 n, cells per side (64, 32, 16)
  bytes 8-11   int32 qmin
  bytes 12-15  float32 scale in metres per step
  then         uint16 x (n+1)^2 heights, row major, z rows from north to south
  then         uint8 x n^2 land cover classes, same order
Height in metres = (stored + qmin) * scale.
"""
import argparse
import json
import struct
import sys
from pathlib import Path

import numpy as np
from osgeo import gdal, ogr, osr
from PIL import Image, ImageDraw

gdal.UseExceptions()
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "area-editor"))
import build_data  # noqa: E402

CELL = 5.0  # metres, the finest the data has (ADR 0002)
TILE_CELLS = 64  # cells per tile side at level 0
TILE = CELL * TILE_CELLS  # 320 m
STEPS = (1, 2, 4)  # level 0, 1, 2 vertex steps
SCALE = 0.05  # metres per stored height step
MARGIN = 640.0  # metres of tiles kept around the core shape
LAKE_BED_SLOPE = 0.12  # metres of depth per metre from the shore
LAKE_BED_MAX = 14.0
LAKE_BED_OFFSET = 0.5  # metres the bed sits below the lake level at the shore
# The south end is a shallow bog (03_location.md): water under 50 cm. The bed is
# made shallow by two weights, the larger wins. One ramps up along the lake
# toward the south (z grows southward), the other follows OSM wetland cells.
BOG_RAMP_Z = (1100.0, 1700.0)  # z in metres where the south ramp starts and is full
BOG_WETLAND_REACH = 60.0  # metres from a wetland cell over which the shallows fade out
BOG_BED_OFFSET = 0.3  # metres below the lake level in full shallows
CLASSES = {"ground": 0, "meadow": 1, "forest": 2, "scrub": 3, "rock": 4, "wetland": 5, "lake": 9}
PAINT_ORDER = ("meadow", "scrub", "forest", "wetland", "rock")  # later wins, as in the camera demo
OUT = ROOT / "public" / "tiles"

wgs = osr.SpatialReference()
wgs.ImportFromEPSG(4326)
wgs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
aut = osr.SpatialReference()
aut.ImportFromEPSG(31287)
aut.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
to_aut = osr.CoordinateTransformation(wgs, aut)

travel = json.loads((ROOT / "data/areas/travel.json").read_text())
areas = json.loads((ROOT / "data/areas/areas.geojson").read_text())
CORE = next(n for n in travel["nodes"] if n["id"] == "core")
E0, N0, _ = to_aut.TransformPoint(*CORE["anchor"])


def local_pts(coords):
    """lon/lat points to local metres (x east, z south)."""
    pts = to_aut.TransformPoints([(p[0], p[1]) for p in coords])
    return [(e - E0, -(n - N0)) for e, n, _ in pts]


def local(lon, lat):
    return local_pts([(lon, lat)])[0]


def polygons(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    return geom["coordinates"] if geom["type"] == "MultiPolygon" else []


class Grid:
    """The global lattice. Vertices at x0 + i*CELL, cells between them."""

    def __init__(self, tx0, tz0, ntx, ntz):
        self.tx0, self.tz0, self.ntx, self.ntz = tx0, tz0, ntx, ntz
        self.x0, self.z0 = tx0 * TILE, tz0 * TILE
        self.ncx, self.ncz = ntx * TILE_CELLS, ntz * TILE_CELLS

    def raster(self, rings_list, vertices):
        """Boolean mask of polygons (list of ring lists in local metres).

        vertices=True samples at the vertex lattice, False at cell centres.
        """
        nx, nz = (self.ncx + 1, self.ncz + 1) if vertices else (self.ncx, self.ncz)
        shift = 0.5 if vertices else 0.0
        img = Image.new("L", (nx, nz), 0)
        d = ImageDraw.Draw(img)
        for rings in rings_list:
            for i, ring in enumerate(rings):
                pts = [((x - self.x0) / CELL + shift, (z - self.z0) / CELL + shift) for x, z in ring]
                if len(pts) >= 3:
                    d.polygon(pts, fill=255 if i == 0 else 0)
        return np.array(img) > 0


def core_extent():
    core = next(f for f in areas["features"] if f["properties"].get("id") == "core")
    pts = local_pts(core["geometry"]["coordinates"][0])
    xs, zs = [p[0] for p in pts], [p[1] for p in pts]
    tx0 = int(np.floor((min(xs) - MARGIN) / TILE))
    tx1 = int(np.floor((max(xs) + MARGIN) / TILE))
    tz0 = int(np.floor((min(zs) - MARGIN) / TILE))
    tz1 = int(np.floor((max(zs) + MARGIN) / TILE))
    return Grid(tx0, tz0, tx1 - tx0 + 1, tz1 - tz0 + 1)


def read_heights(g):
    """BEV heights bilinear sampled at the vertex lattice."""
    nx, nz = g.ncx + 1, g.ncz + 1
    west, east = E0 + g.x0 - CELL / 2, E0 + g.x0 + g.ncx * CELL + CELL / 2
    north, south = N0 - g.z0 + CELL / 2, N0 - g.z0 - g.ncz * CELL - CELL / 2
    ds = gdal.Warp("", str(ROOT / "data/raw/almsee_dgm5_31287.tif"), format="MEM",
                   outputBounds=(west, south, east, north), width=nx, height=nz,
                   resampleAlg="bilinear", dstNodata=0)
    h = ds.GetRasterBand(1).ReadAsArray().astype(np.float64)
    assert h.shape == (nz, nx), h.shape
    if (h <= 0).any():
        raise SystemExit("the BEV raster has gaps inside the tile region")
    return h


def read_water():
    """Lake polygons (local rings, name) and stream lines (local points, name)."""
    src = RAW_WATER.read_text()
    fc = build_data.to_geojson(json.loads(src))
    lakes, streams = [], []
    for f in fc["features"]:
        name = f["properties"].get("name", "")
        if f["properties"]["kind"] == "water":
            for rings in polygons(f["geometry"]):
                lakes.append(([local_pts(r) for r in rings], name))
        else:
            g = f["geometry"]
            lines = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
            for line in lines:
                streams.append((local_pts(line), name))
    return lakes, streams


RAW_WATER = next((ROOT / "data/raw").glob("osm_water_*.json"), ROOT / "data/raw/osm_water.json")


def read_landcover(g):
    """Class code per cell, painted from the OSM land cover polygons."""
    fc = json.loads((ROOT / "data/raw/landcover.geojson").read_text())
    x1, z1 = g.x0 + g.ncx * CELL, g.z0 + g.ncz * CELL
    solid = {k: [] for k in PAINT_ORDER}
    holes = {k: [] for k in PAINT_ORDER}
    for f in fc["features"]:
        cls = f["properties"]["class"]
        if cls not in solid:
            continue
        for rings in polygons(f["geometry"]):
            pts = local_pts(rings[0])
            xs, zs = [p[0] for p in pts], [p[1] for p in pts]
            if max(xs) < g.x0 or min(xs) > x1 or max(zs) < g.z0 or min(zs) > z1:
                continue
            (holes if f["properties"].get("hole") else solid)[cls].append([pts])
    code = np.zeros((g.ncz, g.ncx), dtype=np.uint8)
    for cls in PAINT_ORDER:
        mask = g.raster(solid[cls], vertices=False) & ~g.raster(holes[cls], vertices=False)
        code[mask] = CLASSES[cls]
    return code


def shore_distance(mask):
    """Distance in cells from each lake cell to the nearest non lake cell."""
    drv = gdal.GetDriverByName("MEM")
    nz, nx = mask.shape
    src = drv.Create("", nx, nz, 1, gdal.GDT_Byte)
    src.GetRasterBand(1).WriteArray(mask.astype(np.uint8))
    dst = drv.Create("", nx, nz, 1, gdal.GDT_Float32)
    gdal.ComputeProximity(src.GetRasterBand(1), dst.GetRasterBand(1), ["VALUES=0", "DISTUNITS=PIXEL"])
    return dst.GetRasterBand(1).ReadAsArray().astype(np.float64)


def shallow_weight(g, wetland):
    """0 in open water, 1 in the bog. Combines the south ramp and nearness to wetland.

    `wetland` is the class mask per cell. Returns a weight per vertex.
    """
    z = g.z0 + np.arange(g.ncz + 1) * CELL
    z0, z1 = BOG_RAMP_Z
    south = np.clip((z - z0) / (z1 - z0), 0.0, 1.0)[:, None] * np.ones(g.ncx + 1)
    if not wetland.any():
        return south
    vert = np.pad(wetland, ((0, 1), (0, 1)))
    vert[1:, :] |= vert[:-1, :]
    vert[:, 1:] |= vert[:, :-1]
    near = np.clip(1.0 - shore_distance(~vert) * CELL / BOG_WETLAND_REACH, 0.0, 1.0)
    return np.maximum(south, near)


def make_lake_bed(g, h, lakes, wetland):
    """Lower the lake floor below a flat level. BEV has a flat lake, the game's is deeper.

    The bed is deep in open water and shallow in the south bog (see `shallow_weight`).
    Returns the new heights, the class 9 cell mask, and the lake list with levels.
    """
    vert = np.zeros(h.shape, dtype=bool)
    level = np.full(h.shape, np.nan)
    found = []
    for rings, name in lakes:
        m = g.raster([rings], vertices=True)
        if not m.any():
            continue
        lv = float(np.median(h[m]))
        level[m] = lv
        vert |= m
        found.append({"name": name, "level_m": round(lv, 2)})
    dist = shore_distance(vert)
    w = shallow_weight(g, wetland)
    depth = np.minimum(dist * CELL * LAKE_BED_SLOPE, LAKE_BED_MAX) * (1.0 - w)
    offset = LAKE_BED_OFFSET + (BOG_BED_OFFSET - LAKE_BED_OFFSET) * w
    h = np.where(vert, level - offset - depth, h)
    cell = g.raster([r for r, _ in lakes], vertices=False)
    return h, cell, vert, level, found


def block_mode(code, step):
    """Most common class in each step x step block (ties go to the lower code)."""
    if step == 1:
        return code
    nz, nx = code.shape
    keys = sorted(CLASSES.values())
    counts = np.stack([(code == k).reshape(nz // step, step, nx // step, step).sum(axis=(1, 3))
                       for k in keys])
    return np.array(keys, dtype=np.uint8)[counts.argmax(axis=0)]


def write_tile(path, level, step, q, code):
    n = TILE_CELLS // step
    qmin = int(q.min())
    stored = q - qmin
    if stored.max() > 0xFFFF:
        raise SystemExit(f"{path}: height range too large for 16 bits")
    assert q.shape == (n + 1, n + 1) and code.shape == (n, n)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        f.write(b"BCT1" + struct.pack("<BBHif", level, 0, n, qmin, SCALE))
        f.write(stored.astype("<u2").tobytes())
        f.write(code.astype(np.uint8).tobytes())


def clip_lines(streams, tx, tz):
    box = ogr.CreateGeometryFromWkt(
        f"POLYGON(({tx*TILE} {tz*TILE},{(tx+1)*TILE} {tz*TILE},{(tx+1)*TILE} {(tz+1)*TILE},"
        f"{tx*TILE} {(tz+1)*TILE},{tx*TILE} {tz*TILE}))")
    out = []
    for pts, name in streams:
        line = ogr.Geometry(ogr.wkbLineString)
        for x, z in pts:
            line.AddPoint_2D(x, z)
        if not line.Intersects(box):
            continue
        cut = line.Intersection(box)
        parts = [cut] if cut.GetGeometryType() == ogr.wkbLineString else \
            [cut.GetGeometryRef(i) for i in range(cut.GetGeometryCount())]
        for p in parts:
            if p.GetPointCount() >= 2 and p.GetGeometryType() == ogr.wkbLineString:
                out.append({"name": name, "pts": [[round(p.GetX(i), 1), round(p.GetY(i), 1)]
                                                 for i in range(p.GetPointCount())]})
    return out


def anchors(g):
    """Anchors for the test menu: travel nodes plus the named markers."""
    x1, z1 = g.x0 + g.ncx * CELL, g.z0 + g.ncz * CELL
    out = []

    def add(kind, id_, name, lon, lat, elev=None):
        x, z = local(lon, lat)
        out.append({"kind": kind, "id": id_, "name": name, "x": round(x, 1), "z": round(z, 1),
                    "elevation_m": elev, "inTiles": bool(g.x0 <= x <= x1 and g.z0 <= z <= z1)})

    for n in travel["nodes"]:
        add("location", n["id"], n["name"], *n["anchor"], n.get("anchor_elevation_m"))
    for f in areas["features"]:
        if f["geometry"]["type"] == "Point":
            p = f["properties"]
            add("marker", p["name"].lower().replace(" ", "-"), p["name"], *f["geometry"]["coordinates"])
    return out


def build(out=OUT):
    out = Path(out)
    g = core_extent()
    h = read_heights(g)
    lakes, streams = read_water()
    code = read_landcover(g)
    h, lake_cells, lake_vert, lake_level, lake_list = make_lake_bed(
        g, h, lakes, code == CLASSES["wetland"])
    code[lake_cells] = CLASSES["lake"]
    q = np.rint(h / SCALE).astype(np.int64)

    tiles = []
    for tz in range(g.tz0, g.tz0 + g.ntz):
        for tx in range(g.tx0, g.tx0 + g.ntx):
            vi, vj = (tx - g.tx0) * TILE_CELLS, (tz - g.tz0) * TILE_CELLS
            for level, step in enumerate(STEPS):
                n = TILE_CELLS // step
                qt = q[vj:vj + TILE_CELLS + 1:step, vi:vi + TILE_CELLS + 1:step]
                ct = block_mode(code, step)[vj // step:vj // step + n, vi // step:vi // step + n]
                write_tile(out / f"L{level}" / f"{tx}_{tz}.bin", level, step, qt, ct)
            tile_lake = lake_level[vj:vj + TILE_CELLS + 1, vi:vi + TILE_CELLS + 1]
            lines = clip_lines(streams, tx, tz)
            has_lake = bool(np.isfinite(tile_lake).any())
            if has_lake or lines:
                doc = {"lakeLevel_m": round(float(np.nanmedian(tile_lake)), 2) if has_lake else None,
                       "streams": lines}
                (out / "water").mkdir(parents=True, exist_ok=True)
                (out / "water" / f"{tx}_{tz}.json").write_text(json.dumps(doc, separators=(",", ":")))
            tiles.append({"tx": tx, "tz": tz, "water": bool(has_lake or lines),
                          "lakeLevel_m": round(float(np.nanmedian(tile_lake)), 2) if has_lake else None,
                          "min_m": round(float(h[vj:vj + TILE_CELLS + 1, vi:vi + TILE_CELLS + 1].min()), 1),
                          "max_m": round(float(h[vj:vj + TILE_CELLS + 1, vi:vi + TILE_CELLS + 1].max()), 1)})

    index = {
        "version": 1,
        "crs": "local metres, x east, z south, origin at the core anchor",
        "origin": {"lon": CORE["anchor"][0], "lat": CORE["anchor"][1],
                   "epsg31287": [round(E0, 2), round(N0, 2)]},
        "tileSize_m": TILE,
        "levels": [{"level": i, "cell_m": CELL * s, "cells": TILE_CELLS // s} for i, s in enumerate(STEPS)],
        "heightScale_m": SCALE,
        "classes": CLASSES,
        "tileRange": {"tx": [g.tx0, g.tx0 + g.ntx - 1], "tz": [g.tz0, g.tz0 + g.ntz - 1]},
        "lakes": lake_list,
        "anchors": anchors(g),
        "tiles": tiles,
    }
    (out / "index.json").write_text(json.dumps(index, indent=1))
    print(f"{len(tiles)} tiles ({g.ntx} x {g.ntz}), {len(lake_list)} lakes, "
          f"relief {h.min():.0f} to {h.max():.0f} m, written to {out}")
    return index


def read_tile(path):
    """Decode a tile file into (level, n, heights in metres, classes)."""
    raw = Path(path).read_bytes()
    assert raw[:4] == b"BCT1", "bad magic"
    level, _, n, qmin, scale = struct.unpack("<BBHif", raw[4:16])
    nv = (n + 1) * (n + 1)
    stored = np.frombuffer(raw, dtype="<u2", count=nv, offset=16).reshape(n + 1, n + 1)
    code = np.frombuffer(raw, dtype=np.uint8, count=n * n, offset=16 + nv * 2).reshape(n, n)
    return level, n, (stored.astype(np.int64) + qmin) * scale, code


def check(out=OUT):
    """Edges match between neighbours, levels line up, and a known point has its height.

    Raises AssertionError on the first failure.
    """
    out = Path(out)
    index = json.loads((out / "index.json").read_text())
    have = {(t["tx"], t["tz"]) for t in index["tiles"]}
    for level in range(len(STEPS)):
        for tx, tz in have:
            _, n, h, _ = read_tile(out / f"L{level}" / f"{tx}_{tz}.bin")
            if (tx + 1, tz) in have:
                _, _, east, _ = read_tile(out / f"L{level}" / f"{tx + 1}_{tz}.bin")
                assert np.array_equal(h[:, -1], east[:, 0]), f"L{level} east edge of {tx},{tz}"
            if (tx, tz + 1) in have:
                _, _, south, _ = read_tile(out / f"L{level}" / f"{tx}_{tz + 1}.bin")
                assert np.array_equal(h[-1, :], south[0, :]), f"L{level} south edge of {tx},{tz}"
    for tx, tz in have:  # coarser levels are subsamples of level 0
        _, _, h0, _ = read_tile(out / "L0" / f"{tx}_{tz}.bin")
        for level, step in enumerate(STEPS):
            _, _, hl, _ = read_tile(out / f"L{level}" / f"{tx}_{tz}.bin")
            assert np.array_equal(hl, h0[::step, ::step]), f"L{level} of {tx},{tz} is not a subsample"

    # a known point: the core anchor is dry land at its BEV height, whatever the tile
    node = next(a for a in index["anchors"] if a["id"] == "core" and a["kind"] == "location")
    ds = gdal.Open(str(ROOT / "data/raw/almsee_dgm5_31287.tif"))
    gt = ds.GetGeoTransform()
    band = ds.GetRasterBand(1).ReadAsArray()
    checked = 0
    for dx in range(-3, 4):  # vertices around the anchor, snapped to the 5 m lattice
        for dz in range(-3, 4):
            x = round(node["x"] / CELL) * CELL + dx * CELL
            z = round(node["z"] / CELL) * CELL + dz * CELL
            tx, tz = int(np.floor(x / TILE)), int(np.floor(z / TILE))
            _, n, h, c = read_tile(out / "L0" / f"{tx}_{tz}.bin")
            i, j = int(round((x - tx * TILE) / CELL)), int(round((z - tz * TILE) / CELL))
            ci, cj = min(i, n - 1), min(j, n - 1)
            if c[cj, ci] == CLASSES["lake"] or j >= n or i >= n:
                continue
            col, row = (E0 + x - gt[0]) / gt[1], (N0 - z - gt[3]) / gt[5]
            r0, c0 = int(np.floor(row - 0.5)), int(np.floor(col - 0.5))
            fy, fx = row - 0.5 - r0, col - 0.5 - c0
            win = band[r0:r0 + 2, c0:c0 + 2].astype(float)  # bilinear, as gdal.Warp does
            src = (win[0, 0] * (1 - fx) + win[0, 1] * fx) * (1 - fy) + (win[1, 0] * (1 - fx) + win[1, 1] * fx) * fy
            assert abs(h[j, i] - src) < 0.5, f"height at {x},{z}: tile {h[j, i]:.2f}, BEV {src:.2f}"
            checked += 1
    assert checked >= 10, f"only {checked} dry points checked"
    print(f"checks passed: edges match at 3 levels, {checked} points agree with BEV")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--check-only", action="store_true", help="only check existing tiles")
    args = ap.parse_args()
    if not args.check_only:
        build(args.out)
    check(args.out)


if __name__ == "__main__":
    main()
