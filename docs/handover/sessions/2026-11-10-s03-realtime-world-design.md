# Session s03 · 2026-11-10 · the real-time world design, drafted

## Done

1. Read the handover, decisions, s02 log, the slice's report data and code, coast.py's nine cameras.
2. Owner opted out of a question round: "do it then show it to me and ask questions if I don't like it, I want all 9
   scenes created first".
3. **Design written:** `docs/superpowers/specs/2026-11-10-realtime-world-design.md` (not committed). Architecture,
   journey (9 stops, 8 flights), per-part recipes (terrain base + detail, water, sky with stars/moon/aurora, grass,
   rocks with baked light, trees with bent normals, glow, waterfall, cloud sea, cave), pipeline, loading, tiers and
   governor, budgets per D9, build order M0–M10, risks, my calls.
4. **Offline page for the owner:** `.superpowers/design/realtime-world-design.html` (self-contained, 0.8 MB: nine
   renders, world map, cove map, distances). Built by `build_page.py` from the html-report template (scripts were in
   the session scratchpad; the page is the artefact). Checked in a browser: no outside requests, both themes, 420 px.

## Learned

- **The route is 5.8 km.** Flights: 146, 101, 1524, 1735, 1053, 991, 197, 94 m. The slice proved only the first 146 m.
- **The world formula breaks from the air:** midnight valley is a rectangle, both headlands are straight-sided blocks,
  the Sunset plateau is a box over the sea, the inland is bare. Invisible in the nine renders, obvious in a flight.
  Design answer: a world pass (M1) before any place gets detail, checked per camera with raymap.py.
- Ground heights at the cameras (JS port): Golden 0.3, Sunset 14.4, Dusk 25.6, Blue hour -0.2, Night 0.4,
  Midnight 283.5, Sunrise 33.8.

## Decisions

None recorded yet. Proposed in the design §20: D11 (build order: rough night, world pass, four unknowns, places; text
after), D12 (world pass), D13 (one shared material set, ≤ 60 draws, ≤ 14 materials, CI), D14 (WebP, amends D8's KTX2).

## Open questions (owner)

- Verdict on the design and on the nine "my calls" in §20 (scroll length, high glide on long flights, fade on rail
  jumps, blurred render at first paint, fake glow, grass parting off on touch, coast.py into the repo, mid start,
  text mapping).

## Next step

1. Owner reads `.superpowers/design/realtime-world-design.html`, says what they don't like. Fold changes into the spec,
   record D11–D14, commit the spec only when asked.
2. Then superpowers:writing-plans for **M0 (the rough night)** only, on a `world` branch.

## Later in s03

- Owner: "everything looks good on paper, let's go". D11–D14 recorded in DECISIONS.md.
- Plan for M0 written: `docs/superpowers/plans/2026-11-10-m0-the-rough-night.md` (16 tasks). It departs from the
  spec in six small, listed ways (no JS ground port in M0, base as one mesh, parts without load/setFade yet, tier
  changes only at stops, landscape framing in portrait, the first view is the Golden still).
- Next: owner picks how to run it (native or subagents) and OKs per-task commits on `world`; then Task 1.
