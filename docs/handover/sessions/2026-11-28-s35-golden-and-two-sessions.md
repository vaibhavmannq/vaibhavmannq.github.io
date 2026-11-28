# Session s35 · 2026-11-28 · Sunset's checks, Golden to ~90 %, the speed carries, a second session beside this one

Opus 5.5, main account, inline on `world` (main checkout). Ledger `docs/handover/ledgers/2026-11-21-world-to-100.md`
R264–R269; D61, D62. A second session, **s35b** (Dusk, Task 18), ran beside this one on branch `s35b` in
`.claude/worktrees/s35b`; its log is `2026-11-28-s35b-dusk.md`; merged into `world` as bcf7267. Working files:
`.superpowers/w100/s35/` (`one.mjs`, `nine.mjs` (shoots during the hold), `sweep.mjs` (STOPS=), `bisect.sh`,
`sweepab.sh`, `gpuidle.ps1` (waits for a quiet GPU), `trace.mjs` + `tr.py` (a Chrome trace of one ride, slow frames
marked), `phone-hold.mjs` (a stop held on the phone), `pink.py`).

## Done
1. **Thrift heads' pink** back to s33's (R264, 14f5847): the s34 florets had turned the band mauve.
2. **Sunset on the phone** on this build (R264): held at high 58.3–58.8 (old 58.7–59.0); I → II level; II → III ~1 fps
   under (carry); a natural night with no freeze.
3. **Golden 17g** (R265): the silver cloud edges only on a card's sun side (ab40534; they outlined every card like a
   sticker). With the owner's yes: **17d** a Golden-only grade (`?grade=0`), **17e** the lantern as his water-lantern clip
   (`?lantern=old`), **the water** darker and violet keeping the sun's road (`?water=old`) (75d0971, a18a76e; one
   per-hour weight `grade`, 1 at Golden). Then **a dense violet bank low across the sun** (06bf9ff, `?sunbank=0`):
   12 uncropped far cards toward the sun, feet ~4° up so the sun shows under it. Darker water tried (×1.3): no gain from
   Golden's camera, which sees mostly sand (the render's camera is at the water's edge: the owner's call).
4. **Sunset's skein**: rebuilt side-on on the owner's note (1905f9a), then **removed** on his word, gulls kept (912ea45, D62).
5. **Sunset's +1.3 ms at low**: bisected, spread over 16g–16j, no single culprit; closed, no change (R266).
6. **Carry B** traced: the ~50 ms frames on low rides are the GPU's ceiling mid-ride (Chrome's last paint waits ~35 ms
   for our frame); Phase 4 (R267).
7. **Close**: s35b merged (bcf7267, then 4c4ff36); nine stops old vs new: only Golden, Sunset (skein) and Dusk (s35b)
   differ (D47 holds for the sea ripples and the sun bank); the first whole-night sweep caught +0.4–1.1 ms at untouched
   stops (Golden's grade and water, Dusk's ripples computed × 0 everywhere), fixed with uniform branches; the third sweep
   level with the session's start within noise (R268).
8. **Sunset's framing tree** (owner's screenshot: leaf patches floating off the limbs): thinned by whole 1 m clumps at
   full size; owner: "both looks good" (the tree and Dusk).

## The owner this session
- Golden on this build: **"it's actually beautiful and amazing, keep up the awesome work"** (D61).
- Sunset: "everything is perfect in sunset, just the birds" → removed (D62).
- Opened a second session for more throughput; the two shared the laptop by a lock file (`.superpowers/browser.lock`,
  one line `<session> <what> (started HH:MM)`; delete only your own line). With two Claude sessions and Brave open only
  one test Chrome fits (one of s35b's shot jobs was killed for low memory after this session ran vitest with 89 workers:
  run vitest with `--maxWorkers=2`). A side agent caught that Golden's speed checks predated the grade, water and lantern:
  re-measured at the close (R268).

## My %
Sunset ~91 % (owner: "perfect"), Golden ~90 % (owner: "beautiful and amazing"), Dusk ~68 % (s35b). Phase 3: Sunset and
Golden done on looks; Golden's phone check on the final build owed (R268).

## Open / next
- **The phone at Golden and Dusk on the merged build** (held at high, their rides): not done (unplugged at the close).
- Golden's camera at the water's edge (the render's) if the owner wants the darker water to show: his call.
- Dusk (s35b's list): its clouds (low dark banks with lit edges; cloudCards.ts, s35b asked to add a `twi` weight beside
  the sun bank), 18e (the left wall, foam line, walk glint), the owner's test.
- Temporary switches to tidy at Phase 4: `?grade= ?water= ?lantern= ?sunbank=` (Golden), `?rp= ?df= ?dsl= ?lf= ?lp=`
  (Dusk), and s34's `?rays= ?violet= ?lg= ?mote= ?nb=`.
- Speed carries in Phase 4: the phone's II → III and I → II ~1 fps under the old build; a resolution dip in rides on
  the laptop's lowest tier (R267).
