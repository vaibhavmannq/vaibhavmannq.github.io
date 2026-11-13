"""Run: python tools/world/test_coastlib.py  (coast.py, loaded without Blender, still gives the approved world)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import coastlib

REF = [(9.5, -4, 0.2951), (25, 141, 14.3584), (0, 0, 0.0568), (-30, 20, -1.6278), (40, 10, 29.4392), (22, 50, 10.9960),
       (12.93, 140.37, 14.5937), (-1171.4, 1218.9, -0.2682), (-1000, 1150, -0.2409), (100, -100, 31.1109),
       (-60, -205, 34.8994), (600, -950, 283.5296), (300, 300, 1.0220), (-20, 60, -6.9053)]
HOURS = {"golden", "sunset", "dusk", "bluehour", "night", "midnight", "beforedawn", "firstlight", "sunrise"}

c = coastlib.load()
ok = 0
for x, y, z in REF:
    if float(c.keep_at(x, y)) < 1.0:
        print(f"({x}, {y}) is outside the camera views: the world pass may reshape it; ground_base keeps the M0 value")
        continue
    g = float(c.ground(x, y))
    assert abs(g - z) < 2e-4, (x, y, g, z)
    ok += 1
assert HOURS <= set(c.SHOTS), HOURS - set(c.SHOTS)
for x, y, z in REF:
    assert abs(float(c.ground_base(x, y)) - z) < 2e-4, ("ground_base", x, y)
print(f"ok {ok}/{len(REF)} unchanged in the views, {len(REF)}/{len(REF)} in ground_base")

# ---- the old headland line (M2.5 task 3; reference-landforms §2, owner cove-and-stacks 12, cliffs-and-columns 1, 5) ----
import math
import numpy as np
H = c.HEADLAND
(ox, oy), u, p = c.ARCH["pos"], c.LINE_U, c.LINE_P
s_of = lambda x, y: (x - ox) * u[0] + (y - oy) * u[1]
o_of = lambda x, y: (x - ox) * p[0] + (y - oy) * p[1]
def edge(a, b): return min(math.hypot(ra[0] - rb[0], ra[1] - rb[1]) - ra[2] - rb[2] for ra in a["rocks"] for rb in b["rocks"])

# the pieces run seaward from the arch, which stays the land-most and tallest: stacks, then stumps, then a reef
ss = [pc["s"] for pc in H]
assert ss == sorted(ss) and ss[0] > 56.0, ss
kinds = [pc["kind"] for pc in H]
assert kinds[-1] == "reef" and kinds.count("reef") == 1, kinds
n_st = sum(k in ("stack", "split") for k in kinds)
assert all(k in ("stack", "split") for k in kinds[:n_st]) and all(k == "stump" for k in kinds[n_st:-1]) and n_st < len(kinds) - 2, kinds
assert all(abs(s_of(*r[:2]) - pc["s"]) < 20 for pc in H for r in pc["rocks"])
assert not [r for r in c.ROCKS if s_of(*r[:2]) < 0 and abs(o_of(*r[:2])) < 60 and r[3] > 5.0], "a tall rock landward of the arch"
assert not [r for r in c.ROCKS if s_of(*r[:2]) > 0 and abs(o_of(*r[:2])) < 80 and r[3] > 2.5 and not any(r in pc["rocks"] for pc in H)], "rubble taller than the stumps"

# "stacks fall in height seaward": each <= 0.8x the one landward of it, +-15 % (the arch's top is the first)
hs = [r[3] for pc in H if pc["kind"] in ("stack", "split") for r in sorted(pc["rocks"], key=lambda r: s_of(*r[:2]))]
prev = c.ARCH_TOP
for h in hs:
    assert 0.8 * 0.85 <= h / prev <= 0.8 * 1.15, (h, prev, h / prev)
    prev = h
stumps = [pc["rocks"][0][3] for pc in H if pc["kind"] == "stump"]
assert all(h <= 4.0 for h in stumps) and stumps == sorted(stumps, reverse=True) and stumps[0] < 0.5 * hs[-1], stumps

# "no two gaps alike": the open water between neighbouring pieces, no two within 20 % of each other
gaps = [edge(H[i], H[i + 1]) for i in range(len(H) - 1)]
assert min(gaps) > 5.0, gaps
for i in range(len(gaps)):
    for j in range(i + 1, len(gaps)):
        assert max(gaps[i], gaps[j]) / min(gaps[i], gaps[j]) >= 1.2, (i, j, gaps)

# two leaning (<= 0.12), the rest near upright; one stack split in two on one shelf, a narrow gap between the halves
leans = [abs(r[4]) for pc in H for r in pc["rocks"]]
assert sum(0.05 <= l <= 0.12 for l in leans) == 2 and sum(l > 0.03 for l in leans) == 2, leans
split = [pc for pc in H if len(pc["rocks"]) > 1]
assert len(split) == 1 and split[0]["kind"] == "split" and len(split[0]["rocks"]) == 2, kinds
a_, b_ = split[0]["rocks"]
assert 0.5 <= math.hypot(a_[0] - b_[0], a_[1] - b_[1]) - a_[2] - b_[2] <= 3.0

# "the reef breaks the surface": 0.2-0.8 m above the sea, at sea
reef = H[-1]["rocks"][0]
assert len(H[-1]["rocks"]) == 1 and 0.2 <= reef[3] <= 0.8, reef
assert float(c.ground_base(reef[0], reef[1])) < 0.0

# "every stack has a notch": on rock_column's profile (a height field cannot hold one; ruling R11/R13). The rock at
# z 0.4 stands back more than 0.5 m behind the face at z 3; the notch is 0.6-1.5 m deep with its deepest point in
# z -0.3..+1.2, and the mesh rings are dense enough there to carry it.
zs = np.linspace(-2.0, 4.0, 601)
for pc in H:
    for (x, y, r, h, lean) in pc["rocks"]:
        base = min(float(c.ground_base(x, y)), 0.0) - 3.0
        zz = zs[zs <= h]
        depth = np.array([r * c.rock_prof(z, h, (z - base) / (h - base)) - c.rock_radius(z, r, h, base) for z in zz])
        assert 0.6 <= depth.max() <= 1.5 and -0.3 <= zz[depth.argmax()] <= 1.2, (pc["kind"], r, h, depth.max(), zz[depth.argmax()])
        if h > 3.5:
            assert c.rock_radius(0.4, r, h, base) < c.rock_radius(3.0, r, h, base) - 0.5, (r, h)
        rings = np.array(c.rock_rings(base, h))
        band = rings[(rings >= -0.6) & (rings <= min(h, 1.5))]
        assert len(band) >= 4 and np.diff(band).max() <= 0.2, (r, h, band)

# every piece stands on a shelf (radius + 4-8 m, z -0.5..0.3) with 3-8 fallen blocks at its foot
for pc in H:
    sx, sy, R, sz = pc["shelf"]
    reach = max(math.hypot(x - sx, y - sy) + r for (x, y, r, h, l) in pc["rocks"])
    assert 4.0 <= R - reach <= 8.0 and -0.5 <= sz <= 0.3, (pc["kind"], R - reach, sz)
    assert 3 <= len(pc["blocks"]) <= 8, len(pc["blocks"])
    for (bx, by, br, bh) in pc["blocks"]:
        assert 0.4 <= br <= 2.5 and sz < bh <= sz + 3.5, (br, bh, sz)
        assert math.hypot(bx - sx, by - sy) + br <= R
        assert all(math.hypot(bx - x, by - y) >= 1.1 * r + br for q in H for (x, y, r, h, l) in q["rocks"])

# Blender builds every piece; the data is seeded: a second load gives the same line
assert all(r in c.ROCKS for pc in H for r in pc["rocks"])
assert len(c.ROCK_SEEDS) == len(c.ROCKS) and len(set(c.ROCK_SEEDS)) == len(c.ROCK_SEEDS)
assert coastlib.load().HEADLAND == H
print(f"ok headland: {len(H)} pieces, stacks {hs}, stumps {stumps}, reef {reef[3]} m, gaps {[round(g, 1) for g in gaps]}")
