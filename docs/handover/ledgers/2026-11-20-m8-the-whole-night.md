# M8 ledger: the whole night, polished

Plan: `docs/superpowers/plans/2026-11-20-m8-the-whole-night-polished.md`. Research: `research/m8-whole-night-references.md`.
Rulings continue from M7's R123.

## Session s21 (2026-11-20)

### Task 0: Research and plan
- The reference sheet gathers every carried item (M3–M7) with its evidence and what M8 adds; the plan orders the work by
  what a visitor meets first: hitches, Sunset's view (D38), portrait framings, fade-ins, flights, looks, cursor and
  loader, sound (design first), speed, stills, gate.

### Task 1: R121, the first trip out of Before dawn (laptop)
- **Reproduced** cold (QUIET_COLD=1, START=midnight, two rides, low): out of Before dawn one 600 / 1150 ms freeze
  ~0.6 s after `renderPipeline_MeshStandardNodeMaterial_38`, and 67–100 ms after `SpriteNodeMaterial_21`
  (`.superpowers/m8/r121-cold2.log`, `r121-cold3.log`). New bench hook `__whoIs(id)` names the parts: 38 is the shared
  rock (cliffs, pebbles, arch, stacks, bowl), 21 the spots' glints.
- **Cause, from the shader text** (`.superpowers/m8/pipediff.mjs`; `pipes/`, `pipes2/`):
  - **R124:** three r186 gives texture nodes holding the same Texture one binding (`TextureNode.getUniformHash` is the
    texture's uuid). The sky's two hour slots (texA, texB; the fog reads them) hold one texture at a stop and two in a
    flight, so a shader pre-built at rest has one binding fewer than the flight's: rebuilt on the first flight that
    draws it. Fix: `slotTexture(value, slot)`: a slot's hash is its name. Test `slotTexture.test.ts`.
  - **R125:** the glints were pre-built while the slots held the 1×1 placeholder sky, a plain DataTexture (nearest,
    clamped), which three reads with `textureLoad`; the photos (linear, wrapped) need `textureSample`. Fix: `blankSky()`
    is prepared like a photo. Test `blankSky.test.ts`.
  - **R126:** the eye's pre-build culled by the view at join time (only the mirror's call turned culling off), so a part
    out of view when it joined was not built for the eye. Fix: culling off for both calls (`pipeline.ts compile`).
- **After** (cold, same ride, `r121-fix2.log`, `r121-fix3.log`): **0 late pipelines on both rides** (was 2); into
  Before dawn worst 34–51 ms, out of it no frame over 50 ms in the flight.
- **Whole night, cold, low** (START=golden, eight rides, `night-cold-new.log`): **0 late pipelines on every flight**;
  every flight's frames ≤ 50 ms; a 66–83 ms pair ~29 s after arriving at Blue hour (with a 67 ms long task, resting).
- **R123, phone** (USB, Brave, WebGPU; `.superpowers/m8/phone-ride.mjs`, all 30 parts joined): old build (b1e50c7) into
  Before dawn 2 frames over 50 ms, worst 301 ms, right after the same `MeshStandardNodeMaterial_38`; out of it a late
  rock and glint build again. **New build: 0 frames over 50 ms on both rides, worst 34 ms, no pipeline made.** R121 and
  R123 were one cause.
- **R127, open (R101's family):** a single 167–200 ms frame ~32 s after arriving at First light, resting, with no
  pipeline, shader or texture created and no long task (main thread idle: a GPU-side stall). Seen in every cold run,
  before and after the fix, and warm too (266 ms at Dusk ~36 s after arriving, `warm-ride.log`). Nothing in our code
  fires then; a Chrome trace of Sunset → Dusk and 50 s at rest caught no gap (intermittent). Resting, not in a flight:
  left open, below the visible work.
- **Verdict, Task 1:** behaviour 92 % (no first-trip build left on any flight, laptop cold and phone); not 100 because
  of R127's resting frame.

### Task 3: Sunset's meadow view (D38)
- Shots (`.superpowers/m8/sunset0.jpg`): the new view's lower half was one smooth olive mound, flowers only in a patch,
  no tall stems near the lens (s16 kept tall grass out of the first 30 m), a bare crest line; the old view's richness
  came from a big tree framing the left, the sun's road on the mirror and a lit flower edge.
- Tried (URL knobs, removed): drifts out to 110 m (hidden: the slope's crest is ~25–30 m out, everything past it
  unseen); drifts at 3–40 m (a near band; the right half of the slope faces away from the low sun and stays dark);
  searsia shrubs on the slope (scale 2: a wall; scale 0.5–1: dark lumps); a near framing tree (8 m, the old tree's
  model): the one that changed the picture (`sunset1`–`sunset6.jpg`).
- **R128:** Sunset's framing tree, `SUNSET_FRAME` (36° left, 8 m, scale 1.4, island_tree_01), placed in the browser and
  drawn with the grove's material (`createMeadowScrub`, part `scrub`): at Sunset and its two flights only (at a stop
  only its own: a stop's state can name the next stop). The flight out now passes its trunk (design review §4 "around
  its trunk"); no clipping in strips (`strip-sunset.jpg`).
- **R129:** Sunset's plants: grass clumps at the lens sides, tall tufts from 6 m (was 30), and flower drifts on the slope
  8–32 m (13 000 candidates; one kind per ~40 m band). The plant test's 60 k cap holds (was 73 k at 30 000).
- **R130:** `?cams=old` removed (OLD_CAMS, `flightPathsOld.json`, the old aurora/cave branches).
- Speed (A = b1e50c7, `ab-builds.mjs`): Sunset low GPU 10.4–10.5 → 11.0–11.1 ms, 60 fps; mid 15.7–15.8 → 16.8–17.2 ms
  (mid was under 60 here already). At 30 000 candidates it had been +1.5–2.5 ms at low (57.5 fps): halved. Census
  Sunset 47 draws, 11 materials; Dusk unchanged once the tree stopped showing there.
- Cold first ride Golden → Sunset (both builds, `sunset-cold-ab.log`): new 2 frames over 50 ms (worst 83), old 1 (66);
  no pipeline. A first run in a fresh cold Chrome had main-thread long tasks at Sunset; not reproduced.
- **Verdict:** Sunset **look 83 % at mid, 82 % at low** (was 80), behaviour 80 %. Likes: a frame within the frame
  again, near grass for the parallax, the sea and arch stay open, the lone tree still the subject. Dislikes: the shaded
  right half of the slope is still bare dark turf; the near pink band is even and its heads faceted; the spot's white
  glint sits mid-frame. Carried to the Sunset look pass (Task 7): backlit flower heads in the shade, mixed drifts.
