# Session s05 · 2026-11-10 · M0: why flights were slow on the phone, three fixes

## Done (branch `world`, uncommitted at the end of the session: ask before committing)

1. **Measured the shader cost per piece** with GPU timer queries (three's `trackTimestamp`, WebGL2, 1080p high, fixed
   poses every 2 screens): bloom ≈ 6.5 ms, the post chain on an empty scene ≈ 6 ms, sky 3.5, terrain 3.4, sea 2.5
   (mirror 1.6 of it); stars, ground noise, foam, ripples < 1 ms each. Flights cost the same as stops. So no shader
   explains "flights slow on every tier", and the s04 plan's suspect list was wrong.
2. **Found the flight cost outside WebGL:** the blurred poster (first-paint picture, `filter: blur(18px)`, full screen)
   stayed under the world forever, and the canvas was transparent, so the browser's compositor blurred it again on every
   frame no still covered, which is every flight frame. Fix: CSS hides it 700 ms after `is-scene-ready`; canvas
   `alpha: false`. Evidence: interleaved A/B Chrome traces on the laptop, draw-and-swap 1.94/1.65/1.20 ms (kept) vs
   0.69/0.72/0.53 ms (hidden) per composited frame. A phone pays this at 1080×2400 device pixels.
3. **Governor bounce fixed:** fast windows count toward a step-up only when the camera moved for most of the window;
   the step-up then waits until the visitor rests; a waiting step-down wins over a waiting step-up.
4. **Arrival hitches cut 3–5×:** each arrival uploaded the next-but-one sky as an ImageBitmap, and Chrome converts
   bitmaps on the main thread: 24–50 ms per 2048×1024 sky at 6× slowdown. Raw bytes upload in 9 ms. Skies now decode in a
   small worker (`src/assets/skyDecode.worker.ts`: fetch, decode, flip rows, raw RGBA) and upload as a DataTexture.
   Screens identical to the old loader. Also closes deferred minor M2 (imageOrientation on old Safari/Firefox).
5. Tests: 5 governor tests, 1 sky texture test, 1 e2e (poster leaves). The links and load e2e tests now watch requests
   (worker fetches are not in the page's resource timeline; checked that throttling applies to the worker).
   All green: check, 151 unit, 19 e2e (+8 skips), JS 264.7 kB gzip.

## Measured after the fixes

| Run | Before (s04/s05 start) | After |
|---|---|---|
| Phone emulation (6× CPU, WebGL2), low, stills off | 54.2 fps, 6 frames up to 100 ms | 59.0–60.0 fps, 0 over 50 ms, worst 17–33 ms |
| Same, mid | 44.6 fps, 17 over 50 | 52–55 fps, 0–3 over 50 |
| Same, high | 41.5 | 42 (this laptop GPU is too slow at phone-high: governor's job) |
| Same, low, stills on | — | 55.5–58.8 fps, 2–3 frames 50–100 ms per night |
| Laptop WebGPU 1280×720 ×1.5, low/mid/high | 60/59.3/59.7 | 60.0/59.8/59.3, 0 over 50 |
| 10 Mbit/s: name / live scene | 0.33 / 1.70 s | 0.30–0.61 / 1.04–1.39 s |

## Learned

- The laptop's frame rate swings ±25% with heat (identical runs: 53.8 vs 40.5 fps). Compare with GPU timer queries or
  interleaved A/B runs (A B A B), never two runs minutes apart.
- GPU timer queries don't see the compositor. Compositor cost shows in a Chrome trace (`viz`, `gpu` categories:
  `Display::DrawAndSwap`, `DirectRenderer::DrawRenderPass`, `SkiaOutputSurfaceImplOnGpu::SwapBuffers`). Chrome's own
  2026 study names slow `SwapBuffers` as the top cause of Android scroll jank.
- `renderer.initTexture` does not upload a texture without `needsUpdate`; wrap the real GL calls to see uploads.
- WebGL2's ~11 tiny `bufferData` calls per frame are three's uniform buffers: normal, not a leak.
- Web search (owner's suggestion): drei's PerformanceMonitor averages fps over ~2.5 s and can stop after N swaps;
  ours already never returns to a tier that failed. The three.js forum thread on scroll frame drops on phones never found
  its cause.

## Verdict (mine)

- Speed, laptop: ≈ 97%. Speed, phone (by emulation; the GPU side can't be emulated): ≈ 85%, up from 60%. The poster fix
  targets the one cost that matched every phone symptom; the phone recording is the proof.
- Weak, and known: stills cause 2–3 hitches per night (M0 scaffolding, gone with the live places); one ≈ 25 ms stall
  right after load when the ground's shader finishes; mid on weaker GPUs is the governor's call.
- Look unchanged at ≈ 35% of the finished site (rough by plan): night too bright, Blue hour washed out, horizon line.
  Those belong to M1/M2 as planned.

## Next step

1. Done: committed as cdf951d on `world` (not pushed).
2. Owner's phone recording (I call it ready): http://192.168.29.253:4181/?hud (server: `npm run build`, then
   `node .superpowers/spike/golden-cove/tools/serve_like_pages.mjs dist 4181`). Expect: opens on mid, stays on mid or
   steps up only after smooth flights, flights 55–60 fps, at most a short hitch where a still fades in.
3. If it holds: M0 done → M1, the world pass (D12) + deferred minors (M11 horizon line first).

## Phone round 3 (2026-11-11, recording `.superpowers/spike/Record_2026-11-11-08-34-40_*.mp4`, 100 s, Brave, WebGL2)

HUD read once a second (sheets in `.superpowers/spike/rec6/`):
- Already on **low at 0 s**. Run 1 (0–34 s, whole night in ~18 s, fast scrolling): low 52–59 fps most seconds, worst
  mostly 33.5 ms; dips 29/35/46/48/49. Mid picked by hand at 36 s, back on low by 41 s. High picked at ~54 s after a
  reload: 53–60 fps at places and in flights, worst 33–67; mid/high alternate after that (owner's taps vs governor
  can't be told apart from video). Dips to 28–38 fps about one second in eight on every tier; "worst 100 ms" 4 times.
- Better than round 2 (flights on low 41–59 with 50–67 ms frames), not yet the bar.
- **Key clue: low and high run about the same**, so the phone's limit is per frame and tier-independent (script,
  compositor or the pacer), not pixels. Suspect to check: the pacer goes quiet (renders nothing) for 20–30 vsyncs when
  the screen's refresh changes; phones that raise refresh while touched would freeze the scene at scroll start/end.
- Next: measure the phone directly over USB (adb + remote debugging: `__flight`, traces, the pacer's Hz) instead of more
  recordings. adb is not installed on the laptop yet (owner asked).

## Measuring the phone directly over USB (2026-11-11)

- Setup: Android platform tools in `%LOCALAPPDATA%\Android\platform-tools` (winget's package URL 404s; the zip came from
  dl.google.com). Phone: OnePlus CPH2413, Snapdragon "taro", Android 15, 60/90/120 Hz screen. `adb forward tcp:9222
  localabstract:chrome_devtools_remote` (whichever browser is in front: Brave or Chrome; Chrome also had `_20979`),
  `adb reverse tcp:4181 tcp:4181` (+5199 for the dev server). Playwright `chromium.connectOverCDP`. Real touch:
  `adb shell input swipe 540 1700 540 900 150`. Scripts: scratchpad `phone.mjs` (`__flight`), `swipe.mjs` (swipes + rAF
  and render log, dev build), `ptrace.mjs` (trace), `backend.mjs`.
- **Hands-off flight, real phone:** Chrome WebGL2 low/mid/high 59.5/59.6/59.3; Brave 59.6/59.4/59.2. Rendering is fine
  on every tier.
- **Refresh-switch suspect ruled out:** the screen stayed at 60 Hz through real swipes.
- **Stills fades repainted the full-screen picture every frame:** fast flings, stills on 52.2/51.5 fps vs 57.6/57.3
  with `will-change: opacity` (interleaved A/B). Fixed in world.css + e2e test.
- **Brave, fast flings (WebGPU via localhost):** low 56.6 (stills on, fixed), 57.6 stills off, mid 54.7, high 53.0.
  Trace: main thread ~38% busy, no task > 16 ms, GPU thread ~40%: no single culprit left; the misses are scheduling
  jitter under aggressive flings.
- **WebGPU needs a secure page:** via `http://192.168.29.253` the phone gets WebGL2; via `localhost` (adb reverse) and
  on the live https site it gets WebGPU. Owner tests should use `http://localhost:4181/?hud` with the cable in.
- Why round 3 looked worse than these numbers: WebGL2 (insecure URL), the screen recorder running, stills fades
  repainting, the HUD, and very fast scrolling.

Verdict: phone ≈ 88–90% (hands-off 59+ on every tier; 54–57 under aggressive flings). Ready for a hands-on feel test
without the screen recorder.

## M0 signed off (2026-11-11)

Owner's hands-on test (Brave, `http://localhost:4181/?hud` over USB, WebGPU, no screen recorder): "it's running
smoothly". Task 16 closed; **M0 is done** at cdf951d (`world`, not pushed).

Next: M1, the world pass (D12): organic masks instead of box edges, inland ridges, colour map, distant dressing, fog
colour from the sky's horizon (deferred minor M11, the hard horizon line), the VIII→IX flight path. It needs its plan
written first (`docs/superpowers/plans/`), from the design spec. Measure on the phone over USB as we go (memory: phone
over USB).
