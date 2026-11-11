# M1, the World Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The land reads as natural ground from flight height (no box edges, inland ridges and gullies, a richer colour
map, distant trees and scrub, no hard horizon line), while the nine approved camera views stay exactly as they are.

**Architecture:** coast.py stays the single source of the world. Its M0 ground becomes `ground_base`; the new `ground`
warps coordinates and adds relief only outside a baked **keep mask**: everything the nine cameras see (landscape and
portrait framing) plus everything along the sun or moon rays that could shadow what they see. A Python view checker
casts the cameras' rays on both grounds and proves the views unchanged. The site's world base, colour map, flight paths
and a new instanced dressing layer are rebaked from the new ground; the sky fades to the fog colour below the horizon.

**Tech Stack:** Python 3 + numpy + pillow + opencv-python (world tools), TypeScript + three.js 0.186 TSL (site),
Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-10-realtime-world-design.md` (§6 the world pass, §8.2 flight checks, §14
budgets, §18 M1). Decisions D11–D15 in `docs/handover/DECISIONS.md` (local only).

## Global Constraints

- The nine camera views must not change: per camera, at most 0.1 % of view rays change what they hit (sky/sea/land)
  or their hit distance by more than 1 % + 0.3 m (spec §6 "the depth each camera sees must not change").
- Draws per frame ≤ 60, materials ≤ 14, triangles ≤ 2.5 M (census, spec §14).
- JavaScript ≤ 400 kB gzip; stage A ≤ 1.2 MB; new download per place ≤ 3 MB; world base files (shared) ≤ 1.0 MB.
- Frame rate on the default tier: 60 at stops; ≥ 55 in flight, no frame over 50 ms (laptop `__flight` and the owner's
  phone over USB).
- Textures stay WebP (D14). three.js only from `three/webgpu` and `three/tsl` (M0 ruling). No new npm dependencies.
- No AI attribution in commits, code or docs. Commit on `world` only; never push without asking. Never `git add`
  `HANDOVER.md` or `docs/handover/`.
- Every coast.py change keeps the file runnable in Blender (numpy only above the `# ---------------- render setup` line).
- Not in M1 (my call): the JS port of the ground formula (spec §6, last bullet). The site reads baked heights; the port
  arrives with the first place that needs the formula at runtime (M3).

## Review Focus

1. **The later render round (D6) needs `keep.npz` beside coast.py.** A missing file must fail loudly, never fall back
   to an unprotected world. Test in Task 3 (`keep_at` raises `FileNotFoundError` naming the file).
2. **New land casting shadows into an approved view at low sun or moon** (Golden 3.6°, Sunset 1°, Midnight's moon 7°
   from the west). Test in Task 4 (shadow state of every visible point unchanged).
3. **Portrait phones see more ground and sky than the renders' landscape frame.** Views and flights are checked at
   portrait aspect too. Tests in Task 2 (ray grid covers the portrait field) and Task 6 (hillside check at 0.46).
4. **Gullies cutting below sea level inland** would show the sea plane as water in the hills. Test in Task 4 (no new
   ground below 0 m where `ground_base` was above 3 m).
5. **Trees floating or sunk on slopes** (8 m bilinear heights vs the mesh's triangles). Instances sink by half their
   height; the aerial look check in Task 9 judges it.

---

## File structure

| File | Responsibility |
|---|---|
| `tools/world/blender/coast.py` (modify) | `ground_base` (M0's ground), `keep_at`, `reshape_warp`, `relief`, the new `ground` |
| `tools/world/blender/keep.npz` (create, baked) | the keep mask |
| `tools/world/views.py` (create) | cameras from shots.json, ray grids, vectorised ray casting, view comparison, shadow test |
| `tools/world/bake_keep.py` (create) | bakes keep.npz from the nine cameras on `ground_base` |
| `tools/world/bake_base.py` (modify) | colour map paint gains mottling and cliff faces |
| `tools/world/bake_dressing.py` (create) | distant trees and scrub placements → `public/world/base/dressing.bin` |
| `tools/world/test_views.py`, `test_keep.py`, `test_reshape.py`, `test_bake_dressing.py` (create) | Python checks |
| `src/world/dressing.ts` (create) | decodes dressing.bin, builds the two instanced meshes |
| `src/world/sky.ts` (modify) | below-horizon band fades to the fog colour |
| `src/journey/flights.ts` (modify) | approach points for flights the new ground blocks |
| `src/app/boot.ts`, `src/app/bench.ts` (modify) | dressing in stage B; `__flightPose` for screenshots |
| `src/assets/manifest.ts`, `tools/world/manifest.ts` (modify) | base budget, dressing file |
| `tools/world/aerials.ts` (create) | shoots the flight views for the look check |
| `.github/workflows/ci.yml`, `package.json`, `.gitignore` (modify) | Python world checks in CI |

---

### Task 1: coast.py keeps M0's ground as `ground_base`; Python world checks run in CI

**Files:**
- Modify: `tools/world/blender/coast.py:309-313` (`def ground`), `tools/world/test_coastlib.py`
- Modify: `.gitignore`, `package.json`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `ground_base(x, y) -> ndarray` (exactly today's `ground`, cave cut included); `ground(x, y)` = `ground_base`
  for now. `npm run world:test` runs every `tools/world/test_*.py`.

- [ ] **Step 1: Write the failing test** — append to `tools/world/test_coastlib.py`:

```python
for x, y, z in REF:
    assert abs(float(c.ground_base(x, y)) - z) < 2e-4, ("ground_base", x, y)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python tools/world/test_coastlib.py`
Expected: FAIL with `AttributeError: ... 'ground_base'`

- [ ] **Step 3: Rename `ground` to `ground_base` in coast.py and add `def ground(x, y): return ground_base(x, y)`**
  below it (Task 4 replaces the body). `CAVE_FLOOR` keeps using `_ground_world`.

- [ ] **Step 4: Run it to verify it passes**

Run: `python tools/world/test_coastlib.py`
Expected: `ok 14/14`

- [ ] **Step 5: CI and housekeeping (deferred minor M6)**
  - `.gitignore`: add `__pycache__/`; `git rm -r --cached tools/world/__pycache__`.
  - `package.json`: `"world:test": "python tools/world/run_tests.py"`; create `tools/world/run_tests.py` that runs every
    `test_*.py` in its folder as a subprocess (`sys.executable`), prints each name, exits 1 if any fails.
  - `ci.yml`, after `npm run world:report`: `actions/setup-python` pinned to a full commit SHA with its version comment
    (same style as the other actions), Python `3.13`, then `pip install -r tools/world/requirements.txt`, then
    `npm run world:test`.

Run: `npm run world:test`
Expected: every test file prints its ok line; exit 0.

- [ ] **Step 6: Commit**

```bash
git add tools/world/blender/coast.py tools/world/test_coastlib.py tools/world/run_tests.py .gitignore package.json .github/workflows/ci.yml
git commit -m "chore(world): keep M0's ground as ground_base; Python world checks run in CI"
```

---

### Task 2: The view checker

**Files:**
- Create: `tools/world/views.py`, `tools/world/test_views.py`

**Interfaces:**
- Produces (all coast coordinates: x east, y north/out to sea, z up, metres):
  - `Camera = namedtuple("Camera", "x y z yaw pitch lens")`
  - `cameras() -> dict[str, Camera]` from `src/journey/shots.json`: `x, y = cam[0], cam[1]`, `z = eyeZ`,
    `yaw, pitch = look`, `lens`.
  - `ray_grid(cam: Camera, w: int = 96) -> tuple[ndarray (N,3), ndarray (N,3)]`: origins and unit directions over
    the horizontal field `2·atan(18/lens)` and the vertical field `max(landscape 16:9, portrait 0.46)`, using the same
    rule as `fovFor` in `src/journey/camera.ts`; yaw 0 looks along +y, positive yaw turns east (raymap.py's basis).
  - `cast(ground, origins, dirs, t_max: float = 7000.0) -> tuple[ndarray t (N,), ndarray kind (N,) int8]`:
    kind 0 sky, 1 sea, 2 land; a ray hits when its z drops below `max(ground(x, y), 0)` (raymap.py's rule, sea at 0);
    step `max(0.25, 0.01·t)`; vectorised over all rays, dropping rays once they hit.
  - `compare(ground_a, ground_b, cams: dict[str, Camera], w: int = 96) -> dict[str, float]`: per camera, the share of
    rays whose kind differs or whose `|t_a − t_b| > 0.01·t_a + 0.3`.
  - `light_dirs() -> dict[str, tuple[float, float, float] | None]`: per stop, the sun's direction when `sun_str > 0`
    and `sun_el > 0.5`, else the moon's when `moon` is set and its elevation `> 0.5`, else `None`; same formula and
    argument order as `sunDir` and `keyLight` in `src/journey/hours.ts` (moon: `sunDir(moon[1], moon[0])`).
  - `shadowed(ground, points (N,3), d: tuple, t_max: float = 6000.0) -> ndarray bool (N,)`: marches from each point
    (lifted 0.3 m) along `d`; true if the ground rises above the ray before it climbs over 700 m.

- [ ] **Step 1: Write the failing tests** in `tools/world/test_views.py`:

```python
flat = lambda x, y: np.full(np.shape(x), 5.0)
o = np.array([[0.0, 0.0, 15.0]]); d = np.array([[0.0, np.sqrt(0.5), -np.sqrt(0.5)]])
t, k = views.cast(flat, o, d)
assert k[0] == 2 and abs(t[0] - 10 * np.sqrt(2)) < 0.3          # 45° down onto a plane 10 m below
t, k = views.cast(flat, o, np.array([[0.0, 1.0, 0.05]]))
assert k[0] == 0                                                # upward ray: sky
cams = views.cameras()
assert set(cams) == HOURS and abs(cams["golden"].z - 0.9151) < 1e-3
o, d = views.ray_grid(cams["golden"], 96)
assert np.allclose(np.linalg.norm(d, axis=1), 1.0)
assert np.degrees(np.ptp(np.arcsin(d[:, 2]))) > 60              # portrait's tall field at lens 24 is covered
c = coastlib.load()
assert all(v == 0.0 for v in views.compare(c.ground_base, c.ground_base, cams, 48).values())
L = views.light_dirs(); assert L["dusk"] is None and L["golden"] is not None and L["midnight"] is not None
assert views.shadowed(flat, np.array([[0.0, 0.0, 5.0]]), (0.0, 0.0, 1.0))[0] == False
```

- [ ] **Step 2: Run to verify it fails**

Run: `python tools/world/test_views.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'views'`

- [ ] **Step 3: Implement `views.py`** with the signatures above.

- [ ] **Step 4: Run to verify it passes, and time it**

Run: `python tools/world/test_views.py`
Expected: `ok`, under 60 s. If `compare` at w=96 on all nine cameras takes over 3 minutes, report the time; do not
lower w below 64.

- [ ] **Step 5: Commit**

```bash
git add tools/world/views.py tools/world/test_views.py
git commit -m "feat(world): view checker: the nine cameras' rays, casting, comparison and shadows"
```

---

### Task 3: The keep mask

**Files:**
- Create: `tools/world/bake_keep.py`, `tools/world/test_keep.py`, `tools/world/blender/keep.npz` (baked)
- Modify: `tools/world/blender/coast.py` (add `keep_at` above `ground_base`)

**Interfaces:**
- Consumes: `views.cameras`, `views.ray_grid`, `views.cast`, `views.light_dirs` (Task 2); `ground_base` (Task 1).
- Produces: `keep.npz` with `keep` (uint8, 0..255, shape (ny, nx)), `x0`, `y0`, `step` (16.0), covering
  x and y from −7400 to 6600 (the horizon ring's reach); `keep_at(x, y) -> ndarray` in [0, 1], bilinear, 0 outside
  the grid. coast.py loads the file lazily on the first `keep_at` call (so `bake_keep.py` can import coast.py before
  the file exists), from `os.path.join(os.path.dirname(__file__), "keep.npz")`; a missing file raises
  `FileNotFoundError` naming that path.

- [ ] **Step 1: Write the failing tests** in `tools/world/test_keep.py`:

```python
c = coastlib.load(); cams = views.cameras()
for name, cam in cams.items():
    o, d = views.ray_grid(cam, 64); t, k = views.cast(c.ground_base, o, d)
    hit = k > 0; p = o[hit] + d[hit] * t[hit, None]
    assert (c.keep_at(p[:, 0], p[:, 1]) > 0.999).all(), name          # every seen point is protected
    assert c.keep_at(cam.x, cam.y) > 0.999
assert c.keep_at(9000.0, 9000.0) == 0.0                               # outside the grid
share = (np.load(KEEP)["keep"] > 0).mean(); print(f"protected share {share:.2f}"); assert share < 0.6
# missing file fails loudly (Review Focus 1)
```

Add the missing-file case: point `coastlib.COAST` at a copy of coast.py in an empty temporary folder, `load()`, call
`keep_at(0.0, 0.0)` and assert `FileNotFoundError` whose message contains `keep.npz`.

- [ ] **Step 2: Run to verify it fails**

Run: `python tools/world/test_keep.py`
Expected: FAIL (`keep_at` not defined).

- [ ] **Step 3: Implement `bake_keep.py`**: cast every camera's `ray_grid(cam, 192)` on `ground_base`; mark each hit
  point in a binary grid with radius `max(24, 0.02·t)` m; for stops with a light direction, also mark points every 16 m
  along the light ray from each hit point until the ray is 700 m above sea level; keep = 1 on marked cells, then
  `smoothstep` from 1 to 0 over 400 m of distance outside them (`cv2.distanceTransform`); save as uint8.
  Then add `keep_at` to coast.py.

The 400 m falloff is chosen so that Task 4's 140 m warp changes coordinates by at most 0.35 m per metre (no folds).

- [ ] **Step 4: Bake and run the tests**

Run: `python tools/world/bake_keep.py && python tools/world/test_keep.py`
Expected: `ok`, protected share printed (expect roughly 0.2–0.45).

- [ ] **Step 5: Commit**

```bash
git add tools/world/bake_keep.py tools/world/test_keep.py tools/world/blender/keep.npz tools/world/blender/coast.py
git commit -m "feat(world): the keep mask: what the nine cameras see and what could shadow it"
```

---

### Task 4: The reshaped ground

**Files:**
- Modify: `tools/world/blender/coast.py` (`reshape_warp`, `relief`, `ground`)
- Create: `tools/world/test_reshape.py`

**Interfaces:**
- Consumes: `keep_at`, `ground_base` (Tasks 1, 3); `views.compare`, `views.shadowed`, `views.light_dirs` (Task 2).
- Produces: `ground(x, y) = hb + f·relief(xw, yw)` where `f = 1 − keep_at(x, y)`, `(wx, wy) = reshape_warp(x, y)`,
  `xw, yw = x + f·wx, y + f·wy`, `hb = ground_base(xw, yw)`; relief only on land:
  `relief · smoothstep(3, 20, hb)`, and where `hb > 3` the result is never below 3 m.

Starting values (tune by eye in Task 9, keeping every test green):
- `reshape_warp`: amplitude 140 m, `fbm` at 1/1600 m with different offsets for x and y.
- `relief`: ridges `45 · (1 − |2·fbm(x/380, y/380) − 1|)` minus gullies `15 · (1 − |2·fbm(x/520 + 7, y/520 + 3) − 1|)`,
  4 octaves each (coast.py's `fbm`).

- [ ] **Step 1: Write the failing tests** in `tools/world/test_reshape.py`:

```python
c = coastlib.load(); rng = np.random.default_rng(3)
X, Y = rng.uniform(-7000, 6000, 20000), rng.uniform(-7000, 6000, 20000)
k = c.keep_at(X, Y); P = k == 1.0
assert np.array_equal(c.ground(X[P], Y[P]), c.ground_base(X[P], Y[P]))          # protected: bit-identical
assert P.sum() > 1000 and (~P).sum() > 5000
changed = views.compare(c.ground_base, c.ground, views.cameras(), 96)
assert max(changed.values()) <= 0.001, changed                                   # the nine views unchanged
for name, d in views.light_dirs().items():                                       # Review Focus 2
    if d is None: continue
    o, dr = views.ray_grid(views.cameras()[name], 64); t, kk = views.cast(c.ground_base, o, dr)
    p = (o + dr * t[:, None])[kk > 0]
    same = views.shadowed(c.ground_base, p, d) == views.shadowed(c.ground, p, d)
    assert same.mean() >= 0.999, (name, same.mean())
U = (k == 0); hb, hn = c.ground_base(X[U], Y[U]), c.ground(X[U], Y[U])
assert not ((hb > 3) & (hn < 0)).any()                                           # Review Focus 4
```

Plus the two shape checks (print both before/after values):
- **Inland relief:** over the 400 m windows of the base grid (x −2000..1200, y −2400..1600) where keep is 0 and
  `ground_base > 20` everywhere, the median standard deviation of `ground` is ≥ 15 m and at least 1.5× that of
  `ground_base`; at least 3 such windows exist.
- **The western shore wanders:** for x every 16 m from −2000 to −400 where keep is 0 along the old shoreline, the
  shoreline y (first sea-to-land crossing scanning south from y = 400) differs from `ground_base`'s with a standard
  deviation ≥ 20 m.

- [ ] **Step 2: Run to verify it fails**

Run: `python tools/world/test_reshape.py`
Expected: FAIL on the shape checks (ground is still ground_base).

- [ ] **Step 3: Implement `reshape_warp`, `relief` and the new `ground`** as specified above.

- [ ] **Step 4: Run all world tests**

Run: `npm run world:test`
Expected: all ok. `test_coastlib`'s `ground` REF points stay within 2e-4 because they are all in camera views; if one is
not, move that point's `ground` assertion to `ground_base` and say so in the commit message.

- [ ] **Step 5: Commit**

```bash
git add tools/world/blender/coast.py tools/world/test_reshape.py
git commit -m "feat(world): reshaped ground outside the camera views: wandering edges, ridges and gullies"
```

---

### Task 5: Rebake the world base; colour map with mottling and cliff faces

**Files:**
- Modify: `tools/world/bake_base.py` (`paint`), `src/assets/manifest.ts` (`BUDGETS`, `checkBudgets`),
  `tests/unit/packReport.test.ts`
- Regenerated: `public/world/base/*`, `public/world/manifest.json`

**Interfaces:**
- Consumes: the new `ground` (Task 4).
- Produces: `paint(h, step, X, Y)`; `Budgets` gains `baseBytes: 1.0e6`, checked against files whose `stops` is `'all'`.

- [ ] **Step 1: Write the failing test** in `tests/unit/packReport.test.ts`: a manifest whose `'all'` files total
  1.1 MB fails `checkBudgets` with a line containing `world base`; 0.9 MB passes.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/packReport.test.ts`
Expected: FAIL (no base budget).

- [ ] **Step 3: Implement the base budget**, then extend `paint`: mottle meadow↔scrub with
  `fbm(X·0.004, Y·0.004)` (weight up to 0.5), a second tint `fbm(X·0.02, Y·0.02)` ±8 % brightness, cliff faces
  (slope > 45°) 25 % darker rock.

- [ ] **Step 4: Rebake and verify**

Run: `python tools/world/bake_base.py && python tools/world/test_bake_base.py && node tools/world/manifest.ts && npm run world:report && npx vitest run tests/unit/packReport.test.ts`
Expected: test_bake_base ok (base files ≤ 0.8 MB); report shows `world base` under 1.0 MB; vitest pass.

- [ ] **Step 5: Commit**

```bash
git add tools/world/bake_base.py src/assets/manifest.ts tests/unit/packReport.test.ts public/world
git commit -m "feat(world): rebake the base on the reshaped ground; colour map mottling and cliff faces; base budget"
```

---

### Task 6: Flights never look into a hillside; the last flight goes round its hill

**Files:**
- Modify: `tests/unit/flights.test.ts`, `src/journey/flights.ts` (`APPROACH` / `FLIGHT_OVERRIDES`)
- Regenerated: `src/journey/flightPaths.json`

**Interfaces:**
- Consumes: `buildTrack`, `frameAt`, `stopCentre` (`src/journey/timeline.ts`), `poseAt` (`src/journey/camera.ts`),
  `createHeightSampler` (`src/world/heights.ts`), the rebaked heights (Task 5).

- [ ] **Step 1: Rebake the flights on the new ground and write the failing test**

Run: `node tools/world/bake_flights.ts`

Add to the "baked flight paths" block: for each flight, at aspects 16/9 and 0.46, sample 200 frames from just after
the start stop to just before the end stop (`frameAt` at u from `stopCentre(i) + 0.5` to `stopCentre(i + 1) − 0.5`),
take `poseAt`'s position and its yaw/pitch, cast the view's centre ray over the heights (step 1 m to 30 m), and fail if
more than 8 consecutive samples, outside the last 10 % of the flight, hit ground within 30 m. Name the flight and the
first u in the message.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/flights.test.ts`
Expected: FAIL naming `firstlight>sunrise` (M0's hill); possibly others on the new ground.

- [ ] **Step 3: Add approach points** in `APPROACH` (or a `FLIGHT_OVERRIDES` entry) for each failing flight, each with
  a one-line reason, then rebake with `node tools/world/bake_flights.ts`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/flights.test.ts tests/unit/camera.test.ts`
Expected: PASS, including the existing 2 m clearance test.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/flights.test.ts src/journey/flights.ts src/journey/flightPaths.json
git commit -m "feat(journey): flights never look into a hillside; approach points round the new ground"
```

---

### Task 7: Distant dressing: trees and scrub from the air

**Files:**
- Create: `tools/world/bake_dressing.py`, `tools/world/test_bake_dressing.py`, `src/world/dressing.ts`,
  `tests/unit/dressing.test.ts`
- Modify: `src/app/boot.ts` (`loadBase`), `tools/world/manifest.ts`
  and `src/assets/manifest.ts` (`base.dressing` meta), `tests/e2e/census.spec.ts`, `package.json` (`world` script)
- Regenerated: `public/world/base/dressing.bin`, `public/world/manifest.json`

**Interfaces:**
- Consumes: `ground`, `keep_at` (Tasks 3–4); `flightPaths.json` (Task 6); `HeightAt` (`src/world/heights.ts`).
- Produces:
  - `dressing.bin`: little-endian records of 4 × uint16 per instance: `qx, qy` (position over the base grid's extent,
    `x = x0 + qx/65535·(x1 − x0)`), `scale` (metres ×100), `seed` (rotation and tint); trees first, then scrub.
  - `bake_dressing.py` writes `dressing = { file: "base/dressing.bin", trees, scrub }` into `base.json`
    (read-modify-write); the manifest carries it as `base.dressing`.
  - `interface DressingMeta { file: string; trees: number; scrub: number }`; the grid's far edge is
    `x1 = x0 + (nx − 1)·step` (same for y).
  - `decodeDressing(bytes: Uint16Array, meta: DressingMeta, grid: GridMeta): { kind: 0 | 1; x: number; y: number; scale: number; yaw: number; tint: number }[]`
  - `createDressing(instances, heightAt: HeightAt): WorldPart` — two `InstancedMesh`es (tree clump: a cone over a
    squashed icosphere, ≤ 24 triangles; scrub: squashed icosahedron, ≤ 12 triangles) sharing one
    `MeshStandardNodeMaterial` with per-instance colour; each instance sunk by half its height (Review Focus 5).

Placement rules (`bake_dressing.py`): only where `keep_at < 0.02`, `ground > 2.5`, slope < 28°, and within 450 m of a
flight's ground track. Trees on 3–60 m in patches (`fbm(x/90, y/90) > 0.55`), scale 6–14 m; scrub on 20–180 m, scale
1.5–4 m; nothing above 220 m. Caps: 8 000 trees, 12 000 scrub (sample with a fixed seed, thin by Poisson-disc radius
9 m trees / 5 m scrub).

- [ ] **Step 1: Write the failing tests**
  - `test_bake_dressing.py`: no instance with `keep_at ≥ 0.02`, `ground < 2.5`, or slope ≥ 28°; tree and scrub counts
    within caps and equal to base.json's; file ≤ 200 kB.
  - `tests/unit/dressing.test.ts`: a 3-record buffer decodes to the right kinds, positions at the grid's corners and
    centre (±0.1 m), scales; `createDressing` gives two instanced meshes with counts 2 and 1 and one shared material.
  - `census.spec.ts`: add `expect(row.triangles, row.stop).toBeLessThanOrEqual(2.5e6)`.

- [ ] **Step 2: Run to verify they fail**

Run: `python tools/world/test_bake_dressing.py; npx vitest run tests/unit/dressing.test.ts`
Expected: FAIL (no bake, no module).

- [ ] **Step 3: Implement** the bake, `dressing.ts`, the manifest meta and the stage-B wiring in `loadBase` (fetch
  `base/dressing.bin` alongside the heights, compile off-screen like terrain and sea). Add `bake_dressing.py` to the
  `world` script after `bake_flights.ts` and before `manifest.ts`.

- [ ] **Step 4: Run to verify**

Run: `npm run world && npm run world:test && npm test && npm run build && npx playwright test census --project=chromium && npm run world:report`
Expected: all pass; census ≤ 60 draws, ≤ 14 materials, ≤ 2.5 M triangles at every stop; base under 1.0 MB.

- [ ] **Step 5: Commit**

```bash
git add tools/world/bake_dressing.py tools/world/test_bake_dressing.py src/world/dressing.ts tests/unit/dressing.test.ts src/app/boot.ts tools/world/manifest.ts src/assets/manifest.ts tests/e2e/census.spec.ts package.json public/world
git commit -m "feat(world): distant trees and scrub along the flight corridors, two instanced meshes"
```

---

### Task 8: No hard horizon line (deferred minor M11)

**Files:**
- Modify: `src/world/sky.ts`, `src/app/bench.ts`
- Create: `tests/e2e/horizon.spec.ts`

**Interfaces:**
- Consumes: `LightUniforms.fogColor` (`src/world/light.ts`), `afterRenders` (bench.ts), `Track` segments.
- Produces: `window.__flightPose(flight: number, t: number): Promise<void>` places the camera at flight `flight`
  (from stop `flight` to `flight + 1`) at fraction `t`, resolving after 3 rendered frames.

- [ ] **Step 1: Write the failing test** `tests/e2e/horizon.spec.ts` (Chromium only): open `/?stills=off&tier=low`,
  wait for `is-scene-ready` and `__flightPose(2, 0.5)` (Dusk → Blue hour cruise), screenshot `#world canvas`, decode the
  PNG in the page (`Image` from a data URL → `OffscreenCanvas` → `getImageData`), compute each row's mean luminance over
  the middle 60 % of the width, and assert the largest jump between neighbouring rows is ≤ 0.08 (0..1 scale). Repeat at
  `__flightPose(3, 0.5)`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test horizon --project=chromium`
Expected: FAIL with a jump above 0.08 (the M0 line). If it passes, lower the pose's threshold until M0 fails and say so
in the commit message.

- [ ] **Step 3: Implement**: in `sky.ts`, mix the sky towards `u.fogColor` by `smoothstep(0.02, -0.03, dir.y)` (the
  sea and the ring end inside full fog, so below the horizon the sky must be that colour); add `__flightPose` to bench.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run build && npx playwright test horizon census smoke --project=chromium`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/world/sky.ts src/app/bench.ts tests/e2e/horizon.spec.ts
git commit -m "fix(world): the sky fades to the fog colour below the horizon; no hard line on high flights"
```

---

### Task 9: Look check, tuning, speed, the owner's verdict

**Files:**
- Create: `tools/world/aerials.ts`; `package.json` script `"aerials": "node tools/world/aerials.ts"`

**Interfaces:**
- Consumes: the production build served by `npm run preview`; the `?p=` start parameter (M0's `readParams`), so the
  same tool shoots M0's build too (M0 has no `__flightPose`). The stops did not move, so the same `p` is the same
  place on the journey in both builds.
- Produces: `<out>/p-<p>.png` (1280×720, `?stills=off&tier=high&p=<p>`, 4 s after `is-scene-ready`) for
  p = (k + 0.5)/24, k = 0..23, plus `index.html` showing two sets side by side when given two folders.

- [ ] **Step 1: Shoot M0's aerials first**: `git worktree add` M0's commit (cdf951d) outside the repo, `npm ci &&
  npm run build` there, serve it, shoot into `.superpowers/m1/aerials-m0/`; then M1's into `.superpowers/m1/aerials/`.
  Script: Playwright headed Chrome (`channel: 'chrome'`), the laptop's GPU. Remove the worktree afterwards.

- [ ] **Step 2: Judge every flight** in the established way: likes, dislikes, a % per flight. Tune Task 4's warp and
  relief values, Task 5's paint and Task 7's densities until each flight reads as natural land; rerun
  `npm run world && npm run world:test && npm test` after every change. Stop when every flight is ≥ 75 % (M1's bar:
  natural land from the air; places come in M3–M7).

- [ ] **Step 3: Measure**
  - Laptop, headed Chrome, production build: `__flight('low'|'mid'|'high', 20)` on WebGPU and `?webgl`.
  - Owner's phone over USB (adb forward to the browser's devtools socket, `adb reverse tcp:4181 tcp:4181`, page at
    `http://localhost:4181/`): `__flight` per tier and real swipes (`adb shell input swipe 540 1700 540 900 150`).
  Expected: §14 frame-rate bar on the default tier; census and pack report green.

- [ ] **Step 4: Owner's verdict** on the phone (D15: only once I call it ready): flights read as natural land; the
  nine places unchanged.

- [ ] **Step 5: Commit**

```bash
git add tools/world/aerials.ts package.json tools/world/blender/coast.py tools/world/bake_base.py tools/world/bake_dressing.py public/world src/journey/flightPaths.json
git commit -m "feat(world): aerial look check; M1 tuning"
```
