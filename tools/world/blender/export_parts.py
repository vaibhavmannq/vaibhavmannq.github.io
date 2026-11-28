"""The site's baked parts, written from inside Blender by coast.py's own builders (run: npm run world:blender).

coast.py calls run(globals()) when started with `--export <folder>` and skips the scene and the render. What is
exported depends on the hour:

  an hour with an aurora   <folder>/aurora.json   each curtain's base line (the folds use Blender's own noise)
  the cave's hour          <folder>/cave.bin      the cave shell with its ragged mouth, the floor, the light that
                                                  reaches each point from the mouth, and the glowing fungi
  Golden (the cove's)      <folder>/../stops/cove/cliffs.bin the cliff columns at Golden and Sunrise (coast.py cliff_rocks)
                           <folder>/../stops/cove/grove.bin  the cove's trees and shrubs (coast.py grove_plants): each
                                                  Poly Haven model as simplified wood and leaf cards, and where each stands
  Blue hour (the arch's)   <folder>/../stops/headland/arch.bin   the lopsided sea arch and the blocks fallen
                                                  beneath it, with the share of the sky each point sees and its moss
                           <folder>/../stops/headland/stacks.bin the headland line: stacks, stumps, reef, shelves
                                                  and fallen blocks, laid out the same way

Each adds its key to <folder>/base.json. The file layouts are read by src/world/aurora.ts, src/world/cave.ts and
src/world/arch.ts (and src/world/stacks.ts) and checked without Blender by tools/world/test_parts.py.
"""
import json, math, os, sys
import numpy as np

AURORA_SAMPLES = 130          # quads along a curtain on the site (the render uses 260)
SCALE = 1000                  # cave.bin: Int16 units per metre
MOUTH_POINTS = 24
OPEN_LO, OPEN_HI = -2.0, 2.0  # the `open` field is stored over this range
HOLE = 0.45                   # triangles with all three corners more open than this are inside the hole: not exported
ARCH_SCALE = 100              # arch.bin: Int16 units per metre (the arch reaches ~60 m from its origin)
SKY_RAYS = 48                 # rays per point for the arch's sky light
ARCH_TRIS = 60_000            # the site's arch (ruling R15: it lives in the headland pack, under the 5 MB per-place (D30)
                              # budget); enough for the stepped crowns; the column joints are drawn per pixel
STACKS_SCALE = 100            # stacks.bin: Int16 units per metre (the line reaches ~300 m from its middle)
STACKS_TRIS = 96_000          # the stacks part (brief: <= 150 k, aim <= 100 k; the place budget is 3 MB)
HEADLAND = os.path.join("..", "stops", "headland")   # the headland's place pack, beside base/ (src/world/headland.ts)
COVE = os.path.join("..", "stops", "cove")           # the cove's place pack (src/world/cove.ts): cliffs.bin, grove.bin
CLIFF_SCALE = 100             # cliffs.bin: Int16 units per metre (the columns reach ~70 m from their middle)
CLIFF_TRIS = 68_000           # the cliff columns (plan M3 Task 2; s26: 55 with the terrace and the aprons; s36: +14 on the left wall; the cove pack has 3.1 MB beside the headland's 1.9)
GROVE_SCALE = 4000            # grove.bin: Int16 units per metre in a model's own frame (models reach ~5 m from their root)
WOOD_TRIS = {"island_tree_01": 6000,  # s33: the framing tree's trunk read faceted at 9 m (Task 16d E)
             "island_tree_02": 2500, "island_tree_03": 2500, "searsia_burchellii": 0}
                              # (the shrub's stems are thousands of loose twigs that do not simplify, and its leaves hide them)
CARDS = {"island_tree_01": 500, "island_tree_02": 500, "island_tree_03": 500, "searsia_burchellii": 600}
MOSS_REACH = 8.0              # moss can spill this far down from the highest rock nearby; the shader's patches
                              # thin it out, so it shows 3-6 m down (owner cliffs-and-columns 1)
MOSS_ABOVE = 8.0              # and never lower than this: no moss in the spray
SEA_BOUNCE = 0.3              # what a ray that leaves downward brings back from the sea and the flats (they mirror the sky dimly)


def canonical_tris(T):
    """Triangles in one fixed order: each starts at its smallest corner (the winding kept), then rows sorted. Blender
    hands out an evaluated mesh's loop triangles in a different order on every run (cave.bin churned, s12); this makes a
    re-export with no change byte-identical."""
    T = np.asarray(T, np.int64).reshape(-1, 3)
    k = np.argmin(T, axis=1)
    R = np.stack([T[np.arange(len(T)), (k + i) % 3] for i in range(3)], axis=1)
    return R[np.lexsort((R[:, 2], R[:, 1], R[:, 0]))]


def _meta(folder, **keys):
    path = os.path.join(folder, "base.json")
    meta = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    meta.update(keys)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(meta, f, indent=1); f.write("\n")


def export_aurora(g, folder):
    S, hour = g["S"], g["HOUR"]
    cfg = S["aurora"]; yaw = S.get("aurora_yaw", S["look"][0])   # M5: Night's baked curves keep the old view's yaw
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
    shell_tris = canonical_tris(T[~np.all(tri_open > HOLE, axis=1)])
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


def _rock_bin(o, ox, oy, scale, occluders=None):
    """A rock part's file (arch.bin, stacks.bin): Int16 positions (coast axes around (ox, oy) at sea level, 1/scale m),
    Int16 column coordinates (coast x, y around (ox, oy), 1/scale m: column_coords), one byte of sky light per vertex,
    one byte of moss per vertex (padded to 4 bytes), then the triangles (Uint16 when the vertices fit, else Uint32:
    meta indexBytes). The light is the share of a cosine-weighted hemisphere about each point's normal that reaches
    open sky (a ray that leaves downward meets the sea: SEA_BOUNCE; one that meets the rock: nothing), so openings,
    undersides and corners go dark; `occluders` (vertices, triangles) also block rays (the ground behind a cliff). The
    moss: moss_share. Returns the bytes, the meta's counts and the light."""
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    me = o.data; me.calc_loop_triangles()
    nv = len(me.vertices)
    V = np.zeros(nv * 3); me.vertices.foreach_get("co", V); V = V.reshape(-1, 3)
    N = np.zeros(nv * 3); me.vertex_normals.foreach_get("vector", N); N = N.reshape(-1, 3)
    T = np.zeros(len(me.loop_triangles) * 3, np.int64); me.loop_triangles.foreach_get("vertices", T); T = T.reshape(-1, 3)
    BV, BT = V, T
    if occluders is not None:
        BV = np.concatenate([V, occluders[0]]); BT = np.concatenate([T, np.asarray(occluders[1]) + len(V)])
    bvh = BVHTree.FromPolygons([Vector(v) for v in BV], [tuple(int(i) for i in t) for t in BT])
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
    col = column_coords(V, N, T) - np.array([ox, oy])
    local = V - np.array([ox, oy, 0.0])
    assert np.abs(local[:, :2]).max() * scale < 32767 and np.abs(col).max() * scale < 32767, "the part outgrows Int16"
    def u8(a): return np.round(np.clip(a, 0, 1) * 255).astype(np.uint8).tobytes()
    ib = 2 if nv <= 65536 else 4                                                 # Uint16 triangles when they fit
    blob = b"".join([np.round(local * scale).astype("<i2").tobytes(), np.round(col * scale).astype("<i2").tobytes(),
                     u8(light), u8(moss), b"\0" * (-(nv * 12) % 4),
                     T.astype(f"<u{ib}").tobytes()])
    return blob, dict(verts=nv, tris=len(T), indexBytes=ib), light


def _write_pack(folder, name, blob, where=HEADLAND):
    pack = os.path.normpath(os.path.join(folder, where)); os.makedirs(pack, exist_ok=True)
    with open(os.path.join(pack, name), "wb") as f: f.write(blob)


def export_arch(g, folder):
    """arch.bin, in the headland's place pack (_rock_bin around ARCH pos)."""
    ax, ay = g["ARCH"]["pos"]
    o = g["build_arch"](max_tris=ARCH_TRIS)
    blob, counts, light = _rock_bin(o, ax, ay, ARCH_SCALE)
    _write_pack(folder, "arch.bin", blob)
    _meta(folder, arch=dict(file="stops/headland/arch.bin", **counts, scale=ARCH_SCALE, x=ax, y=ay))
    g["log"]("arch", counts["verts"], "verts", counts["tris"], "tris; light", round(float(light.min()), 2), "..", round(float(light.max()), 2), ";", len(blob), "bytes")


def export_stacks(g, folder):
    """stacks.bin, in the headland's place pack (_rock_bin around the middle of the line): the headland's stacks,
    remnants, stumps and reef, their wave-cut shelves and fallen blocks, one mesh (coast.py build_stacks)."""
    o = g["build_stacks"](max_tris=STACKS_TRIS)
    V = np.array([tuple(v.co) for v in o.data.vertices])
    ox, oy = (round(float(V[:, 0].min() + V[:, 0].max()) / 2, 1), round(float(V[:, 1].min() + V[:, 1].max()) / 2, 1))
    blob, counts, light = _rock_bin(o, ox, oy, STACKS_SCALE)
    _write_pack(folder, "stacks.bin", blob)
    _meta(folder, stacks=dict(file="stops/headland/stacks.bin", **counts, scale=STACKS_SCALE, x=ox, y=oy))
    g["log"]("stacks", counts["verts"], "verts", counts["tris"], "tris; light", round(float(light.min()), 2), "..", round(float(light.max()), 2), ";", len(blob), "bytes")


def _ground_patch(g, V, pad=30.0, step=2.0):
    """The ground formula on a grid around vertices V (coast axes): vertices and triangles, to block the cliffs' sky
    rays on their landward side."""
    x0, y0 = V[:, 0].min() - pad, V[:, 1].min() - pad
    xs = np.arange(x0, V[:, 0].max() + pad, step); ys = np.arange(y0, V[:, 1].max() + pad, step)
    X, Y = np.meshgrid(xs, ys); Z = np.asarray(g["ground"](X, Y), float)
    ny, nx = X.shape
    i = np.arange(ny - 1)[:, None] * nx; j = np.arange(nx - 1)[None, :]
    a = (i + j).ravel()
    T = np.concatenate([np.stack([a, a + 1, a + nx + 1], 1), np.stack([a, a + nx + 1, a + nx], 1)])
    return np.stack([X, Y, Z], -1).reshape(-1, 3), T


CLIFF_CLEAR = 2.5            # a column whose top stands less than this above the live ground at its centre ...
CLIFF_SINK = 0.5             # ... is lowered to this far under it: from the land it would show as a moss blob in the turf


def live_ground(base_dir):
    """The site's baked height grid (heights.bin, base.json `heights`): a bilinear sampler in coast x, y."""
    meta = json.load(open(os.path.join(base_dir, "base.json"), encoding="utf-8"))["heights"]
    q = np.fromfile(os.path.join(base_dir, "heights.bin"), "<u2").reshape(meta["ny"], meta["nx"])
    H = meta["lo"] + q * (meta["hi"] - meta["lo"]) / 65535
    def at(x, y):
        fx = (x - meta["x0"]) / meta["step"]; fy = (y - meta["y0"]) / meta["step"]; i = int(fx); j = int(fy); u = fx - i; v = fy - j
        return float((H[j, i] * (1 - u) + H[j, i + 1] * u) * (1 - v) + (H[j + 1, i] * (1 - u) + H[j + 1, i + 1] * u) * v)
    return at


def cliff_columns(shots, ground_at):
    """The cove's cliff columns (coast.py cliff_rocks at Golden, then Sunrise) as the site builds them: (hour, k, x, y,
    r, h, lean), with h lowered where the column's top would barely clear the live ground (CLIFF_CLEAR; s14: the
    right headland's columns stand as its face with the land behind them, and the 8 m grid's turf rises to within
    1-2 m of their tops)."""
    out = []
    for hour in ("golden", "sunrise"):
        for k, (x, y, r, h, lean) in enumerate(shots[hour]["cliff_rocks"]):
            gc = ground_at(x, y)
            if h - gc < CLIFF_CLEAR: h = gc - CLIFF_SINK
            out.append((hour, k, x, y, r, h, lean))
    return out


def export_cliffs(g, folder):
    """cliffs.bin, in the cove's place pack (_rock_bin around the columns' middle): coast.py cliff_rocks at Golden and
    at Sunrise, each built by rock_column with the seeds the renders use, subdivided once, joined and decimated."""
    bpy = g["bpy"]
    objs = []
    for hour, k, x, y, r, h, lean in cliff_columns(g["SHOTS"], live_ground(folder)):
        o = g["rock_column"](f"{hour}_crock{k}", x, y, r, h, lean, 700 + k)
        o.modifiers["s"].levels = 1                         # the renders' subdivision (export evaluates viewport levels)
        g["_apply_modifiers"](o); objs.append(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join(); o = objs[0]; o.name = "cliffs"
    ntri = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if ntri > CLIFF_TRIS:
        dm = o.modifiers.new("dec", "DECIMATE"); dm.ratio = CLIFF_TRIS / ntri * 0.98; g["_apply_modifiers"](o)
    for p_ in o.data.polygons: p_.use_smooth = True
    V = np.array([tuple(v.co) for v in o.data.vertices])
    ox, oy = (round(float(V[:, 0].min() + V[:, 0].max()) / 2, 1), round(float(V[:, 1].min() + V[:, 1].max()) / 2, 1))
    blob, counts, light = _rock_bin(o, ox, oy, CLIFF_SCALE, occluders=_ground_patch(g, V))
    _write_pack(folder, "cliffs.bin", blob, COVE)
    _meta(folder, cliffs=dict(file="stops/cove/cliffs.bin", **counts, scale=CLIFF_SCALE, x=ox, y=oy))
    g["log"]("cliffs", counts["verts"], "verts", counts["tris"], "tris; light", round(float(light.min()), 2), "..", round(float(light.max()), 2), ";", len(blob), "bytes")


def _model_parts(g, kind):
    """A Poly Haven model's polygons by role, in the model's own frame (coast axes, z up, metres): wood (vertices,
    triangles) and leaves (centres, normals, which crown). Island trees: the trunk material is wood, the leaves
    material the leaves (their fine branches are left out: the cards cover them). Searsia: three shrubs side by side,
    one crown each."""
    col = g["model_collection"](kind)
    wv, wt, lp, ln, lc = [], [], [], [], []
    nw = 0
    meshes = sorted([o for o in col.objects if o.type == "MESH"], key=lambda o: o.name)
    for ci, o in enumerate(meshes):
        me = o.data; M = np.array(o.matrix_world); R = M[:3, :3]
        nv = len(me.vertices); V = np.zeros(nv * 3); me.vertices.foreach_get("co", V); V = V.reshape(-1, 3) @ R.T + M[:3, 3]
        names = [m.name if m else "" for m in me.materials]
        mi = np.zeros(len(me.polygons), np.int64); me.polygons.foreach_get("material_index", mi)
        role = np.array(["leaf" if n.endswith("_leaves") else "skip" if n.endswith(("_branches", "_twigs")) else "wood"
                         for n in names])[mi]
        me.calc_loop_triangles()
        T = np.zeros(len(me.loop_triangles) * 3, np.int64); me.loop_triangles.foreach_get("vertices", T); T = T.reshape(-1, 3)
        tp = np.zeros(len(me.loop_triangles), np.int64); me.loop_triangles.foreach_get("polygon_index", tp)
        wood = T[role[tp] == "wood"]
        used = np.unique(wood); remap = np.full(nv, -1); remap[used] = np.arange(len(used))
        wv.append(V[used]); wt.append(remap[wood] + nw); nw += len(used)
        C = np.zeros(len(me.polygons) * 3); me.polygons.foreach_get("center", C); C = C.reshape(-1, 3) @ R.T + M[:3, 3]
        Nn = np.zeros(len(me.polygons) * 3); me.polygons.foreach_get("normal", Nn); Nn = Nn.reshape(-1, 3) @ R.T
        leaf = role == "leaf"
        lp.append(C[leaf]); ln.append(Nn[leaf]); lc.append(np.full(int(leaf.sum()), ci))
    return np.concatenate(wv), np.concatenate(wt), np.concatenate(lp), np.concatenate(ln), np.concatenate(lc)


def _decimated(g, V, T, target, name):
    """Vertices, vertex normals and triangles of (V, T) decimated to about `target` triangles (canonical order)."""
    bpy = g["bpy"]
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in V], [], [tuple(int(i) for i in t) for t in T]); me.update()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    if len(T) > target:
        dm = o.modifiers.new("dec", "DECIMATE"); dm.ratio = target / len(T) * 0.97; dm.use_collapse_triangulate = True
        g["_apply_modifiers"](o)
    for p_ in o.data.polygons: p_.use_smooth = True
    o.data.update(); o.data.calc_loop_triangles()
    P, N = g["_mesh_arrays"](o)
    T2 = np.zeros(len(o.data.loop_triangles) * 3, np.int64); o.data.loop_triangles.foreach_get("vertices", T2)
    used = np.unique(T2); remap = np.full(len(P), -1); remap[used] = np.arange(len(used))
    return P[used], N[used], canonical_tris(remap[T2])


def export_grove(g, folder):
    """grove.bin, in the cove's place pack (layout: src/world/grove.ts decodeGrove):
      instances  Float32 x 10 each: model (index in GROVE_KINDS), x, y, z (coast axes), scale x, y, z, turn x, y, z
                 (radians, Blender XYZ) - coast.py grove_plants, as the renders place them;
      then per model (GROVE_KINDS order): its wood as Int16 positions (model frame, 1/GROVE_SCALE m), normals as
      4 bytes (x, y, z as (n + 1) * 127.5, 0), padded to 4, Uint16 triangles, padded to 4; its leaf cards as four
      corners each, Int16 positions, then 4 bytes per corner: the bent normal (as the wood's) and the card's depth in
      its crown (0 its centre, 255 its edge). foliage.py leaf_cards makes the cards and bends their normals."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from foliage import leaf_cards
    plants = g["grove_plants"](); kinds = list(g["GROVE_KINDS"])
    inst = np.array([[kinds.index(p["kind"]), p["x"], p["y"], p["z"], *p["scale"], *p["rot"]] for p in plants], "<f4")
    def u8n(n): return np.round((np.asarray(n) + 1) * 127.5).clip(0, 255).astype(np.uint8)
    def i16(a):
        a = np.round(np.asarray(a) * GROVE_SCALE); assert a.size == 0 or np.abs(a).max() < 32767, "a model outgrows Int16"
        return a.astype("<i2").tobytes()
    def pad4(b): return b + b"\0" * (-len(b) % 4)
    blob = inst.tobytes(); protos = []
    for ki, kind in enumerate(kinds):
        V, T, LP, LN, LC = _model_parts(g, kind)
        if WOOD_TRIS[kind]: P, N, T2 = _decimated(g, V, T, WOOD_TRIS[kind], f"wood_{kind}")
        else: P, N, T2 = np.zeros((0, 3)), np.zeros((0, 3)), np.zeros((0, 3), np.int64)
        step = max(1, len(LP) // 400_000)                                      # plenty of leaves to find the cells
        corners, bent, own, cen, depth = leaf_cards(LP[::step], LN[::step], CARDS[kind], 900 + ki, LC[::step])
        wood = pad4(i16(P)) + np.concatenate([u8n(N), np.zeros((len(N), 1), np.uint8)], 1).tobytes() + pad4(T2.astype("<u2").tobytes())
        assert len(P) <= 65535, (kind, len(V), len(T), len(P), len(T2))
        cb = np.concatenate([np.repeat(u8n(bent)[:, None, :], 4, 1),
                             np.repeat(np.round(depth * 255).astype(np.uint8)[:, None, None], 4, 1)], 2)
        blob += wood + i16(corners.reshape(-1, 3)) + cb.tobytes()
        protos.append(dict(kind=kind, woodVerts=len(P), woodTris=len(T2), cards=len(corners)))
        g["log"]("grove model", kind, "wood", len(T), "->", len(T2), "tris; leaves", len(LP), "->", len(corners), "cards")
    _write_pack(folder, "grove.bin", blob, COVE)
    _meta(folder, grove=dict(file="stops/cove/grove.bin", scale=GROVE_SCALE, instances=len(inst), protos=protos))
    g["log"]("grove", len(inst), "plants;", len(blob), "bytes")


def export_cove(g, folder):
    """The cove's place pack (plan M3 Task 2): the cliff columns and the grove."""
    export_cliffs(g, folder); export_grove(g, folder)


def run(g):
    folder = os.path.abspath(g["EXPORT"]); os.makedirs(folder, exist_ok=True)
    S = g["S"]; did = False
    if S.get("aurora") and S["aurora"].get("sky_bands"): export_aurora(g, folder); did = True
    if S.get("cave"): export_cave(g, folder); did = True
    only = g.get("ONLY", "")                     # --only <part>: one part, while its shape is being worked on
    if only:
        parts = {"arch": export_arch, "stacks": export_stacks, "cove": export_cove}
        if only not in parts: raise SystemExit(f"--only {only!r}: no such part (use one of {', '.join(parts)})")
        parts[only](g, folder); return
    if g["HOUR"] == "bluehour": export_arch(g, folder); export_stacks(g, folder); did = True
    if g["HOUR"] == "golden": export_cove(g, folder); did = True
    if not did: raise SystemExit(f"nothing to export for hour {g['HOUR']}")
