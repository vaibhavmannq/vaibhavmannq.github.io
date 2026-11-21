# START HERE — the portfolio, every session

Read this file first, then `docs/handover/DECISIONS.md`, then the newest file in `docs/handover/sessions/`.
That is the whole ritual: three files, ten minutes, and you know exactly what to do. Older sessions are history,
not required reading; dig into them only when a decision needs its context.

Last updated: 2026-11-21, session s25 (see `docs/handover/sessions/2026-11-21-s25-m8.5-round1-batch2.md`). **After the three files of the ritual, also read
`docs/superpowers/specs/2026-11-11-world-design-amendment-1.md` and `docs/handover/research/README.md`.**
The owner switches accounts and models between sessions: always start fresh from these files, never resume.

## 1. What this is

Vaibhav's first personal portfolio, live at https://vaibhavmannq.github.io/ (repo `vaibhavmannq/vaibhavmannq.github.io`,
local `V:\Pdf\Project\my-portfolio`). The current live site ("Moonsink Shore", a moonlit sea, four pages, one moon) is
documented in `docs/HANDOVER.md` and `docs/superpowers/specs/`. It stays online at `/moonlit/` when the new site ships.

The new site: **a night's walk through one original coastal world, rendered live in the browser.** The visitor arrives in a
cove at Golden hour; scrolling flies the camera along the coast and inland through nine places while the light turns
(Golden hour → Sunset → Dusk → Blue hour → Night → Deep midnight → Before dawn → First light → Sunrise). Each place is a
camera stop with the section's text. Things in the scene respond to hover and open on click (the projects live on
floating lanterns at the Night lagoon). Inspired by Wuthering Waves' night moods; everything is original, no game assets,
no borrowed set pieces (no towers, piano, etc.).

## 2. Where we are (2026-11-19, after s20)

- **Look: approved.** All nine hours exist as full-quality Blender renders (1920×1080, hybrid style), judged hour by hour
  and called "amazing". They are the **art direction** for each stop, not site pixels.
  Files: `.superpowers/brainstorm/lookdev/real/out3/out3/<hour>_hybrid_vivid.jpg`. Canvas: https://claude.ai/artifact/MDWVPSyo5eQF3p7rzMBsdY
- **World: decided.** Terrain formula + placements in `.superpowers/brainstorm/lookdev/real/coast.py`; the JS port
  (`.superpowers/spike/golden-cove/src/world.js`) matches it to 0.05 mm.
- **Direction: real-time 3D** (D7), production recipe D8.
- **Golden cove vertical slice, round 2 (s02).** `.superpowers/spike/golden-cove/` (throwaway, not in git).
  ≈3.0 MB per visit (was 12.1); first view 2.6 s at 10 Mbit/s; low/mid 60 fps through the flight on this laptop;
  3D trees, grass parting, pebbles, Sunset sky fixed, phone fixes, two-sky/one-sky switch.
  Verdicts: Golden ≈82%, Sunset ≈80%, whole stop ≈70%. Offline report: `.superpowers/spike/golden-cove/report/golden-cove-slice.html`.
- **Decided in s02:** D9 speed bar (name < 1 s, first view < 3 s on 10 Mbit/s, stop < 5 s, 60 fps on the default
  setting, ≈3 MB per stop); D10 two skies. Phone round 2: 52–60 fps on low, 54–60 at stops on high (WebGL2).
- **Parked:** grass parting feels weird on touch (owner); fade rocks/trees in instead of popping; phone default too low.
- **s03: design drafted** (owner skipped questions: "do it, then show me"; all nine scenes before any text):
  `docs/superpowers/specs/2026-11-10-realtime-world-design.md` (committed on `world`). Owner's view of it:
  `.superpowers/design/realtime-world-design.html` (offline). Found: the route is 5.8 km (four flights of 1-1.7 km)
  and the ground formula shows box edges from the air, so the build order is M0 rough whole night, M1 world pass,
  M2 the four unknowns (aurora, cloud sea, falls, cave), then places M3-M7, polish M8, text M9, launch M10.
- **Owner approved the design** ("everything looks good on paper, let's go"): D11–D14 recorded.
- **M0 done** (cdf951d; owner's phone test 2026-11-11: "running smoothly"). What made the phone smooth: s05 log.
- **M1, the world pass: done** on `world` (HEAD efe88a5, not pushed). Land outside the camera views is reshaped
  (wandering edges, ridges, gullies), trees and scrub along the flights, the last flight flies sideways, distance fades
  into the sky's horizon colour. Phone over USB: 59+ fps on every tier; owner's hands-on test: "feels good"; D16–D18
  recorded; fresh whole-branch review done, its four important findings fixed. Details, numbers, my % per flight:
  `docs/handover/sessions/2026-11-11-s06-m1-world-pass.md`. Every ruling and deferred minor:
  `docs/handover/ledgers/2026-11-11-m1-the-world-pass.md` (M0's is beside it).
- **M2, the four unknowns: started in s07, stopped part-way on the owner's word.** Plan:
  `docs/superpowers/plans/2026-11-11-m2-the-four-unknowns.md`; ledger (every ruling, every %):
  `docs/handover/ledgers/2026-11-11-m2-the-four-unknowns.md`; log: `docs/handover/sessions/2026-11-11-s07-m2-started.md`.
  - **Task 0, Research phase (D20, owner): first pass only.** The reference sheet is still owed.
  - Tasks 1–4 done and committed on `world` (5 commits, **not pushed**): the numbers in `shots.json`, `npm run compare`,
    the Blender export (`npm run world:blender`), the **aurora** (my 86–88 %), the **sea of cloud** (my 78 %).
  - Task 5, the **waterfall**: code written, tests green, committed as wip (147a61d), **never seen running**.
  - Task 6 (cave) and Task 7 (cost per part, phone over USB, verdicts, owner's page) not started.
  - Nothing has been measured for speed, on the laptop or the phone. The owner has seen nothing yet.
- **s08 was research only (no code):** `docs/handover/research/` now holds three.js r186 notes with exact API
  patterns, the M2 reference sheet (draft, with a watch list for the owner) and notes for M3–M10. **Read
  `docs/handover/research/README.md` before planning or building.** Log: `sessions/2026-11-11-s08-research.md`.
- **The owner gave full creative freedom in s08, cameras and design included (D22), accepted every idea in
  `research/inspiration-and-ideas.md`, and said yes to sound (D23).** My critique of the nine places and what I
  would change is `research/design-review-and-proposals.md`: Night redesigned, the stacks re-scattered, new
  cameras at II, III and VII, flights as shots. None of it is built or shown yet, and the spec is not amended.
- **Also from the owner in s08:** land from real reference, not imagination (D24); the world interactive "like we
  are in open world" (D25); a smooth, unhurried journey (D26). **All of D21–D26 is gathered in
  `docs/superpowers/specs/2026-11-11-world-design-amendment-1.md` (draft; it wins over the spec where they
  differ).** It holds Night's redesign brief (§5), look-around and spots (§6), the new pace (§7), and the
  changed build order (§10: a new M2.5, "the world from reference").
- **D24 covers everything, look and behaviour:** `docs/handover/research/reference-book.md` is the standing
  reference (an entry per element, real numbers, what gives a fake away). Cite it in every plan task.
- **Amendment 1 is approved (D27):** the owner accepted every recommendation; free roaming waits until after M8;
  the fallback stills come from the live site (no Blender round). Content answers: `research/owner-checklist.md`.
- **The owner added 128 reference photos and clips** to `.superpowers/refs/` (local, not in git). I viewed all of
  them; `research/owner-references.md` says what each element should take from them (D28). His motion video
  means: pointer parallax first, and something always moving.
- **s09 (2026-11-13): M2 continued, on `world`, pushed (15e5c8a).** The waterfall seen and fixed (78 % look);
  the new pace built (41 screens, camera top speed, a **Next** ride button and keys); pointer parallax built (works,
  but invisible until stops get near layers); aurora and cloud re-judged against the owner's photos (both 68 %);
  **the cave built** (Task 6, 74 % vs render); **costs measured on the laptop** and the cave/aurora/cloud made
  cheaper (Before dawn 60 fps at mid; flight at mid 59 fps, 0 frames over 50 ms; Midnight at mid still 47 fps, a
  scene cost for M6). Every number: the M2 ledger, "Session s09". **Phone measured at the end (WebGPU and WebGL2): 60 fps at every M2 stop and through the whole night on all tiers, 0 frames over 50 ms. M2 closed on my side; all four approaches kept.**
- **M2.5 plan written** (`docs/superpowers/plans/2026-11-13-m2.5-the-world-from-reference.md`); the owner chose
  subagent-driven execution. **s10 (2026-11-13): Tasks 1–3 done on `world`, not pushed** (ledger:
  `docs/handover/ledgers/2026-11-13-m2.5-the-world-from-reference.md`; working copy with briefs and reports in
  `.superpowers/sdd/2026-11-13-m2.5-the-world-from-reference/`):
  - Task 1: `npm run compare` shows the owner's photos as a third column (`.superpowers/refs/compare.json`).
    Before set for M2.5: `.superpowers/m25/before/`.
  - Task 2: one world state per hour (sun/moon height, moon phase, wind from the sea, Beaufort force); spray,
    cloud drift (0.4 × wind), sea chop and aurora dimming read it. Behaviour 80 %, look unchanged on purpose.
  - Task 3: **found that the live site has no stacks and no arch** (Blender only). The headland line is now pure,
    tested data in coast.py (falls seaward, uneven gaps, split pair, stumps, reef, shelves, fallen blocks, a
    remnant landward of the arch). Layout 58 % vs the owner's `cove-and-stacks` 12; still flat-topped posts.
  - **D29:** stacks and arch come in as Blender meshes; **Task 3c** added to the plan (spires, wedges, flared feet).
- **s11 (2026-11-13): M2.5 Tasks 3b–9 built on `world` (8ae305a..91d9b1d), not pushed.** 3b/3c subagent-driven,
  4–9 inline (owner: save tokens). The live world now has the lopsided arch and the headland stacks (Blender meshes in
  a place pack `public/world/stops/headland/`), tide bands, tinted shadow floors, night haze, glitter roads, a real
  crescent moon (the s07 bug was GPU `cos` precision), look-around (drag), Golden's paper lantern (parallax slide
  measured **3.0 %** of the width) and two spots to walk to. **D30: 5 MB per place.** Phone over USB: 60 fps
  everywhere, 0 frames over 50 ms. Open: laptop flights stutter with the rock in view (1–9 frames > 50 ms), the
  lantern still reads as a box, the final whole-branch review was not run (R33). Owner's page:
  https://claude.ai/artifact/9JhoxnNjFJcFhm8Ukape4A
- **s12 (2026-11-16): M2.5 final review done, one TDD fix pass (9a174b4, 7497f48), not pushed.** The headland pack
  no longer holds back (or breaks) the ground and sea; a sideways swipe mid-flight no longer strands the visitor;
  **the Blender stills are off over the live world by default** (R34, `?stills=on`); rock moss per vertex. The laptop
  flight stutter traced: GPU headroom on mid at 1080p in Dusk→Blue hour and Night→Midnight (15–21 ms/frame without
  the rock; rock adds 2–7 ms near Blue hour; A/B 7 vs 5.5 stutters/flight) → scene cost for M4/M6, not fixed.
- **s12, after the push:** a visitor's night on this laptop measured (governor settles on **low**; every flight
  0 slow frames except two first-trip freezes into Night and Midnight); Next-while-arriving fixed; the freezes cut
  from 0.73/0.82 s to 0.48/0.70 s (one-pass aurora/cloud, stage B builds for the scene pass); the mirror's first
  build of those two is still open (R38). Blender exports byte-stable (cave.bin triangle order). All pushed
  (…d5afa9e). **Phone, a visitor's night:** starts at high, settles on mid at Night, every flight 59–60 fps, the same
  two first-trip hitches only 0.17 s and 0.20 s (`.superpowers/m25/phone-visitor.mjs`).
- **s13 (2026-11-16): M3 started, inline, on `world`, not pushed (2f3d80a, acd7442).**
  - Research phase: `research/m3-cove-references.md`.
  - Plan: `docs/superpowers/plans/2026-11-16-m3-the-cove.md` (Tasks 0–8).
  - Ledger: `docs/handover/ledgers/2026-11-16-m3-the-cove.md`.
  - **Done:** Task 0 (research), Task 1 (37 k grass and flower plants made in the browser, each stop draws its own)
    and Task 4 (new cameras: Sunset down in the meadow, Dusk high looking down; D31, R42).
  - Low: 60 fps at the five cove stops. Mid: Sunset 55, Sunrise 53, Dusk 45 (the plants 1–3 ms; Dusk's mirror
    alone over budget looking down).
  - Phone not measured.
  - My looks: plants 68 %, Sunset 62 %, Dusk 35 %. **No cove place near 85 % yet:** the slab, the trees and the
    lanterns decide them.
- **s14 (2026-11-16): M3 Tasks 2 and 5 done, inline, on `world`, not pushed (482ccce, eb1154b).**
  - **Task 2:** a cove place pack `public/world/stops/cove/` (0.75 MB): the 24 cliff columns at Golden and Sunrise
    and the grove (43 Poly Haven trees and shrubs as wood plus leaf cards with bent normals), exported by
    `npm run world:blender` (now also runs Golden hour). The grove is pure data in coast.py (`grove_plants`).
  - **Task 5:** Dusk's 44 lanterns (strings, lit one by one on arrival, drifting, with streaks), one paper look for
    every lantern, and the lantern thread (claim at Golden → Dusk → First light's shallows; sessionStorage).
  - **D32:** things on land follow the live 8 m height grid, which lies 2–5 m under coast.py's formula along the rims.
  - My looks: Golden 64 %, Sunset 68 %, Dusk 58 %, First light 55 %, Sunrise 70 %. **Still no place at 85 %.**
  - Low: 56–60 fps at the cove stops on the warm laptop; cliffs and grove cost 2–5 ms of GPU. Mid is over budget at
    Dusk and Sunrise with or without them. **Phone not measured** in s13 or s14.
  - `horizon.spec.ts` (e2e) fails on clean HEAD too: pre-existing, open.
- **s15 (2026-11-16): M3 Tasks 3, 6, 7 done, inline, on `world`, not pushed (fddc8d3, fbd9e92, 07c5bfe).**
  - **Task 3:** First light's mist as a layer in the scene's one fog (`mist.ts`, no draw; the built-in height fog
    was tried and dropped, R53); the surf foam follows the wind force everywhere (R54).
  - **Task 6:** the life layer (`life.ts`, one sprite draw): gulls, bats, the Sunrise flock, petals, dew, and a fish
    ring on First light's mirror.
  - **Task 7:** one walk at Sunset, Dusk, First light (to the visitor's lantern) and Sunrise; glints and twins only
    at their own stop.
  - My looks: Golden 66 %, Sunset 68 %, Dusk 60 %, First light 66 %, Sunrise 72 %. **Still none at 85 %.**
  - Low 54–60 fps at the cove stops; mist and life cost nothing measurable; Golden at 14 materials (the cap).
  - Phone: cove stops 59–60 fps at mid and high; the first flight into Dusk hitches (3 frames, worst 117 ms;
    present in the s14 build too). Task 8 open: final review, owner page.
- **s16 (2026-11-18/19): M3 hitch fixed, look pass, final review, M3 finished; inline, on `world`, pushed (98d9b58..).**
  - The first flight into Dusk no longer builds shaders mid-flight (near parts compiled before the scene existed;
    Dusk's lanterns left the mirror, R65). Phone: 0 slow frames into Dusk, but measured on a build missing the grove.
  - Look: lanterns with a crown and a lit inside; light pools under Dusk's lanterns (their streaks had never shown:
    `positionLocal` vs `positionGeometry` in r186); bats' own outline; dome flower heads; Sunrise's walk ends on the
    arch; **Sunset's subject is one lone tree** (coast.py `LONE_TREE`, cove pack re-exported).
  - `world:report` now fails when the manifest is stale (the re-exported grove was refused at load).
  - Final review of M3 done: three important bugs, all fixed this session; two minors open (ledger).
  - Day 1 looks: Golden 70 %, Sunset 76 %, Dusk 70 %, First light 69 %, Sunrise 75 %.
  - **Day 2 (2026-11-19), M3 finished on my side (611323e, 1737fff):** `?cams=old` built; a backlit glow on the
    meadow's ground (Sunset); pebbles at Golden and First light; Golden's lantern out of the sun's road; a bolder First
    light mist. Phone (final s16 build): high all night, 0 slow frames into Dusk; cove stops 59.5–59.7. Gate green
    (`world:test` passed; e2e 23 passed, `horizon.spec` ×2 pre-existing).
  - **Final looks: Golden 76 %, Sunset 80 %, Dusk 74 %, First light 74 %, Sunrise 76 %.** None at 85 %; my
    recommendation: close M3 and carry the rest into M8 (list in the s16 log). Owner page with two questions (close
    M3? old or new cameras?): https://claude.ai/artifact/PrcvXudVZYCPSbpSAmFfU4
- **s17 (2026-11-19): M4, Blue hour, built on my side; inline, on `world`, not pushed (f950f6b..).**
  - Research sheet `research/m4-blue-hour-references.md`; plan `docs/superpowers/plans/2026-11-19-m4-blue-hour.md`;
    ledger `docs/handover/ledgers/2026-11-19-m4-blue-hour.md` (R76–R83); D35.
  - Built: plankton that lights only where water moves (rock waterlines, rare sparks, a trail under the pointer or a
    finger, the feet on a new wade spot); stars by magnitude against the sky's brightness (every night hour); scrub
    caps on the arch and stacks (the grove's shrub, placed in the browser); Blue hour's wind 0 → 0.5 and sand ribs;
    the flight to Night leaves under the arch's span with the gaze lifting.
  - **My looks: Blue hour 82 % at mid, 78 % at low** (before ~66 %). Not 85 (glare, boxy fallen blocks, low's
    mirror); I recommend closing M4 and carrying those into M8.
  - Speed: census inside D13; laptop low +1 ms at Blue hour, cove stops unchanged; nothing new to download.
  - Owner page with the asks (close M4; still M3's two answers, which arrived blank this session):
    https://claude.ai/artifact/R4rHJqRkc1hik7h7CsmRd9
- **s18 (2026-11-19): M5, Night, built on my side; inline, on `world`, not pushed (5e25461..).**
  - Research sheet `research/m5-night-references.md`; plan `docs/superpowers/plans/2026-11-19-m5-night.md`;
    ledger `docs/handover/ledgers/2026-11-19-m5-night.md` (R84–R98); D36.
  - Built: a bowl of ~1 900 basalt prisms made in the browser (`bowl.ts`), the crater's west rim lowered in coast.py
    (base re-baked) so the sky opens; a new camera 1 m over the lagoon; the moon as a crescent; the falls in two tiers
    of ribbons; Night's aurora as a corona (`corona.ts`) doubled in the lagoon, its green on the rock; fireflies that
    gather at the pointer and glowing reeds (`nightlife.ts`); one lantern per project plus the visitor's, hover lifts,
    click opens a card, keyboard twins (`projectLanterns.ts`, `overlay/projectCard.ts`); Night → Midnight up the falls.
  - **My looks: Night 72 % at mid, 70 % at low** (before 55 %), behaviour 78 %. Not 85 (even wall texture, bare rim,
    slim falls); I recommend closing M5 and carrying the rest into M8.
  - Speed: census inside D13 (Night 40 draws, 13 materials); low at Night +3.3 ms GPU, 59–60 fps; first ride into
    Night at low 0 slow frames (R38 measured, still M6's). Phone: Night 59.7 fps held still at mid and high; first-trip hitches into Night and
    Midnight as before (2 frames, worst 151 and 184 ms).
  - Owner page (close M5? phone): https://claude.ai/artifact/AQ9kvXB889kr9XvWbxerrs
  - Check scripts now run in one off-screen Chrome (`.superpowers/quiet-browser.mjs`; owner: no windows popping up).
- **s19 (2026-11-19): M6, Deep midnight, built on my side, and R38 fixed; inline, on `world`, not pushed (71a8e7d..).**
  - Research sheet `research/m6-midnight-references.md`; plan `docs/superpowers/plans/2026-11-19-m6-deep-midnight.md`;
    ledger `docs/handover/ledgers/2026-11-19-m6-deep-midnight.md` (R100–R110); D37.
  - **R38 fixed:** every part is built for the sea's mirror before it shows; three r186 had shared one camera uniform
    group between pre-built shaders (s12's upside-down view), now keyed per render context (`keyBuildsByOwnContext`).
    Laptop, first visit with no shader cache: into Night and Midnight 0 slow frames (old 500–1083 ms).
  - Midnight built: a designed ridge top of heather and grass (`ridge.ts`), the lone tree (cove pack), four ranges
    fading with distance (`peaks.ts`), the moon's road on the deck, smaller lumps, a late-night aurora (soft foot,
    pulsating patches); moonlit colours grey (Purkinje) at Night and Midnight.
  - **My looks: Midnight 74 % at mid, 72 % at low** (before 45 %), behaviour 72 %. Not 85 (heather as carpet, the deck's
    swells, the far plain, no earthshine); I recommend closing M6 and carrying the rest into M8.
  - Speed: census inside D13 (Midnight 38 draws, 10 materials); laptop low unchanged, mid cheaper. **Phone: R38 fixed (0 slow
    frames on every flight, tier high all night; old build 184/218 ms), Midnight 59.5–59.8 fps.** Firefox's smoke page-load bar (5 s) fails on this laptop in old and new builds.
  - The owner's six UI and motion sites (all milestones): `research/owner-sites.md`. (Kawaii Text Animation: dropped by the owner.)
- **Owner, end of s19 (D38): M3–M6 closed below 85 %, everything carried to M8; Sunset and Dusk keep the new cameras.
  M8 must fill Sunset's meadow view ("it feels empty"; the owner liked the old view): `?cams=old` stays as the
  reference until then.** No owner answers are pending.
- **s20 (2026-11-19): M7, Before dawn, built on my side; inline, on `world`, not pushed (a722889..).**
  - Research sheet `research/m7-before-dawn-references.md`; plan `docs/superpowers/plans/2026-11-19-m7-before-dawn.md`;
    ledger `docs/handover/ledgers/2026-11-19-m7-before-dawn.md` (R112–R122); D39.
  - Built: a passage of columns behind the chamber, made in the browser (`passage.ts`); the stop starts 14 m deep and
    walks to the old camera in 30 s or with the scroll (`walk.ts`; `?walk=0..1` holds it); the flight in backs in
    through the mouth facing the sea; the cave lit by the mouth's form factor (`caveLight.ts`) with Fingal's colonnade;
    one still pool mirroring the mouth, with drips; stones and stumps (`caveFloor.ts`); fungi in clusters that answer
    the pointer; leaf-shaped vines and moss (`vines.ts`); a faint skylight shaft, on by default (`?skylight=off`).
  - **My looks: Before dawn 72 % at mid, 70 % at low** (before 58 %), behaviour 74 %. Not 85 (stones barely read, a
    regular colonnade, a very dark deep start, thin vines); I recommend closing M7 and carrying the rest into M8.
  - Speed: census inside D13 (36 draws, 9 materials); laptop low +3–4 ms GPU at the stop, 60 fps; no new download.
    Cold first ride into Before dawn 0 slow frames; **out of it toward First light both builds freeze ~600 ms once
    (R121, open, older than M7)**. Phone: Before dawn 59.7 fps held still at mid and high; a ride into it hitches in
    both builds (worst 285 ms new, 368 old: R123, open).
- **Owner, end of s20 (D40): M7 closed below 85 %, leftovers to M8.** `world` pushed after the gate.
- **s21 (2026-11-20): M8 started, inline, on `world`, not pushed (625bfe3..).** Research sheet
  `research/m8-whole-night-references.md`; plan `docs/superpowers/plans/2026-11-20-m8-the-whole-night-polished.md`
  (12 tasks); ledger `docs/handover/ledgers/2026-11-20-m8-the-whole-night.md` (R124–R135); D41.
  - **R121 and R123 fixed (one cause):** the sky's hour slots get a binding each (`slotTexture`), the placeholder sky
    samples like a photo (`blankSky`), the eye's pre-build no longer culls. Cold whole night: 0 late pipelines.
  - **Sunset filled (D38):** a framing tree 8 m left, grass at the lens, drifts up the slope; `?cams=old` removed.
    Sunset 83 % mid / 82 % low.
  - A portrait framing per stop (`portraitYaw`); the first view waits behind the poster and a hairline loader for the
    opening stop's parts (cap 3 s past stage A); the cove pack is fetched with the base; the night cursor.
  - Phone: Sunset 59.6 fps at mid and high (old 59.4/59.7), every portrait subject in frame on the phone's screen.
  - Flights as shots (Task 6 done): Dusk → Blue hour skims among the lanterns toward the arch (84 %); Sunset → Dusk
    and Golden → Sunset fly sideways with the sea in view (80 %); out of the cave with a level gaze (72 %).
  - Look pass (Task 7) begun: Night 76 % (trees on the rim, varied walls; at 14 materials, the cap); Midnight 77 %
    (the pale slab was a bare patch at the feet; a flatter, lumpier cloud deck); Before dawn 75 % (stones that read,
    an irregular colonnade).
  - Open: R138 (a 216–366 ms frame ~1/3 into Dusk → Blue hour on cold rides, old path too, measured under low memory),
    R127 (a ~200 ms frame ~30 s after arriving at a stop, resting), R122, R101.
  - **This laptop has 7.7 GB; with the owner's apps open only ~1–2 GB is free. One test browser at a time, stopped
    after each run** (owner, s21: the test browsers were hogging RAM). `quiet-browser.mjs` now shuts its Chrome down
    when a check ends or crashes.
- **Owner, end of s21 (D42): the first view keeps waiting until the opening place is whole.** `world` pushed.
- **s22 (2026-11-20): M8 look passes and sound.** Run as a background job, which may not edit the main checkout: the work
  was done in worktrees (`s22`, then `s22-sound`) and fast-forwarded into `world`; the look passes are pushed (4cfdab0).
  - Task 7 closed: Dusk 78 % (mirror read smooth, the sky lights the land after sunset, grass at the lens), Golden 79 %
    (bloom capped at 3), Blue hour 83 %, Sunrise 78 % (side-lit blades, dew), Night 78 % (falls as wide as their
    layout), First light 78 % (a far mist bank); Sunset's slope probed, kept (needs content, not light). D43, R148–R155.
  - **Task 9, sound: built and approved (D44).** Eight CC0 loops (Freesound), `src/sound/`, the Sound button top right;
    picks and candidates on `.superpowers/sound-listen/` (local).
  - Task 10 in part: a lost GPU hands the view to the stills; the manifest preloaded.
  - Phone: Dusk, Night, First light, Sunrise 59.6–59.7 fps at mid and high (old 59.4–59.8). Not measured: R138, R127
    (laptop 0.9–2.2 GB free all day). 0 pipelines on every cold
    flight (R38 holds).
  - **Closing round: M8 done on my side.** Sound on the phone 59.5–59.6 fps on every flight; R127/R138 closed (not ours);
    Task 10 (Golden 60 fps at mid here), Task 11 (stills captured live, landscape + portrait), Task 12 (gate, review:
    no important findings). D45, R157–R159. None of the nine places at 85 % (Sunset and Blue hour 83).
- **Owner, end of s22 (D46): M8 closed below 85 %; M8.5 next, before the text.** M8.5 is driven by the owner's own
  hands-on testing (likes, dislikes, reviews), rounds until nothing he minds; the M8 carry list is its starting backlog.
  Plan: `docs/superpowers/plans/2026-11-20-m8.5-owner-hands-on.md`.
- **s23 (2026-11-21): M8.5 Task 0 done** (log `sessions/2026-11-21-s23-m8.5-start.md`, ledger
  `ledgers/2026-11-21-m8.5-owner-hands-on.md`). The owner tests at `http://localhost:4181` (laptop Chrome; phone Brave
  over USB + `adb reverse`); his guide: `docs/handover/m8.5-how-to-test.md`; starter `.superpowers/m85/start-test-build.cmd`.
  The `?hud` panel moved below the Sound button (R160).
  - **Round 1 in (owner, 22 screenshots): 17 items triaged in the ledger; 0 accepted yet.** #1 (waves) built twice; the
    second try (c024828: moving ring mesh, lace foam, spray) is **rejected (D47)**: foam like cracked tiles, the water
    "divided" along every flat shore, Blue hour's flares in rows; "the original water looked better". It is still in
    the code on `world` (not pushed). #2 measured and planned. Chrome's Modern Web Guidance installed as a plugin.
- **s24 (2026-11-21): M8.5 Round 1 batch 1 accepted, the GPU's limit, ultra, the governor** (log
  `sessions/2026-11-21-s24-m8.5-round1-batch1-gpu.md`; ledger R165–R177; D48, D49; not pushed).
  - Original water back; waves later behind `?sea=new` (D48). Owner accepted #6, #7, #11, #16, the card and scrollbar.
  - #17 part 1: limits measured (laptop holds 60 up to low ×~0.6; the phone up to ×1.25 everywhere but Night); a fourth
    tier **ultra** (×1.15); the idle mode no longer drops readers to low; the governor steps up only in flight, any
    time (D49). Phone: ultra all night, 59–60 fps.
  - #17d (the upscaler) is a WIP commit, off, never seen running. Check scripts this session: `.superpowers/m85/`
    (`world-sheet.mjs`, `gpu-sweep.mjs`, `phone-night-cdp.mjs`, `flight-ab.mjs`, `card-check.mjs`).
- **s25 (2026-11-21): M8.5 Round 1 batch 2** (log `sessions/2026-11-21-s25-m8.5-round1-batch2.md`; ledger R178–R184; not pushed).
  - #17d the upscaler behind `?up=1`: works, barely visible, costs 1–2 ms at low; my call: keep it off.
  - #3b the light turns through the whole flight; no false sun, moon or aurora while one light hands over to another.
  - #2: columns on Golden's right bank, shrubs on Dusk's slopes (`src/world/crags.ts`, per stop); Sunrise's left is #13.
  - Owner: stacks' scrub caps removed. Research for #9 and #13 in `docs/handover/research/m85-*.md`; the owner's photos
    and the yardstick in `research/m85-owner-photos-s25.md`. Batch-end checks: `world-sheet.mjs`, `netcheck.mjs`, `census.mjs`.
  - Batch 2 accepted and pushed (D50). #4 Sunset's poppies and #5 Dusk's silhouetted stacks and flowers built (batch 3).
  - Batch 3 after the owner's test: Sunset's poppies in dense drifts, Dusk's flowers cut back (R188); phone 59.5–59.8 fps
    at every cove stop on ultra (R189). All pushed (a1bab1a). #13 Task 0 done: `tools/world/shore_map.py` (R190).
- **Next (s26): #13 Tasks 1–5** per `research/m85-shore-outline.md` (coast.py outlines with Python tests first; Blender
  export; bake chain; D47 sheet; `shore_map.py --before .superpowers/m85/shore/before.npz`). Then #9 (build both falls,
  pick one: D50), #10, #8,
  #12, #14, #3a, waves (D47 rules; batches of 3–5).
  - Still open from before: mid at Dusk/Sunrise and the mid rides on this laptop; the headland pack fetched at every
    start; `horizon.spec.ts` (pre-existing); the Firefox smoke timing.
  - First visits: measure with `QUIET_COLD=1` (`.superpowers/quiet-browser.mjs`; a second Chrome with no shader disk
    cache; restart it between runs) and `.superpowers/m6/first-ride.mjs` (START, FIRST, WAIT env; knows I–IX).
  - Phone setup that works: serve `vite preview --host 127.0.0.1 --port 4181`, run adb reverse and forward right
    before each run, wake the screen (`adb shell input keyevent KEYCODE_WAKEUP`); Brave must be in front; the scripts
    drive the open `localhost:4181` tab.
  - After a Blender re-export or a coast.py edit: `python tools/world/export_hours.py`, `bake_base.py`,
    `node tools/world/bake_flights.ts`, `bake_dressing.py`, `node tools/world/manifest.ts`, then `npm run world:report`.
  - Measuring tools: `.superpowers/m25/*.mjs`, `.superpowers/m3/tools/`, `.superpowers/m4/tools/`, `.superpowers/m5/`,
    `.superpowers/m6/` (`first-ride.mjs`, `shot.mjs`, `strip.mjs`), `.superpowers/m7/tools/` (`flight-strip.mjs`,
    `cavebin.mjs`).
- **How to measure:** phone over USB (D18; memory "Phone over USB"); GPU timer queries, Chrome traces, interleaved A/B
  runs on the laptop (s05 log). World checks: `npm run world:test` (~12 min here, run in the background);
  look check: `npm run aerials -- <url> <outDir> [<beforeDir>]`.
- **The world's source of truth since M1 is `tools/world/blender/coast.py` + `keep.npz` in the repo.** The D6 render
  round must use that copy, not the older one under `.superpowers/brainstorm/lookdev/real/`.
- **Artifacts:** the owner is back on the artifacts account (s04); publish pages as artifacts again.

## 3. How we work (rules the owner set; break none)

1. **Show options running, never as screenshots.** Look-and-feel choices go in front of the owner on a real build served
   to their phone, behind a switch. They judge by feel and in motion.
2. **Honest verdicts, and the owner tests only what I call ready (D15).** Judge every piece yourself (likes, dislikes, a %),
   iterate until satisfied before asking for a phone test, say what is weak before they find it, push back
   with evidence when they are wrong. They welcome blunt notes and give them.
3. **These handover notes and the plans live in the repo** (`HANDOVER.md`, `docs/handover/`, `docs/superpowers/`),
   committed and pushed with the work (owner, s06; replaces s03's "local only"). The repo is public: no secrets, emails
   or device ids in them.
4. **Never push without asking.** Commits only when asked. No AI attribution in commits or their messages: no
   `Co-Authored-By`, no "Generated with", no session links (owner, s06: docs may mention tools; commits never).
5. **Clarity before building:** architecture, high/low-level design, device tiers, budgets, deploy, approved, before code.
6. **Measure before fixing.** Numbers, not guesses. This laptop has a real GPU (Intel UHD, headed Playwright Chrome gets
   WebGPU); only headless browsers render in software.
7. **Fast and cheap checks first.** Before any expensive step (a render, a build), use the cheap tools
   (`lookdev/real/tools/raymap.py`, `skypeek.py`, `probe.py`; the site's HUD) to find the problem.
8. **Keep the speed bar:** name on screen < 1 s, first scene < 3 s, 60 fps on this laptop at a reduced tier, no blank
   loading screen. (Aditya's reference site: 12–30 s blank loader, 14 MB, 30 fps at its lowest tier here.)
9. **The owner is learning.** Every change gets a plain-language walkthrough. Short, direct sentences.

## 4. The production recipe (agreed 2026-11-10, enforced by tools, see D8)

Vertical slice → written design → plan → build per stop. Budgets per tier checked in CI (size-limit + a perf check).
An asset pipeline script (Blender → meshopt meshes, KTX2 textures, baked light/AO, shrunk HDRIs). Loading in stages, cove
first. Quality measured while the first stop is visible. **The renders are the safety net:** a stop that can't hit budget
on a tier shows its render with light overlays instead of the live scene.

## 5. Where everything lives

| What | Where |
|---|---|
| Session logs (one per session) | `docs/handover/sessions/` |
| Reference research (links, what to take from each; D20) | `docs/handover/research/` |
| Decisions, numbered, append-only | `docs/handover/DECISIONS.md` |
| Scene work detail (Blender, renders, tools, per-hour notes) | `.superpowers/brainstorm/videos/HANDOVER.md` (+ dated logs beside it; NOT in git) |
| Blender scene script and tools | `.superpowers/brainstorm/lookdev/real/` (`coast.py`, `tools/`, `make_pack.py`) |
| Full renders (friend's RTX 5060) | `.superpowers/brainstorm/lookdev/real/out3/out3/` |
| Reference: Aditya's site (what the owner wants the feel of) | https://github.com/Addy3126/Portfolio-React, notes in `.superpowers/brainstorm/videos/reports/sites.md` |
| Canvas of all verdicts | https://claude.ai/artifact/MDWVPSyo5eQF3p7rzMBsdY |
| Old live site docs | `docs/HANDOVER.md`, `docs/superpowers/specs/` |
| Render pack for the friend's GPU | `.superpowers/brainstorm/lookdev/renderpack_batch3.zip` (+ `_patch.zip`, unsent; see D6) |

## 6. Closing a session (do this before context runs out, or when the owner says stop)

1. Write `docs/handover/sessions/YYYY-MM-DD-sNN-<topic>.md`: done, learned, decisions made (also add them to DECISIONS.md),
   open questions, the exact next step.
2. Rewrite section 2 of this file (and anything else that changed). Keep it two pages.
3. Tell the owner in one line where things stand. Ask before committing.
