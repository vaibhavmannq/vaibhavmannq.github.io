"""Check the parts baked from the Blender scene (aurora.json, cave.bin) against shots.json, without Blender."""
import json, math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
BASE = os.path.join(ROOT, "public", "world", "base")
shots = json.load(open(os.path.join(ROOT, "src", "journey", "shots.json"), encoding="utf-8"))
meta = json.load(open(os.path.join(BASE, "base.json"), encoding="utf-8"))


def need(path):
    if not os.path.exists(path):
        sys.exit(f"missing {path}: run `npm run world:blender` (needs Blender) and commit the result")
    return path


def test_aurora():
    data = json.load(open(need(os.path.join(BASE, "aurora.json")), encoding="utf-8"))
    n = data["samples"]
    assert n == 131, n
    for hour in ("night", "midnight"):
        cfg = shots[hour]["aurora"]; bands = data[hour]
        assert len(bands) == len(cfg["bands"]), (hour, len(bands))
        for flat, (az0, az1, el0, el1, hel, amp, k) in zip(bands, cfg["bands"]):
            a = np.array(flat).reshape(-1, 3)
            assert len(a) == n, (hour, len(a))
            az = a[:, 0] - cfg["yaw"]
            assert az.min() >= min(az0, az1) - 1.6 * amp - 1 and az.max() <= max(az0, az1) + 1.6 * amp + 1, (hour, az.min(), az.max())
            assert a[:, 1].min() > -5 and (a[:, 1] + a[:, 2]).max() < 90, (hour, a[:, 1].min())
            assert a[:, 2].min() >= 0.6 * hel - 0.01 and a[:, 2].max() <= 1.4 * hel + 0.01, (hour, a[:, 2].min(), a[:, 2].max())
    assert meta["aurora"]["file"] == "base/aurora.json"


def read_cave():
    m = meta["cave"]; cave = shots["beforedawn"]["cave"]
    buf = open(need(os.path.join(BASE, "cave.bin")), "rb").read()
    off = 0
    def take(dtype, count, pad=False):
        nonlocal off
        a = np.frombuffer(buf, dtype, count, off); off += a.nbytes
        if pad: off += off % 2
        return a
    sv, fv, nf = m["shellVerts"], m["floorVerts"], m["fungi"]
    shell = take("<i2", sv * 3).reshape(-1, 3) / m["scale"]
    opn = take(np.uint8, sv, True) / 255 * (m["openHi"] - m["openLo"]) + m["openLo"]
    light = take(np.uint8, sv, True)
    floor = take("<i2", fv * 3).reshape(-1, 3) / m["scale"]
    flight = take(np.uint8, fv, True)
    fungi = take("<i2", nf * 3).reshape(-1, 3) / m["scale"]
    frad = take(np.uint8, nf, True)
    stris = take("<u2", m["shellTris"] * 3).reshape(-1, 3)
    ftris = take("<u2", m["floorTris"] * 3).reshape(-1, 3)
    assert off == len(buf), (off, len(buf))
    return m, cave, shell, opn, light, floor, flight, fungi, frad, stris, ftris


def test_cave():
    m, cave, shell, opn, light, floor, flight, fungi, frad, stris, ftris = read_cave()
    centre = np.array([0.0, 0.0, cave["centreZ"] - cave["floor"]])
    assert np.linalg.norm(shell - centre, axis=1).max() < 13.5
    assert stris.max() < len(shell) and ftris.max() < len(floor)
    d = (shell[opn > 0] - centre).mean(0)
    az = math.degrees(math.atan2(d[0], d[1]))
    assert abs(az - cave["az"]) < 12, az                               # the mouth faces the cove
    assert np.abs(floor[:, 2]).max() < 0.3, np.abs(floor[:, 2]).max()  # the floor sits at the cave's floor height
    assert 150 <= len(fungi) <= 700, len(fungi)
    assert light.min() == 0 and light.max() > 200, (light.min(), light.max())
    # the back wall faces the mouth and is lit by it; the rock beside the mouth faces inward, away from the light
    front = (shell - centre) @ np.array([math.sin(math.radians(cave["az"])), math.cos(math.radians(cave["az"])), 0.0])
    solid = opn < -0.5
    back, beside = light[solid & (front < -6)].mean(), light[solid & (front > 6)].mean()
    assert back > 2 * beside, (back, beside)
    assert frad.min() >= 1


if __name__ == "__main__":
    test_aurora()
    test_cave()
    print("ok parts: aurora", meta["aurora"], "cave", {k: meta["cave"][k] for k in ("shellVerts", "shellTris", "floorVerts", "fungi")})
