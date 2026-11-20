# M8 reference sheet: the whole night, polished (s21, 2026-11-20)

M8's Research phase (D20). It gathers every item M3–M7 carried here (D38, D40), with the evidence for each, and what
M8 adds of its own (Amendment 1 §7, §8, §10; spec §18 M8 row; `milestones-m3-m10.md` "M8"; `owner-sites.md` M8).
No web search: the research folder covers all of it. Each plan task cites its line here.

Sources used: the s16–s20 logs and the M3–M7 ledgers; `reference-book.md` (§1 clock, §2 wind, §11 sound);
`owner-references.md` (§1 motion video, §14 taste, §15 sound, §17 the WuWa videos); `design-review-and-proposals.md`
§4 (flights as shots); `inspiration-and-ideas.md` (B, C, D, F); `owner-sites.md` (M8 row); `threejs-r186-notes.md`.

## 1. Hitches and speed (behaviour; measured first, every time)

| Id | What | Evidence | Where it stands |
|---|---|---|---|
| R121 | Laptop, first trip out of Before dawn toward First light: one 600–1150 ms freeze and one 200–250 ms, both builds | s20 `cold2.log`; s21 `.superpowers/m8/r121-cold2.log`, `r121-cold3.log` | **Cause found s21:** (1) three r186 shares a texture binding between nodes holding the same Texture (`TextureNode.getUniformHash` = uuid); the sky's two hour slots hold one texture at a stop and two in flight, so the rock (and any fogged material pre-built at rest) got a second shader mid-flight; (2) the spots' glints were pre-built while the slots held the 1×1 placeholder (nearest, clamped: `textureLoad`), not a photo (linear, wrapped: `textureSample`); (3) the eye's pre-build culled by the current view. Shader text diffed: `.superpowers/m8/pipes/`, `pipes2/`. |
| R123 | Phone, first ride into Before dawn: 2 frames over 50 ms, worst 285 ms (368 old) | s20 `.superpowers/m7/phone*.log` | Not yet re-measured; R121's causes apply to every flight, so measure after its fix first. |
| R101 | ~200 ms frame on a cold first visit into Midnight, no pipeline, no long task | M6 ledger Task 1 | Same family seen s21: a 167–200 ms frame ~32 s after arriving at First light, nothing created, no long task (main thread idle: a GPU-side stall). |
| R122 | The sky shows through the cave mouth during the flight in (seen only in posed strips) | M7 ledger | Film the flight in, then decide. |
| — | Mid misses 60 fps at Dusk, Sunrise and on the mid rides (laptop) | s13–s16 ledgers; s16 log | Laptop default settles on low (s12); phone is 60 at mid/high. Measure per stop what costs; D13 caps stay. |
| — | Golden at 14 materials (the cap) | s15 log, s20 Task 9 | Anything new at Golden must share a material. |
| — | Stage-B pop-in | s16 log "from before" | Parts join as they compile; a fade-in (spec M8 row "fade-ins") instead of a pop. |
| — | Headland and cove packs fetched at every start | s13–s16 | Fetch by distance from the opening stop (spec M8 "prefetch"). |
| — | `horizon.spec` e2e fails on and off; Firefox smoke 5 s page-load bar and `load.spec` 10 Mbit/s fail under the full suite's load | s14, s19, s20 logs | Laptop load, both builds; pass alone. Fix the tests' timing or run them alone in the gate. |

## 2. Look, per place (carried; my closing % at mid)

| Place (close %) | Carried items | Evidence (owner photos, reference) |
|---|---|---|
| Golden (76) | the glare; pebbles fine | s16 log; `owner-references.md` §6, §14 |
| **Sunset (80)** | **the meadow view feels empty (owner, D38)**; the clump; faceted flower heads up close | D38 quote; `?cams=old` is the guide; `meadow-and-flowers` 1–6 ("from inside the flowers, drifts of mixed species"), 10 (the lone tree) |
| Dusk (74) | the mirror's resolution; the dark foreground; +1 material | s16, s18 logs |
| Blue hour (82) | the glare at the arch's right foot; boxy fallen blocks; low's stair-stepped mirror; denser plankton ribbons; a Milky Way; a pause at the arch | s17 log; plankton refs §13; reference book §1 (stars) |
| Night (72) | even wall texture, bare rim (moss, rim plants); slim falls and a block-like ledge; a pale blob at the frame's top (aurora); small fireflies, firefly trails; lantern streaks in the mirror; the spot behind the falls | s18 log; waterfall 5, 11; fireflies §12; `owner-references.md` §17 (firefly lagoon) |
| Deep midnight (74) | heather as a carpet not clumps; pale slab bottom-left; flat far plain; rolling swells in the deck; no earthshine; nothing answering the pointer; the tree leaves the phone's frame | s19 log; `mist` 2 (cloud lumps); reference book §2 (force 2–3 on the ridge) |
| Before dawn (72) | the floor's stones barely read; the colonnade too regular; the deep start very dark; thin vines; the pool not mirroring vines/shaft; the straight slab outside; the fungi's pointer wave not judged in motion | s20 log; caves 2, 4, 5 |
| First light (74) | a thicker mist | s16 log; `mist` 8 is the target |
| Sunrise (76) | sun shafts; dew glints | s16 log; `inspiration-and-ideas.md` B (dew) |

Every place: **a portrait framing** (spec M8 row; s19: Midnight's tree leaves the phone's frame). The rule from
`owner-references.md` §14 holds in every fix: a near layer, a subject, a far distance; a second colour; no pure black.

## 3. What M8 adds

### 3.1 Flights as shots (Amendment 1 §7; `design-review-and-proposals.md` §4)
Each flight one moment, slow at the reveal, quicker over open water; the hour's change in the flight's middle third
(`owner-references.md` §17 "hold, then a short blend"). Built so far: IV → V under the arch (s17), V → VI up the falls
(s18), VI → VII backing in through the mouth (s20). Left: I → II (rise up the cliff face, the meadow opening),
II → III (low through the flowers, round the tree), III → IV (skim among the lanterns toward the arch), VII → VIII (walk
out through the vines), VIII → IX (just above the mist, turning into the sun). Rules: `check_paths` (2 m clearance,
under 80 m allowed over open water only); reduced motion keeps cross-fades. Judge in motion (strips plus a ride).

### 3.2 Sound, its own short design (Amendment 1 §8; reference book §11; `inspiration-and-ideas.md` D; owner §15)
Silent until opted in; a toggle always in view (the top bar, as Aditya's); the AudioContext made inside that tap. One
loop per place cross-faded by the hour weights; the falls and the surf placed in the world, louder with nearness;
loudness follows the place's wind force (calm cove laps; ridge wind; cave drips and echo; the dawn chorus from one or
two birds before First light, swelling to Sunrise). AAC `.m4a`, ~100–200 kB a loop, fetched only after opt-in (outside
the speed bar). Pixabay, each file's page and author in `tools/world/sources.json`. Music: not now (owner §15).
Reduced motion does not mute; the toggle remembers per visit.

### 3.3 The night cursor and the loader (`owner-sites.md` M8)
- Cursor: a soft glow with a short trail, night hours only (Originkit "Aura Cursor", "Ribbon Trails"); never replacing
  the pointer over links or the card; off for touch and reduced motion. A few lines of CSS/canvas, no library.
- Loader: the line under the name is a hairline that fills with real progress (Originkit "Hairline Loader", "Masthead
  Reveal"); D9 "no blank loading screen" stays.

### 3.4 Stills from the live site (Amendment 1 §10, D27)
The fallback stills are captured from the finished live site at high quality on the laptop (landscape and portrait per
stop), not a Blender round. Last in M8, after the looks settle.

### 3.5 From `milestones-m3-m10.md` M8 and `threejs-r186-notes.md` §4
`onDeviceLost`; preload links for stage A; half-size bloom for low; Lenis `anchors` and touch checked on the phone
(`syncTouch` not assumed); `prefersReducedMotion` for the flights.

## 4. How M8 is judged
A % for look and a % for behaviour per place and per flight (D15), in motion, against the owner's photos, mid beside
low; cold first rides (QUIET_COLD=1) over every flight a task touches (R38 stays fixed); the phone over USB before
the owner tests anything.
