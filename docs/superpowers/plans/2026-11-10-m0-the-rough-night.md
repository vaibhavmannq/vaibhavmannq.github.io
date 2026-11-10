# M0 · The Rough Night Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The whole 5.8 km night flies live in the browser: 9 stops and 8 flights over simple world-wide ground, a
reflecting sea, nine recoloured sky photos with the two-sky blend, nine hours of light, stars and a moon. Each stop
shows its approved render as a still, so the owner can walk the full journey and we can measure it.

**Architecture:** One scene, one camera (spec §7). Scroll position → `frameAt()` (pure) → camera pose and blended hour
→ world parts (sky, terrain, sea) read shared light uniforms → render + bloom + grade. Assets come from one Python/Node
pipeline that reads coast.py itself; the browser gets 16-bit heights, WebP/JPEG pictures and a manifest.

**Tech Stack:** TypeScript (strict), three.js 0.186 `three/webgpu` + TSL (WebGPU, WebGL2 fallback), Vite 8, Lenis,
Vitest, Playwright, Biome, size-limit. Pipeline: Python 3 (numpy, opencv-python, pillow) and Node 24 (runs `.ts`
directly with type stripping).

**Spec:** `docs/superpowers/specs/2026-11-10-realtime-world-design.md` (§18 M0). Decisions D1–D14 in
`docs/handover/DECISIONS.md`. Slice to port from: `.superpowers/spike/golden-cove/src/main.js` (sections are named by
their `// ----` comment headers below).

## Global Constraints

- Branch `world` off `main`. Nothing is pushed; ask the owner once, before the first commit, whether per-task commits on
  `world` are fine. **No AI attribution anywhere**: no `Co-Authored-By`, no "Generated with", no mention in code or docs.
- three.js stays at `0.186.0`; no new runtime dependencies (three's own `MeshoptDecoder`/`reflector` addons only).
- Coordinates: coast `(x east, y out to sea, z up)` in metres; three.js `(x, z, -y)`. Yaw 0 = looking along coast +y,
  positive turns toward +x; pitch positive = up. Lens is mm on 36 mm film.
- Stop scroll length `1.0` screen; flight `clamp(0.8 + d / 900, 1.0, 2.2)` screens, `d` = horizontal metres (spec §8.1).
- Long-flight cruise height above the highest ground on the straight line: `clamp(0.12 · d, 80, 250)` m (spec §8.2).
- Tiers (spec §13.1), cost only: low `{scale 0.5, reflect 0.25, bloom off}`, mid `{0.75, 0.35, on}`, high `{1.0, 0.5, on}`.
  Every device starts on mid; save-data starts on low (spec §13.2).
- Budgets (spec §14): JS ≤ 400 KB gzip; ≤ 60 draws per frame incl. reflection; ≤ 14 materials; stage A (world files)
  ≤ 1.2 MB so that with code it stays ≤ 1.6 MB; new download per stop ≤ 3 MB.
- Every visible thing is a function of scroll position and time (spec §7 rule 1). No blank screen at any time.
- Owner's walkthrough rule: every finished task gets a short plain-language note in the session log.

## Review Focus

1. **Flinging past several stops faster than skies download** → the sky shows the nearest loaded photo, never black or a
   missing texture. (Test in Task 9: `pickSkyTexture`.)
2. **A link to an unknown place** (`/#foo`, `?stop=foo`) → starts at Golden, no error. (Test in Task 13.)
3. **No WebGPU and no WebGL2** → the name, labels and the stills still show at every scroll position. (Test in Task 13
   via `?nogl`.)
4. **Yaw blending across ±180°** (Midnight looks at -95°, Before dawn at -10°, flight headings anywhere) → the camera
   turns the short way. (Test in Task 5.)
5. **Scroll outside the track** (Lenis overscroll, negative or past the end) → `frameAt` clamps to the first or last
   stop. (Test in Task 4.)

## Where this plan departs from the spec (my calls, for the owner's notice)

- **No JS copy of the ground formula in M0.** Every bake reads coast.py directly (`coastlib.py`); the browser only needs
  baked heights. The slice's `world.js` port returns if a later milestone needs the formula in the browser.
- **Base terrain is one mesh, not 512 m tiles.** Tiles only matter when detail patches arrive (M3); one mesh is one draw.
- **World parts have `update/setTier/dispose` only.** `load(stage)` and `setFade()` arrive with stage B detail in M3.
- **Tier changes only at stops; no render-scale steps in flight yet.** M0 measures whether flights need it (spec §13.2).
- **Portrait uses the landscape framing with the slice's portrait field of view.** Per-stop portrait framings are M8.
- **The first view in M0 is the Golden still**, not the live cove; the real first-view number comes in M3.

## File map

```
tools/world/                       pipeline (Node 24 runs .ts directly; Python 3 for numpy work)
  blender/coast.py                 MOVED from .superpowers/brainstorm/lookdev/real/coast.py (source of truth)
  coastlib.py                      loads coast.py without Blender (stub bpy), exposes ground(), SHOTS, SKIES
  export_hours.py                  -> src/journey/shots.json
  bake_base.py                     -> public/world/base/heights.bin, ring.bin, colour.webp
  prep_sky.py                      -> public/world/sky/<id>.jpg + sky.json
  prep_stills.py                   -> public/world/stills/<id>.webp, poster.webp
  bake_flights.ts                  -> src/journey/flightPaths.json
  manifest.ts                      -> public/world/manifest.json
  pack_report.ts                   budget check (CI)
  sources.json, requirements.txt
src/
  app/        boot.ts (NEW), loop.ts refresh.ts frameRate.ts capabilities.ts (KEEP), params.ts (REWRITE), bench.ts (NEW)
  journey/    types.ts stops.ts hours.ts timeline.ts flights.ts camera.ts, shots.json + flightPaths.json (generated)
  world/      heights.ts light.ts sky.ts terrain.ts sea.ts part.ts
  render/     pipeline.ts (REPLACES renderer.ts)
  assets/     manifest.ts loader.ts skies.ts
  quality/    tiers.ts (REWRITE) governor.ts (ADAPT)
  overlay/    stage.ts (name, label, stills, veil), rail.ts, links.ts, hud.ts
  scroll/     scroll.ts progress.ts touchSnap.ts activity.ts (KEEP)
  shared/     math.ts dispose.ts random.ts (KEEP)
  content/    projects.ts (KEEP, used in M5)
  styles/     world.css (NEW; old styles removed)
tests/unit/   one file per pure module; tests/e2e/ smoke, links, census, load
```

---

### Task 1: Branch, clear the old site, boot an empty page with the name

**Files:**
- Delete: `src/regions/`, `src/journey/*` (old), `src/overlay/*` (old), `src/render/renderer.ts`, `src/dev/`,
  `src/app/boot.ts`, `src/app/debug.ts`, `src/app/params.ts` (rewritten in Task 12), `src/styles/*`, `public/stills/`,
  `scripts/capture.mjs`, old unit tests for deleted modules, all `tests/e2e/*.spec.ts` (helpers kept if reused).
- Keep: `src/app/{loop,refresh,frameRate,capabilities}.ts`, `src/quality/governor.ts`, `src/scroll/*`, `src/shared/*`,
  `src/content/projects.ts`, their tests, `public/fonts/`, `public/projects/`, `public/favicon.svg`.
- Create: `index.html`, `src/main.ts`, `src/styles/world.css`, `tests/e2e/smoke.spec.ts`
- Modify: `tsconfig.json` (add `"resolveJsonModule": true`), `tsconfig.node.json` (include `tools/**/*.ts`),
  `package.json` (remove the `capture` script), `vite.config.ts` (`chunkSizeWarningLimit: 1400`)

**Interfaces:**
- Produces: `index.html` with `#world` (canvas host, `aria-hidden`), `#stage` (overlay root), `<h1 id="name">`,
  `<p id="line">`, `<nav id="rail" aria-label="Places">`, `<p id="place" aria-live="polite">`, `#veil`, `#stills`.

- [ ] **Step 1:** `git switch -c world` from `main`. `HANDOVER.md` and `docs/handover/` stay untracked until the owner says to commit them.
- [ ] **Step 2: Write the failing e2e** `tests/e2e/smoke.spec.ts` → test `name is on screen at once`: goto `/`, expect
  `#name` to have text `Vaibhav Mann` and be visible within 1000 ms; expect no console errors (ignore `favicon.ico`).
- [ ] **Step 3:** Run `npx playwright test smoke --project=chromium` → FAIL (old page or missing ids).
- [ ] **Step 4:** Delete per the list. Write `index.html`: name `Vaibhav Mann`, line `I build quiet, moonlit things for
  the web.` (placeholder until M9), the ids above, fonts preloaded as before, title `Vaibhav Mann`, meta description
  `Vaibhav Mann. A night's walk through a coast, drawn live; portfolio in progress.` `src/main.ts` imports
  `./styles/world.css` and calls `boot()` (stub that returns). `world.css`: `#world` fixed full-viewport `100lvh`,
  `body { overscroll-behavior: none }`, a scroll track element `#track` whose height is set later, name top-left.
- [ ] **Step 5:** `npm run check && npm test && npx playwright test smoke --project=chromium` → all PASS.
- [ ] **Step 6:** Commit `chore: clear the moonlit site from the world branch and boot an empty page with the name`.

### Task 2: coast.py in the repo, readable without Blender

**Files:**
- Create: `tools/world/blender/coast.py` (copy), `tools/world/coastlib.py`, `tools/world/requirements.txt`
  (`numpy`, `opencv-python`, `pillow`), `tools/world/sources.json`, `tools/world/test_coastlib.py`
- Modify: `tools/world/blender/coast.py:11` → `A = os.environ.get("WORLD_SRC", os.path.join(os.path.dirname(HERE), "assets"))`

**Interfaces:**
- Produces: `coastlib.load(hour: str = "golden") -> types.SimpleNamespace` with `ground(x, y)` (numpy), `SHOTS`, `SKIES`,
  `CAVE`, `LAG`, `ARCH`, `sun_dir(el, az)`. Implementation: put stub modules `bpy`, `bmesh`, `mathutils` (a `Vector`
  class and a module whose attribute access returns a harmless dummy) into `sys.modules`, set `sys.argv` to
  `["coast.py", "--", "--hour", hour]`, read the source and `exec` everything above the line
  `# ---------------- render setup ----------------`.
- `sources.json`: `{ "WORLD_SRC": "<default path>", "hdri": [...file names...], "models": [...] }` listing every Poly
  Haven file coast.py and the slice tools read (all CC0), so they can be fetched again.

- [ ] **Step 1: Write the failing test** `tools/world/test_coastlib.py` (plain `assert`, run with `python`): the
  slice's 14 reference points (`.superpowers/spike/golden-cove/tools/check_world.mjs` line 2) match `ground()` to 2e-4;
  `set(SHOTS) ⊇ {golden,sunset,dusk,bluehour,night,midnight,beforedawn,firstlight,sunrise}`.
- [ ] **Step 2:** `python tools/world/test_coastlib.py` → FAIL (`coastlib` missing).
- [ ] **Step 3:** Implement `coastlib.py`; write `requirements.txt`, `sources.json`.
- [ ] **Step 4:** `python tools/world/test_coastlib.py` → prints `ok 14/14`.
- [ ] **Step 5:** Commit `feat(world): coast.py in the repo, loadable without Blender`.

### Task 3: Hour presets from coast.py

**Files:**
- Create: `tools/world/export_hours.py`, `src/journey/types.ts`, `src/journey/stops.ts`, `src/journey/hours.ts`,
  `src/journey/shots.json` (generated), `tests/unit/hours.test.ts`, `tests/unit/stops.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type Vec3 = [number, number, number];
  export type RGB = [number, number, number];
  export type StopId = 'golden' | 'sunset' | 'dusk' | 'bluehour' | 'night' | 'midnight' | 'beforedawn' | 'firstlight' | 'sunrise';
  export const STOP_IDS: readonly StopId[]; // journey order
  export const toThree = (v: Vec3): Vec3 => [v[0], v[2], -v[1]]; // coast -> three.js
  export interface Framing { yaw: number; pitch: number; lens: number }
  export interface Stop { id: StopId; numeral: string; hour: string; place: string; cam: Vec3 /* coast x, y, absolute z */; landscape: Framing }
  export interface KeyLight { dir: Vec3 /* coast, unit, toward the light */; color: RGB; strength: number }
  export interface Moon { az: number; el: number; sizeDeg: number; strength: number }
  export interface HourPreset { id: StopId; key: KeyLight; exposure: number; fogColor: RGB; fogAmount: number;
    skyTint: RGB; skyGain: number; stars: number; moon: Moon | null; swell: number; chop: number }
  ```
- Produces: `stops.ts` → `STOPS: readonly Stop[]`, `stopIndex(id: string): number` (−1 if unknown);
  `hours.ts` → `HOURS: Record<StopId, HourPreset>`, `blendHours(a: HourPreset, b: HourPreset, w: number): HourPreset`
  (component-wise lerp; `key.dir` slerped and renormalised; `moon` fades: strength lerps to 0 when one side is null).
- `shots.json` shape per hour: `{ cam, look, lens, ground, eyeZ, hdri, hsun, sun_el, sun_az, sun_col, sun_str, sky_rot,
  tilt, ramp, sky_clip, sky_grad, hdri_gain, expo, fog, fog_amt, sky_tint, stars, moon, swell, chop }`.
  `ground` = `ground(cam.x, cam.y)` (for Before dawn this is the cave floor); `eyeZ = ground + cam.z`.
  Resolve `sun_el` when absent with the same expression coast.py uses for its sun lamp (find the `sun_dir(` call sites).
- Stop text (placeholder until M9): numerals I–IX; hours `Golden hour, Sunset, Dusk, Blue hour, Night, Deep midnight,
  Before dawn, First light, Sunrise`; places `The beach, The clifftop meadow, The headland, The arch flats, The lagoon,
  The ridge, The cave, The far end of the beach, The rise`.
- Key light rule: `sun_str > 0` → the sun (`sun_col`, `sun_str`); else `moon` present → moon direction, a cool white
  `[0.7, 0.8, 1.0]`, strength `moon[4] / 10` (tune by eye); else the sun direction with strength 0.

- [ ] **Step 1: Write failing tests.** `stops.test.ts`: 9 stops in `STOP_IDS` order; `golden.cam` ≈ `[9.5, -4, 0.92]`
  (±0.01); `midnight.cam[2]` ≈ 285.9 (±0.1); `stopIndex('night') === 4`; `stopIndex('foo') === -1`.
  `hours.test.ts`: every preset has `key.dir` of length 1 (±1e-6); `golden.key.strength > 0`; `night.moon !== null`;
  `blendHours(g, s, 0)` deep-equals `g`, at 1 equals `s`; blended `key.dir` stays unit length at w = 0.5;
  `blendHours(night, sunrise, 0.5).moon.strength` = half of night's.
- [ ] **Step 2:** `npx vitest run tests/unit/hours.test.ts tests/unit/stops.test.ts` → FAIL.
- [ ] **Step 3:** Implement `export_hours.py` (uses `coastlib.load(h)` per hour, writes `src/journey/shots.json`), run it,
  then `types.ts`, `stops.ts`, `hours.ts` reading the JSON.
- [ ] **Step 4:** Run the tests → PASS.
- [ ] **Step 5:** Commit `feat(journey): nine stops and hour presets exported from coast.py`.

### Task 4: The track — scroll to stop/flight (pure)

**Files:**
- Create: `src/journey/timeline.ts`, `tests/unit/timeline.test.ts`

**Interfaces:**
- Consumes: `STOPS` (Task 3).
- Produces:
  ```ts
  export const STOP_SCREENS = 1.0;
  export function flightScreens(distanceM: number): number;
  export type Segment = { kind: 'stop'; stop: number; start: number; end: number }
                      | { kind: 'flight'; from: number; to: number; start: number; end: number };
  export interface Track { segments: readonly Segment[]; total: number }
  export function buildTrack(stops: readonly Stop[]): Track;
  export interface FrameState { kind: 'stop' | 'flight'; a: number; b: number; t: number; resting: boolean;
    hourWeight: number; skyWeight: number; stillWeight: number; fade: number }
  export function frameAt(track: Track, u: number, reducedMotion: boolean): FrameState;
  export function stopCentre(track: Track, index: number): number; // u of the stop's middle
  export function nearestStop(track: Track, u: number): number;
  ```
- Rules: `u` in screen heights, clamped to `[0, total]`. In a stop, `a = b = stop`, `t = 0.5`, `resting = true`,
  `stillWeight = 1`. In a flight: `hourWeight = smootherstep(t)`, `skyWeight = smoothstep(0.3, 0.7, t)`,
  `stillWeight = max(smoothstep(0.15, 0, t), smoothstep(0.85, 1, t))`, `fade = 0`. Reduced motion: `hourWeight` and
  `skyWeight` are `t < 0.5 ? 0 : 1`, `fade = clamp01(1 - |t - 0.5| / 0.15)`.

- [ ] **Step 1: Write failing tests:** `flightScreens(146) === 1.0`, `flightScreens(1735) === 2.2`,
  `flightScreens(1053)` ≈ 1.97 (±0.005); `buildTrack(STOPS).total` in `[21.2, 21.4]`; 17 segments alternating
  stop/flight, contiguous; `frameAt(track, -3)` equals `frameAt(track, 0)` and `frameAt(track, total + 5)` is the
  Sunrise stop (Review Focus 5); at the middle of flight III→IV, `hourWeight` = 0.5 and `skyWeight` = 0.5; at a flight's
  `t = 0.1`, `stillWeight > 0` and at `t = 0.5` it is 0; reduced motion at `t = 0.5` has `fade === 1`, at `t = 0.3`
  `fade === 0` and `hourWeight === 0`; `nearestStop(track, stopCentre(track, 6)) === 6`.
- [ ] **Step 2:** `npx vitest run tests/unit/timeline.test.ts` → FAIL.
- [ ] **Step 3:** Implement `timeline.ts` (use `smoothstep`, `clamp01` from `shared/math.ts`; add `smootherstep` there).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(journey): the track maps scroll to nine stops and eight flights`.

### Task 5: Flight paths and the camera pose

**Files:**
- Create: `src/world/heights.ts`, `src/journey/flights.ts`, `src/journey/camera.ts`, `tools/world/bake_flights.ts`,
  `src/journey/flightPaths.json` (generated), `tests/unit/flights.test.ts`, `tests/unit/camera.test.ts`
- Depends on Task 6's `heights.bin` for baking; write `heights.ts` + tests here, bake after Task 6 (Step 6).

**Interfaces:**
- Produces (`heights.ts`):
  ```ts
  export interface GridMeta { x0: number; y0: number; step: number; nx: number; ny: number; lo: number; hi: number }
  export interface RingMeta { cx: number; cy: number; r0: number; r1: number; nr: number; na: number; lo: number; hi: number }
  export type HeightAt = (x: number, y: number) => number; // coast metres; outside the grid: -22 (deep sea)
  export function createHeightSampler(q: Uint16Array, meta: GridMeta): HeightAt; // bilinear, row = y index
  ```
- Produces (`flights.ts`):
  ```ts
  export interface FlightPath { from: StopId; to: StopId; points: Vec3[] } // coast coords, absolute z
  export function generateWaypoints(a: Vec3, b: Vec3, heightAt: HeightAt): Vec3[];
  export const FLIGHT_OVERRIDES: Partial<Record<`${StopId}>${StopId}`, Vec3[]>>;
  export function sampleFlight(points: readonly Vec3[], s: number): { pos: Vec3; tangent: Vec3 }; // centripetal Catmull-Rom, s = arc-length fraction
  ```
  Waypoints: `d < 300` → `[a, lerp(a,b,0.33) + z(max(3, 0.08d)), lerp(a,b,0.66) + z(max(3, 0.08d)), b]` with z also
  ≥ ground + 2. `d ≥ 300` → cruise `zc = max(heightAt along 64 samples of a→b) + clamp(0.12d, 80, 250)`; points
  `[a, at 0.12 (z = a.z + 0.5(zc − a.z)), at 0.3 (zc), at 0.7 (zc), at 0.88 (z = b.z + 0.5(zc − b.z)), b]`.
  `FLIGHT_OVERRIDES['golden>sunset']` = the slice's path: `[a, [6,12,2.2], [-6,52,9.0], [4,104,20.0], b]`.
- Produces (`camera.ts`):
  ```ts
  export interface Pose { position: Vec3 /* three.js */; yaw: number; pitch: number; fov: number }
  export function fovFor(lens: number, aspect: number): number; // the slice's formula (main.js "the flight" section): portrait keeps width, capped 80°
  export function shortestYaw(from: number, to: number, w: number): number;
  export function poseAt(frame: FrameState, paths: readonly FlightPath[], aspect: number, timeS: number): Pose;
  ```
  Look in flight: `w1 = smoothstep(0, 0.3, t)`, `w2 = smoothstep(0.7, 1, t)`; yaw/pitch go A framing → travel heading
  (pitch clamped −20…10) by `w1`, then → B framing by `w2`, always by `shortestYaw`. Position = `sampleFlight(points,
  smootherstep(t))`. At a stop: the stop's cam plus a drift ≤ 0.05 m (two slow sines of `timeS`).
  `bake_flights.ts` reads `public/world/base/heights.bin` + meta from `manifest.json`, writes all 8 paths to
  `src/journey/flightPaths.json`.

- [ ] **Step 1: Write failing tests.** `camera.test.ts`: `shortestYaw(170, -170, 0.5)` is ±180 (not 0);
  `shortestYaw(-95, -10, 1) === -10` (Review Focus 4); `fovFor(24, 16/9)` matches the slice formula; `fovFor(20, 0.45)
  <= 80`; `poseAt` at stop 0 position ≈ `toThree(STOPS[0].cam)` within 0.06 m. `flights.test.ts` (with a synthetic
  `HeightAt` returning 0): long flight's middle point z ≥ `clamp(0.12d, 80, 250)`; `sampleFlight(p, 0)` = first point,
  `(p, 1)` = last; and — reading the real `flightPaths.json` + `heights.bin` — every path keeps ≥ 2 m above ground for
  `s` in `[0.1, 0.85]` (200 samples each).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `heights.ts`, `flights.ts`, `camera.ts`, `bake_flights.ts`.
- [ ] **Step 4:** Run the synthetic tests → PASS (the real-path test runs after Step 6).
- [ ] **Step 5:** Commit `feat(journey): flight curves and the camera pose`.
- [ ] **Step 6 (after Task 6):** `node tools/world/bake_flights.ts`, run `flights.test.ts` → PASS; commit
  `feat(journey): bake the eight flight paths`.

### Task 6: The world base — heights, horizon ring, colour map

**Files:**
- Create: `tools/world/bake_base.py`, `public/world/base/heights.bin`, `ring.bin`, `colour.webp`, `base.json`
  (generated), `tools/world/test_bake_base.py`

**Interfaces:**
- Produces: `heights.bin` = uint16 little-endian, grid `x0 = -2000, x1 = 1200, y0 = -2400, y1 = 1600, step = 8`
  (401 × 501), `z = lo + q · (hi − lo) / 65535`; `ring.bin` = uint16 polar grid centred `(-400, -400)`, `r0 = 1500`,
  `r1 = 7000`, `nr = 120`, `na = 288` (slice's far ring, re-centred); `colour.webp` 401 × 501 (one pixel per height
  sample, north up) painted by coast.py's zones: below 0 m wet/sea floor `#3b4a4f`, 0–1.5 m sand `#c9b48a`, wet band
  near the shore line darker, slope > 35° rock `#6b625a`, else meadow `#5f6b3e` → scrub `#4c5034` above 40 m, bare rock
  above 180 m `#7a736b` (edit by eye against the renders); `base.json` = both grids' meta (`GridMeta` + ring fields).
- Budget: `heights.bin` + `colour.webp` + `ring.bin` ≤ 0.8 MB.

- [ ] **Step 1: Write the failing test** `test_bake_base.py`: after a bake, decoded heights at the 14 reference points
  (bilinear) are within 0.6 m of `ground()` where the point is on flat ground (skip points within 10 m of the cave);
  files exist; total bytes ≤ 0.8 MB.
- [ ] **Step 2:** `python tools/world/test_bake_base.py` → FAIL.
- [ ] **Step 3:** Implement `bake_base.py` with `coastlib.load()`; vectorised numpy over the grid.
- [ ] **Step 4:** Run → PASS; open `colour.webp` and look at it beside the world map from s03.
- [ ] **Step 5:** Commit `feat(world): bake the world base heights, horizon ring and colour map`.

### Task 7: Nine skies and nine stills

**Files:**
- Create: `tools/world/prep_sky.py`, `tools/world/prep_stills.py`, `public/world/sky/<id>.jpg` ×9, `sky.json`,
  `public/world/stills/<id>.webp` ×9, `poster.webp`

**Interfaces:**
- `prep_sky.py` ports the slice's `tools/prep_assets.py` to all nine hours, reading `src/journey/shots.json`. Photo
  orientation per coast.py `build_sky()` (the `SKIES` table's photo-sun `hsun`, `sun_az`, `sky_rot`, `tilt`) — not the
  slice's sun detection, which fails when the sun is below the horizon. Recolour with each hour's `ramp`, `sky_clip`,
  `sky_grad`, `hdri_gain` exactly as `build_sky()` does. Output 2048 × 1024, three.js equirect convention, the slice's
  8-bit HDR encoding (`p / (1 − p)` after `pow 2.2`), JPEG q85.
- `sky.json`: per id `{ file, ambientSky: RGB, ambientGround: RGB }` — mean decoded colour of the upper hemisphere and
  of the 10° band above the horizon × 0.3 (used as the hemisphere light).
- `prep_stills.py`: each `out3/out3/<id>_hybrid_vivid.jpg` → 1920 × 1080 WebP q80; `poster.webp` = Golden at 64 × 36,
  Gaussian blur, ≤ 4 KB (shown behind the name at first paint, stretched with CSS blur).

- [ ] **Step 1:** Run both scripts; assert (in-script) every output exists at its size, each sky ≤ 0.2 MB, each still
  ≤ 0.35 MB.
- [ ] **Step 2:** Make a 3 × 3 contact sheet of the nine skies (scratchpad) and compare each to its render's sky by eye.
  Note any hour whose colours are off in the session log with what's wrong.
- [ ] **Step 3:** Commit `feat(world): nine recoloured skies and the nine stills`.

### Task 8: Manifest and the pack report

**Files:**
- Create: `tools/world/manifest.ts`, `tools/world/pack_report.ts`, `src/assets/manifest.ts`, `public/world/manifest.json`
  (generated), `tests/unit/packReport.test.ts`
- Modify: `package.json` scripts: `"world": "python tools/world/export_hours.py && python tools/world/bake_base.py && python tools/world/prep_sky.py && python tools/world/prep_stills.py && node tools/world/bake_flights.ts && node tools/world/manifest.ts"`,
  `"world:report": "node tools/world/pack_report.ts"`

**Interfaces:**
- Produces (`src/assets/manifest.ts`):
  ```ts
  export type Stage = 'A' | 'B';
  export interface FileEntry { path: string; bytes: number; sha256: string; stage: Stage; stops: StopId[] | 'all' }
  export interface Manifest { version: 1; base: { heights: GridMeta; ring: RingMeta }; files: FileEntry[] }
  export interface Budgets { stageABytes: number; perStopBytes: number }
  export const BUDGETS: Budgets; // { stageABytes: 1.2e6, perStopBytes: 3e6 }
  export function checkBudgets(m: Manifest, b: Budgets): { ok: boolean; lines: string[] };
  ```
  Stage A = `sky/golden.jpg`, `stills/golden.webp`, `stills/poster.webp`; everything else stage B. Each sky and still
  belongs to its stop; base files are `'all'`. Per-stop bytes = files listing that stop.
- `pack_report.ts` prints a table (file, bytes, stage, stops), totals per stop and stage A, exits 1 if `!ok`.

- [ ] **Step 1: Write failing tests** with a fixture manifest: stage A at 1.3e6 → `ok: false` and a line naming stage A;
  a stop at 2.9e6 → ok; at 3.1e6 → `ok: false` naming that stop.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS; `npm run world:report` → exit 0 and the
  table. **Step 5:** Commit `feat(assets): world manifest and the pack budget report`.

### Task 9: Loader and sky residency

**Files:**
- Create: `src/assets/loader.ts`, `src/assets/skies.ts`, `tests/unit/skies.test.ts`

**Interfaces:**
- Consumes: `Manifest`, `Track`, `nearestStop`.
- Produces:
  ```ts
  export function loadManifest(): Promise<Manifest>;
  export function fetchBinary(path: string): Promise<ArrayBuffer>; // relative to /world/
  export interface SkyAmbient { ambientSky: RGB; ambientGround: RGB } // from sky.json
  export function loadSkyAmbients(): Promise<Record<StopId, SkyAmbient>>;
  export function skiesToHold(stopIndex: number, kind: 'stop' | 'flight', b: number): number[]; // current, next, previous; in flight a and b first
  export function pickSkyTexture<T>(want: number, loaded: ReadonlyMap<number, T>, fallback: T): T; // nearest loaded index by journey distance, else fallback
  export interface SkyStore { get(index: number): Texture; update(frame: FrameState): void } // starts loads per skiesToHold, releases others
  export function createSkyStore(manifest: Manifest, fallback: Texture): SkyStore;
  ```
  Stage A downloads in parallel first; stage B starts when A resolves (the slice's order, spec §12). The world base loads
  in stage B. Skies beyond ±1 stop are disposed.

- [ ] **Step 1: Write failing tests:** `skiesToHold(4, 'stop', 4)` = `[4, 5, 3]`; at index 0 no −1; `pickSkyTexture(6,
  map{4, 5}, F)` returns 5's texture (Review Focus 1); empty map → `F`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(assets): staged loader and sky residency`.

### Task 10: Render pipeline, light uniforms, sky

**Files:**
- Create: `src/render/pipeline.ts`, `src/world/part.ts`, `src/world/light.ts`, `src/world/sky.ts`, `tests/unit/light.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // part.ts
  export interface WorldFrame { state: FrameState; hour: HourPreset; skyA: number; skyB: number; pose: Pose; timeS: number; dtS: number }
  export interface WorldPart { readonly object: Object3D; update(f: WorldFrame): void; setTier(t: TierSettings): void; dispose(): void }
  // light.ts
  export interface LightValues { keyDir: Vec3 /* three */; keyColor: RGB; ambSky: RGB; ambGround: RGB; fogColor: RGB;
    fogDensity: number; exposure: number; skyGain: number; skyTint: RGB; stars: number; moonDir: Vec3; moonSize: number; moonStrength: number }
  export function lightValues(hour: HourPreset, ambA: SkyAmbient, ambB: SkyAmbient, skyWeight: number): LightValues; // pure
  export interface LightUniforms { /* one TSL uniform per LightValues field */ apply(v: LightValues): void }
  export function createLightUniforms(): LightUniforms;
  // sky.ts
  export function createSky(u: LightUniforms, skies: SkyStore): WorldPart;
  // pipeline.ts
  export interface Pipeline { renderer: WebGPURenderer; backend: 'webgpu' | 'webgl2'; setScene(s: Scene, c: Camera): void;
    setTier(t: TierSettings, dpr: number): void; resize(w: number, h: number): void; render(): void; warmUp(): Promise<void> }
  export function createPipeline(host: HTMLElement, forceWebGL: boolean): Promise<Pipeline>; // throws if no GPU path
  ```
- Port: renderer setup from main.js "renderer" (sized to `100lvh`); post from "post: bloom (tiered) + the renders' vivid
  grade" (ACES, saturation 1.32, warmth, vignette, bloom `0.22, 0.45, 1.6`), exposure from `LightValues`; sky from
  "sky (the real photo, recoloured offline)" with two textures blended by `skyWeight`. Stars: hashed cells on the sky
  direction, density × `stars`, faded below 5° elevation. Moon: a soft disc of `moonSize` degrees at `moonDir`,
  brightness `moonStrength`. Fog: exponential, `fogDensity = fogAmount × 0.0005` (tune by eye).
  `warmUp()` = `renderer.compileAsync(scene, camera)` then one hidden render (canvas still transparent).

- [ ] **Step 1: Write failing tests** (`light.test.ts`, pure): `lightValues` converts coast `[0, 1, 0]` key dir to three
  `[0, 0, -1]`; `skyWeight` 0 gives `ambSky` of A, 1 of B; `moonStrength` is 0 when `hour.moon` is null.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(render): pipeline, shared light uniforms and the two-sky blend with stars and moon`.

### Task 11: Boot — scroll, frame, sky, governor

**Files:**
- Create: `src/app/boot.ts`, `src/app/params.ts`, `tests/unit/params.test.ts`
- Rewrite: `src/quality/tiers.ts`, `tests/unit/tiers.test.ts`; Modify: `src/quality/governor.ts`, `tests/unit/governor.test.ts`

**Interfaces:**
- `params.ts`: `export interface Params { tier?: Tier; p?: number; stop?: StopId; hud: boolean; stills: boolean; webgl: boolean; nogl: boolean }`,
  `readParams(search: string): Params` (`?tier=low|mid|high`, `?p=0..1`, `?stop=<id>` (unknown → undefined), `?hud`,
  `?stills=off`, `?webgl`, `?nogl`).
- `tiers.ts`: `export type Tier = 0 | 1 | 2` (low, mid, high); `export interface TierSettings { scale: number; reflect: number; bloom: boolean }`;
  `TIERS` per Global Constraints; `bootTier(hints: DeviceHints): Tier` → 1, or 0 with save-data; `clampTier(n): Tier`.
- `governor.ts`: same algorithm and options; ceiling becomes 2 for both backends; `clampTier` without the backend arg.
- `boot()`: `#track` height = `track.total` screens; each frame: `u = scroll.progress() × track.total` →
  `frameAt` → `poseAt` → `blendHours(HOURS[a], HOURS[b], hourWeight)` → parts `update` → `pipeline.render()`;
  governor samples with `canChange = frame.resting`. First paint: poster + name; when stage A is in and `warmUp()`
  resolves, add `html.is-scene-ready` (canvas fades in over 600 ms). `?nogl` or a pipeline throw → `html.is-stills`,
  canvas hidden, the loop keeps running the overlay only (the stills themselves are drawn by Task 13).

- [ ] **Step 1: Write failing tests:** `readParams('?stop=foo').stop === undefined` (Review Focus 2);
  `readParams('?tier=high').tier === 2`; `bootTier({saveData: true, ...}) === 0`, otherwise 1 even with `coarsePointer`;
  governor tests adapted to three tiers (existing cases, new numbers).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Manual: `npm run dev`, scroll the whole night on this laptop with the sky as the only part; every stop
  the sky turns through nine hours and the camera flies (no ground and no stills yet).
- [ ] **Step 6:** Commit `feat(app): boot the whole night: scroll, frame, parts and the governor`.

### Task 12: Terrain and sea

**Files:**
- Create: `src/world/terrain.ts`, `src/world/sea.ts`

**Interfaces:**
- Consumes: `createHeightSampler`, `Manifest.base`, `LightUniforms`, `TierSettings`.
- Produces: `createTerrain(heights: Uint16Array, ring: Uint16Array, colour: Texture, meta: Manifest['base'], u: LightUniforms): WorldPart`;
  `createSea(heightTex: DataTexture, meta: GridMeta, u: LightUniforms, tier: TierSettings): WorldPart`.
- Terrain = **one** mesh for the base grid (positions in three coords, normals from the heights, UV → `colour.webp`) +
  **one** ring mesh (discard fragments inside the base rectangle). Material ported from main.js "terrain"
  (`terrainMaterial`), with the sand/rock textures replaced by the colour map for now: lambert key light + hemisphere
  (`ambSky` above, `ambGround` below) + fog. Two draws.
- Sea = main.js "sea": the 16 km plane, `reflector({ resolutionScale: tier.reflect })`, six ripples faded per pixel size,
  shore foam from a half-float height texture made from `heights.bin`, `swell`/`chop` from the hour. Wet-sand sheen only
  near the camera (s02).
- Note in the session log: from low flights in the cove the 8 m ground is rough by design; detail returns in M3.

- [ ] **Step 1:** Add both parts to the parts list in `boot.ts` (Task 11); the base loads in stage B.
- [ ] **Step 2:** Verify in headed Playwright on this laptop: at `?p=0.5` and `?stills=off` the screenshot shows sky,
  land and sea with no console errors; `renderer.info.render.drawCalls` ≤ 8 with sky, terrain (2), sea and its mirror.
- [ ] **Step 3:** Commit `feat(world): world-wide terrain and the reflecting sea`.

### Task 13: Overlay — label, stills, rail, links, jumps, touch snap

**Files:**
- Create: `src/overlay/stage.ts`, `src/overlay/rail.ts`, `src/overlay/links.ts`, `tests/unit/links.test.ts`,
  `tests/e2e/links.spec.ts`

**Interfaces:**
- `stage.ts`: `createStage(root: HTMLElement): { update(frame: FrameState, stops: readonly Stop[], stillsOn: boolean): void; setVeil(opacity: number): void }`
  — `#place` text `"<numeral> · <hour> · <place>"` of the resting stop, opacity follows `stillWeight`; the still `<img>`
  of `a` and `b` with opacity `stillWeight` (lazy: `src` set when the stop is within ±1); `#veil` uses `fade`. Under
  `html.is-stills` the still of `nearestStop(u)` shows at full opacity at every position (Review Focus 3).
- `rail.ts`: `createRail(nav: HTMLElement, stops: readonly Stop[], go: (i: number) => void): { setCurrent(i: number): void }`
  — nine `<a href="#<id>">` with numeral + hour, `aria-current="location"` on the current one.
- `links.ts`: `export function targetFromLocation(hash: string, search: string): number` (−1 → start at 0);
  `export function jumpPlan(from: number, to: number): 'glide' | 'fade'` (`|to − from| ≤ 1` → glide, else fade);
  `createJumps(scroll: ScrollController, track: Track, stage): { go(i: number): Promise<void> }` — fade: veil to 1 over
  400 ms, `scrollToProgress(stopCentre/total, true)`, wait for the target sky or 500 ms, veil to 0 over 400 ms. Hash on
  first load jumps without a fade. `createTouchSnap` with `stops = stopCentre(i)/total`.

- [ ] **Step 1: Write failing tests:** `targetFromLocation('#night', '') === 4`; `('#foo', '') === -1`;
  `('', '?stop=sunrise') === 8`; `jumpPlan(0, 1) === 'glide'`, `jumpPlan(0, 5) === 'fade'`. E2E `links.spec.ts`:
  `/#midnight` shows `#place` text `VI · Deep midnight · The ridge`; `/#foo` shows `I · Golden hour · The beach` with
  no console error; clicking rail "IX" ends with `aria-current` on IX; `/?nogl` shows the name and a still at the top and
  after scrolling to the end (Review Focus 3).
- [ ] **Step 2–4:** FAIL → implement → PASS (`npm test`, `npx playwright test links --project=chromium`).
- [ ] **Step 5:** Commit `feat(overlay): place labels, stills, the nine-place rail and links`.

### Task 14: HUD, bench and census

**Files:**
- Create: `src/overlay/hud.ts`, `src/app/bench.ts`, `tests/e2e/census.spec.ts`

**Interfaces:**
- `hud.ts`: `?hud` → a corner panel updated twice a second: fps (1 s), worst frame (1 s), draws, triangles, tier,
  backend, segment (`flight IV→V 0.42` / `stop V`), bytes loaded; buttons low/mid/high and `stills on/off`. The fps
  clock starts at the first rendered frame (s02 lesson).
- `bench.ts` (always present; tiny):
  ```ts
  declare global { interface Window {
    __flight(tier: 'low' | 'mid' | 'high', seconds: number): Promise<{ frames: number; fps: number; p95: number; max: number; over20: number; over50: number }>;
    __census(): Promise<Array<{ stop: StopId; draws: number; triangles: number; materials: number }>>;
  } }
  ```
  `__flight` drives `u` from 0 to `total` linearly over `seconds` (bypassing Lenis), counting per-rAF intervals.
  `__census` jumps to each stop with `?stills=off` behaviour, waits two frames, reads `renderer.info.render` and counts
  unique materials over `scene.traverseVisible`.
- `census.spec.ts` (chromium only): `/?stills=off&tier=low`, wait for `html.is-scene-ready` (timeout 90 s: software
  WebGL), run `__census()`, expect 9 rows, every `draws ≤ 60`, `materials ≤ 14`.

- [ ] **Step 1:** Write `census.spec.ts` → FAIL (`__census` missing). **Step 2:** Implement. **Step 3:** PASS.
- [ ] **Step 4:** Commit `feat(dev): HUD, flight benchmark and the draw/material census`.

### Task 15: CI and budgets

**Files:**
- Modify: `.size-limit.json` (limit `400 KB`, name `JavaScript (all chunks, gzip)`), `.github/workflows/ci.yml`
  (after "JavaScript size budget": `- name: World pack budget` / `run: npm run world:report`), `playwright.config.ts`
  (keep chromium, firefox, webkit; census and load tests `test.skip` unless chromium)
- Create: `tests/e2e/load.spec.ts`

**Interfaces:**
- `load.spec.ts` (chromium): CDP `Network.emulateNetworkConditions` at 10 Mbit/s down, 40 ms latency, cache off. Expect
  `#name` visible < 1000 ms; record when every stage A file has finished (Resource Timing) and expect < 3000 ms. The true
  first-view time (live scene on screen) is measured on this laptop in Task 16, not in CI (software rendering).

- [ ] **Step 1:** Write `load.spec.ts` → run → expect PASS or a real number to fix. **Step 2:** `npm run check && npm test
  && npm run build && npm run size && npm run world:report && npm run e2e` → all PASS.
- [ ] **Step 3:** Commit `ci: 400 KB code budget, world pack budget, census and load checks`.

### Task 16: Measure the rough night and show the owner

**Files:**
- Create: `.superpowers/m0/report.html` (offline, not in git; the slice's `make_report.py` pattern),
  session log `docs/handover/sessions/<date>-s04-m0-rough-night.md`

- [ ] **Step 1:** Production build, `node .superpowers/spike/golden-cove/tools/serve_like_pages.mjs`-style server on
  `dist/`; headed Playwright on this laptop (WebGPU): `__flight('mid', 40)`, `__flight('low', 40)`, `__flight('high', 40)`,
  each in its own short call (< 120 s, s02 lesson). Then `?webgl` once on mid. Record frames, fps, p95, max, over20, over50.
- [ ] **Step 2:** Throttled load (10 Mbit/s): name time, stage A done, live scene on screen (`is-scene-ready`).
- [ ] **Step 3:** Owner's phone over Wi-Fi (`vite preview --host`): owner records the screen with `?hud` through the whole
  night; read fps per second off the recording, as in s02.
- [ ] **Step 4:** Look at every flight at mid and write honestly what reads badly (expected: box edges, bare land, the
  cave camera inside a pit, the 8 m cove from low flights). Each becomes an M1 item or is marked "detail comes in M3–M7".
- [ ] **Step 5:** Build the offline report (numbers vs the §14 budgets, flight screenshots, my verdict) and give it to the
  owner. M0 is done when the 5.8 km flies at 60 fps on mid on this laptop and on the phone's default, or the gaps are
  measured and the owner has seen them.
- [ ] **Step 6:** Session log + HANDOVER §2; ask before committing the docs.
