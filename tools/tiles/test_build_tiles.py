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
        for level in range(3):
            assert (tiles / f"L{level}" / f"{t['tx']}_{t['tz']}.bin").exists()


def test_lake_bed_is_below_the_lake_level(tiles):
    index = json.loads((tiles / "index.json").read_text())
    level = next(l["level_m"] for l in index["lakes"] if l["name"] == "Almsee")
    depths = []
    for t in index["tiles"]:
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
