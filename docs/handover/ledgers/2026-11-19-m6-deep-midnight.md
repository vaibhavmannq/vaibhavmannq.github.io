# M6 ledger: Deep midnight (VI)

Plan: `docs/superpowers/plans/2026-11-19-m6-deep-midnight.md`. Research: `docs/handover/research/m6-midnight-references.md`.
The owner's UI and motion sites (s19, all milestones): `docs/handover/research/owner-sites.md`.
Tools (local): `.superpowers/m6/` (`first-ride.mjs` cold first rides with the pipeline log, `shot.mjs` stills with parts
hidden, `strip.mjs` frame strips, `draws.mjs`/`share.mjs` R38 probes, `console.mjs`, `nosea.mjs`), plus the shared ones
in `.superpowers/m3/tools/`. `QUIET_COLD=1` starts a second off-screen Chrome with no GPU shader disk cache (a first
visit). Shots: `.superpowers/m6/` (before, r38*, t2–t6, final). The old build for every A/B: e406c8a (end of s18) in
`../wt-head`, served on 4182.

## Session s19 (2026-11-19), Opus 5.5, inline

**Start.** No owner answers (M3, M4, M5 pages); the brief keeps the current choices. Midnight before M6
(`before/mid.png`): a grey wedge of ground in the corner, a deck of long bright rolling waves, a bright green hill
mid-left, one navy ridge, a crescent with a halo, and a two-banner aurora whose bright foot is the hardest line in the
frame. My 45 % look, 55 % behaviour.

**Mid-session (owner):** six UI and motion sites to use for all milestones. Viewed in the built-in browser; what each
milestone takes is `research/owner-sites.md`. Nothing there changes Midnight; the site already uses Satoshi from
Fontshare. "Kawaii Text Animation" was not found under that name (asked).

### Task 1: R38, the first-trip hitches (71a8e7d)
- **Measured first.** On the laptop the mirror's pipelines came from Chrome's shader disk cache (0.1 ms, no hitch) after
  so many runs, so a first visit had to be simulated: `QUIET_COLD=1` (`--disable-gpu-shader-disk-cache`). A cold
  first ride Blue hour → Night → Midnight at low, after waiting 40 s for stage B: into Night 2 frames over 50 ms
  (450 ms after the aurora's mirror pipeline, 816 ms after the cave's and a sprite's), into Midnight 1 (850 ms after
  the cloud deck's). Every late pipeline was the sea's mirror (`renderPipeline_*` created mid-ride; the scene pass's
  were already built).
- **R100, the fix:** `pipeline.compile` builds each part for the mirror too (its own camera and render target at call
  depth 2, culling off for the call), except the sea. s12's attempt at this drew the eye's view upside down; the
  same happened here with every variant (eye camera, pass target, no culling change, sequential). Found with
  `draws.mjs`/`share.mjs`: the draws were the same, but the eye's and the mirror's render objects shared one "render"
  bind group (the camera's uniforms), so the mirror's camera, written last, drew the eye's opaque parts. Cause in
  three r186: `NodeBuilder._getBindGroup` caches shared groups by `renderer._currentRenderContext` at build time; a real
  draw sets it, `compileAsync` builds after the call has restored it (null), so every pre-built shader shared one
  group. **`keyBuildsByOwnContext`** (three's own `renderer.debug.onNodeBuilderCreated` hook) sets it to the render
  object's own context around each `_getBindGroup`. Unit test `buildContext.test.ts`.
- **Laptop, cold first ride, two runs each:** into Night 0 frames over 50 ms in both runs (old build 2, worst 1083 and
  1083 ms), no late pipeline (old 3–7). Into Midnight: one 183–217 ms frame remains in **both** builds, cold only, with
  no pipeline, shader or texture created at that moment and no long task: a second, smaller cause (a GPU-side first
  use, not the mirror), recorded as **R101, open**. Starting the same ride at Night shows none.
- Phone: see Task 7.

### Task 2: the ridge top, heather, grass (87a075d)
- **R102:** from the eye (2.4 m) the 8 m grid's crest fell 14 m in the first 20 m west and 111 m in 60 m: faster than
  the frame's lower edge, so nothing could stand in front of the camera (the "grey wedge" was the only ground seen).
  `ridge.ts` designs the ground within 60 m: level along the crest, a 7° shoulder for 22 m ahead, then the break; a
  knoll for the tree; hummocks; never under the live grid, tucked 0.8 m under it at the rim. One 1 m disc mesh (~22 k
  triangles) in the terrain's own material (no new material). The eye now stands 1.6 m over the live ground.
- **R103:** heather is a new plant kind (`PLANT.heather`, `heatherMound`: 26 sprigs in a dome), dark woody stems, the
  upper half mauve; grass and tall tufts between. Midnight is the meadow's sixth plant stop (`PLANT_STOPS`); empty
  meshes are no longer made (each cove stop had an empty heather mesh otherwise).
- **R104, Purkinje:** in the moon's hours (`light.moonStrength`, only Night and Midnight have a moon) plants, turf and
  leaves keep a third to a half of their colour, greying toward a cool blue (book §1), and no backlit glow comes
  through them from a crescent. The first ridge shot had glowing yellow-green blades and a daylight-green hill.
- Verdict: look 70 % (dark moor with a grey-violet cast; too even a carpet, no stones or bare patches), behaviour
  70 % (sways with the one wind; nothing answers the pointer yet).

### Task 3: the lone tree (594e835)
- **R105:** coast.py's midnight prop (`island_tree_03`, 586.1, −958, scale 3.5, turned 200°) from the cove pack, on
  the knoll, in the grove's material (`createLoneTree`; no new download or material), only at Midnight and its
  flights. Its crown stands against the aurora and the sky, the trunk against the deck (owner `night-sky` 6). The
  leaves' backlit glow is cut by the moon rule (R104).
- Verdict: look 76 %, behaviour 70 % (the grove's sway).

### Task 4: peaks fading with distance (3e260f3)
- **R106:** `peaks.ts`: four ranges at 1.5, 2.8, 4.8 and 7.5 km, ±95° about the view, ridged noise tops (the nearest
  dips under the deck in places: islands), one mesh, one unlit material, eye only. Colours sampled against the sky at
  the horizon (sRGB about 19, 34, 68): near almost black navy, the farthest a little darker than the sky. A thin
  moonlit rim on the tops on the moon's bearing only (the first, wide rim drew every ridge like a cartoon stroke).
  Their feet fade into a far flat deck colour.
- **R107:** the deck's box reaches north to y = −100 (coast.py's stops at −420; a TS override in boot), so the nearest
  range stands in it across the view. It forms only under a camera above it, so Night's lagoon never sees it.
- Verdict: look 70 % (layers read; tops a little regular, the far plain behind the deck's edge a flat band),
  behaviour n/a (still, as mountains are).

### Task 5: the deck and the moon's road (357c038)
- **R108:** the old "light through the thin crests" term had a squared lobe toward the moon, so facing a low moon lit
  the whole deck evenly white (the deck was the brightest thing after the moon). Now ^12. A road of forward scatter
  (^55, gain 2.6) toward the moon, broken by the lumps and stronger on their moon side; the deck's general moonlight
  and sky light lowered (0.26 → 0.13, 0.8 → 0.36). The deck is dim grey-blue away from the moon and brightens under it.
- The lumps' size was not changed (owner `cloud-sea` 3 wants smaller, more numerous ones): carried.
- Verdict: look 72 %, behaviour 72 % (drift unchanged, road follows the view).

### Task 6: the late-night aurora (55395ec)
- **R109:** Midnight's curtains only: the foot rises over a third of the curtain on a smooth curve (was 0.07, sharp);
  strength × 0.62; three soft patch fields along the curtain breathe on their own clocks (6.5, 11, 17 s), per vertex
  (cheap). Frame strip (2.5 s steps, `t6/strip.jpg`): patches brighten and dim in different places, nothing sweeps.
- Verdict: look 78 %, behaviour 78 %.

### Task 7: speed, census, phone, verdicts
- **Census** (mid): Midnight 38 draws, 1.85 M triangles, 10 materials (was 32 / 1.34 M / 7). Every stop inside D13.
  Dusk now 46 draws / 12 materials (s18's unexplained 48 / 13 is gone; not traced).
- **Laptop A/B held still** (`ab-builds.mjs`, A = e406c8a): cool round, low: Midnight 11.4 vs 11.5 ms GPU, both 60 fps;
  Night and Golden equal. Mid: Midnight B 19.5 ms vs A 22.0 (the ridge hides deck and terrain pixels); both builds
  over budget at mid on this laptop as before. The second round ran warm for both builds (noisy).
- **R38 after the fix, cold first ride Blue hour → Night → Midnight at low** (`cold-final.log`, this build then
  e406c8a, a fresh cold Chrome each): into Night in flight 0 frames over 50 ms (old 500 and 833 ms, 3 late
  pipelines); into Midnight 0 (old 867 ms, 1 late pipeline). R101's ~200 ms frame did not show in this run. Two long
  tasks came while resting at the stops 40–50 s after arriving (169 ms at Night, 67 ms at Midnight; old build: one
  300 ms frame at Night): not traced, noted.
- **Look pass (c1f83c1, R110):** bare patches between the heather clumps (a moor is never one carpet); the deck's lumps
  10 m and 4 m (were 16 and 6.7; owner `cloud-sea` 3); the late aurora × 0.78 (0.62 had gone weaker than the owner's
  styled photos, D2).
- Size 309.4 kB gz (was 306.7). Midnight's own download 0.18 MB (the tree comes from the cove pack, fetched at every
  start already). `world:report` green. Unit 354 passed.
- **e2e:** 24 passed; `horizon.spec` ×2 (pre-existing) failed; the smoke "name is on screen at once" failed in Chromium
  (5.2 s) and Firefox under the suite's load. Rerun alone: Firefox still 5.7–9.0 s against its 5 s bar, **and the old
  build e406c8a fails the same way now** (5.9, 6.5, 46.7 s), so this laptop's Firefox page load is over the bar
  whatever the build (s18 saw 8.1 s once). Open, not M6's. A change that moved the mirror builds behind the joins was
  tried for it, did not help, and was reverted (measure before fixing).

### Verdicts (mine, D15; `.superpowers/m6/m6-final.jpg`, `final/mid.png`, `final/low.png`)
- **Deep midnight: 74 % at mid, 72 % at low** (before 45 %). **Behaviour 72 %** (before 55 %).
- Pieces (look / behaviour): ridge and heather 70 / 70, lone tree 76 / 70, ranges 70 / –, deck and road 72 / 72,
  late aurora 78 / 78, moon 72 / – (unchanged: crescent and halo).
- Likes: there is a place to stand; the tree's crown against the aurora is the frame's subject (owner `night-sky` 6);
  the ranges step back in tone; the deck brightens under the moon and greys away from it; the aurora breathes in
  patches instead of hanging as a banner; the palette is one night (nothing daylight-green any more).
- Not 85, by reference:
  - the heather reads as a dark textured carpet, not clumps with mauve spikes (render, book §8);
  - a pale slab of the turf map bottom-left;
  - the far plain behind the deck's edge is a flat band; the ranges' tops are a little regular;
  - the deck's large swells still roll like waves (owner `cloud-sea` 3 is all small lumps);
  - the moon has no earthshine, and its halo does not visibly light the deck under it;
  - nothing at Midnight answers the pointer beyond parallax (D25, D28).
- Recommendation: close M6 on my side at 74 % and carry these into M8 with M3–M5's, unless the owner wants a second
  Midnight pass first (heather clumps and the deck's swells are the largest single gains).
