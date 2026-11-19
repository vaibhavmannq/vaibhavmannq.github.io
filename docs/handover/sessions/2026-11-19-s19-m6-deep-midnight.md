# Session s19 · 2026-11-19 · M6: Deep midnight, and R38

Opus 5.5, main account, inline (owner: "complete M6 in this session", short chat).
Every number and ruling (R100–R110): the M6 ledger `docs/handover/ledgers/2026-11-19-m6-deep-midnight.md`.
Plan: `docs/superpowers/plans/2026-11-19-m6-deep-midnight.md`. Research: `docs/handover/research/m6-midnight-references.md`.
Commits on `world`: 71a8e7d, c1d7804, 87a075d, 594e835, 3e260f3, 357c038, 55395ec, c1f83c1, plus this docs commit.
Not pushed.

## Start
- No owner answers on the M3, M4 or M5 pages. The brief: keep the current choices, carry on; every session is reviewed
  in the final one.
- Mid-session the owner named six UI and motion sites to use for all milestones (Kawaii Text Animation, 21st.dev,
  Supahero, Originkit, Fontshare, MotionSites). Surveyed in the built-in browser: `research/owner-sites.md` says what
  each milestone takes (mostly M8's cursor and loader and M9's text reveals and type). "Kawaii Text Animation" was not
  found under that name: **asked the owner for its link.**

## Done
1. **R38 found and fixed** (71a8e7d). A first visit simulated with a Chrome that has no shader disk cache
   (`QUIET_COLD=1`); the late builds were all the sea's mirror (aurora, cave, a sprite, the cloud deck: 0.45–1.1 s
   frames). Each part is now built for the mirror before it shows. s12's "the mirror drew over the whole view" was
   three r186 sharing one camera uniform group between pre-built shaders (`NodeBuilder._getBindGroup` keys it by
   `renderer._currentRenderContext`, which compileAsync leaves empty); `keyBuildsByOwnContext` keys each build by its
   own context. Laptop, cold: into Night and into Midnight 0 slow frames in flight (old build 500/833 ms and 867 ms).
2. **Research sheet and plan** (c1d7804).
3. **The ridge top** (87a075d): a designed ground within 60 m of the eye (a 7° shoulder, a knoll, hummocks) in the
   terrain's material; heather as a new plant kind and Midnight as the meadow's sixth stop; moonlit colours grey
   (Purkinje) for plants, turf and leaves at Night and Midnight.
4. **The lone tree** (594e835): the cove pack's tree at coast.py's midnight prop, in the grove's material.
5. **Ranges fading with distance** (3e260f3): four silhouette ranges made in the browser; the deck reaches north under
   the whole view.
6. **The moon's road** (357c038): forward scatter toward the crescent, broken by the lumps; the old crest-light lobe that
   lit the whole deck narrowed.
7. **The late-night aurora** (55395ec): soft foot, weaker, patches breathing on 6.5/11/17 s clocks (judged on a frame
   strip).
8. **Look pass** (c1f83c1): bare patches in the heather, smaller cloud lumps, the aurora a step stronger.

## Decisions
- D37 (my calls, owner told here): R100–R110 in short, see DECISIONS.md.

## Verdicts (mine, D15; `.superpowers/m6/m6-final.jpg`)
- **Deep midnight: 74 % at mid, 72 % at low** (before 45 %). Behaviour 72 % (before 55 %).
- Not 85: heather as a carpet not clumps, a pale slab bottom-left, the flat far plain, rolling swells in the deck, no
  earthshine, nothing answering the pointer. I recommend closing M6 at 74 % and carrying these to M8.

## Speed
- Census: Midnight 38 draws, 1.85 M triangles, 10 materials (was 32 / 1.34 M / 7). Dusk back to 46 / 12.
- Laptop held still, cool, low: Midnight 11.4 vs 11.5 ms GPU (old/new), 60 fps; mid: new 19.5 vs old 22.0 ms.
- Size 309.4 kB gz (was 306.7). No new download (the tree is in the cove pack). `world:report` green.
- **Phone** (plugged in at the end; Brave, WebGPU): a visitor's night with this build had 0 frames over 50 ms on every
  flight in two runs (worst 34 ms), the tier high all night; e406c8a had 2 into Night (184 ms) and 1 into Midnight
  (218 ms) and stepped high → mid → low. **R38 is fixed on the phone.** Midnight held still 59.8 fps at mid, 59.5 at
  high. In portrait the lone tree is cut off at the left: a per-stop portrait framing is carried to M8 (R111).
- Gate: unit 354 passed; e2e 24 passed, `horizon.spec` ×2 pre-existing, smoke "name is on screen at once" over its 5 s
  bar on this laptop's Firefox in both this build and e406c8a (environmental, open); `world:test`: all world checks passed.

## Learned
- On a much-used laptop Chrome's shader disk cache hides first-visit hitches: measure first trips with a cold Chrome.
- In three r186 a pre-compile is only reusable if every shared uniform group is keyed as a real draw keys it.
- Python here writes cp1252 unless told `encoding='utf-8'` (a `§` broke the build once).
- A cloud lit "through the crests" with a cosine-squared lobe lights the whole deck whenever the view faces a low moon.

## Open
- Owner: answered at the end (D38); nothing pending.
- R101: one ~200 ms frame into Midnight on a cold first visit, seen in two of three runs, both builds, no pipeline
  involved. Long tasks of 67–169 ms while resting at Night/Midnight 40–50 s after arriving (cold).
- Carry to M8: Midnight's list above; a portrait framing per stop (the lone tree leaves the phone's frame); from before: Night's walls, rim plants, falls; mid at Dusk/Sunrise and the mid
  rides on this laptop; stage-B pop-in; packs fetched every start; `horizon.spec`; the Firefox smoke timing.

Owner page: none this session (the owner reviews in the final session).

## End of session (owner)
- D38: M3, M4, M5, M6 closed below 85 %, leftovers to M8. Sunset and Dusk keep the new cameras; M8 adds more to
  Sunset's view ("it feels empty"), `?cams=old` kept as the reference until then. Kawaii Text Animation dropped.
- `world` pushed at 58ebd78 (owner's word).

## Next (s20)
1. M7, Before dawn (Amendment 1 §4 VII: the stop begins deeper in the cave and drifts toward the mouth; a skylight
   shaft as an option), with its Research phase and `research/owner-sites.md`.
