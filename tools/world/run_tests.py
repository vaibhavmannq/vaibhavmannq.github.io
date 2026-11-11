"""Run every tools/world/test_*.py (run: npm run world:test; CI runs it). Exits 1 if any fails."""
import glob, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
failed = []
for path in sorted(glob.glob(os.path.join(HERE, "test_*.py"))):
    name = os.path.basename(path)
    print(f"== {name}", flush=True)
    if subprocess.run([sys.executable, path], cwd=os.path.join(HERE, "..", "..")).returncode != 0:
        failed.append(name)
if failed:
    print("FAILED:", ", ".join(failed))
    sys.exit(1)
print("all world checks passed")
