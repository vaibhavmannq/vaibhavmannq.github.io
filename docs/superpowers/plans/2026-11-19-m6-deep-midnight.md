# M6, Deep midnight: Implementation Plan

> **For agentic workers:** the owner chose inline execution (s11–s19: "complete M6 in this session"):
> superpowers:executing-plans, task by task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Deep midnight (VI) as Amendment 1 §4 row VI says, at least 85 % by my judgement against the owner's photos:
- you stand on a ridge top above a sea of cloud, heather and grass at your feet, one lone tree on the left;
- a real moon (the night's crescent, sharp, haloed) with its road on the cloud;
- several ranges of peaks standing out of the cloud, each paler with distance;
- a softer aurora: no bright foot, pulsating patches late in the night;
- and R38, the first-trip hitches into Night and Midnight, found with the pipeline log and fixed.

**Architecture:**
- **No new download** (D30). The ridge top, its plants, the tree's placement and the peaks are made in the browser from
  seeded, pure, tested data (like `bowl.ts`, `caps.ts`). The lone tree reuses the cove pack's tree (the grove material).
- **The ridge top** is a fine ground patch (`ridge.ts`): 0.5–1 m cells near the eye growing to the 8 m grid at its
  edge, heights from coast.py's ridge formula plus small relief, blended into the live grid at the rim so no seam shows;
  drawn with the terrain material's look. Heather and grass are new placements in the meadow's plant system (eye only).
- **The peaks** (`peaks.ts`): three or four ridgelines at rising distance, one mesh, one unlit material, each layer
  mixed toward the sky's horizon colour by distance (book §1); feet below the cloud deck.
- **The cloud deck** (`cloudSea.ts`): smaller, more numerous lumps; a moon side; a forward-scatter road toward the moon.
- **The aurora** (`aurora.ts`, Midnight only): the foot softened, the strength lowered, patches pulsating on their own
  clocks (5–20 s). Night's corona unchanged.
- **R38:** each part's shaders are built for the sea's mirror as well as the scene pass (`pipeline.ts compile`), with
  builds keyed by their own render context (`keyBuildsByOwnContext`), so no part is first built mid-flight.

**Tech Stack:** TypeScript + three.js 0.186 (`three/webgpu`, `three/tsl`), Vitest, Playwright; adb + CDP for the phone.

**Spec:** `2026-11-10-realtime-world-design.md` §2 (VI) and the M6 row, as amended by
`2026-11-11-world-design-amendment-1.md` §3, §4 (VI). Look: `research/m6-midnight-references.md` (this milestone's
Research phase), then `research/owner-references.md` §2, §7, §10 (D28). Behaviour: `research/reference-book.md` §1, §2,
§4, §5, §8 (D24). Ideas: `research/milestones-m3-m10.md` "M6". Three.js: `research/threejs-r186-notes.md`.
UI/motion sources the owner named in s19: `research/owner-sites.md` (no change to this place).

## Global Constraints

- **Speed bar (D9, D30):** 60 fps at the stop on the default tier; no frame over 50 ms in a flight; no new download.
- **Census (D13):** ≤ 60 draws including the mirror pass, ≤ 14 materials, ≤ 2.5 M triangles at every stop.
- **Phone path:** nothing essential may depend on compute (WebGL2 must draw it).
- **Midnight's light (book §1):** a 13 % crescent: silver-blue, low, from the right; shadows deep navy, never black;
  colours greyed (Purkinje); far layers paler.
- **Build hygiene:** rebuild before shooting and check the build log's last line; never measure while `world:test`
  runs; A/B one page at a time; check every part joined; Python edits of source files with `newline=''`.

## Tasks

### Task 0: Research phase (D20)
- [x] `docs/handover/research/m6-midnight-references.md`.

### Task 1: R38, the first-trip hitches (measured first)
- [x] A cold first ride (Chrome with no shader disk cache, `QUIET_COLD=1`) Blue hour → Night → Midnight with the
  pipeline log (`.superpowers/m6/first-ride.mjs`): which builds come late, and when.
- [x] Fix: build each part for the mirror too; find why s12's attempt drew the eye's view upside down; unit test.
- [x] Laptop A/B, cold: into Night and Midnight before/after.
- [ ] Phone A/B (a visitor's night, this build vs e406c8a).

### Task 2: The ridge top, heather and grass (owner `night-sky` 6; render; book §8)
- [ ] `ridge.ts`: a pure, seeded ground patch around Midnight's camera; tests (meets the grid at its rim, no hole under
  the eye, falls away in front).
- [ ] Heather (grey-violet mats) and grass on it in the meadow system; a few pale stones.
- [ ] Prototype the camera's eye height and look with `?param` hooks, shoot, write the winner into coast.py.

### Task 3: The lone tree (owner `night-sky` 6; D33)
- [ ] The cove pack's tree placed on the ridge's left shoulder, its crown against cloud and sky, a slow sway; shown only
  at Midnight and its flights.

### Task 4: Peaks fading with distance (owner `night-sky` 6, `mist` 2; book §1)
- [ ] `peaks.ts`: three or four ranges, jagged, rising distance, each paler; feet under the deck; tests.
- [ ] The mid-ground hill loses its daylight green.

### Task 5: The cloud deck and the moon's road (owner `cloud-sea` 3, `night-sky` 4, 5, 8; book §4)
- [ ] Smaller, more numerous lumps; the side facing the moon brighter; a road of forward scatter toward the moon.
- [ ] The moon: earthshine on the dark part; the halo lights the deck under it.

### Task 6: The late-night aurora (book §5; brief "a softer aurora foot")
- [ ] Midnight's foot softened, strength lowered; pulsating patches (5–20 s, each its own clock); the deck takes a
  faint green under it. Judged in motion (frame strips).

### Task 7: Speed, phone, verdicts
- [ ] Census; laptop held still at low/mid; the first ride (R38) again; phone over USB; gate (`npm test`, e2e,
  `world:report`, `world:test`); verdicts with likes, dislikes, % look and % behaviour; ledger, log, HANDOVER.
