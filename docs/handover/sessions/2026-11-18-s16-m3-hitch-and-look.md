# Session s16 · 2026-11-18/19 · M3: the Dusk hitch, the look pass, the final review, M3 finished

Opus 5.5, main account, inline (owner: short chat, save tokens).
Every number and ruling (R65–R71): the M3 ledger `docs/handover/ledgers/2026-11-16-m3-the-cove.md`, "Session s16".
Commits on `world`: 98d9b58, 255b53c, f6c42d4, be480e5, plus this docs commit. Not pushed.

## Done
1. **The first flight into Dusk no longer builds shaders mid-flight** (98d9b58). Measured first with a log of every
   render pipeline the browser builds: Dusk's lanterns built theirs 3 s into the flight (150 ms frame). Two causes:
   - the near parts (lanterns, glints) asked for their compile before the renderer had its scene, so nothing was
     built; Golden's lantern was saved by the warm-up frame, Dusk's lanterns were not. They now join after it;
   - the water's mirror drew the lanterns too, and the mirror's first build is the R38 kind. The lanterns leave the
     mirror (R65; their streak already is the reflection).
   Laptop worst frame into Dusk 51 ms (was 150). **Phone, final build (2026-11-19, every part joined): 0 frames over
   50 ms into Dusk in both runs, and the governor stays on high the whole night** (s15: high → mid at Dusk).
2. **Lanterns read as paper** (255b53c, R66): open top, a crown (corners up, top edges sagging), creases, a lit inside.
3. **Dusk's lanterns from the stop** (255b53c, R67): a warm pool and a barred streak on the water under each. Found:
   three r186 reassigns `positionLocal` once `positionNode` is set, so the streaks had never shown since s14.
4. **Bats** have their own outline (255b53c). **Flower heads** are domes, not diamonds (R69). **Walk ends:** Sunrise's
   rim walk ends on the arch and stacks; Sunset's looks up 2° (R70).
5. **Sunset's subject is one clean tree** (f6c42d4, R68): a new lone tree on the meadow's far ridge, right of the sun,
   in coast.py (`LONE_TREE`) and the re-exported cove pack.
6. **Found and fixed in the gate:** after the re-export the site refused grove.bin (the manifest held the old size)
   and `world:report` still passed. The report now fails on a stale size.
7. **The final review of M3** (inline): three important bugs, all found and fixed this session (items 1, 3, 6); the
   life layer's per-frame uploads trimmed (be480e5); two minors open (ledger).

## Decisions
- D33: Sunset's lone tree in coast.py; Dusk's lanterns leave the mirror (my calls; owner told in this log).
- D34: M3 closes at 74–80 %; the rest moves to M8 (my call; the owner confirms on the M3 page).

## Verdicts (mine, D15; `.superpowers/m3/s16-places.jpg`)
- Places (mid and low look the same): Golden 70 %, Sunset 76 %, Dusk 70 %, First light 69 %, Sunrise 75 %
  (s15: 66, 68, 60, 66, 72). **Still none at 85 %: no owner page this session.**
- Pieces: hitch fix behaviour 90 %; lanterns up close 74 %; Dusk from the stop 74 % / 75 %; bats 70 % (outline judged
  as a drawing, not caught large live); flowers up close 64 %; Sunset's lone tree 82 %.

## Speed
- Laptop A/B against the s15 build (one page at a time, two rounds): no cost from s16 at mid or low. Low 57–60 fps at
  the cove stops; mid 35–53 (the laptop ran warm; the s15 build gives the same). Census unchanged except Sunset's
  triangles 2.13 M with the lone tree.
- Phone (USB, Brave, WebGPU), first on 2026-11-18 on a build **without the grove** (the stale manifest), then again
  on 2026-11-19 on HEAD 4aaf4f0 with all 19 parts joined (`.superpowers/m3/tools/joined.mjs` checks first):
  - a visitor's night, twice (`.superpowers/m3/s16/phone-visitor-s16-final.log`): every flight 58–60 fps, the tier
    **high all night** in both runs; into Dusk 0 frames over 50 ms; Dusk → Blue hour 0; only Night and Midnight's
    first builds remain (184/201 and 184/218 ms, R38);
  - the cove stops (`phone-cove-s16-final.log`): 59.5–59.7 fps, p95 16.8 ms, at mid and high;
  - the 134 ms frame on Dusk → Blue hour seen once on 2026-11-18 (on low, without the grove) did not come back.

## Learned
- In three r186, a material with `positionNode` must read `positionGeometry` in its colour, not `positionLocal`.
- `pipeline.compile()` is a no-op until `setScene`: a part joined before that compiles nothing.
- After any Blender re-export run `node tools/world/manifest.ts`, or the site refuses the new file.
- Live-grid lookups are in coast axes (x, y); `toThree` turns y into −z: sample with coast x, y.
- A quick way to place things: try candidates in the browser first, then write the winner into coast.py.
- I stashed a file once by reflex (`git stash -- <file>`) against the owner's rule; restored at once. Use a WIP commit.

## Day 2 (2026-11-19): finishing M3 (owner: "cover and finish M3 here")
- Gate on the s16 build: `world:test` all passed; e2e 23 passed, `horizon.spec` ×2 (pre-existing).
- Phone on the final build (every part joined): see Speed above; high all night.
- Built: `?cams=old` (Sunset's and Dusk's old cameras and their old flights), a backlit glow on the meadow's ground
  against a low sun (Sunset's mid-ground), pebbles at Golden and First light (shared rock shader, eye only, 500 each),
  Golden's lantern out of the sun's road, a bolder First light mist, Dusk's lanterns still under reduced motion.
  Commits 611323e, 1737fff. Rulings R72–R75 in the ledger.
- Cost: pebbles and the glow about +1.5 ms GPU at low, +1–3 ms at mid (A/B against 4aaf4f0).
- **Final looks: Golden 76 %, Sunset 80 %, Dusk 74 %, First light 74 %, Sunrise 76 %.** None at 85 %; I recommend
  closing M3 and carrying the rest into M8. Owner page: https://claude.ai/artifact/PrcvXudVZYCPSbpSAmFfU4 (asks: close
  M3? old or new cameras at Sunset and Dusk?).
- Phone not re-run after day 2's additions (the owner had unplugged); the laptop A/B shows the cost is small.

## Open
- No cove place at 85 % (what holds each back: the ledger, end of "Session s16").
- From before: R38 (Night/Midnight first builds, M6), mid at Dusk/Sunrise, stage-B pop-in (M8), packs fetched at every
  start, the horizon e2e.
- Carried to M8 (look): Golden's glare, Sunset's clump, Dusk's mirror resolution and dark foreground, a thicker First
  light mist, sun shafts at Sunrise, faceted flower heads up close.

## Next (s17): M4, Blue hour
1. Read the owner's answers on the M3 page (close M3; old or new cameras). If the cameras go back, only `shots.json`
   and `flightPaths.json` change (copy the `OLD_CAMS` values and `flightPathsOld.json` in, then drop the switch), and the
   walks at those two stops need new paths (they start from the new cameras).
2. A quick phone check of HEAD (day 2 added pebbles and the meadow glow): `phone-visitor.mjs` once, `phone-cove5.mjs`.
3. Start M4 (Blue hour): its Research phase (D20) and plan, per the spec and Amendment 1 (build order §10).
