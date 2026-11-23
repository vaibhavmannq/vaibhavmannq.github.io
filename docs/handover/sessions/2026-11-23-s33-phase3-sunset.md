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

## Next
Phone check on the final build (cool phone), then 16f: owner's test link with the switches, his notes. Then the carried
16c/16d/16e items, or Golden (journey order) if he calls Sunset good enough for now.
