"""Run: python tools/world/test_reshape.py  (the reshaped ground leaves the nine views alone and gives the land form)."""
import os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import coastlib, views

c = coastlib.load(); rng = np.random.default_rng(3)
cams = views.cameras()
X, Y = rng.uniform(-7000, 6000, 20000), rng.uniform(-7000, 6000, 20000)
k = c.keep_at(X, Y); P = k == 1.0
assert np.array_equal(c.ground(X[P], Y[P]), c.ground_base(X[P], Y[P]))          # protected: bit-identical
assert P.sum() > 1000 and (~P).sum() > 5000, (P.sum(), (~P).sum())

same = lambda x, y: c.keep_at(x, y) == 1.0                                       # equal there by construction
changed = views.compare(c.ground_base, c.ground, cams, 96, same_where=same, near=views.NEAR)
background = views.compare(c.ground_base, c.ground, cams, 64, same_where=same)
print("background (beyond NEAR, for the owner to approve):", {n: round(v, 4) for n, v in background.items()})
print("changed share per view:", {n: round(v, 5) for n, v in changed.items()})
assert max(changed.values()) <= 0.001, changed                                   # the nine views unchanged

for name, d in views.light_dirs().items():                                       # no new shadows (Review Focus 2)
    if d is None:
        continue
    o, dr = views.ray_grid(cams[name], 64); t, kk = views.cast(c.ground_base, o, dr, cloud=views.cloud_planes().get(name))
    p = (o + dr * t[:, None])[((kk == views.SEA) | (kk == views.LAND)) & (t <= views.NEAR)]
    agree = views.shadowed(c.ground_base, p, d) == views.shadowed(c.ground, p, d)
    print(f"shadows agree {name}: {agree.mean():.4f}")
    assert agree.mean() >= 0.999, (name, agree.mean())

# The shadow strips in the keep mask stop where the light ray is 450 m up: no ground may reach 400 m.
assert c.ground(X, Y).max() <= 400.0, c.ground(X, Y).max()
# No inland sea (Review Focus 4): where the warped M0 ground is land, gullies never cut it below sea level. (The warp
# itself moves shores by up to WARP_AMP on purpose: a straight shore that wanders.)
f = 1.0 - k; wx, wy = c.reshape_warp(X, Y)
hbw, hn = c.ground_base(X + f * wx, Y + f * wy), c.ground(X, Y)
assert not ((hbw > 3) & (hn < 0)).any()

# Flat sheets gain form: unprotected land in the baked area that was flat (slope < 3°) mostly is not any more.
R = np.random.default_rng(5)
FX, FY = R.uniform(-2000, 1200, 40000), R.uniform(-2400, 1600, 40000)
m = (c.keep_at(FX, FY) == 0) & (c.ground_base(FX, FY) > 3); FX, FY = FX[m], FY[m]
def slope(g, e=4.0):
    gx = (g(FX + e, FY) - g(FX - e, FY)) / (2 * e); gy = (g(FX, FY + e) - g(FX, FY - e)) / (2 * e)
    return np.degrees(np.arctan(np.hypot(gx, gy)))
flat = slope(c.ground_base) < 3
gained = np.mean(slope(c.ground)[flat] > 3)
print(f"flat unprotected land points {flat.sum()}: {gained:.0%} now steeper than 3°")
assert flat.sum() >= 100 and gained >= 0.8

# The unprotected stretch of the western shore moves (how far and how wavy is tuned by eye, plan Task 9).
ys = np.arange(400, -2400, -4.0)
def shore(g, x):
    h = g(np.full_like(ys, x), ys)
    i = int(np.argmax(h >= 0))
    return ys[i] if h[i] >= 0 else np.nan
shift = []
for x in np.arange(-2000, -400 + 1, 16.0):
    yb = shore(c.ground_base, x)
    if np.isnan(yb) or c.keep_at(x, yb) > 0:
        continue
    yn = shore(c.ground, x)
    if not np.isnan(yn):
        shift.append(yn - yb)
print(f"western shore: {len(shift)} unprotected columns, mean |shift| {np.mean(np.abs(shift)):.1f} m, std {np.std(shift):.1f} m")
assert len(shift) >= 10 and np.mean(np.abs(shift)) >= 10
print("ok")
