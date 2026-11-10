"""The nine approved renders as stills (run: python tools/world/prep_stills.py).

M0 shows each place as its render while the camera rests there; later they are the safety net (spec §13.4).
poster.webp is the Golden render shrunk to 64 x 36 and blurred: the backdrop behind the name at first paint.
"""
import os
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
RENDERS = os.environ.get("WORLD_RENDERS", os.path.join(ROOT, ".superpowers", "brainstorm", "lookdev", "real", "out3", "out3"))
OUT = os.path.join(ROOT, "public", "world", "stills")
HOURS = ["golden", "sunset", "dusk", "bluehour", "night", "midnight", "beforedawn", "firstlight", "sunrise"]

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for h in HOURS:
        im = Image.open(os.path.join(RENDERS, f"{h}_hybrid_vivid.jpg")).convert("RGB").resize((1920, 1080), Image.LANCZOS)
        path = os.path.join(OUT, f"{h}.webp")
        im.save(path, quality=80, method=6)
        size = os.path.getsize(path)
        assert size <= 0.35e6, (h, size)
        print(f"{h:11s} {size / 1e3:6.1f} kB")
        if h == "golden":
            poster = im.resize((64, 36), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
            p = os.path.join(OUT, "poster.webp")
            poster.save(p, quality=70)
            assert os.path.getsize(p) <= 4000, os.path.getsize(p)
            print(f"poster      {os.path.getsize(p) / 1e3:6.1f} kB")
