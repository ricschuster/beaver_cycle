"""Snap OSM stream lines onto the channel of the terrain (docs/decisions/0010-snap-streams-to-the-channel.md).

OSM says which streams exist, their names and their rough route. The terrain says where the channel
really is, and the pond fill, the swimming rule and the dam scan all read the terrain. So each line is
resampled every STEP metres and moved sideways, at most CORRIDOR metres, to the lowest ground across it.
The path is found with Viterbi over the candidate offsets, so the line stays smooth and in order and
cannot jump to the next valley. Where the ground across the line is flat (under MIN_RELIEF metres of
relief), in a lake, or off the data, the OSM position is kept. The ends of a line stay where they are.

Pure numpy, no GDAL. `snap_streams` is called from build_tiles.py on the 5 m height lattice.
"""
import math

import numpy as np

CORRIDOR = 15.0  # metres each side of the OSM line searched for the channel
STEP = 5.0  # metres between resampled points
OFFSET_STEP = 1.0  # metres between candidate offsets across the line
MIN_RELIEF = 1.0  # metres of relief across the line below which there is no channel to find
MAX_SHIFT = 3.0  # metres the offset may change between neighbouring points
EVIDENCE_CAP = 3.0  # metres above the lowest ground across the line that still counts as worse
OFFSET_COST = 0.05  # cost per metre of offset: with equal ground, stay near the OSM line
SHIFT_COST = 0.1  # cost per metre the offset changes between points: keeps the line smooth
BIG_MOVE = 8.0  # metres: a point that moved further is listed in the report


class Heights:
    """Bilinear ground height on a vertex lattice with origin (x0, z0) and `cell` metres."""

    def __init__(self, h, x0, z0, cell):
        self.h, self.x0, self.z0, self.cell = h, x0, z0, cell

    def at(self, x, z):
        h = self.h
        u = (np.asarray(x, float) - self.x0) / self.cell
        v = (np.asarray(z, float) - self.z0) / self.cell
        inside = (u >= 0) & (v >= 0) & (u <= h.shape[1] - 1) & (v <= h.shape[0] - 1)
        u, v = np.clip(u, 0, h.shape[1] - 1), np.clip(v, 0, h.shape[0] - 1)
        i0, j0 = np.minimum(u.astype(int), h.shape[1] - 2), np.minimum(v.astype(int), h.shape[0] - 2)
        fu, fv = u - i0, v - j0
        out = (h[j0, i0] * (1 - fu) * (1 - fv) + h[j0, i0 + 1] * fu * (1 - fv)
               + h[j0 + 1, i0] * (1 - fu) * fv + h[j0 + 1, i0 + 1] * fu * fv)
        return np.where(inside, out, np.nan)

    def mask_at(self, mask, x, z):
        """The boolean lattice `mask` at the nearest vertex, False off the lattice."""
        i = np.rint((np.asarray(x, float) - self.x0) / self.cell).astype(int)
        j = np.rint((np.asarray(z, float) - self.z0) / self.cell).astype(int)
        ok = (i >= 0) & (j >= 0) & (i < mask.shape[1]) & (j < mask.shape[0])
        return np.where(ok, mask[np.clip(j, 0, mask.shape[0] - 1), np.clip(i, 0, mask.shape[1] - 1)], False)


def resample(pts, step):
    """Points every `step` metres along a polyline, the last point included, with unit normals."""
    xy = np.asarray(pts, float)
    seg = np.hypot(*np.diff(xy, axis=0).T)
    keep = np.r_[True, seg > 1e-9]
    xy = xy[keep]
    seg = np.hypot(*np.diff(xy, axis=0).T)
    s = np.r_[0.0, np.cumsum(seg)]
    n = max(int(math.ceil(s[-1] / step)), 1)
    t = np.linspace(0.0, s[-1], n + 1)
    p = np.c_[np.interp(t, s, xy[:, 0]), np.interp(t, s, xy[:, 1])]
    # Tangent from the neighbours, so the normal turns smoothly at the corners.
    d = np.gradient(p, axis=0)
    d /= np.maximum(np.hypot(d[:, 0], d[:, 1]), 1e-9)[:, None]
    return p, np.c_[-d[:, 1], d[:, 0]]


def snap_line(pts, ground, blocked=None):
    """The line `pts` moved onto the channel. Returns (new points, offsets in metres at each point).

    `ground` is a Heights, `blocked(x, z)` an optional function giving True where the line must stay
    (a lake). Lines of fewer than two distinct points come back as they are.
    """
    if len(pts) < 2 or len({(round(x, 3), round(z, 3)) for x, z in pts}) < 2:
        return [tuple(p) for p in pts], np.zeros(len(pts))
    p, nrm = resample(pts, STEP)
    offs = np.arange(-CORRIDOR, CORRIDOR + 1e-9, OFFSET_STEP)
    k, m = len(offs), len(p)
    qx = p[:, 0, None] + nrm[:, 0, None] * offs[None, :]
    qz = p[:, 1, None] + nrm[:, 1, None] * offs[None, :]
    h = ground.at(qx, qz)
    zero = int(np.argmin(np.abs(offs)))
    cost = np.full((m, k), np.inf)
    for i in range(m):
        col = h[i]
        fixed = i in (0, m - 1) or np.isnan(col).any()
        if not fixed and np.nanmax(col) - np.nanmin(col) < MIN_RELIEF:
            fixed = True  # no channel to find
        if not fixed and blocked is not None and blocked(qx[i], qz[i]).any():
            fixed = True  # a lake within reach
        if fixed:
            cost[i, zero] = 0.0
        else:
            cost[i] = np.minimum(col - col.min(), EVIDENCE_CAP) + OFFSET_COST * np.abs(offs)
    # Viterbi: the cheapest chain of offsets, each step moving the offset at most MAX_SHIFT.
    gap = np.abs(offs[:, None] - offs[None, :])
    trans = np.where(gap <= MAX_SHIFT + 1e-9, SHIFT_COST * gap, np.inf)
    total = cost[0].copy()
    back = np.zeros((m, k), int)
    for i in range(1, m):
        cand = total[:, None] + trans
        back[i] = np.argmin(cand, axis=0)
        total = cand[back[i], np.arange(k)] + cost[i]
    path = np.zeros(m, int)
    path[-1] = int(np.argmin(total))
    for i in range(m - 1, 0, -1):
        path[i - 1] = back[i, path[i]]
    o = offs[path]
    out = np.c_[p[:, 0] + nrm[:, 0] * o, p[:, 1] + nrm[:, 1] * o]
    return [(float(x), float(z)) for x, z in out], o


def snap_streams(streams, ground, lake_mask=None):
    """Snap every (points, name) stream. Returns (streams, report) with the report a dict of numbers.

    `lake_mask` is a boolean vertex lattice of the lakes on the same lattice as `ground`.
    """
    blocked = (lambda x, z: ground.mask_at(lake_mask, x, z)) if lake_mask is not None else None
    out, moves, big = [], [], []
    for pts, name in streams:
        new, o = snap_line(pts, ground, blocked)
        out.append((new, name))
        moves.append(np.abs(o))
        for q, d in zip(new, np.abs(o)):
            if d > BIG_MOVE:
                big.append((name, round(q[0], 1), round(q[1], 1), round(float(d), 1)))
    allm = np.concatenate(moves) if moves else np.zeros(0)
    report = {
        "points": int(len(allm)),
        "kept": int((allm < 0.5).sum()),
        "median_m": float(np.median(allm)) if len(allm) else 0.0,
        "p90_m": float(np.percentile(allm, 90)) if len(allm) else 0.0,
        "max_m": float(allm.max()) if len(allm) else 0.0,
        "big_moves": big,
    }
    return out, report
