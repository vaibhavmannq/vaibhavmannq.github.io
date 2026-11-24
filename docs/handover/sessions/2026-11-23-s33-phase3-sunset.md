# Session s33 · 2026-11-23 · Phase 3 begins: II · Sunset (Task 16)

Opus 5.5, main account, inline on `world` (main checkout). Plan `docs/superpowers/plans/2026-11-21-world-to-100.md`
Task 16 (16a–16f, written this session); ledger `docs/handover/ledgers/2026-11-21-world-to-100.md` R239–R247.
Commits d728faa … fc0e418 (+ docs). Nothing pushed. Two helper agents did read-only prep (owner: "for reading and
preparing or for researching"): `.superpowers/w100/s33/prep-16d.md`, `prep-16e.md`.

## Done
1. **Owed s32 phone checks** (R239, R244): the lost tier on II → III is **not** the cards sky. The old build loses it in
   the same place (heat). VI → VII at high: new within ~1 fps of old; photo sky ~1.8 fps better.
2. **16a clouds' cost:** each card cropped to its visible cloud (`cardCrops`). Phone: +1.7 fps, a third fewer slow frames
   vs no crop. Laptop: no measurable change (16b's warm light eats it). A grid of masked quads was tried and dropped.
3. **16b sun and sky:** the sun's aureole, a gold lobe in the sky's own colour toward a low sun (`horizonGlow` in
   `colorAt`, behind a uniform branch), cards lit by the sun's colour with glowing bases. Only Golden and Sunset change.
4. **16c meadow, first pass:** daisy/buttercup/poppy shapes, round thrift that varies pale to deep rose, drifts speckled
   with other kinds, Sunset's flowers ×1.7 taller (they hid in the grass), backlit grass gold. The owner's dense poppy
   drifts kept (my "specks" try was worse, dropped). Meadow +1.2 ms at Sunset on low (laptop).
5. **Blacks `mid` by default** (owner: deep made the colours vanish): 85 % of the sky's fill, 35 % of the floor (R245).
6. **16d framing tree:** 30° left, 9 m, turned 5.5 rad, crown trimmed (`trimCrown`), out of the mirror: trunk and limbs
   read against the sky. 25 → 62 %.
7. **16e middle distance:** `tussocks.ts` (crest fringe + drifts, ≥ 2/3 at every tier) and `gust.ts` (a band rolls from
   the crest every 24–40 s; `?gust=now`). Straight 60 → 78, left 50 → 74, right 45 → 72, down 45 → 70 %.
8. **Test tool fixed** (R243): `quiet-browser.mjs` really closes Chrome now (tabs had piled up; owner asked); the broken
   saved window reset. Laptop GPU numbers ~12:20–14:00 were void and were redone.

## Numbers (final)
- Laptop low, whole night old vs new (best of 2): Sunset +1.5 ms, others +0.3–0.9 (before the glow branch; the laptop
  was slow in both builds today, 43–59 fps at low even for the old one). A second sweep after the branch was too noisy.
- Sunset overall, my eye: 72 % at the start → ~78 % (sky 80, meadow 72, tree 62, middle 75). Sheet:
  `.superpowers/w100/s33/sunset-s33-before-after.jpg`.

## Owner's notes this session
- "can we find a middle ground" (blacks) → `mid`.
- "spawn sub agents" → "i meant for reading and preparing or for researching" (helpers redirected; built nothing).
- "why are keeping so many tabs open in chrome testing" → the close bug (R243).
- "why isn't it 1980x1080" → judging shots now 1920×1080 (speed was always measured there).
- Asked how far to 100: the plan's tasks reach ~85–88; the rest is listed below.

## Open / carried
- **Phone on the final Sunset build** (tree, tussocks, gust): the run failed on a path bug and the phone was 72–79 °C.
  Run when cool: `NEWPORT=4187 START=golden RIDES=2 TIER=high bash .superpowers/w100/s33/probes.sh "old|x=1" 2` (do not
  export MSYS_NO_PATHCONV in that shell) and the same with `START=midnight`.
- 16c: thrift still dominates near the lens; whites barely show. 16d: warm rim on the wood (prep C), finer trunk (E).
  16e: scrub groups and outcrops (prep B), the ground's green under gold plants (prep D). The near-lens soil strip.
- To 100 (beyond the plan): flowers that read real at the lens (soft near ones), sun road on the water from this camera,
  more cloud shapes, the rides I → II and II → III as shots.
- Temporary switches to settle or remove: `?glow= ?aur= ?cw= ?cl=nocrop ?gg= ?fs= ?fo= ?fc= ?mid= ?gust=`.
- Servers left: 4181 (main dist), 4186 (pre-s33 build, `s33/dist-head`), 4187 (`s33/dist-16e`).

## Day 2 (2026-11-24) and the close
- Owner: "looks beautiful"; then "A and do until you feel everything is 100%". Done: far flowers as heads (−43 %
  triangles, look kept), the tree's warm rim, shrubs on the hill, dry gold turf, 42 cloud shapes, a finer trunk, the
  crest opened for the arch and sun (owner's pick, Golden's treeline kept), name and line hidden until M9 (`?name=on`),
  blacks `today` (owner's test). Ledger R249–R251. Sunset ~84 %.
- Learned: run browser checks alone (world tests on the CPU made a fake 500 ms freeze); servers do not survive a
  restart; a scrolled/partial frame means a stale test profile (R243).

## Day 2, the end: speed and the phone (R252–R254, D60)
- Every laptop GPU number had shared the GPU with the owner's site tab in Brave (15 % at rest): close site tabs first.
- Clean: the 60 fps rule at low was not met at six stops, and the pre-clouds build missed it at five (an older gap).
- Ground in 5 × 5 tiles (−0.5 M triangles at every stop, eye and mirror); at low the mirror redrawn every 3rd frame at
  rest. Low: every ride 57–59 fps (faster than before); at rest 60 at five stops. Cold ride: 0 late pipelines, 0 slow.
- Phone: today faster than the old build on Sunset's rides (I → II 58.3 vs 56.3, II → III 56.3 vs 53.6), level on
  VI → VII; natural nights the same tier path, today equal or better on every ride.
- Tuning switches written in as values. Commits through the docs of R254.

## Next
s34: Sunset to ~95 % (plan Task 16, "Status at the end of s33": 16g shafts and motes first, then 16h–16l, 16f close with
the owner's test); speed carries (Sunrise 54 at rest on low, the II → III judder after a short rest). s35: Golden, then
the other places in journey order.
