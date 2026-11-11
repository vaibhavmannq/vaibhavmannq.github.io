# SDD ledger — plan: docs/superpowers/plans/2026-11-11-m2-the-four-unknowns.md
Setup: Ruling: work on branch `world` in place, no separate worktree (M0/M1 ruling stands; the branch is isolated from main) — cost if wrong: none.
Setup: Ruling: the plan was written and built in one go without a review stop — the owner's instruction for this session ("write its plan first, then build natively"), and "do it, then show" — cost if wrong: the owner disagrees with a plan decision after it is built; every decision is listed for them at the end.
Setup: references read on the owner's suggestion (real-time aurora films, moonlit cloud inversions, game waterfall breakdowns, sea-cave and glow-worm photography); what they change is in the plan's "like the real thing" section.
Pre-flight:
- T1 produces shots.json blocks (aurora, cloudsea, falls, cave) + HourPreset.aurora/.cloud + LightUniforms.aurora/.cloud; T3–T6 consume the same names — consistent.
- T2 produces aurora.json (131 samples, absolute az) + cave.bin/meta; T3 and T6 consume — consistent. cave.bin positions are coast axes (cave-local); T6 converts to three.js.
- T4 needs the height texture that sea.ts makes; T4 moves its creation into loadBase — consistent.
- T6 needs the sea's mirror (node + setHeight) and a terrain cut; both are T6's own edits to sea.ts/terrain.ts — consistent.
- T7 needs parts by name; boot's addPart gains a name in T3 already (each part is added with one) — noted.
Task 1: note: shots.json is now written with the exporter's own indent (the committed copy had been reformatted by hand once; biome ignores the file) — a one-time large diff.
Task 1: complete (tests: npx vitest run → 166 passed; python tools/world/test_bake_base.py → ok; biome clean). Before set: .superpowers/m2/before/.
