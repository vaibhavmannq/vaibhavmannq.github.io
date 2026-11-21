# The night's walk at 100 % — design (s27, approved by the owner)

Owner's approval: s27, on the audit page https://claude.ai/artifact/MQGMVoiaMGHxiXTuZ7Q2Dz ("1. YES 2. YES 3. LANTERN IT IS
4. … focus on the journey itself — the camera jerks and speed, smoothness and the view along the way"). Decision D53.
This replaces what was left of M8.5 Round 1 (#3a and #1 sit inside it). Amendment 1, the spec and D1–D52 still hold
where this does not change them.

## 1. Intent

"I want all scenes at 100 %, whether we move up, down, left or right; nothing should look odd or empty. The journey
should look perfect." The owner will not list what bothers him: finding it is my job. The bar is D51 (Apple-level care,
judged by people in motion). Professionals' techniques are wanted: loading screens, narrow passages, and whatever else
the field has learned. Be creative.

## 2. Goals, non-goals, anti-goals

**Goals**
- Every place at 100 % in all five views (fully left, straight, fully right, up, down), on low and on high, judged
  against the owner's photos (`research/owner-references.md`) and the renders.
- **The journey** (owner's #4): no camera jerks, smooth speed, no dead stretches. Every moment of every ride shows
  something worth seeing, and each destination's reveal is planned, not stumbled into.
- A loading experience that is part of the site: the paper lantern (§4.1).
- Relaxed limits (§3), with 60 fps kept.

**Non-goals**
- An Unreal Engine 5 renderer (Nanite, Lumen, ray tracing): not possible in a browser on this laptop.
- Free roaming (D27: after M8). Look-around stays ±40° / ±15°, wider only where a place's set is complete (§4.2).
- Stills or painted backdrops (D50).

**Anti-goals** (failures even if the build "works")
- Any stutter or hitch on a ride: a stutter costs more than any look gains.
- Visible pop-in when close-up detail arrives.
- Losing the open-world feel: the whole coast must stay visible from high places (§4.2).
- A loading screen that feels like waiting.

## 3. Limits (D53)

| Limit | Was | Now |
|---|---|---|
| Download | ≈ 3 MB per place, 5 MB cap (D9, D30) | Up to ≈ 60 MB in all; ≈ 10 MB before the first place, the rest during rides |
| First view | < 3 s (D9, D42) | A 5–15 s lantern experience; the name still < 1 s |
| Materials and draws | Fixed caps (D13) | No fixed caps; whatever holds the frame rate, measured |
| What is drawn | One world, parts switched by place | Whole coast always drawn as far versions; one place's close-up detail at a time |
| Frame rate | 60 fps at low on this laptop | **Kept**; phone 60 at mid/high (D18, R198) |

The new ceiling is measured in Phase 0 (gpu-sweep, phone over USB) before content is sized to it.

## 4. Design

### 4.1 The lantern loading experience
- The name shows in < 1 s (as now). Behind it: a table at evening, an unlit paper lantern, a match. The visitor folds
  and lights the lantern (pointer or touch; keyboard: Enter) while progress shows as the lantern's glow filling.
- It loads the far versions of the whole coast, Golden's close-up set, and the first ride's passage.
- When ready, the lantern floats out of the window and becomes the visitor's lantern on the journey (the existing
  lantern thread: claim at Golden → Dusk → First light). Skippable for returning visitors (sessionStorage), never
  longer than needed: if everything is cached, it is a 2 s beat.
- Built in the same renderer (no second engine); its assets count in the ≈ 10 MB first load.

### 4.2 The world: far versions always, close-up sets streamed in passages
- **Far layer, always drawn:** the base land, simplified cliffs, the arch and stacks, tree groups as impostors
  (pictures from many angles), the ranges. From Midnight the cove is still there, far below.
- **Close-up sets, one place at a time:** each place's pack (ground textures, dense plants, rocks, props, lanterns,
  fine meshes), fetched while the visitor rests at the place before, shown and compiled inside a passage, the previous
  one released after.
- **Passages** (one per ride, where the view is briefly enclosed): I→II the grove canopy; II→III the cliff edge and
  flock; III→IV under the arch; IV→V a cloud bank (with a few seconds of drizzle on the lens); V→VI up through the falls'
  spray; VI→VII down through the cloud sea; VII→VIII the cave mouth's glare; VIII→IX the morning mist.
- R38 stays law: everything is compiled for the eye and the mirror before it shows; cold rides measure 0 late pipelines.

### 4.3 The journey (owner's #4)
- **Measure first** (Phase 0): for every ride, sampled at 120 Hz along the pose: camera speed, acceleration and jerk
  (position and gaze), screen-space motion; frame pacing on low (laptop) and on the phone. A ride's "dead" share is the
  fraction of time where the frame has no subject: nothing within ~300 m in frame and less than ~15 % of the frame with
  detail (an edge-density measure on the shot). Baselines for all eight rides go in the ledger.
- **Rules:** speed and gaze change continuously (no step in velocity, jerk-limited easing in and out, the gaze leads the
  path and never snaps); screen-space motion near constant through a ride; no dead stretch over ~1 s; each ride is a
  short shot list (3–5 beats), each beat with something near the lens or passing (trees, rock, birds, lanterns, spray),
  and the destination's reveal at a planned beat.
- Ride paths are re-authored per ride with the content that dresses them (§5 Phase 3); the bake chain
  (`bake_flights.ts`) and the flights tests (clearance) extend to the new rules.

### 4.4 The eight causes (from the audit)
C1 jagged low: temporal anti-aliasing plus a sharpening upscale; try low at ~65 % scale. C2 plastic land: a ground
material (rock/grass/sand/soil by slope and height, close-up detail), a 1–2 m height grid near places, outcrops and plants
on every face. C3 empty sides and rides: full sets in the whole look-around, rides as shots. C4 cardboard: remodelled
lanterns, stacks, arch, ranges, pebbles, mist, Golden's grass (Blender, scans). C5 flat light: baked light and soft
shadow per place, leaf translucency, rim light, one real-time shadow near the eye on high. C6 photo sky: volumetric
clouds at quarter size updated over 16 frames (Horizon Zero Dawn / Nubis); the photos keep only colour and glow. C7 still
water: waves under D47 rules, sharper mirrors where water is the subject. C8 glare: eye-like exposure, glare capped per
hour. The 44 problems and their fixes per view: the audit page.

### 4.5 Ideas included
Small events for people who stay (a shooting star at Midnight, dolphins at Blue hour, a gust through Sunset's poppies,
a crab at Golden); the drizzle passage; a postcard button at each place. Each is judged like any other piece (D15).

## 5. Approaches

- **A. Polish in place** (fix each item in today's structure): cheapest, but today's limits cap the detail.
- **B. Far versions + streamed close-up sets + passages + the lantern loader** (chosen by the owner): each place can
  carry 2–3× the detail, the coast stays open, loading becomes part of the experience.
- **C. Pre-rendered video or panoramas:** rejected by D50 (no stills) and by the interactivity of D25.

## 6. Phases (≈ 10–12 sessions)

| Phase | What | Sessions |
|---|---|---|
| 0 | Measure the journey (§4.3) and the new GPU ceiling; the lantern loader; far layer + set streaming + passages skeleton | 1–2 |
| 1 | C1 smoothing, C2 ground material and finer land, C5 baked light: every place and ride lifts together | 2 |
| 2 | C6 sky, C7 waves and mirrors, C8 exposure (D47: all places and rides) | 2 |
| 3 | Each place a complete set and each ride re-authored as shots, in journey order | 4–6 |
| 4 | The whole night: 90 views + ride strips + journey numbers + phone; the owner's test | 1 |

## 7. How it is checked

- `.superpowers/m85/audit.mjs` (90 views, 40 ride frames) before and after every phase, with a % per view.
- The journey numbers (§4.3) per ride, old vs new; cold rides 0 late pipelines (R38); whole-night gpu-sweep old vs new,
  run alone (s26 lesson); phone over USB.
- The owner tests only builds I call ready (D15), on `http://localhost:4181` and his phone.

## 8. Left to the builder
Texture sizes and formats (KTX2), impostor angles, the cloud model's parameters, each place's prop list (from the
references), passage timings, the lantern scene's look (sketch first, memory "sketch before render").
