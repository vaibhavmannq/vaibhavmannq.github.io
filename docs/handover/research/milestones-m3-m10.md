# Research for M3 to M10

Marks: **[read]**, **[search]**, **[mine]**: see `README.md`. Spec sections refer to
`docs/superpowers/specs/2026-11-10-realtime-world-design.md`. API patterns are in `threejs-r186-notes.md`.

**This is not a plan.** Each milestone still needs its own plan, written after M2's verdicts, because M2 decides
which techniques survive. What is here: what is already known, so the plan can be written without searching.

## Questions only the owner can answer (answer any time; each one unblocks a milestone)

| # | Question | Blocks |
|---|---|---|
| 1 | Which projects go on the lanterns? For each: name, one line, what you built, the hard part and how you solved it, link, picture. | M5 (how many lanterns), M9 |
| 2 | The "About" text: who you are, what you want next (job, internship, freelance), in your own words, even rough. | M9 |
| 3 | Contact: which links (email, GitHub, LinkedIn, others)? Is a public email address fine? | M9 |
| 4 | Is there an iPhone or iPad you can borrow for one test? Safari is a different engine and has never run this site. | M8 |
| 5 | Sound: yes, no, or later? (Spec §3 parks it. Aditya's site has it.) | M8 |
| 6 | A custom domain, or stay on `vaibhavmannq.github.io`? | M10 |
| 7 | Do you want to know how many people visit (a privacy-friendly counter), or nothing? | M10 |

## M3: the cove's five places (Golden, Sunset, Dusk lanterns, First light mist, Sunrise front-lit trees)

**Front-lit leaf cards (spec §9.7, the named risk).** The standard fix in games [search, Polycount threads]:
- Replace each card's normals with normals from a closed, smooth proxy shape around the crown (a sphere or a
  hull), so the crown shades as one volume.
- A full sphere makes the underside point down and go dark: use a half sphere stretched to a cone.
- A **partial** blend (some of the card's own normal kept) "maintains some of the contrast between groups" of
  leaves. A crown with 100 % sphere normals looks like a green ball.
- **Trap:** when the engine makes back faces for double-sided cards it flips the normal. Artists duplicate and
  flip faces themselves, or undo the flip in the shader. In three, a double-sided material flips the normal on
  back faces; with bent normals that must be undone (`faceDirection` in TSL [mine, confirm the name]).
- For trees scattered by instancing, the proxy centre must be per tree, not per batch.
- Sources: https://polycount.com/discussion/comment/1920066/ , https://forums.unrealengine.com/t/spherical-normals-for-trees-blender/98732
- Our plan (bend from the crown's centre) is this technique. The baking can happen in Blender's export (a
  Normal Edit modifier with a radial target [search]) so the shader pays nothing.

**First light's mist.** Three routes, cheapest first [mine, with the API from the r186 examples]:
1. Height fog: `exponentialHeightFogFactor( density, height )`, a built-in. No new draw. Try this first.
2. A few large soft sprites low over the water, drifting, in the shared glow or spray material.
3. A small ray-marched bank at low resolution: only if 1 and 2 fail the owner's eye.
Real dawn mist lies in a flat layer a metre or two deep and shows the far shore's top above it; the mirror
doubles it. Height fog gives exactly that layering.

**Dusk's floating lanterns.** Same instanced glow as §9.8. Real paper lanterns on water flicker slightly, drift
at different speeds and gather in loose groups; each has a warm mirror streak on the water [mine]. The streak
comes free where the lanterns are in the mirror pass.

**Wet sand, pebbles, grass:** proved in the slice; nothing new to research.

## M4: Blue hour (flats, arch overhead, plankton, dense stars)

**Plankton.** Real blooms [search: Kris Williams' real-time film, Wales; San Diego and Monterey coverage]:
- The glow is blue (blue light travels furthest in water) and appears **only where the water is disturbed**:
  breaking wave edges, footsteps, a hand. "Every step and splash lit up with a blue glow."
- Up close it is separate sparks, "like tiny stars" on the skin; in surf it is a sheet of light.
- So: no even glow over the flats. Sparks along ripple crests and around the feet of the stacks, brightening
  and dying over a second or two, plus a burst where the pointer touches the water (a natural hover response,
  spec §10). D2 forbids glowing-cyan water: sparks on dark water keep that rule.
- Links: https://petapixel.com/2018/07/06/photographer-captures-the-beauty-of-bioluminescent-plankton ,
  https://www.livescience.com/animals/watch-bioluminescent-algal-blooms-trigger-electric-blue-waves-off-san-diego-coast-in-stunning-new-footage

**Stars.** [search]
- Place stars by hashing a grid cell (one star per cell, position and brightness from the hash). Looping over a
  star list per pixel is the slow way (1 000 stars halved one project's frame rate).
- Real skies have many faint stars and few bright ones, and more cool (orange) than hot (blue) ones. Colour by
  temperature, size and brightness by magnitude.
- Twinkle: a per-star phase from the hash, a few percent of brightness, stronger near the horizon [mine].
- The Milky Way is a band of soft noise, or a picture.
- three's `webgpu_tsl_galaxy` is the nearest official TSL example.
- We already have a star layer from M0. This is for making it "dense" at Blue hour without cost: density is a
  cell-size change.

## M5: Night (crater, falls, aurora, fireflies, glowing reeds, project lanterns)

**Fireflies.** [search + the particles pattern in `threejs-r186-notes.md` 2.2]
- One instanced sprite draw; motion from noise in the vertex shader; glow from a radial falloff. No compute
  shader (WebGL2 phones). An existing GLSL project to read for motion ideas:
  https://github.com/thebenezer/threejs-fireflies
- A shipped TSL scene does all glow in the material with **no bloom pass** (per-instance colour, radial
  falloff, pulsing): https://discourse.threejs.org/t/interactive-3d-scene-built-with-three-js-webgpu-and-tsl/90492
  That is the model for the low tier, where bloom is off.
- Bloom traps: a low threshold makes everything glow; point materials have no emissive. The emissive-target
  bloom (notes 2.3) avoids both.
- Real fireflies [mine]: yellow-green, they blink (on about half a second, off for seconds), drift slowly and
  rise; a few dozen in view reads richer than hundreds. Each blinks on its own clock.

**Project lanterns.** The picker uses small invisible hit shapes (spec §10). The HTML twin per lantern is the
accessible route (see M9). The number of lanterns comes from owner question 1.

**Aurora and falls:** M2.

## M6: Deep midnight (ridge, cloud sea, aurora, moon, lone tree, heather)

- **The moon's disc is missing live** (s07 ledger). Fix before judging anything here: the cloud's "moon road"
  (see `m2-references.md`) needs a visible moon to make sense.
- **Moon size [mine]:** the real moon is half a degree across. At our 24 mm lens that is tiny. Photographers and
  games draw it 2–4× larger; the render's size is the guide.
- Heather and the lone tree are the grass and tree systems with new placements. Heather in flower is a low,
  dense purple-pink mat; under moonlight it goes grey-violet [mine].
- Cloud sea: M2.

## M7: Before dawn (cave, wet floor, fungi, vines, the view out)

- Vines are hanging cards: use an alpha cut, not blending (notes §4). D5 lists "square vine leaves" as a known
  flaw of the render: the live vines need a leaf-shaped cut-out.
- Light shafts from the mouth exist as official examples (`webgpu_postprocessing_godrays`,
  `webgpu_volume_lighting`) but cost a ray march. Cheaper [mine]: two or three fixed additive cones from the
  mouth, faded by view angle. Offer as an option only if the owner misses "air" in the cave.
- Cave and fungi: M2.

## M8: the whole night, polished

**Scroll and touch (Lenis; we are on 1.3.26, the current one is 1.3.27)** [read, Lenis README]
- `syncTouch` (default false): "mimic touch device scroll while allowing scroll sync (can be unstable on
  iOS < 16)". `syncTouchLerp` 0.075, `touchInertiaExponent` 1.7, `touchMultiplier` 1.
- Lenis does **not** work with CSS scroll-snap; snapping needs its own `lenis/snap` package (options not in the
  README: read the package before using it). Our touch settle from the old site may already cover this.
- Safari caps Lenis at 60 fps, and 30 fps in low-power mode. `position: fixed` lags on older Mac Safari.
- `respectReducedMotion` (default true): smoothing off and programmatic scrolls instant; `lenis.prefersReducedMotion`
  can be read for our own flights (spec §8.5).
- `anchors: true` is needed for `/#night` links to scroll while Lenis runs.
- One community template says to skip Lenis on touch devices entirely [search]. It conflicts with the README;
  test on the phone, do not assume.

**Browser reach** [search; figures conflict, check caniuse.com/webgpu on the day]
- WebGPU: Chrome and Edge desktop since 113; Chrome on Android 12+ since 121; Safari 26 on iOS, iPadOS and
  macOS 26; Firefox on Windows since 141 and on Apple-silicon Macs since 145; Firefox on Android, Linux and
  Intel Macs still in progress. Roughly 76–85 % of users.
- So the WebGL2 path is still a real path, and Safari is the untested engine (owner question 4).

**Things to add to the polish list** (from `threejs-r186-notes.md` §4): `onDeviceLost`; `Timer`; preload links for
stage A; half-size bloom for low; `reversedDepthBuffer` if far surfaces flicker; the three.js upgrade decision.

**Stills fallback** needs the D6 render round (portrait versions). That round should also carry whatever M3–M7
changed. Queue it early in M8: it depends on a friend's GPU.

## M9: text and content

**What the page must say** [search; practitioner blogs, not data, so treat as advice]
- A reader gives a portfolio seconds. Name, what you do, and what you want must be readable at once (spec:
  the name is on screen in under 1 s; add the one line).
- Three to five projects. One solid case study beats five shallow ones. Tutorial clones (to-do, weather) count
  against.
- Per project: a title and a one or two sentence summary; the stack, short; then "the goal, the constraint, the
  ugly middle where things broke, and the fix". Outcomes with numbers where they exist.
- For a first portfolio, readers look for potential and for evidence of learning, not for years.

**The strongest project is this site [mine].** It has what the advice asks for and most portfolios lack:
measured numbers (first view 2.6 s, 3 MB a place, 60 fps on a phone), a decision log (D1–D20), things that
broke and how they were fixed. One lantern should be "How this world was built", written from the handover
notes. Say plainly that it was built with an AI assistant and what the owner did and learned: readers ask, and
an honest answer is a strength.

**Accessibility and search** [search: three.js forum, Codrops case studies]
- Text inside a canvas is invisible to screen readers and to search engines. All words stay in HTML over the
  canvas (already the design). The page must read sensibly with the canvas removed.
- Every 3D target has an HTML twin button (spec §10). The rail is a list of links.
- `@axe-core/playwright` is already a dev dependency: add an e2e check per stop.
- For sharing and search [mine]: a real `<title>` and description, Open Graph tags with a 1200×630 picture (the
  Golden or Night render), `Person` structured data, a `<noscript>` block with the full text.

## M10: launch

**GitHub Pages** [search: GitHub's limits page]
- Published site ≤ 1 GB; soft limit 100 GB of traffic a month; a deploy times out at 10 minutes; source
  repositories are "recommended" to stay under 1 GB; pushes with a file over 100 MB are blocked.
- Response headers cannot be set. Pages caches for 10 minutes (seen in s06). So: hashed file names for every
  asset (Vite does this for code; the world packs carry a hash in the manifest, spec §11.3), and the HTML stays
  small because it is re-fetched.
- Capacity: about 20 MB for a full night → about 5 000 full visits a month inside the soft limit. Enough.

**The old site at `/moonlit/`** [mine]: build the old site once with Vite's `base: '/moonlit/'`, commit the built
copy under `public/moonlit/` (or copy it in the deploy job), and check its absolute links and its service of
fonts. Test the copy locally with `vite preview` before the merge.

**Launch checks [mine]:** the throttled e2e (name < 1 s, first view < 3 s); the phone over USB on WebGPU and
WebGL2; one Safari device; links to every place (`/#night`); the 404 page; the Open Graph preview in a chat
app; reduce-motion on; save-data on (stills).

## Sources

- Polycount, foliage normals: https://polycount.com/discussion/comment/1920066/
- Lenis README: https://github.com/darkroomengineering/lenis
- GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- WebGPU implementation status: https://github.com/gpuweb/gpuweb/wiki/Implementation-Status
- three.js forum, accessibility for 3D sites: https://discourse.threejs.org/t/accessibility-for-3d-websites/87092
- 14islands, progressive enhancement with WebGL: https://14islands.com/blog/progressive-enhancement-with-webgl-and-react
- Portfolio advice: https://arslandg.substack.com/p/3-portfolio-projects-that-actually ,
  https://www.fueler.io/blog/your-portfolio-has-7-seconds-what-recruiters-look-at-first
