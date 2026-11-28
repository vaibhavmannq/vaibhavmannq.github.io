# Session s36 · 2026-11-28 · III · Dusk (Task 18): the far left wall, its sky

Opus 5.5, main account, inline on `world` (main checkout), no second session. Ledger R271. Working files:
`.superpowers/w100/s36/` (`shots.mjs`, `ride.mjs`, `sheet.py`, `sweepab.sh`, `phone-ride.mjs` (one ride on the phone:
START, Next pressed, rAF intervals), sheets `dusk-sheet.jpg`, `others-sheet.jpg`, `sky-sheet.jpg`, `low-sheet.jpg`,
`rides-sheet.jpg`). Before build: `../wt-head` at a7688e3 on :4187.

## Done
1. **The far left wall** (8b686b7): the left headland's face south of Sunrise's column row stands on the beach, so
   `face_rocks` (a waterline scan) never reached it. `wall_rocks` in coast.py (foot = where the ground first stands 8 m
   over the scan's start): 14 columns, y −85 … −10, appended to Sunrise's `cliff_rocks`. `CLIFF_TRIS` 68 k; Blender
   export (golden run only, 2.5 min) + `bake_light` + manifest + report. Dusk's left view: the curtain is a column cliff
   (60 → 70 %); Sunrise's left view: the smeared brown curtain gone to the frame's edge; Golden straight, First light
   unchanged. Tests updated: shore (a face over the beach), parts (69 columns, ≤ 70 k tris).
2. **Dusk's sky** (8b686b7): a per-hour `highSky` (Dusk 1, through its rides) deepens the high sky to violet; the
   clouds follow; the sea's mirror does not (gated on the eye above the sea; first try turned the water blue-violet).
   No glow, no rays (afterglow and twilight clouds stay off, the owner's). **The owner's call**: `?dv=0` the old sky,
   `?dv=0.8,0.62,0.04,0.5,1` with the mirror too.
3. Five views at high and low, rides Sunset → Dusk → Blue hour (smooth fade), whole-night low sweep old vs new (level
   within noise), phone (Dusk, II → III, III → IV, Sunrise: level), `world:test` passed, vitest 564/564.

## My %
Dusk: straight 76, left 70, right 70, up 68, down 72 → **~71 %** (from ~68). What is left against the render is its sky
(glow and rays over the set sun, dark banks with lit edges), which the owner has turned off.

## Side agents' notes this session
- Golden/Sunrise also see the new columns: checked before/after (others-sheet.jpg); the triangle cap raised so old
  columns keep their detail.
- The violet sky is near what the owner turned off: worded as his A/B in code and here, not slipped in.

## Open / next
- **The owner's test** of Dusk on :4181 (the wall; the sky, `?dv=0`; the mirror variant). His answer decides the sky's
  default.
- The phone at Sunrise: two dips seen once on the new build, not reproduced in nine windows (watch on the next run).
- Then Task 18 closes on the owner's word; Phase 3 continues with the next place (Blue hour, Task 19).
