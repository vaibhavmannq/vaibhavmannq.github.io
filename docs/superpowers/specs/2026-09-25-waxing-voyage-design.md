# The waxing voyage: a moon that fills as you travel, a shore you can see, and a site that is smooth everywhere

- **Date:** 2026-09-25
- **Status:** Approved by the owner 2026-09-25, with three reports folded in (§4.12–4.14). The look was approved
  from the storyboard: "it's beautiful and perfect"
- **Storyboard:** https://claude.ai/artifact/QCL4tADM3udn13qavw7cZV (page "Storyboard"; the other directions are on
  page "Directions")
- **Amends:** master spec §3.4, §5.4b, §5.6, §5.8, §12.2; journey-flow design §3 (the opening); redesign design;
  `2026-09-25-opening-type-and-quality.md` §2. Supersedes S30 (daily real moon) and part of S37 (the black opening)

## 1. Why

A harsh review of the whole site on 2026-09-25 (this machine's real Intel UHD GPU, a headed browser, the real
code) found problems that no test caught. All 89 e2e tests and 157 unit tests passed at the time.

| Finding | Measured |
|---|---|
| The frame cap and the governor collapse any 75, 90 or 144 Hz screen to tier 0 within 7 s and lock it there, however fast the GPU | Simulated with the real `shouldRender` and `Governor`: 75 Hz → 37.5 fps, 90 Hz → 45 fps, 144 Hz → 48 fps, all ending at tier 0 |
| The sea is too slow on a laptop's integrated GPU | 1080p-class window, standing still: tier 1 = 60 fps, tier 2 = 43–53, tier 3 = 30–36, tier 4 = 20–25. The site dropped to tier 0 (40% resolution) within 15 s of idling on the opening |
| Nearly all of the sea's cost is rays inching through empty air above the waves | Starting each ray at a plane just above the highest surface: **2.1× faster** at every resolution tried. Bloom, the night sky, the motes and the normals made no measurable difference |
| The name appears 5.4 s after the scene is ready | Scene ready at 0.23 s, name readable at 5.6 s |
| All four pages look like the same picture, and the "shore" is never on screen | Even at the last position, looking down, the camera sees only water: the sand is behind it |
| Keyboard focus lands on links you cannot see | Tab reaches the project, email, GitHub, LinkedIn and Return links while their pages are at opacity 0, and nothing scrolls |
| Descenders are clipped | "Pro**j**ects" and "Ami**g**o": the line masks cut the letters at the baseline |
| An orphaned "hand:" on the desktop About page | The stressed phrase is pushed whole onto its own line |
| Fonts are not all self-hosted | `index.html` still loads Fraunces and Space Mono from Google Fonts, as a render-blocking stylesheet |

From the storyboard, the owner chose **A (keep the voyage, fix what breaks it) + E (the name at 0 ms) + F (a case
study worth opening)**, and added the waxing moon. Then they chose a **half cycle** and **moving the camera up the
beach**.

## 2. What the visitor gets

| | Today | After |
|---|---|---|
| First paint | Black, "Hello, voyager", then 5.6 s until the name | The name, its line and "Hello, voyager" at first paint; the sea fades up beneath them as soon as the GPU is ready |
| The moon | Tonight's real phase, fixed for the visit | Waxes with the scroll: crescent at Adrift → first quarter at The shore → gibbous at What washed ashore → full at The water's edge. It wanes if you scroll back |
| The camera | Drifts in from the sea and lands at 2.7 screens; the sand is never visible | The same drift, but it lands **up the beach** at 2.0 screens. The surf curves in under About, the walk crosses black sand, and it ends crouched by the foam with the moon on the wet sand |
| Where am I | "1 / 4" and nothing else | A rail of four moons (crescent, half, gibbous, full). It shows where you are, and click or tap jumps there |
| Contact | Only at the end | "Email me" in the header on every page |
| Projects | Title and one line | A card with a cover render; "Read the case study" opens F: picture, what it is, the hard part, a real number, source |
| Smoothness | Tier 0 on any 90/144 Hz screen; 20 fps sharp on a budget laptop | Evenly paced frames at every refresh rate, and about twice the frame rate for the same sharpness |

## 3. High-level design

No new libraries. The JavaScript budget stays 330 kB. What changes, by area:

```
app/
  refresh.ts        NEW   measures the display's refresh, picks an even frame divisor
  loop.ts           CHG   renders every Nth vsync instead of "60 fps minus 2 ms"
  boot.ts           CHG   no gate and no scroll lock; scene fades up when ready; wires rail, header, focus glide
quality/
  governor.ts       CHG   thresholds relative to the target frame interval (same numbers at 60 Hz)
journey/
  journey.config.ts CHG   landing moves 2.7 → 2.0 screens
  journeyMoon.ts    NEW   phase as a pure function of scroll; chapter phases
regions/moonsink/
  cameraPath.ts     CHG   new keyframes up the beach
  sea.ts            CHG   bounding plane from a per-frame `surfaceTop`; step 0.5 → 0.7; glints fade near the camera
  index.ts          CHG   sets moonPhase, moonLight and surfaceTop every frame
  moonPhase.ts      KEEP  (the daily-phase maths stays for `?moon=` and tests; `moonPhase(date)` is no longer used)
overlay/
  opening.ts        GONE  (replaced by the scene fade and a kicker that becomes "I · Adrift")
  gate.ts           GONE
  chapterRail.ts    NEW   the rail of four moons; aria-current; click glides
  focusGlide.ts     NEW   focus inside a hidden page glides to that page
  header.ts         NEW   log + Work/About + Email me (the voyage log moves in here)
  voyageLog.ts      CHG   shows the journey's phase, updated as it changes
  projectList.ts    CHG   card with cover
  projectDialog.ts  CHG   F layout: cover, what it is, the hard part, the number, links
  sectionMotion.ts  CHG   mask padding for descenders; stressed phrase splits with its paragraph
content/projects.ts CHG   cover, hardPart, metric; copy drop "tonight's moon"
styles/             CHG   header, rail, card, dialog; E's first-paint state; fonts all local
scripts/capture.ts  NEW   renders stills and the project cover from the real scene (Playwright)
public/fonts/       CHG   + Fraunces (variable, latin), + Space Mono (latin)
```

The frame still has one owner: the loop in `boot.ts` calls `region.update` → `sections.show` → `rail.show` →
`log.show` → `render`. Everything visible stays a pure function of scroll, except the one-shot sea fade-up (§4.5).

## 4. Low-level design

### 4.1 Frame pacing: every refresh rate, evenly

**The bug.** `shouldRender` draws when 14.7 ms have passed since the last frame. On a 90 Hz screen vsyncs are
11.1 ms apart, so it draws every second one, 22.2 ms apart. The governor counts anything over 20 ms as slow and
steps down, every 2 s, to tier 0, then locks the ceiling there (S36).

**The fix.**

`app/refresh.ts` (pure, unit-tested):

```ts
/** Median of rAF deltas → display refresh in Hz. Median, so one slow frame cannot skew it. */
export function refreshFromDeltas(deltasMs: readonly number[]): number;
/** Render every Nth vsync so frames stay evenly spaced and near 60 fps: max(1, round(hz / 60)). */
export function frameDivisor(hz: number, targetFps = 60): number;
```

| Screen | Divisor | Frames/s | Evenly spaced |
|---|---|---|---|
| 60 Hz | 1 | 60 | yes |
| 75 Hz | 1 | 75 | yes |
| 90 Hz | 2 | 45 | yes |
| 120 Hz | 2 | 60 | yes |
| 144 Hz | 2 | 72 | yes |
| 165 Hz | 3 | 55 | yes |

- `loop.ts` counts vsyncs and renders every `divisor`-th one. Idle mode (after 8 s without input) doubles the
  divisor. `dtSeconds` is still real elapsed time.
- The refresh is measured from the first 30 rAF deltas after start, and again after `visibilitychange` and
  `resize`, because a window can move to another monitor. Until the first measurement it uses today's
  time-based cap.
- `governor.ts` takes the target interval (divisor ÷ refresh). It steps down when p95 > 1.2 × target and counts
  a window as fast when p95 < 1.05 × target. **At 60 Hz these are exactly S16's 20 ms and 17.5 ms**, so S16's
  reasoning still holds.
- **90 Hz is a real choice.** 45 evenly spaced fps, or 90 fps at about 1.5× the GPU cost. The default is 45.
  `?pace=full` renders every vsync, so the owner can feel both on their phone (§7). The HUD shows the measured
  refresh.

### 4.2 The sea: skip empty air, and fade the glints near the camera

1. **Bounding plane.** New uniform `surfaceTop`, set every frame in `index.ts` from the camera:

   ```
   surfaceTop = max(WAVE_TOP, sandTop(cameraZ)) + 0.05
   WAVE_TOP   = 0.5              // Σ amplitudes 0.16·(1 − 0.74⁶)/0.26 + swell 0.1 − 0.16 ≈ 0.454
   sandTop(z) = −0.07·z + 0.025  // sandH's slope and offset, with the ±0.12 ridge and ±0.025 noise bounded
   ```

   The view never turns (yaw 0), so every ray heads toward +z. The sand falls away toward +z, so the highest
   surface a ray can meet is at the camera's own z. `march()` receives `surfaceTop` as a parameter (S2: layout
   functions stay pure):
   - A ray starting above it and heading up is sky at once, with no steps.
   - A ray heading down starts where it crosses `surfaceTop`.

   **Why not a constant.** The benchmark used a constant 0.55, and it is wrong up the beach: sand near the camera
   stands about 0.9 high there. A unit test samples `sandH`'s formula along the new camera path and checks
   `surfaceTop` is never below it.
2. **Step factor** 0.5 → 0.7, and keep the bisection refine. The tier step counts (80–112, S21) stay as they are.
   The benchmark showed 64 and 112 maximum steps cost about the same once the bound is in.
3. **Glints.** Today `fall(2, 25, t)` makes them strongest right at the camera. Up the beach that puts large
   square specks behind the phone text. New: `smoothstep(1.5, 5, t) · fall(5, 25, t)`, so glints rise away from
   the camera and fade into the distance. The owner compares both running (`?glints=old`, §7).
4. **Verify.** The render-diff method from the review: same pose, time and phase, old against new, per tier.
   Nothing may go flat (S21). The owner judges the glitter running (`?march=old`, §7).

Expected (to be measured, not promised): about 2× the frame rate at the same render scale. On this laptop that
should keep tier 2 or 3 instead of tier 0.

### 4.3 The moon waxes with the scroll

`journey/journeyMoon.ts` (pure):

```ts
/** Phase at each chapter's fully-shown point (overlay/sections.ts SHOWN_OFFSET), linear between, held after. */
export const CHAPTER_PHASES = { intro: 0.08, about: 0.25, projects: 0.375, contact: 0.5 } as const;
export function journeyPhase(local: number): number;           // 0.08 … 0.5
export function reducedMotionPhase(local: number): number;     // steps with the chapters, like the camera cut
```

| Chapter | Phase | Lit | Name in the log |
|---|---|---|---|
| I · Adrift | 0.08 | 6% | Waxing crescent |
| II · The shore | 0.25 | 50% | First quarter |
| III · What washed ashore | 0.375 | 85% | Waxing gibbous |
| IV · The water's edge | 0.5 | 100% | Full moon |

- Stops are placed from `progressForSection(journey, id, SHOWN_OFFSET)`, not hard-coded, so `?length` still works.
- `index.ts` sets `moonPhase` and `moonLight` every frame (two uniform writes). This relaxes §5.4b's "set once".
- The stars follow the phase, as they already do: the most at the crescent, the fewest at full.
- `?moon=` keeps pinning the phase and wins over the scroll. The contrast tests keep using `?moon=0.5`, the
  worst case, on every page.
- `MIN_MOON_LIGHT` (0.22) stays; the journey never reaches a new moon, so its lit-path-under-a-dark-moon oddity
  never shows.

### 4.4 The camera lands up the beach

New keys (screen heights; yaw 0 and pitch −0.06 throughout, so the moon and the sky still never move, S27):

| At (screens) | x | y | z | What happens |
|---|---|---|---|---|
| 0 | 0 | 3.2 | 34 | open sea (unchanged) |
| 0.667 | −2 | 6 | 26 | rising off the water (unchanged) |
| 1.333 | 1 | 2.2 | 9 | drifting in |
| **2.0** | 2.5 | 1.8 | −12 | **landed up the beach** (was 2.7, at z −5.5) |
| 4.1 | −8 | 1.8 | −12 | walked the sand: only x changes |
| 5.6 | −8 | 1.25 | −8.5 | stepped toward the foam and crouched |

- `MOONSINK_SHORE_AT` becomes 2.0 / 5.6. The drift keys are still evenly spaced up to it (0, ⅓, ⅔, 1 of the way).
- The old 2.7 key is gone. It would have stopped the camera mid-walk, because each leg eases to a halt.
- The surf curves in under About's text, and the sand is in view from 2.0 on.
- The approved storyboard frames used a 2.7 key and z −12.5. The differences are sub-unit and sideways, and the
  stills and covers are re-rendered from the real build (§4.10).
- Reduced motion keeps its four cut viewpoints (sea, landed, walk's end, water's edge), now all on the sand after
  the first.
- The tests that pin path properties (the moon in frame, no backing up, the walk only changes x, the step stops
  short of the foam) are updated to the new keys. The frame checks for the moon are unchanged, because yaw and
  pitch are unchanged.

### 4.5 Opening E: the name at first paint

- **No black layer and no gate.** `#opening`, `gate.ts`, `opening.ts`, the 2.2 s hold, the scroll lock and
  `?hold` are removed.
- **Without JavaScript, the intro page is the first paint.** The HTML and CSS alone show the intro section: the
  kicker reads "Hello, voyager", then the name and the line. Other sections start at opacity 0, as now. The
  canvas starts at `opacity: 0`.
- **When the scene is ready** (after `compileAsync` and the warm-up), `html.is-scene-ready` fades `.world` to 1
  over 1.2 s. Then, about 1.2 s after first paint or once the sea is in, whichever is later, three things arrive:
  - the header (log, Work, About, Email me) and the rail fade in over 0.6 s;
  - the kicker scrambles from "Hello, voyager" to "I · Adrift" (the existing ScrambleText);
  - "See the work →" and the email appear.

  This one-shot arrival runs on a clock, and it is the only thing that does. Scroll-driven text stays a pure
  function of scroll.
- **While the GPU is still working**, the page is usable over black: scrolling, the rail and the links all work.
  A small line, "The sea is waking…", shows in its place (`role="status"`).
- **The name's letter-rise goes.** A name that is already on screen must not vanish in order to rise. The pointer
  swell stays.
- **Reduced motion:** the sea appears without a fade; the kicker switches without scrambling.
- **Stills mode and boot failure:** the same first paint; the stills cross-fade in as today.
- **Superseded, and the owner approved it in the storyboard:**
  - S37's ordering rule ("nothing of the journey until the black has gone") and its test;
  - the greeting's italic second line ("A moonlit journey across the sea.");
  - "Skip intro". There is no intro to skip: the rail is the second thing in the tab order, after the header.

### 4.6 Header, rail, focus and snapping

- **Header** (`header.ts`, fixed, top):
  - log · date · time · journey phase · % lit;
  - Work and About jump like the rail;
  - "Email me" is `mailto:`, 44 px tall.
  - On a phone: time · phase, and Email me.
- **Rail** (`chapterRail.ts`), a `<nav aria-label="Chapters">` of four `<a href="#intro">`… links:
  - Each link has an inline SVG moon for its chapter's phase (crescent, half, gibbous, full; paths as in the
    storyboard).
  - `aria-current="step"` sits on the active chapter.
  - Click: `glideToProgress(shown)`, then focus the chapter's heading.
  - Desktop: the right edge, labels showing. Phone: four 44 × 44 icons under the header, each with an
    `aria-label`.
- **Focus glide** (`focusGlide.ts`): a `focusin` whose target is inside a section that is not active glides to
  that section's shown point. Nothing that has focus is ever invisible. Sections stay in the accessibility tree,
  as the master spec requires (`inert` was rejected: it would hide them from screen readers).
- **Wheel and trackpad snap:** behind `?snap=wheel` for the owner to feel (§7). When on, a wheel scroll that rests
  in a handover gap glides on in its direction, as touch does today. Off by default until chosen.

### 4.7 Type fixes

- **Descenders and the halo box:** see §4.13, which supersedes the smaller padding first drafted here.
- **"hand:" orphan:** the cause will be measured before it is fixed. The likely cause is SplitText keeping the
  nested `<em>` whole, so a 40-character phrase cannot share a line. The candidate fix is splitting the `<em>`
  with its paragraph (SplitText `deepSlice`), or making it a styled `<span>` inside the same text flow.
- **Fonts, all local:**
  - Fraunces variable (latin, weight axis 300–800, optical-size axis; the roman is enough now that the italic line
    is gone) and Space Mono regular (latin) move to `public/fonts/`.
  - The Google Fonts `<link>` and preconnects are removed.
  - Satoshi 400 and Fraunces are preloaded; both are needed for the first paint.

### 4.12 Fast scrolling never stacks pages (owner report, 2026-09-25)

**Reported:** scroll fast, up or down, and several pages show at once: "Projects", "Moonlit", the About text and
"Hola Amigo" all layered, half faded.

**Measured:** 14 hard wheel notches from the intro to Contact, sampling every frame. All four sections were
visible at once, at opacities 0.24 / 0.29 / 0.35 / 0.06, and two or more stayed visible for 64 frames (about 1 s).
It is the same going up.

**Cause:** S35's text that arrives. Each section eases toward its own scroll target (`CATCH_UP` in `sections.ts`),
each on its own. The targets themselves never overlap (§5 rule 3), but the eased values lag behind them. When a
fast scroll passes several pages, every one of them is still partway through a fade.

**Fix, an exclusive handover.** `sections.ts` keeps one **shown** section, D:

- When the scroll's target section T is D, or no section at all (a gap), D eases toward its target as today, so a
  normal scroll feels exactly as it does now.
- When T is a different section, D leaves **quickly** (rate 12, about 0.25 s):
  - toward T's side: up and out when T is further on;
  - sinking back when T is earlier.

  T does not start until D is gone. Pages that were only flown past never appear.
- Reduced motion is unchanged: a hard switch, already exclusive.

**Tests:**
- Unit: the local position jumps 0 → 0.9 over 5 frames and back. On every frame, at most one section has opacity
  above 0.001. A slow scroll matches today's eased values within 0.01.
- E2E: the wheel run above must show at most one section above 0.05 on every frame, in both directions.

### 4.13 Headings: no box around the halo, no clipped letters (owner report)

**Reported:** a faint rectangle around "Vaibhav Mann", "Projects" and "Hola Amigo", and the "g" of "Amigo" cut off.

**Measured:**
- The line mask SplitText puts around each heading line has `overflow: clip`. It is 104 px tall, and the line's
  content needs 123 px.
- The headings' 20 px halo (`text-shadow: 0 0 20px`, added in S37 for contrast over the glitter) is cut along the
  mask's edges. A with-and-without difference image shows the halo ending in a straight line along the bottom of
  "Projects", and the descenders are cut at the same line.

**Fix:**
- Every mask gets room for the glyph's ink **and** the halo: `padding: 0.2em 0.3em`, with a matching negative
  margin so nothing else moves.
- The rise starts from `yPercent: 140` instead of 115, so a rising line is still hidden at the start.

**Test (e2e):** for each masked line, the mask's box contains the line's ink box grown by 20 px. Checked on the
name, "Projects", "Hola Amigo" and a body paragraph, on desktop and phone.

### 4.14 The same composition in a window and full screen (owner report)

**Reported:** on the laptop, a normal window and full screen (Fn+F11) place the text differently.

**Measured**, at 1280 wide:

| | 590 tall (window) | 720 tall (full screen) |
|---|---|---|
| Projects block | 16% → 75% of the height | 16% → 64% of the height |

In the window, "Moonlit" sits on the horizon, and the moon moves about 30 px toward the middle.

**Cause:** the text is sized by the window's **width** (`10vw`, `9vw`…), and the scene by its **height**. The
vertical field of view is fixed for any screen wider than 16:9. Change only the height and they drift apart.

**Fix:** draw each page as at 16:9, then scale and shift it into the frame.

- `overlay/frame.ts` computes `frameFit(stageWidth, stageHeight)` → `{ scale, x }`. The result is 1 and 0 at 16:9
  or narrower, and also for a stage with no size yet.
- It writes `--frame-scale` and `--frame-x` whenever the stage changes size, watched with a `ResizeObserver`.
- `.section__panel` takes its `scale` and `translate` from them: top pages scale from the top edge, bottom pages
  from the bottom.

Scaling only the font sizes was tried on paper and rejected: the rem spacing and the small labels don't scale, which
leaves about 3% of drift in a 590 px window.

Found while building, and fixed:
- WebKit can run the script before the stylesheet sizes the stage. It measured 0 tall, and the first version scaled
  every page's text to nothing. The zero-size rule and the `ResizeObserver` cover it.

**Checked** in Chromium, Firefox and WebKit at 1280×720 and 1280×590, on all four pages (`tests/e2e/frame.spec.ts`):
- The panel's edges, as fractions of the frame, match within 0.5% in Chromium and Firefox. Before the fit they
  were 6–13% apart.
- WebKit is within 1.5%. At a device pixel ratio of 2 it lays scaled text out about 4 px taller, which moves a
  bottom-anchored page's top by about 6 px.

Type change is look-and-feel, so it goes behind `?frame=old` for the owner to feel (§7).

### 4.8 Projects card and case study (F)

`content/projects.ts`:

```ts
cover: { src: '/projects/moonlit-cover.jpg', alt: 'The full moon on wet black sand, rendered by the site' },
hardPart: 'Keeping it smooth everywhere: …',          // owner's words, drafted below
metric: { value: '[measured]', label: '[what it measures]' },
```

- **List:** a card with the cover (220 × 140 desktop, full-width × 150 phone), meta, title, aside, summary, and
  "Read the case study →" (a `<button aria-haspopup="dialog">`, as now).
- **Dialog, desktop:** close; title and aside; the facts as a `<dl>` (year, role, stack); "What it is"; "The hard
  part" with the number; source. The cover sits on the right.
- **Dialog, phone:** the cover on top, then the same content. It stays a native `<dialog>`, with the same focus,
  Esc and deep-link handling.
- **The number** is measured once §4.1–4.2 are in: fps before/after at a fixed tier on this laptop. It is written
  only from a measurement, never estimated.

### 4.9 Copy (drafts from the storyboard; the owner may reword)

| Where | Today | After |
|---|---|---|
| About | "…the sea is a shader, and the moon is tonight's." | "…the sea is a shader, and the moon fills as you travel." |
| Project summary | "…a moonlit sea under tonight's real moon." | "…a moonlit sea whose moon fills as you travel." |
| Case study | "…the moon's shape is tonight's real phase, so darker nights show more stars." | "…the moon waxes from crescent to full as you travel." |
| Meta description | unchanged | unchanged |

### 4.10 Stills and the cover, from the real scene

`scripts/capture.ts` (Playwright, run by hand, `npm run capture`) loads the built site with
`?p=<shown>&tier=3&time=12&bare`, waits for frames, and screenshots:
- the four chapter stills in landscape (1600 × 1000) and portrait (780 × 1688);
- the project cover.

All are JPEG q86, and the script prints their sizes. `?bare` is a new hook that hides the text layer. The stills
therefore show the new camera and each chapter's own moon.

### 4.11 The voyage log

`formatLog(now, phase)` is unchanged. The log calls it when the rounded percentage or the phase name changes,
not every frame, and the clock still ticks every 30 s.

## 5. Performance targets

| Device | Target | How it is checked |
|---|---|---|
| Any refresh rate, fast GPU | No step-down caused by the refresh rate; evenly spaced frames | Unit simulation at 60/75/90/100/120/144/165 Hz with the real loop and governor, a free GPU, 30 s each: zero tier changes, one interval value per rate |
| This laptop (Intel UHD Gen12, 1080p at 150%) | Settles at tier ≥ 2 and holds 60 fps standing still; no tier change after the first 20 s | Headed browser, `?hud`, 60 s idle plus a full scroll; the bench's per-rAF count at each tier, before and after |
| The owner's phone | Evenly paced frames, and the tier it settles on reported by the HUD | Owner, on the phone, with `?hud` |
| First paint | The name readable at first contentful paint | Navigation timing in e2e: `#intro-title` visible at FCP |
| JavaScript | ≤ 330 kB gzip (today 293) | `npm run size` |
| Fonts | Satoshi 74 kB + Fraunces + Space Mono, all local; sizes recorded in the plan | build output |

## 6. Accessibility

- Focus is never on something invisible (focus glide). The rail's links have names. `aria-current` is on the
  active chapter.
- Contrast is still measured from rendered pixels at full moon on a phone, on all four pages. The page text now
  sits over sand on the phone, and the glint change (§4.2) must keep every line at or above its minimum.
- Reduced motion: the moon steps with the chapters, the camera cuts, the sea appears without a fade, and there is
  no scramble.
- `lang="es"` stays on "Hola Amigo".
- The NVDA pass (handover §11.1) follows this work.

## 7. Switches the owner feels before anything is committed

Per S34, each look-and-feel choice is served to the owner's phone running, then committed with the owner's pick.

| Switch | Options | Default until chosen |
|---|---|---|
| `?march=old` | today's ray march against the bounded one (glitter pattern) | new |
| `?glints=old` | glints strongest at the camera, against fading near it | new |
| `?pace=full` | 90 Hz screens: 45 evenly spaced against 90 fps. The owner's phone runs at 60 or 120 Hz, where it makes no difference, so this is checked on the laptop only | 45 |
| `?snap=wheel` | mouse/trackpad snap on or off | off |
| `?frame=old` | no frame fit (today), against each page scaled into the scene's frame (§4.14) | new |

The landing at 2.0 screens is part of the approved storyboard, but it changes a pace the owner tuned. It is
checked on the phone before the merge, like the rest.

## 8. Testing

- **Unit, new:**
  - `refresh.test.ts` (median, divisor);
  - the refresh-rate simulation (§5);
  - `journeyMoon.test.ts` (chapter phases hit exactly, monotonic, held after Contact, the reduced-motion steps,
    `?length`);
  - `surfaceTop` never below the sand along the path;
  - the header and rail state from `local`.
- **Unit, changed:** `cameraPath.test.ts` (new keys, same properties), `governor.test.ts` (relative thresholds,
  identical at 60 Hz), `journeyConfig.test.ts` (landing at 2.0), `voyageLog.test.ts`, `projects.test.ts` (cover,
  hardPart, metric).
- **E2E, new:**
  - The name is visible at FCP, before the sea.
  - Tab never focuses an element inside a section with computed opacity < 1 after the glide settles.
  - Every masked line has no clipped descender.
  - The rail jumps and sets `aria-current`.
  - "Email me" is present on every page.
- **E2E, removed or rewritten:** the gate and opening specs (`?hold`, the ordering test, the greeting font test)
  become the E specs above. The contrast tests keep `?moon=0.5`.
- **Kept:** axe on each page and the dialog, touch snap, reduced motion, stills, smoke.

## 9. Order of work, and deploy

1. Frame pacing and the governor (§4.1): invisible, measurable, first.
2. The owner's three reports: the exclusive handover (§4.12), the heading masks (§4.13), and the frame-sized
   composition (§4.14).
3. The sea: bound, step, glints (§4.2), behind `?march=old` and `?glints=old`.
4. The moon schedule and the camera (§4.3, §4.4).
5. Opening E (§4.5).
6. Header, rail, focus glide, wheel snap switch (§4.6).
7. Type and fonts (§4.7).
8. The card, the case study and the copy (§4.8, §4.9); measure the number.
9. Capture stills and the cover (§4.10); update the handover doc.

Each step gets a plain-language walkthrough for the owner. Commits carry no attribution trailers. The branch is
`waxing-voyage`. The owner feels the switches on their phone before the merge. **Pushing `main` publishes, and is
done only when the owner says so.**

## 10. Change log entries for the master spec (§17)

| # | Change |
|---|---|
| S38 | Frame pacing follows the display: render every Nth vsync, with thresholds relative to that interval. Before, 75/90/144 Hz screens were throttled below 50 fps and dropped to tier 0 |
| S39 | The ray march starts at a per-frame bounding plane from the camera's position, with step 0.5 → 0.7: about 2.1× faster (measured). Glints fade near the camera |
| S40 | The moon waxes with the scroll (0.08 → 0.5, a half cycle), reaching each chapter's phase where the chapter is fully shown. Supersedes S30's daily real moon, which the owner had chosen over "a phase per region" |
| S41 | The camera lands up the beach at 2.0 screens (was 2.7) so the black sand is on screen. Yaw and pitch unchanged |
| S42 | Opening E: the name at first paint, and the sea fades up under it. The black layer, the 2.2 s hold, the scroll lock, the italic greeting line and "Skip intro" go; this supersedes S37's ordering rule |
| S43 | Header with "Email me", a rail of four moons, focus that never lands on something invisible, all fonts local, descender and orphan fixes, project card and case study |
| S44 | Exclusive handover: one shown section at a time; on a jump the shown one leaves in about 0.25 s before the next arrives. Before, a fast scroll showed all four at once (measured), because S35 eased each section separately |
| S45 | Heading masks leave room for descenders and the 20 px halo. Before, the halo was cut into a visible box and the "g" and "j" were clipped |
| S46 | Text is sized and placed by the scene's 16:9 frame, not the window's width, so a window and full screen keep the same composition |

## 11. Corrections to the handover

- "No GPU here — it renders in software" is true only for headless test browsers. This machine has an Intel UHD
  (Gen12), and a headed browser gets WebGPU on it: use it for performance numbers.
- "Fonts are self-hosted now" was true for Satoshi only, until §4.7.

## 12. Answered by the owner (2026-09-25)

1. **Phone refresh:** 60 Hz now, 120 Hz available. Both give a divisor that renders 60 fps, so the phone is
   checked at both settings, and `?pace` only matters on 90 Hz screens.
2. **The case study's hard part:** smoothness everywhere, with the measured before and after.
3. **Approved**, with three reports to fold in: fast scrolling stacks pages (§4.12), a box around the big
   headings (§4.13), and the text moving between window and full screen (§4.14).
