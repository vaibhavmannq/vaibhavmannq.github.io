# M8.5 #9: Night's falls and walls (research and plan; s25, 2026-11-21)

Owner, Round 1 [6]: "the falls' break is odd, the stream thin; the walls awkward". Ledger triage #9.
This file is the Research phase (D20, D24, D28) and the plan for the fix. No code was changed to write it.

Marks, as in `research/README.md`: **[read]** I opened the source; **[search]** from a search summary; **[mine]** my own
reasoning; **[seen]** measured by me from an image or from the code.

## 1. What is wrong, and why

### The falls [seen]
- The live falls are two tiers (`bowl.ts` `fallsLayout`, `LEDGE`). The upper tier is two ribbons (2.4 m and 0.7 m wide
  at the foot) from the rim (36.9 m) onto a ledge at 15.4–16.5 m. The lower tier is four ribbons (0.8–3.9 m) from the
  ledge into the lagoon.
- The ledge is the three front rows of prisms broken off in the alcove. From the camera it is a **dark horizontal bar**
  across the fall at about 45 % of its height (`.superpowers/m85/look-before/night-0.png`, y ≈ 380–400 px). Water
  stops above it and starts again below it. That is "the break".
- The upper ribbons sit at x −0.8 and +3.4 m; the lower ones at −4.6, −1.3, +2.0, +4.6 m. **They do not line up**, so
  the eye reads two different falls, not one fall over a step.
- **The fall is thin because its layout is thin, not because the shader draws it narrow.** The camera stands 86 m from
  the falls (lens 20: 12.4 px per metre at 1920 wide). The lower span (9.6 m) should be ~119 px; the screenshot shows
  ~127 px. The upper tier is ~3 m of water: ~40 px. R142 in the M8 ledger says "renders much narrower than its layout
  (~125 px at 45 m)": **that note used 45 m; the real distance is 86 m. There is no shader fault to chase.**
- Width over height: the upper tier is 3 m over 21 m (0.14). The owner's Abiqua photo is 0.25 at the lip and 0.36 at
  the foot (section 2). Ours is two to three times too slim.
- The foot: mist sprites at 0.12 opacity, a foam disc. Abiqua's foot is a bright white skirt about 3 × the fall's
  width. Ours barely reads.

### The walls [seen]
- About 2 010 standing prisms in six rows, plus ~157 thin rim columns and 360 drums: **~2 530 prisms, ~42 k
  triangles** (my Python port of `bowlPrisms`; the M5 ledger said 31 k before the rim columns and trees).
- Every column has nearly the same width: circumradius 0.40–0.52 m (0.69–0.90 m across the flats).
- Lean is ±4.7° at most. Every column runs from 4.5 m under the water to its top in one piece.
- Columns break in runs of exactly six (`RUN = 6`). The median top difference between neighbours is **0.4 m** (90th
  percentile 2.1 m). So the top edge is a gentle saw, not broken.
- Rows 4 and 5 both stop at 97–100 % of the rim. From the stop, row 5 is hidden behind row 4. It only shows from the
  air.
- Each column has its own tone (0.8–1.25, `bowlGeometry`). Thin vertical stripes of different tone side by side:
  **a barcode, a fence.**
- No horizontal structure at all: no tier line, no ledge, no band. Real column walls are read as much by their
  horizontal breaks as by their verticals (section 2).

### What it costs today [read]
- Census at Night (M8 ledger R142): 42 draws, **14 materials (the D13 cap)**, 1.33 M triangles.
- GPU at low on this laptop (`.superpowers/m85/gpu-sweep.json`): Night 11.6 ms (Golden 11.4, Dusk 13.3).
- Night scales hardest with pixels: high ×2 is 103.7 ms (Golden 61.6); the mirror at full size adds 27 ms at ×2 (Golden
  8). On the phone, Night is the only stop that fails ×1.25 (16.3 ms; the rest ≤ 14.0) and caps ultra at ×1.15 (R172).
- So Night is **pixel-bound**: big surfaces with an expensive shader, drawn twice (eye and mirror). The bowl was
  measured at 2–4 ms at low (M5 ledger). Its 42 k triangles are ~3 % of the stop's triangles: cutting prisms alone
  saves little. Cutting shaded pixels and overdraw is what frees time.

## 2. Reference sheet

### Real places

| Place | Why | Numbers | Link |
|---|---|---|---|
| **Abiqua Falls**, Oregon (owner `waterfall` 5, `mj-tangonan-OE6qLhRHhhs-unsplash.jpg`) | Night's brief built by nature: one fall in a round amphitheatre of basalt columns, moss, a dark pool, trees on the rim | 89–92 ft (27–28 m) free fall [search]; columns on three sides [search] | https://www.oregonhikers.org/field_guide/abiqua_falls_hike , https://waterfallswest.com/blog/?p=2942 , https://ihitthebutton.com/abiqua-falls/ |
| **Svartifoss**, Iceland | dark columns round a fall | 20 m [search] | https://en.wikipedia.org/wiki/Svartifoss |
| **Litlanesfoss**, Iceland | a fall in two steps ringed by columns | 30 m in two steps; columns up to 15–20 m, among Iceland's tallest [search, one blog] | https://guidetoiceland.is/connect-with-locals/regina/hengifoss-waterfall-in-east-iceland |
| **Skógafoss**, Iceland (owner `waterfall` 1, 10, I believe) | one wide fall, a spray cloud at the foot | about 60 m high, 25 m wide [mine] | https://en.wikipedia.org/wiki/Sk%C3%B3gafoss |
| **Giant's Causeway** | column size | 38–51 cm across [search, Britannica]; ~99 % hexagonal [search] | https://www.britannica.com/EBchecked/topic/233107/Giants-Causeway |
| **Reynisfjara** (owner `cliffs-and-columns` 4, `premium_photo-1661962797396-eb892ff249ca.avif`, I believe) | column heights stepped like a staircase, broken tops | see below [seen] | — |

Photographers: the owner's own picks are the bar (D28). The falls photos are by Unsplash photographers named in the file
names (MJ Tangonan for Abiqua; Tom Coe, Collins Lesulie, Jeffrey Workman, v2osk). They are long exposures (silky
water). Spenser Sembrat's (`waterfall` 9) is a fast shutter: the truth for motion.

### The falls, element by element

Measured on the owner's Abiqua photo (`waterfall` 5) [seen], ratios only (perspective makes metres unsafe):
- **One body of water**, top to pool. No gap, no bar.
- Width at the lip ≈ **0.25 × the drop**; at the foot ≈ **0.36 × the drop** (it widens ~1.4× on the way down).
- **The skirt at the foot**: white spray ≈ **3 × the fall's foot width** across, rising ≈ **25 % of the drop**. It is the
  brightest, widest white in the picture.
- Texture: vertical streaks, two or three thicker "ropes" inside the sheet, edges ragged.

Tiers, where they exist (owner `waterfall` 4, 8: step cascades) [seen]: the water never stops at a step. It lands, turns
white and spreads, and **spills on wider than it arrived**. A dark rock band shows only beside the water, never across
it.

Physics:
- Speed after h metres: √(2·9.8·h). 37 m → 26.9 m/s at the pool [mine, school physics; reference book §3].
- A falling sheet breaks into ragged clumps after a short length: for a nappe, break-up length Lb ≈ 6·q^0.32 metres
  (q, flow per metre of width, below 0.25 m²/s) [search, Castillo, cited in MDPI Water 13(11):1593,
  https://www.mdpi.com/2073-4441/13/11/1593]. For q = 0.1 that is ≈ 3 m. So a 37 m fall is white and broken for
  almost all of its height; only the first few metres are glassy. Our shader already does this.
- The outer edge of a falling jet spreads by about 2–5 % (a slope) per side [search, Ervine and Falvey, same source].
  Over 37 m that is 0.7–1.9 m per side, 1.5–3.7 m in all. Abiqua's 1.4× fits.
- When water strikes a ledge it loses most of its speed and starts again from slow [mine]. Streaks just below a strike
  are short; they lengthen again lower down.
- Night's wind is force 0: mist rises and spreads slowly, about 0.4 m/s, and does not stream [reference book §2–3].

**What gives a fake fall away:** a gap or bar across the water; tiers that do not line up; one even sheet; constant
speed; a white lip; no skirt at the foot; glowing in the dark (book §3).

### The walls, element by element

- **Width is nearly uniform within one wall.** Polygon diameters are "fairly uniform at each outcrop"; between outcrops
  they differ (1.78 m, 94 cm, 42 cm at three Japanese sites) [read, Phys. Rev. E 104, 025009,
  https://arxiv.org/html/2105.07318v2]. So "varied widths" is not the main cure. Varied **heights, tiers, tilt and
  tone by set** are.
- **Tiers.** A lava flow cools into a lower **colonnade** (regular, thicker, straight columns; the lowest 10–30 % of
  the flow) and an **entablature** above it (thin columns, generally under 25 cm, in no steady direction; the central
  60–70 %, often two-thirds of the flow) [search: USGS https://or.water.usgs.gov/projs_dir/crbg/flowinterior.html ,
  USGS Circular 838 https://www.nps.gov/parkhistory/online_books/geology/publications/circ/838/sec1b.htm].
- **The owner's Abiqua photo shows exactly this** [seen]: regular columns low; above them a darker, rougher band; on the
  right wall the columns end at different heights in jagged "hanging" steps along a wavy line. That line is the
  strongest shape on the wall.
- **Broken tops** (owner `cliffs-and-columns` 4) [seen]: heights stepped like a staircase, tops cut at a slant, short
  drums lying at the foot. Steps between sets of a metre or more, not decimetres.
- **Lean:** colonnade columns stand within a few degrees of square to the cooling surface; entablature columns fan and
  curve (landforms §2, USGS above).
- **Tone** changes by set and by stain (seeps, moss stripes), not column by column [seen, Abiqua].
- **Plants** on ledges, on the tier line, on broken tops and on the rim; ferns and moss in the spray zone [seen, owner
  `waterfall` 5, 2, 7].

**What gives a fake wall away:** equal columns standing straight up; every column its own shade (a barcode); a top
edge
that only saws by decimetres; no horizontal line anywhere; plants only on the rim.

## 3. The target, in numbers

### Falls (Abiqua's ratios on our 37 m drop)
- One continuous body from the rim lip (z ≈ 36.9) to the lagoon (z 0). No dark bar across it.
- Wetted width ≈ 7–8 m at the lip, 10–11 m at the foot (now ~3 m and ~9.6 m with gaps).
- Inside it: three or four ropes of uneven width that touch in the upper 60 %, part a little in the lower 40 % (owner
  `waterfall` 2, 10), plus one thin stray strand at one side to break the symmetry.
- **A splash at the ledge:** a shoulder of broken columns under the right third of the sheet at ~15–17 m (40–45 % of
  the drop). The water there strikes it, bursts white (spray 1–3 m up, 3–5 m sideways), kicks out 0.8–1.5 m and falls
  on wider and rougher, its speed restarted near 40 %. The rest of the sheet falls free in front of it.
- **The skirt:** ~26–30 m across (≈ 3 × the foot), ~8–9 m high (≈ 25 % of the drop), bright at the base.
- Brightness unchanged: lit by the sky and aurora only (book §3, A2).

### Walls
- Two tiers: colonnade from below the water to a wavy line **T1 = 9–14 m** (≈ 30 % of a 36 m wall, ±2.5 m over 15–25 m
  of wall); entablature from T1 to the rim.
- Colonnade: columns 0.8–1.1 m across, lean ±3°, in sets of 2–9 that break together. Set heights step by 1–4 m; one
  in five sets rises well into the entablature as a tall pillar.
- Entablature: set back 0.3–0.8 m from the colonnade, so T1 is a real ledge with a shadow line under it. Thin
  columns (~0.45 m cells), leaning 8–15° and changing direction from set to set. Its lower edge is the jagged hanging
  line.
- Broken tops: 40 % of colonnade tops cut at a slant of 10–35°.
- Tone by set (±20 %), by column only ±4 %.
- Plant ledges: moss on the T1 shelf and on broken tops; 10–16 small shrubs on the shelf, clustered near the falls
  (the spray zone) and under the seeps.
- The rim's silhouette against the sky: 1–4 m steps, a few thin rim columns, the trees as now.

## 4. The plan (inline, task by task, like `docs/superpowers/plans/2026-11-19-m5-night.md`)

**Goal:** Night's falls read as one fall with more water and a splash at a ledge; its walls read as a real column
cliff (tiers, broken tops, tilt, a ledge with plants), and Night costs **less** GPU than today, not more.

### Global constraints
- **60 fps at low on this laptop:** Night at low ≤ today's 11.6 ms GPU (gpu-sweep), measured A/B in one build with a
  temporary switch. Hard ceiling: +0.9 ms (12.5 ms). Aim: −0.5 ms or better.
- **Phone:** Night at ultra (×1.15) still 59.5+ fps; report whether ×1.2 now holds (R172: 57.2 today).
- **Census (D13):** ≤ 14 materials (no new material: the falls' kinds go in the falls' mesh, the walls in the rock
  material, the ledge plants in the grove material), ≤ 60 draws, triangles about the same as today.
- **No download** (D30): everything is made in the browser, as now.
- **R38:** the falls' shader changes, so the cold ride Blue hour → Night must still show 0 render pipelines.
- **Do not break the crags (#2, being built in parallel):** `crags.ts` calls `bowlGeometry` and assumes 30 vertices per
  standing column with the top ring at 24–29. Keep that layout; new `Prism` fields default to the old behaviour.
  `tests/unit/crags.test.ts` stays green.
- **The Night → Midnight flight** passes the falls' left edge (FLIGHT_OVERRIDES `night>midnight`: x −325.5 to −327 at
  z 9–31; the falls' left edge is at x ≈ −325.6 now). **Widen the fall to the east (right), not the west**, and put
  the shoulder on the right third. Keep ≥ 1.5 m clearance (test).
- **Mixer:** `sound/mixer.ts` reads `fallsLayout().pool`. Keep the `pool` field.
- After any source edit: rebuild, check the build log's last line, check every part joined.
- One test browser at a time; stop it after each run (owner, s21).

### Task 0: measure where Night's GPU goes (S)
- [ ] A temporary `?off=a,b,...` in `boot.ts` that leaves named parts out at boot (`bowl`, `falls`, `rimtrees`,
  `nightlife`, `aurora`, `lanterns`, plus the mirror via `?reflect=0.01`). Removed at the end of the task.
- [ ] `.superpowers/m85/up-sweep.mjs out.json low 5 2 ";off=bowl;off=falls;off=rimtrees;off=nightlife;off=aurora"`,
  two interleaved rounds. Record Night's ms per part (other stops as a control).
- [ ] The same on the phone at ultra (`phone-ultra.mjs`, ×1.15 and ×1.2), when the owner's phone is free.
- [ ] Write the table in the ledger. **Decide the GPU levers (Task 3) from it, not before.**

### Task 1: one fall with a splash at the ledge (M)
Pure data and tests first (`src/world/bowl.ts`, `tests/unit/waterfall.test.ts`, `tests/unit/bowl.test.ts`).
- [ ] Write failing tests:
  - every strand is one strip from its lip (z ≥ rim − 0.2) to the lagoon (z ≤ 0.1), with no step in z between rows
    over 1.2 m (no break);
  - the wetted width (union of strands) is 6.5–8.5 m at the lip and 9–12 m at the foot, and never has a dry gap over
    0.5 m in the upper 60 % of the drop;
  - strand centres are continuous: no strand starts where none ended (no misaligned tiers);
  - at least one strand strikes the shoulder between 40 % and 50 % of the drop, on the east side; a spray source sits
    at the strike;
  - the per-vertex "seconds fallen" grows down each strand and drops to ≤ 50 % of its value at the strike; a free
    strand arrives at 24–30 m/s;
  - the skirt is 24–32 m across and 6–10 m high;
  - every falls vertex keeps ≥ 1.5 m from the Night → Midnight flight path;
  - one mesh, ≤ 8 k triangles.
- [ ] `fallsLayout()` v2: strands as paths (lip → free fall with the square-root throw → for struck strands: strike,
  kick out, churn, fall on). Each path is sampled into rows; each row carries `fall` = (seconds fallen, white share).
- [ ] `LEDGE` becomes a **shoulder**: in the alcove, only 3–5 columns under the right third, front two rows, broken at
  15–17 m and standing 0.8 m proud. The rest of the alcove stays full height behind the sheet (wet, dark, mossy).
- [ ] `waterfall.ts`: read the `fall` attribute instead of computing time from `drop` and `down` (same layers: glassy
  lip, white break, surges, streams). Add kind 3, the skirt: a ring of ~24 × 4 quads round the landing, rising and
  spreading, its opacity from the same noise moving upward. Same material, same draw.
- [ ] Spray: keep `SPRAY_COUNT` about the same; move ~10 sprites to the strike, give the pool's sprites larger size
  (6–10 m) and higher opacity near the water. Force 0: rise ~0.4 m/s, spread slowly.
- [ ] Temporary `?falls=old` keeps the two-tier layout for A/B shots and the owner's flip. Removed when he picks.
- Cost: triangles ~5 k (now ~4.8 k plus sprites). Overdraw: the skirt at low is ~160 × 45 px of blended layers
  (≈ 0.05 ms) [mine]. Measure it in Task 4.

### Task 2: the walls as a column cliff (M)
Pure data and tests first (`src/world/bowl.ts`, `tests/unit/bowl.test.ts`).
- [ ] Write failing tests:
  - a tier line T1(az) between 9 and 14 m everywhere, wandering by ≥ 2 m over every 60° of wall;
  - colonnade sets of 2–9 columns; the median top difference between neighbouring sets ≥ 1.0 m; at least 15 % of
    sets rise past T1 + 5 m;
  - ≥ 30 % of colonnade tops slanted 10–35°;
  - the entablature face stands 0.3–0.8 m behind the colonnade face at T1 (a shelf exists all round except at the
    falls);
  - tone by set: neighbours in one set differ by ≤ 8 % in baked `light`; neighbouring sets often differ by ≥ 15 %;
  - the light floor 0.12 holds; moss on the shelf ≥ 0.8;
  - the old tests still hold (60–100 m across, walls 25–40 m, west side low, camera clear, buttress close);
  - triangles ≤ today's (~42 k);
  - `crags.test.ts` unchanged and green.
- [ ] **Colonnade as real prisms** (2–3 rows; the silhouettes at the foot and the steps matter). Sets of random length
  2–9; set heights step 1–4 m; tall pillars; slanted tops (move the top ring along the axis by `tan(slant) · offset`:
  same 30 vertices, so crags keep working).
- [ ] **Entablature as one skin**, not rows of prisms: a strip mesh following `wallRadius` + set-back, from T1 to the
  rim, with a jagged lower edge (the hanging line) and a stepped top. Its `column` attribute is the plan position
  scaled so the rock material's own per-pixel columns come out ~0.45 m across, with a lean of 8–15° that changes by
  azimuth (the material already draws joints, facets and drum cuts from `column`). A few thin prisms (kind 1) on the
  rim for the sky silhouette, as now.
- [ ] Drop row 5 (hidden from the stop; from the air the skin's top covers it). This also helps #8: the skin's outer
  side can slope down into the crater ground instead of standing proud like a can.
- [ ] Tone by set in `bowlGeometry` (`light`), seeps as now; a darker band 2–3 m over the water (the wet foot) and
  the shadow line under T1.
- [ ] **Ledge plants:** `ledgePlants()` (pure) appends 10–16 small shrubs (the grove's searsia, scale 0.4–0.8) on the
  T1 shelf near the falls and under the seeps, to the rim trees' instances: same part, same draw, same material.
  Moss in the rock material on the shelf and on broken tops.
- [ ] Temporary `?bowl=old` for A/B (the current builder kept beside the new one until the owner picks).

### Task 3: free GPU time (S–M, chosen from Task 0's numbers)
In order of value for cost [mine]:
1. **Front-to-back order.** Sort the bowl's prisms by distance from Night's eye before building the index buffer
   (the mirror's camera stands under the same point, so the order suits it too). Early depth rejects the hidden
   faces. Pure, tested (index order monotonic by prism distance). Expected 0.3–1 ms at low [mine].
2. **Fewer layers of shaded surface.** Task 2's skin replaces 3–4 rows of overlapping prisms with one surface:
   less overdraw on the upper wall.
3. **Only if Task 0 shows the bowl's pixels still over ~2 ms:** a cheap path in the shared rock material for real
   prisms (a flag in an existing attribute; skip `columnCell`, the facet hash and one noise; compute `fwidth` before
   the branch, since WGSL forbids derivatives in non-uniform control flow). First measure the ceiling with a
   throwaway stripped material behind `?rockcheap=1` (a 15th material is fine for a measurement, never shipped).
   Risk: TSL `If` on a varying in r186 [mine, untested]. Same material, so D13 holds.
- Not worth doing [mine]: splitting the bowl so the south wall hides at the stop (vertex work only, +1 draw);
  cutting triangles for their own sake (the bowl is ~3 % of Night's triangles).

### Task 4: evidence and verdicts (S)
- [ ] Unit tests green (`npx vitest run tests/unit/bowl.test.ts tests/unit/waterfall.test.ts tests/unit/crags.test.ts`
  and the full unit suite), build exit 0.
- [ ] Shots at low and mid, new vs `?bowl=old&falls=old`: `.superpowers/m85/look.mjs` for `night` (0, ±40°);
  side by side with the owner's `waterfall` 5, 4, 8 and `cliffs-and-columns` 4 (`npm run compare`).
- [ ] Flights that draw the bowl: `.superpowers/m85/flight-ts.mjs` for Blue hour → Night (t 0.5–0.95: the crater from
  above, #8) and Night → Midnight (t 0.05–0.5: up beside the falls). `world-sheet.mjs` with the base sheet for the
  Night row and both flights (the bowl draws nowhere else, so the full D47 sheet is only a check that nothing else
  moved).
- [ ] GPU: `up-sweep.mjs` at low, queries `;bowl=old&falls=old`, two interleaved rounds; Night must be ≤ old. Phone:
  `phone-ultra.mjs` at ×1.15 and ×1.2.
- [ ] Census: `.superpowers/m3/tools/census.mjs` at Night (materials still 14, draws ≤ 42 + 0).
- [ ] Cold ride Blue hour → Night (`QUIET_COLD=1`, `.superpowers/m6/first-ride.mjs`): 0 render pipelines.
- [ ] Verdict per element (likes, dislikes, look %, behaviour %), ledger entry, then the owner flips `?falls=old` and
  `?bowl=old` himself.

### Cost estimate

| | Today | After (estimate) |
|---|---|---|
| Draws at Night | 42 | 42 |
| Materials | 14 (cap) | 14 |
| Bowl triangles | ~42 k | ~30–40 k (2–3 prism rows + one skin) |
| Falls triangles | ~4.8 k + sprites | ~5–6 k + sprites |
| Ledge shrubs | — | +10–16 instances in the rim trees' draw |
| GPU at Night, low | 11.6 ms | ≤ 11.6 ms; aim 10.6–11.1 [mine] |
| Download | 0 | 0 |

### Risks
- The skin may look flat in raking light. Mitigation: jagged edges, set-back, per-pixel facets; prisms keep the low
  silhouettes. If it fails, fall back to thin prisms in short kinked segments (more triangles; Task 0 decides).
- `If` on a varying in TSL r186 is untested here (Task 3.3 only).
- A wider, brighter fall and skirt raise the mirror's bright area: re-check the aurora's reflection still leads.
- The crags session edits `boot.ts` and `partOrder.ts` now: rebase on its commits; do not touch its files.
- #8 (crater from above) shares the rim: do its "sink the outside" in Task 2, or say clearly it is left for #8.

**Size: M + M (falls, walls) + S (GPU), about one session.**

## 5. My opinion

- **Drop the two-tier idea as the look; keep one ledge as a splash.** The owner's own best photo (Abiqua, `waterfall`
  5) is a single plunge, and his complaint is the break. Litlanesfoss gave us the tiers, but at 86 m a step reads as a
  bar unless water covers it. A shoulder under one third of a continuous sheet gives him "a splash at the ledge" and
  keeps the fall whole. I would show the pure plunge too, behind a switch, because it is the simplest and may win.
- **Fix the fall's width in the layout, not the shader.** The M8 note blaming the shader was a distance mistake.
- **The fence is a tone and structure problem more than a width problem.** Real column widths are nearly equal within
  one wall (the 2021 paper). What makes Abiqua read as rock is the colonnade/entablature split, the hanging line, the
  ledge with plants, and tone by set. Random widths would add noise and keep the barcode.
- **Making the entablature a skin is both better looking and cheaper.** It matches photo 5 (a rough upper face, not
  more rods) and removes rows of overlapping prisms.
- **Honest on GPU:** I expect 0.5–1.5 ms back at low, not a big win. Night's cost is pixels and the mirror. If Task 0
  shows the aurora or the mirror dominate, those are separate items, not this one.

Alternatives considered:
- A Blender-made bowl (scan or sculpted columns): more download (D30), a render round, and loses the made-in-the-browser
  speed of iteration. No.
- Making the falls a textured card from a real photo: cheap but flat, and it would not move with the light. No.
- Moving the camera closer to the falls: the approved composition (Amendment §5) and the lanterns' layout depend on it.
  Not without the owner.

What I would not do: add a new material for water or wall; add a particle system; make the water glow; add more rows
of prisms to hide the fence.

## Sources
- Abiqua Falls: https://www.oregonhikers.org/field_guide/abiqua_falls_hike , https://waterfallswest.com/blog/?p=2942 ,
  https://ihitthebutton.com/abiqua-falls/
- Svartifoss: https://en.wikipedia.org/wiki/Svartifoss ; Litlanesfoss:
  https://guidetoiceland.is/connect-with-locals/regina/hengifoss-waterfall-in-east-iceland ; Skógafoss:
  https://en.wikipedia.org/wiki/Sk%C3%B3gafoss
- Columns: https://www.britannica.com/EBchecked/topic/233107/Giants-Causeway ,
  https://arxiv.org/html/2105.07318v2 , https://or.water.usgs.gov/projs_dir/crbg/flowinterior.html ,
  https://www.nps.gov/parkhistory/online_books/geology/publications/circ/838/sec1b.htm
- Falling jets: https://www.mdpi.com/2073-4441/13/11/1593
- Owner's photos (local, `.superpowers/refs/`): `waterfall` 2, 4, 5, 8, 9, 10; `cliffs-and-columns` 4.
