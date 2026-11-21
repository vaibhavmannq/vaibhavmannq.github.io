# M8.5 #13: the shore looks like a block (research and plan; s25, 2026-11-21)

Owner, Round 1 [9]: "the shore looks like a block", then mid-round: "not in First light only … in every scene where
there is shore and that cove". Ledger triage #13 ("likely: the headland's outline has straight edges and a square
corner; round it in the world's source; re-bake").
This file is the Research phase (D20, D24, D28) and the plan. No code was changed to write it.

Marks, as in `research/README.md`: **[read]** I opened the source; **[search]** from a search summary; **[mine]** my own
reasoning; **[seen]** measured by me from the code, the baked grid or an image.

## 1. What is wrong, and why [seen]

I drew a plan map of coast.py's ground over the cove (x −260…260, y −120…420, 1 m, with the cameras and their
±40° turns) and printed the live 8 m grid (`public/world/base/heights.bin`). **The cove is a rectangle of water
between two straight walls, with a rectangular slab sticking into it.** Four axis-aligned smoothstep boxes make it:

| Shape | Where in `tools/world/blender/coast.py` | What it draws |
|---|---|---|
| Right headland | `_ground_core`, line 275: `rmask = sm(15, 30, x) * sm(150 + PROM_DY, 95 + PROM_DY, y)`; line 279 `band` (same box) | a straight north–south cliff face at x ≈ 15–30 from y −120 to ~150, and a straight east–west north end at y ≈ 155–210 for every x > 30. A square corner where they meet |
| Left headland | lines 283–287: `le = -101 + 9·(fbm−0.5) + 2.5·(fbm−0.5)` and `lmask = sm(le+1.5, le−7, x) * sm(220, 140, y)` | a near-straight face at x ≈ −101 (it wanders only ±5 m, at 30–100 m wavelengths), and a straight north end. The grid shows its east edge at x −103…−107 for y 60–95, then sea |
| **The terrace** (the "cliff-top shelf with the tree") | `_ground_world`, lines 323–325: `pm = sm(130,139,y)·sm(157,150,y)·sm(−48,−36,x)·sm(116,104,x)`, `hum` (same kind of box), `h = max(h, pm·13.6…)` | **a flat-topped slab 13.6 m high, 27 m wide, from x −48 to the headland, with vertical straight sides and square corners, standing in the water.** The grid shows it as a row of 10–20 m cells at y ≈ 144 from x ≈ −46 |
| The beach | line 266 `shore_y(x)`: a parabola plus a gentle sine | fine on its own; it meets each cliff face at a right angle in plan, at (18, 0) and (−101, −5) |

Why the box survived: M1's world pass (D12, D16) warps every straight mask edge **outside** the keep (`keep.npz`), but
inside the keep the ground is `ground_base` bit for bit. The keep covers 99 % of this window (the cameras look at it).
So the box was protected exactly where the cameras see it.

Why it looks worse live than in the renders: in the Blender renders the terrace's face was a scanned cliff
(`CLIFFS`, Poly Haven `coastal_cliff_04` at (40, 131), `build_cliffs`); the terrace box only filled its flat top. The
live site never had that scan. Its terrace is the bare box on an 8 m grid: a cake with smeared vertical sides. The
cliff columns the site does draw (`cliff_rocks` for Golden, line 220, x 21.3–23.9, y 14–88; for Sunrise, line 223,
x −99.5…−104.8, y −6…88) stand in **straight rows** along the straight faces: palisades (see the Sunrise row of
`.superpowers/m85/look-before/sheet.jpg`).

The terrace carries the grove: `TREE` (12.93, 140.37) and `GROVE_SPOTS` (dx −64…+30, dy −9…+16) put every grove
tree and shrub on it, x −51…43, y 131…157. Two shrubs sit at or past its west end (x −51, −47).

### Which stops and flights see it [seen]

Share of each camera's rays (`tools/world/views.py` grid, lens field × the tallest aspect, `ground_base`, within
1 500 m) that land in each zone. Read as "how much it is in the picture", not exact frame shares: the grid includes the
portrait field and the ground under the eye.

| Stop | turn | terrace | right face (x 10–35) | left face (x −115…−92) | beach corners (≤ 15 m) |
|---|---|---|---|---|---|
| Golden | 0 | 2.1 % | 6.8 % | 1.0 % | 42 % (the eye is 9.5 m from the right corner) |
| Golden | −40 | 0 | 0 | 9.8 % | 46 % |
| Golden | +40 | 2.5 % | **52.5 %** | 0 | 65 % |
| Sunset | 0/±40 | 0–1.1 % | 0–1.6 % | 0–0.2 % | 0 |
| Dusk | 0 | 3.0 % | 37 % (the eye stands on the headland, 6 m from the face) | 4.6 % | 0 |
| Dusk | ±40 | 0–2.3 % | 32–49 % | 0–6.7 % | 0–2.6 % |
| First light | 0 | 1.6 % | 4.2 % | 0 | 0 |
| First light | −40 / +40 | 0.9 / 1.1 % | 0 / 13.6 % | **15.2 %** / 0 | 1.0 / 6.5 % |
| Sunrise | 0 | 1.7 % | 2.0 % | 2.8 % | 2.4 % |
| Sunrise | ±40 | 0–2.2 % | 0–1.9 % | 0–6.6 % | 0.9–3.9 % |
| Before dawn | all | ≤ 0.1 % | ≤ 0.4 % | ≤ 0.3 % | ≤ 0.5 % |
| Blue hour, Night, Midnight | — | not seen | | | |

The terrace is a small share of every frame but it is **the silhouette the eye goes to**: the grove's island at
Golden, Dusk, First light and Sunrise. The right face fills Golden's right turn and Dusk's ground. The left face is
Sunrise's and First light's left. The right headland's north end (y 155–210) is seen by no stop: only from the air.

Flights that draw the cove (`src/world/cove.ts` `COVE_SEEN_ON`): Golden → Sunset, Sunset → Dusk, Dusk → Blue hour (first
two thirds), Night → Midnight (over the falls' lip, looking north), Midnight → Before dawn, Before dawn → First light,
First light → Sunrise. From the air the rectangle is plainest.

## 2. Reference sheet

### Real places and the owner's photos

| Place / photo | What to take | Link |
|---|---|---|
| Owner `cove-and-stacks` 1 (`alessandro-frati-tUJs-rrYMeI-unsplash.jpg`; Kynance Cove, I believe) | headlands as rounded lobes and knobs, islets off their tips, a beach curving into each arm | https://en.wikipedia.org/wiki/Kynance_Cove |
| Owner `cove-and-stacks` 8 (`premium_photo-1669050703458-10993eb8fe6d.avif`; McWay Cove, Big Sur, I believe) | a crescent beach that curls into the headland's foot; the headland's tip a rounded knob with trees on top and a skirt of rocks | https://en.wikipedia.org/wiki/McWay_Falls |
| Owner `cove-and-stacks` 12 (`zoshua-colah-4nyg46g-FQ8-unsplash.jpg`) | a long curved beach; the headland tapers into stacks; lines of surf follow the curve | — |
| Owner `cove-and-stacks` 7 (`panagiotis-falcos-ueDFX98GPzg-unsplash.jpg`, aerial) | a rocky point in plan: irregular at every scale, a reef running off its tip | — |
| Owner `cove-and-stacks` 4, 13; `cliffs-and-columns` 11 | flat grassy tops are real; what is not real is a straight vertical edge of one height. Real faces have spurs, gullies, tilted beds and an apron of fallen blocks at the foot | — |
| Owner `cliffs-and-columns` 3, 6, 8 | a cliff line seen along the coast: it curves, and each headland behind is a softer, paler step | — |
| Headland-bay beaches | a beach between headlands takes a crenulate (half-heart) plan: tightly curved in the lee of the upcoast headland, straighter downcoast. The parabolic bay shape equation (Hsu and Evans 1989) fits real bays; tested on 42 Portuguese bays [search] | https://ihcantabria.github.io/IHSetDocs/Model_description/models/static_equilibrium/equilibrium_planform/ihsetgonzalez.html , https://mepbay.paginas.ufsc.br/praias-de-enseada/?lang=en |
| Coastline roughness | rocky coasts are rough at every scale: fractal dimension D ≈ 1.25 for the west coast of Britain (Mandelbrot), 1.21–1.31 by other counts; Norway ≈ 1.52; Australia 1.13 [search] | https://fractalfoundation.org/OFC/OFC-10-4.html , https://rspatial.org/cases/2-coastline.html |
| Basalt coast (D24) | Reynisdrangar, Dyrhólaey (reference-landforms §1) | `research/reference-landforms.md` |

### Numbers to build with
- **Roughness by scale.** For a coastline of dimension D, the wander at each halving of wavelength is about 2^−(2−D)
  of the one above: D 1.25 → **× 0.59 per octave** [mine, from the self-affine rule]. So an outline noise with gain
  ≈ 0.6, not 0.5.
- **What the 8 m grid can draw.** The terrain is an 8 m height grid (`bake_base.py` GRID). A shape smaller than two
  cells (16 m) is lost. **Outline curves need radii of 16 m or more; anything finer must come from rocks** (cliff
  columns, crags, talus, pebbles) [seen, the grid].
- **Headland tips in plan** are blunt lobes, not points or squares: tip radius ≈ 0.3–0.6 × the headland's width [mine].
  The terrace is 27 m wide → tip radius 10–15 m (just at the grid's limit: round it at ≥ 14 m and let rocks carry the
  rest).
- **Where a headland leaves the coast** the inside corner is a smooth fillet, radius ≈ 1–2 × the headland's width
  [mine]: 25–50 m for the terrace.
- **Along a cliff face** the line bays in and spurs out every 1–3 cliff heights [mine; owner `cliffs-and-columns` 3,
  8]: for 20–35 m cliffs, a spur or small bay every 30–90 m, 5–15 m deep.
- **The foot:** an apron of fallen blocks ≈ 0.3–0.5 × the cliff's height wide [mine; owner `cliffs-and-columns` 11,
  landforms §2].
- **Beach into cliff:** the beach curls toward the headland and meets it at a sharp angle in plan, softened by rocks,
  never a right angle [owner `cove-and-stacks` 8, 1].

**What gives a fake shore away:** straight lines longer than ~50 m; right angles in plan; two parallel faces; a
flat-topped slab with one height of vertical edge ("a cake"); a cliff of constant height; columns in a straight row;
no apron at the foot; perfect circular arcs (too regular); a symmetric cove.

## 3. The plan (inline, task by task)

**Goal:** the cove's land has a real plan shape (a lobed terrace, bowed and scalloped faces, a rounded left tip,
beaches that curl into the cliffs), seen at every cove stop and from every flight, with every approved subject still in
place and no change in speed.

### Global constraints
- **D47:** a whole-world change is judged at all nine stops and along every flight before the owner sees it.
- **Protect the eyes.** Inside 20 m of each cove camera and its walk spots, `ground_base` must not move (|Δz| < 0.05 m),
  falling to full freedom by 40 m. Golden's eye is 9.5 m from the right beach corner, Dusk's 6 m from the right face's
  edge, Sunrise's 2.8 m from a steep slope. So **the right beach corner is not rounded in the ground; it is softened
  with rocks**, and the right face changes only north of y ≈ 60.
- **Keep the sightlines.** Golden's line to the arch passes ~15 m east of the left headland's north-east corner
  (x ≈ −91 at y ≈ 100; the headland's edge is x −107 at y 95). The left tip may round **inward or westward**, never
  east past x −100 north of y 80. Sunset's line to the arch clears the land by 1.4 m: the terrace's tip may not grow
  north of y 160 west of x −20.
- **Keep the subjects.** Every grove plant ≥ 3 m inside the terrace's new edge and on ground ≥ 10 m; Sunset's
  `LONE_TREE` (62.8, 145.8) unchanged; `LGROVE_SPOTS` on ground ≥ 4 m.
- **Dusk's 44 lanterns stay on water.** Their path (−12, 52) → (−150, 190) (`src/world/lanterns.ts`) passes the left
  tip ~40 m out: ground < −0.5 m under every lantern.
- **Speed:** the grid's size does not change; nothing new to draw. Census and GPU unchanged (checked, not assumed).
- **Coordinate with #2 (crags), being built now:** `crags.ts` stands columns on steep faces read from the grid at run
  time. It will follow the new ground by itself, but it was tuned on today's faces. **Do #13 after #2 is committed**,
  then re-shoot the crags.
- **Python edits in UTF-8** (`encoding='utf-8', newline=''`); long edit scripts go in a scratch file.
- Blender runs on this PC in the foreground, one at a time, with the owner's RAM in mind (~1.7 GB free).

### Task 0: the cheap evidence first (S; rule 7, no browser)
- [ ] `tools/world/shore_map.py`: a plan map of the cove (hillshade, the 0 m line in white, 5 m contours), the five cove
  cameras with their frames and ±40° turns, the grove, `cliff_rocks`, the lanterns' path, the spots and the arch
  sightlines; with `--before` it draws the old 0 m line too. (The research map was made this way in about a minute.)
- [ ] `views.compare(old_ground_base, new_ground_base, cams, 96)` per camera at 0 and ±40°: the share of each view
  that changes. Expected: Golden, Dusk, First light, Sunrise a few %; Blue hour, Night, Midnight 0.

### Task 1: the outlines as pure data, tests first (M)
In coast.py, above the render-setup marker (so `coastlib` loads it without Blender):
- [ ] `SHORE_OUTLINES`: closed plan polylines in coast axes, smoothed (Chaikin, 3 passes), for:
  - **the terrace:** a lobe from the headland, its south face bowing 3–6 m, a blunt tip (radius ≥ 14 m) near
    x −50…−55, a small bay on the north face, fillets of radius 25–40 m into the headland;
  - **the right face north of y 60:** a shallow bay 8–12 m deep and one spur before the terrace;
  - **the right headland's north end:** its corner rounded (radius ~40 m), seen only from the air;
  - **the left face and tip:** more wander (8–12 m at 60–150 m) and a D-shaped north tip, rounded inward/west.
- [ ] `outline_sd(name, x, y)`: signed distance to an outline (+ inside), plus an fbm wander with gain 0.6 (D ≈ 1.25),
  its smallest octave ≥ 16 m.
- [ ] `PROTECT`: circles round the cove cameras and spots (20 m fixed, 40 m free).
- [ ] Python tests, a new `tools/world/test_shore.py` (added to `run_tests.py`), written first:
  - the 0 m line (sampled every 4 m) turns by ≥ 8° over every 40 m along the terrace, the right face north of y 60
    and the left face (no straight runs);
  - no plan corner tighter than radius 14 m on those outlines;
  - `ground_base` unchanged within the protect circles; every camera's and spot's ground within 0.05 m of today's;
  - grove, lone tree and left grove: the constraints above;
  - all 44 Dusk lanterns on water;
  - the arch sightlines from Golden and Sunset clear the ground by ≥ 1 m;
  - the terrace's face stays a cliff: slope ≥ 1.5 between 1 m and 12 m height along its south and west sides;
  - `test_keep.py`, `test_views.py`, `test_reshape.py`, `test_coastlib.py` still pass.

### Task 2: the ground reads the outlines (S)
- [ ] `_ground_core`: `rmask` and `band` use `sm(…, outline_sd('right', x, y))` instead of `sm(15, 30, x)·sm(…, y)`;
  `lmask` uses `outline_sd('left', …)`. The height formulas stay; only the masks change.
- [ ] `_ground_world`: `pm` and `hum` use `outline_sd('terrace', …)`; the slab's top keeps 13.6 m + its humps.
- [ ] Blend with today's masks inside `PROTECT`.
- [ ] Do not touch `shore_y`: every waterline, wash, pebble field and spot depends on the beach.

### Task 3: the things that stand on it (M)
- [ ] `cliff_rocks` for Golden and Sunrise and Sunrise's `extra_rocks` are re-laid along the new faces by a pure
  function (`face_rocks(outline, spacing 6–8 m, setback 1–4 m, seed)`), heights following the cliff's height, not in a
  straight row; a few at the foot as an apron. Test: each within 4 m of its face, none in front of a lens (≥ 10 m from
  a camera, as `grove_plants` already checks for the rim).
- [ ] Rocks at the right beach corner (the softening Golden needs, instead of moving the land there).
- [ ] `GROVE_SPOTS` that fall outside the new terrace move in (their tests in Task 1 decide).
- [ ] Hand data with baked heights: `src/journey/spots.json` (each point's z; Dusk's "Step to the edge" walks to
  (29.3, 37.5), on the right face's top edge) and Golden's `LANTERN_AT` (`src/world/lantern.ts`): re-check against the
  new ground.

### Task 4: re-export everything that reads the ground (M; HANDOVER §2 order)

| Artefact | Made by | Why it changes |
|---|---|---|
| `tools/world/blender/keep.npz` | `python tools/world/bake_keep.py` (only if `test_keep.py` fails) | a pulled-back shore lets cameras see new ground |
| `src/journey/shots.json` | `python tools/world/export_hours.py` | `ground`, `eyeZ` per stop (should not move: protected), falls etc. unchanged |
| `public/world/base/heights.bin`, `ring.bin`, `colour.webp`, `base.json` | `python tools/world/bake_base.py` | the ground itself, and its painted colours (rock on new faces) |
| `src/journey/flightPaths.json` | `node tools/world/bake_flights.ts` | flights clear the new land |
| `public/world/base/dressing.bin` (+ counts in `base.json`) | `python tools/world/bake_dressing.py` | trees and scrub on land outside the cameras |
| `public/world/stops/cove/cliffs.bin`, `grove.bin` | `npm run world:blender` (Golden hour export; needs Blender and the Poly Haven sources under `WORLD_SRC`) | new `cliff_rocks`; grove z from the new ground |
| `public/world/stops/headland/arch.bin`, `stacks.bin` | the same Blender run (Blue hour) | should be byte-identical (s12: exports byte-stable); check |
| `src/journey/spots.json` | by hand (no tool writes it) | z of the walk points |
| `public/world/manifest.json` | `node tools/world/manifest.ts` | sizes and hashes |
| check | `npm run world:report` | fails if the manifest is stale (R-s16) |
| `public/world/stills/` | captured live (M8 Task 11) | the fallback stills of the cove stops are stale: recapture at the end of M8.5, not now |
| the Blender renders (`out3/`) | — | art direction only; not redone (D27) |

Also re-run: `python tools/world/run_tests.py`; unit tests that read baked data (`grove.test.ts`, `pebbles.test.ts`,
`lanterns.test.ts`, `spots.test.ts`, `flights.test.ts`, `crags.test.ts`, `scatter.test.ts`).
Run-time parts that follow the grid by themselves but must be looked at again: the meadow scatter, crags, pebbles at
Golden and First light, the life layer's fish ring, the sea's depth (foam and waterline follow the new 0 m line).

### Task 5: evidence (D47) and verdicts (M)
- [ ] `tools/world/shore_map.py --before`: the plan before/after. Owner sees this first (it explains the change).
- [ ] Build; `world-sheet.mjs <out> low "" .superpowers/m85/sheet-base` (all nine stops, every flight at ¼ ½ ¾,
  `vs.jpg`); and at mid. The frame-difference means tell what moved: Blue hour, Night, Midnight stops must stay < 4.
- [ ] `look.mjs` for golden, sunset, dusk, firstlight, sunrise (0 and ±40°), before/after.
- [ ] `flight-ts.mjs` on the old build (`../wt-head`, 4182) and the new (4181) for the seven cove flights at
  t 0.1…0.9, and `npm run aerials` for the view from above.
- [ ] Side by side with the owner's `cove-and-stacks` 1, 8, 12 (`npm run compare`).
- [ ] Speed: `gpu-sweep.mjs` low for the five cove stops (expected unchanged); a cold first ride Dusk → Blue hour
  (R38: nothing new to build, so 0 pipelines).
- [ ] Verdict per stop (look %), ledger entry, owner page with the plan maps and the sheet; he flips between builds on
  his laptop (two ports), since a terrain re-bake cannot sit behind a URL switch cheaply.

### Cost estimate
- Draws, materials, triangles, GPU: unchanged (same grid, same parts; cliff columns re-laid, about the same count).
- Download: the cove pack and the base re-baked at about the same sizes (±2 %).
- Work: coast.py (~150 lines with tests), one Blender export, the bake chain, a full D47 sheet. **Size: L.**

### Risks
- **Golden changes most** (its eye is 9.5 m from the corner and 52 % of its right turn is that face). Protection keeps
  the eye and foreground, but the right turn will look different. That is the point of #2 and #13 together.
- **The 8 m grid can only show big curves.** If the faces still read as smeared ramps, the next step is rocks along
  them, or (Phase 2) the scanned cliff face the renders had (`coastal_cliff_04`) exported into the cove pack for the
  terrace's tip and south face: ~0.3–0.6 MB, one more rock mesh in the shared material [mine, estimate].
- `keep.npz` may grow; `test_keep.py` limits the protected share to < 0.6.
- D32: things placed by the formula sit 2–5 m off the drawn grid on rims; re-check the grove's feet on the new edge.
- The Blender export needs the Poly Haven sources and RAM; if it cannot run, `cliffs.bin` and `grove.bin` stay old and
  the grove floats or sinks where the ground moved. Do not ship half: re-export or keep the old ground.
- `windAz` in `export_hours.py` was set by sampling open water once; it is hand data now and stays.
- The crags (#2) were tuned on today's faces: re-judge them after the re-bake.

## 4. My opinion

- **The triage guess was right, and it is bigger than "a square corner".** The whole cove is four rectangles. The
  worst one is the terrace (a 13.6 m slab with square corners in the water), and it carries the grove that every cove
  stop looks at. Start there, then the left face, then the right face north of Dusk. Leave the right beach corner's
  ground alone (Golden's eye is too close) and soften it with rocks.
- **Round at the scale the grid can draw (≥ 16 m), roughen below it with rocks.** A finer noise on the outline would be
  thrown away by the 8 m grid and would only make the bake differ from the formula (D32 again).
- **Keep the beach.** `shore_y` is smooth and fine; the waterline, wash, pebbles and spots hang on it.
- I would show the owner the plan map before and after first: it explains "the block" in one picture, and he judges
  shapes well.

Alternatives considered:
- **Props only** (more columns and crags along the straight faces, no re-bake): cheap, but the outline stays straight
  from the air and in silhouette. Useful as a complement, not the fix.
- **A finer local grid (4 m) round the cove:** would draw 8–10 m features, but needs a second terrain path in the
  renderer and the bake. Only if the 8 m result is not enough.
- **Bring back the scanned cliff** for the terrace face (what the approved renders had): the best detail per byte, but
  a new export and download. Phase 2, if the rounding alone stays under 80 %.

What I would not do: move any cove camera; change `shore_y`; touch the arch, the stacks or the headland line (far away,
own pack, approved); redo Blender renders; ship a re-baked ground without the re-exported cove pack.

## Sources
- Kynance Cove: https://en.wikipedia.org/wiki/Kynance_Cove ; McWay Falls and cove: https://en.wikipedia.org/wiki/McWay_Falls
- Parabolic bay shape: https://ihcantabria.github.io/IHSetDocs/Model_description/models/static_equilibrium/equilibrium_planform/ihsetgonzalez.html ,
  https://mepbay.paginas.ufsc.br/praias-de-enseada/?lang=en
- Coastline roughness: https://fractalfoundation.org/OFC/OFC-10-4.html , https://rspatial.org/cases/2-coastline.html
- Owner's photos (local, `.superpowers/refs/`): `cove-and-stacks` 1, 4, 7, 8, 12, 13; `cliffs-and-columns` 3, 6, 8, 11.
- The world's source: `tools/world/blender/coast.py` lines 24–27, 220–225, 266–290, 309–325, 810–872;
  `tools/world/bake_base.py`, `views.py`, `test_keep.py`, `test_reshape.py`.
