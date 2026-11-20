# Session s22 · 2026-11-20 · M8: the look passes, the sound design, GPU-loss recovery

Opus 5.5, main account, inline, run as a background job. Every number and ruling (R148–R155): the M8 ledger, "Session
s22". **The work is on branch `s22`** (worktree `.claude/worktrees/s22`, node_modules a junction to the main
checkout's): a background session may not edit or run git in the main checkout, so `world` must be fast-forwarded to
`s22` from the main checkout (see "Next"). Commits: dd846bb, 6bb5c40, 1009183, 8ffdbaa, d8be1bc, 282b3b4, 7ca3d7f, plus
this docs commit. Not pushed.

## Done
1. **Dusk** (dd846bb): the mirror read with a cubic B-spline (no more stair-stepped edges, every hour, `mirrorSample.ts`);
   the sky's dome lights the land after sunset (`SKY_FILL`, Dusk 2×); grass clumps and more flowers at the lens.
2. **The glare** (6bb5c40): the bloom is fed light capped at 3 (`BLOOM_CAP`): Golden's sun road no longer hazes over the
   lantern; Blue hour's arch-foot glow (which the render has too) softer.
3. **Sunrise** (1009183): upright blades take a low sun from the side; dew 160 points (was 40); plants and grove follow
   the hour's sky fill. No sun shafts (sun out of frame; the render has none).
4. **Night's falls** (8ffdbaa): read as wide as their layout; denser spray where they land.
5. **Sunset's slope**: probed one pixel per light term; the shade is physically right, the glow is already its main
   light; it needs content, not light. Nothing kept.
6. **First light** (d8be1bc): the mist banks up past 40 m; the near water and far treetops keep the reference rules.
7. **Task 9 design** (282b3b4): `docs/superpowers/specs/2026-11-20-sound-design.md`, for the owner's yes.
8. **Task 10, part** (7ca3d7f): a lost GPU hands the view to the stills (e2e `gpuLoss.spec.ts`); the manifest preloaded.
9. **Task 9, sound, built and approved** (91a11d0, on `s22-sound`): eight CC0 loops from Freesound (Pixabay refused automated
   access), cross-faded by place and hour, the falls placed by distance and side, wind by force; silent and unfetched
   until the Sound button (top right). Owner listened on the laptop: "looks and sounds good" (D44).

## Decisions
- D43 (my calls, owner told here): the list in DECISIONS.md. The one to look at: no sun shafts at Sunrise.

## Verdicts (mine, D15; look at mid / low)
- Dusk 78 / 77 (was 74). Golden 79 / 76 (was 76). Blue hour 83 at mid (was 82). Sunrise 78 / 77 (was 76).
  Night 78 / 76 (was 76 / 74). First light 78 / 77 (was 74). Sunset 83 / 82 unchanged.
- Behaviour unchanged everywhere; GPU loss → stills: behaviour 85 % (tested on WebGL2's path; WebGPU's device loss not
  forced: three ignores a deliberate destroy).

## Learned
- The mirror is tiny (25–35 % of a reduced canvas): how it is *read* matters more than its size.
- The bloom took the sun's road (tens of units) at face value; a cap on its input fixes glare without touching lanterns.
- Plants lit with one up normal starve under a low sun; Sunset's and Sunrise's dark slopes face away from the sun.
- A background session must work in its own worktree and cannot run git in the main checkout.

## Open
- **R138 and R127 not re-measured:** the laptop had 0.9–2.2 GB free all day; every cold ride showed long main-thread
  tasks and 50–110 slow frames per flight in old and new builds alike. 0 render pipelines on every flight (R38 holds).
- **Phone, at the end** (USB, Brave, WebGPU, all parts joined): Dusk, Night, First light, Sunrise **59.6–59.7 fps at mid
  and high** (old build 59.4–59.8): no cost. Playwright could not attach to Brave (a stuck blank tab); a raw-CDP script
  drove the tab instead (in the job's scratch folder; copy it to `.superpowers/m8/` if needed again).
- Task 10's mid at Dusk/Sunrise on this laptop: not measurable today.
- Carried looks: Sunset's slope content; Dusk's near grass in frame and far horizon; Golden low's wide road on the
  shallows; Blue hour's boxy blocks; Night's ribbon edges and aurora blob; Sunrise's dim turf; the spots' glint blobs.

## Gate (this session)
- Unit 381 passed; `world:report` inside every budget; e2e `gpuLoss.spec.ts` 2 passed; `world:test` passed (all world checks). Full e2e not run.

## Where M8 stopped (end of s22)
- Done: Tasks 0–8 (Task 7 closed: every place had a pass), Task 10 in part (GPU loss, preload).
- Done after the first close: Task 9, sound (D44).
- Not started: Task 10's mid-tier speed, Task 11 (stills), Task 12 (gate, whole-branch review).

## Next (s23)
0. Done in s22: `s22` merged and pushed (4cfdab0); `s22-sound` merged into `world` locally (push on the owner's word).
   A background session works in a worktree (memory "background-session-worktree"); never delete one recursively.
1. R138 cold with memory free (the phone pass of s22's stops is done).
2. Sound on the phone (heard over its speaker; nothing fetched before the tap).
3. Task 10's rest (mid at Dusk/Sunrise; half-size bloom for low), Task 11 (stills), Task 12 (gate, review).
