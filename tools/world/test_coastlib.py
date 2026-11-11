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
