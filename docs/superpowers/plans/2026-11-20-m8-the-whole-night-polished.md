# M8, the whole night polished: Implementation Plan

> **For agentic workers:** the owner chose inline execution (s11–s21): superpowers:executing-plans, task by task.
> Steps use checkbox (`- [ ]`) syntax. M8 is larger than one session: each part closes with a commit and a verdict,
> and the session log says exactly where it stopped.

**Goal:** the whole night, judged together, every place and flight raised toward 85 % (look and behaviour), with:
- no first-trip hitch anywhere, laptop and phone, cold (R38 kept, R121 and R123 fixed);
- Sunset's meadow view filled (D38), then `?cams=old` removed;
- a portrait framing per stop; the flights as shots; fade-ins instead of pop-ins; packs fetched by distance;
- sound (its own short design first), the night cursor and the hairline loader;
- the fallback stills captured from the live site.

**Spec:** `2026-11-10-realtime-world-design.md` M8 row, as amended by `2026-11-11-world-design-amendment-1.md` §7, §8,
§10. **Research phase:** `docs/handover/research/m8-whole-night-references.md` (every carried item with its evidence;
cite its section in each task). Behaviour: `reference-book.md` §1, §2, §11. Owner: `owner-references.md` §1, §14,
§15, §17; `owner-sites.md` M8. Three.js: `threejs-r186-notes.md` (pre-compiling for where a part is really drawn).

**Tech Stack:** TypeScript + three.js 0.186 (`three/webgpu`, `three/tsl`), Vitest, Playwright; adb + CDP for the phone.

## Global Constraints
- D9 speed bar, D13 census caps (Golden is at 14 materials: anything new there shares one), D30 5 MB per place.
- Every new part is built for the mirror and the eye before it shows (R38); after each task that changes a shader or a
  flight, a cold first ride (`QUIET_COLD=1`, cold Chrome restarted between runs, `.superpowers/m6/first-ride.mjs`)
  over the flights it touched.
- Measure before fixing; rebuild and check the build log's last line before any shot; A/B one page at a time
  (`.superpowers/m3/tools/ab-builds.mjs`, `../wt-head`); no laptop measuring while `world:test` runs.
- Checks through `.superpowers/quiet-browser.mjs` only; only the tests a task's gate needs.
- Judge every piece (likes, dislikes, look %, behaviour %), moving things in motion; changed views beside the old and
  against the owner's photos, low beside mid.

## Order (what gains most for the visitor first)

| # | Task | Why here |
|---|---|---|
| 1 | First-trip hitches: R121 (laptop) | A 0.6–1.2 s freeze is the worst thing a first visitor meets. |
| 2 | R123 (phone, first ride into Before dawn), R101 | Same family, the phone is most visitors. |
| 3 | Sunset's meadow view filled; `?cams=old` removed | The owner's one explicit ask (D38); the second stop every visitor sees. |
| 4 | Portrait framing per stop | Phones in portrait lose subjects (Midnight's tree). |
| 5 | Fade-ins for stage B; packs fetched by distance | Pop-in is seen at every first visit. |
| 6 | Flights as shots: I→II, II→III, III→IV, VII→VIII, VIII→IX | The journey is mostly flights. |
| 7 | Look passes, biggest gap first: Night (walls, rim, falls), Midnight (heather, plain, deck), Before dawn (floor, colonnade, deep start), Dusk, First light mist, Golden/Blue hour glare, Sunrise shafts | Each place toward 85. |
| 8 | Night cursor and hairline loader | Small, felt on every visit. |
| 9 | Sound: short design (owner sees it), then build | Largest gain in feel, but its own design first (Amendment §8). |
| 10 | Mid at Dusk/Sunrise on the laptop; `onDeviceLost`; preload links | Speed polish. |
| 11 | Stills captured from the live site (landscape + portrait) | Needs the looks settled. |
| 12 | Gate: unit, `world:report`, `world:test`, e2e (timing tests alone), phone, final review | Close. |

---

### Task 1: R121, the first trip out of Before dawn (laptop)

**Files:** `src/world/slotTexture.ts` (new), `src/world/sky.ts`, `src/assets/skies.ts`, `src/app/boot.ts`,
`src/render/pipeline.ts`, `src/app/bench.ts` (`__whoIs`), tests `slotTexture.test.ts`, `blankSky.test.ts`.
Reference: sheet §1 (R121).

- [ ] Reproduce cold (START=midnight, two rides), name the late pipelines' parts (`__whoIs`), diff their shader text
  against the pre-built ones (`.superpowers/m8/pipediff.mjs`).
- [ ] Sky slots keep their own bindings (`slotTexture`); the placeholder sky samples like a photo (`blankSky`); the
  eye's pre-build no longer culls by the current view.
- [ ] Cold ride Midnight → Before dawn → First light: 0 late pipelines; then a cold ride over the whole night.
- [ ] Unit tests; commit; verdict.

### Task 2: R123 and R101 (phone; laptop resting stall)

- [ ] Phone over USB, both builds (A = b1e50c7 in `../wt-head`): a ride Midnight → Before dawn → First light, all parts
  joined first (`.superpowers/m7/tools/phone-m7.mjs` pattern). If hitches remain, log pipelines on the phone.
- [ ] Laptop: the 167–200 ms frame ~32 s after arriving (cold, no build, no long task): find what starts then (walk
  end, a sky prefetch, the governor) before changing anything.
- [ ] Commit; verdict.

### Task 3: Sunset's meadow view (D38)

Reference: sheet §2 Sunset; `meadow-and-flowers` 1–6, 10; `?cams=old` as the guide.
- [ ] Shots: new view, `?cams=old`, the owner's photos, mid beside low. List what the old view holds that the new lacks.
- [ ] Fill the frame (flower drifts of mixed species near the lens, the grove's edge or rocks as a mid layer, the sea's
  line), sharing existing materials (D13).
- [ ] Remove `?cams=old` (`OLD_CAMS`, `flightPathsOld.json`, the switch's tests); re-bake if flights change.
- [ ] Cold ride Golden → Sunset → Dusk; commit; verdict.

### Task 4: Portrait framing per stop
- [ ] Per stop a portrait pose (or yaw/FOV rule) keeping the subject in frame on a 9:19.5 screen; shots in portrait for
  all nine; phone check. Commit; verdict.

### Task 5: Fade-ins and prefetch
- [ ] Parts joining after the first view fade in over ~0.6 s (opacity or a dissolve in their material), not pop.
- [ ] The headland and cove packs fetched by distance from the opening stop. Commit; verdict.

### Task 6: Flights as shots
- [ ] One flight per step (I→II, II→III, III→IV, VII→VIII, VIII→IX), each with its moment (sheet §3.1), `check_paths`
  green, a strip and a ride judged in motion, a cold ride over it. Commit per flight.

### Task 7: Look passes (one commit per place)
- [ ] Night: wall texture, moss and rim plants, wider falls and ledge, the aurora's top blob, fireflies' size and trails.
- [ ] Midnight: heather in clumps, the far plain, smaller swells, earthshine.
- [ ] Before dawn: stones that read, an irregular colonnade, the deep start, thicker vines.
- [ ] Dusk's foreground and mirror; First light's mist; the glare at Golden and Blue hour; Sunrise's shafts and dew.

### Task 8: The night cursor and the loader
- [ ] Cursor glow with a short trail, night hours, pointer devices only, never over links; hairline loader with real
  progress. Commit; verdict.

### Task 9: Sound
- [ ] A one-page design (files, loops per place, placement, mixing by hour weights and nearness, the toggle) for the
  owner; then the build after the owner's yes.

### Task 10–12
- [ ] Speed polish (mid at Dusk/Sunrise; `onDeviceLost`; preload links), stills from the live site, the gate and a
  final whole-branch review.
