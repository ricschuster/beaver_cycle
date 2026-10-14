#!/usr/bin/env python3
"""Cut the game world into tiles the game can stream: the core rectangle, plus the tiles around the
other five locations and the named markers (so the test menu can jump to all of them).

Reads the BEV 5 m terrain and the OpenStreetMap water and land cover in
data/raw/ (run tools/area-editor/build_data.py first). Writes public/tiles/
(untracked, see docs/design/14_m2_streamed_core_plan.md):

  index.json            origin, tile grid, class codes, lakes, anchors, tile list
  L0/<tx>_<tz>.bin      5 m tiles, L1 at 10 m, L2 at 20 m (far tiles: L2 only, 40 m, "far": true)
  water/<tx>_<tz>.json  lake level and stream lines for tiles that have water
  L3/<tx>_<tz>.bin      optional fine tiles (--fine CELL), see "Fine tiles" below

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

Fine tiles (ADR 0008): by default (--fine 2, 0 turns them off), tiles near a lake or a stream (OSM line) also
get a level 3 file with cells of that size, cut from the BEV 1 m terrain
(ALS-DGM, cached in data/raw/ by --fetch-fine, one file per region of connected fine
tiles: the core and the north, the Oedsee, the south). The 1 m heights are first
corrected by the smoothed difference to the 5 m data, so the fine ground meets
the 5 m ground without a step. The lake level is the 5 m level, so the water
plane fits both.
"""
import argparse
import functools
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
import snap_streams  # noqa: E402

CELL = 5.0  # metres, the finest the data has (ADR 0002)
TILE_CELLS = 64  # cells per tile side at level 0
TILE = CELL * TILE_CELLS  # 320 m
STEPS = (1, 2, 4)  # level 0, 1, 2 vertex steps
SCALE = 0.05  # metres per stored height step
MARGIN = 640.0  # metres of tiles kept around the core shape
# The far backdrop: coarse tiles out to this distance from the play area, so the ridges beyond the
# valley are there to see. They have a level 2 file only, with FAR_STEP times the 5 m cell.
BACKDROP = 5000.0
FAR_STEP = 8  # 40 m cells, 8 per tile side
LAKE_BED_SLOPE = 0.06  # metres of depth per metre from the shore
LAKE_BED_MAX = 5.0
LAKE_BED_OFFSET = 0.6  # metres the bed sits below the lake level at the shore
# The outline of a lake is a staircase of cells, and a flat shelf beside it lies within a few decimetres of the lake level, so a
# hard edge there reads as stair-steps on the shore. The shore is smoothed and tapered instead: the bed rises to the lake level
# over SHORE_RAMP_M, and flat land within SHORE_BAND_M rises from the level at SHORE_BEACH_SLOPE.
SHORE_SMOOTH_M = 4.0  # metres of blur radius (twice) on the signed distance to the lake outline
SHORE_RAMP_M = 3.0  # metres from the smoothed shoreline over which the bed reaches its full offset
SHORE_BAND_M = 8.0  # metres from the shoreline within which gentle land is tapered
SHORE_BEACH_SLOPE = 0.35  # metres of rise per metre inland
SHORE_BEACH_MAX = 1.0  # metres above the level; land higher than this is a bank and stays as it is
# The south end is a shallow bog (03_location.md): water under 50 cm. The bed is
# made shallow by two weights, the larger wins. One ramps up along the lake
# toward the south (z grows southward) and only in the lakes of `BOG_RAMP_LAKES`, the other
# follows OSM wetland cells. The ramp is by lake because the far alpine lakes lie at large z
# and are not bogs.
BOG_RAMP_Z = (1750.0, 1950.0)  # z in metres where the south ramp starts and is full
BOG_RAMP_LAKES = ("Almsee",)  # lakes the south ramp acts on
BOG_WETLAND_REACH = 30.0  # metres from a wetland cell over which the shallows fade out
BOG_BED_OFFSET = 0.3  # metres below the lake level in full shallows
LOCATION_IDS = {"core", "north", "south", "east-oedseen", "vorderer-springbach", "hinterer-springbach"}
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
        self.cell = CELL

    @classmethod
    def window(cls, x0, z0, ncx, ncz, cell):
        """A lattice with its own origin (metres) and cell size, for fine tiles."""
        g = cls.__new__(cls)
        g.x0, g.z0, g.ncx, g.ncz, g.cell = x0, z0, ncx, ncz, cell
        return g

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
                pts = [((x - self.x0) / self.cell + shift, (z - self.z0) / self.cell + shift) for x, z in ring]
                if len(pts) >= 3:
                    d.polygon(pts, fill=255 if i == 0 else 0)
        return np.array(img) > 0


@functools.cache
def core_extent():
    core = next(f for f in areas["features"] if f["properties"].get("id") == "core")
    pts = local_pts(core["geometry"]["coordinates"][0])
    xs, zs = [p[0] for p in pts], [p[1] for p in pts]
    tx0 = int(np.floor((min(xs) - MARGIN) / TILE))
    tx1 = int(np.floor((max(xs) + MARGIN) / TILE))
    tz0 = int(np.floor((min(zs) - MARGIN) / TILE))
    tz1 = int(np.floor((max(zs) + MARGIN) / TILE))
    return Grid(tx0, tz0, tx1 - tx0 + 1, tz1 - tz0 + 1)


@functools.cache
def play_extent():
    """The grid for the whole play area: all six locations and the named markers, with a margin."""
    xs, zs = [], []
    for f in areas["features"]:
        p = f["properties"]
        if f["geometry"]["type"] == "Point":
            pts = [local(*f["geometry"]["coordinates"])]
        elif p.get("id") in LOCATION_IDS:
            pts = [q for rings in polygons(f["geometry"]) for q in local_pts(rings[0])]
        else:
            continue
        xs += [q[0] for q in pts]
        zs += [q[1] for q in pts]
    core = core_extent()
    tx0 = min(core.tx0, int(np.floor((min(xs) - MARGIN) / TILE)))
    tx1 = max(core.tx0 + core.ntx - 1, int(np.floor((max(xs) + MARGIN) / TILE)))
    tz0 = min(core.tz0, int(np.floor((min(zs) - MARGIN) / TILE)))
    tz1 = max(core.tz0 + core.ntz - 1, int(np.floor((max(zs) + MARGIN) / TILE)))
    return Grid(tx0, tz0, tx1 - tx0 + 1, tz1 - tz0 + 1)


def wanted_tiles():
    """Tiles to write, as a set of (tx, tz): the whole core rectangle, plus every tile within
    MARGIN of another location, so the corridors between places are not cut as empty squares.
    A marker far from the play area (the Totes Gebirge) gets the tiles around it only."""
    core = core_extent()
    keep = {(tx, tz) for tz in range(core.tz0, core.tz0 + core.ntz) for tx in range(core.tx0, core.tx0 + core.ntx)}
    shapes = []
    for f in areas["features"]:
        if f["geometry"]["type"] == "Point":
            x, z = local(*f["geometry"]["coordinates"])
            shapes.append(ogr.CreateGeometryFromWkt(f"POINT({x} {z})").Buffer(MARGIN))
        elif f["properties"].get("id") in LOCATION_IDS:
            for rings in polygons(f["geometry"]):
                wkt = "POLYGON((" + ",".join(f"{x} {z}" for x, z in local_pts(rings[0])) + "))"
                shapes.append(ogr.CreateGeometryFromWkt(wkt).Buffer(MARGIN))
    g = play_extent()
    for tz in range(g.tz0, g.tz0 + g.ntz):
        for tx in range(g.tx0, g.tx0 + g.ntx):
            box = ogr.CreateGeometryFromWkt(
                f"POLYGON(({tx*TILE} {tz*TILE},{(tx+1)*TILE} {tz*TILE},{(tx+1)*TILE} {(tz+1)*TILE},"
                f"{tx*TILE} {(tz+1)*TILE},{tx*TILE} {tz*TILE}))")
            if any(sh.Intersects(box) for sh in shapes):
                keep.add((tx, tz))
    return keep


def dem_bounds():
    """The BEV raster in local metres: (x0, z0, x1, z1), z from north to south."""
    ds = gdal.Open(str(ROOT / "data/raw/almsee_dgm5_31287.tif"))
    gt = ds.GetGeoTransform()
    west, north = gt[0], gt[3]
    east, south = west + gt[1] * ds.RasterXSize, north + gt[5] * ds.RasterYSize
    return west - E0, N0 - north, east - E0, N0 - south


@functools.cache
def far_tiles():
    """Tiles of the backdrop: within BACKDROP of the play area, wholly inside the BEV raster,
    and not already kept at full detail."""
    keep = wanted_tiles()
    shapes = []
    for f in areas["features"]:
        if f["geometry"]["type"] == "Point":
            x, z = local(*f["geometry"]["coordinates"])
            shapes.append(ogr.CreateGeometryFromWkt(f"POINT({x} {z})").Buffer(BACKDROP))
        elif f["properties"].get("id") in LOCATION_IDS:
            for rings in polygons(f["geometry"]):
                wkt = "POLYGON((" + ",".join(f"{x} {z}" for x, z in local_pts(rings[0])) + "))"
                shapes.append(ogr.CreateGeometryFromWkt(wkt).Buffer(BACKDROP))
    area = shapes[0]
    for sh in shapes[1:]:
        area = area.Union(sh)
    x0, z0, x1, z1 = dem_bounds()
    slack = 2 * CELL  # the bilinear sampling reads a cell beyond the tile edge
    tx0, tx1 = int(np.ceil((x0 + slack) / TILE)), int(np.floor((x1 - slack) / TILE)) - 1
    tz0, tz1 = int(np.ceil((z0 + slack) / TILE)), int(np.floor((z1 - slack) / TILE)) - 1
    out = set()
    for tz in range(tz0, tz1 + 1):
        for tx in range(tx0, tx1 + 1):
            if (tx, tz) in keep:
                continue
            box = ogr.CreateGeometryFromWkt(
                f"POLYGON(({tx*TILE} {tz*TILE},{(tx+1)*TILE} {tz*TILE},{(tx+1)*TILE} {(tz+1)*TILE},"
                f"{tx*TILE} {(tz+1)*TILE},{tx*TILE} {tz*TILE}))")
            if area.Intersects(box):
                out.add((tx, tz))
    return out


def full_extent(tiles):
    """The grid that holds the play area and the given extra tiles."""
    g = play_extent()
    tx0 = min([g.tx0] + [t[0] for t in tiles])
    tx1 = max([g.tx0 + g.ntx - 1] + [t[0] for t in tiles])
    tz0 = min([g.tz0] + [t[1] for t in tiles])
    tz1 = max([g.tz0 + g.ntz - 1] + [t[1] for t in tiles])
    return Grid(tx0, tz0, tx1 - tx0 + 1, tz1 - tz0 + 1)


def read_heights(g):
    """BEV heights bilinear sampled at the vertex lattice."""
    nx, nz = g.ncx + 1, g.ncz + 1
    west, east = E0 + g.x0 - g.cell / 2, E0 + g.x0 + g.ncx * g.cell + g.cell / 2
    north, south = N0 - g.z0 + g.cell / 2, N0 - g.z0 - g.ncz * g.cell - g.cell / 2
    ds = gdal.Warp("", str(ROOT / "data/raw/almsee_dgm5_31287.tif"), format="MEM",
                   outputBounds=(west, south, east, north), width=nx, height=nz,
                   resampleAlg="bilinear", dstNodata=0)
    h = ds.GetRasterBand(1).ReadAsArray().astype(np.float64)
    assert h.shape == (nz, nx), h.shape
    if (h <= 0).any():
        raise SystemExit("the BEV raster has gaps inside the tile region")
    return h


RIVER_WIDTH_M, STREAM_WIDTH_M, SEASONAL_WIDTH_M = 8.0, 2.5, 1.8
# Drawn width by OSM name, for lines whose kind tag misleads (small brooks tagged river, a wide inflow tagged stream).
NAMED_WIDTH_M = {
    "Alm": 10.0, "Steyr": 12.0, "Salza": 12.0, "Steyrling": 6.0, "Aagbach": 5.0,
    "Straneggbach": 3.0, "Ostrawitzbach": 3.0, "Schwarzgraben": 3.0, "Grimming": 3.0,
}


def stream_width(props):
    """Drawn width in metres of an OSM line: its width tag, else by name (NAMED_WIDTH_M), else by kind (river, stream, seasonal stream)."""
    try:
        w = float(str(props.get("width", "")).split()[0].replace(",", "."))
        if 0.5 <= w <= 40:
            return w
    except (ValueError, IndexError):
        pass
    if props.get("name") in NAMED_WIDTH_M:
        return NAMED_WIDTH_M[props["name"]]
    if props.get("waterway") == "river":
        return RIVER_WIDTH_M
    return SEASONAL_WIDTH_M if props.get("intermittent") == "yes" else STREAM_WIDTH_M


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
                streams.append((local_pts(line), name, stream_width(f["properties"])))
    return lakes, streams


RAW_WATER = next((ROOT / "data/raw").glob("osm_water_*.json"), ROOT / "data/raw/osm_water.json")


@functools.cache
def landcover_json():
    return json.loads((ROOT / "data/raw/landcover.geojson").read_text())


def read_landcover(g):
    """Class code per cell, painted from the OSM land cover polygons."""
    fc = landcover_json()
    x1, z1 = g.x0 + g.ncx * g.cell, g.z0 + g.ncz * g.cell
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


ROCK_SLOPE = 35.0  # degrees: bare ground steeper than this is rock (an OSM wood polygon gap on a cliff or scree)


def steep_ground_to_rock(code, h, cell):
    """Turn bare ground (class ground, no OSM cover) on steep slopes into rock, in place. Returns the number of cells.

    `h` is the vertex heights (one more row and column than `code`). OSM leaves the cliffs and scree above the valleys untagged,
    so they came out as flat tan ground (session 112, the south had 25 % of it). Gentler bare ground stays as it is.
    """
    dx = ((h[:-1, 1:] + h[1:, 1:]) - (h[:-1, :-1] + h[1:, :-1])) / (2 * cell)
    dz = ((h[1:, :-1] + h[1:, 1:]) - (h[:-1, :-1] + h[:-1, 1:])) / (2 * cell)
    steep = (np.degrees(np.arctan(np.hypot(dx, dz))) > ROCK_SLOPE) & (code == CLASSES["ground"])
    code[steep] = CLASSES["rock"]
    return int(steep.sum())


def shore_distance(mask):
    """Distance in cells from each lake cell to the nearest non lake cell."""
    drv = gdal.GetDriverByName("MEM")
    nz, nx = mask.shape
    src = drv.Create("", nx, nz, 1, gdal.GDT_Byte)
    src.GetRasterBand(1).WriteArray(mask.astype(np.uint8))
    dst = drv.Create("", nx, nz, 1, gdal.GDT_Float32)
    gdal.ComputeProximity(src.GetRasterBand(1), dst.GetRasterBand(1), ["VALUES=0", "DISTUNITS=PIXEL"])
    return dst.GetRasterBand(1).ReadAsArray().astype(np.float64)


def shallow_weight(g, wetland, ramp_vert=None):
    """0 in open water, 1 in the bog. Combines the south ramp and nearness to wetland.

    `wetland` is the class mask per cell. `ramp_vert` is the vertex mask the south
    ramp acts on (None for all). Returns a weight per vertex.
    """
    z = g.z0 + np.arange(g.ncz + 1) * g.cell
    z0, z1 = BOG_RAMP_Z
    south = np.clip((z - z0) / (z1 - z0), 0.0, 1.0)[:, None] * np.ones(g.ncx + 1)
    if ramp_vert is not None:
        south = south * ramp_vert
    if not wetland.any():
        return south
    vert = np.pad(wetland, ((0, 1), (0, 1)))
    vert[1:, :] |= vert[:-1, :]
    vert[:, 1:] |= vert[:, :-1]
    near = np.clip(1.0 - shore_distance(~vert) * g.cell / BOG_WETLAND_REACH, 0.0, 1.0)
    return np.maximum(south, near)


def box_blur(a, radius, times=2):
    """Separable box blur with edge clamping, numpy only."""
    k = 2 * radius + 1
    for _ in range(times):
        for axis in (0, 1):
            pad = [(0, 0), (0, 0)]
            pad[axis] = (radius, radius)
            c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis, dtype=np.float64)
            c = np.concatenate([np.zeros_like(np.take(c, [0], axis=axis)), c], axis=axis)
            n = c.shape[axis]
            a = (np.take(c, range(k, n), axis=axis) - np.take(c, range(0, n - k), axis=axis)) / k
    return a


def spread_level(level, steps):
    """Copy the lake level onto the land vertices within `steps` cells of a lake, so the shore can be tapered to it."""
    lv = level.copy()
    for _ in range(steps):
        pad = np.pad(lv, 1, constant_values=np.nan)
        stack = np.stack([pad[1 + dj:pad.shape[0] - 1 + dj, 1 + di:pad.shape[1] - 1 + di]
                          for dj in (-1, 0, 1) for di in (-1, 0, 1)])
        near = np.where(np.isnan(stack), -np.inf, stack).max(axis=0)
        lv = np.where(np.isnan(lv) & np.isfinite(near), near, lv)
    return lv


def make_lake_bed(g, h, lakes, wetland, levels=None):
    """Lower the lake floor below a flat level. BEV has a flat lake, the game's is deeper.

    The bed is deep in open water and shallow in the south bog of the Almsee (see `shallow_weight`).
    `levels` gives a lake level per lake (None for unknown), so a fine window can
    use the levels of the 5 m build. Returns the new heights, the class 9 cell
    mask, the vertex mask, the level per vertex, the lake list, and the level
    per lake (None where the lake is not in the window).
    """
    vert = np.zeros(h.shape, dtype=bool)
    ramp_vert = np.zeros(h.shape, dtype=bool)
    level = np.full(h.shape, np.nan)
    found = []
    used = []
    for k, (rings, name) in enumerate(lakes):
        m = g.raster([rings], vertices=True)
        if not m.any():
            used.append(None)
            continue
        lv = levels[k] if levels and levels[k] is not None else float(np.median(h[m]))
        used.append(lv)
        level[m] = lv
        vert |= m
        if name in BOG_RAMP_LAKES:
            ramp_vert |= m
        found.append({"name": name, "level_m": round(lv, 2)})
    dist = shore_distance(vert)
    w = shallow_weight(g, wetland, ramp_vert)
    depth = np.minimum(dist * g.cell * LAKE_BED_SLOPE, LAKE_BED_MAX) * (1.0 - w)
    offset = LAKE_BED_OFFSET + (BOG_BED_OFFSET - LAKE_BED_OFFSET) * w
    if vert.any() and not vert.all():
        # signed metres to the outline, positive in the lake, smoothed so the raster staircase goes
        s = np.where(vert, dist - 0.5, -(shore_distance(~vert) - 0.5)) * g.cell
        s = box_blur(s, max(1, round(SHORE_SMOOTH_M / g.cell)))
        lv = spread_level(level, int(np.ceil((SHORE_BAND_M + SHORE_SMOOTH_M) / g.cell)) + 1)
        bed = lv - offset * np.clip(s / SHORE_RAMP_M, 0.0, 1.0) - depth
        beach = lv + SHORE_BEACH_SLOPE * np.maximum(-s, 0.0)
        gentle = (-s <= SHORE_BAND_M) & (h - lv < SHORE_BEACH_MAX)
        land = np.where(s > 0, np.minimum(h, bed), np.where(gentle, np.minimum(h, beach), h))
        h = np.where(vert, np.where(s > 0, bed, lv), np.where(np.isnan(lv), h, land))
    else:
        h = np.where(vert, level - offset - depth, h)
    cell = g.raster([r for r, _ in lakes], vertices=False)
    return h, cell, vert, level, found, used


def block_mode(code, step):
    """Most common class in each step x step block (ties go to the lower code)."""
    if step == 1:
        return code
    nz, nx = code.shape
    keys = sorted(CLASSES.values())
    counts = np.stack([(code == k).reshape(nz // step, step, nx // step, step).sum(axis=(1, 3))
                       for k in keys])
    return np.array(keys, dtype=np.uint8)[counts.argmax(axis=0)]


def write_tile(path, level, q, code):
    n = code.shape[0]
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
    for pts, name, width in streams:
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
                out.append({"name": name, "w": width, "pts": [[round(p.GetX(i), 1), round(p.GetY(i), 1)]
                                                             for i in range(p.GetPointCount())]})
    return out


def anchors(keep):
    """Anchors for the test menu: travel nodes plus the named markers. `keep` is the set of tiles written."""
    out = []

    def add(kind, id_, name, lon, lat, elev=None):
        x, z = local(lon, lat)
        out.append({"kind": kind, "id": id_, "name": name, "x": round(x, 1), "z": round(z, 1),
                    "elevation_m": elev, "inTiles": (int(np.floor(x / TILE)), int(np.floor(z / TILE))) in keep})

    for n in travel["nodes"]:
        add("location", n["id"], n["name"], *n["anchor"], n.get("anchor_elevation_m"))
    for f in areas["features"]:
        if f["geometry"]["type"] == "Point":
            p = f["properties"]
            add("marker", p["name"].lower().replace(" ", "-"), p["name"], *f["geometry"]["coordinates"])
    return out


# Fine tiles (prototype, ADR 0008) --------------------------------------------

FINE_URLS = [  # the 50 x 50 km BEV tiles (EPSG:3035) the play area touches, south to north
    "/vsicurl/https://data.bev.gv.at/download/ALS/DTM/20250915/"
    f"ALS_DTM_CRS3035RES50000mN{n}E4600000.tif" for n in (2700000, 2750000)]
FINE_NEAR = 100.0  # metres from a lake or a stream within which tiles get a fine level
FINE_HALO = 160.0  # metres of context around a fine tile, so the lake bed matches across edges
FINE_PAD = 1  # tiles of 1 m terrain cached around a region, for the halo and the datum smoothing
CORR_CELL = 20.0  # metres, the grid of the datum correction
CORR_SMOOTH = 5  # correction cells (100 m) averaged


FINE_CORRIDOR = 6.0  # metres each side of the 5 m snapped line searched on the fine ground
FINE_STEP = 2.0  # metres between resampled points on the fine ground
FINE_SHIFT = 1.5  # metres the offset may change between neighbouring points on the fine ground


def fine_regions(tiles):
    """Group fine tiles that touch (also diagonally) into regions. Returns a list of
    (region grid, tiles), the grid padded by FINE_PAD tiles. Each region has its own 1 m cache
    and its own datum correction, so a region must not border another one."""
    todo, out = set(tiles), []
    while todo:
        stack, group = [todo.pop()], []
        while stack:
            tx, tz = stack.pop()
            group.append((tx, tz))
            for dx in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    if (tx + dx, tz + dz) in todo:
                        todo.remove((tx + dx, tz + dz))
                        stack.append((tx + dx, tz + dz))
        tx0, tx1 = min(t[0] for t in group) - FINE_PAD, max(t[0] for t in group) + FINE_PAD
        tz0, tz1 = min(t[1] for t in group) - FINE_PAD, max(t[1] for t in group) + FINE_PAD
        out.append((Grid(tx0, tz0, tx1 - tx0 + 1, tz1 - tz0 + 1), sorted(group)))
    return sorted(out, key=lambda r: (r[0].tx0, r[0].tz0))


def fine_cache(g):
    """The cache file of a region grid in data/raw/."""
    return ROOT / "data" / "raw" / f"dtm1_{g.tx0}_{g.tz0}_{g.ntx}x{g.ntz}_31287.tif"


def fine_bounds(g):
    """A region in EPSG:31287 (west, south, east, north)."""
    return (E0 + g.x0, N0 - g.z0 - g.ncz * g.cell, E0 + g.x0 + g.ncx * g.cell, N0 - g.z0)


def fetch_fine(g):
    """Cache the BEV 1 m terrain for a region in data/raw/ (about a few minutes)."""
    cache = fine_cache(g)
    if cache.exists():
        return
    w, s_, e, n = fine_bounds(g)
    print(f"fetching the BEV 1 m terrain, {(e - w):.0f} x {(n - s_):.0f} m ...")
    part = cache.with_suffix(".part.tif")  # renamed when complete, so a stopped run leaves no stub
    gdal.Warp(str(part), FINE_URLS, dstSRS="EPSG:31287", outputBounds=(w, s_, e, n),
              xRes=1, yRes=1, resampleAlg="near", creationOptions=["COMPRESS=LZW", "TILED=YES"])
    part.rename(cache)


def warp_array(src, **kw):
    """gdal.Warp to memory and read band 1 (the dataset must outlive the band)."""
    ds = gdal.Warp("", src, format="MEM", **kw)
    return ds.GetRasterBand(1).ReadAsArray().astype(np.float64)


@functools.cache
def datum_correction(g):
    """1 m minus 5 m heights on a coarse grid, smoothed over about 100 m. A MEM dataset.

    The 1 m model sits 0 to 1 m off the 5 m model, and the offset changes along
    the valley (ADR 0008). Subtracting this keeps the 1 m detail and puts the
    fine ground on the 5 m datum.
    """
    w, s_, e, n = fine_bounds(g)
    nx, ny = int((e - w) // CORR_CELL), int((n - s_) // CORR_CELL)
    box = (w, n - ny * CORR_CELL, w + nx * CORR_CELL, n)
    kw = dict(outputBounds=box, width=nx, height=ny, resampleAlg="average")
    fine = warp_array(str(fine_cache(g)), **kw)
    coarse = warp_array(str(ROOT / "data/raw/almsee_dgm5_31287.tif"), **kw)
    d = fine - coarse
    k = CORR_SMOOTH
    pad = np.pad(d, k // 2, mode="edge")
    c = np.cumsum(np.cumsum(pad, 0), 1)
    c = np.pad(c, ((1, 0), (1, 0)))
    sm = (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)
    ds = gdal.GetDriverByName("MEM").Create("", nx, ny, 1, gdal.GDT_Float64)
    ds.SetGeoTransform((box[0], CORR_CELL, 0, box[3], 0, -CORR_CELL))
    ds.GetRasterBand(1).WriteArray(sm[:ny, :nx])
    ds.SetProjection(aut.ExportToWkt())
    return ds


def read_fine_heights(g, fg):
    """BEV 1 m heights on the vertex lattice of window fg, on the 5 m datum."""
    west, east = E0 + fg.x0 - fg.cell / 2, E0 + fg.x0 + fg.ncx * fg.cell + fg.cell / 2
    north, south = N0 - fg.z0 + fg.cell / 2, N0 - fg.z0 - fg.ncz * fg.cell - fg.cell / 2
    kw = dict(outputBounds=(west, south, east, north), width=fg.ncx + 1, height=fg.ncz + 1)
    h = warp_array(str(fine_cache(g)), resampleAlg="bilinear" if fg.cell <= 1 else "average", **kw)
    corr = warp_array(datum_correction(g), resampleAlg="bilinear", **kw)
    return h - corr


def stream_near(g, streams):
    """Vertex mask of the ground within FINE_NEAR of a stream line (a stream wider than the OSM line is not needed)."""
    mask = np.zeros((g.ncz + 1, g.ncx + 1), dtype=bool)
    for pts, _, _ in streams:
        for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
            for t in np.linspace(0.0, 1.0, max(2, int(np.hypot(x1 - x0, z1 - z0) // CELL) + 1)):
                i, j = int(round((x0 + (x1 - x0) * t - g.x0) / CELL)), int(round((z0 + (z1 - z0) * t - g.z0) / CELL))
                if 0 <= i <= g.ncx and 0 <= j <= g.ncz:
                    mask[j, i] = True
    return shore_distance(~mask) * CELL <= FINE_NEAR


def fine_tiles(g, lake_vert, streams=()):
    """Tiles within FINE_NEAR of a lake or a stream, as (tx, tz)."""
    near = shore_distance(~lake_vert) * CELL <= FINE_NEAR
    if streams:
        near = near | stream_near(g, streams)
    out = []
    for tz in range(g.tz0, g.tz0 + g.ntz):
        for tx in range(g.tx0, g.tx0 + g.ntx):
            vi, vj = (tx - g.tx0) * TILE_CELLS, (tz - g.tz0) * TILE_CELLS
            if near[vj:vj + TILE_CELLS + 1, vi:vi + TILE_CELLS + 1].any():
                out.append((tx, tz))
    return out


def build_fine(out, g, cell, tiles, lakes, lake_levels):
    """Write L3/<tx>_<tz>.bin for the given tiles at the given cell size. Returns (tx, tz) -> (min, max)."""
    n = int(TILE // cell)
    halo = int(FINE_HALO // cell)
    ranges = {}
    for k, (tx, tz) in enumerate(tiles):
        fg = Grid.window(tx * TILE - halo * cell, tz * TILE - halo * cell, n + 2 * halo, n + 2 * halo, cell)
        h = read_fine_heights(g, fg)
        code = read_landcover(fg)
        h, lake_cells, _, _, _, _ = make_lake_bed(fg, h, lakes, code == CLASSES["wetland"], lake_levels)
        code[lake_cells] = CLASSES["lake"]
        steep_ground_to_rock(code, h, cell)
        q = np.rint(h / SCALE).astype(np.int64)[halo:halo + n + 1, halo:halo + n + 1]
        ct = code[halo:halo + n, halo:halo + n]
        write_tile(out / "L3" / f"{tx}_{tz}.bin", 3, q, ct)
        ranges[(tx, tz)] = (float(q.min() * SCALE), float(q.max() * SCALE))
        print(f"  fine tile {k + 1}/{len(tiles)} ({tx},{tz})", end="\r", flush=True)
    print()
    return ranges


def snap_stream_lines(streams, h, g, lake_vert):
    """Move the OSM stream lines onto the channel of the 5 m terrain (ADR 0010) and print what moved."""
    streams, rep = snap_streams.snap_streams(
        streams, snap_streams.Heights(h, g.x0, g.z0, g.cell), lake_vert)
    print(f"stream lines snapped to the channel: {rep['points']} points, {rep['kept']} kept on the OSM line, "
          f"moved median {rep['median_m']:.1f} m, 90th percentile {rep['p90_m']:.1f} m, max {rep['max_m']:.1f} m")
    for name, x, z, d in sorted(rep["big_moves"], key=lambda b: -b[3])[:10]:
        print(f"  moved {d} m: {name or '(unnamed)'} at ({x}, {z})")
    if len(rep["big_moves"]) > 10:
        print(f"  ... and {len(rep['big_moves']) - 10} more points moved over {snap_streams.BIG_MOVE} m")
    return streams


def snap_fine_lines(streams, regions, fine, lake_vert, g):
    """Snap the stream lines a second time on the fine ground (ADR 0010), inside the fine tiles only.

    The 5 m snap leaves lines 2 to 3 m off the channel. The fine ground (BEV 1 m on the 5 m datum, cut at
    `fine` metres) resolves it, so each region's lines are searched again in a narrow corridor. Outside the
    fine tiles the heights are NaN, which keeps the 5 m line there, so the line stays consistent with the
    5 m terrain that the coarse tiles draw."""
    coarse = snap_streams.Heights(lake_vert, g.x0, g.z0, g.cell)
    blocked = lambda x, z: coarse.mask_at(lake_vert, x, z)  # noqa: E731
    for rg, rtiles in regions:
        fetch_fine(rg)
        n = int(round(rg.ncx * rg.cell / fine)), int(round(rg.ncz * rg.cell / fine))
        win = Grid.window(rg.x0, rg.z0, n[0], n[1], fine)
        h = read_fine_heights(rg, win)
        tile = np.zeros((rg.ntz, rg.ntx), dtype=bool)
        for tx, tz in rtiles:
            tile[tz - rg.tz0, tx - rg.tx0] = True
        per = int(round(TILE / fine))
        mask = np.kron(tile, np.ones((per, per), dtype=bool))
        mask = np.pad(mask, ((0, 1), (0, 1)), mode="edge")  # the last vertex row and column
        h[~mask] = np.nan
        ground = snap_streams.Heights(h, rg.x0, rg.z0, fine)
        streams, rep = snap_streams.snap_streams(
            streams, ground, blocked=blocked, corridor=FINE_CORRIDOR, step=FINE_STEP,
            offset_step=fine / 2, max_shift=FINE_SHIFT)
        print(f"  fine snap of region {rg.tx0},{rg.tz0}: {rep['points']} points, moved median {rep['median_m']:.1f} m, "
              f"90th percentile {rep['p90_m']:.1f} m, max {rep['max_m']:.1f} m")
    return streams


def build(out=OUT, fine=None, backdrop=True, snap=True):
    out = Path(out)
    keep = wanted_tiles()
    far = far_tiles() if backdrop else set()
    g = full_extent(far)
    h = read_heights(g)
    lakes, streams = read_water()
    code = read_landcover(g)
    h, lake_cells, lake_vert, lake_level, lake_list, lake_levels = make_lake_bed(
        g, h, lakes, code == CLASSES["wetland"])
    code[lake_cells] = CLASSES["lake"]
    print(f"{steep_ground_to_rock(code, h, g.cell)} cells of steep bare ground turned to rock")
    if snap:
        streams = snap_stream_lines(streams, h, g, lake_vert)
    q = np.rint(h / SCALE).astype(np.int64)

    fine_set = {}
    if fine:
        fine_list = [t for t in fine_tiles(g, lake_vert, streams) if t in keep]
        regions = fine_regions(fine_list)
        print(f"{len(fine_list)} fine tiles at {fine} m in {len(regions)} regions")
        if snap and regions:
            streams = snap_fine_lines(streams, regions, fine, lake_vert, g)
    if snap:  # whole lines, before they are cut into tiles, so the pieces meet at a tile edge without a kink
        streams = snap_streams.smooth_streams(streams)
        for rg, rtiles in regions:
            fetch_fine(rg)
            fine_set.update(build_fine(out, rg, fine, rtiles, lakes, lake_levels))

    modes = {step: block_mode(code, step) for step in sorted({*STEPS, FAR_STEP})}
    tiles = []
    for tz in range(g.tz0, g.tz0 + g.ntz):
        for tx in range(g.tx0, g.tx0 + g.ntx):
            vi, vj = (tx - g.tx0) * TILE_CELLS, (tz - g.tz0) * TILE_CELLS
            if (tx, tz) in far:
                n = TILE_CELLS // FAR_STEP
                qt = q[vj:vj + TILE_CELLS + 1:FAR_STEP, vi:vi + TILE_CELLS + 1:FAR_STEP]
                ct = modes[FAR_STEP][vj // FAR_STEP:vj // FAR_STEP + n, vi // FAR_STEP:vi // FAR_STEP + n]
                write_tile(out / f"L{len(STEPS) - 1}" / f"{tx}_{tz}.bin", len(STEPS) - 1, qt, ct)
                tile_h = h[vj:vj + TILE_CELLS + 1, vi:vi + TILE_CELLS + 1]
                tiles.append({"tx": tx, "tz": tz, "water": False, "lakeLevel_m": None,
                              "min_m": round(float(tile_h.min()), 1), "max_m": round(float(tile_h.max()), 1),
                              "far": True})
                continue
            if (tx, tz) not in keep:
                continue
            for level, step in enumerate(STEPS):
                n = TILE_CELLS // step
                qt = q[vj:vj + TILE_CELLS + 1:step, vi:vi + TILE_CELLS + 1:step]
                ct = modes[step][vj // step:vj // step + n, vi // step:vi // step + n]
                write_tile(out / f"L{level}" / f"{tx}_{tz}.bin", level, qt, ct)
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
                          "max_m": round(float(h[vj:vj + TILE_CELLS + 1, vi:vi + TILE_CELLS + 1].max()), 1),
                          **({"fine": True} if (tx, tz) in fine_set else {})})

    index = {
        "version": 1,
        "crs": "local metres, x east, z south, origin at the core anchor",
        "origin": {"lon": CORE["anchor"][0], "lat": CORE["anchor"][1],
                   "epsg31287": [round(E0, 2), round(N0, 2)]},
        "tileSize_m": TILE,
        "levels": [{"level": i, "cell_m": CELL * s, "cells": TILE_CELLS // s} for i, s in enumerate(STEPS)]
        + ([{"level": 3, "cell_m": fine, "cells": int(TILE // fine), "fine": True}] if fine else []),
        "heightScale_m": SCALE,
        "classes": CLASSES,
        "tileRange": {"tx": [g.tx0, g.tx0 + g.ntx - 1], "tz": [g.tz0, g.tz0 + g.ntz - 1]},
        "lakes": lake_list,
        "anchors": anchors(keep),
        "tiles": tiles,
    }
    (out / "index.json").write_text(json.dumps(index, indent=1))
    print(f"{len(tiles)} tiles ({len(far)} far, grid {g.ntx} x {g.ntz}), {len(lake_list)} lakes, "
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
    have = {(t["tx"], t["tz"]) for t in index["tiles"] if not t.get("far")}
    far = {(t["tx"], t["tz"]) for t in index["tiles"] if t.get("far")}
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

    # far tiles have a level 2 file only, at a coarser cell, and meet every neighbour on shared vertices
    coarsest = len(STEPS) - 1

    def level2(tx, tz):
        _, n, h, _ = read_tile(out / f"L{coarsest}" / f"{tx}_{tz}.bin")
        return n, h

    for tx, tz in far:
        n, h = level2(tx, tz)
        assert n == TILE_CELLS // FAR_STEP, f"far tile {tx},{tz} has n={n}"
        assert not (out / "L0" / f"{tx}_{tz}.bin").exists(), f"far tile {tx},{tz} has a level 0 file"
        for dx, dz in ((1, 0), (0, 1)):
            if (tx + dx, tz + dz) not in far and (tx + dx, tz + dz) not in have:
                continue
            n2, h2 = level2(tx + dx, tz + dz)
            m = min(n, n2)  # compare on the vertices both tiles have
            a, b = (h[:, -1], h2[:, 0]) if dx else (h[-1, :], h2[0, :])
            assert np.array_equal(a[::n // m], b[::n2 // m]), f"far edge of {tx},{tz}"

    fine = {(t["tx"], t["tz"]) for t in index["tiles"] if t.get("fine")}
    for tx, tz in fine:  # fine tiles join each other and agree with the 5 m ground
        _, n, h, c = read_tile(out / "L3" / f"{tx}_{tz}.bin")
        if (tx + 1, tz) in fine:
            _, _, east, _ = read_tile(out / "L3" / f"{tx + 1}_{tz}.bin")
            assert np.array_equal(h[:, -1], east[:, 0]), f"L3 east edge of {tx},{tz}"
        if (tx, tz + 1) in fine:
            _, _, south, _ = read_tile(out / "L3" / f"{tx}_{tz + 1}.bin")
            assert np.array_equal(h[-1, :], south[0, :]), f"L3 south edge of {tx},{tz}"
        _, _, h0, c0 = read_tile(out / "L0" / f"{tx}_{tz}.bin")
        step = (n * 1.0) / TILE_CELLS
        rows = np.rint(np.arange(TILE_CELLS + 1) * step).astype(int)
        diff = h[np.ix_(rows, rows)] - h0  # the fine detail scatters both ways, the datum must not
        dry = (c[np.ix_(rows[:-1], rows[:-1])] != CLASSES["lake"]) & (c0 != CLASSES["lake"])
        dry_v = np.zeros_like(diff, dtype=bool)
        dry_v[:-1, :-1] = dry
        if dry_v.sum() < 50:
            continue  # a tile that is nearly all lake has no dry ground to compare
        if np.degrees(np.arctan(np.hypot(*np.gradient(h0, CELL)))).mean() > 30.0:
            continue  # a mountainside (a stream gully): the models differ by 1 m and more there by design (ADR 0008)
        assert abs(np.median(diff[dry_v])) < 1.0, f"L3 of {tx},{tz} is off the 5 m ground by {np.median(diff[dry_v]):.2f} m"
    if fine:
        print(f"fine tiles checked: {len(fine)} tiles join and sit on the 5 m ground")

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
    ap.add_argument("--fine", type=float, default=2.0, metavar="CELL",
                    help="cell size in metres of the fine tiles (level 3) near the lake, cut from the "
                         "BEV 1 m terrain: 2 by default (ADR 0008), 1 is heavy for a tablet, 0 turns them off")
    ap.add_argument("--no-backdrop", action="store_true",
                    help="skip the far backdrop (coarse tiles out to 5 km beyond the play area)")
    ap.add_argument("--no-snap", action="store_true",
                    help="keep the OSM stream lines where they are (no snap to the channel, ADR 0010)")
    ap.add_argument("--fetch-fine", action="store_true", help="only cache the BEV 1 m terrain in data/raw/")
    args = ap.parse_args()
    if args.fetch_fine:
        g = full_extent(far_tiles())
        h = read_heights(g)
        lakes, streams = read_water()
        code = read_landcover(g)
        lake_vert = make_lake_bed(g, h, lakes, code == CLASSES["wetland"])[2]
        for rg, _ in fine_regions([t for t in fine_tiles(g, lake_vert, streams) if t in wanted_tiles()]):
            fetch_fine(rg)
        return
    if not args.check_only:
        build(args.out, args.fine, backdrop=not args.no_backdrop, snap=not args.no_snap)
    check(args.out)


if __name__ == "__main__":
    main()
