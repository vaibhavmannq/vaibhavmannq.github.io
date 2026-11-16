# Session s13 · 2026-11-16 · M3: Research, plan, the cove's plants, new cameras at II and III

Opus 5.5, main account, inline (owner: short chat, save tokens).
Every number and ruling (R39–R42): the M3 ledger `docs/handover/ledgers/2026-11-16-m3-the-cove.md`.
Commits on `world`: 2f3d80a, acd7442 (not pushed).

## Done
1. **Research phase (D20).**
   - `docs/handover/research/m3-cove-references.md`: the gap per place against the owner's photos, what each
     element takes from them, and the behaviour numbers.
   - Baseline at mid and low.
   - Finding: the live cove places were nearly bare (no plants, trees, lanterns or mist; the headland a flat slab).
2. **M3 plan:** `docs/superpowers/plans/2026-11-16-m3-the-cove.md` (Tasks 0–8, Review Focus, the order).
3. **Task 1, grass and flower drifts.**
   - `src/world/scatter.ts` + `meadow.ts`: 37 k plants made in the browser by coast.py's rules and noise, with no
     download.
   - Each stop draws only its own plants (3 draws, 1 material), grown in and out over flights.
   - Wind from the world state; light through the blades; kept out of the mirror.
4. **Task 4, new cameras at II and III.**
   - Sunset: down in the meadow on the terrace's high end.
   - Dusk: the plateau's top edge, looking down.
   - Flights rebaked; the keep is tested against the approved render views (R42).

## Verdicts (mine, D15)
- Plants alone: look 68 %, behaviour 75 %.
- Sunset with the new camera: look 62 %.
- Dusk: look 35 % until its lanterns and trees exist.
- Golden, First light and Sunrise: little changed (grass framing at Golden; turf on Sunrise's slope).
- **No place is near 85 % yet.** The slab, the trees and the lanterns decide them.

## Speed
- **Low** (this laptop's real tier): 60 fps at all five stops.
- **Mid:** Sunset 55, Sunrise 53, Dusk 45. The plants cost 1–3 ms there. Dusk's mirror alone is over budget when
  looking down. The laptop ran warm this afternoon.
- **Phone: not measured this session.**

## Learned
- Plants on this GPU are triangle-bound, not light-bound. Per-pixel light was moved to once per frame with no
  gain at mid.
- `npm run world:test` slows every GPU measurement while it runs: measure only when it is done.
- The reflector's mirror camera is a clone made on first use. Wrapping `getVirtualCamera` lets it skip a layer.

## Open
- `?cams=old` (Amendment §2's switch back) is not built: it needs a second flight bake. Before/after shots are in
  `.superpowers/m3/`.
- Mid at Sunset, Sunrise and Dusk; Dusk's mirror cost (Task 8).
- Pointer parting of the grass is not built (mouse only, spec §10).
- From s12, still open: R38 mirror first-build hitch; lantern looks like a box (Task 5); stage-B pop-in (M8);
  headland pack fetched at every start.

## Next (s14)
- **M3 Task 2: the cliff columns and the grove.** Add a `cove` part to `tools/world/blender/export_parts.py` the
  way `export_stacks` works. Inputs:
  - coast.py `cliff_rocks` for Golden (x ≈ 22) and Sunrise (x ≈ −102), built by `rock_column`;
  - the `build_grove` / `build_lgrove` spots with Poly Haven `island_tree_01..03` and `searsia_burchellii`
    (sources under `.superpowers/brainstorm/lookdev/assets/models/`).
- The trees need leaf cards with bent normals (plan Task 2). Then Task 5 (Dusk's lanterns), Task 3 (mist),
  Tasks 6–8.
- Tools: `.superpowers/m3/tools/sheet.py` (contact sheets), `find.mjs` (height map and gaze lines),
  `zz-count.test.ts` (plant counts; copy into `tests/unit` to run);
  `.superpowers/m25/ab-meadow.mjs` (plants on/off, GPU ms), `laptop-m3.mjs` (five stops at low and mid, flights,
  census).
