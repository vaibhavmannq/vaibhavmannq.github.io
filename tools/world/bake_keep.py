"""Bake the keep mask (run: python tools/world/bake_keep.py). Writes tools/world/blender/keep.npz.

Protected: every point the nine cameras see on the M0 ground within NEAR metres (any aspect the site shows), dilated by
max(24 m, 2 % of the distance), and the strip along the sun or moon ray from each of them until the ray is 700 m up
(ground there could cast a shadow into the view). Ground under Midnight's sea of cloud is hidden, so not protected. keep = 1 there, falling to 0 over 400 m outside (spec §6). The far
background beyond NEAR may change, with the owner's approval (spec §6's exception; s05 ruling).

python tools/world/bake_keep.py [--near METRES] [--reuse]   (--reuse: rasterise cached hits, no new ray casting)
"""
import os, sys
import cv2
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import coastlib, views

OUT = os.path.join(HERE, "blender", "keep.npz")
CACHE = os.path.normpath(os.path.join(HERE, "..", "..", ".superpowers", "m1", "keep_hits.npz"))
NEAR = views.NEAR
X0 = Y0 = -7400.0; STEP = 16.0; N = int((6600 - X0) / STEP) + 1
FALLOFF = 400.0
TOP = 450.0   # no ground reaches 400 m (test_reshape), so a light ray above 450 m can no longer be blocked


def px(x, y):
    return int(round((x - X0) / STEP)), int(round((y - Y0) / STEP))


def hits():
    """Every camera's ray hits on the M0 ground: rows of (x, y, z, t, camera index)."""
    if "--reuse" in sys.argv and os.path.exists(CACHE):
        return np.load(CACHE)["hits"]
    c = coastlib.load()
    rows = []
    clouds = views.cloud_planes()
    for ci, (name, cam) in enumerate(views.cameras().items()):
        for w in (192, 96, 64):                       # the bake's grid and the checks' grids
            o, d = views.ray_grid(cam, w)
            t, k = views.cast(c.ground_base, o, d, cloud=clouds.get(name))
            hit = (k == views.SEA) | (k == views.LAND)   # ground under the cloud sea is hidden in the render
            p = o[hit] + d[hit] * t[hit, None]
            rows.append(np.column_stack([p, t[hit], np.full(hit.sum(), ci)]))
        print(f"{name:11s} cast", flush=True)
    out = np.concatenate(rows)
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    np.savez_compressed(CACHE, hits=out)
    return out


def main():
    near = float(sys.argv[sys.argv.index("--near") + 1]) if "--near" in sys.argv else NEAR
    H = hits()
    names = list(views.cameras())
    lights = views.light_dirs()
    mask = np.zeros((N, N), np.uint8)
    for x, y, z, t, ci in H[H[:, 3] <= near]:
        L = lights[names[int(ci)]]
        rp = int(np.ceil(max(24.0, 0.02 * t) / STEP)) + 1
        cv2.circle(mask, px(x, y), rp, 255, -1)
        if L is not None and L[2] > 0:
            s = max(0.0, (TOP - z) / L[2])
            cv2.line(mask, px(x, y), px(x + L[0] * s, y + L[1] * s), 255, 2 * rp + 1)
    print(f"near {near:.0f} m: marked share {(mask > 0).mean():.3f}", flush=True)
    dist = cv2.distanceTransform(np.where(mask > 0, 0, 255).astype(np.uint8), cv2.DIST_L2, 5) * STEP
    t = np.clip(1.0 - dist / FALLOFF, 0.0, 1.0)
    keep = np.round(t * t * (3 - 2 * t) * 255).astype(np.uint8)
    keep[mask > 0] = 255
    np.savez_compressed(OUT, keep=keep, x0=X0, y0=Y0, step=STEP)
    print(f"keep.npz {os.path.getsize(OUT) / 1e3:.1f} kB, protected share {(keep > 0).mean():.2f}, full {(keep == 255).mean():.2f}")


if __name__ == "__main__":
    main()
