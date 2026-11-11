"""Run coast.py's export mode in Blender for the parts the site bakes from the scene (run: npm run world:blender).

Writes public/world/base/aurora.json and cave.bin (see tools/world/blender/export_parts.py). Needs Blender (set BLENDER
to its executable if it is not in the usual place) and the Poly Haven sources (WORLD_SRC, as for the renders). The
outputs are committed: CI has no Blender and only checks them (tools/world/test_parts.py).
"""
import os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "public", "world", "base")
RUNS = [["--hour", "night"], ["--hour", "midnight"], ["--hour", "beforedawn", "--caveseg", "128"]]


def blender():
    for path in (os.environ.get("BLENDER"), shutil.which("blender"),
                 r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"):
        if path and os.path.exists(path): return path
    sys.exit("Blender not found: set BLENDER to blender.exe")


if __name__ == "__main__":
    env = dict(os.environ)
    env.setdefault("WORLD_SRC", os.path.join(ROOT, ".superpowers", "brainstorm", "lookdev", "assets"))
    exe = blender()
    for run in RUNS:
        cmd = [exe, "-b", "--python-exit-code", "1", "--python", os.path.join(HERE, "blender", "coast.py"), "--",
               *run, "--style", "hybrid", "--export", OUT]
        print(" ".join(cmd), flush=True)
        done = subprocess.run(cmd, env=env, cwd=ROOT, capture_output=True, text=True)
        tail = [ln for ln in done.stdout.splitlines() if ln.startswith("[")][-6:]
        print("\n".join(tail), flush=True)
        if done.returncode != 0:
            print(done.stdout[-3000:], done.stderr[-3000:])
            sys.exit(f"Blender export failed for {run}")
    print("exported to", OUT)
