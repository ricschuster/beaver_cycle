"""Dam site scan checks on a made-up valley. No game data needed.

Run with: python3 -m pytest tools/dam-sites
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import scan_dam_sites as sd  # noqa: E402


def valley(width_slope):
    """A stream along z (south) that falls 1 m per 40 m, with banks rising `width_slope` m per m."""
    k = int(sd.HALF / sd.CELL)
    xs = np.arange(-k, k + 1) * sd.CELL
    zs = np.arange(-k, k + 1) * sd.CELL
    gx, gz = np.meshgrid(xs, zs)
    return 100.0 - gz / 40.0 + np.abs(gx) * width_slope, xs[0], zs[0]


def test_steep_valley_holds_a_pond():
    H, x0, z0 = valley(0.1)
    r = sd.evaluate(H, x0, z0, (0.0, 0.0), (0.0, 1.0), 1.0)
    assert r is not None
    assert r["dam_m"] <= 21
    assert r["pond_m2"] >= sd.MIN_POND


def test_wide_flat_valley_is_too_wide():
    H, x0, z0 = valley(0.01)
    assert sd.evaluate(H, x0, z0, (0.0, 0.0), (0.0, 1.0), 1.0) is None


def test_thin_keeps_the_biggest_in_reach():
    sites = [{"x": 0, "z": 0, "pond_m2": 300}, {"x": 10, "z": 0, "pond_m2": 900},
             {"x": 200, "z": 0, "pond_m2": 250}]
    kept = sd.thin(sites)
    assert [s["pond_m2"] for s in kept] == [900, 250]
