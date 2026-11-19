# M7 ledger: Before dawn (VII)

Plan: `docs/superpowers/plans/2026-11-19-m7-before-dawn.md`. Research: `docs/handover/research/m7-before-dawn-references.md`.
Tools (local): `.superpowers/m7/tools/` (`cavebin.mjs` decodes cave.bin, `flight-strip.mjs` frames along a flight with
`__flightPose`, PORT env for the old build), plus `.superpowers/m6/shot.mjs` (stills; `walk=0..1` holds the stop's
walk), `.superpowers/m6/first-ride.mjs` (now knows stops VII–IX), `.superpowers/m3/tools/` (census, A/B). Shots:
`.superpowers/m7/` (before, t1–t7, t2*, final, `m7-final.jpg`). Old build for every A/B: 32c07a2 in `../wt-head` on 4182.

## Session s20 (2026-11-19), Opus 5.5, inline

**Start.** Before dawn at 32c07a2 (`before/mid.png`): the mouth with the dawn sky, walls a flat navy void, a smooth floor
with blotchy noise puddles mirroring like metal sheets, teal fungi in an even ring along the floor's edge, no vines, no
skylight; the camera 4 m in front of the back wall (the chamber is only 20 m deep). My 58 % look, 50 % behaviour.

### Task 1: the passage (b1d845a)
- **R112:** the stop starts deeper in a **passage made in the browser** (`passage.ts`), not a Blender re-export: 19 m
  behind the stop's camera along its view reversed, 5.2 m wide, a 3 m junction rising to a 5 m vault, walls of vertical
  columns 0.6–0.95 m wide (each two flat faces, so the mouth's grazing light picks out every one), tops lost in a rough
  vault (Fingal's colonnade and entablature), a floor a hand under the chamber's. Its front follows the chamber's back
  wall (`shellSampler`), where the shell is opened with cave.bin's own `open` cut (`openShell`, inset 0.3 m so the cut's
  edge hides the passage's front); merged into the cave's one mesh and material (no new draw or material). Its roof is
  kept 0.7 m under the live hill wherever the terrain is not cut open (unit test; the hill is only 3.7 m over the floor
  10 m behind the chamber's centre, so the vault rises from 3 m to 5 m as the hill does).
- Junction faces pushed back onto the wall were lit face-on by the mouth (a bright rectangle at the junction's right):
  they now keep 15 % of their light.
- Verdict: look 74 % (frame within a frame within a frame, the mouth small and bright; the passage's walls very dark),
  behaviour n/a.

### Task 2: the walk and the arrival (b1d845a)
- **R113:** `walk.ts`: resting at the stop's middle the camera walks 14 m from the deep end to the stop's camera (the
  approved view) in 30 s, eased; scrolling through the stop also carries it (0 at the stop's start, 1 at its end), so the
  flight in ends at the deep end (`WALKS`, `walkStart`, re-baked in `bake_flights.ts`) and the flight out starts where it
  always did. Leaving and coming back from First light stands at the mouth. Reduced motion and `?cams=old`: no walk.
  `?walk=0..1` holds it (shots). `FrameState.stopT` carries the scroll through a stop.
- Tried and dropped: turning to face the cave late in the flight in (`TURN_LATE`): looking at the hill on the descent
  showed the chamber's dome from outside, a pink disc standing out of the hillside (the old flight faced the sea there).
  **The flight now backs in facing the sea**, under the lip, through the chamber and the junction: the mouth closes
  round the view, no turn inside the room (M2's complaint).
- Frame strips (`t2c/`, `t2old/`): the same dark hillside frames on the way down as the old build. In these posed strips
  the sky through the mouth is the flight's sky until the stop (old build too: night sky until t = 1); a real ride was
  not filmed (open, R122).
- Verdict: behaviour 76 % (slow, toward the light; the walk's speed by reference), look in motion 70 %.

### Task 3: light on the rock (b1d845a)
- **R114:** the cave is lit by **the mouth's form factor** (`caveLight.ts`: Σ cosθ·cosθ'·A/πd² over the opening's
  patches, per vertex, at load) instead of cave.bin's Blender bake (a flat area light at the mouth, which left the walls
  beside it almost black). The opening is ~50 m², so the true share is small (0.05 at the camera, 0.001 deep in the
  passage): shown as share^0.6 × 2.0 (an eye adapted to the dark), plus a warm bounce, a 0.004 bounce into the passage
  fading over 5 m, and a dark blue-grey floor (`SHADOW`), never black.
- **R115:** Fingal's colonnade on the chamber's walls in the shader: columns ~0.8 m with wandering spacing, the face
  toward the mouth lit and the other dark, a joint between, cross joints at each column's spacing, each column its own
  tone and broken top (2.4–4.4 m), the entablature above. A few dozen ALU ops, no texture. Wet feet darker.
- Verdict: look 70 % (the walls are rock now, lit toward the mouth; the stripes are still too regular and wavy where the
  shell bulges; the lip is not yet the brightest rock as in owner 2, 3).

### Task 4: floor and pool (b1d845a, 8ae67b2)
- **R116:** cave.bin's noise puddles are gone. **One still pool** (2.3 m, a ragged edge per pixel) mirrors the mouth:
  the mirrored ray is intersected with the mouth's plane and tested against its ellipse (`apertureEllipse`), so it is
  right from any eye, the passage included; the headland outside is dark in the mirror where the angles put it; the
  pool is dark straight down (Fresnel). Two drips (5.3 s, 7.9 s) ring it at 0.25 m/s (book §3). The wet floor has a
  faint soft sheen toward the mouth. Cobbles, boulders and hexagonal stumps (`caveFloor.ts`, seeded; none on the walk's
  line or in the pool; stumps only away from the mouth's beach) merged into the cave mesh.
- Verdict: pool look 82 % (the best thing in the cave; it reads as water), floor 55 % (the stones hardly read: low,
  dark, little light reaches them; owner 2, 4, 5 are all boulders), behaviour 78 % (drips).

### Task 5: fungi (b1d845a)
- **R117:** cave.bin's even ring of fungi is replaced: clusters (12–36 points) low on the chamber's middle and front
  walls, on the passage's column feet, on some stumps, and ~90 tiny points on the passage's vault (the deep start has
  points overhead). Steady, faint. The pointer: points near its ray brighten up to 1.6× with a ripple running outward
  (rise ~0.3 s, fall ~2 s; `caveLure`, eased in boot).
- Verdict: look 74 %, behaviour 70 % (the wave was not filmed with a moving pointer; it compiles and draws).

### Task 6: vines and moss (bb9822d)
- **R118:** 44 strands from the mouth's upper rim, clumped, 0.5–3.3 m long, ivy-shaped cut-out leaves (alpha test, D5's
  square leaves fixed), near-black against the dawn, swaying at force 1; one instanced draw, its own small material,
  only within 60 m. Moss as a tint on the mouth's rim (patchy), not round the passage's junction.
- Verdict: look 72 % (render-like silhouettes; thinner than the render's), behaviour 72 %.

### Task 7: the skylight, an option (c9a9ec2)
- **R119:** a ragged hole in the chamber's roof ahead and right of the stop's camera, a faint cool shaft under it (one
  additive cone, thick through the middle, drifting mist), the zenith's blue and moss on the floor under it. No beam: the
  sun is 10° down (book §1). **On by default; `?skylight=off` shows the stop without it.** From the passage it reads as
  a pale column beside the mouth; at the stop it is a soft haze at the frame's right.
- Verdict: look 66 % (honest, soft; less dramatic than owner 1, which is daylight), behaviour 70 %. My recommendation:
  keep it.

### Task 8: the view out
- Checked by eye on the final shots: the sea pales under the dawn band, no stars show in the mouth's sky. The straight
  dark slab at the horizon right of the mouth (outside rock) is still a fake straight line: carried to M8.

### Task 9: speed, R38, verdicts (8ae67b2)
- **R120, census** (mid): Before dawn 36 draws, 1.15 M triangles, 9 materials (was 32 / 1.13 M / 7). At first the
  vines stayed visible within 400 m and Golden went to 15 materials (cap 14) and +2 draws at five stops; vines and
  shaft now draw only within 60 m: every other stop is back to its old numbers.
- **Laptop A/B held still** (`ab-builds.mjs`, A = 32c07a2), low: Before dawn GPU 8.7–8.8 → 11.6–12.7 ms, both 60 fps;
  mid: 17.5–22.5 → 23.6–24.5 ms (mid was already under 60 fps here in both). Golden unchanged.
- **R38, cold first rides at low** (`QUIET_COLD=1`, START=midnight, `cold2.log`): into Before dawn **0 frames over
  50 ms in both builds**, no late pipeline. Out of it toward First light **both builds** freeze once 600–650 ms and once
  200–250 ms, after two late pipelines (`MeshStandardNodeMaterial_38`, `SpriteNodeMaterial_21`). **R121, open, not
  M7's:** a first-trip build on the flight into First light that s19's fix does not cover. (A cold Chrome that had a
  failed run in it throttled the page to 1 Hz after ~45 s; restart it between runs.)
- Unit 366 passed; `world:report` green; no new download; `world:test` passed; e2e 27 passed, `load.spec` failed once in
  the full suite (name 1.84 s vs 1 s) and passed twice alone (laptop load).
- **Phone** (plugged in late; USB, Brave; `.superpowers/m7/tools/phone-m7.mjs`, logs `.superpowers/m7/phone*.log`): every
  part joined (cave, vines, skylight among them). **Before dawn held still (the walk running): 59.7 fps at mid and at
  high**, worst frame 33 ms. A ride Midnight → Before dawn → First light, old build then this one: into Before dawn
  **both** builds 2 frames over 50 ms (worst 368 ms old, 285 ms new); out of it 2 (worst 67 old, 50 new). M7 adds no
  hitch on the phone; **R123, open:** the phone's first ride into Before dawn hitches in both builds (s19 saw none on
  the flights it rode; this ride starts on a fresh page at Midnight).

### Verdicts (mine, D15; `.superpowers/m7/m7-final.jpg`)
- **Before dawn: 72 % at mid, 70 % at low** (before 58 %). **Behaviour 74 %** (before 50 %).
- Likes: the stop begins in the dark and walks toward the light (the brief); a frame within a frame within a frame; the
  pool is still water that mirrors the mouth from anywhere; rock you can read toward the mouth; fungi in clusters and
  points on the vault; vines as silhouettes; nothing new to download.
- Not 85, by reference:
  - the floor: the stones barely read (owner 2, 4, 5 are full of boulders);
  - the colonnade's stripes are too regular and wave where the shell bulges; the lip is not the brightest rock;
  - the passage is very dark at the deep start (atmospheric, but its columns barely show);
  - the vines are thinner than the render's; the pool does not mirror them or the shaft;
  - the slab outside; the pointer's fungi wave not judged in motion.
- Recommendation: close M7 on my side at 72 % and carry these to M8 with M3–M6's, as D38 did.

### End of session (owner)
- D40: "close M7, finish the gate and push". M7 closed at 72 % / 70 % / behaviour 74 %; everything listed above goes to M8.

