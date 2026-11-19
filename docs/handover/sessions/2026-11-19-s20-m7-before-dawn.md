# Session s20 · 2026-11-19 · M7: Before dawn

Opus 5.5, main account, inline (owner: "complete M7 in this session", short chat).
Every number and ruling (R112–R122): the M7 ledger `docs/handover/ledgers/2026-11-19-m7-before-dawn.md`.
Plan: `docs/superpowers/plans/2026-11-19-m7-before-dawn.md`. Research: `docs/handover/research/m7-before-dawn-references.md`.
Commits on `world`: a722889, b1d845a, bb9822d, c9a9ec2, 8ae67b2, plus this docs commit. Not pushed.

## Start
- No owner answers pending (D38). Brief: M7 with its Research phase, plan, task-by-task verdicts, R38 kept fixed.

## Done
1. **Research sheet and plan** (a722889). No web search (the research folder covers caves, water, fog, living lights).
2. **The passage and the walk** (b1d845a): a 19 m passage of columns behind the chamber, made in the browser and merged
   into the cave's one mesh; the stop starts 14 m deep and walks to the old camera in 30 s (or with the scroll); the
   flight in backs in through the mouth facing the sea.
3. **Light, floor, pool, fungi** (b1d845a): the mouth's form factor lights the cave (not the Blender bake); Fingal's
   colonnade on the chamber's walls; one still pool that mirrors the mouth from any eye, with drips; cobbles, boulders,
   stumps; fungi in clusters and on the passage's vault, brightening along the pointer.
4. **Vines and moss** (bb9822d): leaf-shaped cut-out vines on the lip, swaying at force 1; moss on the rim.
5. **The skylight** (c9a9ec2): an option, on by default, `?skylight=off` without it. Faint and cool: no beam exists
   with the sun 10° down.
6. **Speed** (8ae67b2): vines and shaft drawn only near the cave (they had pushed Golden to 15 materials).

## Decisions
- D39 (my calls, owner told here), see DECISIONS.md.

## Verdicts (mine, D15; `.superpowers/m7/m7-final.jpg`)
- **Before dawn: 72 % at mid, 70 % at low** (before 58 %). **Behaviour 74 %** (before 50 %).
- Not 85: the floor's stones barely read; the colonnade is too regular; the passage very dark at the deep start; thin
  vines; the slab outside. I recommend closing M7 at 72 % and carrying these to M8 (as D38).

## Speed
- Census: Before dawn 36 draws, 1.15 M triangles, 9 materials (was 32 / 1.13 M / 7); every other stop unchanged.
- Laptop low: Before dawn 8.8 → 11.6–12.7 ms GPU, 60 fps both; mid over budget here in both builds, as before.
- No new download. Unit 366 passed; `world:report` green.
- **R38, cold first rides at low:** into Before dawn 0 frames over 50 ms (old build too). Out of it toward First light,
  **both builds** freeze 600–650 ms and 200–250 ms after two late pipelines: R121, open, older than M7.
- Gate: green; see "Gate" below.
- **Phone** (plugged in late): all parts joined; Before dawn held still 59.7 fps at mid and high; a ride into Before
  dawn hitches in both builds (worst 368 ms old, 285 ms new: R123, open); out of it worst 67 / 50 ms.

## Learned
- The cave's mouth is only ~50 m²: physically the inside gets a few percent of the sky's light; a dark-adapted eye's
  compression (share^0.6) is what makes it look like the owner's photos.
- A flight's gaze hides things: facing the hill on the descent showed the cave's dome from outside.
- A cold Chrome that had a failed run in it throttles the page to 1 Hz after ~45 s: restart it between runs.

## Open
- R121 (out of the cave, first trip, both builds), R122 (the sky through the mouth during the flight in, seen only in
  posed strips), R101, the M8 carry list (M3–M7).

## Gate
- Unit 366 passed; `world:report` green; `world:test`: all world checks passed.
- e2e: 27 passed, 20 skipped, 1 failed inside the full suite: `load.spec` (Chromium) "the name and the first view arrive
  in time on 10 Mbit/s", the name at 1.84 s against its 1 s bar. Run alone twice afterwards it passed both times: the
  laptop under the suite's load (as s19's smoke timing), not M7. `horizon.spec` passed this time.

## End of session (owner)
- D40: M7 closed below 85 % ("close M7, finish the gate and push"); leftovers to M8. `world` pushed after the gate.

## Next (s21)
1. M8, the whole night polished: its Research phase and plan first; the carry lists in the s16–s20 logs; R121 and R123
   (first-trip hitches into and out of Before dawn) early, with Sunset's meadow view (D38).
