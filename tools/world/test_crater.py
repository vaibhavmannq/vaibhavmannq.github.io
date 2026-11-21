"""Run: python tools/world/test_crater.py  (M8.5 #8: Night's crater meets the bowl of columns; no moat, no can)."""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import coastlib

w = coastlib.load("night")
lx, ly = w.LAG
fails = []
for az in np.arange(0.0, 360.0, 2.0):
    a = np.radians(az); R = float(w.bowl_wall_radius(az)); H = float(w.bowl_wall_height(az))
    at = lambda r: float(w.ground_base(lx + np.sin(a) * r, ly + np.cos(a) * r))
    behind = at(R + 4.2 + 1.0 + 7.0 * float(w._bowl_bump(az, 0.0, 14.0)) + 8.5)
    if not (H - 5.0 <= behind <= H - 0.3):
        fails.append(f"az {az:.0f}: ground behind the back row {behind:.1f} m, the columns' rim {H:.1f} m")
    if at(R - 3.0) > 0.5:
        fails.append(f"az {az:.0f}: land inside the lagoon ({at(R - 3.0):.1f} m)")
# the stop's eye still stands on the water
cam = w.SHOTS["night"]["cam"]
assert abs(float(w.ground_base(cam[0], cam[1])) - 0.0) < 4.0
for f_ in fails[:10]: print("FAIL", f_)
print("ok" if not fails else f"{len(fails)} failed"); sys.exit(1 if fails else 0)
