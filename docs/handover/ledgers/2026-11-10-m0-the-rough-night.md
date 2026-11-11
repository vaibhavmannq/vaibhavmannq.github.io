# SDD ledger — plan: docs/superpowers/plans/2026-11-10-m0-the-rough-night.md
Setup: Ruling: branch `world` created in place, not a separate worktree — owner approved commits on `world`; the slice and .superpowers paths are relative to this checkout — cost if wrong: none (branch is isolated).
Pre-flight:
- T3 produces Stop/HourPreset/toThree; T4,T5,T10,T13 consume — consistent.
- T5 produces HeightAt/GridMeta/RingMeta; T6 produces heights.bin + base.json meta; T8 manifest.base consumes GridMeta/RingMeta — consistent (T5 bake step waits for T6, as planned).
- T8 produces Manifest/FileEntry; T9 consumes — consistent.
- T9 produces SkyStore/SkyAmbient; T10 consumes (lightValues takes SkyAmbient) — consistent.
- T10 produces Pipeline/WorldPart/LightUniforms; T11 boot, T12 terrain/sea consume — consistent.
- T11 sets html.is-stills; T13 draws stills under it — consistent after the self-review edit.
- T12 tiers: TierSettings {scale, reflect, bloom} produced in T11; T12 sea consumes `tier.reflect` — consistent.
Task 1: Ruling: projects.test.ts kept but its router assertion replaced by a slug-format check — the router was Moonsink's and is deleted; deep links to projects return in M5 — cost if wrong: one test to restore
Task 1: complete (commits a4f6b49..46d891e, tests: npx playwright test smoke --project=chromium →   1 passed (4.0s))
Task 2: complete (commits 46d891e..2754314, tests: python tools/world/test_coastlib.py → ok 14/14)
Task 3: Ruling: added src/journey/shots.ts (typed view of shots.json) and exported sunDir() from hours.ts — the plan's types need one typed reader of the JSON — cost if wrong: none.
Task 3: Ruling: the moon's key strength is coast.py's lamp energy (moon[4]), same scale as sun_str, not moon[4]/10 — one scale for sun and moon; the renderer converts Blender energy once (Task 10) — cost if wrong: night too bright/dark until tuned by eye.
Task 3: Ruling: coastlib.load() takes style="hybrid" by default — the approved renders used --style hybrid — cost if wrong: none (ground() is style-independent).
Task 3: complete (commits 2754314..bffc9be, tests: npx vitest run tests/unit/hours.test.ts tests/unit/stops.test.ts →    Duration  312ms (transform 64%, import 21%, worker 7%, tests 7%))
Task 4: complete (commits 3574355..38480ab, tests: npx vitest run tests/unit/timeline.test.ts →    Duration  245ms (transform 63%, import 23%, tests 8%, worker 6%))
Owner (mid-run): handover notes stay local, never pushed. HANDOVER.md + docs/handover/ removed from world history with filter-branch (local only), restored to disk, ignored via .git/info/exclude. Commit hashes rewritten: a4f6b49→177749b, 46d891e→decf44a, 2754314→c2941b5, bffc9be→117aa10, 3574355→252f40e, 38480ab→da0c9e5. Task 5 BASE = da0c9e5.
Task 5: Ruling: bake_flights.ts reads public/world/base/base.json for the grid meta, not manifest.json — the manifest arrives in Task 8, after the bake — cost if wrong: none.
Task 5: Ruling: added APPROACH points for midnight>beforedawn (enter the cave from the north) — a straight descent from the ridge would cut through the cave hill — cost if wrong: one awkward turn into the cave, fixed in M7.
Task 5: Ruling: tsconfig.node.json allows .ts import extensions so tools run under Node type stripping — cost if wrong: none.
Task 6: Ruling: 'flat ground' in the bake test means flat across a whole 8 m cell (ground within ±8 m varies < 1 m), and 300 random points were added — the 1 m slope test let a cliff-edge point through; 103 points now checked — cost if wrong: none.
Task 6: complete (commits 1bc1436..0515c0d, tests: python tools/world/test_bake_base.py → ok 103 flat points within 0.6 m; base files 0.48 MB)
Task 5: complete (commits da0c9e5..f527c2e, tests: npm test →              at least ~1.10s faster with isolate: false — reuses workers across files instead of one per file)
Task 7: Ruling: the per-hour gain (hdri_gain) is applied live, not baked into the sky files — two skies with different gains must blend in the shader; sky.json ambients include the gain — cost if wrong: none.
Task 7: Ruling: HourPreset.skyTint will be [1,1,1] for every hour (Task 10) — coast.py's hybrid style ignores sky_tint (tint B = (1,1,1) when HYBRID) — cost if wrong: none; the renders were hybrid.
Task 7: note: night and midnight skies are navy with the photo's moon glow and no aurora (M2).
Task 7: complete (commits 5738e97..f29c946, tests: python tools/world/prep_stills.py → sunrise      112.4 kB)
Task 8: Ruling: the manifest carries the base grids' meta and each sky's ambient light (base.json and sky.json are inlined, not listed as downloads) — one fetch at boot instead of three; Task 9's loadSkyAmbients reads the manifest — cost if wrong: none.
Task 8: Ruling: per-stop bytes count only files listing that stop; the shared world base is reported on its own line — counting it in every stop would count one download nine times — cost if wrong: none.
Task 8: complete (commits f29c946..c035799, tests: npx vitest run tests/unit/packReport.test.ts →    Duration  258ms (transform 63%, import 20%, worker 10%, tests 7%))
Task 9: Ruling: SkyStore gained ready(index) (resolves when a stop's own sky is loaded) — Task 13's jump waits for the target sky — cost if wrong: none.
Task 9: Ruling: site code imports three from 'three/webgpu' only (flights.ts switched from 'three') — one renderer build in the bundle, as the old site did; Node loads it fine — cost if wrong: none.
Task 9: complete (commits a80a5dd..94d1f5d, tests: npx vitest run tests/unit/skies.test.ts →    Duration  272ms (import 61%, transform 31%, worker 4%, tests 3%))
Task 10: Ruling: LightUniforms also owns the three lights (key, bounce fill, hemisphere) and the scene fog, and apply() takes the camera position — the slice lit its standard materials with real lights alongside the uniforms; one owner keeps them in step — cost if wrong: none.
Task 10: Ruling: light scale factors (key 0.6, exposure 0.84, fog 0.0027 x fog_amt, fog colour 0.65, hemisphere 2.0) come from the slice's tuned Golden/Sunset numbers, not the plan's 'fogAmount x 0.0005' — the plan's fog factor was a guess 5x weaker than what the slice tuned by eye — cost if wrong: retune by eye in Task 16.
Task 10: Ruling: Pipeline.setTier takes {scale, bloom} (PipelineTier) — the new TierSettings arrives in Task 11 and satisfies it — cost if wrong: none.
Task 10: Ruling: sky part exposes colorAt(dir) for water and wet-sand reflections (the slice's skyColorAt) — Task 12 needs it — cost if wrong: none.
Task 10: note: the sky's look is verified in the browser in Task 11 (first place it is wired).
Task 10: complete (commits 94d1f5d..40a33e9, tests: npx vitest run tests/unit/light.test.ts →    Duration  307ms (import 54%, transform 40%, worker 3%, tests 3%))
Task 11: Ruling: Governor's constructor drops the webgpu argument (ceiling 2 on both backends); governor and refresh-simulation tests remapped from tiers 0-4 to 0-2 with the same logic — spec §13: three tiers, cost only — cost if wrong: none.
Task 11: Ruling: boot returns an App handle (track, scroll, scene, camera, pipeline, setTier, addPart, onFrame hooks, override) — Tasks 12-14 hang terrain, overlay, HUD and bench on it — cost if wrong: none.
Task 11: note: verified in headed Chrome (WebGPU): scene ready at 0.82 s on the dev server; Golden sky, Dusk sky mid-flight III>IV, Night stars all render; first dev load can stall once while Vite pre-bundles (not a site bug).
Task 11: complete (commits 40a33e9..957ac18, tests: npm test →              at least ~1.42s faster with isolate: false — reuses workers across files instead of one per file)
Task 12: IN PROGRESS (wip commit). terrain.ts + sea.ts written and loaded as stage B in boot.ts (loadBase). Left: one tsc error in src/world/sea.ts (reflection/mix node typing near the 'col' line); then verify in headed Chrome at ?p=0.5&stills=off (draws <= 8, no console errors) and commit properly. Then Tasks 13-16.
Task 12: Ruling: createTerrain also takes the Sky (for the wet-sand mirror, sky.colorAt) — the slice's terrain sheen samples the sky — cost if wrong: none.
Task 12: Ruling: the colour uniforms are cast to vec3 where multiplied by a vector (@types/three types UniformNode<'color'> without vector math) — type-only — cost if wrong: none.
Task 12: Ruling: boot exposes window.__app in dev builds only — needed to read renderer.info from the test browser, and by Task 14 — cost if wrong: none (stripped from production).
Task 12: Ruling: the draw budget counts every draw in the frame including bloom's passes (measured: 20 at the Golden stop, ~7 scene + mirror, ~13 bloom) — honest against spec §14's <=60 — cost if wrong: none.
Task 12: verified in headed Chrome, WebGPU, ?p=0.02&stills=off: sky, ground, ring, sea with mirror, sun column, shore foam; 20 draws, 0.92 M triangles, no console errors.
Task 12: complete (commits 957ac18..854110c, tests: npx tsc --noEmit → (no output))
Task 13: Ruling: the overlay runs its own requestAnimationFrame loop from the first frame and drives Lenis there; the render loop only reads the scroll — labels, stills and links must work before the GPU is ready and with no GPU at all (spec §2, Review Focus 3) — cost if wrong: one extra rAF callback per frame.
Task 13: Ruling: touch snap points are [0, stop centres 1-7, 1] (snapStops) — touchSnap expects ascending points from 0; the page top is Golden and the bottom is Sunrise — cost if wrong: none.
Task 13: Ruling: the rail is built with DOM nodes, not innerHTML — no HTML strings, even from fixed data — cost if wrong: none.
Task 13: note: links e2e written before the code but first run after it; proven RED by stashing the overlay (4/4 failed on the previous code), then GREEN 5/5 with smoke.
Task 13: complete (commits 854110c..3d285ea, tests: npx playwright test links smoke --project=chromium →   5 passed (12.2s))
Task 14: Ruling: the census reads renderer counters through an after-render hook (afterRenders), not on plain rAF — the counters reset every animation frame and the pacer skips frames, so rAF reads saw 0 draws (found by the test) — cost if wrong: none.
Task 14: Ruling: App gained stills (HUD toggle) and stageB (promise for the world base) — the benchmark and census must wait for the ground and sea — cost if wrong: none.
Task 14: verified: census in headless Chromium (software WebGL2) on low: every stop 8 draws, 3 materials, 0.92 M tris; HUD in headed Chrome (WebGPU, mid) 60 fps, worst 17 ms, 20 draws mid-flight III>IV.
Task 14: complete (commits 3d285ea..218bdf1, tests: npx playwright test census --project=chromium →   1 passed (36.6s))
Task 15: verified: npm run check/test/build/size/world:report all green (JS 263 kB gzip of 400; stage A 0.20 MB of 1.20); npm run e2e 17 passed, 4 skipped (census+load are Chromium-only) across chromium/firefox/webkit; load at 10 Mbit/s: name 165 ms, stage A files 891 ms.
Task 15: complete (commits 218bdf1..c0a1cc5, tests: npm run world:report → world base (shared by every stop) 0.48 MB)
Task 16: Ruling: the benchmark dispatches a pointermove each frame — the loop's 8 s idle mode halved the frame rate during override-driven flights (measured 40.4 fps mid / 30 fps low before; 60 after); a scrolling visitor sends input anyway — cost if wrong: none.
Task 16: Ruling: skies decode through ImageBitmapLoader (flipY at decode, texture.flipY false; bitmaps closed on release) — a 51 ms first-visit frame came from <img> decode on first draw; after the change first-visit WebGPU mid is 60.0 fps, max 17.2 ms — cost if wrong: none.
Task 16: measured (prod build, Pages-like server, headed Chrome, Intel UHD): WebGPU DPR1 low/mid/high 60.0 fps, max 17.2-17.4; DPR1.5 mid 59.3 (max 33.7, 0 over 50), high 59.7 (1 frame 50.1); WebGL2 DPR1.5 mid first flight 57.5 (4 frames 50-83 ms at u 2.1-4.15, once per visit), later flights 60.0 clean. Load at 10 Mbit/s DPR1.5: name 0.33 s, live scene 1.70 s, base in 1.87 s, 0.86 MB.
Task 16: look (17 frames, stills off): night far too bright (moon key), blue hour washed out, fog/sky horizon line on high flights, box shapes from the air, before-dawn pit, last flight blocked by a hill. Report: https://claude.ai/artifact/ATrTre9W7QWS4syahUhq1Q
Task 16: WAITING on the owner's phone recording (step 3) and verdict; not complete.
Final review: fresh reviewer (opus): 1 Critical, 5 Important, 11 Minor. Owner's phone recording (s04) read second by second: phone started on low (governor), 50-67 ms frames on every tier.
Final: fixed C1 fling shows black sky — skies.test 'keeps showing the old sky while a fling waits' + 'releases far skies only once the near ones have arrived' RED→GREEN, suite 145/145
Final: fixed I1 failed load never retries / warns every frame / veil stuck — skies.test 'warns once ... retries after a pause' + links.test 'lifts the veil even when the place fails to load' RED→GREEN, suite 145/145
Final: fixed I2 deep links wait for Golden's sky — e2e links 'loads that place's sky first' RED (old build fetched only golden.jpg) → GREEN, e2e 18/18
Final: fixed I3 governor ignores hand-picked tiers and steps down on loading hitches — governor.test 'ignores the first seconds' + 'takes a hand-picked tier' RED→GREEN; boot: 3 s warm-up, reset on hand-picked tier and after stage B, suspended while the benchmark drives or ?tier= pins; suite 145/145
Final: fixed I4 reduced motion still flies — camera.test 'never flies' RED→GREEN, suite 145/145
Final: fixed I5 no-GPU jumps download skies — jumps.ready set only with a pipeline (no unit test: boot wiring; covered by e2e nogl test staying green)
Final: fixed phone hitches at flight starts — skies.test 'asks for nothing new when a flight starts' RED→GREEN (stops now also fetch the sky after next); skies uploaded on arrival (initTexture); stills decode before showing; overlay writes styles only on change. Measured 6x-slowed phone emulation, WebGL2, tier pinned: low 58.9 fps, 6 frames >50 ms, now at stop arrivals instead of flight starts.
Final: Ruling: load test measures the name by first contentful paint, not the test runner's round trip — under three parallel browsers the runner itself read 1.74 s while the paint was 0.31 s — cost if wrong: none.
Final: Ruling: I5 has no failing-test-first (boot wiring only; no seam to test without a browser GPU stub) — cost if wrong: a no-GPU jump waits up to 500 ms more.
Final: Ruling: tried hiding stills with visibility:hidden; it added repaint stalls at every place (measured 11 vs 6 slow frames), reverted — cost if wrong: none.
Final: minor (deferred): M1 yaw blend fragile near midnight>beforedawn (4.6° from a snap; 66° whip at the APPROACH corner) — revisit with M7's cave path
Final: minor (deferred): M2 imageOrientation flipY unsupported on Safari <17 / Firefox <98 — flip v in the sky shader instead
Final: minor (deferred): M3 skies no longer held still decode on arrival; load priority for state.a
Final: minor (deferred): M5 __flight/__census ship in production — gate behind ?bench
Final: minor (deferred): M6 committed tools/world/__pycache__, no __pycache__ in .gitignore; CI runs no Python tests or manifest hash check
Final: minor (deferred): M7 dead code (last/void last in boot; Params.stop unused)
Final: minor (deferred): M8 no-GPU e2e checks only the ends, not mid-flight
Final: minor (deferred): M9 overlapping fade jumps can lift the veil early (jump token)
Final: minor (deferred): M10 spec's save-data → stills and ?tier=stills not built (plan starts save-data on low)
Final: minor (deferred): M11 horizon line: sky has fog:false and the 16 km sea ends 2.9° below the horizon at cruise height — blend sky's lower band to fog colour / bigger sea (M1)
Task 16: phone round 2 read (governor bounce mid→high→low; flights 41–59 fps on low). Ground-shading hypothesis tested (4K proxy: 12.4 vs 12.5 fps) and rejected; switch reverted. Owner (D15): no more phone tests until I judge the build ready. Task 16 stays OPEN; next steps in docs/handover/sessions/2026-11-10-s04-m0-rough-night.md. Final review fix pass is done (commit 8ea1ad7); workspace kept until M0 is signed off.
s05: measured the per-pixel cost with GPU timer queries (WebGL2, 1080p high, fixed poses): bloom ~6.5 ms, empty scene through the post chain ~6 ms, sky ~3.5, terrain ~3.4, sea ~2.5 (mirror 1.6), stars/ground noise/foam/ripples < 1 ms each; flights and stops cost the same. No shader feature explains "flights slow on every tier".
s05: found: the blurred .poster (full-screen blur(18px)) stayed under a transparent canvas forever; the compositor blurred it on every frame no still covered (= every flight frame). Interleaved A/B Chrome traces, laptop: draw-and-swap 1.94/1.65/1.20 ms kept vs 0.69/0.72/0.53 hidden. Fixed: CSS hides it 700 ms after is-scene-ready; canvas alpha:false. e2e smoke 'the blurred poster leaves' RED→GREEN.
s05: fixed governor bounce: fast windows count toward a step-up only when most frames moved; the step-up waits for rest (pendingUp); a waiting step-down wins. governor.test 5 new (3 RED→GREEN, 1 RED→GREEN after the down-wins fix, 1 guard). Suite 151/151.
s05: found: arrival hitches = one synchronous texSubImage2D of a 2048x1024 ImageBitmap sky, 24–50 ms at 6x (Chrome converts bitmaps on the main thread). Raw bytes 9 ms. Fixed: skies decode in a worker (skyDecode.worker.ts, OffscreenCanvas, rows flipped there) and upload as DataTexture. skies.test 'wraps decoded RGBA rows' RED→GREEN. Screens identical to the old loader at 4 poses (only animated water differs). Arrival uploads now 4–12 ms at 6x. Also closes deferred minor M2 (imageOrientation).
s05: Ruling: e2e links/load watch requests instead of the page's resource timeline — worker fetches are not in it; checked Playwright sees them and CDP throttling applies to them (110 KB took 2.1 s at 400 kbit/s) — cost if wrong: none.
s05: Ruling: poster e2e waits 10 s, not 2 — headless renders the world in software, so a 700 ms CSS delay takes seconds — cost if wrong: none.
s05: results (prod, 6x-slowed phone emulation 412x915 x2.625 WebGL2, stills off): low 59.0–60.0 fps, 0 frames > 50 ms (was 54.2, 6 frames up to 100); mid 52–55, 0–3 > 50; high 42 (this GPU too slow at phone-high: governor's job). Stills on: low 55.5–58.8 with 2–3 frames 50–100 ms per night (stills are M0 scaffolding, replaced in M3–M7). Laptop WebGPU 1280x720 x1.5: 60.0/59.8/59.3, 0 > 50. 10 Mbit/s: name 0.30–0.61 s, live scene 1.04–1.39 s (s04: 1.70). All green: check, 151 unit, 19 e2e (+8 skips), JS 264.7 kB.
s05: minor (new, deferred): stage B's ground/sea shader finishes linking on first use: one 150 ms main-thread stall at 6x (~25 ms real) right after load.
s05: minor (new, deferred): stills cost 2–3 frames of 50–100 ms per night at 6x (compositor raster/upload of 1920 px images); goes away with the live places, or shrink stills for phones if they stay as the low-tier fallback.
s05 (11-11): phone over USB (adb + CDP). Hands-off flights 59.2–59.6 on every tier (Chrome and Brave). Refresh-switch hypothesis rejected (60 Hz throughout real swipes). Fixed stills repaint: `.stills img { will-change: opacity }` — e2e 'the stills fade on their own compositor layer' RED→GREEN; fast flings stills on 52 → 57.5 fps (A/B ×2). Brave flings low/mid/high 56.6/54.7/53.0, trace shows no long tasks. Found: insecure LAN URL → WebGL2; localhost/https → WebGPU. All green: check, 151 unit, 20 e2e (+10 skips).
Task 16: complete — owner's hands-on test 2026-11-11 (Brave, localhost over USB, WebGPU, no recorder): "running smoothly". M0 signed off at cdf951d.
