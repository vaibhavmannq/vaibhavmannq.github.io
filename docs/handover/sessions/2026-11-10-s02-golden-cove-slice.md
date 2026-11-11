# Session s02 · 2026-11-10 · the Golden cove vertical slice, built and measured

## Done

1. **Built the slice** (throwaway) in `.superpowers/spike/golden-cove/` (not in git): a Vite root that aliases the repo's
   three.js 0.186, WebGPU renderer with WebGL2 fallback, TSL materials, one file `src/main.js`. Scroll flies the camera from
   the Golden beach stop (9.5, -4) over the cove to the Sunset clifftop stop (25, 141) while the light turns.
   - **Terrain:** `src/world.js` is coast.py's `ground()` ported line for line; matches numpy to 0.05 mm at 14 points
     (`tools/check_world.mjs`). Baked offline by `tools/bake_world.mjs` into `public/world.bin`: a 0.8 m core grid over the
     cove plus a far polar ring to 7 km, grass/flower placements (coast.py's zone rules), tree spots (build_grove).
   - **Sky:** `tools/prep_assets.py` turns the 4k HDRIs into 2k JPGs, rotated so the photo sun sits on the lamp (tilt along
     the bearing, then spin: a single rotation warped the horizon), recoloured with each hour's hybrid ramp, 8-bit HDR encoded.
   - **Rocks:** `tools/export_rocks.py` runs coast.py's own builders headless (exec up to `build_terrain()`), decimates by
     on-screen size, exports `rocks.glb` (arch, stacks, cliff_rocks wall, shelf, pools). `tools/export_cliff.py`: the scanned
     cliff 1.54 M → 40 k triangles.
   - **Trees:** Poly Haven trees are 1–2 M triangles each. `tools/bake_trees.py` renders each tree (and the searsia shrub)
     from 0/60/120° as cut-outs; shown on three crossed cards, merged per picture.
   - **Sea:** planar reflector, six analytic ripples faded per pixel size (fine ripples aliased into stripes), shore foam and
     crest from a height texture, transparent shallows. Pools on the shelf mirror the sky only.
   - **Grass/flowers:** 57 k tufts, one InstancedMesh per kind; every 60 ms the visible 32 m cells copy their nearest share
     into the live buffer (distance thinning). Wind as a moving noise field. Round flower heads.
   - **Post:** bloom + the vivid grade from grade.py (ACES, saturation 1.32, warm, vignette). Per-hour sky gain.
   - **Hover target:** a paper lantern bobbing in the shallows; hover lifts and brightens it, click opens a card.
   - **HUD:** fps, worst frame, draws, triangles, low/mid/high switch, "render" button that overlays the Blender render.
2. **Measured** on this laptop in headed Playwright Chrome (WebGPU, 1280×720 page at DPR 1.5 = the real screen). Per-rAF counts.
   - Full 8 s flight: low 60 fps, mid 60 fps, both 0 frames over 20 ms; high 59 fps, 5 frames over 20 ms.
   - Stops: everything 60 except high at the Sunset stop, 51 fps (3.3 M triangles, meadow at the lens).
   - Draws 42–58. First frame 1.16 s from the local server (no network).
   - Download per visit 12.1 MB (trees 3.9, cliff 3.7, world data 1.6, rocks 1.5, textures 0.9, code 0.27, skies 0.26).
   - **Over a slowed connection** (production build via `vite preview` on :4180, Chrome network emulation, cache off):
     13.2 MB transferred (no compression on that server); name on screen 0.24 s / 0.66 s; **first 3D scene 16.6 s at
     10 Mbit/s and 11.5 s at 25 Mbit/s.** The 3 s goal fails until assets shrink. The slice also fetches files one after
     another (sequential awaits), which wastes bandwidth: load in parallel and in stages.
3. **Offline report** (this account has no artifacts): `.superpowers/spike/golden-cove/report/golden-cove-slice.html`,
   self-contained, render vs live frame per stop, all numbers, verdicts. Rebuild: `python tools/make_report.py` from `report/data.json`.

4. **Phone test (owner's 50 s screen recording, `.superpowers/spike/Record_2026-11-10-15-04-44_*.mp4`):** Brave on Android,
   1080×2412, **WebGL2 fallback** (no WebGPU). Read off the HUD once a second: low 59–60 fps at the Golden stop, 46–60 in
   flight; mid 54–58; high 42–55 with hitches to 118 ms. Problems seen: portrait framing cuts the arch off at the Golden stop;
   name and stop label overlap; the canvas does not grow when the browser bar hides (dark band at the bottom); three
   reloads, most likely pull-to-refresh from scrolling up at the top (needs `overscroll-behavior: none`); a 0.8–0.9 s
   freeze in the first second after each load (WebGL2 shader warm-up); the shadowed headland fills half the portrait screen
   with black mid-flight. Not fixed yet: the owner has not asked.

## Learned

- **Objects cost load time, not only frame time.** three's WebGPU renderer builds a shader per InstancedMesh (~13 ms each
  here): 228 grass patches = 3.4 s of a 4.6 s first frame. One object per kind: 0.04 s. Sharing the geometry did not help.
- Merging tree cards per picture took draws from ~170 to 58 (the mirror pass draws everything twice).
- The live frame looked washed out until the renders' vivid grade went into the pipeline; the grade is part of the look.
- Far wet sand mirrored raw sky at grazing angles and drew white lines along every shore; keep that sheen near the camera.
- Playwright: a long `browser_run_code_unsafe` past 120 s goes to the background and once died with the browser; keep
  benchmark calls short (the slice now has `window.__bench(tier, points)` and `window.__flight(tier, secs)`).

## Verdicts (mine)

Golden ≈ 75%: right place and light; sky paler/yellower, no foam crest, no pebbles. Sunset ≈ 65%: layout right; sky
orange-brown where the render is pink/violet, flowers one pink mass, tree flat (passes because backlit). Mid-flight: rock in
shadow goes pure black (no bounce light); clouds morph because two different sky photos cross-fade.

## Open questions

- **For the owner:** in a flight, does the light turn on ONE sky (clouds stay) or does the sky change (clouds morph, as now)?
  My recommendation: one sky photo per stretch, recoloured as the hour turns.
- **For the owner:** their feel verdict on the phone run (the numbers are read; the verdict is theirs).
- Trees for the real site: the cut-outs pass only backlit (Golden, Sunset). Sunrise is front-lit; close passes in flight show cards.
- Bounce light for shadowed rock (baked AO/light in the asset pipeline, or a cheap fill term).

## Next step

1. Owner opens the slice on their phone: start `node ../../../node_modules/vite/bin/vite.js --host` in
   `.superpowers/spike/golden-cove`, then `http://192.168.29.253:5180/` on the same Wi-Fi. Note fps from the HUD per setting,
   and their feel verdict. Read the offline report first.
2. Then write the design (`docs/superpowers/specs/`) using the slice's numbers: object budget (≤ ~80 draws per stop, merge by
   material), mid as the laptop default with the governor, staged load (sky/sea/terrain first, ~0.2 s of shaders), the asset
   pipeline targets (≈3 MB per stop, estimate) and the vivid grade in the pipeline.

## Round 2 (same session, after the owner's "GO AHEAD THEN" + "copy how Aditya made his grass interactive")

Owner asked for my honest verdict first: I said ≈40% to a finished stop (look 75/65%), listed likes/dislikes; they said go.

- **Download 12.1 → ≈3.0 MB.** gltfpack 1.3 (`tools/pkg`, meshopt, `-kv -vtf` or the UVs vanish when there is no
  material), WebP textures, world pack v2 (`public/v2/world.bin`: 16-bit heights, grass 7 bytes each, z re-read at load).
  Its Node build cannot write WebP, so textures go through PIL.
- **Trees in 3D:** `tools/bake_tree3d.py` splits a Poly Haven tree by material, simplifies trunk + branches (~7k tris),
  voxelises the leaves (area-weighted) into a few hundred clusters, renders 4 real leaf patches into a 2×2 atlas. In the
  browser: merged wood per kind + camera-facing leaf cards (one mesh per kind). All four kinds 0.92 MB.
- **Staged load:** stage A (world, golden sky, 3 textures) downloads first; stage B (rocks, cliff, trees, sunset sky)
  starts when A is in. Hidden warm-up frames, then a fade-in. Throttled, production build, Pages-like compression
  (`tools/serve_like_pages.mjs`): first view 2.6 s at 10 Mbit/s (was 16.6), 1.9 s at 25, 3.5 s at 5; rocks/trees pop in
  ~1.3 s later at 10 Mbit/s (fade needed).
- **Grass parting** (Aditya's idea, our code: his repo has no licence): pointer or finger ray-marched onto the height grid,
  smoothed point + strength fading 2.5 s after the last move; blades within ~1.5 m lean away and dip.
- **Sky:** round 1 missed coast.py's `sky_rot` 40° for Sunset; fixed, and Sunset now matches its render. "One sky"
  option (`sky/sunset_one.jpg`: Golden's photo lit for sunset) behind a HUD switch. My recommendation changed to two skies.
- **Light:** hemisphere = sky above + lit sea below at ~2.3; bounce fill light; soil albedo lifted; backlit leaves dark.
- **Phone:** portrait framing per stop, text no longer collides, canvas 100lvh, `overscroll-behavior: none`.
- **Pebbles** (build_beach rules) on the Golden sand; meadow darkened, flowers muted and thinned, sun glint narrowed.
- **Speed (laptop):** low and mid 60 fps through the flight; high 54 in flight, 48 at the Sunset stop (3.9 M tris).
- **Verdicts:** Golden ≈82%, Sunset ≈80%, the whole stop ≈70% to finished. Report rebuilt (round 1 data kept in
  `report/data_round1.json`).

Owner asked mid-turn whether it is right to judge this site by the previous site's standard. My answer: keep the
visitor rules (name at once, no blank loader, smooth at a reduced setting, works on phones), retire the numbers that
belonged to a one-shader sea (1.5 MB). Proposed new bar, needs the owner's yes before it goes into DECISIONS.md:
name < 1 s; first view < 3 s on 10 Mbit/s; each stop complete < 5 s; 60 fps on each device's default setting; ≈3 MB per stop.

### Next
1. Owner: round 2 on the phone (pull to refresh is blocked now; reload from the browser menu), sky switch verdict, yes/no on the new speed bar.
2. Me, then: fade stage B in; sharper sun column + visible foam crest; meadow tussocks; then the written design.

## Round 2 on the owner's phone, and decisions

- Owner: **yes to the speed bar (D9), two skies (D10)**; "grass interaction is very weird right now, can be fixed later".
- Recording `.superpowers/spike/Record_2026-11-10-15-44-15_*.mp4` (135 s, Brave, WebGL2), meter read once a second:
  low 59–60 at stops, 52–60 in flight; mid 60 at stops, 48–60 in flight; high 54–60 at stops (3.9 M tris), 39–58 in flight.
  No accidental reloads. Tier switches cost one hitch (128–287 ms).
- **Correction:** the meter's clock started before shader preparation, so its first reading counted the loading time as
  one frame. Round 1's reported "0.8–0.9 s freeze" was most likely that, not a visible freeze. Fixed (clock starts with
  the loop). Told the owner.
- Phone default "low" renders 360 px across a 1080 px screen; the phone holds 60 on high at stops. The real site needs the
  governor to choose the setting from frame times.
- Grass parting on touch: parked (owner). Likely cause: a dragging finger both scrolls and parts, so the point jumps;
  fix candidates: part only on tap-and-hold, or follow the finger's last ground point without the scroll's motion.
- Portrait mid-flight is still mostly black headland for a few seconds.
