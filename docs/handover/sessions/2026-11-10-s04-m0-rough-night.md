# Session s04 · 2026-11-10 · M0, the rough night, built and measured

(Started on the second account, hit a usage limit after Task 12's wip commit, resumed on the artifacts account.)

## Done

1. Executed `docs/superpowers/plans/2026-11-10-m0-the-rough-night.md` natively, Tasks 1–15 complete and committed on the
   local branch `world` (not pushed); Task 16 measured and reported, waiting on the owner's phone test. Ledger with every
   ruling: `.superpowers/sdd/2026-11-10-m0-the-rough-night/progress.md`.
2. Owner (mid-run): handover notes stay local. `HANDOVER.md` + `docs/handover/` were removed from the `world` history
   (filter-branch, local only), restored to disk, ignored via `.git/info/exclude`.
3. What exists now (src/): boot (overlay loop + render loop), journey (stops from coast.py, track ~21.3 screens,
   flights baked over the base, camera pose), world (sky with two-photo blend, stars, moon; 8 m base terrain + horizon
   ring with colour map; reflecting sea with shore foam; light uniforms), render pipeline (bloom + vivid grade), assets
   (manifest, loader, sky residency with off-thread decode), quality (3 tiers, governor), overlay (label, stills, rail,
   links, fade jumps, touch snap, HUD), bench (`__flight`, `__census`). tools/world/: coastlib.py (coast.py without
   Blender), export_hours.py, bake_base.py, prep_sky.py, prep_stills.py, bake_flights.ts, manifest.ts, pack_report.ts;
   `npm run world`, `npm run world:report`. CI: size 400 kB, world pack budget, census + load e2e (Chromium).
4. Results page (artifact): https://claude.ai/artifact/ATrTre9W7QWS4syahUhq1Q

## Measured (prod build, Pages-like server, headed Chrome, Intel UHD)

- WebGPU, 1280×720: low/mid/high 60.0 fps through the whole 5.8 km, worst 17.2–17.4 ms. At DPR 1.5: mid 59.3 (0 frames
  over 50 ms), high 59.7 (one 50.1 ms frame).
- WebGL2 DPR 1.5 mid: first flight 57.5 fps with 4 frames 50–83 ms between Sunset and Dusk (once per visit; not the sky
  photos; suspected one-time WebGL shader setup); later flights 60.0 clean.
- 10 Mbit/s: name 0.33 s, live scene 1.70 s, base in 1.87 s, 0.86 MB. Code 263 kB gzip. Census: 8 draws on low, 20 on mid
  (bloom passes included), 3 materials.

## Learned

- The loop's 8 s idle mode halves the frame rate when nothing sends input: benchmarks that drive the camera directly
  must send input (the benchmark dispatches pointermove). Without that, mid read 40 fps and low 30.
- An <img>-decoded 2048 px JPEG decodes on its first draw (a 51 ms frame); ImageBitmapLoader decodes off-thread.
- renderer.info counters reset every animation frame and the pacer skips frames: read them right after a rendered frame
  (onFrame hook), not on a plain rAF.
- @types/three types colour uniforms as 'color' with no vector math; cast to Node<'vec3'> where needed.
- The first dev-server load can stall once while Vite pre-bundles dependencies.

## Verdict (mine)

Speed passes everywhere on WebGPU. Look is rough by plan. Wrong (not just rough): night far too bright (moon key light),
Blue hour washed out, hard horizon line on high flights (fog colour vs sky horizon). Expected: box shapes from the air
(M1), Before dawn in a pit (M7), last flight blocked by a hill (path, M1). Golden, Dusk, First light, Sunrise read well.

## Open

- Owner: phone recording at http://192.168.29.253:4181/?hud (server: `node .superpowers/spike/golden-cove/tools/serve_like_pages.mjs dist 4181`
  after `npm run build`), feel verdict.
- Final whole-branch review: dispatched; act on Critical/Important in one fix pass.
- WebGL2 first-visit hitches: investigate with the phone's numbers.

## Next step

1. Read the review, fix Critical/Important (each with a failing test first), ledger the rest.
2. Owner's phone verdict closes Task 16 → M0 done.
3. Then M1, the world pass (D12): organic masks, inland shape, colour map, distant dressing, fog colour from the sky's
   horizon, night light tuning can wait for M2 (aurora) but is cheap; flight path for VIII→IX.

## Later in s04: phone round 1 and the review fix pass

- Owner's recording `.superpowers/spike/Record_2026-11-10-22-20-33_*.mp4` (164 s, Brave, WebGL2), HUD read once a second:
  started on LOW by itself (governor stepped down on loading hitches and locked); low 42–59 fps with 50–67 ms frames most
  seconds; mid 55–60 (worst mostly 33); high 34–59 (50–84 ms often); stills off 46–60. The address bar hides the HUD
  while scrolling up. Owner tried the rail and jumps.
- Reproduced on the laptop (412×915 ×2.625, WebGL2, CPU 6× slower): slow frames sat at flight starts (sky download +
  decode + GPU upload) and at still first-shows. Fixed: stops fetch the sky after next, skies upload on arrival,
  stills decode before showing, overlay writes only on change. Now: low 58.9 fps, the remaining slow frames sit at stop
  arrivals (camera nearly still), not mid-flight.
- Fresh review (1 Critical, 5 Important, 11 Minor): fixed C1 (fling → black sky), I1 (no retry, stuck veil), I2 (links
  wait for Golden's sky), I3 (governor: 3 s warm-up, respects hand-picked tiers, paused during benchmarks/?tier=),
  I4 (reduced motion never flies), I5 (no-GPU jumps). Minors deferred in the ledger.
- All green: 145 unit, 18 e2e (+6 Chromium-only skips), JS 264 kB. Commit 8ea1ad7.

## Next step

1. Owner: second phone recording on the new build (http://192.168.29.253:4181/?hud; restart the server if the laptop
   rebooted: `npm run build`, then `node .superpowers/spike/golden-cove/tools/serve_like_pages.mjs dist 4181`). Expect: starts
   on mid, flights smooth, at most one short hitch on arriving at a place.
2. If the phone holds: M0 done → M1, the world pass (+ M11 horizon fix, path VIII→IX). If not: measure again.

## Phone round 2 (recording `.superpowers/spike/Record_2026-11-10-22-46-12_*.mp4`, 103 s) and where it stopped

- Better than round 1 (fewer, shorter slow frames; stops 51–60 fps), still not good enough:
  - **The governor bounces:** opens on mid, steps UP to high within seconds (resting frames are cheap on the phone),
    then falls to mid and low during the first flights and locks on low. Same after the owner's reload at 49 s.
  - **Flights are slow even on low:** mostly 41–59 fps, dips to 25–38, worst frames 50–67 ms. s02's slice held 52–60 in
    flight on this phone with twice the triangles, so something new in M0 costs per pixel in flight.
- Tested hypothesis "the ground's shading is the cost" with a 4K pixel-bound proxy on the laptop (1920×1080 ×2, high,
  WebGL2, stills off): current ground 12.4 fps vs flat Lambert ground 12.5 fps. **Rejected**; the switch was removed.
- Owner, at the end of s04: **"I don't want to test until you think it's perfect"**: judge every build myself (likes,
  dislikes, %), keep iterating until satisfied, then hand the phone test over. Recorded as D15.

## Next step (s05), in order

1. **Find the per-pixel cost in flight**, measuring before fixing. Proxy: the laptop at 1920×1080 ×2 on high is
   pixel-bound (12 fps). Add temporary URL switches, one at a time, and fly 20 s each: bloom off, stars off (the per-pixel
   hash in `src/world/sky.ts`), sea mirror off / ripples off (`src/world/sea.ts`), grade/vignette off. Keep what the
   numbers prove; remove the switches. Also compare with the slice (`.superpowers/spike/golden-cove`, same proxy).
2. **Governor step-ups:** count fast windows only from frames rendered while the camera moves (resting frames are cheap
   and misleading). Test first in `tests/unit/governor.test.ts`, wire in `boot.ts` (`sample(..., canChange, moving)`).
3. Re-run the 6×-slowed phone emulation (412×915 ×2.625, WebGL2, `tier` pinned, `__flight(tier, 20)`) and the laptop
   runs; write likes / dislikes / % for speed and for look; repeat 1–3 until satisfied. Only then ask the owner for a phone
   recording (`http://192.168.29.253:4181/?hud`, server: `npm run build` then
   `node .superpowers/spike/golden-cove/tools/serve_like_pages.mjs dist 4181`).
4. Then M0 is done → M1, the world pass (+ the deferred minors in the ledger, esp. M11 horizon line).

## My verdict at the stop

- Speed on the laptop (WebGPU and WebGL2): ≈ 95 %: 60 fps everywhere, a few slow frames at place arrivals on WebGL2.
- Speed on the owner's phone: ≈ 60 %: stops fine, flights 41–59 fps with 50–67 ms frames; governor bounce.
- Look of the rough night: ≈ 35 % of the finished site, as planned for M0. Wrong: night too bright, Blue hour washed
  out, hard horizon line. Right: Golden, Dusk, First light, Sunrise moods; the long glide out to the arch.
