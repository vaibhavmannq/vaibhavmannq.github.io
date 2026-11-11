"""The site's baked parts, written from inside Blender by coast.py's own builders (run: npm run world:blender).

coast.py calls run(globals()) when started with `--export <folder>` and skips the scene and the render. What is
exported depends on the hour:

  an hour with an aurora   <folder>/aurora.json   each curtain's base line (the folds use Blender's own noise)
  the cave's hour          <folder>/cave.bin      the cave shell with its ragged mouth, the floor, the light that
                                                  reaches each point from the mouth, and the glowing fungi

Both add their key to <folder>/base.json. The file layouts are read by src/world/aurora.ts and src/world/cave.ts and
checked without Blender by tools/world/test_parts.py.
"""
import json, math, os
import numpy as np

AURORA_SAMPLES = 130          # quads along a curtain on the site (the render uses 260)
SCALE = 1000                  # cave.bin: Int16 units per metre
MOUTH_POINTS = 24
OPEN_LO, OPEN_HI = -2.0, 2.0  # the `open` field is stored over this range
HOLE = 0.45                   # triangles with all three corners more open than this are inside the hole: not exported


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


def run(g):
    folder = os.path.abspath(g["EXPORT"]); os.makedirs(folder, exist_ok=True)
    S = g["S"]; did = False
    if S.get("aurora") and S["aurora"].get("sky_bands"): export_aurora(g, folder); did = True
    if S.get("cave"): export_cave(g, folder); did = True
    if not did: raise SystemExit(f"nothing to export for hour {g['HOUR']}")
