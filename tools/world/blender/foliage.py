"""Leaf cards for the site's trees (M3 Task 2), pure numpy: no Blender, so tools/world/test_parts.py can check them.

A Poly Haven tree has a million leaf triangles; the site draws a few hundred cards per tree instead. The leaves are
grouped into cells of a grid sized so that about `target` cells hold leaves; each cell becomes one square card at its
leaves' centre, turned at random about the leaves' mean facing (so the crown reads full from every side).

Front light (spec §9.7; research milestones-m3-m10.md M3, the Polycount and Unreal threads): each card's normal is
bent toward the crown's dome, 70 % dome and 30 % its own facing, so a front-lit crown shades as one round volume and
keeps some contrast between leaf groups. The dome's centre sits low in the crown (CENTRE_UP of its height), so even
the lowest cards point out more than down: a full sphere would turn the underside dark. Each card's own facing is
chosen on the dome's side first, so the 30 % never fights the 70 %.
"""
import numpy as np

BEND = 0.7          # share of the dome in a card's normal
CENTRE_UP = 0.3     # the dome's centre: this share of the crown's height above its lowest leaves
CARD_SPAN = 1.8     # a card's side, in grid cells (they overlap, so the crown has no holes)
SQUASH_Z = 0.8      # the dome is a little flatter than a sphere
DOWN = 0.45         # the dome's normals lean down at most this much (z of a unit vector): a half sphere drawn out to a
                    # cone below, not a full sphere, whose underside would face the ground and go dark


def _norm(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-9)


def _cells(P, cell):
    k = np.floor(P / cell).astype(np.int64)
    _, lab = np.unique(k, axis=0, return_inverse=True)
    return lab.ravel()


def cluster_cell(P, target):
    """The grid cell (m) that gives the largest number of occupied cells not above `target`, by bisection."""
    span = float(np.max(P.max(0) - P.min(0)))
    lo, hi = span / 400.0, span
    for _ in range(30):
        mid = (lo * hi) ** 0.5
        if _cells(P, mid).max() + 1 > target: lo = mid
        else: hi = mid
    return hi


def crown_centre(P):
    """The dome's centre for one crown's leaves: their middle across, CENTRE_UP of the way up their height."""
    lo, hi = P.min(0), P.max(0)
    return np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2] + CENTRE_UP * (hi[2] - lo[2])])


def leaf_cards(P, N, target, seed, crown=None):
    """Cards for one model's leaves. P, N: leaf centres and normals (n, 3; z up, metres); crown: per leaf, which crown
    it belongs to (a model with several shrubs has one dome each; default one). Returns corners (m, 4, 3), bent
    normals (m, 3), own facings (m, 3), the dome centre of each card (m, 3) and depth (m,): 0 at the dome's centre,
    1 at its outermost card, for the crown's own shade."""
    P = np.asarray(P, float); N = _norm(np.asarray(N, float))
    crown = np.zeros(len(P), np.int64) if crown is None else np.asarray(crown, np.int64)
    rng = np.random.default_rng(seed)
    cell = cluster_cell(P, target)
    lab = _cells(P, cell)
    m = lab.max() + 1
    cnt = np.bincount(lab, minlength=m).astype(float)
    C = np.stack([np.bincount(lab, P[:, i], m) for i in range(3)], 1) / cnt[:, None]
    NM = np.stack([np.bincount(lab, N[:, i], m) for i in range(3)], 1)
    own_crown = np.array([np.bincount(crown[lab == j]).argmax() for j in range(m)])
    centres = np.array([crown_centre(P[crown == c]) for c in range(crown.max() + 1)])
    cen = centres[own_crown]
    radial = _norm((C - cen) * np.array([1.0, 1.0, 1.0 / SQUASH_Z]))
    z = np.maximum(radial[:, 2], -DOWN)                      # keep the bearing, lift the lean to at most DOWN
    flat = radial[:, :2] + (np.linalg.norm(radial[:, :2], axis=1) < 1e-6)[:, None] * np.array([1.0, 0.0])
    radial = np.concatenate([_norm(flat) * np.sqrt(1 - z * z)[:, None], z[:, None]], 1)
    own = _norm(_norm(NM) + rng.normal(0, 0.6, (m, 3)))
    own = np.where(((own * radial).sum(1) < 0)[:, None], -own, own)
    bent = _norm(BEND * radial + (1 - BEND) * own)
    helper = np.where(np.abs(own[:, 2:3]) < 0.9, np.array([[0.0, 0.0, 1.0]]), np.array([[1.0, 0.0, 0.0]]))
    u = _norm(np.cross(helper, own)); v = np.cross(own, u)
    a = rng.uniform(0, 2 * np.pi, m)[:, None]
    u, v = u * np.cos(a) + v * np.sin(a), v * np.cos(a) - u * np.sin(a)
    half = 0.5 * CARD_SPAN * cell * np.clip(np.sqrt(cnt / np.median(cnt)), 0.7, 1.3)[:, None]
    corners = np.stack([C - u * half - v * half, C + u * half - v * half, C + u * half + v * half, C - u * half + v * half], 1)
    d = np.linalg.norm((C - cen) * np.array([1.0, 1.0, 1.0 / SQUASH_Z]), axis=1)
    reach = np.array([d[own_crown == c].max() if (own_crown == c).any() else 1.0 for c in range(len(centres))])
    depth = np.clip(d / reach[own_crown], 0, 1)
    return corners, bent, own, cen, depth
