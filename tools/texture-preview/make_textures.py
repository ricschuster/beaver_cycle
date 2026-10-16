"""Make the two tiling image textures of the texture preview (#458): rock and bark, 256 px grey, own work (CC0).

They are stand-ins for what an artist or a CC0 source would give: mid grey with the detail around it, so the game can
multiply them with the per face colour. Same output every run. `python3 tools/texture-preview/make_textures.py`
"""
from pathlib import Path

import numpy as np
from PIL import Image

N = 256
OUT = Path(__file__).parent
rng = np.random.default_rng(458)


def tiling_noise(period: int, seed: int) -> np.ndarray:
    """Value noise that wraps without a seam, 0 to 1, `period` lattice cells across."""
    r = np.random.default_rng(seed)
    lattice = r.random((period, period))
    u = np.linspace(0, period, N, endpoint=False)
    i = u.astype(int)
    f = u - i
    s = f * f * (3 - 2 * f)
    a = lattice[np.ix_(i, i)]
    b = lattice[np.ix_(i, (i + 1) % period)]
    c = lattice[np.ix_((i + 1) % period, i)]
    d = lattice[np.ix_((i + 1) % period, (i + 1) % period)]
    sx = s[None, :]
    sy = s[:, None]
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy


def fractal(periods, weights, seed):
    return sum(w * tiling_noise(p, seed + k) for k, (p, w) in enumerate(zip(periods, weights))) / sum(weights)


def save(name: str, grey: np.ndarray) -> None:
    g = (grey - grey.min()) / (grey.max() - grey.min())
    Image.fromarray((255 * (0.45 + 0.55 * g)).astype(np.uint8), 'L').save(OUT / name, optimize=True)


# Rock: lumpy mid tones, fine speckle, and a few dark cracks where two noises cross.
lump = fractal([4, 8, 16, 32], [0.4, 0.3, 0.2, 0.1], 10)
speck = rng.random((N, N))
crack_field = np.abs(fractal([6, 12], [0.6, 0.4], 50) - 0.5)
cracks = np.clip(1 - crack_field / 0.025, 0, 1)
save('rock.png', lump * 0.75 + speck * 0.12 - cracks * 0.5)

# Bark: long furrows that run down the texture, broken up a little across.
x = fractal([10, 20, 40], [0.5, 0.3, 0.2], 90)
cols = np.abs(np.sin(np.linspace(0, 2 * np.pi * 14, N, endpoint=False) + 6 * (x[0] - 0.5)))[None, :]
ridged = 1 - np.tile(cols, (N, 1))
bark = ridged * 0.55 + fractal([2, 8], [0.5, 0.5], 70) * 0.3 + rng.random((N, N)) * 0.15
save('bark.png', bark)
