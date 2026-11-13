"""The site's baked parts, written from inside Blender by coast.py's own builders (run: npm run world:blender).

coast.py calls run(globals()) when started with `--export <folder>` and skips the scene and the render. What is
exported depends on the hour:

  an hour with an aurora   <folder>/aurora.json   each curtain's base line (the folds use Blender's own noise)
  the cave's hour          <folder>/cave.bin      the cave shell with its ragged mouth, the floor, the light that
                                                  reaches each point from the mouth, and the glowing fungi
  Blue hour (the arch's)   <folder>/../stops/headland/arch.bin   the lopsided sea arch and the blocks fallen
                                                  beneath it, with the share of the sky each point sees and its moss

Each adds its key to <folder>/base.json. The file layouts are read by src/world/aurora.ts, src/world/cave.ts and
src/world/arch.ts and checked without Blender by tools/world/test_parts.py.
"""
import json, math, os
import numpy as np

AURORA_SAMPLES = 130          # quads along a curtain on the site (the render uses 260)
SCALE = 1000                  # cave.bin: Int16 units per metre
MOUTH_POINTS = 24
OPEN_LO, OPEN_HI = -2.0, 2.0  # the `open` field is stored over this range
HOLE = 0.45                   # triangles with all three corners more open than this are inside the hole: not exported
ARCH_SCALE = 100              # arch.bin: Int16 units per metre (the arch reaches ~60 m from its origin)
SKY_RAYS = 48                 # rays per point for the arch's sky light
ARCH_TRIS = 60_000            # the site's arch (ruling R15: it lives in the headland pack, under the 3 MB per-place
                              # budget); enough for the stepped crowns; the column joints are drawn per pixel
HEADLAND = os.path.join("..", "stops", "headland")   # the headland's place pack, beside base/ (src/world/headland.ts)
MOSS_REACH = 8.0              # moss can spill this far down from the highest rock nearby; the shader's patches
                              # thin it out, so it shows 3-6 m down (owner cliffs-and-columns 1)
MOSS_ABOVE = 8.0              # and never lower than this: no moss in the spray
SEA_BOUNCE = 0.3              # what a ray that leaves downward brings back from the sea and the flats (they mirror the sky dimly)


def _meta(folder, **keys):
    path = os.path.join(folder, "base.json")
    meta = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    meta.update(keys)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(meta, f, indent=1); f.write("\n")


def export_aurora(g, folder):
    S, hour = g["S"], g["HOUR"]
    cfg = S["aurora"]; yaw = S["look"][0]
    bands = []
    for b, band in enumerate(cfg["sky_bands"]):
        flat = []
        for az, el, h in g["aurora_curve"](b, band, AURORA_SAMPLES):
            flat += [round(yaw + az, 2), round(el, 2), round(h, 2)]
        bands.append(flat)
    path = os.path.join(folder, "aurora.json")
    data = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    data["samples"] = AURORA_SAMPLES + 1
    data[hour] = bands
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, separators=(",", ":")); f.write("\n")
    _meta(folder, aurora=dict(file="base/aurora.json"))
    g["log"]("aurora", hour, len(bands), "bands")


def _pad2(b):
    return b + b"\0" * (len(b) % 2)


def export_cave(g, folder):
    import bpy
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    S = g["S"]; cx, cy = g["CAVE"]; fz = g["CAVE_FLOOR"]; fbm = g["fbm"]
    g["build_cave"]()
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    cave = bpy.data.objects["cave"]
    me = cave.evaluated_get(dg).to_mesh()
    me.calc_loop_triangles()
    origin = Vector((cx, cy, fz))
    V = np.array([tuple(cave.matrix_world @ v.co - origin) for v in me.vertices], np.float64)
    centre = np.array(cave.location) - np.array(origin)
    NIN = -np.array([tuple(v.normal) for v in me.vertices], np.float64)          # pointing into the cave
    opn = np.zeros(len(me.vertices), np.float32); cave.data.attributes["open"].data.foreach_get("value", opn)
    T = np.array([tuple(t.vertices) for t in me.loop_triangles], np.int64)
    tri_open = opn[T]
    shell_tris = T[~np.all(tri_open > HOLE, axis=1)]
    solid = T[~np.all(tri_open > 0.0, axis=1)]                                  # what blocks light: rock, not the hole
    bvh = BVHTree.FromPolygons([Vector(v) for v in V], [tuple(int(i) for i in t) for t in solid])

    # the floor: build_cave's wet_floor heights on a coarser grid (0.4 m), the same disc
    st = 0.4; xs = np.arange(-10.4, 10.41, st); X, Y = np.meshgrid(xs, xs)
    Z = 0.03 + 0.18 * fbm((X + cx) * 0.6 + 3, (Y + cy) * 0.6 + 1, 4) + 0.05 * fbm((X + cx) * 3.0, (Y + cy) * 3.0, 3)
    inside = np.hypot(X, Y) < 9.6 + st
    idx = -np.ones(X.shape, np.int64); idx[inside] = np.arange(int(inside.sum()))
    F = np.stack([X[inside], Y[inside], Z[inside]], -1)
    quads = inside[:-1, :-1] & inside[:-1, 1:] & inside[1:, :-1] & inside[1:, 1:]
    a, b, c, d = idx[:-1, :-1][quads], idx[:-1, 1:][quads], idx[1:, :-1][quads], idx[1:, 1:][quads]
    floor_tris = np.concatenate([np.stack([a, b, c], -1), np.stack([b, d, c], -1)])
    FN = np.tile(np.array([0.0, 0.0, 1.0]), (len(F), 1))

    # light from the mouth: how many of a few points spread over the opening each point sees, weighted by how squarely it faces them
    mouth = np.where(opn > 0.6)[0]
    mouth = mouth[np.linspace(0, len(mouth) - 1, MOUTH_POINTS).astype(int)]
    targets = centre + (V[mouth] - centre) * 1.6                                # outside the shell, in the open air
    def light(P, N):
        out = np.zeros(len(P))
        for i, (p, n) in enumerate(zip(P, N)):
            p0 = Vector(p + n * 0.06); acc = 0.0
            for t in targets:
                dvec = Vector(t) - p0; dist = dvec.length; dvec.normalize()
                hit = bvh.ray_cast(p0, dvec, dist)
                if hit[0] is None: acc += 0.35 + 0.65 * max(0.0, float(np.dot(n, dvec)))
            out[i] = acc / len(targets)
        return out
    shell_light = light(V, NIN); floor_light = light(F, FN)

    # the fungi: every bulb build_cave placed (floor clumps, wall clusters cast onto the displaced rock)
    fungi = []
    rx, ry, rz = 12.0, 10.0, 7.5
    for o in bpy.data.objects:
        if o.type == "MESH" and o.data.materials and o.data.materials[0] and o.data.materials[0].name.startswith("bulb"):
            p = np.array(o.matrix_world.translation) - np.array(origin); q = p - centre
            if (q[0] / rx) ** 2 + (q[1] / ry) ** 2 + (q[2] / rz) ** 2 > 1.05: continue      # behind the wall: never seen
            fungi.append((p[0], p[1], p[2], o.dimensions.x / 2))
    fungi = np.array(fungi, np.float64)

    def i16(a): return np.round(np.asarray(a) * SCALE).astype("<i2").tobytes()
    def u8(a, lo=0.0, hi=1.0): return _pad2(np.round(np.clip((np.asarray(a) - lo) / (hi - lo), 0, 1) * 255).astype(np.uint8).tobytes())
    blob = b"".join([
        i16(V), u8(opn, OPEN_LO, OPEN_HI), u8(shell_light / max(shell_light.max(), 1e-6)),
        i16(F), u8(floor_light / max(shell_light.max(), 1e-6)),
        i16(fungi[:, :3]), _pad2(np.clip(np.round(fungi[:, 3] * 1000), 1, 255).astype(np.uint8).tobytes()),
        shell_tris.astype("<u2").tobytes(), floor_tris.astype("<u2").tobytes(),
    ])
    with open(os.path.join(folder, "cave.bin"), "wb") as f: f.write(blob)
    _meta(folder, cave=dict(file="base/cave.bin", shellVerts=len(V), shellTris=len(shell_tris), floorVerts=len(F),
                            floorTris=len(floor_tris), fungi=len(fungi), scale=SCALE, openLo=OPEN_LO, openHi=OPEN_HI))
    g["log"]("cave", len(V), "shell verts", len(shell_tris), "tris;", len(F), "floor verts;", len(fungi), "fungi;", len(blob), "bytes")


def _hemisphere(n):
    """n cosine-weighted directions about +z (a golden-angle spiral): x, y, z."""
    i = np.arange(n) + 0.5; r = np.sqrt(i / n); a = i * math.pi * (3 - math.sqrt(5))
    return np.stack([r * np.cos(a), r * np.sin(a), np.sqrt(1 - r * r)], -1)


def moss_share(V, N):
    """Per vertex 0..1: how much moss can grow there. A cap on each crown spilling MOSS_REACH m down the upper faces
    (owner cliffs-and-columns 1), never below MOSS_ABOVE m and never on an underside. "The crown" is the highest rock
    within MOSS_REACH m across (a 1 m grid of highest points, widened by a running maximum)."""
    x0, y0 = V[:, 0].min() - 1, V[:, 1].min() - 1
    ix = np.floor(V[:, 0] - x0).astype(int); iy = np.floor(V[:, 1] - y0).astype(int)
    G = np.full((iy.max() + 1, ix.max() + 1), -1e9); np.maximum.at(G, (iy, ix), V[:, 2])
    r = int(MOSS_REACH); H = G.copy()
    pad = np.pad(G, r, constant_values=-1e9)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r:
                H = np.maximum(H, pad[r + dy:r + dy + G.shape[0], r + dx:r + dx + G.shape[1]])
    depth = H[iy, ix] - V[:, 2]
    def sm(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
    return sm(MOSS_REACH, 1.0, depth) * sm(MOSS_ABOVE, MOSS_ABOVE + 4.0, V[:, 2]) * sm(-0.3, 0.2, N[:, 2])


def column_coords(V, N, T, rounds=40, squash=0.85):
    """Per vertex, where on the horizontal plane its basalt column stands (coast x, y). Columns run up the wall, but
    the wall's lumps and ribs move it in and out by metres as it rises, which would cut a column pattern laid on the
    horizontal plane into scales. So the in-and-out part of each point's offset from the smoothed surface (positions
    and normals averaged over a few metres: `rounds` passes over the mesh's neighbours) is squashed away; what is
    left moves only along the wall, and slowly with the smooth surface's own lean."""
    deg = np.zeros(len(V)); Pr = V.copy(); Sn = N.copy()
    for i, j, k in ((0, 1, 2), (1, 2, 0), (2, 0, 1)): np.add.at(deg, T[:, i], 2.0)
    for _ in range(rounds):
        ap, an = Pr.copy(), Sn.copy()
        for i, j, k in ((0, 1, 2), (1, 2, 0), (2, 0, 1)):
            np.add.at(ap, T[:, i], Pr[T[:, j]] + Pr[T[:, k]]); np.add.at(an, T[:, i], Sn[T[:, j]] + Sn[T[:, k]])
        Pr = ap / (1 + deg)[:, None]; Sn = an / np.maximum(np.linalg.norm(an, axis=1, keepdims=True), 1e-9)
    nu = Sn[:, :2] / np.maximum(np.linalg.norm(Sn[:, :2], axis=1, keepdims=True), 1e-6)
    out_ = ((V[:, :2] - Pr[:, :2]) * nu).sum(1)
    return V[:, :2] - squash * out_[:, None] * nu


def export_arch(g, folder):
    """arch.bin, in the headland's place pack: Int16 positions (coast axes around ARCH pos at sea level, 1/ARCH_SCALE
    m), Int16 column coordinates (coast x, y around ARCH pos, 1/ARCH_SCALE m: column_coords), one byte of sky light
    per vertex, one byte of moss per vertex (padded to 4 bytes), then the triangles (Uint16
    when the vertices fit, else Uint32: meta indexBytes). The light is the share of a cosine-weighted hemisphere about
    each point's normal that reaches open sky (a ray that leaves downward meets the sea: SEA_BOUNCE; one that meets
    the rock: nothing), so the inside of the opening, the undersides and the corners go dark. The moss: moss_share."""
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    ax, ay = g["ARCH"]["pos"]
    o = g["build_arch"](max_tris=ARCH_TRIS)
    me = o.data; me.calc_loop_triangles()
    nv = len(me.vertices)
    V = np.zeros(nv * 3); me.vertices.foreach_get("co", V); V = V.reshape(-1, 3)
    N = np.zeros(nv * 3); me.vertex_normals.foreach_get("vector", N); N = N.reshape(-1, 3)
    T = np.zeros(len(me.loop_triangles) * 3, np.int64); me.loop_triangles.foreach_get("vertices", T); T = T.reshape(-1, 3)
    bvh = BVHTree.FromPolygons([Vector(v) for v in V], [tuple(int(i) for i in t) for t in T])
    # a frame about each normal, and the hemisphere's rays in it
    h = _hemisphere(SKY_RAYS)
    helper = np.where(np.abs(N[:, 2:3]) < 0.9, np.array([[0.0, 0.0, 1.0]]), np.array([[1.0, 0.0, 0.0]]))
    t1 = np.cross(helper, N); t1 /= np.linalg.norm(t1, axis=1, keepdims=True); t2 = np.cross(N, t1)
    light = np.zeros(nv)
    for i in range(nv):
        D = h[:, :1] * t1[i] + h[:, 1:2] * t2[i] + h[:, 2:3] * N[i]
        p0 = Vector(V[i] + N[i] * 0.05); acc = 0.0
        for d in D:
            if bvh.ray_cast(p0, Vector(d), 500.0)[0] is None: acc += 1.0 if d[2] > 0 else SEA_BOUNCE
        light[i] = acc / SKY_RAYS
    moss = moss_share(V, N)
    col = column_coords(V, N, T) - np.array([ax, ay])
    local = V - np.array([ax, ay, 0.0])
    def u8(a): return np.round(np.clip(a, 0, 1) * 255).astype(np.uint8).tobytes()
    ib = 2 if nv <= 65536 else 4                                                 # Uint16 triangles when they fit
    blob = b"".join([np.round(local * ARCH_SCALE).astype("<i2").tobytes(), np.round(col * ARCH_SCALE).astype("<i2").tobytes(),
                     u8(light), u8(moss), b"\0" * (-(nv * 12) % 4),
                     T.astype(f"<u{ib}").tobytes()])
    pack = os.path.normpath(os.path.join(folder, HEADLAND)); os.makedirs(pack, exist_ok=True)
    with open(os.path.join(pack, "arch.bin"), "wb") as f: f.write(blob)
    _meta(folder, arch=dict(file="stops/headland/arch.bin", verts=nv, tris=len(T), indexBytes=ib, scale=ARCH_SCALE, x=ax, y=ay))
    g["log"]("arch", nv, "verts", len(T), "tris; light", round(float(light.min()), 2), "..", round(float(light.max()), 2), ";", len(blob), "bytes")


def run(g):
    folder = os.path.abspath(g["EXPORT"]); os.makedirs(folder, exist_ok=True)
    S = g["S"]; did = False
    if S.get("aurora") and S["aurora"].get("sky_bands"): export_aurora(g, folder); did = True
    if S.get("cave"): export_cave(g, folder); did = True
    if g["HOUR"] == "bluehour": export_arch(g, folder); did = True
    if not did: raise SystemExit(f"nothing to export for hour {g['HOUR']}")
