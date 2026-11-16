# Session s15 · 2026-11-16 · M3: First light's mist, the life layer, a walk at each cove stop

Opus 5.5, main account, inline (owner: short chat, save tokens).
Every number and ruling (R53–R64): the M3 ledger `docs/handover/ledgers/2026-11-16-m3-the-cove.md`, "Session s15".
Commits on `world`: fddc8d3 (Task 3), fbd9e92 (Task 6), 07c5bfe (Task 7), plus this docs commit. Not pushed.

## Done
1. **Task 3, First light's mist and the surf foam.**
   - The mist is a layer folded into the scene's one fog (`src/world/mist.ts`): no draw, no material. Density falls
     as exp(−k·y) over the sea and is integrated along the ray from the eye; patches drift with the wind
     (≤ 0.08 m/s). First light full (0.01 /m, top 2.0 m), Sunrise thin (0.35 of it), every other hour 0.
   - The built-in `exponentialHeightFogFactor` was tried first and dropped (R53): it ignores where the eye is, so
     from First light's eye it gave a thin bright line at the waterline, not a band.
   - The surf foam follows the wind force everywhere (`sea.ts foamLevel`): at force 0 a faint line and no swash
     sheet; Golden, Dusk and Sunrise (force 1) about half (R54; owner told mid-session).
2. **Task 6, the life layer** (`src/world/life.ts`, one sprite draw): gulls at Golden, Sunset, Sunrise; bats at
   Dusk; the flock lifting off the rim at Sunrise once per arrival; petals on Sunset's wind; dew at Sunrise; a fish
   ring every 4–9 s on First light's mirror (sea shader). Reduced motion keeps only the still dew.
3. **Task 7, spots:** one walk at each of Sunset ("Lie down in the flowers"), Dusk ("Step to the edge"), First
   light ("Wade into the shallows": to the visitor's lantern), Sunrise ("Walk along the rim"); HTML twins; glints,
   twins and taps now show only at their own stop.

## Verdicts (mine, D15; sheets `.superpowers/m3/t3b.jpg`, `t3d.jpg`, `t6b-crops.png`, `t7d.jpg`, `s15-places.jpg`)
- Mist: look 72 %, behaviour 78 %. Life: look 68 %, behaviour 76 %. Spots: look 70 %, behaviour 75 %.
- Places (mid and low look the same): Golden 66 %, Sunset 68 %, Dusk 60 %, First light 66 %, Sunrise 72 %.
  **Still none at 85 %.**
- Best new moment: First light's walk to the visitor's lantern in the mist.
- What holds the places back: Sunset's subject is still a clump, not one clean tree; Dusk's lanterns are dots from
  the stop (they read only from the walk); Golden's and First light's lanterns read as boxes up close; bats use a
  gull's shape; Sunrise's rim walk ends on a flat dark slope.

## Speed (laptop)
- Low, this laptop's tier: 54–60 fps at the cove stops (60 at all five when cool); the mist and the life layer cost
  nothing measurable (A/B against the s14 and Task 3 builds in a worktree, one page at a time).
- Whole-night flight vs the s14 build: low 4 vs 2 frames over 50 ms (both max 100 ms: the first-trip builds, R38);
  mid 5 vs 6; high interleaved ×4: 33.6 vs 34.3 fps, 53 vs 52 slow frames (no regression; high is not this
  laptop's tier).
- Mid still misses 60 at Dusk (40–45) and Sunrise (41–46): the base scene, open since s13.
- Census: ≤ 54 draws, Golden at 14 materials (**the cap**, R59), ≤ 2.1 M triangles.
- **Phone (USB, WebGPU), measured at the end:** the cove stops 59–60 fps at mid and high; a visitor's night: every
  flight 57–60 fps, the known first-trip hitches into Night and Midnight (151/201 ms), and **a new-to-us hitch on the
  first flight into Dusk (3 frames, worst 117 ms; governor high → mid)**. The s14 build does the same (worst 100 ms),
  so it came with s13/s14's Dusk (camera, grove, lanterns), not this session.

## Learned
- Two pages open at once share the GPU: an A/B must open one page at a time (`ab-builds.mjs` does).
- The built-in height fog suits a camera above the layer; for an eye inside a layer, integrate along the ray.
- Small things near a low eye (a fish ring, dew) vanish below a pixel: size them for the screen, then judge.
- The live grid falls steeply in front of Sunrise's and Dusk's eyes (D32): anything "near" must be checked
  against the frame, not just the ground (R57, R63, R64).
- `cat > file` with no heredoc waits on stdin forever in the Bash tool.

## Open
- **Task 8 is not finished:** the owner page and the final whole-branch review of M3. Gate green; `world:test`
  7/7; e2e 22 passed, `horizon.spec` ×2 pre-existing; Firefox `links.spec` failed once under load, passes alone.
- The first flight into Dusk hitches on the phone (above); suspect: the first mirror build of Dusk's parts (R38).
- No place at 85 %: Sunset's one clean tree, the lantern paper up close, bats' shape, Dusk from the stop.
- From before: R38 (mirror first-build hitch), mid at Dusk/Sunrise, `?cams=old`, stage-B pop-in (M8), packs fetched
  at every start, the horizon e2e.

## Next (s16)
- Find the Dusk first-trip hitch (phone; trace the flight into Dusk with `.superpowers/m25/trace.mjs`).
- Then the M3 look pass toward 85 % (Sunset's tree, lantern paper, bats), the final review, and the owner page.
- New tools: `.superpowers/m3/tools/ab-builds.mjs` (two builds, stops, one page at a time), `ab-flight.mjs`,
  `flight-frames.mjs`, `life-frames.mjs`, `spot-shots.mjs`, `census.mjs`, `laptop-4182.mjs`.
