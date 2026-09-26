# Handover — Moonsink Shore

Written 2026-09-25, updated 2026-09-26 after the waxing voyage. Everything a new session needs to pick this up without re-deriving it. Read this first,
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

| Page | Scroll | On screen | Moon (S40) | Camera |
|---|---|---|---|---|
| 1 · Adrift | 0 – 1.4 screens | the name (Fraunces), a tagline, "See the work" | 0.08, a crescent | drifting on the open sea |
| 2 · The shore | 1.4 – 2.8 | About, in two paragraphs | 0.25, first quarter | up the beach: lands at 2.0 (S41) |
| 3 · What washed ashore | 2.8 – 4.2 | Projects — a card with a cover, opens the case study | 0.375, gibbous | walking sideways along the sand (ends at 4.1) |
| 4 · The water's edge | 4.2 – 5.6 | "Over to you" (Fraunces italic), email, GitHub, LinkedIn, Return to the shore | 0.5, full | stepping toward the sea and crouching |

The moon waxes with the scroll, reaching each phase where its page is fully shown. There is no opening any more
(S42): the HTML is the first paint, the sea fades up under the name, and the page settles (header, rail of four
moons, "Hello, voyager" scrambling into "I · Adrift") 1.2 s in, or by 3 s if the sea is still compiling.

---

## 2. Working agreement with the owner (this matters more than the code)

1. **Show options running, never as screenshots.** This was learned the hard way on 2026-09-25: a batch of
   polish was built in one sweep and presented as renders, and the owner rejected all of it — "honestly
   every change you made is awful, please revert". They judge by feel and in motion. Every look-and-feel
   choice since has been put in front of them **running behind a switch on a real build served to their
   phone** (`?open=a|b|c|d`, a face/ink bar, and so on), and only then committed. Keep doing that.
2. **Never push without asking.** Pushing `main` publishes. Serve review builds to the phone from a frozen copy
   (`.superpowers/review-dist` on :4175), so running the test suite never kills the owner's link.
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
npm test             # Vitest unit tests (209)
npm run e2e          # Playwright, 3 browsers, against a production build (186, 19 of them skipped by design)
npm run check        # Biome
npm run format       # Biome --write
npm run size         # size-limit: 330 kB budget, currently ~295 kB gzipped
npm run capture      # re-render the stills, the cover, the tier comparison and the voyage clip from the real scene
                     # (headed Chromium, :4180, ffmpeg on the PATH; name parts to render only those: capture clip)
```

The npm shim in PowerShell drops `--host`: for the phone run `npx vite preview --port 4175 --strictPort --host`.

**Judge anything about first paint or fonts on a built preview, never on the dev server.** Vite injects CSS
through JavaScript in dev, so the dev page paints about 14 frames — roughly 640 ms — with no stylesheet at all.
The built site never does this. Measured 2026-09-25.

### Query hooks (`src/app/params.ts`, spec §12.2)

| Hook | Does |
|---|---|
| `?p=0.65` | pin scroll progress (0..1) — how every page is inspected |
| `?stills` | no WebGL: show the pre-rendered JPEGs in `public/stills/` — fast, deterministic, used by most e2e |
| `?tier=0..4` | pin the quality tier and disable the governor |
| `?moon=0..1` | pin the moon's phase (0.5 = full) instead of the one the scroll gives |
| `?time=12` | pin the scene clock, so waves and motes are identical between runs |
| `?length=2.5` | Moonsink's scroll length in screen heights, for tuning by feel |
| `?bare` | hide the text layer: the scene alone, for `npm run capture` |
| `?hud` / `?gui` | frame-rate HUD (with the measured display refresh) / dev controls |

The owner-review switches of plan 2 (`?pace`, `?march`, `?glints`, `?frame`, `?snap`) are gone: the owner kept
every new side, and mouse-wheel snapping was never picked, so wheels do not snap.

`window.__moonlit` exposes `tier()`, `frames()`, `progress()`, `section()`, `reducedMotion()` for probes.

---

## 4. The code, file by file

```
src/
  main.ts                  entry; catches boot failure → html.is-broken fallback
  app/
    boot.ts                wires everything: renderer, region, scroll, sections, welcome, header, rail,
                           projects, governor, the waking and stills loops. The one big file — read it first.
    capabilities.ts        device hints (pointer, memory, save-data, reduced motion)
    loop.ts                the single rAF loop: asks the pacer which frames render; text-only while it measures
    refresh.ts             THE PACER: measures the screen quietly, renders every Nth vsync near 60 fps (S38, S47)
    frameRate.ts           frame interval helpers
    params.ts              the query hooks above
    debug.ts               window.__moonlit
  content/projects.ts      the projects: copy, cover, the hard part, the number, the clip and comparison
  journey/
    journey.config.ts      LENGTH 5.6, four pages of 1.4 screens each, the landing at 2.0
    journeyMoon.ts         the moon's phase from scroll: 0.08 → 0.5 (S40)
    timeline.ts            resolve(p) → which region, which section, region-local position
    types.ts               Segment, SectionAnchor, JourneyState
  overlay/                 everything that is HTML rather than pixels
    welcome.ts             opening E: the sea fades up; the page settles at 1.2 s, by 3 s at the latest
    sections.ts            THE HANDOVER: one shown page at a time (S44), opacity and offset from scroll
    sectionMotion.ts       one paused GSAP timeline per chapter, positioned by the handover
    nameMotion.ts          the name split into masked letters
    frame.ts               the laptop text zoom (83%) and inset, the same in a window and full screen (S49, S50)
    header.ts              the data-go links, and the header naming the page you are on
    chapterRail.ts         the four moon glyphs on the right
    focusGlide.ts          focus in a page that is not fully shown glides to it
    pointerTouch.ts        the name's letters swell toward the pointer. Nothing else moves.
    projectList.ts         builds the storyboard's project card from content/projects.ts
    projectDialog.ts       native <dialog>: the case study (picture, hard part, number)
    router.ts              #/projects/:slug deep links
    voyageLog.ts           the top-left log: date, time, the moon the scene shows
  quality/
    tiers.ts               the five tiers (render scale, march steps, bloom) and the boot guess
    governor.ts            measures frame intervals, steps tiers, latched ceiling, settle window
  regions/moonsink/
    sea.ts                 the TSL sea shader: ray march, night sky, moon, foam
    nightSky.ts            star layers, milky band, nebula positions
    moonDirection.ts       where the moon sits
    moonPhase.ts           phase maths: how much light a phase gives
    surfaceTop.ts          the highest surface ahead of the camera, where the ray march starts (S39)
    cameraPath.ts          the keyframed camera and its damped follow (it lands on the first frame)
    index.ts               the region: build, update, applyTier, resize, dispose
  render/renderer.ts       WebGPURenderer + RenderPipeline, bloom, warm-up
  scroll/
    scroll.ts              Lenis wheel smoothing; native touch; glideToProgress
    touchSnap.ts           where a flick should land, and the eased glide
    activity.ts            "is the visitor scrolling right now"
    progress.ts            scroll → 0..1
  shared/math.ts           clamp01, lerp, smoothstep, damp
  styles/base.css          type variables, @font-face for Satoshi, Fraunces and Space Mono (all local), resets
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
3. **The handover is sequential and exclusive.** The outgoing text finishes leaving before the incoming text
   starts, with a gap where only the scene shows. However fast the scroll, one page is shown at a time: on a
   jump the shown one leaves in about 0.25 s before the next arrives (§5.4a, §17 S44).
4. **One focal point per screen; text never crosses the moon or its path** (§3.4). Contrast is checked at
   full moon, which is the worst case for light text.
5. **Tiers change cost only** — render scale and march steps — never composition, camera, content, timing or
   palette (§5.6). Wave iterations are constant at 6.
6. **A tier change is visible, so it is rationed.** Never mid-scroll; never back to a tier that proved too
   slow; step ups only in the first 20 s (§5.6, §17 S36).
7. **The name is the first paint, and nothing waits for the sea** (§17 S42). Text moves from the first frame
   (the waking loop), the scroll is never locked, and the page settles by 3 s whatever the GPU is doing.
8. **Every page is worth the same scrolling:** 1.4 screens (§3.1).
9. **Nothing focused is ever invisible** (§17 S43): focus glides to a page until it is fully shown, and the
   header and rail show at once if a link in them takes focus before the page settles.
10. **The pacer never measures while it renders** (§17 S47): a slow GPU delays the next animation frame, so
    frames timed while rendering measure the GPU, not the screen.
11. **A window and full screen draw the text the same** (§17 S49, S50): on a laptop its size and place depend on
    the width alone: an 83% zoom, 5.8% of the width in from the edge.
12. **Shade only where the text is** (§17 S48, S50): each page's `.scrim` fades with its page, so the sand the
    journey lands on shines. The contrast tests measure every page at full moon on a phone and a laptop.

---

## 6. Type and look, as of today

- **Satoshi** (self-hosted, `public/fonts/satoshi-{300,400,500}.woff2`) for headings, reading text, the
  project title and the contact links, set tight: −0.03em headings, −0.011em body.
- **Fraunces** for the name on page one, and in italic for page IV's closing heading (S51). It is the only serif on
  the site, so the journey opens and closes in the same hand.
- **Space Mono** for the log's voice: chapter titles, the voyage log, the small labels, in glow blue.
- **No italics** anywhere else; a stressed line goes lighter and tighter instead.
- Contact values use the softer ink (`--ink-dim`), which the owner chose over full white.
- The opening (E): the intro text is there at first paint; the sea fades up under it once compiled; at 1.2 s
  (or when the sea is ready, by 3 s at the latest) the header and rail fade in and "Hello, voyager" scrambles
  into "I · Adrift". On a phone the intro shows "See the work" but hides the email, which pushed the name onto
  the glitter (2.28:1 contrast).
- Big headings keep a 20 px halo; their masks leave room for it and for descenders (S45).
- The storyboard (canvas https://claude.ai/artifact/QCL4tADM3udn13qavw7cZV, page Storyboard) is where the header,
  the project card, the case study and the per-page shading came from; the owner kept the live site's margins,
  sizes and copy over it (S48–S52). `tests/e2e/storyboard.spec.ts` pins what was kept.

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

- **Unit (Vitest, 209):** the pure things — handover maths, journey config, the journey moon, governor,
  tiers, camera path, the pacer (`refresh.test.ts`) and **the pacer and governor wired together against a
  simulated screen and GPU** (`refreshSimulation.test.ts`: free GPUs at 60–165 Hz, a GPU that cannot keep up,
  a screen that changes rate mid-visit), router, params, night sky layout.
- **E2E (Playwright, 186, 19 of them skipped by design, three browsers):** against a **production build** on :4173. Most use `?stills` so
  they do not wait on a software GPU.
  - `opening.spec.ts` — opening E: the first paint with no JavaScript, it settles, it settles by 3 s even when
    the GPU never answers (an init script hangs `navigator.gpu`), and the text hands over while the sea wakes.
  - `navigation.spec.ts`, `focus.spec.ts` — the header, the rail, and every Tab stop visible once glided to.
  - `frame.spec.ts` — the same composition in a window and full screen, under 1.5% drift.
  - `fonts.spec.ts` — no font request leaves the site.
  - `sections.spec.ts` — the sequential handover at pinned scroll positions, and fast scrolls never stack.
  - `touchSnap.spec.ts` — a flick lands on a page, never in a gap. Its `swipeTo` waits for the page's own
    progress to catch up before lifting the finger; without that it raced and flaked on WebKit.
  - `a11y.spec.ts` — axe on each page and the dialog, plus **contrast measured from rendered pixels** at
    full moon on a phone (and on a laptop for the centred case), with the text made transparent so the
    helper reads what is actually behind the glyphs (`helpers.ts`).
  - `projects.spec.ts`, `contact.spec.ts`, `redesign.spec.ts`, `smoke.spec.ts`, `reduced-motion.spec.ts`.
- **Budget:** `.size-limit.json`, 330 kB gzipped, currently ~295 kB.
- CI (`.github/workflows/ci.yml`) runs check + build + tests, then deploys `main` to Pages.

---

## 9. Where the decisions are written down

| Document | Covers |
|---|---|
| `specs/2026-09-13-moonlit-portfolio-design.md` | the master spec: goals, architecture, LLD, performance, a11y, CI. **§17 is the change log — every decision since, numbered S1…S52** |
| `specs/2026-09-14-journey-flow-design.md` | the scroll feel: handover, camera follow, touch snap, the black opening |
| `specs/2026-09-21-projects-page-design.md` | Projects on the shore, the dialog, deep links |
| `specs/2026-09-21-contact-page-design.md` | Contact at the water's edge |
| `specs/2026-09-22-redesign-design.md` | chapters, the voyage log, the type system that Satoshi later replaced |
| `specs/2026-09-25-opening-type-and-quality.md` | the old opening's hand-over, Satoshi, the blinking scene, equal pages, the end of the pull |
| `specs/2026-09-25-waxing-voyage-design.md` | the waxing moon, the beach landing, opening E, header and rail, frame pacing, the faster sea, the case study (S38–S47) |

---

## 10. State right now

Updated 2026-09-26.

- The waxing voyage is built, reviewed and live: both plans (`plans/2026-09-25-smooth-and-steady.md`,
  `plans/2026-09-26-the-waxing-voyage.md`) are done, merged into `main` and pushed on 2026-09-26 at the
  owner's request.
- The owner reviewed it on their phone and laptop: "everything is perfect". Their two faults (the case study
  would not scroll on a phone; a dark shadow on "See the work") are fixed.
- An independent final review found one critical and four important issues (S47 and the I1–I3 lines of S42 and
  S43), all fixed test-first.
- Then the owner asked whether the site was truly the storyboard. It was not (S48): the sand was hidden under a
  dark floor, and the card, header, margins, hint, phone header and case study had drifted. Branch
  **`storyboard-match`** rebuilt all of it, and the owner picked what to keep (S49, S50): the header naming the
  page, the project card in a sideways row, the case study, the smaller glints and the lighter shading around the
  sand; the laptop text 110 px in at an 83% zoom, the same in a window and full screen. Two "Coming soon"
  cards sit beside Moonlit until real projects replace them (`upcoming` in `content/projects.ts`).
- Measured on this laptop's Intel UHD: the sea at tier 2 runs at 60 fps (was 46.6), tier 3 at 58 (was 31.6),
  tier 4 at 41.4 (was 21); the name is readable at first paint (was 5.6 s); a fast scroll shows at most one
  page (was four); a window against full screen drifts under 0.5% (was 6–13%).
- **Never push without the owner saying so.**

## 11. Open work, roughly in the order it matters

1. **Screen-reader pass** with NVDA (the owner agreed to this a while back and it keeps slipping). Includes
   a script to follow: the header, the rail, chapter titles, the case study, the contact links.
2. **Link previews**: Open Graph image and JSON-LD, so sharing the site shows the moon rather than nothing
   (spec §11).
3. **A second project.** The list and dialog are data-driven — add to `src/content/projects.ts`. Nothing
   else needs touching, and new projects inherit the no-pull behaviour automatically.
4. **Sound**, if ever: it was always phase 6 and has never been started.
5. Deferred, still valid: sections clickable at their anchor rather than at full visibility (review M5).
6. Deferred minors from the waxing-voyage final review, none of which the owner has noticed:
   - "The sea is waking" is never cleared without JavaScript or after a boot failure, and is 3.9:1.
   - After a late boot failure, the waking loop keeps writing opacities.
   - The stills loop's first frame pops the handover at a waking → stills switch.
   - `TRAVEL_PERCENT` 200 also moves unmasked blocks twice their height.
   - The frame fit shrinks the text on landscape phones and ultra-wide windows.
   - A fresh load with `#about`, `#projects` or `#contact` opens on the intro.
   - Small spec deviations: no `<dl>` for the facts, the full date on a phone header, the phone cover height,
     stills at q82, and an `img` without `src` until it is filled.
   - Stale comments and a dead idle-pose path in the camera.
   - Test gaps: a tautological wane test, the mask test lacks body text and a phone, the axe rule name, and the
     Tab test only starts from the intro.
   - The pacer's quiet measurement freezes the sea (not the text) for about 0.5 s when the tab comes back, and
     about 0.33 s once per tier change on a struggling GPU. That is the price of an honest reading; nobody has
     seen it yet.
