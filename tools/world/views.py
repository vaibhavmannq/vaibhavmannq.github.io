"""What the nine cameras see: their rays cast onto a ground formula, the way raymap.py does (spec §6's cheap check).

Coast coordinates: x east, y north (out to sea), z up, metres. Yaw 0 looks along +y, positive yaw turns east.
"""
import json, math, os
from collections import namedtuple
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.normpath(os.path.join(HERE, "..", "..", "src", "journey", "shots.json"))

Camera = namedtuple("Camera", "x y z yaw pitch lens")
SKY, SEA, LAND, CLOUD = 0, 1, 2, 3
# The nine views are protected exactly within this distance; the hazy background beyond may change (s05 ruling).
NEAR = 1500.0
# Aspects the site may show a stop at: 16:9, square (the tallest view by fovFor's rule) and a phone in portrait.
ASPECTS = (16 / 9, 1.0, 0.46)


def _shots():
    with open(SHOTS, encoding="utf-8") as f:
        return json.load(f)


def cameras():
    return {k: Camera(v["cam"][0], v["cam"][1], v["eyeZ"], v["look"][0], v["look"][1], v["lens"]) for k, v in _shots().items()}


def _vfov(lens, aspect):
    """src/journey/camera.ts fovFor(): the vertical field of view in radians."""
    h = 2 * math.atan(18 / lens)
    if aspect >= 1:
        return 2 * math.atan(math.tan(h / 2) / aspect)
    return min(math.radians(80), 2 * math.atan(math.tan(h / 2) / max(aspect, 0.5)) * 0.62)


def _basis(yaw, pitch):
    y, p = math.radians(yaw), math.radians(pitch)
    fwd = np.array([math.sin(y) * math.cos(p), math.cos(y) * math.cos(p), math.sin(p)])
    right = np.array([math.cos(y), -math.sin(y), 0.0])
    return fwd, right, np.cross(right, fwd)


def ray_grid(cam, w=96):
    """Rays over the camera's widest field (the lens across) and its tallest (the largest of ASPECTS)."""
    th = math.tan(math.atan(18 / cam.lens))
    tv = max(math.tan(_vfov(cam.lens, a) / 2) for a in ASPECTS)
    h = max(2, round(w * tv / th))
    u, v = np.meshgrid(np.linspace(-th, th, w), np.linspace(-tv, tv, h))
    fwd, right, up = _basis(cam.yaw, cam.pitch)
    d = fwd[None] + right[None] * u.reshape(-1, 1) + up[None] * v.reshape(-1, 1)
    d /= np.linalg.norm(d, axis=1, keepdims=True)
    o = np.tile([cam.x, cam.y, cam.z], (len(d), 1)).astype(np.float64)
    return o, d


# The ceiling: the highest ground per 64 m tile (sampled every 16 m, a 3x3 tile neighbourhood, plus 40 m), so rays
# far above the land skip the costly formula. Covers the horizon ring's reach; outside it every step is evaluated.
CEIL_X0, CEIL_N, CEIL_TILE, CEIL_MARGIN = -7424.0, 220, 64.0, 40.0
_ceilings = {}


def _ceiling(ground):
    key = id(ground)
    if key not in _ceilings:
        s = np.arange(CEIL_N * 4) * (CEIL_TILE / 4) + CEIL_X0 + CEIL_TILE / 8
        X, Y = np.meshgrid(s, s)
        h = np.asarray(ground(X, Y), np.float64).reshape(CEIL_N, 4, CEIL_N, 4).max(axis=(1, 3))
        p = np.pad(h, 1, mode="edge")
        m = np.max([p[i:i + CEIL_N, j:j + CEIL_N] for i in range(3) for j in range(3)], axis=0)
        _ceilings[key] = (ground, np.maximum(m, 0.0) + CEIL_MARGIN)
    return _ceilings[key][1]


def _below_ceiling(ceil, p):
    i = np.floor((p[:, 1] - CEIL_X0) / CEIL_TILE).astype(np.int64)
    j = np.floor((p[:, 0] - CEIL_X0) / CEIL_TILE).astype(np.int64)
    inside = (i >= 0) & (i < CEIL_N) & (j >= 0) & (j < CEIL_N)
    out = np.ones(len(p), bool)
    out[inside] = p[inside, 2] < ceil[i[inside], j[inside]]
    return out


def cloud_planes():
    """Opaque cloud layers in the approved renders, per stop: (z, x0, x1, y0, y1). Midnight's sea of cloud, at its
    lowest wave (z - amp), so anything that could show through between the waves still counts as seen."""
    import coastlib
    out = {}
    for name, shot in coastlib.load().SHOTS.items():
        cs = shot.get("cloudsea")
        if cs:
            x0, x1, y0, y1 = cs["box"]
            out[name] = (float(cs["z"] - cs["amp"]), float(x0), float(x1), float(y0), float(y1))
    return out


def _march(ground, o, d, t_max, t0=0.5, z_stop=None, bounded=True, watch=None, cloud=None):
    """Step every ray until it drops below max(ground, 0). Returns t (inf if none), the ground there and, with
    watch = (same_where, other_ceiling), which rays sampled a point that matters (below either ceiling) where
    same_where says the other ground may differ."""
    n = len(o)
    t_hit = np.full(n, np.inf); g_hit = np.zeros(n); touched = np.zeros(n, bool); in_cloud = np.zeros(n, bool)
    t = np.full(n, t0); live = np.arange(n)
    ceil = _ceiling(ground) if bounded else None
    while live.size:
        p = o[live] + d[live] * t[live, None]
        near = _below_ceiling(ceil, p) if bounded else np.ones(len(p), bool)
        if watch is not None:
            same_where, other = watch
            look = near | _below_ceiling(other, p)
            if look.any():
                diff = np.zeros(len(p), bool)
                diff[look] = ~np.asarray(same_where(p[look, 0], p[look, 1]), bool)
                touched[live[diff]] = True
        g = np.zeros(len(p))
        g[near] = np.asarray(ground(p[near, 0], p[near, 1]), np.float64)
        hit = near & (p[:, 2] < np.maximum(g, 0.0))
        if cloud is not None:
            cz, cx0, cx1, cy0, cy1 = cloud
            fog = ~hit & (p[:, 2] < cz) & (p[:, 0] > cx0) & (p[:, 0] < cx1) & (p[:, 1] > cy0) & (p[:, 1] < cy1)
            in_cloud[live[fog]] = True
            hit = hit | fog
        t_hit[live[hit]] = t[live[hit]]; g_hit[live[hit]] = g[hit]
        t[live] += np.maximum(0.25, 0.01 * t[live])
        keep = ~hit & (t[live] < t_max)
        if z_stop is not None:
            keep &= p[:, 2] < z_stop
        live = live[keep]
    if cloud is not None:
        g_hit[in_cloud] = np.nan
    return (t_hit, g_hit, touched) if watch is not None else (t_hit, g_hit)


def _kind(t, g):
    return np.where(np.isinf(t), SKY, np.where(np.isnan(g), CLOUD, np.where(g < 0, SEA, LAND))).astype(np.int8)


def cast(ground, origins, dirs, t_max=7000.0, bounded=True, cloud=None):
    t, g = _march(ground, np.asarray(origins, np.float64), np.asarray(dirs, np.float64), t_max, bounded=bounded, cloud=cloud)
    return t, _kind(t, g)


def compare(ground_a, ground_b, cams, w=96, same_where=None, near=None):
    """Per camera, the share of rays that hit differently. With same_where(x, y) (true where the two grounds are known
    to be equal), only the rays that sampled ground where they may differ are cast on ground_b. With near, a change
    counts only if the ray hits within that distance on either ground (the far background may change, s05 ruling)."""
    out = {}
    clouds = cloud_planes()
    for name, cam in cams.items():
        o, d = ray_grid(cam, w)
        cl = clouds.get(name)
        if same_where is None:
            ta, ka = cast(ground_a, o, d, cloud=cl); tb, kb = cast(ground_b, o, d, cloud=cl)
        else:
            ta, g, touched = _march(ground_a, o, d, 7000.0, watch=(same_where, _ceiling(ground_b)), cloud=cl)
            ka = _kind(ta, g)
            tb, kb = ta.copy(), ka.copy()
            if touched.any():
                tb[touched], kb[touched] = cast(ground_b, o[touched], d[touched], cloud=cl)
        both = np.isfinite(ta) & np.isfinite(tb)
        far = np.zeros(len(ta), bool)
        far[both] = np.abs(ta[both] - tb[both]) > 0.01 * ta[both] + 0.3
        diff = (ka != kb) | far
        if near is not None:
            diff &= np.minimum(ta, tb) <= near
        out[name] = float(diff.mean())
    return out


def _sun_dir(el, az):
    """src/journey/hours.ts sunDir(): toward a light at elevation el, azimuth az (degrees)."""
    e, a = math.radians(el), math.radians(az)
    return (math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e))


def light_dirs():
    """The direction toward each stop's key light, when it is up and can cast a shadow; else None."""
    out = {}
    for k, s in _shots().items():
        if s["sun_str"] > 0 and s["sun_el"] > 0.5:
            out[k] = _sun_dir(s["sun_el"], s["sun_az"])
        elif s.get("moon") and s["moon"][1] > 0.5:
            out[k] = _sun_dir(s["moon"][1], s["moon"][0])
        else:
            out[k] = None
    return out


def shadowed(ground, points, d, t_max=6000.0):
    """True where the ground rises above the ray toward the light before the ray climbs over 700 m."""
    p = np.asarray(points, np.float64) + np.array([0.0, 0.0, 0.3])
    dirs = np.tile(np.asarray(d, np.float64) / np.linalg.norm(d), (len(p), 1))
    t, _ = _march(ground, p, dirs, t_max, t0=1.0, z_stop=700.0)
    return np.isfinite(t)
