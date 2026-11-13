"""Check the parts baked from the Blender scene (aurora.json, cave.bin, arch.bin) against shots.json and coast.py's
pure data, without Blender."""
import json, math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
BASE = os.path.join(ROOT, "public", "world", "base")
shots = json.load(open(os.path.join(ROOT, "src", "journey", "shots.json"), encoding="utf-8"))
meta = json.load(open(os.path.join(BASE, "base.json"), encoding="utf-8"))


def need(path):
    if not os.path.exists(path):
        sys.exit(f"missing {path}: run `npm run world:blender` (needs Blender) and commit the result")
    return path


def test_aurora():
    data = json.load(open(need(os.path.join(BASE, "aurora.json")), encoding="utf-8"))
    n = data["samples"]
    assert n == 131, n
    for hour in ("night", "midnight"):
        cfg = shots[hour]["aurora"]; bands = data[hour]
        assert len(bands) == len(cfg["bands"]), (hour, len(bands))
        for flat, (az0, az1, el0, el1, hel, amp, k) in zip(bands, cfg["bands"]):
            a = np.array(flat).reshape(-1, 3)
            assert len(a) == n, (hour, len(a))
            az = a[:, 0] - cfg["yaw"]
            assert az.min() >= min(az0, az1) - 1.6 * amp - 1 and az.max() <= max(az0, az1) + 1.6 * amp + 1, (hour, az.min(), az.max())
            assert a[:, 1].min() > -5 and (a[:, 1] + a[:, 2]).max() < 90, (hour, a[:, 1].min())
            assert a[:, 2].min() >= 0.6 * hel - 0.01 and a[:, 2].max() <= 1.4 * hel + 0.01, (hour, a[:, 2].min(), a[:, 2].max())
    assert meta["aurora"]["file"] == "base/aurora.json"


def read_cave():
    m = meta["cave"]; cave = shots["beforedawn"]["cave"]
    buf = open(need(os.path.join(BASE, "cave.bin")), "rb").read()
    off = 0
    def take(dtype, count, pad=False):
        nonlocal off
        a = np.frombuffer(buf, dtype, count, off); off += a.nbytes
        if pad: off += off % 2
        return a
    sv, fv, nf = m["shellVerts"], m["floorVerts"], m["fungi"]
    shell = take("<i2", sv * 3).reshape(-1, 3) / m["scale"]
    opn = take(np.uint8, sv, True) / 255 * (m["openHi"] - m["openLo"]) + m["openLo"]
    light = take(np.uint8, sv, True)
    floor = take("<i2", fv * 3).reshape(-1, 3) / m["scale"]
    flight = take(np.uint8, fv, True)
    fungi = take("<i2", nf * 3).reshape(-1, 3) / m["scale"]
    frad = take(np.uint8, nf, True)
    stris = take("<u2", m["shellTris"] * 3).reshape(-1, 3)
    ftris = take("<u2", m["floorTris"] * 3).reshape(-1, 3)
    assert off == len(buf), (off, len(buf))
    return m, cave, shell, opn, light, floor, flight, fungi, frad, stris, ftris


def test_cave():
    m, cave, shell, opn, light, floor, flight, fungi, frad, stris, ftris = read_cave()
    centre = np.array([0.0, 0.0, cave["centreZ"] - cave["floor"]])
    assert np.linalg.norm(shell - centre, axis=1).max() < 13.5
    assert stris.max() < len(shell) and ftris.max() < len(floor)
    d = (shell[opn > 0] - centre).mean(0)
    az = math.degrees(math.atan2(d[0], d[1]))
    assert abs(az - cave["az"]) < 12, az                               # the mouth faces the cove
    assert np.abs(floor[:, 2]).max() < 0.3, np.abs(floor[:, 2]).max()  # the floor sits at the cave's floor height
    assert 150 <= len(fungi) <= 700, len(fungi)
    assert light.min() == 0 and light.max() > 200, (light.min(), light.max())
    # the back wall faces the mouth and is lit by it; the rock beside the mouth faces inward, away from the light
    front = (shell - centre) @ np.array([math.sin(math.radians(cave["az"])), math.cos(math.radians(cave["az"])), 0.0])
    solid = opn < -0.5
    back, beside = light[solid & (front < -6)].mean(), light[solid & (front > 6)].mean()
    assert back > 2 * beside, (back, beside)
    assert frad.min() >= 1


def read_arch():
    """arch.bin (export_parts.py `export_arch`, in the headland pack): Int16 positions (coast axes, around ARCH pos,
    1/scale m), Int16 column coordinates, the baked light and the moss as one byte per vertex each (padded to 4 bytes), then the triangles
    (Uint16 or Uint32: meta indexBytes)."""
    if "arch" not in meta:
        sys.exit("base.json has no arch: run `npm run world:blender` (needs Blender) and commit the result")
    m = meta["arch"]
    assert m["file"] == "stops/headland/arch.bin", m["file"]          # ruling R15: rocks live in the place pack
    buf = open(need(os.path.join(BASE, "..", *m["file"].split("/"))), "rb").read()
    P = np.frombuffer(buf, "<i2", m["verts"] * 3, 0).reshape(-1, 3) / m["scale"]
    off = m["verts"] * 6
    col = np.frombuffer(buf, "<i2", m["verts"] * 2, off).reshape(-1, 2) / m["scale"]; off += m["verts"] * 4
    light = np.frombuffer(buf, np.uint8, m["verts"], off); off += m["verts"]
    moss = np.frombuffer(buf, np.uint8, m["verts"], off); off += m["verts"]; off += -off % 4
    T = np.frombuffer(buf, f"<u{m['indexBytes']}", m["tris"] * 3, off).reshape(-1, 3); off += T.nbytes; T = T.astype(np.int64)
    assert off == len(buf), (off, len(buf))
    assert np.abs(col - P[:, :2]).max() < 45.0, np.abs(col - P[:, :2]).max()     # a column's foot is near its point
    return m, P, light, moss, T


def components(T, P):
    """The mesh's connected pieces (vertices at the same place are one: flat-shaded faces have their own corners):
    lists of vertex indices."""
    _, weld = np.unique(np.round(P * 100).astype(np.int64), axis=0, return_inverse=True)
    weld = weld.ravel(); n = len(P); T = weld[T]
    parent = np.arange(n)
    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]; i = parent[i]
        return i
    for a_, b_, c_ in T:
        ra, rb, rc = root(a_), root(b_), root(c_); parent[rb] = ra; parent[rc] = ra
    roots = np.array([root(weld[i]) for i in range(n)])
    return [np.nonzero(roots == r)[0] for r in np.unique(roots)]


def arch_frame():
    """coast.py's arch axes: s along the spine (seaward +), q along the hole axis."""
    import coastlib
    c = coastlib.load("bluehour")
    rz = math.radians(c.ARCH["rotz"])
    return c, np.array([math.cos(rz), math.sin(rz)]), np.array([-math.sin(rz), math.cos(rz)])


def ray_hits(P, T, o, d):
    """Moller-Trumbore against every triangle: the distances along the ray (o + t d, t > 0) where it hits."""
    a, b, c_ = P[T[:, 0]], P[T[:, 1]], P[T[:, 2]]
    e1, e2 = b - a, c_ - a
    pv = np.cross(d, e2); det = (e1 * pv).sum(1)
    ok = np.abs(det) > 1e-12; inv = np.where(ok, 1.0 / np.where(ok, det, 1.0), 0.0)
    tv = o - a; u = (tv * pv).sum(1) * inv
    qv = np.cross(tv, e1); v = (qv * d).sum(1) * inv; t = (qv * e2).sum(1) * inv
    hit = ok & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 0)
    return t[hit]


def slice_width(P, T, z, S):
    """Where the plane at height z cuts the mesh: the points of the cut, as their s along the spine."""
    zs = P[T, 2]                                          # (n, 3)
    out = []
    for i, j in ((0, 1), (1, 2), (2, 0)):
        za, zb = zs[:, i], zs[:, j]
        cross = (za - z) * (zb - z) < 0
        w = (z - za[cross]) / (zb[cross] - za[cross])
        out.append(S[T[cross, i]] * (1 - w) + S[T[cross, j]] * w)
    return np.concatenate(out)


def test_arch():
    m, P, light, moss, T = read_arch()
    c, u, n = arch_frame()
    ax, ay = c.ARCH["pos"]
    assert (m["x"], m["y"]) == (ax, ay), (m["x"], m["y"])
    assert T.max() < len(P) and m["tris"] <= 150_000, m["tris"]
    S, Q, Z = P[:, :2] @ u, P[:, :2] @ n, P[:, 2]
    s0, zm = c.ARCH_OPEN
    # the arch has a hole (ruling R5): a ray along the hole axis, through the opening's centre at its mid-height, hits
    # no rock; the same ray through either leg, and through the span above the opening, does
    def ray(s, z):
        o = np.array([*(u * s - n * 200.0), z]); d = np.array([*n, 0.0])
        return ray_hits(P, T, o, d)
    assert len(ray(s0, zm)) == 0, ("the opening is blocked", ray(s0, zm))
    for s, z, what in ((c.ARCH_LAND["s"], zm, "land leg"), (c.ARCH_SEA["s"], zm, "sea leg"),
                       (s0, (c.ARCH_SPAN["z0"] + c.ARCH_SPAN["z1"]) / 2 + c.ARCH_SPAN["rise"], "span")):
        assert len(ray(s, z)) >= 2, what
    # the legs differ in thickness by >= 1.6x (owner cliffs-and-columns 1: a thick landward leg, a thin seaward one):
    # the width along the spine where planes at three heights cut each leg
    for z in (6.0, 16.0, 26.0):
        cut = slice_width(P, T, z, S)
        land, sea = cut[cut < s0], cut[cut > s0]
        wl, ws = land.max() - land.min(), sea.max() - sea.min()
        assert wl >= 1.6 * ws, (z, wl, ws)
    # the opening is off-centre in the whole mass: its centre is >= 8 m seaward of the middle of the rock's spine
    assert s0 - (S.min() + S.max()) / 2 >= 8.0, (s0, S.min(), S.max())
    # the highest rock is ARCH_TOP (the headland line's heights step down from it) and the seaward leg's foot reaches
    # ARCH_LEG along the line at the waterline (the first stack's gap is measured from it)
    assert abs(Z.max() - c.ARCH_TOP) < 3.0, (Z.max(), c.ARCH_TOP)
    wl_ = np.abs(Z) < 0.3
    assert abs(S[wl_].max() - c.ARCH_LEG) < 3.0, (S[wl_].max(), c.ARCH_LEG)
    # a skirt: the rock runs on below the flats (no floating foot), and a fallen block breaks the water beneath the opening
    assert Z.min() < float(c.ground(ax, ay)) - 2.0, Z.min()
    under = (np.abs(S - s0) < 9.0) & (np.abs(Q) < 14.0)
    block = under & (Z < 5.0)
    assert block.sum() >= 20 and Z[block].max() > 1.2, (block.sum(), Z[block].max() if block.any() else None)
    assert not (under & (Z > 6.0) & (Z < zm + 6.0)).any(), "rock stands in the opening"
    # the baked light: some rock in deep shade (inside the opening's corners, under the span), some open to the sky
    assert light.min() < 90 and light.max() > 230, (light.min(), light.max())
    # fix round 1 (controller look check, owner cliffs-and-columns 1)
    # L4: a heap of 10-20 angular fallen blocks, 1-7.5 m across, each its own piece, under the opening and at the
    # heavy block's foot; some half under water
    comps = components(T, P)
    blocks = [c_ for c_ in comps if Z[c_].max() < 8.0]
    assert 10 <= len(blocks) <= 20, len(blocks)
    sizes = [max(np.ptp(S[c_]), np.ptp(Q[c_])) for c_ in blocks]
    assert min(sizes) >= 1.0 and max(sizes) <= 7.5, sizes
    at_open = sum(abs(S[c_].mean() - s0) < 14 for c_ in blocks); at_foot = sum(S[c_].mean() < c.ARCH_LAND["s"] + 14 for c_ in blocks)
    assert at_open >= 5 and at_foot >= 5, (at_open, at_foot)
    assert sum(Z[c_].min() < -0.3 and Z[c_].max() < 1.5 * np.ptp(Z[c_]) for c_ in blocks) >= 3   # half under water
    # L3: moss is a cap on each crown spilling 3-6 m down the upper faces, never in the spray
    assert moss[Z < 8.0].max() == 0, moss[Z < 8.0].max()
    crown = Z > c.ARCH_TOP - 3.0
    assert (moss[crown] > 128).mean() > 0.6, (moss[crown] > 128).mean()
    for leg in (c.ARCH_LAND, c.ARCH_SEA):
        near = (np.abs(S - leg["s"]) < leg["rs"] * 1.3) & (np.abs(Q) < leg["rq"] * 1.3)
        top = Z[near].max(); band = near & (Z < top - 3.0) & (Z > top - 6.0)
        assert (moss[band] > 60).mean() > 0.25, (leg["s"], (moss[band] > 60).mean())
    # L2: the crown is stepped column ends, not a dome: in its top 10 m many faces are near level and many near upright
    n_ = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]]); n_ /= np.linalg.norm(n_, axis=1, keepdims=True) + 1e-12
    cz = P[T, 2].mean(1); cs = S[T].mean(1); cq = Q[T].mean(1)
    land = (cz > c.ARCH_TOP - 10.0) & (np.abs(cs - c.ARCH_LAND["s"]) < 18) & (np.abs(cq) < 15)
    flat, wall_ = (np.abs(n_[land, 2]) > 0.95).mean(), (np.abs(n_[land, 2]) < 0.35).mean()
    assert flat > 0.2 and wall_ > 0.2, (flat, wall_)


if __name__ == "__main__":
    test_aurora()
    test_cave()
    test_arch()
    print("ok parts: aurora", meta["aurora"], "cave", {k: meta["cave"][k] for k in ("shellVerts", "shellTris", "floorVerts", "fungi")},
          "arch", {k: meta["arch"][k] for k in ("verts", "tris")})
