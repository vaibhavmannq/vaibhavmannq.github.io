# The live world: nine places, one night, drawn in the browser

- **Date:** 2026-11-10 (session s03)
- **Status:** draft for the owner. Written from the Golden cove slice (s02) without a question round, at the owner's
  request ("do it, then show it to me"). Every choice the owner did not make is marked **(my call)** and listed in §20.
- **Builds on:** D1–D10 in `docs/handover/DECISIONS.md`. Proposes D11–D14 (§20). Amends D8 on one point (texture format, §11.4).
- **Art direction:** the nine full renders, `.superpowers/brainstorm/lookdev/real/out3/out3/<hour>_hybrid_vivid.jpg`.
- **Evidence:** the slice report `.superpowers/spike/golden-cove/report/golden-cove-slice.html` and the s02 log.

## 1. Why

The owner wants a portfolio that feels like an open world, not a page with a picture behind it: "a real world
interactive experience like Aditya's" (D7). The look is settled: nine approved renders, one per hour of a night (D5).
The slice proved that the first place can run live in a browser at the owner's speed bar (D9): about 3 MB, first view
in 2.6 s on 10 Mbit/s, 60 fps on this laptop's middle setting and on the owner's phone.

This document says how to build **all nine places live**, joined by flights, before any of the site's text is written.
The owner wants the nine scenes first (s03: "I want all 9 scenes created first").

## 2. What a visitor gets

1. The page opens. Your name is on screen at once, over the Golden cove's colours. Within about 3 seconds the live
   cove fades in under the name: sun low beside the arch, mirror water, grass moving.
2. Scrolling flies the camera. Nine places, one after another, while the light turns from Golden hour to Sunrise:

| # | Hour | Place | In the scene |
|---|---|---|---|
| I | Golden hour | the beach, looking out | sun between the arch group and the cliff, wet sand mirror, pebbles, a paper lantern in the shallows |
| II | Sunset | the clifftop meadow by the old tree | sun beside the arch, gold road on calm water, meadow and pink flowers, the grove |
| III | Dusk | high on the headland | the cove below, floating lanterns drifting out toward the arch, pink and violet afterglow |
| IV | Blue hour | ankle-deep flats under the arch, 1.6 km out | the arch overhead, scrub on the stacks, first dense stars, glowing plankton |
| V | Night | inside the lagoon crater | the waterfall, an aurora over the falls, fireflies, glowing grass tips, the project lanterns on the water |
| VI | Deep midnight | on the ridge, 283 m up | a sea of cloud filling every valley, an aurora, a low moon, a lone tree, heather |
| VII | Before dawn | inside the cave | wet floor with puddles, glowing fungi and vines, the cove paling outside the mouth |
| VIII | First light | the cove again, from the other end of the beach | mist on still water, the grove mirrored, pink clouds |
| IX | Sunrise | the rise east of the bay | the one front-lit view: warm light on cliffs, grove and stacks |

3. At each place the camera rests and that place's text shows (later; §16). Things in the scene respond to the
   pointer: the lantern lifts and brightens, grass parts around the cursor, the project lanterns at Night open a card.
4. A rail of nine marks shows where you are; click or tap to go to any place. Every place has its own link
   (`/#night`).
5. On a weak device the site never stutters or shows an empty screen: it lowers its own cost, and at the very bottom it
   shows the renders themselves with light motion (§13.4).

## 3. Goals, non-goals, anti-goals

**Goals**
- All nine places live, each judged against its render with an honest %, on the laptop and the phone.
- Flights that make the world feel continuous: you see where you are going and where you came from.
- The speed bar (D9) at every place: name < 1 s, first view < 3 s on 10 Mbit/s, each place complete < 5 s after
  you head for it, 60 fps on each device's default setting, about 3 MB of new download per place.
- One command rebuilds every asset from the Blender world. Budgets checked by tools, not by hope (D8).

**Non-goals (for now)**
- The site's words. Each place gets a placeholder label until the scenes are done (§16).
- Free walking or a player character (D7).
- Sound. Aditya's site has ambience; ours could later, as a separate decision.
- New places, new set pieces, or changes to an approved composition.

**Anti-goals (a failure even if it "works")**
- A blank loading screen, at any point.
- A place that looks like a cheap game level next to its render: flat cards seen edge-on, popping rocks, boxy land
  seen from the air, empty grey ground ("patchy grass and empty space fail the WuWa bar").
- Smooth on this laptop but stuttering on the owner's phone.
- Any game asset, borrowed set piece, or recreation of Wuthering Waves.

## 4. What the slice proved, and what it did not

**Proved** (s02, measured): the cove can be drawn live at the speed bar. Terrain from the formula, a reflecting sea,
57 k grass tufts with wind and parting, 3D trees from Poly Haven models (0.9 MB for four kinds), compressed rocks
and cliff, two sky photos with a cross-fade, bloom and the vivid grade, staged loading. Golden ≈ 82 % of its render,
Sunset ≈ 80 %.

**Not proved** (this is most of the work):
- **Distance.** The slice flies 146 m. The full route is **5.8 km**. Four flights are 1–1.7 km. Every long flight
  sees far more land than the slice ever drew.
- **The world from the air.** The ground formula was shaped for nine fixed cameras. Seen from above (maps on the
  design page) it shows straight box edges: the midnight valley is a rectangle, the two headlands are straight-sided
  blocks, the Sunset clifftop is a rectangle over the sea (the scanned cliff hides it in the render), and the land
  inland is empty. A flight would show all of that.
- **Four things never drawn live:** the waterfall (Night), the cave inside (Before dawn), the sea of cloud
  (Midnight), the aurora (Night, Midnight).
- **Night light.** Every slice frame was sunlit. Six places are lit by sky glow, moon, aurora and small glowing things.
- **Front light on trees.** The leaf cards pass backlit. Sunrise is front-lit.

**So:** no place is promised at the cove's numbers until it has been built and measured. Each place gets its own
score and its own speed numbers when it is built (§18). The order of work puts the unknowns first.

## 5. The world: where the nine places are

Coast coordinates as in `coast.py`: x east, y out to sea (north), z up, metres. In three.js: `(x, z, -y)`.

| # | Camera (x, y) | Ground (m) | Eye above ground | Look (yaw, pitch) | Lens | Flight from previous |
|---|---|---|---|---|---|---|
| I Golden | (9.5, -4) | 0.3 | 0.62 | (-22, 2) | 24 | start |
| II Sunset | (25, 141) | 14.4 | 1.7 | (-47, 0.5) | 28 | 146 m |
| III Dusk | (30, 40) | 25.6 | 1.7 | (-40, -5.5) | 24 | 101 m |
| IV Blue hour | (-1008, 1156.2) | -0.2 (flats) | 0.62 | (-69, 9) | 20 | **1524 m** |
| V Night | (-320, -437) | 0.4 | 0.9 | (0, 12) | 20 | **1735 m** |
| VI Midnight | (600, -950) | 283.5 | 2.4 | (-95, -1) | 24 | **1053 m** |
| VII Before dawn | (-60, -211) | cave floor | 1.5 | (-10, 1) | 18 | **991 m** |
| VIII First light | (-60, -14) | 0.3 | 0.55 | (16, 2) | 24 | 197 m |
| IX Sunrise | (30, -40) | 33.8 | 2.2 | (-26, -8) | 26 | 94 m |

Total route 5.8 km. Five places (I, II, III, VIII, IX) share the cove and its assets. Four (IV–VII) each need their
own. Yaw 0 looks straight out to sea; positive turns east. These are the render cameras; the live site uses them as
the landscape framing of each stop.

## 6. The world pass: make the land hold up from the air

Before any place gets detail, the ground formula gets one pass so that it reads as natural land from flight height.
Same formula, same nine views; only what the cameras never saw changes.

- Replace straight mask edges with noise-warped ones: the midnight valley box, the two headland masks, the plateau
  rectangle, the straight western run of the shore. (The `sm()` limits get a low-frequency warp of the coordinate.)
- Give the inland and the east real shape: a few ridges and gullies at the 200–500 m scale, so flights cross land
  with form, not a flat sheet.
- A **world colour map** (one small picture of the whole map, about 8 m per pixel) painted from coast.py's zone
  rules: sand, wet sand, meadow, scrub, bare rock, cliff faces. It colours the ground wherever no close-up detail is
  loaded.
- **Distant dressing:** clumps of low-detail trees and scrub scattered by the same zone rules along the flight
  corridors, one instanced mesh per kind. Enough that nothing seen from the air is empty.
- **A cheap check:** run `raymap.py` for the nine cameras before and after; the depth each camera sees must not change
  inside its view, except where the owner sees and approves it. Then re-fly the rough journey (§18 M1).
- coast.py and the JS port (`world.js` → `tools/world/ground.mjs`) change together; `check_world.mjs` keeps them equal
  to 0.05 mm at test points across all nine places, not only the cove.

## 7. Architecture

One page, one three.js scene, one camera. The world is the same world everywhere; places are just where the camera
stops and which detail is loaded. Plain TypeScript, three.js 0.186 `three/webgpu` (WebGPU with WebGL2 fallback), TSL
materials, Vite, Lenis for scroll. No new runtime libraries beyond three's own meshopt decoder (my call).

```
scroll (Lenis) --> journey: position 0..N --> FrameState { stop A, stop B, t, hour mix, camera pose, framing }
                                                   |
  +------------------- loop (refresh-aware, from the old site) --------------------+
  | governor <- frame times                                                        |
  | world parts: terrain, sea, sky, light, grass, rocks, trees, glow, ...          |
  |   each: update(FrameState), pure and cheap                                     |
  | assets: residency (which packs are loaded) <- journey position                 |
  | render: main pass + one reflection pass + bloom + grade                        |
  | overlay (HTML): name, rail, place label, cards                                 |
  +--------------------------------------------------------------------------------+
```

**Rules that keep it fast and simple:**
1. **Everything visible is a function of scroll position and time.** No hidden "which place am I in" state; the
   journey answers that.
2. **Every world part has the same shape:** `load(stage)`, `build()`, `update(frame)`, `setTier(t)`,
   `setFade(weight)`, `dispose()`.
3. **One set of materials for the whole world.** About a dozen shared materials (terrain, rock, wood, leaf cards,
   grass, flower, water, sky, glow particles, waterfall, cloud sea, pebble). Places differ by uniforms (colours,
   strengths), not by new materials. Reason: three's WebGPU renderer builds a shader per material (≈ 13 ms each here,
   s02). A dozen costs 0.16 s once; a hundred would freeze a second at every arrival. A new material needs a written
   reason.
4. **One object per kind.** Instance or merge by material; ≤ 60 draws per frame including the reflection pass (s02).
5. **The hour is data.** Nine hour presets (§9.1); flights blend two of them. No place-specific light code.

**Code layout** (the old Moonsink code is replaced; reusable modules move over):

```
src/
  app/        boot, loop, refresh, frameRate, params, capabilities (KEEP from the old site), flags (NEW)
  journey/    stops.ts (the nine stops: cameras, framings, hour, pack), flights.ts (waypoints),
              timeline.ts (scroll -> FrameState), hours.ts (nine presets + blend)
  world/      coords.ts, heights.ts (tile sampler), terrain.ts, sea.ts, sky.ts, nightSky.ts (stars, moon, aurora),
              light.ts, grade.ts, grass.ts, rocks.ts, trees.ts, glow.ts (lanterns, fireflies, plankton, fungi),
              waterfall.ts, cloudSea.ts, cave.ts, dressing.ts, part.ts (the shared shape)
  assets/     manifest.ts, loader.ts (stages, priority), residency.ts (prefetch, evict), warmup.ts
  quality/    tiers.ts, governor.ts (ADAPT from the old site)
  interact/   picking.ts, targets.ts, parting.ts
  overlay/    header, chapterRail (nine marks), sections, focusGlide, projectDialog (KEEP / ADAPT)
  fallback/   stills.ts (the renders as the lowest setting)
  dev/        hud.ts, bench.ts (window.__bench / __flight from the slice)
tools/world/  build.mjs (one command), ground.mjs, check_world.mjs, bake_world.mjs, prep_sky.py, export_rocks.py,
              export_cave.py, export_falls.py, bake_tree3d.py, pack.mjs (gltfpack + WebP), check_paths.mjs,
              blender/coast.py (moved into git as the world's source of truth), pkg/ (gltfpack binary)
public/world/ generated: manifest.json, base/, sky/, stops/<id>/
```

## 8. The journey: stops and flights

### 8.1 Scroll to place
The scroll runs through 9 **stops** and 8 **flights**. A stop is a short stretch where the camera rests (a slow drift
of a few centimetres so it never looks frozen) and the place's text shows. A flight moves the camera from one stop's
framing to the next.

Scroll lengths (my call, tuned by feel in M0): a stop is 1.0 screen height; a flight is
`clamp(0.8 + distance / 900 m, 1.0, 2.2)` screens. That gives about 21 screen heights for the whole night.
On touch devices the scroll settles on the nearest stop when you lift your finger (the old site's touch snap).

### 8.2 Flight paths
Each flight is a hand-placed curve (centripetal Catmull-Rom through 3–6 waypoints in coast coordinates), stored in
`flights.ts`. Short flights (in the cove) stay low, as in the slice. Long flights rise to 80–250 m, cross, and come
down, so the speed reads like a bird's glide rather than a blur, and you see the destination before you arrive.
- The camera turns from stop A's framing toward the direction of travel, then into stop B's framing (eased).
- `check_paths.mjs` samples the ground along every curve and fails if the camera comes within 2 m of the ground
  (except the final descent into a stop) or looks into a hillside for more than half a second. It checks the portrait
  framing too (the slice's mid-flight black headland on the phone).

### 8.3 Light during a flight
The hour blends from A's preset to B's with a smooth ease over the flight. Skies follow D10: each stop keeps its own
sky photo; the next one fades in across the middle 40 % of the flight. Night layers (stars, moon, aurora) fade with
their presets' weights.

### 8.4 Jumps
Clicking a far mark on the rail, or opening a link to a place, does not fly 5 km. It loads that place first, then
fades to it (about 0.8 s) and sets the scroll there. If the place is not ready within 0.5 s, its render shows while it
loads, then the live scene fades in over it (my call).

### 8.5 Reduced motion
With "reduce motion" on, flights become 0.6 s cross-fades between stops; wind and drift are calmer. Nothing else
changes.

### 8.6 Phone framing
Each stop has a landscape and a portrait framing (yaw, pitch, lens), chosen by eye, as in the slice. The camera
blends between them by aspect ratio. Text never covers the subject of the view; each stop says where its text sits.

## 9. How each part is drawn

### 9.1 Hour presets
Nine presets, one per stop, read from coast.py's `SHOTS` by the pipeline and stored in the manifest: sun or moon
direction, colour and strength; sky photo, rotation, gain and tint; ambient (sky above, sea below); fog colour and
amount; exposure; grade (saturation, warmth, vignette, from `grade.py`); water calm (swell, chop); night layers (star
density, moon, aurora bands). `hours.ts` blends two presets per frame; every material reads the same uniforms.

### 9.2 Terrain
- **World base:** heights for the whole map at 8 m spacing, 16-bit, cut into 512 m tiles with skirts, coloured by the
  world colour map. Loaded right after the first view (stage B of the first place), so every flight has ground.
- **Horizon ring:** the slice's polar ring out to 7 km, re-centred on the middle of the map.
- **Place detail:** a 0.5–1 m grid around each stop, covering what its camera sees within about 300 m, with the
  sand/grass/rock material from the slice. Detail patches line up with base tiles; base tiles under a patch are hidden.
- The height sampler (`heights.ts`) reads detail where it is loaded, else base; grass, pebbles and picking use it.

### 9.3 Water
One water material (the slice's: six ripples faded by pixel size, shore foam, transparent shallows). Water bodies: the
open sea (one huge plane), the Blue-hour flats (the sea, very calm), the lagoon, the cave puddles. **One reflection
pass per frame**, for the water body the camera is nearest; the others mirror the sky only (as the slice's tide pools
do). Wet sand mirrors only near the camera (s02 lesson).

### 9.4 Sky
The real Poly Haven photos, recoloured per hour offline (`prep_sky.py`, from the slice), 2k, about 0.13 MB each. The
night layer is drawn in the same sky pass, so it costs no extra objects and shows in the water's mirror:
- **Stars and Milky Way:** procedural stars masked like coast.py's `star_mask`, density from the preset.
- **Moon:** a small disc plus its light (a directional light that takes over from the sun).
- **Aurora** (Night, Midnight): coast.py's `sky_bands` curtains ported to TSL: folded, overlapping curtains sweeping
  diagonally, a wobbling yellow-green foot, rays of uneven length fading to violet (D4). It also tints the light on
  the ground.

### 9.5 Grass and flowers
The slice's system: one instanced mesh per kind, 32 m cells copied in by distance, wind as a moving noise field,
parting around the pointer. Each place has its own placements by coast.py's zone rules (meadow at Sunset and Dusk,
heather and white flowers on the midnight ridge, reeds with glowing tips at Night). From the air, grass is not drawn;
the colour map and the dressing carry the land.

### 9.6 Rocks
Exported from coast.py's own builders (`export_rocks.py`), decimated by on-screen size, merged by material, meshopt:
the arch and stacks with scrub caps, the jointed columns (Golden cliff, lagoon walls, Sunrise bluff), the tide-pool
shelf, the scanned cliff. **Baked light:** ambient occlusion and a bounce term baked into vertex colours in Blender,
so rock in shadow is never pure black (open since s01).

### 9.7 Trees
The slice's 3D trees (simplified wood plus a few hundred leaf cards facing the camera). Added for front light: each
card's normal bent outward from the crown's centre, so a front-lit crown shades round. **Proved at Sunrise, or the
cards get denser there** (risk, §19). Far trees in the dressing use a cheaper version with fewer cards.

### 9.8 Glowing things
One instanced material for small glowing things: lanterns (Golden, Dusk, Night), fireflies (Night), plankton (Blue
hour), fungi (Before dawn). They glow through bloom; none of them is a real light. The ground near them is lit by
baked or painted glow, not by lights (my call: real lights multiply the cost of every material).

### 9.9 Waterfall (Night)
The falls sheet exported from coast.py (`build_waterfall`: lip and drop) with a scrolling streak texture; a foam disc
at the base with moving noise; 20–40 soft spray sprites; the falls mirrored by the lagoon. About 3 objects.

### 9.10 Sea of cloud (Midnight)
One large mesh filling the valley at about 172 m, its top shaped by the same noise as coast.py's `cloudsea` (30 m
amplitude), feathered at the edges, lit by the moon with a soft wrap and a rim when you look toward the moon, drifting
slowly. Two thin translucent layers under it give depth. The valley's peaks stand out of it as islands.

### 9.11 The cave (Before dawn)
The cave mesh exported from coast.py (`build_cave`) with its ragged mouth, decimated, AO baked into vertex colours.
The wet floor is the water material with a puddle mask. Vines and fungi as instanced meshes; the fungi glow. Outside
the mouth: the cove at dawn, from base terrain, the sea and the sky.

### 9.12 After the picture
Bloom, then the vivid grade (ACES, saturation, warmth, vignette from `grade.py`), with per-hour values from the
preset. Shadows: one sun or moon shadow map fitted to the view, frozen while the camera rests at a stop.

## 10. Interaction

- **Hover and click** use one picker against small invisible hit shapes, never the full meshes. Targets: the Golden
  lantern (slice) and the project lanterns at Night (one per project, from `content/projects.ts`). Other places get
  targets when their text is written (§16).
- **Grass parting:** on with a mouse. **Off on touch** until it is fixed (owner: "very weird"; s02 cause: a dragging
  finger both scrolls and parts). Candidate fix later: part only on touch-and-hold.
- **Keyboard and screen readers:** every 3D target has an HTML twin (a real button in the overlay) that does the same
  thing; focus lights the target as hover does. The rail is a list of nine links.
- **Cursor:** changes over a target; nothing else takes over the pointer.

## 11. The asset pipeline

### 11.1 One command
`npm run world` runs `tools/world/build.mjs`: Blender headless (coast.py builders) → exports → gltfpack → WebP →
packs → `public/world/manifest.json`. Same inputs give the same bytes. It writes a size report and fails if a pack is
over budget (§14).

### 11.2 Inputs
coast.py moves into the repo (`tools/world/blender/`) as the world's source of truth (my call). The large source files
(Poly Haven HDRIs, scanned cliff, tree models, textures; all CC0) stay outside git; `tools/world/sources.json` lists
each with its Poly Haven name so it can be fetched again.

### 11.3 Outputs and packs
- `base/`: world heights, colour map, dressing placements, horizon ring.
- `sky/`: the nine recoloured sky photos.
- `stops/cove/`: shared by I, II, III, VIII and IX: cove detail, rocks, cliff, trees, pebbles, textures.
- `stops/<id>/`: one each for bluehour, night, midnight and beforedawn, plus small extras for the cove places (Dusk
  lanterns, Sunrise bluff, First light mist).
- The manifest lists every file with its size and hash and the stops that need it, split into stage A (first view) and
  stage B (the rest).
- Generated files are committed (GitHub Pages serves what is in the build, and CI cannot run Blender). Rebuild them on
  purpose, not on every change, to keep the repo small.

### 11.4 Formats
Meshes: gltfpack (meshopt, `-kv -vtf` so texture coordinates survive). Heights and placements: 16-bit packed (slice
v2). Textures: **WebP, not KTX2** (my call; amends D8). The slice measured WebP small (three ground textures 0.52 MB),
and it needs no 200+ KB decoder. A texture switches to KTX2 only if measurement shows phone GPU memory over budget or
upload hitches over 50 ms.

## 12. Loading

- **First paint:** the page's HTML carries the name, its line, and a tiny blurred picture of the Golden render (about
  20 KB) behind them. No loading screen, ever.
- **Stage A** of the first place (heights, sky, three textures, code): the live view is prepared behind a hidden
  warm-up frame, then fades in over the picture.
- **Stage B** (rocks, cliff, trees, the next sky) **fades in** with a dithered dissolve (no transparency sorting); it
  never pops (parked owner note).
- **Prefetch:** while you rest at a place, the next place's pack downloads; when you scroll back, the previous one.
  The world base loads right after the first place. At 10 Mbit/s a 3 MB pack takes about 2.5 s, so it is ready before
  a normal reader leaves the stop.
- **Never block the scroll.** If you fly faster than the network, the flight continues over base terrain and sky; the
  place's detail fades in when it arrives.
- **Shader warm-up:** all shared materials compile once, in the first idle second after the first view
  (`compileAsync`). Arriving at a new place builds no new shaders.
- **Memory:** at most three place packs held (previous, current, next) plus the base and the cove pack; the others
  are released.

## 13. Quality settings

### 13.1 Tiers (cost only; never composition, camera, colour or content)

| | low | mid | high |
|---|---|---|---|
| render scale (of the screen, DPR capped at 2) | 0.5 | 0.75 | 1.0 |
| reflection scale | 0.25 | 0.35 | 0.5 |
| grass density | 0.4 | 0.7 | 1.0 |
| shadow map | 1024 | 2048 | 2048 |
| bloom | off | on | on |
| leaf cards per tree | 50 % | 75 % | 100 % |

### 13.2 The governor
The old site's governor (refresh-aware, thresholds relative to the screen's frame time) picks the tier from measured
frame times, **not from "it is a phone"** (s02: the owner's phone holds 54–60 fps on high at the stops). Everything
starts on mid. During flights the governor may only change the render scale, in small steps (cheap). The heavier
settings (grass, shadows, leaf cards) change only while the camera rests, because switching them cost 128–287 ms
hitches on the phone.

### 13.3 WebGPU and WebGL2
WebGPU where the browser has it; WebGL2 otherwise (the owner's phone). Both paths are tested at every milestone; every
material is TSL so both get it.

### 13.4 The safety net: stills
If there is no WebGL2, or "save data" is on, or the governor on low still misses 30 fps for 5 s, the site switches to
**stills**: the nine renders (WebP, a landscape and a portrait version each) with light motion (slow drift, the
text), and flights become cross-fades. This needs portrait versions of the renders; they go into the one later render
round (D6), together with any camera view the world pass changed.

## 14. Budgets (D9 made concrete)

| What | Budget | Checked by |
|---|---|---|
| Name on screen | < 1 s on 10 Mbit/s | e2e (throttled) |
| First view (stage A of Golden, with code) | ≤ 1.6 MB; < 3 s on 10 Mbit/s | pack report + e2e (throttled) |
| New download per place | ≤ 3 MB | pack report (CI) |
| Whole night, everything | ≈ 20 MB (estimate) | pack report |
| JavaScript (gzip) | ≤ 400 KB (old site 330 KB; adds three's WebGPU build and the meshopt decoder) | size-limit (CI) |
| Each place complete after heading for it | < 5 s on 10 Mbit/s | e2e (throttled) |
| Draws per frame (with reflection) | ≤ 60 | census (CI) |
| Triangles per frame | ≤ 2.5 M mid, ≤ 3.5 M high | census (CI) |
| Shared materials | ≤ 14 | census (CI) |
| Frame rate, default tier | 60 at stops; ≥ 55 in flight, no frame over 50 ms | `npm run perf` on this laptop + the owner's phone |
| Shader hitch after the first view | none over 50 ms | `npm run perf` |

CI runners have no GPU, so CI checks bytes and counts. The census is the built site in headless Chrome (software
WebGL2), one frame at each stop, reading `renderer.info`. Frame rate is measured on this laptop in headed Chrome (real
Intel GPU, WebGPU) with per-frame counts, and on the owner's phone from the HUD, before each milestone is called done.

## 15. Look checks

`npm run compare` shoots each stop at 1920×1080 on high and puts it beside its render in an offline report (the
slice's `make_report.py` pattern). I give each place a % with likes and dislikes; the owner judges on the phone.

## 16. Text and content (after the scenes)

Until the scenes are done, each stop shows only its number, hour and place ("V · Night · The lagoon"). Proposal for
later (my call, not decided): I Golden = the name and one line; III Dusk = About; V Night = Projects (the lanterns,
already agreed); IX Sunrise = Contact; the other five are quiet places with only their label. The text system is the
old site's (HTML over the canvas, fades tied to scroll, focus glide, the project card). The text gets its own short
design once the nine scenes are approved.

## 17. Site, deploy, flags

- **Deploy:** GitHub Pages from the existing CI workflow. The old Moonsink site is frozen as a built copy at
  `/moonlit/` when the new one launches (D8).
- **Until launch:** all work happens on a `world` branch; the live site stays the old one. The owner sees builds on the
  phone over Wi-Fi (`vite --host`).
- **Flags:** `?stop=<id>` starts at a place; `?tier=low|mid|high|stills`; `?hud` shows fps, worst frame, draws,
  triangles, pack sizes, tier, and the slice's "render" overlay; `?only=<id>` loads one place for testing; `?webgl`
  forces WebGL2.
- **Unfinished places** show their render as a still, so the journey works end to end at every milestone.

## 18. Build order

Risk first. Each milestone ends with my % per place, speed numbers (laptop and phone), sizes, and the owner's verdict
on the phone. The text comes after all nine places (§16).

| | Milestone | Done when |
|---|---|---|
| M0 | **Foundation and the rough night.** The slice ported to TypeScript in the repo; journey with 9 stops and 8 flights; world base terrain, colour map, sea, nine skies with the two-sky blend, nine hour presets, stars and moon; places shown as stills; rail, links, HUD, bench, census, pack report, CI checks. | The whole 5.8 km flies at 60 fps on mid (laptop) and on the default (phone); load numbers measured; the land's seams seen in motion. |
| M1 | **World pass** (§6): organic masks, inland shape, colour map, distant dressing. | Flights read as natural land; the nine camera views unchanged (`raymap.py`); owner's verdict on the flights. |
| M2 | **The four unknowns, one view each:** aurora, sea of cloud, waterfall, cave inside. | Each has a % against its render and a measured cost; approach kept or changed before the full places. |
| M3 | **The cove's five places:** I Golden and II Sunset (from the slice), III Dusk (lanterns), VIII First light (mist), IX Sunrise (front-lit trees). | Each ≥ 85 % by my judgement and the owner's; budgets met. |
| M4 | **IV Blue hour:** flats, the arch overhead, scrub caps, plankton, dense stars. | same |
| M5 | **V Night:** crater, falls, aurora, fireflies, glowing reeds, project lanterns. | same |
| M6 | **VI Deep midnight:** ridge, sea of cloud, aurora, moon, lone tree, heather. | same |
| M7 | **VII Before dawn:** cave, wet floor, fungi, vines, the view out. | same |
| M8 | **The whole night, polished:** flights tuned by feel, fade-ins, prefetch, governor, portrait framings for all nine, stills (needs the D6 render round). | The full journey on laptop and phone meets every budget in §14. |
| M9 | Text and content (its own short design). | the owner approves |
| M10 | Launch: `/moonlit/` frozen, merge, deploy. | live, checked on the phone |

## 19. Risks

| Risk | What we do |
|---|---|
| Long flights cost too much (lots of land in view) | Flights fly high over base terrain only; detail and grass only near stops; measured in M0, before any detail exists. |
| The world pass changes an approved view | `raymap.py` before and after for all nine cameras; changed views go to the owner, then into the D6 render round. |
| The aurora or the sea of cloud looks fake live | M2 tests them first, one view each, against the render; a weak one gets a second approach before its place is built. |
| Tree cards fail front-lit at Sunrise | Bent normals first; denser cards at Sunrise second; a baked tree picture for far trees only. |
| Night places too dark or muddy on phones | Exposure and grade per hour preset, checked on the owner's phone at each night milestone. |
| Hitches on arrival from new shaders | One shared material set compiled once (§7 rule 3); the census fails CI above 14. |
| The repo grows with every asset rebuild | Generated files rebuilt on purpose only; the pack report shows size changes before a commit. |
| The phone's WebGL2 behaves differently from WebGPU | Both paths at every milestone; WebGL2 forced with `?webgl` on the laptop. |

## 20. My calls (for the owner to check) and proposed decisions

**Proposed decisions** (into DECISIONS.md when the owner says yes):
- **D11** Build order: the rough whole night first (M0), the world pass (M1), the four unknowns (M2), then the
  places; text after all nine scenes.
- **D12** The world pass: the ground formula is reshaped so the land holds up from the air; the nine views stay.
- **D13** One shared material set for the whole world; ≤ 60 draws and ≤ 14 materials, checked in CI.
- **D14** WebP for textures (amends D8's KTX2) until measurement says otherwise.

**My calls inside the design** (change any of them):
1. Scroll lengths: 1 screen per stop, 1–2.2 per flight; about 21 screens for the whole night (§8.1).
2. Long flights glide high (80–250 m); short ones stay low (§8.2).
3. Rail jumps and links fade to the place instead of flying the whole way (§8.4).
4. A tiny blurred Golden render behind the name at first paint (§12).
5. Glowing things light nothing for real; glow is bloom and baked light (§9.8).
6. Grass parting off on touch until fixed (§10).
7. coast.py moves into the repo as the world's source of truth (§11.2).
8. Every device starts on mid; the governor decides from there (§13.2).
9. Text proposal for later: I name, III About, V Projects, IX Contact, the others quiet (§16).

**Open, for later:** sound; hover targets at the places without text; the touch fix for grass parting.

## 21. Left to the builder

Exact waypoint positions, the noise parameters of the world pass, tile sizes inside the stated ranges, the dissolve
pattern, the HUD layout, file names inside the layout of §7, and the test structure, as long as the budgets of §14 and
the rules of §7 hold.
