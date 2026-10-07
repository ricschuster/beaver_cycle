#!/usr/bin/env python3
"""Draw the dam site candidates on a map: hillshade from the 5 m tiles, lakes, streams, the sites.

Reads public/tiles/ and the dam_sites.json that scan_dam_sites.py writes there. Writes a PNG, 5 m
per pixel, north up. Dot colour is the pond size as in the game (yellow under 600 m2, orange under
1500, red above), a short white bar is the dam, and the labels are the location anchors.
Run: python3 tools/dam-sites/map_dam_sites.py [--out dam_sites.png] [--box X0 Z0 X1 Z1]
"""
import argparse
import json
import math
import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
TILES = ROOT / "public" / "tiles"
TILE = 320.0
M_PER_PX = 5.0
LAKE_CLASS = 9
COLOURS = ((255, 225, 74), (255, 154, 46), (255, 59, 59))


def read_l0(path):
    """Heights (n x n, metres) and land cover classes of a level 0 tile."""
    data = path.read_bytes()
    n = struct.unpack_from("<H", data, 6)[0]
    qmin = struct.unpack_from("<i", data, 8)[0]
    scale = struct.unpack_from("<f", data, 12)[0]
    h = np.frombuffer(data, "<u2", (n + 1) ** 2, 16).reshape(n + 1, n + 1)
    cls = np.frombuffer(data, "u1", n * n, 16 + 2 * (n + 1) ** 2).reshape(n, n)
    return (h.astype(float) + qmin) * scale, cls


def base_image(box):
    """Hillshaded ground with lakes, for the box (x0, z0, x1, z1) in metres."""
    x0, z0, x1, z1 = box
    w, h = int((x1 - x0) / M_PER_PX), int((z1 - z0) / M_PER_PX)
    height = np.full((h, w), np.nan)
    lake = np.zeros((h, w), bool)
    n = int(TILE / M_PER_PX)
    for f in (TILES / "L0").glob("*.bin"):
        tx, tz = map(int, f.stem.split("_"))
        px, pz = int((tx * TILE - x0) / M_PER_PX), int((tz * TILE - z0) / M_PER_PX)
        if px < 0 or pz < 0 or px + n > w or pz + n > h:
            continue
        hh, cc = read_l0(f)
        height[pz:pz + n, px:px + n] = hh[:n, :n]
        lake[pz:pz + n, px:px + n] = cc == LAKE_CLASS
    fill = np.where(np.isnan(height), np.nanmin(height), height)
    gz, gx = np.gradient(fill, M_PER_PX)
    shade = np.clip(0.6 + 1.8 * (-gx - gz) / math.sqrt(2) * 0.5 + 0.0, 0.2, 1.0)  # light from the north west
    img = np.stack([shade * 205 + 20, shade * 215 + 20, shade * 190 + 20], -1)
    img[lake] = (60, 130, 175)
    img[np.isnan(height)] = (150, 150, 150)
    return Image.fromarray(img.astype(np.uint8))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default="dam_sites.png")
    ap.add_argument("--box", type=float, nargs=4, metavar=("X0", "Z0", "X1", "Z1"),
                    help="metres, default the sites with a margin")
    args = ap.parse_args()
    sites = json.loads((TILES / "dam_sites.json").read_text())["sites"]
    index = json.loads((TILES / "index.json").read_text())
    if args.box:
        box = args.box
    else:
        box = (min(s["x"] for s in sites) - 300, min(s["z"] for s in sites) - 300,
               max(s["x"] for s in sites) + 300, max(s["z"] for s in sites) + 300)
    box = tuple(math.floor(v / TILE) * TILE if i < 2 else math.ceil(v / TILE) * TILE for i, v in enumerate(box))
    img = base_image(box)
    d = ImageDraw.Draw(img)

    def px(x, z):
        return ((x - box[0]) / M_PER_PX, (z - box[1]) / M_PER_PX)

    for f in (TILES / "water").glob("*.json"):
        for s in json.loads(f.read_text())["streams"]:
            d.line([px(*p) for p in s["pts"]], fill=(40, 100, 200), width=2)
    for s in sites:
        ax, az = -s["flow"][1], s["flow"][0]
        a = px(s["x"] + ax * s["left_m"], s["z"] + az * s["left_m"])
        b = px(s["x"] - ax * s["right_m"], s["z"] - az * s["right_m"])
        d.line([a, b], fill=(255, 255, 255), width=2)
        c = COLOURS[0 if s["pond_m2"] < 600 else 1 if s["pond_m2"] < 1500 else 2]
        x, y = px(s["x"], s["z"])
        d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=c, outline=(0, 0, 0))
    for a in index["anchors"]:
        if a["kind"] != "location" and a["id"] not in ("almsee",):
            continue
        x, y = px(a["x"], a["z"])
        if 0 <= x < img.width and 0 <= y < img.height:
            d.rectangle([x - 4, y - 4, x + 4, y + 4], outline=(0, 0, 0), fill=(255, 255, 255))
            d.text((x + 8, y - 6), a["name"], fill=(0, 0, 0))
    img.save(args.out)
    print(f"{img.width} x {img.height} px, box {box}, {len(sites)} sites, written to {args.out}")


if __name__ == "__main__":
    main()
