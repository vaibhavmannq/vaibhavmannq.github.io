"""Export the nine hours' shot settings from coast.py to src/journey/shots.json (run: python tools/world/export_hours.py).

One entry per stop with the camera, the resolved sun and sky orientation, the sky recolouring, exposure, fog, water calm
and the night layers. `ground` is coast.py's ground() under the camera (the cave floor for Before dawn); `eyeZ` adds the
eye height. The sun's elevation is resolved the way coast.py's build_sky() does: the photo sun's height minus the tilt.
"""
import json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import coastlib

HOURS = ["golden", "sunset", "dusk", "bluehour", "night", "midnight", "beforedawn", "firstlight", "sunrise"]

# One world state per place (M2.5 task 2; reference book §1 the clock of the night, §2 wind; owner-references §10, A2).
# sunEl, moonEl: degrees above the horizon (the moon exists exactly when moonEl is not None); moonPhase 0 new .. 0.5 full;
# windAz: where the wind blows FROM, degrees, 0 north, 90 east (coast axes: x east, y north); beaufort: force 0..4.
# windAz is the azimuth of the open water as seen from the stop's camera, found by sampling coast.py's ground() on 14
# distances (60..2400 m) along every 5 degrees, smoothing over +-20 degrees and taking the most water ("wind from the sea").
WORLD = {
    "golden":     dict(sunEl=4,   moonEl=None, moonPhase=0.12, windAz=340, beaufort=1),
    "sunset":     dict(sunEl=0,   moonEl=None, moonPhase=0.12, windAz=345, beaufort=2),
    "dusk":       dict(sunEl=-3,  moonEl=None, moonPhase=0.12, windAz=305, beaufort=1),
    "bluehour":   dict(sunEl=-6,  moonEl=None, moonPhase=0.12, windAz=35,  beaufort=0),
    "night":      dict(sunEl=-30, moonEl=8,    moonPhase=0.12, windAz=5,   beaufort=0),
    "midnight":   dict(sunEl=-30, moonEl=14,   moonPhase=0.12, windAz=330, beaufort=2),
    "beforedawn": dict(sunEl=-10, moonEl=None, moonPhase=0.12, windAz=355, beaufort=1),
    "firstlight": dict(sunEl=-4,  moonEl=None, moonPhase=0.12, windAz=0,   beaufort=0),
    "sunrise":    dict(sunEl=1,   moonEl=None, moonPhase=0.12, windAz=330, beaufort=1),
}
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "src", "journey", "shots.json"))


def plain(v):
    if isinstance(v, (tuple, list)):
        return [plain(x) for x in v]
    if isinstance(v, dict):
        return {k: plain(x) for k, x in v.items()}
    if hasattr(v, "item"):
        return v.item()
    return v


def export(hour):
    c = coastlib.load(hour)
    S = c.S
    x, y, eye = S["cam"]
    g = float(c.ground(x, y))
    el_h, phi_h = S["hsun"]
    sun_el = el_h - S.get("tilt", 0.0)
    keep = ["look", "lens", "hdri", "hsun", "sun_az", "sun_col", "sun_str", "tilt", "ramp", "sky_clip", "sky_grad",
            "hdri_gain", "expo", "fog", "fog_amt", "sky_tint", "moon", "swell"]
    out = {k: plain(S.get(k)) for k in keep}
    out.update(cam=[x, y, eye], ground=round(g, 4), eyeZ=round(g + eye, 4), sun_el=sun_el,
               sky_rot=S.get("sky_rot", 0.0), stars=S.get("stars", 0.0), sky=S.get("sky"))
    out.update(plain(parts(c)))
    out["world"] = WORLD[hour]
    # one moon: the hour has one exactly when its world state does (its height there is world.moonEl, read by hours.ts;
    # the lamp's own height in "moon" still aims the key light, which this export does not move)
    assert (out["moon"] is None) == (WORLD[hour]["moonEl"] is None), hour
    return out


def parts(c):
    """The four unknowns (M2) as plain numbers, resolved the way coast.py's builders resolve them."""
    S = c.S
    out = dict(aurora=None, cloudsea=None, falls=None, cave=None)
    a = S.get("aurora")
    if a and a.get("sky_bands"):          # build_aurora_sky / aurora_mat defaults
        out["aurora"] = dict(strength=a.get("strength", 3.0), rays=a.get("rays", 60.0), ray_min=a.get("ray_min", 0.3),
                             foot=a.get("foot", 0.07), warp=a.get("warp", 0.16), haze=a.get("haze", 0.3), lean=a.get("lean", 2.0),
                             core=a.get("core", (0.62, 1.0, 0.35)), low=a.get("low", (0.10, 1.0, 0.50)),
                             high=a.get("high", (0.72, 0.30, 0.95)), yaw=S["look"][0], bands=a["sky_bands"])
    cs = S.get("cloudsea")
    if cs:                                # build_cloudsea
        out["cloudsea"] = dict(z=cs["z"], amp=cs.get("amp", 14.0), box=cs["box"], feather=cs.get("feather", 0.0),
                               low=cs.get("low", (0.30, 0.34, 0.50)), high=cs.get("high", (0.86, 0.90, 1.0)))
    if S.get("waterfall"):                # build_waterfall
        lx, ly = c.LAG
        fr = S["falls_r"]; fw = S.get("falls_w", (3.2, 2.6))
        out["falls"] = dict(x=lx, yLip=ly + fr[0], yPool=ly + fr[1], zTop=round(float(c.ground(lx, ly + 73.0)) - 0.5, 4),
                            w0=fw[0], w1=fw[0] + fw[1], pool=S.get("falls_pool", 0.0), poolY=ly + fr[1] - 1.5,
                            spray=S["spray"][0], sprayZ=S.get("spray_z", (3.0, 2.0, 2.5))[0])
    if S.get("cave"):                     # build_cave
        cx, cy = c.CAVE; fz = float(c.CAVE_FLOOR); az = math.radians(c.CAVE_AZ)
        out["cave"] = dict(x=cx, y=cy, floor=round(fz, 4), az=c.CAVE_AZ, top=S.get("cave_top", 34.0), radii=(12.0, 10.0, 7.5),
                           centreZ=round(fz + 4.5, 4), fungiCol=S.get("fungi_col", (0.55, 0.9, 0.7)), fungiGlow=S.get("fungi_glow", 0.35),
                           pool=dict(x=round(cx + 1.5 * math.sin(az), 4), y=round(cy + 1.5 * math.cos(az), 4), r=S.get("pool_r", 2.6)))
    return out


if __name__ == "__main__":
    data = {h: export(h) for h in HOURS}
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=1)
        f.write("\n")
    for h, d in data.items():
        print(f"{h:11s} eyeZ {d['eyeZ']:8.2f} sun_el {d['sun_el']:6.2f} sun_str {d['sun_str']} moon {d['moon']}")
