"""Tile tool checks. Needs data/raw/ (run tools/area-editor/build_data.py first).

Run with: python3 -m pytest tools/tiles
"""
import json
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent))
import build_tiles as bt  # noqa: E402

pytestmark = pytest.mark.skipif(not (bt.ROOT / "data/raw/almsee_dgm5_31287.tif").exists(),
                                reason="data/raw/ not built")


@pytest.fixture(scope="module")
def tiles(tmp_path_factory):
    out = tmp_path_factory.mktemp("tiles")
    bt.build(out)
    return out


def test_edges_and_known_height(tiles):
    bt.check(tiles)


def test_index_lists_every_tile_file(tiles):
    index = json.loads((tiles / "index.json").read_text())
    for t in index["tiles"]:
        for level in ([2] if t.get("far") else range(3)):
            assert (tiles / f"L{level}" / f"{t['tx']}_{t['tz']}.bin").exists()


def test_backdrop_reaches_the_ridges_beyond_the_play_area(tiles):
    index = json.loads((tiles / "index.json").read_text())
    far = [t for t in index["tiles"] if t.get("far")]
    assert len(far) > 500
    assert max(t["max_m"] for t in far) > 1500  # the peaks around the valley


def test_lake_bed_is_below_the_lake_level(tiles):
    index = json.loads((tiles / "index.json").read_text())
    level = next(l["level_m"] for l in index["lakes"] if l["name"] == "Almsee")
    depths = []
    for t in index["tiles"]:
        if t["lakeLevel_m"] is None or abs(t["lakeLevel_m"] - level) > 0.5:
            continue  # tiles of the other lakes (the Oedsee) have their own level
        _, _, h, c = bt.read_tile(tiles / "L0" / f"{t['tx']}_{t['tz']}.bin")
        wet = c == bt.CLASSES["lake"]
        if wet.any():
            corners = (h[:-1, :-1] + h[1:, :-1] + h[:-1, 1:] + h[1:, 1:]) / 4
            depths.extend(level - corners[wet])
    assert depths, "no lake cells"
    assert sorted(depths)[len(depths) // 100] > 0  # all but odd shore cells are under the level
    assert max(depths) > 5.0  # the made up bed is deep in the middle


def lake_depths_by_z(tiles, level):
    """(z in metres, depth) for every lake cell of the core tiles."""
    index = json.loads((tiles / "index.json").read_text())
    out = []
    for t in index["tiles"]:
        if t["lakeLevel_m"] is None or abs(t["lakeLevel_m"] - level) > 0.5:
            continue
        _, _, h, c = bt.read_tile(tiles / "L0" / f"{t['tx']}_{t['tz']}.bin")
        wet = c == bt.CLASSES["lake"]
        if not wet.any():
            continue
        corners = (h[:-1, :-1] + h[1:, :-1] + h[:-1, 1:] + h[1:, 1:]) / 4
        rows = np.nonzero(wet)[0]
        zs = t["tz"] * bt.TILE + (rows + 0.5) * bt.CELL
        out.extend(zip(zs, level - corners[wet]))
    return np.array(out)


def test_south_bog_is_shallow_and_open_water_stays_deep(tiles):
    index = json.loads((tiles / "index.json").read_text())
    level = next(l["level_m"] for l in index["lakes"] if l["name"] == "Almsee")
    z, depth = lake_depths_by_z(tiles, level).T
    bog = depth[z >= bt.BOG_RAMP_Z[1]]
    assert len(bog) > 100
    assert bog.max() < 0.5  # water mostly under 50 cm (03_location.md)
    assert depth[z < bt.BOG_RAMP_Z[0]].max() > 5.0  # open water keeps its depth


def test_south_ramp_acts_on_the_almsee_only():
    # Two identical square lakes far south (z 4000 to 4400), one named Almsee.
    g = bt.Grid.window(0.0, 4000.0, 100, 80, 5.0)
    h = np.full((g.ncz + 1, g.ncx + 1), 500.0)
    ring = lambda x0: [[(x0, 4000.0), (x0 + 200.0, 4000.0), (x0 + 200.0, 4400.0), (x0, 4400.0)]]
    lakes = [(ring(20.0), "Almsee"), (ring(280.0), "Elmsee")]
    h2, _, _, level, _, _ = bt.make_lake_bed(g, h, lakes, np.zeros((g.ncz, g.ncx), bool))
    depth = level - h2
    assert np.nanmax(depth[:, 4:36]) < 0.5  # the Almsee is bog this far south
    assert np.nanmax(depth[:, 56:]) > 3.0  # the other lake keeps open water depth


def test_flat_shelf_shore_has_no_cliff():
    # A lake with a slanted outline beside a shelf 0.2 m above the level: the bed must taper to the level, not drop 0.8 m.
    g = bt.Grid.window(0.0, 0.0, 100, 100, 2.0)
    h = np.full((g.ncz + 1, g.ncx + 1), 500.2)
    ring = [[(0.0, 0.0), (80.0, 0.0), (140.0, 200.0), (0.0, 200.0)]]
    h2, _, vert, level, _, _ = bt.make_lake_bed(g, h, [(ring, "Elmsee")], np.zeros((g.ncz, g.ncx), bool))
    step = np.maximum(np.abs(np.diff(h2, axis=0))[:, :-1], np.abs(np.diff(h2, axis=1))[:-1, :])
    assert vert.any() and step.max() < 0.5
    assert np.nanmax(h2 - level) <= 0.2 + 1e-9  # the shelf is never raised


def test_steep_bare_ground_turns_to_rock_and_the_rest_stays():
    ground, forest, meadow = bt.CLASSES["ground"], bt.CLASSES["forest"], bt.CLASSES["meadow"]
    h = np.zeros((7, 7))
    h[:, 3:] = (np.arange(7)[3:] - 3) * 5.0
    code = np.full((6, 6), ground, dtype=np.uint8)
    code[0, 5] = forest
    code[1, 5] = meadow
    n = bt.steep_ground_to_rock(code, h, 5.0)
    assert (code[:, :2] == ground).all()  # flat ground stays
    assert code[2, 5] == bt.CLASSES["rock"] and n > 0
    assert code[0, 5] == forest and code[1, 5] == meadow  # mapped cover is not touched


@pytest.mark.skipif(not list(bt.ROOT.glob("data/raw/dtm1_*_31287.tif")), reason="BEV 1 m terrain not cached (run build_tiles.py once)")
def test_fine_tiles_join_and_sit_on_the_5m_ground(tmp_path):
    index = bt.build(tmp_path, fine=2)
    fine = [t for t in index["tiles"] if t.get("fine")]
    assert fine, "no fine tiles near the lake"
    for t in fine:
        assert (tmp_path / "L3" / f"{t['tx']}_{t['tz']}.bin").exists()
    assert index["levels"][-1] == {"level": 3, "cell_m": 2, "cells": 160, "fine": True}
    bt.check(tmp_path)


def test_fine_regions_group_touching_tiles_and_pad_them():
    regions = bt.fine_regions([(0, 0), (1, 1), (5, 5), (5, 6)])
    assert [r[1] for r in regions] == [[(0, 0), (1, 1)], [(5, 5), (5, 6)]]
    grid = regions[0][0]
    assert (grid.tx0, grid.tz0, grid.ntx, grid.ntz) == (-1, -1, 4, 4)


def test_stream_width_by_kind():
    assert bt.stream_width({"waterway": "river"}) == bt.RIVER_WIDTH_M
    assert bt.stream_width({"waterway": "stream"}) == bt.STREAM_WIDTH_M
    assert bt.stream_width({"waterway": "stream", "intermittent": "yes"}) == bt.SEASONAL_WIDTH_M
    assert bt.stream_width({"waterway": "stream", "width": "4 m"}) == 4.0
    assert bt.stream_width({"waterway": "river", "width": "junk"}) == bt.RIVER_WIDTH_M
    assert bt.stream_width({"waterway": "river", "name": "Alm"}) == 10.0
    assert bt.stream_width({"waterway": "river", "name": "Straneggbach"}) == 3.0
    assert bt.stream_width({"waterway": "stream", "name": "Aagbach"}) == 5.0
    assert bt.stream_width({"waterway": "stream", "name": "Aagbach", "width": "7"}) == 7.0


def test_shingle_is_gravel_not_rock():
    import build_data
    assert build_data.LANDCOVER[("natural", "shingle")] == "gravel"
    assert "gravel" in bt.PAINT_ORDER and bt.CLASSES["gravel"] not in (bt.CLASSES["rock"], bt.CLASSES["ground"])


def test_sloping_river_water_has_a_level_grid_and_lakes_stay_flat(tiles):
    index = json.loads((tiles / "index.json").read_text())
    grids = {}
    for t in index["tiles"]:
        f = tiles / "water" / f"{t['tx']}_{t['tz']}.json"
        if f.exists():
            grid = json.loads(f.read_text()).get("levels")
            if grid:
                grids[(t["tx"], t["tz"])] = grid
    assert grids, "the Alm river drops over its delta, so some tile needs a level grid"
    # the Almsee is flat: none of its tiles carries a grid
    almsee = next(l["level_m"] for l in index["lakes"] if l["name"] == "Almsee")
    for t in index["tiles"]:
        if t["lakeLevel_m"] is not None and abs(t["lakeLevel_m"] - almsee) < 0.5 and not t.get("far"):
            assert (t["tx"], t["tz"]) not in grids, f"flat lake tile {t['tx']},{t['tz']} has a level grid"
    # tiles side by side agree on the levels along their shared edge
    for (tx, tz), a in grids.items():
        b = grids.get((tx + 1, tz))
        if b:
            n = a["n"]
            for j in range(n):
                x, y = a["v"][j * n + n - 1], b["v"][j * n]
                assert x is None or y is None or abs(x - y) < 0.01, f"level edge of {tx},{tz}"
