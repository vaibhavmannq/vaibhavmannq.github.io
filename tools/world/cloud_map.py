"""The sky's own cloud map (plan Task 12b, s32): public/world/sky/clouds.png, 512 x 512 RGBA, tiling in both axes.

Run: python tools/world/cloud_map.py
R  shapes: Perlin-Worley (the Nubis recipe: a soft fbm remapped by billowy Worley, so clouds have rounded edges)
G  detail: a finer Worley sum, used to erode edges into wisps
B  the high layer: elongated cells (bands of altocumulus, streaks of cirrus)
A  weather: a slow fbm, where cloud may form at all (breaks up the cover into fields and gaps)
Baked offline so the browser does no noise work (a 512^2 Worley sum would freeze a phone's main thread ~100 ms).
"""
import os
import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "public", "world", "sky", "clouds.png")
N = 512


def value_fbm(n, cells, octaves, seed, gain=0.5):
    rng = np.random.default_rng(seed)
    out = np.zeros((n, n), np.float32)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        c = cells << o
        lat = rng.random((c, c)).astype(np.float32)
        f = (np.arange(n) + 0.5) / n * c
        i0 = np.floor(f).astype(int)
        t = f - i0
        s = t * t * (3 - 2 * t)
        a, b = i0 % c, (i0 + 1) % c
        rows = lat[a][:, a] * (1 - s)[None, :] + lat[a][:, b] * s[None, :]
        rows2 = lat[b][:, a] * (1 - s)[None, :] + lat[b][:, b] * s[None, :]
        out += amp * (rows * (1 - s)[:, None] + rows2 * s[:, None])
        norm += amp
        amp *= gain
    out /= norm
    return (out - out.min()) / (out.max() - out.min())


def worley(n, cx, cy, seed):
    """1 - distance to the nearest feature point, points jittered one per cell, wrapping. cx, cy cells across."""
    rng = np.random.default_rng(seed)
    pts = rng.random((cy, cx, 2)).astype(np.float32)
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    fx = (xs + 0.5) / n * cx
    fy = (ys + 0.5) / n * cy
    ix, iy = np.floor(fx).astype(int), np.floor(fy).astype(int)
    best = np.full((n, n), 9.0, np.float32)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            jx, jy = ix + dx, iy + dy
            p = pts[jy % cy, jx % cx]
            d = np.hypot(jx + p[..., 0] - fx, jy + p[..., 1] - fy)
            best = np.minimum(best, d)
    return np.clip(1 - best, 0, 1)


def worley_fbm(n, cells, seed, cy=None):
    cy = cy or cells
    return (worley(n, cells, cy, seed) * 0.625 + worley(n, cells * 2, cy * 2, seed + 1) * 0.25
            + worley(n, cells * 4, cy * 4, seed + 2) * 0.125)


def remap(v, lo, hi, a, b):
    return a + (v - lo) / np.maximum(hi - lo, 1e-5) * (b - a)


def norm(v):
    return (v - v.min()) / (v.max() - v.min())


def equalise(v):
    """Rank the values onto 0..1 evenly (monotone, so the shapes keep their form): a cover c then gives c of the sky."""
    flat = v.ravel()
    ranks = np.empty(flat.size, np.float32)
    ranks[np.argsort(flat, kind="stable")] = np.arange(flat.size, dtype=np.float32)
    return (ranks / (flat.size - 1)).reshape(v.shape)


def main():
    perlin = value_fbm(N, 4, 6, 11)
    wf = worley_fbm(N, 4, 21)
    shapes = norm(np.clip(remap(perlin, wf - 1, 1, 0, 1), 0, 1))
    detail = norm(worley_fbm(N, 16, 31))
    high = norm(worley_fbm(N, 6, 41, cy=24) * 0.7 + value_fbm(N, 8, 4, 51) * 0.3)
    weather = value_fbm(N, 2, 3, 61)
    img = np.stack([equalise(shapes), detail, equalise(high), weather], -1)
    out = np.clip(img * 255 + 0.5, 0, 255).astype(np.uint8)
    cv2.imwrite(OUT, cv2.cvtColor(out, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_PNG_COMPRESSION, 9])
    print(OUT, os.path.getsize(OUT) // 1024, "kB")


if __name__ == "__main__":
    main()
