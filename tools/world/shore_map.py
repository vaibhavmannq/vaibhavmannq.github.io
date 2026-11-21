"""M8.5 #13 Task 0 (research/m85-shore-outline.md): a plan map of the cove from coast.py's own ground.

Hillshade, the 0 m line in white, 5 m contours, the five cove cameras with their frame and ±40° turns, the grove, the
cliff columns and Dusk's lantern path. Saves the grid beside the image (`<out>.npz`), so a later map can draw today's
0 m line over the new one: `python tools/world/shore_map.py <out.png> [--before <old.npz>] [--step 2]`.
"""
import argparse
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import coastlib  # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
COVE = ("golden", "sunset", "dusk", "firstlight", "sunrise")
X0, X1, Y0, Y1 = -260.0, 260.0, -120.0, 420.0
LANTERN_PATH = ((-12.0, 52.0), (-150.0, 190.0))  # src/world/lanterns.ts


def grid(w, step):
    xs = np.arange(X0, X1 + 1e-6, step)
    ys = np.arange(Y0, Y1 + 1e-6, step)
    X, Y = np.meshgrid(xs, ys)
    h = np.asarray(w.ground_base(X, Y), dtype=np.float32)
    return xs, ys, h


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--before", help="an earlier map's .npz: its 0 m line is drawn dashed")
    ap.add_argument("--step", type=float, default=2.0)
    ap.add_argument("--coast", help="another coast.py to map (e.g. an older one from git show)")
    ap.add_argument("--box", type=float, nargs=4, metavar=("X0", "X1", "Y0", "Y1"), help="zoom to this window")
    ap.add_argument("--title", default="")
    a = ap.parse_args()
    if a.coast:
        coastlib.COAST = os.path.abspath(a.coast)

    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.colors import LightSource

    w = coastlib.load("golden")
    xs, ys, h = grid(w, a.step)
    np.savez_compressed(os.path.splitext(a.out)[0] + ".npz", xs=xs, ys=ys, h=h)

    bw = a.box or (X0, X1, Y0, Y1)
    fig, ax = plt.subplots(figsize=(11, 11 * (bw[3] - bw[2]) / (bw[1] - bw[0]) + 0.4), dpi=110)
    shade = LightSource(azdeg=315, altdeg=40).hillshade(h, vert_exag=2.0, dx=a.step, dy=a.step)
    land = np.where(h > 0, 1.0, 0.0)
    rgb = np.dstack([0.25 + 0.55 * shade * land + 0.12 * (1 - land), 0.3 + 0.5 * shade * land + 0.2 * (1 - land),
                     0.25 + 0.35 * shade * land + 0.42 * (1 - land)])
    ax.imshow(np.clip(rgb, 0, 1), origin="lower", extent=(X0, X1, Y0, Y1))
    ax.contour(xs, ys, h, levels=np.arange(5, 80, 5), colors="k", linewidths=0.35, alpha=0.5)
    ax.contour(xs, ys, h, levels=[0], colors="white", linewidths=1.6)
    if a.before:
        b = np.load(a.before)
        ax.contour(b["xs"], b["ys"], b["h"], levels=[0], colors="orange", linewidths=1.2, linestyles="dashed")

    shots = json.load(open(os.path.join(ROOT, "src", "journey", "shots.json"), encoding="utf-8"))
    for sid in COVE:
        s = shots[sid]
        cx, cy = s["cam"][0], s["cam"][1]
        yaw = s["look"][0]
        ax.plot(cx, cy, "o", color="red", ms=5)
        ax.annotate(sid, (cx, cy), xytext=(4, 4), textcoords="offset points", color="red", fontsize=8)
        for off, style, alpha in ((0, "-", 0.9), (-40, ":", 0.6), (40, ":", 0.6)):
            for edge in (-37, 37):
                az = math.radians(yaw + off + edge)
                ax.plot([cx, cx + 90 * math.sin(az)], [cy, cy + 90 * math.cos(az)], style, color="red",
                        lw=0.7, alpha=alpha * (1 if off == 0 else 0.7))
    for g in w.grove_plants():
        ax.plot(g["x"], g["y"], ".", color="#0a5", ms=3)
    for sid in ("golden", "sunrise"):
        for x, y, *_ in w.SHOTS[sid].get("cliff_rocks", ()):
            ax.plot(x, y, "s", color="#333", ms=3)
    (lx0, ly0), (lx1, ly1) = LANTERN_PATH
    ax.plot([lx0, lx1], [ly0, ly1], "--", color="gold", lw=1)
    bx = a.box or (X0, X1, Y0, Y1)
    ax.set_xlim(bx[0], bx[1])
    ax.set_ylim(bx[2], bx[3])
    ax.set_aspect("equal")
    ax.set_title(a.title or "The cove in plan (coast.py ground_base): white = waterline, red = cove cameras (frame solid, ±40° dotted)",
                 fontsize=9)
    fig.tight_layout()
    fig.savefig(a.out)
    print(a.out)


if __name__ == "__main__":
    main()
