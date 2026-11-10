"""Export the nine hours' shot settings from coast.py to src/journey/shots.json (run: python tools/world/export_hours.py).

One entry per stop with the camera, the resolved sun and sky orientation, the sky recolouring, exposure, fog, water calm
and the night layers. `ground` is coast.py's ground() under the camera (the cave floor for Before dawn); `eyeZ` adds the
eye height. The sun's elevation is resolved the way coast.py's build_sky() does: the photo sun's height minus the tilt.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import coastlib

HOURS = ["golden", "sunset", "dusk", "bluehour", "night", "midnight", "beforedawn", "firstlight", "sunrise"]
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
            "hdri_gain", "expo", "fog", "fog_amt", "sky_tint", "moon", "swell", "chop"]
    out = {k: plain(S.get(k)) for k in keep}
    out.update(cam=[x, y, eye], ground=round(g, 4), eyeZ=round(g + eye, 4), sun_el=sun_el,
               sky_rot=S.get("sky_rot", 0.0), stars=S.get("stars", 0.0), sky=S.get("sky"))
    return out


if __name__ == "__main__":
    data = {h: export(h) for h in HOURS}
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=1)
        f.write("\n")
    for h, d in data.items():
        print(f"{h:11s} eyeZ {d['eyeZ']:8.2f} sun_el {d['sun_el']:6.2f} sun_str {d['sun_str']} moon {d['moon']}")
