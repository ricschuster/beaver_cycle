"""Stream snap checks on a made-up valley. No game data needed.

Run with: python3 -m pytest tools/tiles/test_snap_streams.py
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import snap_streams as ss  # noqa: E402


def valley(channel_x=0.0, slope=0.2, relief_cap=None, cell=5.0, half=300.0):
    """A stream along z (south) in a V valley whose channel is at x = channel_x, banks rising `slope` m per m."""
    n = int(2 * half / cell) + 1
    xs = -half + np.arange(n) * cell
    gx, gz = np.meshgrid(xs, xs)
    h = 100.0 - gz / 40.0 + np.abs(gx - channel_x) * slope
    if relief_cap is not None:
        h = np.minimum(h, 100.0 - gz / 40.0 + relief_cap)
    return ss.Heights(h, -half, -half, cell)


def line_at(x, z0=-100.0, z1=100.0):
    return [(x, z0), (x, (z0 + z1) / 2), (x, z1)]


def test_line_beside_the_channel_moves_onto_it():
    new, o = ss.snap_line(line_at(8.0), valley(0.0))
    mid = [p for p in new if abs(p[1]) < 60]
    assert all(abs(x) <= 1.0 for x, _ in mid)


def test_line_on_the_channel_stays():
    new, o = ss.snap_line(line_at(0.0), valley(0.0))
    assert np.abs(o).max() <= 0.5


def test_move_is_limited_to_the_corridor():
    new, o = ss.snap_line(line_at(0.0), valley(40.0))
    assert np.abs(o).max() <= ss.CORRIDOR + 1e-6
    assert all(abs(x) <= ss.CORRIDOR + 1e-6 for x, _ in new)


def test_flat_ground_keeps_the_osm_line():
    new, o = ss.snap_line(line_at(8.0), valley(0.0, slope=0.01))
    assert np.abs(o).max() == 0.0
    assert all(abs(x - 8.0) < 1e-6 for x, _ in new)


def test_ends_stay_and_order_is_kept():
    new, o = ss.snap_line(line_at(8.0), valley(0.0))
    assert abs(new[0][0] - 8.0) < 1e-6 and abs(new[0][1] + 100.0) < 1e-6
    assert abs(new[-1][0] - 8.0) < 1e-6 and abs(new[-1][1] - 100.0) < 1e-6
    zs = [z for _, z in new]
    assert zs == sorted(zs)
    steps = np.hypot(np.diff([x for x, _ in new]), np.diff(zs))
    assert steps.max() <= ss.STEP + ss.MAX_SHIFT + 1e-6  # smooth: no jumps


def test_a_lake_keeps_the_line():
    lake_mask = np.ones_like(valley().h, bool)
    ground = valley(0.0)
    new, o = ss.snap_line(line_at(8.0), ground, lambda x, z: ground.mask_at(lake_mask, x, z))
    assert np.abs(o).max() == 0.0


def test_off_the_data_keeps_the_line():
    new, o = ss.snap_line(line_at(8.0, 350.0, 550.0), valley(0.0))  # the lattice ends at z = 300
    assert np.abs(o).max() == 0.0
    # A line that leaves the data is snapped only where the ground is known.
    new, o = ss.snap_line(line_at(8.0, 250.0, 450.0), valley(0.0))
    assert np.abs(o[-10:]).max() == 0.0


def test_snap_streams_reports_names_and_moves():
    out, report = ss.snap_streams([(line_at(8.0), "Bach"), (line_at(0.0), "Graben")], valley(0.0))
    assert [n for _, n in out] == ["Bach", "Graben"]
    assert report["points"] > 0 and report["max_m"] >= 5.0 and report["max_m"] <= ss.CORRIDOR
    assert report["median_m"] <= report["p90_m"] <= report["max_m"]
    assert all(name == "Bach" for name, *_ in report["big_moves"])


def test_a_degenerate_line_comes_back_unchanged():
    new, o = ss.snap_line([(1.0, 1.0), (1.0, 1.0)], valley())
    assert new == [(1.0, 1.0), (1.0, 1.0)]
