# Phase 1R — Composition revision, continuous scroll, and lunar phase

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Moonsink Shore's presentation around the owner's chosen look — moon, sea and type, nothing else — fix the two motion defects the owner found by eye, and give the moon tonight's real phase.

**Architecture:** No new systems. This removes scene objects, moves one shader knob from per-tier to constant, replaces a timer-driven text fade with a scroll-driven one, and adds one small pure module (`moonPhase.ts`) feeding two new sea uniforms.

**Tech Stack:** Unchanged — Vite 8, TypeScript 7, three 0.186 (`three/webgpu` + TSL), Lenis, Vitest, Playwright, Biome.

**Spec:** `docs/superpowers/specs/2026-09-13-moonlit-portfolio-design.md` — read §3.4 (composition rules, binding), §5.4 (sea), §5.4a (scroll-driven text), §5.4b (lunar phase), §5.6 (tier invariant), §17 S17–S20.

**Base:** branch `phase-1-moonsink` at `d84efc2`. Phase 1 is code-complete and fully reviewed; this revises it **before** it merges. There are uncommitted scratch experiments in the working tree (the `?look=` scaffolding) — Task 1 replaces them, so the first implementer must start by discarding them (`git checkout -- .` after confirming nothing else is pending).

## Global Constraints

- **Composition rules §3.4 are binding.** One focal point per screen; no panels behind text; type is primary; text never crosses the moon or its path; nothing repeats; nothing overlaps at 390 px.
- **No game terminology.** The word "Tacet" never appears. The transition is the "resonance ripple". No Wuthering Waves assets or region names.
- **Tier invariant (§5.6):** a tier change may only alter resolution, aliasing and bloom. Never surface shape.
- **Frame-loop contract:** no allocation in the steady-state frame — no `new`, no object/array literals, no closures, no layout-forcing DOM reads.
- **TSL purity (§17 S2):** functions with `.setLayout()` must be pure — never read `uniforms.` inside one; pass values as parameters. Reversed `smoothstep` edges are forbidden (§17 S3): use `smoothstep(a,b,x).oneMinus()`.
- **Accessibility:** keyboard path intact, axe clean, reduced motion honoured, contrast ≥ 4.5:1 (§10.4) **at every moon phase**.
- **Commits:** plain subject line, **no trailer of any kind** — no `Co-Authored-By:`, no `Claude-Session:`, no "Generated with".
- **Never push.** Merging and pushing are the owner's decision, asked separately.
- Verification per task: `npx tsc --noEmit`, `npx tsc --noEmit -p tsconfig.node.json`, `npm run check`, `npm run test`. The controller runs `npm run e2e`.

---

### Task 1: Strip Moonsink to moon, sea and type

**Files:**
- Delete: `src/regions/moonsink/ring.ts`, and its unit test if one exists
- Modify: `src/regions/moonsink/index.ts` (drop ring construction, update, dispose)
- Modify: `index.html` (remove the temporary `?look=` script; intro section markup)
- Modify: `src/styles/overlay.css` (promote look 2 to the only styling; delete the temporary review block)
- Test: `tests/unit/` — remove ring tests; no new unit tests needed here

**Interfaces:**
- Consumes: `createSea`, `MoonsinkRegion` as they are
- Produces: `createMoonsink` with no ring; the `MoonsinkRegion` interface itself is unchanged

- [ ] **Step 1: Discard the scratch experiments**

Confirm the working tree holds only the `?look=` scratch (`git status`), then `git checkout -- .`. Do not delete anything under `.superpowers/` (git-ignored working notes).

- [ ] **Step 2: Delete the ring and shards**

Remove `ring.ts`. In `index.ts` delete the import, the `createRing()` call, the `scene.add` of `ring.group`, the `ring.update(...)` line and the ring's `disposeObject` call. The scene then contains only `sea.mesh`.

Verify no dangling references: `grep -rn "ring" src/ tests/` must return nothing but unrelated words (e.g. "bring", Lumenreach's future ring gate in comments).

- [ ] **Step 3: Promote the chosen look into `overlay.css`**

The owner chose the type-led treatment (§3.4 reference). Rewrite the title-screen and section rules so this is the *only* styling — do not keep `[data-look]` selectors.

Title screen (`.gate`): grid with `place-content: end start`, `justify-items: start`, `text-align: left`, padding `0 max(1.5rem, env(safe-area-inset-left)) 12svh`. Glyph 2.5rem, `opacity: .75`, no drop-shadow, `margin-bottom: 1.25rem`. Name: `font-size: clamp(2.75rem, 13vw, 8rem)`, `line-height: .95`, `letter-spacing: -0.01em`, no `padding-left`, `text-shadow: 0 2px 30px rgba(2,4,6,.75)`. Enter button: no background, no border, no radius, `border-bottom: 1px solid rgba(159,230,238,.5)`, `padding: .35rem 0`, and **no `breathe` animation** (delete the keyframes if nothing else uses them).

Sections: `.section__panel` loses `background`, `backdrop-filter`, `border-radius` and `padding` — no panel (§3.4 rule 3). Legibility comes from one scene-wide floor gradient on `.content::before`: `height: 62svh`, `linear-gradient(to top, rgba(2,4,6,.82) 12%, rgba(2,4,6,.45) 46%, rgba(2,4,6,0) 100%)`, `pointer-events: none`. Headings and paragraphs get `text-shadow: 0 2px 18px rgba(2,4,6,.9)`. `h1` matches the gate name's scale; `h2` is `clamp(2.5rem, 11vw, 6rem)`, `line-height: .95`. Panel `max-width: 40rem`.

- [ ] **Step 4: Stop the name appearing twice (§3.4 rule 6)**

While `html.is-gated`, the content layer must not show. Add `html.is-gated .content { opacity: 0 }`. Confirm by reading `boot.ts` that the class is present before first paint and removed on enter.

- [ ] **Step 5: Verify at 390 px**

Run the checks, then confirm by reading the CSS that nothing can overlap at 390 px: the name at 13vw = 50.7px on a 390px viewport with `line-height .95` and tight tracking fits "Vaibhav Mann" on one or two lines with the glyph above and the enter link below, inside `100svh - 12svh` of padding. State the arithmetic in your report.

- [ ] **Step 6: Commit**

```bash
git add src/regions/moonsink/index.ts src/styles/overlay.css index.html
git rm src/regions/moonsink/ring.ts
git commit -m "refactor: strip Moonsink to moon, sea and type"
```

**Walkthrough (for the owner):** the ring and shards are gone from the code, not hidden. The text card is gone; a single soft gradient across the bottom of the screen does the job the box was doing, so the sea stays visible behind your words. The title screen now places your name large at the bottom-left, away from the moon.

**Check (owner):** the title screen shows the glyph, your name once, and a thin "click to enter" — over an empty moonlit sea.

---

### Task 2: Pin wave detail so tier changes stop re-shaping the sea

**Files:**
- Modify: `src/regions/moonsink/sea.ts` (wave iterations become a constant)
- Modify: `src/quality/tiers.ts` (drop `waveDetail` from `TierSettings` and `TIERS`)
- Modify: `src/regions/moonsink/index.ts` (stop writing the `waveDetail` uniform)
- Test: `tests/unit/tiers.test.ts` (update to the new shape)

**Interfaces:**
- Produces: `TierSettings` = `{ renderScale, marchSteps, bloom }` — `waveDetail` removed. Any consumer referencing it must be updated.

- [ ] **Step 1: Make the constant**

In `sea.ts`, define `const WAVE_ITERATIONS = 6;` at module scope with a comment citing §5.4 and §17 S17. Use it for the shading call (`waterH(p.xz, int(WAVE_ITERATIONS), time)` and the four neighbour samples) **and** for `heightAt`'s hardcoded `int(5)`, so the ray-marched surface and the shaded normals finally agree. Delete the `waveDetail` uniform from `SeaUniforms`.

Why 6: amplitude decays 0.74× per layer, so layer 7+ contributes under 1% of wave height. 6 keeps the ripple character of the old high tiers at a cost between the old tiers 2 and 3.

- [ ] **Step 2: Remove the tier knob**

Delete `waveDetail` from the `TierSettings` interface and from all five rows of `TIERS`. Update the doc comment to state that tiers change cost only — never surface shape (§5.6).

- [ ] **Step 3: Update the tier unit tests**

Any assertion naming `waveDetail` must go. **Add a test that pins the invariant**: every tier's settings must differ from every other tier's only in `renderScale`, `marchSteps` and `bloom` — assert the object keys are exactly those three, so a future change that re-introduces a shape knob fails here.

- [ ] **Step 4: Prove it**

Run the unit tests. Then state in your report which tier now produces which sea: the answer must be "the same sea at every tier, at different resolutions".

- [ ] **Step 5: Commit**

```bash
git add src/regions/moonsink/sea.ts src/quality/tiers.ts src/regions/moonsink/index.ts tests/unit/tiers.test.ts
git commit -m "fix: pin wave detail so quality tiers stop re-shaping the sea"
```

**Walkthrough (for the owner):** this is the "ocean reset" you felt. The quality system was changing how many wave layers the water has, so every time it decided your phone could handle more, the sea's surface changed shape under you. Now the water is the same everywhere and only its sharpness changes.

**Check (owner):** sit on the title screen for a minute. The water's pattern never jumps, even as the HUD's tier climbs.

---

### Task 3: Drive section text from scroll position

**Files:**
- Modify: `src/journey/timeline.ts` (`resolve` also returns `sectionMix`)
- Modify: `src/journey/types.ts` (`JourneyState.sectionMix: number`)
- Modify: `src/overlay/sections.ts` (opacity as a function of progress; no Web Animations, no timers)
- Modify: `src/app/boot.ts` (pass `state.sectionMix` through)
- Test: `tests/unit/timeline.test.ts`, `tests/unit/sections.test.ts`

**Interfaces:**
- Produces: `JourneyState` gains `sectionMix: number` (0..1). `Sections.show(id, mix, reduced)` replaces `show(id)`.

- [ ] **Step 1: Add `sectionMix` to `resolve`**

`sectionAt` currently returns only the chosen id. Extend it to also report how far the local position sits between the *current* anchor's `from` and the *next* anchor's `from` (1 when there is no next anchor). Write it into the existing `stateScratch` — **no new allocation** (frame-loop contract). Update `JourneyState` in `types.ts`.

- [ ] **Step 2: Unit-test the mix**

Cover: exactly on an anchor → 0; midway between two anchors → 0.5; past the last anchor → 1; a region with a single anchor → 1 throughout; and that `resolve` still returns the same object identity each call (the no-allocation guarantee). Remember the scratch-object trap from phase 1 — snapshot with `{ ...resolve(...) }` before comparing two results, or the test compares an object to itself and passes regardless.

- [ ] **Step 3: Rewrite `sections.ts` as a pure function of progress**

Replace the `element.animate()` fade entirely. Each frame, for each section element, compute a target opacity from `(id, mix)` and assign it. The outgoing and incoming sections overlap: use a crossfade band (fade the outgoing section out over the first half of the band and the incoming one in over the second half, via `smoothstep`) so one hands over to the other rather than switching at a point.

Rules: no `element.animate()`, no `setTimeout`, no CSS `transition` on opacity or transform. Writing the same value twice must be cheap — cache the last value written per element and skip the DOM write when unchanged (avoids per-frame style invalidation). Keep `is-active` toggling for `pointer-events`.

**Reduced motion:** no translate offset, and opacity switches at the band's midpoint — still no independent animation.

- [ ] **Step 4: Unit-test the crossfade**

Test the opacity function directly (keep it exported and pure, separate from DOM writing): at mix 0 the current section is fully visible and the next is at 0; across the band the two sum sensibly and neither flickers; scrolling backwards produces exactly the mirrored values. Assert reduced motion produces a hard switch with no intermediate offset.

- [ ] **Step 5: Wire it up**

In `boot.ts`, call `sections.show(state.section, state.sectionMix, ctx.reducedMotion)` in the same position in the frame order (§5.3): scroll → resolve → update → sections → render → HUD → governor. Do not add allocation.

- [ ] **Step 6: Commit**

```bash
git add src/journey/timeline.ts src/journey/types.ts src/overlay/sections.ts src/app/boot.ts tests/unit/timeline.test.ts tests/unit/sections.test.ts
git commit -m "fix: drive section text from scroll position instead of a timer"
```

**Walkthrough (for the owner):** before, crossing 45% of the region flipped a switch and a 900 ms animation played on its own clock — so the text ignored how fast you scrolled and wouldn't rewind. Now the text's opacity is computed from exactly where you are; scroll back and it un-fades, stop and it holds.

**Check (owner):** scroll slowly through the intro→about boundary, then back up. The text should follow your finger both ways, with a brief moment where both are partly visible.

---

### Task 4: Tonight's real lunar phase

**Files:**
- Create: `src/regions/moonsink/moonPhase.ts`
- Modify: `src/regions/moonsink/sea.ts` (two new uniforms; terminator on the disc; moonlight scaling)
- Modify: `src/regions/moonsink/index.ts` (set the uniforms once at construction)
- Modify: `src/app/params.ts` (`moon?: number` debug override)
- Test: `tests/unit/moonPhase.test.ts`

**Interfaces:**
- Produces:
  - `export function moonPhase(date: Date): number` — 0..1, 0 = new, 0.5 = full
  - `export function illuminatedFraction(phase: number): number` — 0..1
  - `export function moonLight(phase: number): number` — illumination after the floor is applied
  - `export const MIN_MOON_LIGHT: number`

- [ ] **Step 1: The pure module**

```ts
/** Reference new moon: 2000-01-06 18:14 UTC. */
const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14) ;
const SYNODIC_MONTH_DAYS = 29.530588853;
const MS_PER_DAY = 86_400_000;

/** 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter. */
export function moonPhase(date: Date): number {
  const days = (date.getTime() - NEW_MOON_EPOCH_MS) / MS_PER_DAY;
  const cycles = days / SYNODIC_MONTH_DAYS;
  return cycles - Math.floor(cycles);
}

/** Lit fraction of the disc: 0 at new, 1 at full. */
export function illuminatedFraction(phase: number): number {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}
```

`MIN_MOON_LIGHT = 0.22` and `moonLight(phase) = MIN_MOON_LIGHT + (1 - MIN_MOON_LIGHT) * illuminatedFraction(phase)` — the owner's floor (§5.4b), so a new-moon night still reads.

- [ ] **Step 2: Unit-test it against known dates**

Assert `moonPhase` is within ±0.02 of the true phase for at least four real dates spanning a year (look them up and cite the source in a comment); that the result is always in [0,1); that `illuminatedFraction` is 0 at phase 0, 1 at 0.5, and 0.5 at both 0.25 and 0.75; and that `moonLight` never returns below `MIN_MOON_LIGHT` nor above 1. Include a test that the function is deterministic for a fixed `Date`.

- [ ] **Step 3: Feed the shader**

Add uniforms `moonPhase` (float, 0..1) and `moonLight` (float). Set them once in `createMoonsink` from `new Date()`, or from `params.moon` when that is given (a 0..1 override for tests and for the owner to preview any phase).

- [ ] **Step 4: Draw the terminator**

The moon is currently a flat disc. Shape it: the lit region is the disc intersected with a half-plane offset by an ellipse whose semi-minor axis is `cos(2π·phase)` of the radius, with the sign choosing which limb is lit (waxing lights the trailing limb, waning the leading one). Keep the soft edge that exists today. **This must be a pure TSL function taking phase as a parameter (§17 S2)** — no uniform reads inside a `setLayout` body — and must not use reversed `smoothstep` edges (§17 S3).

- [ ] **Step 5: Scale the moonlight**

Multiply the moon's contribution to the water — the specular path, the glitter and the sky glow near the moon — by the `moonLight` uniform. The star field must **not** be scaled down with it. Do not touch the fog or horizon colour: this changes how much the moon lights the sea, not the palette (§3.3).

- [ ] **Step 6: Check the darkest case for contrast**

With `?moon=0` (new moon, illumination at the floor), confirm the text still meets 4.5:1 against the scene behind it (§10.4). If it does not, raise `MIN_MOON_LIGHT` — not the text's opacity — and say so in the report.

- [ ] **Step 7: Commit**

```bash
git add src/regions/moonsink/moonPhase.ts src/regions/moonsink/sea.ts src/regions/moonsink/index.ts src/app/params.ts tests/unit/moonPhase.test.ts
git commit -m "feat: show tonight's real lunar phase on the moon and the water"
```

**Walkthrough (for the owner):** `moonPhase.ts` is about fifteen lines of arithmetic — days since a known new moon, divided by the length of a lunar month, keeping the remainder. No library, no network. The moon's disc gets a real terminator (the curved shadow edge), and how brightly it lights the water follows the phase, with a floor so a new-moon night is never a black page. `?moon=0.5` previews a full moon any night.

**Check (owner):** open the site tonight, then compare the moon's shape to the real one outside. Try `?moon=0`, `?moon=0.25`, `?moon=0.5`.

---

### Task 5: Keep the sea in frame while the About text is read

**Files:**
- Modify: `src/regions/moonsink/cameraPath.ts` (keyframes)
- Test: `tests/unit/cameraPath.test.ts`

**Interfaces:** unchanged — `MOONSINK_PATH` keeps its shape and `poseAt` its signature.

- [ ] **Step 1: Reproduce the problem**

At the About anchor the camera faces a near-black sky and shore, so the text sits on emptiness and the scene stops being the point (controller finding, 2026-09-14). Confirm it by reading the keyframes and reasoning about pitch and yaw at `local` ≈ 0.85.

- [ ] **Step 2: Re-aim the late keyframes**

Adjust the last two keyframes so the moon's path on the water stays in the upper half of the frame while the text occupies the lower half (§3.4 rule 5 — they must not overlap). Keep the journey's sense of travel: still rising and turning toward the shore, just not away from the light. Do not change the number of keyframes or the easing.

- [ ] **Step 3: Update the camera tests**

Existing assertions pin the old keyframe values; update them to the new ones and keep every behavioural assertion (monotonic travel, no roll, yaw within `MAX_YAW_SPEED`). Snapshot scratch objects with `{ ...pose }` before comparing (§17 note from the phase 1 fix wave).

- [ ] **Step 4: Commit**

```bash
git add src/regions/moonsink/cameraPath.ts tests/unit/cameraPath.test.ts
git commit -m "fix: keep the moonlit water in frame through the About section"
```

**Walkthrough (for the owner):** the camera was turning so far toward the dark shore that by the time the About text appeared there was nothing left to look at. Now it keeps the moon's reflection in the top half of the screen while you read.

**Check (owner):** scroll to About — the water should still be visible above the text.

---

### Task 6: Update the browser tests and the docs

**Files:**
- Modify: `tests/e2e/sections.spec.ts` (scroll-driven crossfade, not a discrete flip)
- Modify: `tests/e2e/a11y.spec.ts` (add a new-moon case)
- Modify: `tests/e2e/smoke.spec.ts` if it asserts anything about the ring
- Modify: `docs/superpowers/plans/2026-09-13-phase-1-moonsink-shore.md` (mark the superseded parts)

- [ ] **Step 1: Section test follows scroll**

Assert that at a scroll position inside the crossfade band **both** sections have an opacity strictly between 0 and 1, and that scrolling back reverses it. The old test asserted a discrete switch and will now be wrong.

- [ ] **Step 2: Accessibility at the darkest moon**

Add an axe run at `?moon=0&stills` — the floor exists precisely so this passes. Keep the existing cases.

- [ ] **Step 3: Note the supersession**

At the top of the phase 1 plan, add a short note that Tasks 8 (ring) and parts of 10/11 are superseded by this plan, with the date and the reason. Do not rewrite history in the old plan.

- [ ] **Step 4: Full verification**

`npx tsc --noEmit`, `npx tsc --noEmit -p tsconfig.node.json`, `npm run check`, `npm run test`, `npm run build`, `npm run size`. Report the numbers. The controller runs `npm run e2e` across all three browsers.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e docs/superpowers/plans
git commit -m "test: cover the scroll-driven crossfade and the darkest moon phase"
```

---

## After all tasks

Final whole-branch review against the amended spec — with §3.4 as an explicit review lens, since its absence is what let the cluttered build pass every previous gate. Then the owner reviews it on desktop and phone before any merge.
