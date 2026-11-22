"""Bake the key light's soft shadows and the sky's occlusion (plan world-to-100 Task 11, C5; run: python tools/world/bake_light.py).

One shadow map per hour whose key light can cast one (the sun or the moon up: views.light_dirs()), over the whole base
(4 m) and finer around that hour's place (1 m, 1024 m square). Rides blend the two nearest hours' maps in the browser
(src/world/baked.ts), so the shadows hold while the light turns (ruling s29).

What a texel stores is not "shadow or not" but the height above which a point there sees the light: the highest the
ground and the big rocks rise above the ray toward the light, h_s(x, y) = max over s of occ(xy + s * dir) - s * tan(el).
Grass, rocks and trees at any height read the same map (lit where z > h_s), and the penumbra is a band of heights:
w = s* * tan(disc / 2), s* the distance to what casts the shadow, so a far rim throws a soft edge and a near one a crisp
one (the plan's 1.5 degree disc; the real sun is 0.53 degrees, kept softer on purpose).

Occluders: the live ground (the 8 m grid as the browser triangulates it, D32: not coast.py's formula, which stands 2-5 m
higher along the rims and would shadow sunlit slopes), the horizon ring beyond it, and the headland's arch and stacks
and the cove's cliff columns, as height fields (max height per 2 m cell; the arch's opening is filled: a known limit).

Writes public/world/light/:
  key-coarse.webp  RGB (lossless WebP), the hours stacked top to bottom (800 x 1000 each): R, G = (h_s - LO) / 0.1 as 16 bits,
                   B = the penumbra's half-width in 0.1 m
  key-fine.webp    the same, 1024 x 1024 per hour, each over its own window
  ao-coarse.webp   grey: the sky's share each 4 m texel sees (horizon occlusion, 8 directions, out to 64 m)
  ao-fine.webp     grey, per hour's window, stacked
  light.json       the grids, the windows and each hour's key direction
"""
import json, math, os, sys
from multiprocessing import Pool
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import views

ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
BASE = os.path.join(ROOT, "public", "world", "base")
OUT = os.path.join(ROOT, "public", "world", "light")

LO, HI = -30.0, 470.0
# h_s in steps of 0.1 m (the penumbra is never under 0.3 m): finer steps only fed noise to the files' low bytes
H_STEP = 0.1
DISC_DEG = 1.5
W_MIN = 0.3
OCC_STEP = 2.0
COARSE_STEP = 4.0
FINE_STEP = 1.0
FINE_N = 1024
# the fine window's middle lies this far ahead of the eye: the near land a place shows, plus its look-around
FINE_AHEAD = 300.0
# the march starts this far from the receiver, so a sunlit slope never shadows itself
S0 = 3.0
AO_DIRS = 8
AO_REACH = 64.0


# ---------------------------------------------------------------------------------------------------- the occluders
def load_base():
    meta = json.load(open(os.path.join(BASE, "base.json"), encoding="utf-8"))
    m = meta["heights"]
    q = np.fromfile(os.path.join(BASE, "heights.bin"), dtype="<u2").reshape(m["ny"], m["nx"])
    H = m["lo"] + q.astype(np.float64) * (m["hi"] - m["lo"]) / 65535
    r = meta["ring"]
    rq = np.fromfile(os.path.join(BASE, "ring.bin"), dtype="<u2").reshape(r["nr"], r["na"])
    R = r["lo"] + rq.astype(np.float64) * (r["hi"] - r["lo"]) / 65535
    return meta, H, R


def grid_height(H, m, X, Y):
    """The live ground at (X, Y): the 8 m grid split into triangles a-b-c, b-d-c as terrain.ts builds it."""
    fx = (X - m["x0"]) / m["step"]
    fy = (Y - m["y0"]) / m["step"]
    i = np.clip(np.floor(fx).astype(int), 0, m["nx"] - 2)
    j = np.clip(np.floor(fy).astype(int), 0, m["ny"] - 2)
    u = np.clip(fx - i, 0, 1)
    v = np.clip(fy - j, 0, 1)
    a = H[j, i]; b = H[j, i + 1]; c = H[j + 1, i]; d = H[j + 1, i + 1]
    lower = a + (b - a) * u + (c - a) * v
    upper = d + (c - d) * (1 - u) + (b - d) * (1 - v)
    return np.where(u + v <= 1, lower, upper)


def ring_height(R, r, X, Y):
    """The horizon ring (terrain.ts ringGeometry): radius geometric from r0 to r1, angle from north."""
    dx = X - r["cx"]; dy = Y - r["cy"]
    rad = np.maximum(np.hypot(dx, dy), r["r0"])
    fr = np.clip(np.log(rad / r["r0"]) / np.log(r["r1"] / r["r0"]) * (r["nr"] - 1), 0, r["nr"] - 1.001)
    ang = np.mod(np.arctan2(dx, dy), 2 * np.pi) / (2 * np.pi) * r["na"]
    ri = np.floor(fr).astype(int); ai = np.floor(ang).astype(int) % r["na"]; a1 = (ai + 1) % r["na"]
    u = fr - ri; v = ang - np.floor(ang)
    h0 = R[ri, ai] * (1 - v) + R[ri, a1] * v
    h1 = R[ri + 1, ai] * (1 - v) + R[ri + 1, a1] * v
    return h0 * (1 - u) + h1 * u


def read_rock(meta_part):
    """arch.bin / stacks.bin / cliffs.bin (src/world/arch.ts decodeArch): triangles in coast axes, metres."""
    buf = open(os.path.join(ROOT, "public", "world", meta_part["file"]), "rb").read()
    n = meta_part["verts"]
    p = np.frombuffer(buf, "<i2", n * 3).reshape(-1, 3).astype(np.float64) / meta_part["scale"]
    p[:, 0] += meta_part["x"]; p[:, 1] += meta_part["y"]
    at = n * 6 + n * 4 + n + n
    at += (4 - at % 4) % 4
    idx = np.frombuffer(buf, "<u2" if meta_part["indexBytes"] == 2 else "<u4", meta_part["tris"] * 3, at).reshape(-1, 3)
    return p[idx]


def rasterize_max(occ, g, tris, spacing=0.7):
    """Each triangle's highest point per cell of grid g (x0, y0, step, nx, ny), raised into occ."""
    e = np.maximum.reduce([np.linalg.norm(tris[:, k] - tris[:, (k + 1) % 3], axis=1) for k in range(3)])
    n_side = np.clip(np.ceil(e / spacing).astype(int), 1, 80)
    for n in np.unique(n_side):
        t = tris[n_side == n]
        ii, jj = np.meshgrid(np.arange(n + 1), np.arange(n + 1))
        keep = ii + jj <= n
        a = (ii[keep] / n)[None, :, None]; b = (jj[keep] / n)[None, :, None]
        pts = t[:, None, 0] * (1 - a - b) + t[:, None, 1] * a + t[:, None, 2] * b
        pts = pts.reshape(-1, 3)
        ci = np.round((pts[:, 0] - g["x0"]) / g["step"]).astype(int)
        cj = np.round((pts[:, 1] - g["y0"]) / g["step"]).astype(int)
        ok = (ci >= 0) & (ci < g["nx"]) & (cj >= 0) & (cj < g["ny"])
        np.maximum.at(occ, (cj[ok], ci[ok]), pts[ok, 2])
    return occ


# Midnight's lone tree (src/world/grove.ts LONE_MIDNIGHT): placed in the browser, not in grove.bin
LONE_MIDNIGHT = dict(model=2, x=586.1, y=-958.0, scale=3.5, turn=200.0, tilt=6.0)


def euler_scale(rx, ry, rz, s):
    """grove.ts linear(): Rz . Ry . Rx, each column times the scale."""
    ca, sa, cb, sb, cc, sc = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
    R = np.array([[cc * cb, cc * sb * sa - sc * ca, cc * sb * ca + sc * sa],
                  [sc * cb, sc * sb * sa + cc * ca, sc * sb * ca - cc * sa],
                  [-sb, cb * sa, cb * ca]])
    return R * np.asarray(s, np.float64)[None, :]


def read_grove(meta_part, ground):
    """The grove's plants (grove.bin: src/world/grove.ts decodeGrove) and Midnight's lone tree, as triangles: wood and
    leaf cards, each plant's root on the live ground (grove.ts rootZ). A crown becomes solid height (a known limit:
    its shadow is a soft blob, not dappled)."""
    buf = open(os.path.join(ROOT, "public", "world", meta_part["file"]), "rb").read()
    n = meta_part["instances"]
    inst = np.frombuffer(buf, "<f4", n * 10).reshape(n, 10).astype(np.float64)
    off = n * 40
    protos = []
    for pm in meta_part["protos"]:
        wood = np.frombuffer(buf, "<i2", pm["woodVerts"] * 3, off).reshape(-1, 3) / meta_part["scale"]
        off += pm["woodVerts"] * 6
        off += (4 - off % 4) % 4
        off += pm["woodVerts"] * 4
        widx = np.frombuffer(buf, "<u2", pm["woodTris"] * 3, off).reshape(-1, 3)
        off += pm["woodTris"] * 6
        off += (4 - off % 4) % 4
        cards = np.frombuffer(buf, "<i2", pm["cards"] * 12, off).reshape(-1, 4, 3) / meta_part["scale"]
        off += pm["cards"] * 24
        off += pm["cards"] * 16
        protos.append(np.concatenate([wood[widx], cards[:, [0, 1, 2]], cards[:, [0, 2, 3]]]))
    assert off == len(buf), f"grove.bin: read {off} of {len(buf)} bytes"
    t = LONE_MIDNIGHT
    lone = np.array([t["model"], t["x"], t["y"], 0, t["scale"], t["scale"], t["scale"], math.radians(t["tilt"]), 0,
                     math.radians(t["turn"])])
    out = []
    for row in list(inst) + [lone]:
        kind = int(row[0])
        g = float(ground(np.array([row[1]]), np.array([row[2]]))[0])
        if g < 0.8:  # grove.ts GROVE_MIN_GROUND: left out in the browser
            continue
        root = g - (0.12 if kind == 3 else 0.25)
        L = euler_scale(row[7], row[8], row[9], row[4:7])
        out.append(protos[kind] @ L.T + np.array([row[1], row[2], root]))
    return np.concatenate(out)


def read_dressing(meta, ground):
    """The far trees and scrub (dressing.bin; src/world/dressing.ts): cones on the live ground, rows (x, y, base, r, h)."""
    m = meta["heights"]; d = meta["dressing"]
    q = np.fromfile(os.path.join(ROOT, "public", "world", d["file"]), dtype="<u2").reshape(-1, 4).astype(np.float64)
    n = min(d["trees"] + d["scrub"], len(q))
    q = q[:n]
    x = m["x0"] + q[:, 0] / 65535 * (m["nx"] - 1) * m["step"]
    y = m["y0"] + q[:, 1] / 65535 * (m["ny"] - 1) * m["step"]
    scale = q[:, 2] / 100
    tree = np.arange(n) < d["trees"]
    r = np.where(tree, 0.42 * scale, 0.9 * 1.3 * scale)
    return np.stack([x, y, ground(x, y) - 0.08 * scale, r, scale], 1)


def raise_cones(occ, g, cones):
    """Each cone's height per cell (a tree clump: dressing.ts's two stacked cones read as one, one unit tall)."""
    for x, y, base, r, h in cones:
        rr = max(r, g["step"] * 0.75)
        i0 = max(int(np.floor((x - rr - g["x0"]) / g["step"])), 0)
        i1 = min(int(np.ceil((x + rr - g["x0"]) / g["step"])), g["nx"] - 1)
        j0 = max(int(np.floor((y - rr - g["y0"]) / g["step"])), 0)
        j1 = min(int(np.ceil((y + rr - g["y0"]) / g["step"])), g["ny"] - 1)
        if i1 < i0 or j1 < j0:
            continue
        xs = g["x0"] + np.arange(i0, i1 + 1) * g["step"]; ys = g["y0"] + np.arange(j0, j1 + 1) * g["step"]
        X, Y = np.meshgrid(xs, ys)
        d = np.hypot(X - x, Y - y) / rr
        z = np.where(d < 1, base + h * np.clip(1 - d, 0, 1) * 0.9, -1e9)
        sub = occ[j0:j1 + 1, i0:i1 + 1]
        np.maximum(sub, z, out=sub)
    return occ


class Occluder:
    """The height field rays are tested against: a grid inside the base, the ring outside."""

    def __init__(self, grid, z, ring=None):
        self.g = grid; self.z = z; self.ring = ring
        self.x1 = grid["x0"] + (grid["nx"] - 1) * grid["step"]
        self.y1 = grid["y0"] + (grid["ny"] - 1) * grid["step"]
        self.top = float(z.max()) if ring is None else max(float(z.max()), float(ring[0].max()))
        # Max levels for long steps: a ray stepping 6 m at a time over a 2 m field skips thin columns and leaves dotted
        # streaks in a long shadow (s30 first bake). Level k holds, per 2^k cells, the highest point within one cell
        # around it, so a coarse step never misses what the fine field holds (it fattens it by up to a cell).
        self.levels = [z]
        while len(self.levels) < 6 and min(self.levels[-1].shape) > 8:
            a = self.levels[-1]
            pad = np.pad(a, 1, mode="edge")
            d = np.max([pad[1 + dj:1 + dj + a.shape[0], 1 + di:1 + di + a.shape[1]]
                        for dj in (-1, 0, 1) for di in (-1, 0, 1)], axis=0)
            ny2, nx2 = (a.shape[0] + 1) // 2, (a.shape[1] + 1) // 2
            d = np.pad(d, ((0, ny2 * 2 - a.shape[0]), (0, nx2 * 2 - a.shape[1])), mode="edge")
            self.levels.append(d.reshape(ny2, 2, nx2, 2).max(axis=(1, 3)))

    def at(self, X, Y, level=0):
        g = self.g
        step = g["step"] * (1 << level)
        z = self.levels[level]
        fx = (X - g["x0"]) / step; fy = (Y - g["y0"]) / step
        inside = ((X - g["x0"]) >= 0) & (X <= self.x1) & ((Y - g["y0"]) >= 0) & (Y <= self.y1)
        i = np.clip(np.floor(fx).astype(int), 0, z.shape[1] - 2); j = np.clip(np.floor(fy).astype(int), 0, z.shape[0] - 2)
        u = np.clip(fx - i, 0, 1); v = np.clip(fy - j, 0, 1)
        h = (z[j, i] * (1 - u) + z[j, i + 1] * u) * (1 - v) + (z[j + 1, i] * (1 - u) + z[j + 1, i + 1] * u) * v
        if self.ring is None:
            return np.where(inside, h, -1e9)
        R, r = self.ring
        out = ~inside
        if out.any():
            h = h.copy()
            h[out] = ring_height(R, r, X[out], Y[out])
        return h


def live_ground(meta, H):
    """The ground as the browser draws it: the 8 m grid, with the finer patches (Task 10) laid over it inside them."""
    m = meta["heights"]
    patches = []
    for p in meta.get("patches", []):
        pq = np.fromfile(os.path.join(ROOT, "public", "world", p["file"]), dtype="<u2").reshape(p["ny"], p["nx"])
        patches.append((p, p["lo"] + pq.astype(np.float64) * (p["hi"] - p["lo"]) / 65535))

    def at(X, Y):
        X = np.asarray(X, np.float64); Y = np.asarray(Y, np.float64)
        z = grid_height(H, m, X, Y)
        for p, ph in patches:
            inside = ((X >= p["x0"]) & (X <= p["x0"] + (p["nx"] - 1) * p["step"])
                      & (Y >= p["y0"]) & (Y <= p["y0"] + (p["ny"] - 1) * p["step"]))
            if inside.any():
                z = np.where(inside, grid_height(ph, p, X, Y), z)
        return z
    return at


def build_occluder(meta, H, R):
    m = meta["heights"]
    g = dict(x0=m["x0"], y0=m["y0"], step=OCC_STEP,
             nx=int(round((m["nx"] - 1) * m["step"] / OCC_STEP)) + 1, ny=int(round((m["ny"] - 1) * m["step"] / OCC_STEP)) + 1)
    xs = g["x0"] + np.arange(g["nx"]) * OCC_STEP
    ys = g["y0"] + np.arange(g["ny"]) * OCC_STEP
    X, Y = np.meshgrid(xs, ys)
    live = live_ground(meta, H)
    z = live(X, Y)
    for k in ("arch", "stacks", "cliffs"):
        if k in meta:
            rasterize_max(z, g, read_rock(meta[k]))
    if "grove" in meta:
        rasterize_max(z, g, read_grove(meta["grove"], live))
    if "dressing" in meta:
        raise_cones(z, g, read_dressing(meta, live))
    return Occluder(g, z, (R, meta["ring"])), z


# ---------------------------------------------------------------------------------------------------- the bake
def march_steps(s_max):
    s, out = S0, []
    while s < s_max:
        out.append(s)
        s += max(1.0, 0.015 * s)
    return np.array(out)


def shadow_height(occ, X, Y, d):
    """h_s and the penumbra's half-width w at receivers (X, Y) for the direction toward the light d (coast axes)."""
    el = math.asin(d[2] / np.linalg.norm(d))
    tan_el = math.tan(el)
    hx, hy = d[0], d[1]
    hl = math.hypot(hx, hy) or 1.0
    hx, hy = hx / hl, hy / hl
    floor = float(np.min(occ.z))
    s_max = (occ.top - floor) / max(tan_el, 1e-3) + 1
    best = np.full(X.shape, -1e9)
    s_best = np.zeros(X.shape)
    steps = march_steps(max(min(s_max, 12000.0), S0 + 1))
    gaps = np.diff(steps, append=steps[-1] + 1)
    for s, gap in zip(steps, gaps):
        level = int(np.clip(np.floor(np.log2(max(gap, 1e-6) / occ.g["step"])) + 1, 0, len(occ.levels) - 1))
        h = occ.at(X + hx * s, Y + hy * s, level) - s * tan_el
        up = h > best
        best = np.where(up, h, best)
        s_best = np.where(up, s, s_best)
    w = np.maximum(W_MIN, s_best * math.tan(math.radians(DISC_DEG / 2))) / max(math.cos(el) ** 2, 0.2)
    # Lit with room to spare at the ground: the exact height does not matter (nothing there is shadowed), so it is
    # written as LO, which keeps the files small (the first bake's low bytes were noise: 8.3 MB). Over the sea the
    # lowest thing lit is the water, not the sea floor.
    ground = np.maximum(occ.at(X, Y), 0.0)
    clear = best + w < ground - 1.0
    best = np.where(clear, LO, best)
    w = np.where(clear, W_MIN, w)
    return best, w


def horizon_ao(occ, X, Y, z0):
    """The cosine-weighted share of the sky a point at height z0 + 0.5 sees, from 8 horizon angles out to AO_REACH."""
    acc = np.zeros(X.shape)
    steps = np.array([1.0, 2, 3, 4.5, 6, 8, 11, 15, 20, 27, 36, 48, 64])
    steps = steps[steps <= AO_REACH]
    for k in range(AO_DIRS):
        a = 2 * math.pi * k / AO_DIRS
        dx, dy = math.sin(a), math.cos(a)
        tan_h = np.zeros(X.shape)
        for s in steps:
            tan_h = np.maximum(tan_h, (occ.at(X + dx * s, Y + dy * s) - (z0 + 0.5)) / s)
        acc += 1.0 / (1.0 + tan_h ** 2)  # cos^2 of the horizon angle
    return acc / AO_DIRS


def encode_key(hs, w):
    q = np.round((np.clip(hs, LO, HI) - LO) / H_STEP).astype(np.uint32)
    rgb = np.zeros(hs.shape + (3,), np.uint8)
    rgb[..., 0] = q >> 8
    rgb[..., 1] = q & 255
    rgb[..., 2] = np.clip(np.round(w * 10), 0, 255).astype(np.uint8)
    return rgb


def decode_key(rgb):
    q = rgb[..., 0].astype(np.float64) * 256 + rgb[..., 1]
    return LO + q * H_STEP, rgb[..., 2] / 10.0


def fine_window(cam):
    y = math.radians(cam.yaw)
    cx = cam.x + math.sin(y) * FINE_AHEAD
    cy = cam.y + math.cos(y) * FINE_AHEAD
    half = FINE_N * FINE_STEP / 2
    return dict(x0=round(cx - half), y0=round(cy - half), step=FINE_STEP, nx=FINE_N, ny=FINE_N)


def receivers(g):
    xs = g["x0"] + (np.arange(g["nx"]) + 0.5) * g["step"]
    ys = g["y0"] + (np.arange(g["ny"]) + 0.5) * g["step"]
    return np.meshgrid(xs, ys)


_OCC = None


def _init(occ):
    global _OCC
    _OCC = occ


def _job(job):
    """One piece of the bake, in a worker: the coarse AO, an hour's coarse key, or an hour's fine key and AO."""
    h, d, g = job
    X, Y = receivers(g)
    if h == "ao":
        return horizon_ao(_OCC, X, Y, _OCC.at(X, Y))
    hs, w = shadow_height(_OCC, X, Y, d)
    if g["step"] == COARSE_STEP:
        return encode_key(hs, w)
    lit = float((hs < _OCC.at(X, Y) + 0.2).mean())
    print(f"{h}: key el {math.degrees(math.asin(d[2])):.1f} deg, fine window lit share {lit:.2f}", flush=True)
    return encode_key(hs, w), horizon_ao(_OCC, X, Y, _OCC.at(X, Y))


def main():
    os.makedirs(OUT, exist_ok=True)
    meta, H, R = load_base()
    occ, _ = build_occluder(meta, H, R)
    m = meta["heights"]
    coarse = dict(x0=m["x0"], y0=m["y0"], step=COARSE_STEP,
                  nx=int((m["nx"] - 1) * m["step"] / COARSE_STEP), ny=int((m["ny"] - 1) * m["step"] / COARSE_STEP))
    dirs = {k: v for k, v in views.light_dirs().items() if v is not None}
    cams = views.cameras()
    hours = [h for h in views._shots() if h in dirs]
    windows = {h: fine_window(cams[h]) for h in hours}
    jobs = [("ao", None, coarse)] + [(h, dirs[h], coarse) for h in hours] + [(h, dirs[h], windows[h]) for h in hours]
    with Pool(min(4, os.cpu_count() or 1), initializer=_init, initargs=(occ,)) as pool:
        done = pool.map(_job, jobs, chunksize=1)
    ao_c = done[0]
    key_c = done[1:1 + len(hours)]
    key_f = [f[0] for f in done[1 + len(hours):]]
    ao_f = [f[1] for f in done[1 + len(hours):]]
    # images are north-up like colour.webp: row 0 is the grid's last row (largest y)
    flip = lambda a: a[::-1]
    save = lambda arr, name: Image.fromarray(arr).save(os.path.join(OUT, name), lossless=True, quality=100, method=6)
    save(np.concatenate([flip(k) for k in key_c]), "key-coarse.webp")
    save(np.concatenate([flip(k) for k in key_f]), "key-fine.webp")
    save(flip(np.round(np.clip(ao_c, 0, 1) * 255).astype(np.uint8)), "ao-coarse.webp")
    save(np.concatenate([flip(np.round(np.clip(a, 0, 1) * 255).astype(np.uint8)) for a in ao_f]), "ao-fine.webp")
    out = dict(lo=LO, hStep=H_STEP, coarse=coarse, fine=dict(step=FINE_STEP, n=FINE_N), hours=hours,
               keys={h: [round(c, 6) for c in dirs[h]] for h in hours},
               windows={h: [windows[h]["x0"], windows[h]["y0"]] for h in hours},
               files=dict(keyCoarse="light/key-coarse.webp", keyFine="light/key-fine.webp",
                          aoCoarse="light/ao-coarse.webp", aoFine="light/ao-fine.webp"))
    json.dump(out, open(os.path.join(OUT, "light.json"), "w", encoding="utf-8"), indent=1)
    for f in os.listdir(OUT):
        print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, "KB")


if __name__ == "__main__":
    main()
