"""The ground's close-up detail (plan world-to-100 Task 9, cause C2): three CC0 Poly Haven maps (tools/world/sources.json)
turned into one tileable RGB image, each channel one ground's brightness detail around mid-grey:
R rock (dark_rock), G grass (aerial_grass_rock), B sand (coast_sand_03). The large-scale tone is taken out (a wrapped
blur subtracted), so the colour map keeps the land's colour and no blotch repeats; each channel is scaled to the same
spread. Soil reads a mix of the channels in the shader.

Run: python tools/world/prep_ground.py   (writes public/world/base/ground.jpg)
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(ROOT, os.environ.get("WORLD_SRC", ".superpowers/brainstorm/lookdev/assets"), "textures")
OUT = os.path.join(ROOT, "public", "world", "base", "ground.jpg")
MACRO_OUT = os.path.join(ROOT, "public", "world", "base", "ground-macro.jpg")
MACRO_SIZE = 256
SIZE = 1024
#  channel: (texture folder, file)
CHANNELS = [
    ("dark_rock", "dark_rock_diff_2k.jpg"),
    ("aerial_grass_rock", "aerial_grass_rock_diff_1k.jpg"),
    ("coast_sand_03", "coast_sand_03_diff_2k.jpg"),
]
SPREAD = 0.16  # standard deviation of each channel around 0.5
BLUR = 48  # px at SIZE: tone changes slower than this are the colour map's job


def detail(path: str) -> np.ndarray:
    img = Image.open(path).convert("L").resize((SIZE, SIZE), Image.LANCZOS)
    a = np.asarray(img, dtype=np.float32) / 255.0
    # a Gaussian blur through the FFT: it wraps around, so the tile stays seamless
    f = np.fft.fftfreq(SIZE)
    g = np.exp(-2.0 * (np.pi * BLUR) ** 2 * (f[:, None] ** 2 + f[None, :] ** 2))
    low = np.real(np.fft.ifft2(np.fft.fft2(a) * g)).astype(np.float32)
    hi = a - low
    return np.clip(0.5 + hi * (SPREAD / max(1e-6, float(hi.std()))), 0.0, 1.0)


def macro() -> np.ndarray:
    """Three independent patch patterns (tileable, band-limited noise: features 1/12 to 1/3 of the tile), 0..1."""
    rng = np.random.default_rng(2611)
    f = np.fft.fftfreq(MACRO_SIZE)
    r = np.sqrt(f[:, None] ** 2 + f[None, :] ** 2) * MACRO_SIZE  # cycles per tile
    band = np.exp(-(((np.log(np.maximum(r, 1e-6)) - np.log(5.0)) / 0.7) ** 2)) * (r > 0)
    out = []
    for _ in range(3):
        n = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((MACRO_SIZE, MACRO_SIZE))) * band))
        n = (n - n.mean()) / n.std()
        out.append(np.clip(0.5 + 0.2 * n, 0.0, 1.0))
    return np.stack(out, axis=-1)


def main() -> int:
    chans = []
    for folder, name in CHANNELS:
        path = os.path.join(SRC, folder, name)
        if not os.path.exists(path):
            print(f"missing {path}: download it from polyhaven.com (sources.json)", file=sys.stderr)
            return 1
        chans.append(detail(path))
    rgb = (np.stack(chans, axis=-1) * 255.0 + 0.5).astype(np.uint8)
    Image.fromarray(rgb, mode="RGB").save(OUT, quality=88, optimize=True)
    print(f"wrote {OUT}: {os.path.getsize(OUT) / 1024:.0f} KB")
    Image.fromarray((macro() * 255.0 + 0.5).astype(np.uint8), mode="RGB").save(MACRO_OUT, quality=90)
    print(f"wrote {MACRO_OUT}: {os.path.getsize(MACRO_OUT) / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
