"""Nine sky photos for the live site (run: python tools/world/prep_sky.py, after export_hours.py).

Each hour's Poly Haven sky is turned and tilted exactly as coast.py's build_sky() does (photo-sun table, tilt along
the sun's bearing, spin about the vertical, sky_rot), recoloured with the hybrid ramp (sky_clip, sky_grad), and
written as a 2048 x 1024 equirect JPEG in three.js's convention with an 8-bit HDR encoding:
stored e = (x / (1 + x)) ** (1 / 2.2); the shader decodes x = e^2.2 / (1 - e^2.2).
The per-hour gain (hdri_gain) is NOT baked in: the browser applies it, so two skies can blend.
sky.json gives each sky's ambient light (upper hemisphere mean, horizon band x 0.3), gain included.
"""
import json, math, os
import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
SRC = os.environ.get("WORLD_SRC", os.path.join(ROOT, ".superpowers", "brainstorm", "lookdev", "assets"))
OUT = os.path.join(ROOT, "public", "world", "sky")
SHOTS = json.load(open(os.path.join(ROOT, "src", "journey", "shots.json"), encoding="utf-8"))
W, H = 2048, 1024
LUM = np.array([0.2126, 0.7152, 0.0722], np.float32)   # Blender's RGB to BW weights (Rec. 709)
HYBRID_RAMP = ((0.0, (0.13, 0.09, 0.24)), (0.26, (0.46, 0.29, 0.50)), (0.40, (0.95, 0.55, 0.48)),
               (0.53, (1.0, 0.66, 0.38)), (0.68, (1.0, 0.80, 0.50)), (1.0, (1.0, 0.95, 0.82)))


def rodrigues(axis, ang):
    x, y, z = axis; c, s, C = math.cos(ang), math.sin(ang), 1 - math.cos(ang)
    return np.array([[c + x*x*C, x*y*C - z*s, x*z*C + y*s], [y*x*C + z*s, c + y*y*C, y*z*C - x*s],
                     [z*x*C - y*s, z*y*C + x*s, c + z*z*C]])


def sun_dir(el, az):
    e, a = math.radians(el), math.radians(az)
    return np.array([math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e)])


def photo(name):
    p = os.path.join(SRC, "hdri", name)
    p4 = p.replace("_8k.", "_4k.")
    path = p4 if os.path.exists(p4) else p
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise FileNotFoundError(path)
    return img[..., ::-1].astype(np.float32), os.path.basename(path)


def orientation(S):
    """Matrix taking a world (coast) direction to the photo's own direction, as build_sky() does."""
    _, phi_h = S["hsun"]
    dh = sun_dir(0, S["sun_az"])
    axis = np.cross(dh, [0, 0, 1.0]); axis /= np.linalg.norm(axis)
    Rt = rodrigues(axis, math.radians(S["tilt"]))
    if (Rt @ dh)[2] < 0:
        Rt = rodrigues(axis, -math.radians(S["tilt"]))
    rotz = -phi_h - (90.0 - S["sun_az"]) + S.get("sky_rot", 0.0)
    return rodrigues(np.array([0, 0, 1.0]), math.radians(rotz)) @ Rt


def make(hour):
    S = SHOTS[hour]
    img, used = photo(S["hdri"])
    sh, sw, _ = img.shape
    j, i = np.mgrid[0:H, 0:W].astype(np.float32)
    u = (i + 0.5) / W; v = 1.0 - (j + 0.5) / H                         # three.js equirectUV, v = 1 at the top row
    th = (u - 0.5) * 2 * np.pi; e = (v - 0.5) * np.pi
    d = np.stack([np.cos(e) * np.cos(th), -np.cos(e) * np.sin(th), np.sin(e)], -1)   # three (x, y, z) -> coast (x, -z, y)
    s = d.reshape(-1, 3) @ orientation(S).T
    s = s.reshape(H, W, 3)
    su = 0.5 - np.arctan2(s[..., 1], s[..., 0]) / (2 * np.pi)      # Blender equirect
    sv = 0.5 - np.arcsin(np.clip(s[..., 2], -1, 1)) / np.pi        # row fraction from the top
    pad = 8
    src = np.concatenate([img[:, -pad:], img, img[:, :pad]], 1)
    out = cv2.remap(src, (su * sw - 0.5 + pad).astype(np.float32), (sv * sh - 0.5).astype(np.float32),
                    cv2.INTER_AREA if sw <= W else cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    bw = out @ LUM
    fac = bw / (bw + 1.6)
    stops = S.get("ramp") or HYBRID_RAMP
    pos = np.array([p for p, _ in stops]); cols = np.array([c for _, c in stops])
    ramp = np.stack([np.interp(fac, pos, cols[:, k]) for k in range(3)], -1)
    g = np.minimum(bw, S["sky_clip"]) if S.get("sky_clip") else bw
    sky = ramp * (g * 0.55 + 0.25)[..., None]
    if S.get("sky_grad"):
        lo, hi, z0, z1 = S["sky_grad"]
        t = np.clip((d[..., 2] - z0) / (z1 - z0), 0, 1)[..., None]
        sky = sky * (np.array(lo) * (1 - t) + np.array(hi) * t)
    enc = np.power(sky / (1 + sky), 1 / 2.2)
    path = os.path.join(OUT, hour + ".jpg")
    cv2.imwrite(path, (np.clip(enc, 0, 1)[..., ::-1] * 255 + 0.5).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 85])
    gain = S["hdri_gain"]
    wgt = np.cos(e)[..., None]
    up = (sky * wgt)[e > 0].sum(0) / wgt[e > 0].sum()
    band = (e > 0) & (e < math.radians(10))
    horizon = (sky * wgt)[band].sum(0) / wgt[band].sum()
    size = os.path.getsize(path)
    assert size <= 0.2e6, (hour, size)
    print(f"{hour:11s} {used:40s} {size / 1e3:6.1f} kB  mean {sky.mean():.3f}")
    return dict(file=f"sky/{hour}.jpg", ambientSky=(up * gain).round(4).tolist(), ambientGround=(horizon * 0.3 * gain).round(4).tolist())


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    meta = {h: make(h) for h in SHOTS}
    with open(os.path.join(OUT, "sky.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(meta, f, indent=1); f.write("\n")
