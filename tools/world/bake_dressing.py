"""Bake the distant dressing (run: python tools/world/bake_dressing.py, after bake_base.py and bake_flights.ts).

Trees and scrub seen from the air along the flight corridors (spec §6). Writes public/world/base/dressing.bin: per
instance 4 x uint16 LE (qx, qy over the base grid's extent, scale in cm, seed), trees first, then scrub; and the counts
into base.json as `dressing`. Nothing stands inside the protected camera views (keep_at): the places get their own
detail later (M3-M7).
"""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import coastlib

ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
BASE = os.path.join(ROOT, "public", "world", "base")
CORRIDOR = 1100.0
TREES = dict(cap=8000, lo=3.0, hi=110.0, s0=6.0, s1=14.0, radius=9.0)
SCRUB = dict(cap=12000, lo=20.0, hi=180.0, s0=1.5, s1=4.0, radius=5.0)
MAX_SLOPE, MIN_GROUND, MAX_GROUND = 28.0, 2.5, 220.0


def track_points():
    """The flights' ground tracks, a point every ~10 m."""
    paths = json.load(open(os.path.join(ROOT, "src", "journey", "flightPaths.json")))
    out = []
    for f in paths:
        p = np.array(f["points"])[:, :2]
        for a, b in zip(p[:-1], p[1:]):
            n = max(2, int(np.hypot(*(b - a)) / 10))
            out.append(a + (b - a) * np.linspace(0, 1, n)[:, None])
    return np.concatenate(out)


def near_track(X, Y, pts):
    d = np.full(len(X), np.inf)
    for q in np.array_split(pts, max(1, len(pts) // 64)):
        d = np.minimum(d, np.hypot(X[:, None] - q[None, :, 0], Y[:, None] - q[None, :, 1]).min(axis=1))
    return d < CORRIDOR


def thin(X, Y, radius):
    """Keep the first candidate in each radius-sized cell: a cheap stand-in for Poisson-disc spacing."""
    cells = np.floor(X / radius).astype(np.int64) * 100003 + np.floor(Y / radius).astype(np.int64)
    _, first = np.unique(cells, return_index=True)
    return np.sort(first)


def place(c, rng, g, pts, kind, patch):
    x1 = g["x0"] + (g["nx"] - 1) * g["step"]; y1 = g["y0"] + (g["ny"] - 1) * g["step"]
    X = rng.uniform(g["x0"], x1, 600000); Y = rng.uniform(g["y0"], y1, 600000)
    m = near_track(X, Y, pts); X, Y = X[m], Y[m]
    m = c.keep_at(X, Y) < 0.015; X, Y = X[m], Y[m]      # the file rounds positions to 5 cm: stay clear of 0.02
    # Groves and thickets, not an even carpet: a noise threshold per kind, so no patch ends on a straight line.
    m = c.fbm(X / 90.0 + patch, Y / 90.0) > (0.47 if patch == 0 else 0.5); X, Y = X[m], Y[m]
    i = thin(X, Y, kind["radius"]); X, Y = X[i], Y[i]
    h = c.ground(X, Y)
    m = (h >= max(kind["lo"], MIN_GROUND)) & (h <= min(kind["hi"], MAX_GROUND)); X, Y = X[m], Y[m]
    e = 4.0
    slope = np.degrees(np.arctan(np.hypot(c.ground(X + e, Y) - c.ground(X - e, Y), c.ground(X, Y + e) - c.ground(X, Y - e)) / (2 * e)))
    m = slope < MAX_SLOPE; X, Y = X[m], Y[m]
    pick = rng.permutation(len(X))[:kind["cap"]]; X, Y = X[pick], Y[pick]      # over the cap: thin evenly, everywhere
    scale = rng.uniform(kind["s0"], kind["s1"], len(X))
    seed = rng.integers(0, 65536, len(X))
    qx = np.round((X - g["x0"]) / (x1 - g["x0"]) * 65535); qy = np.round((Y - g["y0"]) / (y1 - g["y0"]) * 65535)
    return np.column_stack([qx, qy, np.round(scale * 100), seed]).astype("<u2")


def main():
    c = coastlib.load()
    meta_path = os.path.join(BASE, "base.json")
    meta = json.load(open(meta_path, encoding="utf-8"))
    rng = np.random.default_rng(11)
    pts = track_points()
    trees = place(c, rng, meta["heights"], pts, TREES, 0)
    scrub = place(c, rng, meta["heights"], pts, SCRUB, 31.0)
    np.concatenate([trees, scrub]).tofile(os.path.join(BASE, "dressing.bin"))
    meta["dressing"] = dict(file="base/dressing.bin", trees=len(trees), scrub=len(scrub))
    with open(meta_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(meta, f, indent=1); f.write("\n")
    print(f"dressing.bin {os.path.getsize(os.path.join(BASE, 'dressing.bin')) / 1e3:.1f} kB: {len(trees)} trees, {len(scrub)} scrub")


if __name__ == "__main__":
    main()
