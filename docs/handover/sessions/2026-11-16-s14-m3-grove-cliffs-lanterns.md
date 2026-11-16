# Session s14 · 2026-11-16 · M3: the cliff columns, the grove, Dusk's lanterns and the thread

Opus 5.5, main account, inline (owner: short chat, save tokens).
Every number and ruling (R43–R52): the M3 ledger `docs/handover/ledgers/2026-11-16-m3-the-cove.md`, "Session s14".
Commits on `world`: 482ccce (Task 2), eb1154b (Task 5), plus this docs commit. Not pushed.

## Done
1. **Task 2, the cliff columns and the grove** (a new cove place pack, `public/world/stops/cove/`, 0.75 MB).
   - The grove is pure data in coast.py (`grove_plants()`: 43 trees and shrubs); the renders and the site share it.
   - `npm run world:blender` now also runs Golden hour: `export_cove` writes `cliffs.bin` (the 24 cliff columns at
     Golden and Sunrise) and `grove.bin` (four Poly Haven models as wood plus leaf cards, and their placements).
   - Leaf cards with bent normals: `tools/world/blender/foliage.py` (pure, tested).
   - Browser: `cove.ts`, `cliffs.ts`, `grove.ts`. One draw each. The leaf atlas is drawn on a canvas.
   - The re-export is byte-identical.
2. **Task 5, Dusk's lanterns and the thread.**
   - One paper look for every lantern (cream top, orange foot, no dark frame).
   - Dusk: 44 lanterns in loose strings, lighting one by one on arrival, drifting ≤ 0.03 m/s, each with a streak.
   - The thread (`journey/thread.ts`): a tap claims Golden's lantern; it drifts at Dusk (warmer) and rests in First
     light's shallows. sessionStorage, safe when blocked.

## Verdicts (mine, D15; sheets in `.superpowers/m3/t2e.jpg`, `t5e.jpg`)
- Grove and cliffs: look 72 %, behaviour 60 %. Lanterns and thread: look 66 %, behaviour 70 %.
- Places: Golden 64 %, Sunset 68 %, Dusk 58 %, First light 55 %, Sunrise 70 %. **Still none at 85 %.**
- What holds them back: Sunset's subject is a clump, not one clean tree; side-lit crowns read flat; Dusk's lanterns
  are points from that height; First light has no mist yet; nothing moving has been judged in motion yet.

## Speed (laptop, warm)
- Low (this laptop's tier): 56–60 fps at the cove stops; the cliffs and grove cost 2–5 ms of GPU together (most
  at Sunrise and Dusk, where they are mirrored); the lanterns nothing measurable.
- Mid: Dusk and Sunrise 33–39 fps, over budget with or without the new parts (s13's open item).
- Census: at most 52 draws, 13 materials at Golden (the cap is 14), 2.1 M triangles at Sunset.
- **Phone: not measured this session.**

## Learned
- **The live 8 m height grid lies 2–5 m under coast.py's formula along the rims.** Anything placed on a cliff edge
  must follow the grid (R43) or check it (R47). The same will hit later places.
- The sea is transparent at render order 1: anything additive on the water must draw after it (R50).
- The water mirror's ripple offset erases small lights; draw their streaks.
- Searsia's stems do not simplify (thousands of loose twigs).
- `horizon.spec.ts` (e2e) times out at its second pose **on clean HEAD too** (checked in a separate worktree).
  It predates s14. Open.
- `git stash` with an ignored path in the pathspec half-fails. Use a worktree to test an older commit.

## Open
- Task 8: the grove in the mirror (cost), fewer leaf cards at mid, mid at Dusk/Sunrise, Golden's material count,
  the phone over USB.
- Sunset: one clean tree as the subject (`meadow-and-flowers` 10) instead of the clump; maybe a ruling to thin the
  grove near Sunset's view.
- From before: R38 mirror first-build hitch (M6); `?cams=old` not built; stage-B pop-in (M8); the headland pack
  fetched at every start (now the cove pack too); the horizon e2e above.

## Next (s15)
- **M3 Task 3, First light's mist:** try `exponentialHeightFogFactor` limited to First light and Sunrise first (plan
  Task 3; research milestones-m3-m10 "First light's mist"); turn the surf foam down to force 0–1 at First light.
- Then Task 6 (life), Task 7 (spots), Task 8 (costs, phone, verdicts, owner page).
- Tools: `.superpowers/m3/tools/thread-shots.mjs` (stops with the thread claimed, mid/low), `ab-cove.mjs` and
  `ab-lanterns.mjs` (parts on/off, GPU ms), `laptop-4181.mjs` (stops and flights at 4181), `sheet.py`.
  `npm run compare -- http://127.0.0.1:4181 <dir> <stops> tier=mid` for the render and photo columns.
