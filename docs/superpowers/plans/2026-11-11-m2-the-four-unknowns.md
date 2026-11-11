# M2, the Four Unknowns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The aurora, the sea of cloud, the waterfall and the inside of the cave each run live in one view (the Night,
Deep midnight and Before dawn stops), each with an honest % against its render and a measured cost on the laptop and
on the owner's phone, so each approach is kept or changed before the full places (M5–M7) are built on it.

**Architecture:** Four new world parts with the shared shape (`WorldPart`), one material each, loaded with the world
base and hidden (zero cost) wherever their hour or place is not in play. Shapes the render got from Blender-only
noise (the aurora's folds, the cave shell and its ragged mouth) are exported once from coast.py itself by a new
`--export` mode, so the live shapes are the approved ones; everything else is built in the browser from numbers in
`shots.json`. Looks are tuned against the renders with a side-by-side tool; costs are read with a per-part on/off
switch at a fixed camera.

**Tech Stack:** TypeScript + three.js 0.186 (`three/webgpu`, `three/tsl`), Vitest, Playwright; Python 3 + numpy
(world tools); Blender 5.2 in background mode for the one export; adb + Chrome remote debugging for the phone.

**Spec:** `docs/superpowers/specs/2026-11-10-realtime-world-design.md` (§7 rules, §9.3, §9.4, §9.8–§9.11, §13, §14,
§18 M2, §19). Decisions D4, D7, D13, D15, D17, D18 in `docs/handover/DECISIONS.md`.

## Global Constraints

- Composition is the renders': nothing here moves a camera, a band of the aurora, the falls, the cloud level (172 m)
  or the cave mouth. Live motion is added, shapes are not changed (spec §3 non-goals).
- Draws per frame ≤ 60 including the reflection pass, materials ≤ 14, triangles ≤ 2.5 M (census, spec §14).
- JavaScript ≤ 400 kB gzip; world base (shared) ≤ 1.0 MB; stage A ≤ 1.2 MB.
- Frame rate on the default tier: 60 at stops; ≥ 55 in flight; no frame over 50 ms, also when a part first appears
  (every new material is compiled before its part joins the scene).
- A part that is not in play is `visible = false`: no draw, no vertex work, nothing in the mirror pass.
- three.js only from `three/webgpu` and `three/tsl`. No new npm dependencies. Textures stay WebP (D14).
- Per-instance and per-vertex data go in attributes; any data texture is filled before its first upload (M1 lesson).
- Every coast.py change keeps it runnable in Blender and importable without it (numpy only above the
  `# ---------------- render setup` line). Blender runs use `--python-exit-code 1`.
- No AI attribution in commits or commit messages. Commit on `world` only; never push without asking.
- Not in M2 (my calls): fireflies, reeds, rock columns, project lanterns (M5); the ridge's tree, heather and grass
  (M6); vines, pool stones (M7); place packs and residency (M3; M2's files ride in the world base, 0.56 of 1.0 MB
  used); the two thin under-layers of the cloud (spec §9.10) unless the judged look shows it needs them.

## What "like the real thing" means here (references, 2026-11-11, owner's suggestion)

Real-time aurora films (Thierry Legault, Alan Dyer, Alexis Coram: not time-lapse) show mostly a slow steady glow whose
folds drift, with rays that shimmer sideways; fast "snapping" is rare. Moonlit cloud-inversion footage shows the deck
rolling like a slow ocean swell and lapping at ridges; in real time it is almost still. Waterfall breakdowns for games
agree on two scrolling noise layers (big and slow, small and fast), foam gathered where the water lands, and mist as
separate soft particles. Sea-cave photographers expose for the bright mouth: the inside is a silhouette, the mouth a
natural vignette, still pools mirror the opening; glow-worm caves read as a starry sky of points, not lamps.
So: **slow, uneven, never looping visibly.** Each part's motion constants below follow this.

## Review Focus

1. **A flight passes through or under the cloud deck** (the ridge stands 110 m above it; flights glide at 80–250 m).
   A one-sided sheet seen from inside is a hard line. Test in Task 4 (no flight pose inside the cloud's box is below
   the cloud top + 8 m while the cloud's weight is above 0.05); fix by the flight path, not by a shader trick.
2. **A part appears mid-flight and its shader compiles then** (a frame over 50 ms on the phone). Test in Task 7
   (`__flight` on every tier reports 0 frames over 50 ms; every part is compiled in `loadBase` while visible).
3. **The Blender-baked files are missing or stale** (CI has no Blender). Test in Task 2 (a plain Python check of
   `aurora.json` and `cave.bin` against `shots.json`: band count, sample count, mouth direction, floor height).
4. **Portrait phones see far more sky**: the aurora's top edge and the cave's ceiling show above the render's frame.
   Test in Task 7 (the compare tool also shoots 412×915; judged by eye, nothing ends in a cut line).
5. **WebGL2 differs from WebGPU** (old phones, the LAN address): same picture on both. Test in Task 7 (compare run
   with `?webgl`; census on software WebGL2 in CI already loads every part).

---

## File structure

| File | Responsibility |
|---|---|
| `tools/world/blender/coast.py` (modify) | `aurora_curve()` shared by the render and the export; `--caveseg`; `--export <dir>` runs `export_parts` instead of rendering |
| `tools/world/blender/export_parts.py` (create, Blender only) | writes `aurora.json` (night, midnight) and `cave.bin` + its meta (shell, floor, baked mouth light, fungi) |
| `tools/world/export_hours.py` (modify) | `shots.json` gains `aurora`, `cloudsea`, `falls`, `cave` blocks |
| `tools/world/bake_base.py` (modify) | keeps the other keys of `base.json` (deferred minor) |
| `tools/world/test_parts.py` (create) | checks the baked files without Blender |
| `tools/world/compare.ts` (create) | `npm run compare`: live stop beside its render, 16:9 and portrait |
| `src/journey/types.ts`, `hours.ts`, `shots.ts` (modify) | `HourPreset.aurora`, `.cloud` (0..1); the new shot blocks typed |
| `src/world/light.ts` (modify) | aurora tints the ambient light; the dead fog install goes (deferred minor) |
| `src/world/noise.ts` (create) | shared TSL helpers: `fbm2`, `remap` |
| `src/world/aurora.ts` (create) | the curtains: one merged ribbon mesh for both hours |
| `src/world/cloudSea.ts` (create) | the deck: one grid, displaced and lit in the shader |
| `src/world/waterfall.ts` (create) | sheet + foam + spray in one mesh |
| `src/world/cave.ts` (create) | shell + wet floor (one material), its mirror height |
| `src/world/glow.ts` (create) | small glowing things, instanced (first user: the fungi) |
| `src/world/sea.ts`, `terrain.ts` (modify) | the mirror is shared and can sit at the cave floor; terrain is cut out under the cave |
| `src/app/boot.ts`, `bench.ts`, `src/assets/manifest.ts`, `tools/world/manifest.ts` (modify) | load and add the parts; `__parts`, `__hold` |
| `tests/unit/{hours,light,aurora,cloudSea,waterfall,cave}.test.ts`, `tests/e2e/census.spec.ts` | checks |

---

### Task 1: The numbers and the looking tool

**Files:** modify `tools/world/export_hours.py`, `tools/world/bake_base.py`, `src/journey/{types,hours,shots}.ts`,
`src/world/light.ts`, `src/app/boot.ts`, `package.json`; create `tools/world/compare.ts`; tests
`tests/unit/hours.test.ts`, `tests/unit/light.test.ts`.

**Interfaces — produces:**
- `shots.json`, per hour: `aurora: null | { strength, rays, ray_min, foot, warp, haze, lean, core: RGB, low: RGB,
  high: RGB, yaw, bands: [az0, az1, el0, el1, hel, amp, k][] }` (`yaw` = the shot's look azimuth, which the bands
  are relative to); `cloudsea: null | { z, amp, box: [x0, x1, y0, y1], feather, low: RGB, high: RGB }`;
  `falls: null | { x, yLip, yPool, zTop, w0, w1, pool, poolY, spray: [sx, sy, sz], sprayZ }` (`zTop` =
  `ground(lx, ly + 73) − 0.5`, `yLip`/`yPool` from `falls_r`, as `build_waterfall` computes them);
  `cave: null | { x, y, floor, az, top, radii: [12, 10, 7.5], centreZ, pool: { x, y, r } }`.
- `HourPreset.aurora: number` (1 where the shot has an aurora, else 0) and `HourPreset.cloud: number` (1 at
  midnight); `blendHours` lerps both.
- `LightValues.aurora: number`, `LightValues.cloud: number`; `LightUniforms.aurora`, `.cloud` (uniform floats).
  `lightValues` adds `AURORA_AMBIENT = [0.02, 0.10, 0.05]` × aurora to `ambSky` (the render's `light=True`).
- `npm run compare -- <baseUrl> <outDir> [stops] [query]`: for each stop, 1920×1080 and 412×915, high, stills off,
  after 6 s; writes `<outDir>/index.html` with `public/world/stills/<id>.webp` beside each live frame.

- [ ] **Step 1:** failing tests: `hours.test.ts` "night and midnight carry an aurora, only midnight a cloud deck"
  (`HOURS.night.aurora === 1`, `HOURS.midnight.cloud === 1`, `HOURS.golden.aurora === 0`,
  `blendHours(HOURS.night, HOURS.midnight, 0.5).cloud === 0.5`); `light.test.ts` "the aurora greens the ambient
  light" (ambSky green rises by 0.10 at aurora 1, unchanged at 0) and "light installs no fog of its own".
- [ ] **Step 2:** run them, see them fail. `npx vitest run tests/unit/hours.test.ts tests/unit/light.test.ts`
- [ ] **Step 3:** export the blocks, run `python tools/world/export_hours.py`; add the preset fields, the light
  values and uniforms; delete `scene.fogNode` from `light.install` (boot sets the real one) and stop writing
  `base.json` from scratch in `bake_base.py` (read, update `heights`/`ring`/`colour`, write).
- [ ] **Step 4:** write `compare.ts` on the pattern of `aerials.ts`; run it once against the dev server for
  `night,midnight,beforedawn` into `.superpowers/m2/before/`: the "before" set.
- [ ] **Step 5:** `npx vitest run && python tools/world/test_bake_base.py` green; commit
  `feat(world): the four unknowns' numbers in the shots; a side-by-side look check`.

### Task 2: One export from Blender: the aurora's folds and the cave

**Files:** modify `tools/world/blender/coast.py`; create `tools/world/blender/export_parts.py`,
`tools/world/test_parts.py`, `public/world/base/aurora.json`, `public/world/base/cave.bin`; modify
`tools/world/manifest.ts`, `src/assets/manifest.ts`, `package.json` (`world:blender`).

**Interfaces — produces:**
- coast.py: `aurora_curve(b, band, n) -> [(az, el, h)] * (n + 1)` (the three noise lines of `build_aurora_sky`,
  which now calls it with n = 260); `CAVESEG = arg("--caveseg", 256)` used for the sphere's segments (rings =
  half); `EXPORT = arg("--export", "")`: when set, the scene build and the render are skipped and
  `export_parts.run(globals())` runs instead.
- `npm run world:blender`: Blender in background, `--hour night`, `--hour midnight` (aurora), `--hour beforedawn
  --caveseg 128` (cave), each `--style hybrid --export public/world/base`.
- `aurora.json`: `{ "samples": 131, "night": number[][], "midnight": number[][] }`, one flat array per band of
  131 × (az absolute degrees, el, h), rounded to 0.01.
- `cave.bin` (little-endian) with its meta under `base.json`'s `cave` key `{ file, shellVerts, shellTris,
  floorVerts, floorTris, fungi, scale }`: shell positions Int16 × 3 (cave-local, coast axes, `scale` units per
  metre), shell `open` Uint8 (−2..2 → 0..255), shell `light` Uint8, floor positions Int16 × 3, floor `light`
  Uint8, fungi Int16 × 3 + radius Uint8 (mm), then shell indices and floor indices Uint16; each block padded to 2
  bytes. Shell triangles with all three `open` > 0.45 (inside the hole beyond its noise) are dropped.
- **Baked mouth light** (spec §9.11's AO, done as what the scene needs): per vertex, the share of 24 points spread
  over the mouth opening that the vertex sees unblocked (`scene.ray_cast` against the shell), times the cosine to
  the surface normal, 0..1. Rock facing the mouth is lit, rock behind a bulge is not.
- Fungi: every object using the `bulb` material after `build_cave()`: location and radius (floor and wall
  clusters, so the wall ones sit on the displaced rock as rendered).
- `Manifest.base.cave?: CaveMeta`, `Manifest.base.aurora?: { file: string }`.

- [ ] **Step 1:** `test_parts.py` (fails: files missing): aurora has the hour's band count from `shots.json` and
  131 samples each, every az within the band's az0..az1 ± 1.6 × amp + 1, el within −5..90; cave: counts match the
  meta, every shell vertex within 13.5 m of the centre, the open direction (mean of vertices with `open` > 0)
  within 12° of `cave.az`, floor heights within 0.3 m of `cave.floor`, 150 ≤ fungi ≤ 700, light has both 0 and
  > 200.
- [ ] **Step 2:** refactor coast.py (render path unchanged: `test_coastlib.py` green), write `export_parts.py`,
  run `npm run world:blender`, then `node tools/world/manifest.ts`.
- [ ] **Step 3:** `python tools/world/test_parts.py` green; `npm run world:report` under budget; commit
  `feat(world): the aurora's folds and the cave exported from the Blender scene`.

### Task 3: The aurora

**Files:** create `src/world/noise.ts`, `src/world/aurora.ts`, `tests/unit/aurora.test.ts`; modify
`src/app/boot.ts`.

**Interfaces:**
- Consumes: `aurora.json`, `SHOTS[id].aurora`, `LightUniforms.aurora`, `WorldFrame`.
- Produces: `auroraGeometry(curves: number[][], cfg: AuroraShot, set: 0 | 1): BufferGeometry` (per band a 130 × 10
  quad strip on the unit sphere: `position` = direction at elevation `el + h·sv`, azimuth `az + lean·sv`; `uv` =
  (t, sv); `band` = vec4(seed = 11·b + 3, k, span = |az1 − az0| / 60, set));
  `auroraWeights(state: FrameState): [number, number]`; `createAurora(data, light): WorldPart`.
- `noise.ts`: `fbm2(p: vec2, octaves: number, rough: number): float` in 0..1 centred on 0.5 (Blender's noise
  `Fac`), `remap(x, a, b, c = 0, d = 1)` clamped (Blender's Map Range).

**Decisions:**
- A mesh, not sky-shader maths (changes spec §9.4's "same sky pass"): the folds swing back on themselves, which a
  per-pixel inverse cannot follow; a ribbon costs pixels only where the aurora is, and the lagoon's mirror pass
  draws it for free. Radius 9000 m around the camera, additive, no depth write, depth test on (hills stand in
  front of it), no fog, `renderOrder` 0 (after the sky).
- The fragment maths is `aurora_mat` node for node (warp, foot, rays, per-ray length, knots, edge, haze, the three
  colours). Brightness = `strength × k × AURORA_GAIN` (tuned by eye against the render, start 0.5).
- Night's set shows with Night's hour, midnight's with Midnight's: weight of set s = how much of that stop's hour
  is in the frame, so the two sets cross-fade on the V → VI flight and each fades to nothing toward IV and VII.
  `visible = false` when both are 0.
- Motion (references): the ray noise slides along the band at 0.004 band-lengths/s, the knots at 0.0015, the foot's
  wobble breathes at 0.0008; nothing pulses.

- [ ] **Step 1:** failing tests: "a band's strip has 131 × 11 vertices on the unit sphere, its foot at the baked
  elevation"; "night has 3 bands and midnight 3, told apart by the set flag"; "the weights are 1/0 at Night, 0/1 at
  Midnight, 0/0 at Dusk, and cross over on the flight between".
- [ ] **Step 2:** implement; add in `loadBase` (compiled visible, then hidden by its own `update`).
- [ ] **Step 3:** look loop: `npm run compare` for `night,midnight`; likes, dislikes, % against each render; tune
  until ≥ 80 % or name what blocks it. Record in the ledger.
- [ ] **Step 4:** `npx vitest run` green; commit `feat(world): the aurora: folded curtains over Night and Midnight`.

### Task 4: The sea of cloud

**Files:** create `src/world/cloudSea.ts`, `tests/unit/cloudSea.test.ts`; modify `src/app/boot.ts`,
`src/world/sea.ts` (the height texture is made once in `loadBase` and passed to both).

**Interfaces:**
- Consumes: `SHOTS.midnight.cloudsea`, the half-float height texture and `GridMeta`, `LightUniforms` (`moonDir`,
  `keyColor`, `keyStrength`, `ambSky`, `cloud`), `fbm2`.
- Produces: `cloudGrid(box, step): BufferGeometry` (flat grid at y = 0 in three.js axes);
  `CLOUD_TOP(cfg): number` = `z + 0.95·amp` (the highest the deck can reach, for the flight test);
  `createCloudSea(cfg, heights, meta, light): WorldPart`.

**Decisions:**
- One grid over the render's box, 8 m step (≈ 55 k vertices). Height in the vertex shader:
  `z + amp·(b1 − 0.5) + 0.45·amp·(1 − |2·b2 − 1|)`, b1 at 0.006/m (2 octaves), b2 at 0.03/m (2 octaves), the whole
  field drifting 0.6 m/s toward +x and the b2 crests 1.1 m/s (a slow swell; references). The normal from two more
  height samples. Finer billows (coast.py's higher octaves and b3) only tilt the normal in the fragment shader,
  faded out where one wave is smaller than two pixels (no shimmer at the horizon).
- Light: colour `mix(low, high, tops)`, times moon wrap `(N·L·0.5 + 0.5)^1.5` plus ambient, plus a rim
  `(1 − N·V)^3 × max(V·−L, 0)^2` toward the moon. Gains tuned against the render.
- Opacity: `clamp((cloud − ground) / feather, 0, 1)^0.7` with the ground from the height texture, so hills sink
  softly into it; × a 150 m fade at the box's edges; × `light.cloud`. Transparent, no depth write, depth test on,
  fog on, `renderOrder` 2, double-sided. `visible = false` at weight 0 or when the camera is over 4 km away.
- Hidden from the mirror pass if the cost table (Task 7) says the mirror is where it costs.

- [ ] **Step 1:** failing tests: "the grid covers the box at 8 m"; Review Focus 1: "no flight goes through the
  deck" (every baked flight pose whose x, y is inside the box and whose blended `cloud` weight > 0.05 has
  z > CLOUD_TOP + 8).
- [ ] **Step 2:** implement; if the flight test fails, raise that flight's waypoints in `tools/world/bake_flights.ts`
  and rebake (the hillside tests must stay green).
- [ ] **Step 3:** look loop on `midnight` and on the flights V → VI and VI → VII (`__flightPose`); %, ledger.
- [ ] **Step 4:** tests green; commit `feat(world): the sea of cloud under the midnight ridge`.

### Task 5: The waterfall

**Files:** create `src/world/waterfall.ts`, `tests/unit/waterfall.test.ts`; modify `src/app/boot.ts`.

**Interfaces:**
- Consumes: `SHOTS.night.falls`, `LightUniforms`, `fbm2`.
- Produces: `fallsGeometry(f: FallsShot): BufferGeometry`: one mesh, attribute `kind` 0 sheet (40 × 10 quads,
  `build_waterfall`'s lip-then-drop profile), 1 foam disc on the pool (radius `pool`, 1.5 × wide, 2 rings × 32),
  2 spray (28 quads, `corner` attribute, turned to the camera in the vertex shader, `seed` per sprite);
  `createWaterfall(f, light): WorldPart`.

**Decisions:**
- Sheet: alpha = streaks × streams × soft side edges; streaks = two noise layers falling at 9 m/s and 14 m/s
  (5 × 0.35 and 11 × 0.8 cycles), the falling speed growing down the drop (uv.y squared); streams = a 2.2-cycle
  noise across the lip (thick streams with veils between, `falls_streams`). Colour (0.72, 0.77, 0.82) × moon and
  ambient light, tuned so the sheet is the brightest thing in the crater but not self-lit.
- Foam: noise 0.9/m churning outward, strongest under the sheet, gone by the disc's rim. Spray: sprites inside
  `spray`'s box rising 0.4 m/s and fading over 6–10 s each, alpha ≤ 0.12, phases by seed (no visible loop).
- The lagoon's mirror shows all of it with no extra code (the water is the sea plane; the mirror pass draws the
  scene). `visible = false` beyond 2.5 km.

- [ ] **Step 1:** failing tests: "the sheet starts at the lip, 0.5 m under the wall top, and ends on the water";
  "the sheet is 20 m wide at the lip and 28 m at the pool"; "one mesh, three kinds, 28 spray sprites".
- [ ] **Step 2:** implement. **Step 3:** look loop on `night`; %, ledger. **Step 4:** tests green; commit
  `feat(world): the waterfall into the lagoon`.

### Task 6: The cave

**Files:** create `src/world/cave.ts`, `src/world/glow.ts`, `tests/unit/cave.test.ts`; modify `src/world/sea.ts`,
`src/world/terrain.ts`, `src/app/boot.ts`.

**Interfaces:**
- Consumes: `cave.bin` + `CaveMeta`, `SHOTS.beforedawn.cave`, the sea's mirror, `Sky.colorAt`, `LightUniforms`.
- Produces: `decodeCave(buf: ArrayBuffer, meta: CaveMeta): { shell, floor, fungi }`;
  `fungiLight(positions: Float32Array, fungi): Float32Array` (per vertex, Σ 1 / (1 + (d / 0.35)²), capped at 1);
  `mirrorHeight(camera: Vec3, cave: CaveShot): number`;
  `createCave(parts, shot, mirror, sky, light): WorldPart`; `createGlow(points, colour, strength): WorldPart`;
  sea part gains `mirror: { node, setHeight(y: number): void }`; `createTerrain(..., cut?: { x, y, rx, ry })`.

**Decisions:**
- One material for shell and floor (attribute `wet`: 0 on the shell). Shell: dark rock (0.32, 0.30, 0.34 × a noise
  mottle), lit only by `light` × the sky's colour toward the mouth, plus `fungiLight` × the fungi colour; drawn
  double-sided (the outside is what a visitor sees flying in; outside faces take the scene's ambient). The mouth
  is cut where `open + 0.55·(fbm − 0.5) > 0` (alpha test, no blending).
- Floor: where `wet` (noise 0.45/m mapped 0.47..0.56, or inside the pool's ellipse) the fragment shows the mirror
  with a small ripple; elsewhere rough rock with a grazing sheen. **The one mirror pass moves:** within 14 m of
  the cave the mirror plane sits at `floor + 0.1`; the sea outside still mirrors the sky correctly (the sky is at
  infinity) and only loses nearby things, which the cave view does not show mirrored.
- The base terrain is discarded inside an ellipse 11.5 × 9.5 m around the cave (its 8 m grid cannot hold the cut
  floor: the "pit" of M0/M1).
- Fungi: one instanced camera-facing disc each, colour `fungi_col` × `fungi_glow` scaled to bloom, a soft falloff;
  on low (no bloom) the disc is drawn 1.6 × larger with a soft edge instead.
- Exposure stays the hour's: expose for the mouth, the inside falls to near black (references).

- [ ] **Step 1:** failing tests: "decodeCave returns the meta's counts, in metres"; "the mouth faces the cove"
  (mean direction of `open` > 0 within 12° of `az`); "rock next to a fungus is lit, rock 3 m away is not";
  "the mirror sits at the floor inside the cave and at the sea outside it".
- [ ] **Step 2:** implement. **Step 3:** look loop on `beforedawn` and the arrival VI → VII; %, ledger.
- [ ] **Step 4:** tests green; commit `feat(world): the cave from inside: ragged mouth, wet floor, glowing fungi`.

### Task 7: What each one costs, on the laptop and on the phone; verdicts

**Files:** modify `src/app/bench.ts`, `src/app/boot.ts` (parts get names), `tests/e2e/census.spec.ts`; create
`.superpowers/m2/phone.mjs` (not in git); the ledger `docs/handover/ledgers/2026-11-11-m2-the-four-unknowns.md`.

**Interfaces — produces:**
- `App.addPart(part, name?)`; `window.__parts(off: string[])`: the named parts are held hidden (their `update` no
  longer shows them) until called again.
- `window.__hold(stop, seconds, tier): Promise<FlightResult>`: the camera rests at the stop, stills off, input kept
  alive, frames counted as `__flight` does. Where frames are pinned at the screen's rate, cost is read from the
  GPU's own time per frame (`?gpu`: the renderer tracks timestamps) or, on the phone, from a Chrome trace.

- [ ] **Step 1:** census: still ≤ 60 draws, ≤ 14 materials, ≤ 2.5 M triangles at every stop with the four parts in.
- [ ] **Step 2:** laptop, prod build, headed Chrome, 1280×720 ×1.5: for night, midnight, beforedawn and each tier,
  `__hold` with everything on and with each part off, interleaved twice (A/B/A/B); `__flight` on each tier. Table
  of ms per part into the ledger.
- [ ] **Step 3:** phone over USB (D18): `adb reverse`, `adb forward`, `connectOverCDP`; the same `__hold` table on
  mid and high and `__flight` on all three tiers, WebGPU (localhost) and WebGL2 (`?webgl`).
- [ ] **Step 4:** anything that breaks a budget gets its cheaper form (named per part above: mirror exclusion,
  per-vertex aurora noise, a coarser cloud grid) and is measured again.
- [ ] **Step 5:** full gate: `npm run check && npm test && npm run build && npm run size && npm run world:report &&
  npx playwright test`, `npm run world:test` in the background.
- [ ] **Step 6:** verdict per unknown (likes, dislikes, %, cost, keep or change) in the ledger and the session log;
  an artifact page with the four comparisons for the owner; then the owner's hands-on phone test (D15).
