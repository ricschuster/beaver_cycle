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


def stream_at(x):
    """A stream line along z at `x`, through the whole window."""
    return sd.StreamLines([[(x, -100.0), (x, 100.0)]])


class FakeHeights:
    """The made-up valley as a ground, for scan_point."""

    def __init__(self, width_slope):
        self.slope = width_slope

    def sample(self, x, z):
        x, z = np.asarray(x, float), np.asarray(z, float)
        return 100.0 - z / 40.0 + np.abs(x) * self.slope


def test_stream_lines_distance_and_nearby_points():
    lines = stream_at(10.0)
    assert abs(lines.distance(13.0, 0.0, 50.0) - 3.0) < 1e-6
    assert lines.distance(100.0, 0.0, 50.0) == 50.0  # capped when nothing is closer
    p = lines.within(10.0, 0.0, 5.0)
    assert len(p) == 11 and np.allclose(p[:, 0], 10.0)


def test_pond_on_the_stream_passes_the_line_gate():
    H, x0, z0 = valley(0.1)
    r = sd.evaluate(H, x0, z0, (0.0, 0.0), (0.0, 1.0), 1.0, stream_at(0.0))
    assert r is not None
    assert r["on_line"] >= sd.MIN_NEAR_SHARE
    assert r["line_in_pond"] >= sd.MIN_LINE_IN_POND


def test_pond_beside_the_stream_fails_the_line_gate():
    H, x0, z0 = valley(0.1)
    assert sd.evaluate(H, x0, z0, (0.0, 0.0), (0.0, 1.0), 1.0) is not None  # holds a pond without the gate
    assert sd.evaluate(H, x0, z0, (0.0, 0.0), (0.0, 1.0), 1.0, stream_at(30.0)) is None


def test_without_lines_evaluate_adds_no_gate_fields():
    H, x0, z0 = valley(0.1)
    r = sd.evaluate(H, x0, z0, (0.0, 0.0), (0.0, 1.0), 1.0)
    assert "on_line" not in r and "line_in_pond" not in r


def test_scan_point_keeps_a_site_on_the_stream_and_drops_one_beside_it():
    ground = FakeHeights(0.1)
    on = sd.scan_point(ground, 0.0, 0.0, 0.0, 1.0, (), stream_at(0.0))
    assert on is not None and on["on_line"] >= sd.MIN_NEAR_SHARE
    assert sd.scan_point(ground, 0.0, 0.0, 0.0, 1.0, (), stream_at(30.0)) is None
    assert sd.scan_point(ground, 0.0, 0.0, 0.0, 1.0, (), None) is not None  # no lines, no gate


def test_the_level_one_pond_must_pass_the_gate():
    # Steep banks hold a level 1 pond; the line gate is judged at LEVEL1_CREST, so a site whose only
    # passing pond is a higher crest is dropped.
    assert sd.LEVEL1_CREST in sd.CRESTS
    H, x0, z0 = valley(0.1)
    levels = [sd.evaluate(H, x0, z0, (0.0, 0.0), (0.0, 1.0), c, stream_at(0.0)) for c in sd.CRESTS]
    assert levels[sd.CRESTS.index(sd.LEVEL1_CREST)] is not None


def test_a_site_records_the_dam_length_at_each_crest():
    site = sd.scan_point(FakeHeights(0.1), 0.0, 0.0, 0.0, 1.0, (), None)
    assert len(site["dam_widths"]) == len(sd.CRESTS)
    assert site["dam_widths"][0] and site["dam_widths"][0] > 0
