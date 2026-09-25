# Handover — Moonsink Shore

Written 2026-09-25. Everything a new session needs to pick this up without re-deriving it. Read this first,
then the master spec (`docs/superpowers/specs/2026-09-13-moonlit-portfolio-design.md`) for the detail.

---

## 1. What this is

The owner's first personal portfolio, and the portfolio's first project is the portfolio itself: a scroll
journey across a moonlit sea, rendered live in WebGPU (WebGL2 fallback), with real HTML text layered over
the canvas. Four pages, one scene, one moon.

- **Live:** https://vaibhavmannq.github.io/ — GitHub Pages, user site, repo `vaibhavmannq/vaibhavmannq.github.io`
- **Local:** `V:\Pdf\Project\my-portfolio`
- **Deploy:** pushing `main` deploys. **Always ask the owner before pushing.**
- **Owner:** learning to build this, wants to understand the code, judges everything by feel.

The journey, in order:

| Page | Scroll | On screen | Camera |
|---|---|---|---|
| 1 · Adrift | 0 – 1.4 screens | the name (Fraunces), a tagline | drifting on the open sea |
| 2 · The shore | 1.4 – 2.8 | About, in prose | arriving at the black-sand shore (lands at 2.7) |
| 3 · What washed ashore | 2.8 – 4.2 | Projects — this site as project #1, opens a dialog | walking sideways along the waterline (ends at 4.1) |
| 4 · The water's edge | 4.2 – 5.6 | "Hola Amigo", email, GitHub, LinkedIn, Return to the shore | stepping toward the sea and crouching |

Before it: a black opening reading "Hello, voyager" that leaves by itself once the scene is ready.

---

## 2. Working agreement with the owner (this matters more than the code)

1. **Show options running, never as screenshots.** This was learned the hard way on 2026-09-25: a batch of
   polish was built in one sweep and presented as renders, and the owner rejected all of it — "honestly
   every change you made is awful, please revert". They judge by feel and in motion. Every look-and-feel
   choice since has been put in front of them **running behind a switch on a real build served to their
   phone** (`?open=a|b|c|d`, a face/ink bar, and so on), and only then committed. Keep doing that.
2. **Never push without asking.** Pushing `main` publishes.
3. **No attribution trailers in commits** — no `Co-Authored-By`, no "Generated with", no session lines.
4. **Claude writes the code**, and every change gets a plain-language walkthrough of what changed and why.
5. **Be blunt.** If the owner is wrong, say so with evidence. If something cannot be verified from this
   machine (a phone, Safari on a Mac), say that plainly rather than implying it was checked. This laptop does
   have a GPU (see §7): only the headless test browsers render in software.
6. **Measure before fixing.** When the owner says something "blinks" or "pops", find out what actually
   changes on screen — pixel diffs, frame traces, computed styles — and show the number. Two of the last
   three fixes were only possible because the cause was measured first, and one earlier "fix" failed
   precisely because it was a guess.
7. The game term "Tacet" never appears on the site, and no Wuthering Waves assets are used. The look is
   *inspired by* that game's night moods; everything is original.

---

## 3. Running it

```bash
npm run dev          # Vite dev server on :5173 (add -- --host for the owner's phone)
npm run build        # tsc --noEmit ×2, then vite build   → dist/
npm run preview      # serves dist/ on :4173 (add --host for the phone)
npm test             # Vitest unit tests (157)
npm run e2e          # Playwright, 3 browsers, against a production build (89)
npm run check        # Biome
npm run format       # Biome --write
npm run size         # size-limit: 330 kB budget, currently ~293 kB gzipped
```

**Judge anything about first paint, the opening, or fonts on `npm run preview`, never on the dev server.**
Vite injects CSS through JavaScript in dev, so the dev page paints about 14 frames — roughly 640 ms — with
no stylesheet at all, showing unstyled text before the black opening even exists. The built site never does
this. Measured 2026-09-25.

### Query hooks (`src/app/params.ts`, spec §12.2)

| Hook | Does |
|---|---|
| `?p=0.65` | pin scroll progress (0..1) and skip the opening — how every page is inspected |
| `?stills` | no WebGL: show the pre-rendered JPEGs in `public/stills/` — fast, deterministic, used by most e2e |
| `?tier=0..4` | pin the quality tier and disable the governor |
| `?moon=0..1` | pin the lunar phase (0.5 = full) instead of tonight's real one |
| `?time=12` | pin the scene clock, so waves and motes are identical between runs |
| `?length=2.5` | Moonsink's scroll length in screen heights, for tuning by feel |
| `?hold=600000` | keep the opening up (tests act while the greeting is on screen) |
| `?hud` / `?gui` | frame-rate HUD (now with the measured display refresh) / dev controls |
| `?pace=full` | render every vsync instead of an even divisor near 60 fps. Owner-review switch, removed at the end of plan 2 |
| `?march=old` | the sea's ray march before the bounding plane (S39). Owner-review switch, removed at the end of plan 2 |
| `?glints=old` | sand glints strongest at the camera, as before (S39). Owner-review switch, removed at the end of plan 2 |
| `?frame=old` | no frame fit for windows wider than 16:9 (S46). Owner-review switch, removed at the end of plan 2 |

`window.__moonlit` exposes `tier()`, `frames()`, `progress()`, `section()`, `reducedMotion()` for probes.

---

## 4. The code, file by file

```
src/
  main.ts                  entry; catches boot failure → html.is-broken fallback
  app/
    boot.ts                wires everything: renderer, region, scroll, sections, gate, opening,
                           projects, governor, stills fallback. The one big file — read it first.
    capabilities.ts        device hints (pointer, memory, save-data, reduced motion)
    loop.ts                the single rAF loop: 60 fps cap, 30 fps idle, paused when hidden
    frameRate.ts           frame interval helpers
    params.ts              the query hooks above
    debug.ts               window.__moonlit
  journey/
    journey.config.ts      LENGTH 5.6, four pages of 1.4 screens each, camera anchors
    timeline.ts            resolve(p) → which region, which section, region-local position
    types.ts               Segment, SectionAnchor, JourneyState
  overlay/                 everything that is HTML rather than pixels
    gate.ts                loading → ready → entered
    opening.ts             the black greeting; min hold 2.2 s; leaves on tap/scroll/key
    sections.ts            THE HANDOVER: opacity, offset and text motion from scroll position
    sectionMotion.ts       one paused GSAP timeline per chapter, positioned by the handover
    nameMotion.ts          the name split into masked letters; its one-shot rise
    pointerTouch.ts        the name's letters swell toward the pointer. Nothing else moves.
    projectList.ts         builds the project list from content/projects.ts
    projectDialog.ts       native <dialog>, focus handling
    router.ts              #/projects/:slug deep links
    voyageLog.ts           the top-left log: date, time, tonight's moon
  quality/
    tiers.ts               the five tiers (render scale, march steps, bloom) and the boot guess
    governor.ts            measures frame intervals, steps tiers, latched ceiling, settle window
  regions/moonsink/
    sea.ts                 the TSL sea shader: ray march, night sky, moon, foam
    nightSky.ts            star layers, milky band, nebula positions
    moonDirection.ts       where the moon sits
    moonPhase.ts           tonight's real phase (mean synodic approximation)
    cameraPath.ts          the keyframed camera and its damped follow
    index.ts               the region: build, update, applyTier, resize, dispose
  render/renderer.ts       WebGPURenderer + RenderPipeline, bloom, warm-up
  scroll/
    scroll.ts              Lenis wheel smoothing; native touch; glideToProgress
    touchSnap.ts           where a flick should land, and the eased glide
    activity.ts            "is the visitor scrolling right now"
    progress.ts            scroll → 0..1
  shared/math.ts           clamp01, lerp, smoothstep, damp
  styles/base.css          type variables, @font-face for Satoshi, resets
  styles/overlay.css       everything the text layer looks like
```

---

## 5. The rules that hold this together

These are the ones that get broken by accident. Each is in the spec with its reason.

1. **The moon and the sky never move.** One fixed camera yaw (0) and pitch (−0.06) for the whole journey;
   only the waves and the camera's position change (§17 S27). The owner asked for this explicitly.
2. **Text position is a pure function of scroll** — no timers, no `element.animate()`, no CSS transitions on
   scroll-driven properties (§5.4a). Since 2026-09-25 the text *travels* toward that scroll-derived target
   with a damped follow (`CATCH_UP` in `sections.ts`), which is still not a clock: the target comes only
   from scroll, and scrolling backwards reverses it exactly.
3. **The handover is sequential.** The outgoing text finishes leaving before the incoming text starts, with
   a gap where only the scene shows. Two texts never share the screen (§5.4a).
4. **One focal point per screen; text never crosses the moon or its path** (§3.4). Contrast is checked at
   full moon, which is the worst case for light text.
5. **Tiers change cost only** — render scale and march steps — never composition, camera, content, timing or
   palette (§5.6). Wave iterations are constant at 6.
6. **A tier change is visible, so it is rationed.** Never mid-scroll; never back to a tier that proved too
   slow; step ups only in the first 20 s (§5.6, §17 S36).
7. **Nothing of the journey appears until the black opening has gone** (§17 S37). There is a test that reads
   both timings.
8. **Every page is worth the same scrolling:** 1.4 screens (§3.1).

---

## 6. Type and look, as of today

- **Satoshi** (self-hosted, `public/fonts/satoshi-{300,400,500}.woff2`) for headings, reading text, the
  project title and the contact links, set tight: −0.03em headings, −0.011em body.
- **Fraunces** for exactly two things: the name on page one, and the opening's greeting with its italic
  second line. It is the only serif on the site, which is what makes the name read as a signature.
- **Space Mono** for the log's voice: chapter titles, the voyage log, the small labels, in glow blue.
- **No italics** anywhere else; a stressed line goes lighter and tighter instead.
- Contact values use the softer ink (`--ink-dim`), which the owner chose over full white.
- The opening: black lifts 0.4 – 2.0 s, the journey's text arrives 2.0 – 2.8 s. No overlap, by choice.

---

## 7. Traps this project has already fallen into

- **The dev server lies about first paint** (see §3). Use a built preview.
- **Playwright reuses an existing server on :4173.** If a preview server from another branch is already
  running, the whole suite silently tests stale code. Kill it before running tests.
- **`git checkout <branch>` carries uncommitted work across branches.** This has bitten twice. Commit or
  stash scratch work before switching.
- **GSAP `SplitText` sets `display: inline-block` on every letter**, and a browser then reads a split link
  one letter at a time ("M o o n l i t"). Never run SplitText over an interactive element's own text.
- **GSAP's fast-path setter silently ignores CSS custom properties** — tweening `--w` with `quickTo` on a
  non-element target does nothing. Write the variable and let a CSS transition ease it, or use `gsap.to`.
- **Stills mode has its own frame loop** in `boot.ts`. Anything the 3D loop is given per frame must be given
  to that loop too, or `?stills` (which most probes and tests use) will not exercise it.
- **A second font CDN made a WebKit scroll test flake** under load. Fonts are self-hosted now; keep them so.
- **Frame sampling under the headless browsers' software renderer is too coarse** for millisecond questions. For
  anything about CSS timing, read the computed `transitionDelay`/`transitionDuration` instead — deterministic.
- **This laptop has a real GPU:** an Intel UHD (Gen12), and the headed Playwright MCP browser gets WebGPU on it.
  Use it for performance numbers, and count rendered frames over whole seconds (`__moonlit.frames()`). Timing a
  burst of renders with `onSubmittedWorkDone` gave bogus numbers.
- **Chrome throttles an obscured window's animation frames to about one a second.** Bring the MCP browser to the
  front (`page.bringToFront()`) before measuring anything about frames (S38).
- **WebKit can run boot before the stylesheet has sized an element**, which then measures 0. Anything read from
  layout at boot must survive a zero size and re-measure (`ResizeObserver`) (S46).
- **Long bash heredocs fail to parse here.** Write a Python or Node patch script to a file and run it.
- **`fwidth` is illegal inside the sea's march-dependent branch**; the pixel angle is measured from the next
  pixel's ray instead (§17).
- **TSL `setLayout()` functions must be pure** — uniforms are parameters, never read inside (§17 S2).

---

## 8. Testing

- **Unit (Vitest, 157):** the pure things — handover maths, journey config, governor, tiers, camera path,
  moon phase, router, params, night sky layout.
- **E2E (Playwright, 89, three browsers):** against a **production build** on :4173. Most use `?stills` so
  they do not wait on a software GPU.
  - `gate.spec.ts` — the opening: it leaves, keyboard and tap start it, focus behaviour, **the ordering
    test** (text may not start before the black is gone) and **the greeting keeps Fraunces**.
  - `sections.spec.ts` — the sequential handover at pinned scroll positions.
  - `touchSnap.spec.ts` — a flick lands on a page, never in a gap. Its `swipeTo` waits for the page's own
    progress to catch up before lifting the finger; without that it raced and flaked on WebKit.
  - `a11y.spec.ts` — axe on each page and the dialog, plus **contrast measured from rendered pixels** at
    full moon on a phone (and on a laptop for the centred case), with the text made transparent so the
    helper reads what is actually behind the glyphs (`helpers.ts`).
  - `projects.spec.ts`, `contact.spec.ts`, `redesign.spec.ts`, `smoke.spec.ts`, `reduced-motion.spec.ts`.
- **Budget:** `.size-limit.json`, 330 kB gzipped, currently ~293 kB.
- CI (`.github/workflows/ci.yml`) runs check + build + tests, then deploys `main` to Pages.

---

## 9. Where the decisions are written down

| Document | Covers |
|---|---|
| `specs/2026-09-13-moonlit-portfolio-design.md` | the master spec: goals, architecture, LLD, performance, a11y, CI. **§17 is the change log — every decision since, numbered S1…S37** |
| `specs/2026-09-14-journey-flow-design.md` | the scroll feel: handover, camera follow, touch snap, the black opening |
| `specs/2026-09-21-projects-page-design.md` | Projects on the shore, the dialog, deep links |
| `specs/2026-09-21-contact-page-design.md` | Contact at the water's edge |
| `specs/2026-09-22-redesign-design.md` | chapters, the voyage log, the type system that Satoshi later replaced |
| `specs/2026-09-25-opening-type-and-quality.md` | the opening's hand-over, Satoshi, the blinking scene, equal pages, the end of the pull |

---

## 10. State right now

Updated 2026-09-26.

- `main` = `c834e4c`; the live site is older (`b3af23e`). Nothing has been pushed since.
- Branch **`waxing-voyage`** holds:
  - the spec `specs/2026-09-25-waxing-voyage-design.md`;
  - plan 1 of 2 (`plans/2026-09-25-smooth-and-steady.md`), fully built: frame pacing that follows the display
    (S38), the faster ray march (S39), one page at a time (S44), heading masks that no longer clip (S45), and
    the frame fit for windows (S46).
- Owner-review switches still in place: `?pace=full`, `?march=old`, `?glints=old`, `?frame=old`. Plan 2's
  last task removes the losing sides.
- **Next:** plan 2, the waxing voyage itself: the moon waxes with the scroll, the camera lands up the beach,
  opening E, the header and chapter rail, local fonts, the project card and case study. The approved
  storyboard is https://claude.ai/artifact/QCL4tADM3udn13qavw7cZV (page "Storyboard").
- **Never push without the owner saying so.**

## 11. Open work, roughly in the order it matters

1. **Screen-reader pass** with NVDA (the owner agreed to this a while back and it keeps slipping). Includes
   a script to follow: the opening, skip link, chapter titles, the project dialog, the contact links.
2. **Link previews**: Open Graph image and JSON-LD, so sharing the site shows the moon rather than nothing
   (spec §11).
3. **A second project.** The list and dialog are data-driven — add to `src/content/projects.ts`. Nothing
   else needs touching, and new projects inherit the no-pull behaviour automatically.
4. **Sound**, if ever: it was always phase 6 and has never been started.
5. Deferred, still valid: sections clickable at their anchor rather than at full visibility (review M5).
