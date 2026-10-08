#!/usr/bin/env python3
"""Scan the streams in the game tiles for places where a beaver dam would hold a pond.

A draft for the dam placement talk (docs/design/15_build_and_repair.md, open questions). It reads
only public/tiles/ (run tools/tiles/build_tiles.py first), uses the 2 m fine tiles where there are
any and the 5 m tiles elsewhere, and writes a candidate list. It changes no game data.

For every stream point (every STEP metres along the OSM lines, not in a lake):

  1. Snap to the lowest ground within SNAP metres, the channel bed. Upstream is the side the
     ground rises toward.
  2. For each crest height (CRESTS, metres above the bed) walk across the stream from the bed
     until the ground reaches the crest. That is the dam, and its length is the two walks added.
     Longer than MAX_DAM means the valley is too wide for that crest.
  3. Flood the ground below the crest upstream of the dam line. That is the pond. A pond over
     MAX_POND or one that touches the edge of the window spills, and the site is dropped.
  4. Keep the sites whose pond is at least MIN_POND.

Sites within SPACING metres of a better one are dropped. Writes JSON and prints a summary by
play location. Run: python3 tools/dam-sites/scan_dam_sites.py [--out public/tiles/dam_sites.json]
The test menu has a Dam sites toggle (?damsites=1 starts with it on), see src/render/damSites.ts.
"""
import argparse
import json
import math
import struct
from collections import deque
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
TILES = ROOT / "public" / "tiles"
TILE = 320.0

STEP = 15.0  # metres between stream points tested
SNAP = 6.0  # metres around the OSM line searched for the real channel bed
CELL = 2.0  # window cell, metres (the fine tile cell)
HALF = 80.0  # window half side, metres
CRESTS = (1.0, 1.5, 2.0)  # dam crest above the bed, metres
MAX_DAM = 40.0  # longest dam, metres
MIN_POND = 200.0  # smallest pond worth a lodge, square metres
MAX_POND = 12000.0  # a pond over this spills into the valley, square metres
SPACING = 45.0  # metres between kept sites
LAKE_MARGIN = 1.0  # bed this close to a lake level or below is the lake, not a stream


class Heights:
    """Bilinear ground height from the tile files, fine level 3 first, then level 0."""

    def __init__(self, root=TILES):
        self.root = Path(root)
        self.cache = {}

    def grid(self, tx, tz):
        key = (tx, tz)
        if key not in self.cache:
            self.cache[key] = self._load(tx, tz)
        return self.cache[key]

    def _load(self, tx, tz):
        for level in ("L3", "L0"):
            path = self.root / level / f"{tx}_{tz}.bin"
            if path.exists():
                data = path.read_bytes()
                if data[:4] != b"BCT1":
                    raise ValueError(f"{path}: bad magic")
                n = struct.unpack_from("<H", data, 6)[0]
                qmin = struct.unpack_from("<i", data, 8)[0]
                scale = struct.unpack_from("<f", data, 12)[0]
                h = np.frombuffer(data, "<u2", (n + 1) ** 2, 16).reshape(n + 1, n + 1)
                return (h.astype(np.float64) + qmin) * scale, n
        return None

    def sample(self, x, z):
        """Heights at arrays x, z (metres). NaN where there is no tile."""
        x = np.asarray(x, float)
        z = np.asarray(z, float)
        out = np.full(x.shape, np.nan)
        tx = np.floor(x / TILE).astype(int)
        tz = np.floor(z / TILE).astype(int)
        for key in {(a, b) for a, b in zip(tx.ravel(), tz.ravel())}:
            g = self.grid(*key)
            if g is None:
                continue
            h, n = g
            m = (tx == key[0]) & (tz == key[1])
            u = np.clip((x[m] - key[0] * TILE) / TILE * n, 0, n)
            v = np.clip((z[m] - key[1] * TILE) / TILE * n, 0, n)
            i0 = np.minimum(u.astype(int), n - 1)
            j0 = np.minimum(v.astype(int), n - 1)
            fu, fv = u - i0, v - j0
            out[m] = (h[j0, i0] * (1 - fu) * (1 - fv) + h[j0, i0 + 1] * fu * (1 - fv)
                      + h[j0 + 1, i0] * (1 - fu) * fv + h[j0 + 1, i0 + 1] * fu * fv)
        return out


def along(pts, step):
    """Points every `step` metres along a polyline, with the unit direction of the line there."""
    out, carry = [], 0.0
    for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
        d = math.hypot(x1 - x0, z1 - z0)
        if d == 0:
            continue
        ux, uz = (x1 - x0) / d, (z1 - z0) / d
        s = step - carry if carry else 0.0
        while s <= d:
            out.append((x0 + ux * s, z0 + uz * s, ux, uz))
            s += step
        carry = d - (s - step)
    return out


def window(heights, cx, cz):
    """Ground heights in a square window at CELL metres. Returns (H, x0, z0), cell (i, j) at z0+i*CELL."""
    k = int(HALF / CELL)
    xs = cx + (np.arange(-k, k + 1)) * CELL
    zs = cz + (np.arange(-k, k + 1)) * CELL
    gx, gz = np.meshgrid(xs, zs)
    return heights.sample(gx, gz), xs[0], zs[0]


def evaluate(H, x0, z0, bed_xy, flow_dir, crest_h):
    """Dam and pond for one crest. `flow_dir` is the unit vector pointing downstream.

    Returns a dict (width, area, depth) or None when the valley is too wide, the pond spills, or
    it is too small.
    """
    bx, bz = bed_xy
    n = H.shape[0]
    bed = float(H[int(round((bz - z0) / CELL)), int(round((bx - x0) / CELL))])
    level = bed + crest_h
    ax, az = -flow_dir[1], flow_dir[0]  # across the stream

    def reach(sign):
        """Metres from the bed to where the ground reaches the crest, None if beyond MAX_DAM."""
        for s in np.arange(CELL, MAX_DAM, CELL / 2):
            px, pz = bx + sign * ax * s, bz + sign * az * s
            i, j = int(round((pz - z0) / CELL)), int(round((px - x0) / CELL))
            if not (0 <= i < n and 0 <= j < n) or math.isnan(H[i, j]):
                return None
            if H[i, j] >= level:
                return s
        return None

    left, right = reach(+1), reach(-1)
    if left is None or right is None or left + right > MAX_DAM:
        return None
    # Pond: the connected ground below the crest, upstream of the dam line.
    ii, jj = np.indices(H.shape)
    along_up = -((jj * CELL + x0 - bx) * flow_dir[0] + (ii * CELL + z0 - bz) * flow_dir[1])
    low = (H < level) & (along_up > 0)
    si, sj = int(round((bz - flow_dir[1] * 4 - z0) / CELL)), int(round((bx - flow_dir[0] * 4 - x0) / CELL))
    if not (0 <= si < n and 0 <= sj < n and low[si, sj]):
        return None
    seen = np.zeros(H.shape, bool)
    seen[si, sj] = True
    queue, cells, depth = deque([(si, sj)]), 0, 0.0
    limit = int(MAX_POND / CELL**2)
    while queue:
        i, j = queue.popleft()
        cells += 1
        depth = max(depth, level - H[i, j])
        if cells > limit or i in (0, n - 1) or j in (0, n - 1):
            return None  # spills
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            a, b = i + di, j + dj
            if low[a, b] and not seen[a, b]:
                seen[a, b] = True
                queue.append((a, b))
    area = cells * CELL**2
    if area < MIN_POND:
        return None
    return {"crest_m": crest_h, "dam_m": round(left + right, 1),
            "left_m": round(left, 1), "right_m": round(right, 1), "pond_m2": round(area),
            "max_depth_m": round(depth, 2)}


def scan_point(heights, x, z, ux, uz, lake_levels=()):
    """Best dam candidate at one stream point, or None."""
    H, x0, z0 = window(heights, x, z)
    if np.isnan(H).any():
        return None
    k = int(SNAP / CELL)
    c = H.shape[0] // 2
    sub = H[c - k:c + k + 1, c - k:c + k + 1]
    di, dj = np.unravel_index(np.argmin(sub), sub.shape)
    bx, bz = x0 + (c - k + dj) * CELL, z0 + (c - k + di) * CELL
    bed = float(sub[di, dj])
    if any(bed < lv + LAKE_MARGIN for lv in lake_levels):
        return None
    # Downstream is where the ground falls along the line.
    ahead = heights.sample([bx + ux * 30], [bz + uz * 30])[0]
    behind = heights.sample([bx - ux * 30], [bz - uz * 30])[0]
    if math.isnan(ahead) or math.isnan(behind) or abs(ahead - behind) < 0.2:
        return None  # flat, a lake margin or a bog: no stream to dam
    flow = (ux, uz) if ahead < behind else (-ux, -uz)
    best = None
    for crest in CRESTS:
        r = evaluate(H, x0, z0, (bx, bz), flow, crest)
        if r and (best is None or r["pond_m2"] > best["pond_m2"]):
            best = r
    if best is None:
        return None
    # The site is where the drawn stream runs (the OSM line point), so the ring, the dam, and the pond sit on the
    # stream the player sees. The channel bed found next to it sets the bed height and the pond.
    return {"x": round(x, 1), "z": round(z, 1), "bed_m": round(bed, 2),
            "flow": [round(flow[0], 3), round(flow[1], 3)], **best}


def thin(sites):
    """Keep the biggest pond within SPACING metres."""
    kept = []
    for s in sorted(sites, key=lambda s: -s["pond_m2"]):
        if all(math.hypot(s["x"] - k["x"], s["z"] - k["z"]) >= SPACING for k in kept):
            kept.append(s)
    return kept


def read_streams(root=TILES):
    """Stream segments (name, points) clipped per tile, plus the lake levels per tile."""
    segs, lakes = [], {}
    for f in sorted((Path(root) / "water").glob("*.json")):
        doc = json.loads(f.read_text())
        tx, tz = map(int, f.stem.split("_"))
        if doc.get("lakeLevel_m") is not None:
            lakes[(tx, tz)] = doc["lakeLevel_m"]
        segs += [(s["name"], tx, tz, s["pts"]) for s in doc["streams"]]
    return segs, lakes


def scan(root=TILES):
    heights = Heights(root)
    segs, lakes = read_streams(root)
    sites = []
    for name, tx, tz, pts in segs:
        # Lake levels of this tile and its neighbours bound the "this is a lake" test.
        lv = [lakes[k] for k in ((tx + a, tz + b) for a in (-1, 0, 1) for b in (-1, 0, 1)) if k in lakes]
        for x, z, ux, uz in along(pts, STEP):
            if int(math.floor(x / TILE)) != tx or int(math.floor(z / TILE)) != tz:
                continue
            s = scan_point(heights, x, z, ux, uz, lv)
            if s:
                sites.append({"stream": name, **s})
    return thin(sites)


def by_location(sites, root=TILES):
    index = json.loads((Path(root) / "index.json").read_text())
    anchors = [a for a in index["anchors"] if a["kind"] == "location"]
    out = {}
    for s in sites:
        a = min(anchors, key=lambda a: math.hypot(a["x"] - s["x"], a["z"] - s["z"]))
        s["near"] = a["id"]
        out.setdefault(a["id"], []).append(s)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=str(TILES / "dam_sites.json"))
    args = ap.parse_args()
    sites = scan()
    groups = by_location(sites)
    Path(args.out).write_text(json.dumps({"sites": sites}, indent=1))
    print(f"{len(sites)} candidate dam sites, written to {args.out}")
    for loc, ss in sorted(groups.items()):
        areas = sorted(s["pond_m2"] for s in ss)
        print(f"  {loc:22s} {len(ss):4d} sites, ponds {areas[0]} to {areas[-1]} m2, "
              f"median {areas[len(areas) // 2]} m2")


if __name__ == "__main__":
    main()
