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

10. **Closing round** (owner: "everything is closed, phone is connected"): sound on the phone (59.5–59.6 fps on every
    flight with sound on, 0 slow frames); R127 and R138 closed with evidence (neither is ours: R127 only in the cold test
    Chrome or under memory pressure; R138 is Chrome's own first drawing, gone after any ordinary page in a brand-new
    profile); the benchmark's part toggle fixed (R157); **Task 10** cheaper ground and mid's mirror 0.3 (Golden 60 fps at
    mid on this laptop; Dusk/Sunrise ~20–22 ms, the laptop settles on low there as designed); **Task 11** stills captured
    from the live site, landscape and portrait (R159); **Task 12** the gate and a whole-branch review (no important
    findings). Commits f5fb0a7, 53a5d62, 9c74a14, plus docs.

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
- Final: unit 388 passed; `world:report` inside every budget (stage A 0.17 MB); `world:test` passed (all world checks);
  e2e 28 passed, 2 failed under load only (Firefox smoke's 5 s bar, pre-existing; WebKit's no-GPU still passes alone);
  `load.spec` alone passed (name 372 ms, stage A 1.4 s); phone: every flight 59.5–59.6 fps with sound on; whole-branch
  review: no important findings.
## Where M8 stopped (end of s22)
- **All twelve tasks done on my side.** Places at mid (look): Golden 79, Sunset 83, Dusk 78, Blue hour 83, Night 78,
  Midnight 77, Before dawn 75, First light 78, Sunrise 78. None at 85. My recommendation: close M8 below 85 like M3–M7,
  carry the list below into the polish that follows M9/M10, and start M9 (the text).
- Carried: Sunset's slope content; Dusk's near grass and hard horizon; Golden low's wide road on the shallows; Blue hour's
  boxy blocks; Night's straight falls edges and the aurora blob; Midnight's far pale band; Before dawn's pale skylight
  shaft and dark deep start; Sunrise's dim turf; the spots' glint blobs; packs fetched by distance (the headland pack
  still fetched at every start); the two review minors (ledger, Task 12).

## Next (s23)
0. Done in s22: `s22` merged and pushed (4cfdab0); `s22-sound` merged into `world` locally (push on the owner's word).
   A background session works in a worktree (memory "background-session-worktree"); never delete one recursively.
1. **Owner, end of s22 (D46): M8 closed below 85 %; M8.5 before the text,** driven by his hands-on testing. Start with
   M8.5 Task 0 (a build he can open on his devices), then his Round 1 feedback
   (`docs/superpowers/plans/2026-11-20-m8.5-owner-hands-on.md`).
