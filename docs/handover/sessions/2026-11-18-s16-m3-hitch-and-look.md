# Session s16 · 2026-11-18 · M3: the Dusk hitch, the look pass, the final review

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
   Laptop worst frame into Dusk 51 ms (was 150). Phone: 0 frames over 50 ms into Dusk, stays on high, **but that
   phone run had no grove** (item 6), so it is owed again.
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

## Verdicts (mine, D15; `.superpowers/m3/s16-places.jpg`)
- Places (mid and low look the same): Golden 70 %, Sunset 76 %, Dusk 70 %, First light 69 %, Sunrise 75 %
  (s15: 66, 68, 60, 66, 72). **Still none at 85 %: no owner page this session.**
- Pieces: hitch fix behaviour 90 %; lanterns up close 74 %; Dusk from the stop 74 % / 75 %; bats 70 % (outline judged
  as a drawing, not caught large live); flowers up close 64 %; Sunset's lone tree 82 %.

## Speed
- Laptop A/B against the s15 build (one page at a time, two rounds): no cost from s16 at mid or low. Low 57–60 fps at
  the cove stops; mid 35–53 (the laptop ran warm; the s15 build gives the same). Census unchanged except Sunset's
  triangles 2.13 M with the lone tree.
- Phone (USB, Brave, WebGPU), on the build **without the grove**: a visitor's night, every flight 58–60 fps; into Dusk
  0 slow frames; Night and Midnight still 167–218 ms (R38); one 134 ms frame on Dusk → Blue hour in one of two runs
  (on low; not reproduced on the laptop). Cove stops 59.5–59.8 fps at mid and high.

## Learned
- In three r186, a material with `positionNode` must read `positionGeometry` in its colour, not `positionLocal`.
- `pipeline.compile()` is a no-op until `setScene`: a part joined before that compiles nothing.
- After any Blender re-export run `node tools/world/manifest.ts`, or the site refuses the new file.
- Live-grid lookups are in coast axes (x, y); `toThree` turns y into −z: sample with coast x, y.
- A quick way to place things: try candidates in the browser first, then write the winner into coast.py.
- I stashed a file once by reflex (`git stash -- <file>`) against the owner's rule; restored at once. Use a WIP commit.

## Open
- **Gate not finished (owner stopped the session):** check, 307 unit tests, build, size (293.3 kB gz) and
  `world:report` green; `world:test` stopped part-way (test_parts passed, grove with the lone tree included;
  test_reshape and later not run); e2e not run. Run both first in s17.
- **The phone check on the final build** (owner, tomorrow): `phone-visitor.mjs` twice and `phone-cove5.mjs`;
  the question is only whether the grove changes the Dusk result (it was 0 slow frames without it).
- No cove place at 85 % (what holds each back: the ledger, end of "Session s16").
- Minors: Dusk's lanterns ignore reduced motion; the 134 ms frame on Dusk → Blue hour (phone, once).
- From before: R38 (Night/Midnight first builds), mid at Dusk/Sunrise, `?cams=old`, stage-B pop-in (M8), packs fetched
  at every start, the horizon e2e.

## Next (s17)
1. Finish the gate: `npm run world:test` (background, ~12 min) and `npm run e2e`; then the phone check on HEAD (setup in HANDOVER §2).
2. Decide with the owner: keep pushing the cove toward 85 % (the list in the ledger) or close M3 at these numbers
   and carry the look items into M8 polish. My recommendation: one more look session on Sunset and Golden (the two
   nearest), then the owner page and close M3.
