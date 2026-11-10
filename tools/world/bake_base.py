"""Bake the world base from coast.py (run: python tools/world/bake_base.py).

Writes public/world/base/:
  heights.bin  uint16 LE, 8 m grid over x -2000..1200, y -2400..1600 (401 x 501), rows along x, row j = y0 + j*step
  ring.bin     uint16 LE horizon ring around (-400, -400), radius 1500..7000 geometric over nr, angle from north over na
  colour.webp  one pixel per height sample, north up, painted by coast.py's zones (tune by eye against the renders)
  base.json    the grids' meta: z = lo + q * (hi - lo) / 65535
"""
import json, os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import coastlib

OUT = os.path.normpath(os.path.join(HERE, "..", "..", "public", "world", "base"))
GRID = dict(x0=-2000.0, x1=1200.0, y0=-2400.0, y1=1600.0, step=8.0)
RING = dict(cx=-400.0, cy=-400.0, r0=1500.0, r1=7000.0, nr=120, na=288)

HEX = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float64) / 255.0
SEABED, SAND, WET, MEADOW, SCRUB, ROCK, BARE = (HEX(c) for c in
    ("#3b4a4f", "#c9b48a", "#8f7d62", "#5f6b3e", "#4c5034", "#6b625a", "#7a736b"))


def quantise(h):
    lo, hi = float(np.floor(h.min())), float(np.ceil(h.max()))
    q = np.round((h - lo) / (hi - lo) * 65535).astype("<u2")
    return q, lo, hi


def sm(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def paint(h, step):
    gy, gx = np.gradient(h, step)
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    col = MEADOW[None, None, :] * np.ones(h.shape + (3,))
    mix = lambda base, c, w: base * (1 - w[..., None]) + c[None, None, :] * w[..., None]
    col = mix(col, SCRUB, sm(30, 60, h))
    col = mix(col, BARE, sm(160, 220, h))
    col = mix(col, SAND, sm(2.0, 0.8, h))
    col = mix(col, WET, sm(0.6, 0.1, h) * sm(-0.4, 0.0, h))
    col = mix(col, SEABED, sm(0.0, -0.6, h))
    col = mix(col, ROCK, sm(28, 42, slope) * sm(-0.5, 1.0, h))
    return col


def main():
    os.makedirs(OUT, exist_ok=True)
    c = coastlib.load()
    g = GRID
    xs = np.arange(g["x0"], g["x1"] + 1e-6, g["step"]); ys = np.arange(g["y0"], g["y1"] + 1e-6, g["step"])
    X, Y = np.meshgrid(xs, ys)
    h = np.asarray(c.ground(X, Y), np.float64)
    q, lo, hi = quantise(h)
    q.tofile(os.path.join(OUT, "heights.bin"))
    heights = dict(x0=g["x0"], y0=g["y0"], step=g["step"], nx=len(xs), ny=len(ys), lo=lo, hi=hi)

    r = RING
    R = r["r0"] * (r["r1"] / r["r0"]) ** (np.arange(r["nr"]) / (r["nr"] - 1))
    T = 2 * np.pi * np.arange(r["na"]) / r["na"]
    RR, TT = np.meshgrid(R, T, indexing="ij")
    hr = np.asarray(c.ground(r["cx"] + RR * np.sin(TT), r["cy"] + RR * np.cos(TT)), np.float64)
    qr, rlo, rhi = quantise(hr)
    qr.tofile(os.path.join(OUT, "ring.bin"))
    ring = dict(r, lo=rlo, hi=rhi)

    col = paint(h, g["step"])[::-1]          # north up
    Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, "colour.webp"), quality=85, method=6)
    with open(os.path.join(OUT, "base.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(dict(heights=heights, ring=ring, colour=dict(file="colour.webp", northUp=True)), f, indent=1)
        f.write("\n")
    for name in ("heights.bin", "ring.bin", "colour.webp"):
        print(f"{name:12s} {os.path.getsize(os.path.join(OUT, name)) / 1e3:7.1f} kB")
    print("heights", heights, "ring lo/hi", rlo, rhi)


if __name__ == "__main__":
    main()
