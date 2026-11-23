"""Clear-sky copies of the nine sky photos (plan Task 12a, s32): the painted clouds out, the colour and glow kept.

Run after prep_sky.py:  python tools/world/clear_sky.py [--sheet <dir>]

No model of the sky (s31's fit by elevation + glow made a disc and bands): the photo's own low frequencies.
1. A cloud mask: where the photo differs from a wide blur of itself (log luminance and colour, two scales), over a
   per-hour threshold, cleaned and grown a little.
2. The masked pixels filled by push-pull: the known pixels averaged down a pyramid, the holes filled back up from it
   (wrapping around the compass, reflecting at the poles).
3. A wide blur inside the mask only, feathered at its edge, so a filled hole carries no edge of its own.
Settings per hour in clear_sky.json (threshold, scales, how much is grown, a final lift). An hour set to "same" keeps
its photo (Night, Midnight: no painted clouds). Overcast hours end as the broad light of their photo: their clouds
come wholly from the browser's layer.

Writes public/world/sky/<hour>-clear.jpg in the photos' 8-bit encoding (prep_sky.py) and adds "clear" to sky.json.
"""
import json, os, sys
import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
SKY = os.path.join(ROOT, "public", "world", "sky")
CONF = json.load(open(os.path.join(HERE, "clear_sky.json"), encoding="utf-8"))
HOURS = ["golden", "sunset", "dusk", "bluehour", "night", "midnight", "beforedawn", "firstlight", "sunrise"]
LUM = np.array([0.2126, 0.7152, 0.0722], np.float32)
# `band`: the photo below BAND_LO degrees, the clear sky above BAND_HI
BAND_LO, BAND_HI = 9.0, 24.0


def decode(e):
    p = np.clip(e, 0, 0.995) ** 2.2
    return p / np.maximum(1 - p, 0.03)


def encode(x):
    x = np.maximum(x, 0)
    return (x / (1 + x)) ** (1 / 2.2)


def blur(img, sigma):
    """A Gaussian blur that wraps around the compass (u) and reflects at the poles."""
    pad = int(sigma * 3) + 1
    w = img.shape[1]
    pad = min(pad, w)
    ext = np.concatenate([img[:, -pad:], img, img[:, :pad]], axis=1)
    out = cv2.GaussianBlur(ext, (0, 0), sigma, borderType=cv2.BORDER_REFLECT)
    return out[:, pad:pad + w]


def blur_xy(img, su, sv):
    """A blur wider along the compass (u, wrapping) than up the sky (v)."""
    pad = min(int(su * 3) + 1, img.shape[1])
    ext = np.concatenate([img[:, -pad:], img, img[:, :pad]], axis=1)
    out = cv2.GaussianBlur(ext, (0, 0), sigmaX=su, sigmaY=sv, borderType=cv2.BORDER_REFLECT)
    return out[:, pad:pad + img.shape[1]]


def cloud_mask(x, c):
    """1 where a painted cloud is, 0 in clear sky. `x` is linear RGB (H, W, 3)."""
    lum = np.maximum((x * LUM).sum(-1), 1e-5)
    ll = np.log(lum)
    chroma = x / lum[..., None]
    score = np.zeros_like(ll)
    for s in c["scales"]:
        base = blur(ll, s)
        cb = blur(chroma, s)
        d = np.abs(ll - base) + c.get("chroma", 0.5) * np.abs(chroma - cb).sum(-1)
        score = np.maximum(score, d)
    m = (score > c["threshold"]).astype(np.uint8)
    k = np.ones((3, 3), np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, k)
    grow = int(c.get("grow", 6))
    if grow > 0:
        ext = np.concatenate([m[:, -grow:], m, m[:, :grow]], axis=1)
        ext = cv2.dilate(ext, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1, 2 * grow + 1)))
        m = ext[:, grow:grow + m.shape[1]]
    return m.astype(np.float32)


def down(a):
    """Halve, wrapping in u."""
    return cv2.resize(a, (a.shape[1] // 2, a.shape[0] // 2), interpolation=cv2.INTER_AREA)


def up(a, shape):
    return cv2.resize(a, (shape[1], shape[0]), interpolation=cv2.INTER_LINEAR)


def push_pull(x, known):
    """Fill pixels where `known` is 0 from the known ones around them, coarse to fine."""
    if min(x.shape[:2]) <= 4:
        w = known.sum()
        mean = (x * known[..., None]).sum((0, 1)) / max(w, 1e-6)
        return np.where(known[..., None] > 0, x, mean)
    xs = blur(x * known[..., None], 1.0)
    ks = blur(known, 1.0)
    xd = down(xs)
    kd = down(ks)
    avg = xd / np.maximum(kd, 1e-6)[..., None]
    coarse = push_pull(avg, (kd > 1e-3).astype(np.float32) * np.minimum(kd * 4, 1))
    filled = up(coarse, x.shape)
    k = np.clip(known, 0, 1)[..., None]
    return x * k + filled * (1 - k)


def clear(name, c):
    e = cv2.imread(os.path.join(SKY, f"{name}.jpg"), cv2.IMREAD_COLOR)[..., ::-1].astype(np.float32) / 255
    x = decode(e)
    h = x.shape[0]
    top = h // 2 + int(h * c.get("below_deg", 2) / 180)  # rows above the horizon, plus a few below it
    xs = x[:top]
    m = cloud_mask(xs, c)
    filled = push_pull(xs, 1 - m)
    # refine: a cloud's faint fringe left outside the first mask darkens or lights the fill around it; whatever still
    # differs from the filled sky joins the mask, and the fill is made again
    for _ in range(c.get("passes", 2)):
        lf = np.log(np.maximum((filled * LUM).sum(-1), 1e-5))
        lx = np.log(np.maximum((xs * LUM).sum(-1), 1e-5))
        extra = (np.abs(lx - lf) > c.get("refine", c["threshold"])).astype(np.uint8)
        extra = cv2.dilate(extra, np.ones((5, 5), np.uint8)).astype(np.float32)
        m = np.maximum(m, extra)
        filled = push_pull(xs, 1 - m)
    # a clear sky changes slowly, more slowly along the compass than up it
    soft = blur_xy(filled, c.get("smooth_u", 24), c.get("smooth_v", 8))
    feather = np.clip(blur(m, c.get("feather", 4)) * 1.5, 0, 1)[..., None]
    if c.get("whole", False):
        # the whole sky above the horizon becomes the slow copy: the decks' broad light and shade go too (s32 pass 2)
        feather = np.ones_like(feather)
    out = xs * (1 - feather) + soft * feather
    out = out * c.get("lift", 1.0)
    # back into the photo, blending the last rows so the cut below the horizon is not a line
    res = x.copy()
    res[:top] = out
    edge = 8
    wgt = np.linspace(1, 0, edge)[:, None, None]
    res[top - edge:top] = out[-edge:] * wgt + x[top - edge:top] * (1 - wgt)
    return res, m


def main():
    sheet = None
    if "--sheet" in sys.argv:
        sheet = sys.argv[sys.argv.index("--sheet") + 1]
        os.makedirs(sheet, exist_ok=True)
    meta_path = os.path.join(SKY, "sky.json")
    meta = json.load(open(meta_path, encoding="utf-8"))
    for name in HOURS:
        c = CONF[name]
        if c == "same":
            meta[name]["clear"] = meta[name]["file"]
            meta[name]["band"] = meta[name]["file"]
            continue
        res, m = clear(name, c)
        out = np.clip(encode(res) * 255 + 0.5, 0, 255).astype(np.uint8)
        path = os.path.join(SKY, f"{name}-clear.jpg")
        cv2.imwrite(path, out[..., ::-1], [cv2.IMWRITE_JPEG_QUALITY, 90])
        meta[name]["clear"] = f"sky/{name}-clear.jpg"
        # `band` (s32): the photo's own clouds kept low (20-50 km out they barely move in a ride, and they hold each
        # hour's drama), the clear sky above, where the browser's moving clouds carry the depth
        x = decode(cv2.imread(os.path.join(SKY, f"{name}.jpg"))[..., ::-1].astype(np.float32) / 255)
        h = x.shape[0]
        el = (0.5 - (np.arange(h) + 0.5) / h) * 180
        t = np.clip((el - BAND_LO) / (BAND_HI - BAND_LO), 0, 1)
        w = (t * t * (3 - 2 * t))[:, None, None]
        band = x * (1 - w) + res * w
        out_b = np.clip(encode(band) * 255 + 0.5, 0, 255).astype(np.uint8)
        cv2.imwrite(os.path.join(SKY, f"{name}-band.jpg"), out_b[..., ::-1], [cv2.IMWRITE_JPEG_QUALITY, 90])
        meta[name]["band"] = f"sky/{name}-band.jpg"
        if sheet:
            src = cv2.imread(os.path.join(SKY, f"{name}.jpg"))
            hh = src.shape[0] // 2 + 20
            mk = np.zeros_like(src)
            mk[: m.shape[0]] = (m[..., None] * 255).astype(np.uint8)
            cv2.imwrite(os.path.join(sheet, f"{name}.jpg"), np.concatenate([src[:hh], out[:hh, :, ::-1], mk[:hh]], 0),
                        [cv2.IMWRITE_JPEG_QUALITY, 85])
        print(name, f"cloud share above horizon {m[: m.shape[0] * 512 // 532].mean():.2f}")
    with open(meta_path, "w", encoding="utf-8", newline=chr(10)) as f:
        json.dump(meta, f, indent=1)
        f.write(chr(10))


if __name__ == "__main__":
    main()
