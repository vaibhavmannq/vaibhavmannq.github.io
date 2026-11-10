"""Load coast.py (the world's source of truth) without Blender: its ground formula, shots and skies, as plain numpy.

Everything above coast.py's `# ---------------- render setup` line is pure Python and numpy; the Blender modules it
imports are replaced by stubs that are never really used there.
"""
import os, sys, types

HERE = os.path.dirname(os.path.abspath(__file__))
COAST = os.path.join(HERE, "blender", "coast.py")
MARKER = "# ---------------- render setup ----------------"
DEFAULT_SRC = os.path.normpath(os.path.join(HERE, "..", "..", ".superpowers", "brainstorm", "lookdev", "assets"))


class _Dummy:
    """Stands in for any Blender object: every attribute and call returns another dummy."""
    def __getattr__(self, name): return _Dummy()
    def __call__(self, *a, **k): return _Dummy()


def _stub(name):
    mod = types.ModuleType(name)
    mod.__getattr__ = lambda attr: _Dummy()
    return mod


def load(hour="golden"):
    """Run coast.py's world definitions for `hour` and return them as a namespace (ground, SHOTS, SKIES, S, ...)."""
    for name in ("bpy", "bmesh"):
        sys.modules.setdefault(name, _stub(name))
    if "mathutils" not in sys.modules:
        mu = _stub("mathutils"); mu.Vector = lambda *a, **k: tuple(*a); sys.modules["mathutils"] = mu
    os.environ.setdefault("WORLD_SRC", DEFAULT_SRC)
    src = open(COAST, encoding="utf-8").read()
    cut = src.index(MARKER)
    saved = sys.argv
    sys.argv = ["coast.py", "--", "--hour", hour]
    ns = {"__file__": COAST, "__name__": "coast"}
    try:
        exec(compile(src[:cut], COAST, "exec"), ns)
    finally:
        sys.argv = saved
    return types.SimpleNamespace(**{k: v for k, v in ns.items() if not k.startswith("__")})
