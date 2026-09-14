# Journey flow: the opening, the type pairing and the scroll

- **Date:** 2026-09-14
- **Status:** Awaiting owner review
- **Amends:** `2026-09-13-moonlit-portfolio-design.md` §3.1, §3.3, §3.4 rule 4, §5.4a, §5.6, §5.8, §10.1, §10.2, §12.2, §14, §15, §17 S25
- **Next after this:** the night sky (§14 roadmap)

---

## 1. Why

The owner reviewed the merged Phase 1 build on their phone (Brave on Android, WebGL2) and asked for three things:

1. **A black opening** like the Phase 0 "hello moon" page, greeting the visitor instead of showing their name, followed by a smooth transition into the portfolio.
2. **A type pairing:** one heavy face and one light italic face, kept only if the combination looks good.
3. **A better scroll.** They flagged every problem offered: text collides mid-scroll, it stutters, the camera lags the finger, and the journey is "a tad" too long and unevenly paced.

Every decision below was chosen by the owner from runnable demos or from a proposal they approved.

## 2. Decisions

| Topic | Chosen | Rejected | Why |
|---|---|---|---|
| Opening flow | Automatic once the scene is ready | Tap to begin; a black screen before today's title screen | Smooth, with one screen instead of two. The black screen also hides the shader compile |
| Opening transition | **a**: the greeting fades, then the black lifts evenly | **b**: the dark opens outward from the moon; **c**: the dark parts at the horizon | Owner's pick from demos. b was the controller's recommendation |
| Greeting copy | "Hello, voyager" / *"A moonlit journey across the sea."* | The visitor's name | Owner request. "Voyager" is not a game term; "Rover" would be |
| Type | **p1**: heavy Gelasio for the greeting, name and headings; light Cormorant Garamond italic for accent lines; Manrope body | p2 (italic "Hello," next to heavy "voyager"); p3 (light italic greeting); Gelasio alone | p2's mixed spacing broke the line's rhythm; p3 dropped the heavy greeting the owner chose |
| Heavy face | Gelasio | Georgia | Gelasio is designed with Georgia's letter widths, so it reproduces the Phase 0 look, and it ships as a web font. Android has no Georgia |
| Text handover | Sequential, with a short gap where only the scene shows | Overlap; texts in different corners; a shorter overlap | On a phone both texts share one spot and collided. Corners don't fit full-width text. Any overlap still collides |
| Camera | Follows the scroll position directly, ~70 ms smoothing | Faster easing; smoothing touch scroll with Lenis `syncTouch` | Today's easing takes ~1.4 s to catch up. On touch it is the only smoothing, so the camera trails the finger. `syncTouch` fights native momentum (spec D6) |
| Stutter | Cheaper text legibility, text on compositor layers, no tier changes mid-scroll, HUD readouts | Lowering render resolution while moving | Fix the measured and likely causes first; dynamic resolution is heavier work, kept as the next lever |
| Length | About 20% shorter: 3 → 2.4 screen heights, tuned by feel | — | Owner: "a tad bit short and smooth" |

## 3. The opening

### 3.1 What the visitor sees

A full-screen layer, `#020406`, centred:

- the glyph, 4.5rem, with its soft glow;
- **"Hello, voyager"** in Gelasio 400, `font-size: clamp(1.9rem, 8vw, 4.5rem)`, `letter-spacing: 0.3em`. At a 390 px screen this fits on one line, measured in the demos;
- ***A moonlit journey across the sea.*** in Cormorant Garamond Light Italic, `font-size: clamp(1.2rem, 4.8vw, 1.6rem)`.

The moonlit title screen with the visitor's name and "Click to enter" is removed. The name now appears first in the intro, over the sea.

### 3.2 Timing

The opening has three states:

| State | Starts | What happens |
|---|---|---|
| `greeting` | First paint | The scene loads and compiles behind the black layer |
| `leaving` | When the scene is ready **and** 2.2 s have passed since first paint. Or, once the scene is ready, at the first tap, scroll or key | The greeting and subtitle fade over 0.7 s. The black layer fades over 1.8 s, starting 0.5 s in. Taps pass through the layer while it leaves |
| `gone` | When the layer's own transition ends | The layer is hidden |

Leaving the greeting unlocks scrolling and starts the camera, as entering does today. The intro text keeps its existing reveal: it fades in over 0.9 s after a 1.2 s delay, so the greeting has already faded before the name appears.

Taps, scrolls and keys before the scene is ready do nothing, because there is no scene to show yet. On a slow phone the greeting is simply the loading screen for longer.

### 3.3 Focus and keyboard

- **An automatic or pointer start moves no focus.** The browser would otherwise draw a focus ring around the name for every visitor. The demos proved this: after the fix, `document.activeElement` is `body` and nothing matches `:focus-visible`.
- **A key press that starts the opening moves focus to the intro heading**, as entering does today.
- **"Skip intro"** stays the first focusable element. It starts the opening straight away, scrolls to About and focuses the About heading.
- A visually hidden `role="status"` element outside the opening layer says "Loading the scene…" and is emptied once ready. The opening layer itself is `aria-hidden`: the real content stays in the DOM underneath.

### 3.4 Fallbacks

- **Reduced motion:** the greeting still holds, because a still screen is not motion, and the layer is removed without fades.
- **Stills mode** (no WebGL): the same opening. It leaves once stills mode is ready.
- **No JavaScript:** the opening is hidden by the `<noscript>` styles, and the content is static, as today.
- **Test hook `?p=`** jumps into the journey and removes the opening at once, so browser tests stay fast.

## 4. Type

| Token | Face | Used for |
|---|---|---|
| `--font-display` | Gelasio 400 (500 available) → Georgia → "Times New Roman" → serif | The greeting, the visitor's name, section headings |
| `--font-accent` | Cormorant Garamond Light Italic → "Iowan Old Style" → Georgia → serif | The opening's subtitle and the intro tagline (`.section__lede`) only |
| `--font-body` | Manrope, unchanged | Body text, labels, controls |

- **Font request:** `family=Cormorant+Garamond:ital,wght@1,300&family=Gelasio:wght@400;500&family=Manrope:wght@400;500;600`. Cormorant's upright weights are no longer loaded.
- The intro tagline in italic: `font-size: clamp(1.35rem, 5.4vw, 1.9rem)`, `line-height: 1.3`.
- **Spec §3.4 rule 4 gains one exception:** the one-line greeting may use wide letter-spacing, because it is sized to fit a 390 px screen on one line. The name and headings keep tight tracking.
- This closes the open typography question (§15).

## 5. Scroll

### 5.1 Sequential text handover

Each section's opacity becomes a pure function of the **region-local position** `local` and the anchors around it. It is no longer a crossfade driven by `sectionMix`.

Around an anchor at position `A`, with `FADE = 0.10` and `GAP = 0.08` in region units:

- the outgoing section fades from 1 to 0 over `[A − GAP/2 − FADE, A − GAP/2]` while drifting up 12 px;
- nothing is shown over `[A − GAP/2, A + GAP/2]`, only the scene;
- the incoming section fades from 0 to 1 over `[A + GAP/2, A + GAP/2 + FADE]` while rising the last 16 px.

The first section has no fade-in and the last has no fade-out. For the About anchor at 0.45, the intro leaves over 0.31–0.41, the gap is 0.41–0.49, and About arrives over 0.49–0.59. `FADE` and `GAP` are starting values, tuned by feel on the owner's phone.

Still true from §5.4a: no timers, no `element.animate()`, no CSS transitions on these properties. Scrolling back reverses exactly. Under reduced motion there is no offset, and the text switches at the anchor, in the same frame as the camera cut (§17 S24).

### 5.2 The camera follows the scroll

- While the journey runs without reduced motion, the camera's target is `poseAt(path, local)`, as today. Position, yaw and pitch follow it with an exponential smoothing whose time constant is **70 ms** (`damp` with λ ≈ 14). That is long enough to hide scroll-event jitter and short enough not to be felt.
- The `MAX_YAW_SPEED` clamp no longer applies during the journey. The path's total turn is under 1 rad, and no leg needs more than 0.5 s at the old cap (§17 S22 tests), so there is nothing uncomfortable left to clamp.
- The title-screen bob keeps `approachPose` and its clamp, since that motion is ambient. When the journey starts, the camera moves from the bob to the path within about 0.2 s, while the black layer is still lifting.
- Mouse wheels keep Lenis's smoothing (`lerp: 0.1`) as the one smoothing layer; touch keeps native momentum.

### 5.3 Stutter

**What was measured.** A local spike ran stills mode (no WebGL) on a phone-sized viewport at DPR 2.625, with the CPU slowed 4×, scrolling end to end:

| Variant | Long frames (>25 ms) | Raster | Layout |
|---|---|---|---|
| As built | 4 of 356 | 352 ms | 36 ms |
| No text shadow | 0 of 361 | 145 ms | 1 ms |
| No shadow, no floor gradient | 1 of 360 | 107 ms | 1 ms |

So the text overlay contributes but is not the main cause: the phone showed 160 dropped frames with the 3D scene running. The 3D side cannot be measured without the phone's GPU.

**Changes:**

1. **Cheaper legibility.** Replace `text-shadow: 0 2px 18px rgba(2, 4, 6, 0.9)` on section text with `0 1px 2px rgba(2, 4, 6, 0.8)`. Legibility comes mainly from the floor gradient. If the full-moon contrast test (§17 S23) then fails, strengthen the gradient; never the text colour.
2. **Text on its own layers.** `.section { will-change: opacity, transform; }`, so the per-frame fades are composited rather than repainted.
3. **No tier change mid-scroll.** "Scrolling" means the scroll progress changed within the last 300 ms, computed once per frame in the loop without allocation. `Governor.sample(frameMs, nowMs, canChange)`:
   - while `canChange` is false it never changes tier, but keeps measuring windows;
   - a step-down still needs one slow window and a step-up three consecutive fast windows;
   - once `canChange` is true, the next completed window may apply its verdict;
   - the 2 s hysteresis after a change is unchanged.
4. **HUD readouts** (`?hud`):
   - `scroll    moving` or `still`
   - `in scroll ${n} long frames (> 25 ms)`
   - `tier changes in scroll ${m}`

   By construction `m` must stay 0; it is there to catch a regression.

**Acceptance on the owner's phone** (`?hud`): scroll top to bottom and back three times at the settled tier. `in scroll` long frames grow by no more than 3 per pass, and `tier changes in scroll` stays 0. If the stutter persists after this, the remaining cause is the scene's GPU cost at the settled tier. The next lever is lowering render resolution while moving, which is out of scope here.

**Acceptance locally:** re-run the spike. Raster is at most 176 ms (at least 50% below the 352 ms baseline), with 0 long frames.

### 5.4 Length and pacing

- The Moonsink region length goes from 3 to **2.4** screen heights in `journey.config.ts`.
- The camera keyframes are spaced evenly at `at = 0, 0.25, 0.5, 0.75, 1`, instead of `0, 0.28, 0.55, 0.78, 1`. Poses are unchanged.
- The About anchor stays at 0.45 as a starting value.
- **Dev hook `?length=`** overrides the region length in screen heights, clamped to 1.5–4. The owner tunes it on the phone, and the chosen number goes into the config.

## 6. Units and interfaces

| File | Change |
|---|---|
| `index.html` | Opening markup replaces the title screen's name and "Click to enter"; a visually hidden status element is added; the font request changes; the scratch demo scripts are removed |
| `src/overlay/opening.ts` (new) | `createOpening(element, status)`, with `begin({ camera, enter, reducedMotion })` and a pure, exported `holdRemaining(nowMs, minHoldMs)`. It replaces the scratch `src/dev/opening.ts` |
| `src/overlay/gate.ts` | Keeps its state machine (`loading` → `ready` → `entered`), `setReady`, `enter` and `onEnter`; the button is removed |
| `src/overlay/sections.ts` | `sectionOpacity(local, anchors, index, reducedMotion)` and `sectionOffset(...)`, both pure and exported |
| `src/regions/moonsink/cameraPath.ts` | `followPose(current, target, dtSeconds, timeConstantMs)` for the journey; `approachPose` stays for the bob; keyframes re-spaced |
| `src/quality/governor.ts` | `sample(frameMs, nowMs, canChange)` |
| `src/app/boot.ts` | Wires the opening; tracks "scrolling"; passes `canChange`; applies `?length` |
| `src/app/params.ts` | `length?: number`, clamped 1.5–4 |
| `src/dev/hud.ts` | `record(frameMs, scrolling)`, the new lines, and a tier-change counter |
| `src/styles/base.css`, `overlay.css` | Font tokens, opening styles, the lighter text shadow, `will-change` on sections; the scratch blocks are removed |
| `src/journey/journey.config.ts` | Length 2.4 |

## 7. Testing

**Unit:**

- `sectionOpacity`: at no `local` are two sections above 0 at once. A gap exists where both are 0. Values mirror when scrolling backwards. Under reduced motion the switch lands exactly at the anchor. Each test must fail against the old overlapping crossfade.
- `followPose`: after one time constant the pose has covered 1 − 1/e of the distance; there is no yaw clamp.
- `Governor`: overloaded windows while `canChange` is false cause no change; the first window after `canChange` turns true steps down; step-up still needs three fast windows; the 2 s hysteresis still holds.
- `holdRemaining`: before and after 2.2 s.
- `params`: `?length` is clamped, and garbage falls back to the config.

**Browser:**

- The opening appears, then hides by itself (stills mode).
- A key press moves focus to the intro heading; a pointer start leaves nothing matching `:focus-visible`.
- `sections.spec`: at a handover position, the two sections are never both visible, and a gap position shows neither.
- The full-moon contrast test is re-run and covers the italic tagline.
- axe finds no violations on the opening.
- Every spec that clicked "Click to enter" is rewritten to wait for the opening instead.

**Performance:** the stills spike is re-run against §5.3's local acceptance, and the owner's phone checks the HUD acceptance.

## 8. Out of scope

- The night sky: stars, constellations, a nebula (next phase).
- Lowering render resolution while moving.
- Verifying WebGPU on a real device.
- Self-hosting fonts (they still come from Google Fonts, §15).

## 9. Risks

| Risk | Mitigation |
|---|---|
| The 3D scene, not the overlay, causes most of the stutter, and these changes don't remove it | The HUD readouts separate the cases on the owner's phone; dynamic resolution is the next lever |
| Camera following the finger feels too direct on a fast flick | The 70 ms time constant is one number to tune; the whole path turns under 1 rad, so a flick can't spin the view |
| The lighter text shadow drops contrast over the brightest moon | The pixel-based contrast test gates it; strengthen the floor gradient if needed |
| Gelasio is slow to load on a poor connection | `display=swap` with a Georgia fallback of the same letter widths, so the layout does not jump |
