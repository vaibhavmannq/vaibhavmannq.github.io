# START HERE — the portfolio, every session

Read this file first, then `docs/handover/DECISIONS.md`, then the newest file in `docs/handover/sessions/`.
That is the whole ritual: three files, ten minutes, and you know exactly what to do. Older sessions are history,
not required reading; dig into them only when a decision needs its context.

Last updated: 2026-11-13, end of session s11 (M2.5 built; see `docs/handover/sessions/2026-11-13-s11-m2.5-built.md`). **After the three files of the ritual, also read
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

## 2. Where we are (2026-11-13, after s11)

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
- **Next:** the owner's hands-on test (list on that page; FEEDBACK has been empty since s09), then ask to push;
  offer the final review; trace the flight stutters; then M3. Phone setup that works: serve `vite preview --host
  127.0.0.1 --port 4181`, adb reverse and forward right before each run, wake the screen
  (`adb shell input keyevent KEYCODE_WAKEUP`), `.superpowers/m2/phone.mjs` drives the open `localhost:4181` tab
  (the phone's browser is Brave). Measuring tools: `.superpowers/m2/` (s09) and `.superpowers/m25/*.mjs` (s11:
  `laptop.mjs` holds/flights/census, `flight.mjs [off-parts]`, `joins.mjs`, `phone-cove.mjs`, `t7/slide2.mjs`).
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
