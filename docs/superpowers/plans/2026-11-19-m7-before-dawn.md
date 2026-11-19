# M7, Before dawn: Implementation Plan

> **For agentic workers:** the owner chose inline execution (s11–s20: "complete M7 in this session"):
> superpowers:executing-plans, task by task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Before dawn (VII) as Amendment 1 §4 row VII says, at least 85 % by my judgement against the owner's photos:
- the stop begins deeper in the cave and drifts toward the mouth;
- the cave's walls are rock you can read (lit near the mouth, Fingal's columns), its floor wet stones and stumps around
  a still pool that mirrors the mouth, with drips;
- glowing fungi in clusters, vines and moss on the lip, the view out to a paling sea;
- a skylight shaft, running, behind a switch, as an option for the owner;
- R38 kept fixed: every new part built for the mirror before it shows; a cold first ride into and out of Before dawn.

**Architecture:**
- **No new download** (D30). Everything new is made in the browser from seeded, pure, tested data (like `bowl.ts`,
  `ridge.ts`). The cave stays coast.py's chamber (`cave.bin`); no Blender re-export.
- **The passage** (`passage.ts`): a tunnel ~16 m long behind the chamber, along the mouth's axis, its walls faceted as
  vertical columns under a rougher vault (Fingal's colonnade and entablature), its floor level with the chamber's; it
  flares behind the chamber's back wall, where the shell is opened (the shell's own `open` cut). Merged into the cave's
  one mesh and material: no new draw, no new material. Its roof stays under the live ground (a test).
- **The walk** (`walk.ts`, pure): at Before dawn the camera stands at a deep point and walks to the stop's own camera
  (unchanged, the approved view) over ~30 s while resting, eased; scrolling through the stop also moves it, so the
  flight in ends at the deep point and the flight out starts at the stop's camera. Reduced motion and `?cams=old`: no
  walk. The flight in is re-baked to end at the deep point (`WALKS` in `stops.ts`, read by `bake_flights.ts`).
- **Light in the cave** (`cave.ts`): normals from the mesh; the mouth as an area light (facing × falloff) on top of the
  baked share; a warm bounce near the floor; wet rock darker with a sheen; shadows a coloured near-black; a column
  pattern in the shader (cheap: a few ALU ops, no texture).
- **Floor**: hexagonal column stumps, boulders and cobbles made in the browser and merged into the cave mesh; the noise
  puddles replaced by one still pool and wet sheen; drip rings in the pool (per pixel, a few ops).
- **Fungi**: re-placed in clusters on the walls' feet and stumps; a pointer wave (one uniform).
- **Vines and moss**: leaf-shaped alpha-cut cards hanging from the lip (one instanced draw, its own small material);
  moss as a tint in the cave material on the lip's upward faces.
- **Skylight** (`?skylight=off` to compare): a ragged hole in the chamber's roof (the shell's cut), a faint cool shaft
  (one additive mesh) with slow motes, its floor patch lit and mossy.

**Tech Stack:** TypeScript + three.js 0.186 (`three/webgpu`, `three/tsl`), Vitest, Playwright; adb + CDP for the phone.

**Spec:** `2026-11-10-realtime-world-design.md` §2 (VII), §9.11 and the M7 row, as amended by
`2026-11-11-world-design-amendment-1.md` §3, §4 (VII), §6, §7. Look: `research/m7-before-dawn-references.md` (this
milestone's Research phase), `research/owner-references.md` §4, §8 (D28). Behaviour: `research/reference-book.md` §1,
§3, §4, §6, §8, §9 (D24). Ideas: `research/milestones-m3-m10.md` "M7", `inspiration-and-ideas.md` (drip ring, fungi
wave). Three.js: `research/threejs-r186-notes.md`. UI/motion: `research/owner-sites.md` (no change to this place).

## Global Constraints

- **Speed bar (D9, D30):** 60 fps at the stop on the default tier; no frame over 50 ms in a flight; no new download.
- **Census (D13):** ≤ 60 draws including the mirror pass, ≤ 14 materials, ≤ 2.5 M triangles at every stop.
- **Phone path:** nothing essential may depend on compute (WebGL2 must draw it).
- **Before dawn's light (book §1):** sun −10° (nautical twilight), azimuth −12°, almost straight out of the mouth: the
  horizon clear, a warm band low in the mouth, deep blue overhead. No direct beam anywhere. Fungi never lamps.
- **R38:** every new part joins through `compileThenAdd` (built for the mirror too). Cold first rides with
  `QUIET_COLD=1` and `.superpowers/m6/first-ride.mjs`.
- **Build hygiene:** rebuild before shooting and check the build log's last line; never measure while `world:test`
  runs; A/B one page at a time; check every part joined; Python edits of source files with `newline=''`.

## Tasks

### Task 0: Research phase (D20)
- [x] `docs/handover/research/m7-before-dawn-references.md`; before shots and sheet in `.superpowers/m7/before/`.

### Task 1: The passage (Fingal's Cave; research §"deeper start")
- [ ] `passage.ts`: pure, seeded tunnel geometry (columns on the walls, vault, floor), its centreline from the chamber's
  back wall along the mouth's axis reversed; tests: roof under the live ground − 0.5 m, floor level with the chamber,
  flare wider than the shell's opening.
- [ ] The shell opened where the passage meets it; passage merged into the cave mesh with its own baked light (the
  mouth's share by distance and facing).
- [ ] Shot from the deep point; verdict.

### Task 2: The walk and the arrival (Amendment §4 VII, §7; design review VI → VII)
- [ ] `walk.ts`: pure walk state (time while resting, scroll progress through the stop; 0 at the stop's start, 1 at its
  end); tests.
- [ ] `FrameState` carries the progress through a stop; `poseAt` places the camera on the walk; `WALKS` in `stops.ts`;
  `bake_flights.ts` ends the flight in at the deep point; re-bake; `?cams=old` and reduced motion stand still.
- [ ] Frame strips of the arrival and of the walk; verdict in motion.

### Task 3: Light on the rock (owner cave 2, 3, 5; book §9)
- [ ] Normals; the mouth as an area light; warm bounce; wet near the floor; coloured shadows; a column pattern.
- [ ] Cost on the laptop (GPU ms at the stop, mid and low) before and after; verdict against the owner's photos.

### Task 4: Floor and pool (owner cave 2, 4, 5; book §3)
- [ ] Stumps, boulders and cobbles (seeded, tested: none in the walk's path or the pool); merged into the cave mesh.
- [ ] One still pool mirroring the mouth, wet sheen elsewhere (no noise blobs); drip rings at 0.25 m/s.
- [ ] Verdict, still and in motion.

### Task 5: Fungi (book §6; m2-references §4; inspiration)
- [ ] Clusters on the walls' feet and stumps (seeded, tested: clustered, not even); faint and steady.
- [ ] The pointer's slow wave of brightening (≤ 1.6×, ~0.3 s up, ~2 s down); verdict in motion.

### Task 6: Vines and moss at the lip (owner cave 5; book §8; D5)
- [ ] Leaf-shaped alpha-cut cards on strands from the lip, swaying at force 1; moss on the lip's upward faces.
- [ ] Verdict against the render and owner 5.

### Task 7: The skylight, as an option (owner cave 1; research §skylight)
- [ ] Roof hole, faint cool shaft, motes, lit mossy floor patch; `?skylight=off`.
- [ ] Shots and a strip with and without; my recommendation.

### Task 8: The view out
- [ ] Check stars against the sky's brightness, the sea's paling, the straight slab; fix what is foreign.

### Task 9: Speed, R38, phone, verdicts
- [ ] Census at Before dawn; laptop A/B held still (mid, low) against 32c07a2; cold first rides Midnight → Before dawn
  → First light (both builds).
- [ ] Phone over USB (if connected): joined, held still, a visitor's ride through VII.
- [ ] Gate: unit, `world:report`, e2e, `world:test`; ledger; verdicts; session log; HANDOVER.
