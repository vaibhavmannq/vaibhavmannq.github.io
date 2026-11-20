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

### Task 4: Portrait framing per stop
- Portrait shots of all nine at 412×892 (`.superpowers/m8/portrait0.jpg`): the view is ~36° wide (±18°), so Golden's
  lantern (15° left), Sunset's lone tree (23° right), Night's falls (17° right) and Midnight's tree (25° left) sat at
  or past the edge; Dusk, Blue hour, Before dawn and First light held their subject.
- **R131:** each stop has a `portraitYaw` (golden −7, sunset +15, night +9, midnight −17, sunrise +8), blended in as the
  screen goes from square to portrait (`yawFor`, smoothstep 1 → 0.6 aspect); flights and spot walks start from it.
  Test `portraitYaw.test.ts` (each subject within 60 % of the half-width).
- After (`portrait1.jpg`): every subject inside the frame; Sunset loses its framing tree in portrait (the lone tree wins).
- **Verdict:** look 82 % in portrait across the nine (was ~65 %), behaviour 85 %. Not yet on the phone itself.

### Task 5: the first view, without pop-in; the hairline loader (Task 8's loader done here)
- Filmstrip of a first visit at Golden on 10 Mbit/s (`firstvisit-strip.mjs`, `visit-strip.jpg`): at 2.2 s the scene
  showed sky, a flat sea and the lantern over nothing; the ground snapped in at 3.4 s, the cliffs and grove at 5.1 s,
  the arch at 5.8 s.
- **R132 (my call, owner to hear):** the reveal waits for the parts the opening stop shows (`openingParts`, from
  PART_STOPS), capped at 3 s past stage A; the blurred poster and the name stay up meanwhile. D9's "first view < 3 s"
  now means the poster; the live world arrives whole at ~4.5 s on 10 Mbit/s (sooner on any faster line).
- **R133:** opening on a cove stop, the cove pack is fetched with the base, not after it: cliffs and grove joined at
  4.2 s (was 4.8), the ground at 4.0 s (was 3.1, sharing the line).
- **R134:** the hairline under the name (owner-sites: Originkit "Hairline Loader"), filling with the share of the
  opening stop's parts joined (0.3 after stage A), fading with the reveal; no motion under reduced motion.
- After (`visit3-strip.jpg`): poster with the line until ~4.1 s, then the whole cove fades in at once; only the far arch
  and stacks arrive a second later, small at the frame's left. `load.spec` alone: name 360 ms, stage A 1.17 s.
- **Verdict:** behaviour 84 % (no half-built world shown; the line sits still at 0.3 while the base downloads: real
  byte progress would read better); look of the loader 78 % (quiet, low contrast on the bright poster).

### Task 8 (cursor half): the night cursor
- **R135:** a glow under the pointer with a 7-point trail (DOM dots moved by transform, `mix-blend-mode: screen`), shown by
  the night hours' weight (Blue hour to Before dawn, following the light's turn in flights: `nightWeight`, tested);
  mouse/trackpad only (`pointer: fine`, pointerType mouse); the system pointer stays; it steps aside over links,
  buttons and the card; none under reduced motion.
- Checked mid-sweep (`cursor-night.png`): a short line of soft blue-white points with a faint glow at the tip, under
  the fireflies' brightness; off at Golden.
- **Verdict:** look 76 % (quiet, fits the night; the glow at the tip is almost invisible on a dark scene), behaviour 80 %.
  Not judged on a trackpad by hand.

### Phone check of Tasks 3–4 (end of s21)
- USB, Brave, WebGPU, every part joined (31 with the new tree; `.superpowers/m8/phone-hold.mjs`, `phone-hold.log`).
  Held still: **Sunset 59.6 fps at mid and high** (old build b1e50c7: 59.4 / 59.7), Midnight 59.6–59.7 both builds,
  Golden 59.4 / 59.7, Night 59.6 / 59.6, Sunrise 59.5 / 59.7. Sunset's new plants and tree cost nothing seen here.
- Portrait on the phone (`phone-portrait.jpg`): Golden's lantern, Sunset's lone tree, Night's falls, Midnight's tree
  (absent in the old build) and Sunrise's grove all in frame. Portrait verdict stands at 82 % look, now seen on the
  phone; behaviour 85 %. Midnight's tree, now central, covers part of the aurora's foot: watch in the Midnight pass.

### Task 6: flights as shots (first two)
- Strips of the five generic flights (`.superpowers/m8/flights0.jpg`), my % before: I→II 65, II→III 50 (the middle
  faced dark hills inland), III→IV 55 (a 211 m glide whose middle was a white haze; the arch only at the end), VII→VIII
  60 (a dark slab outside the cave), VIII→IX 72.
- **R136, III → IV skims among the lanterns** (design review §4): `FLIGHT_OVERRIDES['dusk>bluehour']`: off the headland
  at its own height until ~10 m past the cliff edge (the cliff test wants 6 m from a column; the first try passed 1.4 m),
  drop to ~3 m where the lanterns' string starts, along it as it spreads, low (9–12 m) over open sea (floor −17..−22 m,
  `heights-line.ts`) with the arch dead ahead all the way (bearing −45°, the flight −43°), easing onto the flats. Top
  29 m (was 211). Strip `flight34-new.jpg`: the lanterns below on the step-off, a mirror of clouds, the arch faint in the
  haze at t 0.4 and filling the frame on arrival. **Look 84 %, behaviour 80 %** (was 55).
- **R137, II → III sideways** (`SIDEWAYS`): the gaze stays seaward (−48° → −54°) while the camera slides south-west,
  so the flight passes Sunset's framing tree, the grove clump crossing the stacks and the sun, and comes down onto
  Dusk's water (`flight23-side.jpg`). **Look 80 %, behaviour 78 %** (was 50).
- Tests: flights (2 m clearance, no rising ground ahead), grove/cliffs, arch, stacks clearance: green; unit 375.
- Cold rides (one test browser; the laptop had 0.8–2.2 GB of 7.7 free, the owner's apps open): Sunset → Dusk clean in
  the flight (`flights-cold2.log`). Dusk → Blue hour: one 316–366 ms frame ~5 s in, no pipeline, texture or long task
  (`flights-cold2.log`, `flights-cold3.log`). **The old path, same build, same moment: 216 ms** (`flights-cold-oldpath.log`),
  so not the new path; the s21 whole-night run earlier (more memory free) had none on this flight. Stepping poses
  (`step-flight.mjs`) shows nothing: it needs real-time riding. **R138, open:** re-measure III → IV cold with memory
  free; if it stays, find what starts ~1/3 into the flight (the sky's second photo starts fading in at t 0.3).
- A first measuring run with both test Chromes open (the owner: "it's hogging the RAM") gave 116 slow frames at rest:
  discarded. Only one test browser at a time from now on; stop it after each run.

### Task 6 continued: the other three flights
- **R139, Before dawn → First light** flown with a level gaze (`SIDEWAYS`): the gaze no longer tilts down the slope with
  the descent (−17°), so from t 0.45 the frame is the cove, its mirror and the dawn sky; the dark slope is a thin band
  (`flight78-old.jpg` → `flight78-level.jpg`). The hill's dark flank still fills the left at t 0.25–0.35.
  **Look 72 %, behaviour 75 %** (was 60).
- **R140, Golden → Sunset**: sideways (gaze on the sun and the sea), and a new end (`FLIGHT_OVERRIDES`): over the cliff
  edge near (27, 111), across the meadow, in from the north. **The old last leg passed 6.9 m from Sunset's framing
  tree's trunk, inside its crown** (Task 3 added the tree; its strips faced away and missed it): new test "keeps every
  flight 7 m clear of Sunset's framing tree below its crown"; Sunset → Dusk's first leg nudged east for the same test
  (`sunset>dusk` override, the generated hop otherwise). Strip `flight12-new.jpg`: the sun's road and the stacks, the
  grove passing, the meadow opening at the edge, settling into Sunset as the tree enters left. **Look 80 %, behaviour
  78 %** (was 65).
- First light → Sunrise (72 %) left as it is.
- Tests: unit 376 (flights, grove, camera green). Cold rides, one test browser, 2.3 GB free (`flights-cold4.log`):
  **0 pipelines on Golden → Sunset → Dusk and Before dawn → First light.** Frame times: Golden → Sunset worst 50 ms;
  Sunset → Dusk clean in flight (a 300 ms frame at rest +35 s, R127); Before dawn → First light one 199 ms frame as the
  ride began, then the cold Chrome's 1 Hz throttle (exact 1016 ms frames from +40 s, the s20 artifact): not evidence.
- **Tooling (owner: "why do you keep tabs open all the time in chrome, it eats up a lot of ram"):** the test Chrome
  (`.superpowers/quiet-browser.mjs`) now shuts down whole when a check closes or crashes; it used to stay running
  between checks, and a crashed check left its tab rendering the world. Checked: no test Chrome left after a run.

### Where s21 stopped
- Done: Tasks 0–5, Task 8 (loader in Task 5, cursor), their phone check, and Task 6 (four of five flights reshaped;
  First light → Sunrise kept). Next: R138 re-measured with memory free (flights as shots), Task 7 (look passes), Task 9 (sound design), Tasks 10–12.
