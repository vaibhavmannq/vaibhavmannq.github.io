"""Run: python tools/world/test_shore.py  (M8.5 #13: the cove's shore in plan; research/m85-shore-outline.md).

The cove was four axis-aligned boxes (two straight cliff faces and a rectangular slab standing in the water). These
checks hold the new outline to what a real rocky shore does, and hold everything the approved views depend on still.
"""
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import coastlib  # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
w = coastlib.load("golden")
G = w.ground_base
fails = []


def check(ok, msg):
    if not ok:
        fails.append(msg)
        print("FAIL", msg)


def zero_runs(box, sub, step=2.0):
    """The 0 m line inside `sub` (x0, x1, y0, y1), from a contour of the ground over `box`: runs of vertices."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    x0, x1, y0, y1 = box
    xs = np.arange(x0, x1 + 1e-6, step); ys = np.arange(y0, y1 + 1e-6, step)
    X, Y = np.meshgrid(xs, ys)
    cs = plt.contour(xs, ys, G(X, Y), levels=[0.0])
    plt.close("all")
    runs = []
    for seg in cs.allsegs[0]:
        inside = (seg[:, 0] >= sub[0]) & (seg[:, 0] <= sub[1]) & (seg[:, 1] >= sub[2]) & (seg[:, 1] <= sub[3])
        cur = []
        for p, k in zip(seg, inside):
            if k:
                cur.append(p)
            elif cur:
                runs.append(np.array(cur)); cur = []
        if cur:
            runs.append(np.array(cur))
    return runs


def resample(p, ds):
    s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))])
    t = np.arange(0, s[-1], ds)
    return np.stack([np.interp(t, s, p[:, 0]), np.interp(t, s, p[:, 1])], axis=1)


def turn_and_radius(run, ds=4.0, window=40.0, span=3):
    """The smallest heading range over any `window` of the line (deg) and the tightest circumradius of points
    `span` samples apart (m)."""
    p = resample(run, ds)
    if len(p) < span * 2 + 2:
        return 999.0, (999.0, (0.0, 0.0))
    hd = np.unwrap(np.arctan2(*np.diff(p, axis=0).T[::-1]))
    k = int(window / ds)
    turns = [np.degrees(np.ptp(hd[i:i + k])) for i in range(0, max(1, len(hd) - k + 1))]
    radii = [(1e9, (0.0, 0.0))]
    for i in range(span, len(p) - span):
        a, b, c = p[i - span], p[i], p[i + span]
        ab, bc, ca = np.linalg.norm(b - a), np.linalg.norm(c - b), np.linalg.norm(a - c)
        area = abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2
        radii.append((ab * bc * ca / (4 * area) if area > 1e-9 else 1e9, tuple(np.round(b, 1))))
    return min(turns), min(radii)


# 1. No straight runs and no plan corners on the three shores the cameras see.
SHORES = {
    "terrace": ((-120, 60, 90, 210), (-90, 12, 105, 175)),
    "right face north of y 60": ((-20, 80, 40, 140), (8, 60, 62, 112)),
    "left face": ((-180, -60, -40, 130), (-150, -85, -20, 110)),
}
for name, (box, sub) in SHORES.items():
    runs = [r for r in zero_runs(box, sub) if len(r) > 1 and np.sum(np.hypot(*np.diff(r, axis=0).T)) >= 40.0]
    check(runs, f"{name}: no 0 m line found")
    for r in runs:
        turn, (rad, at) = turn_and_radius(r)
        print(f"{name}: run {np.sum(np.hypot(*np.diff(r, axis=0).T)):.0f} m, least turn per 40 m {turn:.1f} deg, tightest radius {rad:.1f} m at {at}")
        check(turn >= 10.0, f"{name}: a straight run (turns only {turn:.1f} deg over 40 m)")
        check(rad >= 14.0, f"{name}: a corner of radius {rad:.1f} m (< 14 m) at {at}")

# 2. Every camera and walk spot of the cove stands where it stood (protected circles).
REF = {(9.5, -4.0): 0.2951, (8.9, -1.2): 0.1505, (8.0, 1.8): -0.0028, (7.1, 4.6): -0.1259, (9.45, -3.16): 0.2525,
       (8.61, -2.32): 0.2061, (86, 96): 18.6749, (86.8, 95.3): 19.2699, (87.6, 94.6): 19.2647, (85, 98): 18.1338,
       (32, 30): 26.8906, (30.6, 33.8): 26.315, (29.26, 37.52): 26.5556, (-60, -14): 0.2586, (-55, -6.8): -0.0435,
       (-49.3, 1.3): -0.3425, (30, -40): 33.7891, (29.6, -34): 32.3822, (28.9, -24): 31.1062}
for (x, y), z in REF.items():
    g = float(G(x, y))
    check(abs(g - z) < 0.05, f"ground at ({x}, {y}) moved: {z} -> {g:.4f}")
for x, y in w.PROTECT:
    for a in np.linspace(0, 2 * np.pi, 12, endpoint=False):
        px, py = x + 19.0 * math.cos(a), y + 19.0 * math.sin(a)
        check(abs(w.protect_at(px, py) - 1.0) < 1e-9, f"protect_at({px:.1f}, {py:.1f}) < 1 inside 20 m")

# 3. The grove on the terrace, the lone tree, the left grove.
for p in w.grove_plants():
    if p["group"] in ("tree", "grove", "rim") and p["x"] < 12.0:          # on the terrace (east of it: the headland)
        g = float(G(p["x"], p["y"]))
        check(g >= 10.0, f"grove plant at ({p['x']:.1f}, {p['y']:.1f}) on ground {g:.1f} m (< 10)")
        if p["x"] < 12.0:
            sd = float(w.terrace_sd(p["x"], p["y"]))
            check(sd >= 3.0, f"grove plant at ({p['x']:.1f}, {p['y']:.1f}) only {sd:.1f} m inside the terrace's edge")
check(tuple(w.LONE_TREE) == (62.8, 145.8), "the lone tree moved")
check(abs(float(G(62.8, 145.8)) - 14.27) < 0.3, f"the lone tree's ground changed: {float(G(62.8, 145.8)):.2f}")
for x, y, *_ in w.LGROVE_SPOTS:
    g = float(G(x, y))
    check(g >= 4.0, f"left grove spot ({x}, {y}) on ground {g:.1f} m (< 4)")

# 4. Dusk's 44 lanterns drift on water: their band (src/world/lanterns.ts: 3 m + 16 m·t either side, doubled for the
# gaussian's tail) is open sea.
(lx0, ly0), (lx1, ly1) = (-12.0, 52.0), (-150.0, 190.0)
L = math.hypot(lx1 - lx0, ly1 - ly0); ux, uy = (lx1 - lx0) / L, (ly1 - ly0) / L
for t in np.linspace(0, 1, 70):
    for side in np.linspace(-1, 1, 9):
        off = side * 2 * (3 + 16 * t)
        x, y = lx0 + (lx1 - lx0) * t - uy * off, ly0 + (ly1 - ly0) * t + ux * off
        g = float(G(x, y))
        check(g < -0.5, f"a lantern's water at ({x:.0f}, {y:.0f}) is {g:.1f} m (needs < -0.5)")

# 5. Golden's and Sunset's lines to the arch still clear the land (beyond their protected 40 m).
shots = json.load(open(os.path.join(ROOT, "src", "journey", "shots.json"), encoding="utf-8"))
ax, ay = w.ARCH["pos"]
for sid in ("golden", "sunset"):
    c = shots[sid]["cam"]; ez = shots[sid]["eyeZ"]
    for tz in (10.0, 22.0, 44.0):
        t = np.linspace(0, 1, 40000); x = c[0] + (ax - c[0]) * t; y = c[1] + (ay - c[1]) * t; z = ez + (tz - ez) * t
        far = np.hypot(x - c[0], y - c[1]) > 40.0
        far &= np.hypot(x - ax, y - ay) > 700.0                        # the arch's flats are its own (its foot is in them)
        cl = float(np.min((z - G(x, y))[far]))
        check(cl >= 1.0, f"{sid}'s line to the arch (z {tz}) clears the land by only {cl:.2f} m")

# 5b. No grove crown stands on Sunset's line to the arch (s26: two trees moved up the slope hid it).
c = shots["sunset"]["cam"]; ez = shots["sunset"]["eyeZ"]
for p in w.grove_plants():
    t = ((p["x"] - c[0]) * (ax - c[0]) + (p["y"] - c[1]) * (ay - c[1])) / ((ax - c[0]) ** 2 + (ay - c[1]) ** 2)
    if not 0.0 < t < 0.2:
        continue
    lx, ly = c[0] + (ax - c[0]) * t, c[1] + (ay - c[1]) * t
    off = math.hypot(p["x"] - lx, p["y"] - ly); line_z = ez + (22.0 - ez) * t
    crown = p["z"] + 6.0 * max(p["scale"])                             # a crown's top, generously
    check(off > 6.0 or crown < line_z - 1.0, f"a grove plant at ({p['x']:.1f}, {p['y']:.1f}) stands on Sunset's line to the arch")

# 6. The terrace's faces stay cliffs: between 1 m and 12 m height the ground rises at a mean slope of 1.5 or more.
def rise_run(x0, y0, dx, dy):
    s = np.arange(0, 40, 0.1); h = G(x0 + dx * s, y0 + dy * s)
    lo = s[np.argmax(h < 1.0)] if np.any(h < 1.0) else None
    hi = s[np.argmax(h < 12.0)] if np.any(h < 12.0) else None
    return None if lo is None or hi is None else lo - hi
for x0 in np.arange(-36.0, 0.0, 6.0):
    run = rise_run(x0, w.TERRACE["axis"][0][1], 0.0, -1.0)
    check(run is not None and 11.0 / max(run, 1e-6) >= 1.5, f"the terrace's south face at x {x0:.0f}: 1-12 m over {run} m")
ax0, ay0 = w.TERRACE["axis"][0]
for a in (-50.0, 0.0, 50.0):
    run = rise_run(ax0 + 4.0, ay0, -math.cos(math.radians(a)), math.sin(math.radians(a)))
    check(run is not None and 11.0 / max(run, 1e-6) >= 1.5, f"the terrace's tip at {a} deg: 1-12 m over {run} m")

# 7. The cliff columns stand along their faces, not in a ruler row, and never in front of a lens (Task 3).
cams = [(v["cam"][0], v["cam"][1]) for k, v in shots.items() if k in ("golden", "sunset", "dusk", "firstlight", "sunrise")]
def to_shore(x, y, r=7.0, step=0.5):
    """Distance from (x, y) to the nearest 0 m line point within r (inf if none)."""
    xs = np.arange(x - r, x + r + 1e-6, step); ys = np.arange(y - r, y + r + 1e-6, step)
    X, Y = np.meshgrid(xs, ys); land = G(X, Y) > 0
    edge = (land[1:, 1:] != land[:-1, 1:]) | (land[1:, 1:] != land[1:, :-1])
    if not edge.any():
        return float("inf")
    return float(np.min(np.hypot(X[1:, 1:][edge] - x, Y[1:, 1:][edge] - y)))
for hour in ("golden", "sunrise"):
    rocks = w.SHOTS[hour]["cliff_rocks"]
    for x, y, r, h, lean in rocks:
        d = to_shore(x, y)
        check(d <= 5.5, f"{hour}'s column at ({x}, {y}) is {d:.1f} m from the shore (not on a face)")
        check(min(math.hypot(x - cx, y - cy) for cx, cy in cams) >= 9.9, f"{hour}'s column at ({x}, {y}) stands in front of a lens")
    face = [q for q in rocks if q[3] >= 6.0 and abs(q[1]) < 100 and q[0] > -200]
    xs = np.array([q[0] for q in face if (q[0] > 0) == (hour == "golden")])
    check(np.ptp(xs) >= 6.0, f"{hour}'s columns stand in a row (x spread {np.ptp(xs):.1f} m)")
check(len(w.TERRACE_ROCKS) >= 15, "the terrace's faces have their columns")

print("ok" if not fails else f"{len(fails)} failed")
sys.exit(1 if fails else 0)
