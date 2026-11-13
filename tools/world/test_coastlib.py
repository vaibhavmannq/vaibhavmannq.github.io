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
ss = [pc["s"] for pc in H]
assert ss == sorted(ss), ss
assert all(abs(s_of(*r[:2]) - pc["s"]) < 20 for pc in H for r in pc["rocks"])
L = [pc for pc in H if pc["kind"] == "remnant"]                  # landward of the arch, between it and the land
S = [pc for pc in H if pc["kind"] != "remnant"]                  # seaward of the arch: the falling sequence

# D3, the arch is never alone: a broad parent mass and a smaller piece beside it stand between the land and the arch.
# They are what is left of the land side: "falls seaward" runs from the arch out and does not apply to them.
assert len(L) == 2 and all(pc["s"] < -c.ARCH_LEG for pc in L) and H[:2] == L, [pc["kind"] for pc in H]
big, small = sorted((pc["rocks"][0] for pc in L), key=lambda r: -r[3])
assert 20.0 <= big[2] <= 28.0 and 50.0 <= big[3] <= 65.0 and big[3] > S[0]["rocks"][0][3], big
assert small[2] < big[2] and small[3] < big[3] and edge(L[0], L[1]) < 40.0, (small, big)
line_rocks = [r for pc in H for r in pc["rocks"]]
assert not [r for r in c.ROCKS if s_of(*r[:2]) < 0 and abs(o_of(*r[:2])) < 60 and r[3] > 5.0 and r not in line_rocks], "a tall stray rock landward of the arch"
assert not [r for r in c.ROCKS if s_of(*r[:2]) > 0 and abs(o_of(*r[:2])) < 80 and r[3] > 2.5 and r not in line_rocks], "rubble taller than the stumps"

# seaward the pieces run out from the arch: stacks, then stumps, then a reef
assert S[0]["s"] > c.ARCH_LEG
kinds = [pc["kind"] for pc in S]
assert kinds[-1] == "reef" and kinds.count("reef") == 1, kinds
n_st = sum(k in ("stack", "split") for k in kinds)
assert all(k in ("stack", "split") for k in kinds[:n_st]) and all(k == "stump" for k in kinds[n_st:-1]) and n_st < len(kinds) - 2, kinds

# the line wanders on a gentle curve, up to +-40 m across, not in a ruled row and not by jitter
first = [pc["rocks"][0] for pc in S]
assert all(abs(o_of(*r[:2]) - c.line_curve(s_of(*r[:2]))) <= 6.5 for r in first), [round(o_of(*r[:2]) - c.line_curve(s_of(*r[:2])), 1) for r in first]
os_ = [o_of(*r[:2]) for pc in S for r in pc["rocks"]]
assert max(abs(o) for o in os_) <= 40.0 and max(os_) - min(os_) >= 40.0, os_

# "stacks fall in height seaward": each <= 0.8x the one landward of it, +-15 % (the arch's top is the first)
hs = [r[3] for pc in S if pc["kind"] in ("stack", "split") for r in sorted(pc["rocks"], key=lambda r: s_of(*r[:2]))]
prev = c.ARCH_TOP
for h in hs:
    assert 0.8 * 0.85 <= h / prev <= 0.8 * 1.15, (h, prev, h / prev)
    prev = h
stumps = [pc["rocks"][0][3] for pc in S if pc["kind"] == "stump"]
assert all(h <= 4.0 for h in stumps) and stumps == sorted(stumps, reverse=True) and stumps[0] < 0.5 * hs[-1], stumps

# "no two gaps alike": the open water between neighbouring pieces, no two within 20 % of each other
gaps = [edge(S[i], S[i + 1]) for i in range(len(S) - 1)]
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

# every piece stands on a shelf: its own disc (reach + 4-8 m) and 3-8 fallen blocks at its foot; discs that would
# overlap are one shelf at one height (z -0.5..0.3), so no two shelves overlap
for pc in H:
    sx, sy, R = pc["disc"]; sz = c.SHELVES[pc["shelf"]]["z"]
    reach = max(math.hypot(x - sx, y - sy) + r for (x, y, r, h, l) in pc["rocks"])
    assert 4.0 <= R - reach <= 8.0 and -0.5 <= sz <= 0.3, (pc["kind"], R - reach, sz)
    assert pc["disc"] in c.SHELVES[pc["shelf"]]["discs"]
    assert 3 <= len(pc["blocks"]) <= 8, len(pc["blocks"])
    for (bx, by, br, bh) in pc["blocks"]:
        assert 0.4 <= br <= 2.5 and sz < bh <= sz + 3.5, (br, bh, sz)
        assert math.hypot(bx - sx, by - sy) + br <= R
        assert all(math.hypot(bx - x, by - y) >= 1.1 * r + br for (x, y, r, h, l) in line_rocks)
apart = lambda a, b: math.hypot(a[0] - b[0], a[1] - b[1]) >= a[2] + b[2]
for i, si in enumerate(c.SHELVES):
    for sj in c.SHELVES[i + 1:]:
        assert all(apart(a, b) for a in si["discs"] for b in sj["discs"]), "two shelves overlap"
    seen = [si["discs"][0]]                                           # one shelf is one connected platform
    for _ in si["discs"]:
        seen += [d for d in si["discs"] if d not in seen and any(not apart(d, e) for e in seen)]
    assert len(seen) == len(si["discs"])
assert sum(len(sh["discs"]) for sh in c.SHELVES) == len(H) and any(len(sh["discs"]) > 1 for sh in c.SHELVES)

# ---- the stacks' forms (M2.5 task 3c; owner cove-and-stacks 12): spires, wedges, a block, flared feet ----
# Measured on the outlines Blender builds from (stack_section), before its weathering; test_parts.py measures the mesh.
rk = c.stack_rocks()
assert [(k["x"], k["y"], k["r"], k["h"], k["lean"]) for k in rk] == [r for r in line_rocks]   # every rock, with its lean
forms = [k["form"] for k in rk]
assert forms.count("spire") >= 2 and forms.count("wedge") >= 1 and forms.count("block") == 1, forms
assert len({(k["form"], k["r"], k["h"]) for k in rk}) == len(rk), "two pieces alike"
spires = [k for k in rk if k["form"] == "spire"]
assert [k["h"] for k in spires] == sorted((k["h"] for k in spires), reverse=True), "spires get smaller out to sea"
def req(k, z): return c._req(c.stack_section(k, z))
def axis(k, z): return np.array([k["x"] + k["lean"] * k["h"] * (max(z, 0.0) / k["h"]) ** 2, k["y"]])
measured = []
for k in rk:
    if k["h"] < 8.0: continue                                     # the stumps and the reef are all foot
    foot = np.mean([req(k, z) for z in (1.5, 2.25, 3.0)]) / req(k, k["h"] / 2)
    assert 1.3 <= foot <= 1.6, (k["form"], k["h"], foot)            # a flared foot, a talus apron into the shelf
    assert req(k, 3.0) - req(k, 0.45) >= 0.5, (k["form"], k["h"])  # the notch is still cut in it
    if k["form"] == "spire":                                         # the top third narrows to <= 0.3 x its radius
        assert req(k, 0.75 * k["h"]) <= 0.3 * k["r"], (k["h"], req(k, 0.75 * k["h"]) / k["r"])
        # fix round 3c-1 (owner photo 12): a tilted blade, not a cone. A shoulder steps in on its back a third to a
        # half of the way down while its front edge runs on; the tip stands over the front, off its axis; the needle
        # is broken off at the top (a cut across a section, not a point)
        f = math.radians(k["face"]); fu = np.array([math.cos(f), math.sin(f)])
        ext = lambda z: (c.stack_section(k, z) - axis(k, z)) @ fu
        back = ext(0.7 * k["h"]).min() - ext(0.45 * k["h"]).min(); front = ext(0.7 * k["h"]).max() - ext(0.45 * k["h"]).max()
        assert back >= 0.4 * k["r"] and abs(front) <= 0.25 * k["r"], (k["h"], back / k["r"], front / k["r"])
        assert k["tip"] >= 0.3 * k["r"], (k["h"], k["tip"] / k["r"])
        cut = c.stack_section(k, k["h"] * 0.995); tops = c.stack_top(k, cut[:, 0], cut[:, 1])
        assert np.ptp(np.hypot(*(cut - cut.mean(0)).T)) > 0.0 and np.ptp(tops) >= 0.5, (k["h"], np.ptp(tops))
    if k["form"] == "wedge":                                         # one side slopes at 50-65 deg, the other is sheer
        f = math.radians(k["face"]); fu = np.array([math.cos(f), math.sin(f)])
        zs = np.linspace(0.35 * k["h"], 0.9 * k["h"], 12)
        hi = [((c.stack_section(k, z) - axis(k, z)) @ fu).max() for z in zs]
        lo = [((c.stack_section(k, z) - axis(k, z)) @ fu).min() for z in zs]
        slope = math.degrees(math.atan(1 / abs(np.polyfit(zs, hi, 1)[0])))
        sheer = math.degrees(math.atan(1 / max(abs(np.polyfit(zs, lo, 1)[0]), 1e-9)))
        assert 50.0 <= slope <= 65.0 and sheer >= 80.0, (k["h"], slope, sheer)
        measured.append(round(slope))
    if k["form"] == "block":                                         # a broad flat top, broken by a step
        f = math.radians(k["face"]); P = c.stack_section(k, k["h"] * 0.97, 400)
        cx, cy = P.mean(0); g = np.mgrid[-1:1:41j, -1:1:41j].reshape(2, -1).T * np.abs(P - [cx, cy]).max()
        X, Y = cx + g[:, 0], cy + g[:, 1]; top = c.stack_top(k, X, Y)
        A, B = P, np.roll(P, -1, 0); ins = np.zeros(len(X), bool)                 # inside the outline (even-odd)
        for (ax_, ay_), (bx_, by_) in zip(A, B):
            ins ^= ((ay_ > Y) != (by_ > Y)) & (X < ax_ + (Y - ay_) * (bx_ - ax_) / (by_ - ay_ + 1e-12))
        flat, low = (top[ins] > k["h"] - 0.05 * k["h"]).mean(), (top[ins] < k["h"] - 0.1 * k["h"]).mean()
        assert flat >= 0.5 and low >= 0.1, (flat, low)
assert all(c.stack_top(k, k["x"], k["y"]) <= k["h"] + 0.2 for k in rk if k["form"] in c.CUT_TOP)   # no cut top over the line's height

# the talus (fix round 3c-1): every foot >= 8 m is heaped with angular blocks, all on the piece's shelf disc
discs_of = [pc["disc"] for pc in H for _ in pc["rocks"]]
for k, d in zip(rk, discs_of):
    tl = c.stack_talus(k, d)
    if k["h"] < 8.0: assert tl == []; continue
    assert len(tl) >= 10, (k["form"], k["h"], len(tl))
    assert all(math.hypot(t[0] - d[0], t[1] - d[1]) + 0.6 * t[2][0] <= d[2] for t in tl)
    assert all(1.0 <= t[2][0] <= 7.0 and 0.0 < t[5] < c.FOOT_TOP + 12.0 for t in tl), [(t[2][0], t[5]) for t in tl]

# skerries (fix round 3c-1, owner photo 12): 6-12 groups of low angular rocks, 0.3-2 m above the sea, a few metres
# across, seaward of the arch at uneven distances from the line, off every shelf
sk = c.SKERRIES
groups = []
for t in sk:
    g = next((g for g in groups if math.hypot(t[0] - g[0][0], t[1] - g[0][1]) < 10.0), None)
    (g.append(t) if g else groups.append([t]))
assert 6 <= len(groups) <= 12, len(groups)
assert all(0.3 <= t[5] <= 2.0 for t in sk) and all(2.0 <= g[0][2][0] <= 6.0 for g in groups), [(t[2][0], t[5]) for t in sk]
assert all(s_of(*t[:2]) > c.ARCH_LEG for t in sk)
offs = [abs(o_of(*g[0][:2]) - c.line_curve(s_of(*g[0][:2]))) for g in groups]
assert min(offs) <= 25.0 and max(offs) >= 50.0, offs
assert all(math.hypot(t[0] - d[0], t[1] - d[1]) - d[2] - t[2][0] / 2 >= 0.5 for t in sk for d in discs_of)
assert all(float(c.ground_base(*g[0][:2])) < -0.2 for g in groups)

# Blender builds every piece; the data is seeded: a second load gives the same line
assert all(r in c.ROCKS for r in line_rocks)
assert len(c.ROCK_SEEDS) == len(c.ROCKS) and len(set(c.ROCK_SEEDS)) == len(c.ROCK_SEEDS)
assert coastlib.load().HEADLAND == H
print(f"ok headland: remnants {[r[3] for pc in L for r in pc['rocks']]}, {len(S)} pieces seaward, stacks {hs}, stumps {stumps}, "
      f"reef {reef[3]} m, gaps {[round(g, 1) for g in gaps]}, o {min(os_):.0f}..{max(os_):.0f} m, {len(c.SHELVES)} shelves, "
      f"{len(groups)} skerry groups ({len(sk)} rocks)")
