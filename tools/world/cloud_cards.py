"""Cloud cards (plan Task 12c, option `cards`, s32): real cumulus cut from daylight sky photos, as an atlas the browser
places in the world and relights in each hour's colours.

Run: python tools/world/cloud_cards.py [--sheet <dir>]
Sources: Poly Haven (CC0) 4K skies with white cloud on blue sky (kloppenheim_06, citrus_orchard_road), in
.superpowers/brainstorm/lookdev/assets/hdri (WORLD_SRC as prep_sky.py).
1. The blue sky behind the clouds, by push-pull from the bluest pixels (clear_sky.py's fill).
2. Per pixel a cloud's share `a` from how much of the sky's blueness is lost (white cloud on blue: a = 1 − b / b_sky),
   and the cloud's own brightness from un-mixing it from the sky behind.
3. Clouds = connected patches 4°–40° up of a useful size; each cut out, unwarped (equirect width × cos(elevation)),
   fitted into a 256² cell of a 2048 × 1024 atlas (8 × 4 cells).
Writes public/world/sky/cards.png (R share, G brightness 0..1 within the cloud, B 0, A 255) and cards.json (per cell:
width/height, which side the sun lit: +1 right, −1 left).
"""
import json, os, sys
import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
from clear_sky import push_pull, blur  # noqa: E402

SRC = os.environ.get("WORLD_SRC", os.path.join(ROOT, ".superpowers", "brainstorm", "lookdev", "assets"))
OUT = os.path.join(ROOT, "public", "world", "sky")
SOURCES = ["kloppenheim_06_puresky_4k.hdr", "citrus_orchard_road_puresky_4k.hdr"]
CELL = 256
COLS, ROWS = 8, 4
LUM = np.array([0.2126, 0.7152, 0.0722], np.float32)


def load(name):
    img = cv2.imread(os.path.join(SRC, "hdri", name), cv2.IMREAD_UNCHANGED)
    if img is None:
        raise FileNotFoundError(name)
    return img[..., ::-1].astype(np.float32)


def matte(x):
    """Cloud share a (0..1) and the cloud's own luminance, for white cloud over blue sky."""
    s = x.sum(-1) + 1e-6
    blue = (x[..., 2] - x[..., 0]) / s
    sky_mask = (blue > np.percentile(blue, 70)).astype(np.float32)
    sky = push_pull(x, sky_mask)
    sky = blur(sky, 6)
    bs = (sky[..., 2] - sky[..., 0]) / (sky.sum(-1) + 1e-6)
    a = np.clip(1 - blue / np.maximum(bs, 1e-3), 0, 1)
    a = np.clip((a - 0.12) / 0.6, 0, 1)
    lx = (x * LUM).sum(-1)
    ls = (sky * LUM).sum(-1)
    lc = (lx - (1 - a) * ls) / np.maximum(a, 0.05)
    return a, np.maximum(lc, 0)


def sun_x(x):
    lum = blur((x * LUM).sum(-1), 4)
    return np.unravel_index(np.argmax(lum), lum.shape)[1]


def cards_from(name):
    x = load(name)
    h, w = x.shape[:2]
    a, lc = matte(x)
    sx = sun_x(x)
    el = (0.5 - (np.arange(h) + 0.5) / h) * 180
    band = ((el > 4) & (el < 40))[:, None]
    m = ((a > 0.2) & band).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    out = []
    for i in range(1, n):
        x0, y0, bw, bh, area = stats[i]
        if area < 350 or area > 60000 or bw > w // 6 or bw < 22 or bh < 12:
            continue
        # a cloud cut by the band's edge would keep a straight side
        if el[y0] > 39 or el[min(h - 1, y0 + bh)] < 4.5:
            continue
        if x0 <= 1 or x0 + bw >= w - 1:
            continue
        pad = 6
        xs, ys = max(0, x0 - pad), max(0, y0 - pad)
        xe, ye = min(w, x0 + bw + pad), min(h, y0 + bh + pad)
        elc = el[(ys + ye) // 2]
        own = (lab[ys:ye, xs:xe] == i).astype(np.float32)
        own = cv2.dilate(own, np.ones((7, 7), np.uint8))
        own = cv2.GaussianBlur(own, (0, 0), 2)
        ca = a[ys:ye, xs:xe] * own
        cl = lc[ys:ye, xs:xe]
        # brightness within the cloud: 0 its darkest part, 1 its brightest (robust percentiles where it is solid)
        solid = ca > 0.5
        if solid.sum() < 50:
            continue
        lo, hi = np.percentile(cl[solid], [3, 99])
        cg = np.clip((cl - lo) / max(hi - lo, 1e-4), 0, 1)
        # outside the cloud the brightness is the cloud's own nearby value, so mipmaps never bleed a dark halo
        cg = push_pull(np.repeat(cg[..., None], 3, -1), (ca > 0.3).astype(np.float32))[..., 0]
        # unwarp: an equirect row is stretched by 1 / cos(elevation)
        nw = max(8, int(round((xe - xs) * np.cos(np.radians(elc)))))
        ca = cv2.resize(ca, (nw, ye - ys), interpolation=cv2.INTER_AREA)
        cg = cv2.resize(cg, (nw, ye - ys), interpolation=cv2.INTER_AREA)
        dx = ((sx - (xs + xe) / 2 + w / 2) % w) - w / 2
        score = float(ca.mean()) * area
        out.append({"a": ca, "g": cg, "lit": 1 if dx > 0 else -1, "score": score, "src": name, "el": float(elc)})
    return out


def main():
    sheet = sys.argv[sys.argv.index("--sheet") + 1] if "--sheet" in sys.argv else None
    found = []
    for s in SOURCES:
        c = cards_from(s)
        print(s, len(c), "clouds")
        found += c
    found.sort(key=lambda c: -c["score"])
    pick = found[: COLS * ROWS]
    atlas = np.zeros((ROWS * CELL, COLS * CELL, 4), np.uint8)
    atlas[..., 3] = 255
    meta = []
    for k, c in enumerate(pick):
        hh, ww = c["a"].shape
        s = (CELL - 4) / max(hh, ww)
        nw, nh = max(1, int(ww * s)), max(1, int(hh * s))
        ra = cv2.resize(c["a"], (nw, nh), interpolation=cv2.INTER_CUBIC)
        rg = cv2.resize(c["g"], (nw, nh), interpolation=cv2.INTER_CUBIC)
        cx, cy = (k % COLS) * CELL, (k // COLS) * CELL
        # anchored to the cell's bottom centre: a cloud's flat base sits at its height
        ox, oy = cx + (CELL - nw) // 2, cy + CELL - 2 - nh
        atlas[oy:oy + nh, ox:ox + nw, 0] = np.clip(ra * 255 + 0.5, 0, 255).astype(np.uint8)
        atlas[oy:oy + nh, ox:ox + nw, 1] = np.clip(rg * 255 + 0.5, 0, 255).astype(np.uint8)
        meta.append({"cell": k, "w": round(nw / CELL, 4), "h": round(nh / CELL, 4), "lit": c["lit"]})
    cv2.imwrite(os.path.join(OUT, "cards.png"), cv2.cvtColor(atlas, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_PNG_COMPRESSION, 9])
    with open(os.path.join(OUT, "cards.json"), "w", encoding="utf-8", newline=chr(10)) as f:
        json.dump({"cols": COLS, "rows": ROWS, "cards": meta}, f, indent=1)
        f.write(chr(10))
    print("cards", len(meta), os.path.getsize(os.path.join(OUT, "cards.png")) // 1024, "kB")
    if sheet:
        os.makedirs(sheet, exist_ok=True)
        vis = np.concatenate([atlas[..., 0], atlas[..., 1]], 0)
        cv2.imwrite(os.path.join(sheet, "cards.jpg"), vis)


if __name__ == "__main__":
    main()
