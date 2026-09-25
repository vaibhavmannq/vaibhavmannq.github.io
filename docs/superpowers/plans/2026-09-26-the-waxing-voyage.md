# The Waxing Voyage Implementation Plan (plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved storyboard:
- the moon waxes from crescent to full as you scroll;
- the camera lands up the beach, so the sand is on screen;
- the name is on screen at first paint and the sea fades up under it;
- "Email me" in a header, and a rail of four moons;
- keyboard focus never lands on something invisible;
- all fonts self-hosted;
- a project card and a real case study;
- stills and cover re-rendered from the real scene.

**Architecture:** Two new pure functions carry the new motion: `journeyPhase(local, anchors)` for the moon and the
new `MOONSINK_PATH` keys for the camera. Both stay pure functions of scroll, like everything else. The black
opening, the gate and the scroll lock are removed:
- the HTML itself is the first paint;
- `welcome.ts` runs one timed arrival (header, rail, kicker);
- the canvas fades up once the GPU is ready.

`header.ts`, `chapterRail.ts` and `focusGlide.ts` are small DOM modules wired in `boot.ts`.

**Tech Stack:** TypeScript 7, Vite 8, Three.js 0.186 (WebGPU + TSL), GSAP 3.15 (SplitText, ScrambleText), Lenis 1.3,
Vitest 5, Playwright 1.63, Biome 2.5.

**Spec:** `docs/superpowers/specs/2026-09-25-waxing-voyage-design.md`, sections §2, §3, §4.3–§4.11, §6, §7, §8, §10
(S40–S43). Storyboard: https://claude.ai/artifact/QCL4tADM3udn13qavw7cZV, page "Storyboard".

## Global Constraints

- Branch `waxing-voyage`. **Never push.** Commits carry **no attribution trailers**.
- Commit messages: `feat: …`, `fix: …`, `perf: …`, `docs: …`, `test: …`, `style: …`, in lower case and plain
  words.
- No new runtime dependencies. JavaScript stays ≤ 330 kB gzip (`npm run size`).
- Everything visible is a pure function of scroll. The only exceptions: the eased text (S35/S44), the camera's damped
  follow, and opening E's one-shot arrival (§4.5).
- The moon and the sky never move (S27): yaw 0 and pitch −0.06 on every key.
- TSL `setLayout()` functions stay pure (S2).
- `?moon=` pins the phase and wins over the scroll. The contrast tests keep `?moon=0.5`, the worst case.
- Before every commit: `npm run check` is clean (no errors, no warnings) and `npm test` is green. Before every
  `src/` commit: `npm run build` passes. Stop anything on :4173 before any Playwright run.
- Judge visual things on `npm run preview` in the headed MCP browser (real Intel GPU), brought to the front first
  (S38: Chrome throttles obscured windows).
- Long bash heredocs fail here. Append multi-line text with PowerShell `[IO.File]::AppendAllText`, using UTF-8
  without a BOM and LF line endings.
- After each task, give the owner a plain-language walkthrough of what changed and why.

## Review Focus

1. **A deep link (`#/projects/moonlit`) or `?p=` straight into a later page:** the moon, the camera and the header
   must all show that page's state on the first frame, not a crescent that then waxes. Pinned in Task 1 (phase
   from `local`) and Task 3 (no gate).
2. **Scrolling back up:** the moon wanes exactly as it waxed, and the log reads the phase it shows. Pinned in Task
   1.
3. **Keyboard only:** Tab from the top reaches the header links, the rail, and each page's links, and every one is
   visible and on screen when it has focus. Pinned in Task 5.
4. **No JavaScript, or a boot failure:** the intro is readable with the name, the line and the email. The other
   pages show as the static fallback. Pinned in Task 3.
5. **A GPU that takes seconds to compile:** the text is usable meanwhile, "The sea is waking…" is announced, and
   scrolling works. Pinned in Task 3.

---

### Task 1: The moon waxes with the scroll

**Files:**
- Create: `src/journey/journeyMoon.ts`
- Modify: `src/regions/moonsink/index.ts` (phase every frame), `src/overlay/voyageLog.ts` (follows the shown
  phase), `src/app/boot.ts` (wiring, both loops)
- Test: `tests/unit/journeyMoon.test.ts` (create), `tests/unit/voyageLog.test.ts` (append),
  `tests/e2e/redesign.spec.ts` (append)

**Interfaces:**
- Consumes: `SHOWN_OFFSET` (`overlay/sections.ts`), `SectionAnchor` (`journey/types.ts`), `moonLight`
  (`moonPhase.ts`), `ANCHOR_EPSILON` (`journey/timeline.ts`).
- Produces:
  - `CHAPTER_PHASES: readonly [number, number, number, number]`, equal to `[0.08, 0.25, 0.375, 0.5]`
  - `journeyPhase(local: number, anchors: readonly SectionAnchor[]): number`
  - `reducedMotionPhase(local: number, anchors: readonly SectionAnchor[]): number`
  - `MoonsinkRegion.update(local, timeSeconds, dtSeconds)` now also sets the phase uniforms, from
    `journeyPhase`, or from the pinned `?moon=`.
  - `createVoyageLog(root: HTMLElement): { show(phase: number): void }`. It no longer takes a `phaseAt`.

- [ ] **Step 1: Write the failing unit tests**

`tests/unit/journeyMoon.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { journey } from '../../src/journey/journey.config';
import { CHAPTER_PHASES, journeyPhase, reducedMotionPhase } from '../../src/journey/journeyMoon';
import type { RegionSegment } from '../../src/journey/types';
import { SHOWN_OFFSET } from '../../src/overlay/sections';
import { illuminatedFraction } from '../../src/regions/moonsink/moonPhase';

const anchors = (journey[0] as RegionSegment).sections;
const shown = anchors.map((anchor) => anchor.from + SHOWN_OFFSET);

describe('journeyPhase (spec 2026-09-25 §4.3)', () => {
  it('reaches each chapter phase exactly where the chapter is fully shown', () => {
    expect(journeyPhase(0, anchors)).toBe(CHAPTER_PHASES[0]);
    for (let i = 1; i < 4; i++) expect(journeyPhase(shown[i] as number, anchors)).toBeCloseTo(CHAPTER_PHASES[i] as number, 10);
  });

  it('is a half cycle: a crescent at the start, full at the end, never new, never waning', () => {
    expect(illuminatedFraction(journeyPhase(0, anchors))).toBeCloseTo(0.06, 2);
    expect(journeyPhase(1, anchors)).toBe(0.5);
    let previous = -1;
    for (let i = 0; i <= 1000; i++) {
      const phase = journeyPhase(i / 1000, anchors);
      expect(phase).toBeGreaterThanOrEqual(previous);
      expect(phase).toBeGreaterThan(0.05);
      expect(phase).toBeLessThanOrEqual(0.5);
      previous = phase;
    }
  });

  // Review focus 2: scrolling back up is the same function, so the moon wanes exactly as it waxed.
  it('depends only on position, so scrolling back wanes it the same way', () => {
    expect(journeyPhase(0.4, anchors)).toBe(journeyPhase(0.4, anchors));
    expect(journeyPhase(0.45, anchors)).toBeGreaterThan(journeyPhase(0.4, anchors));
  });

  it('holds before the start and after Contact', () => {
    expect(journeyPhase(-0.2, anchors)).toBe(CHAPTER_PHASES[0]);
    expect(journeyPhase(0.95, anchors)).toBe(0.5);
  });
});

describe('reducedMotionPhase', () => {
  it('steps with the chapters, in the same cut as the camera and the text', () => {
    expect(reducedMotionPhase(0, anchors)).toBe(CHAPTER_PHASES[0]);
    expect(reducedMotionPhase((anchors[1]?.from ?? 0) - 1e-6, anchors)).toBe(CHAPTER_PHASES[0]);
    expect(reducedMotionPhase(anchors[1]?.from ?? 0, anchors)).toBe(CHAPTER_PHASES[1]);
    expect(reducedMotionPhase(anchors[3]?.from ?? 0, anchors)).toBe(CHAPTER_PHASES[3]);
  });
});
```

Append to `tests/unit/voyageLog.test.ts`:

```ts
describe('the log follows the journey moon', () => {
  it('names the crescent and the full moon the journey starts and ends with', () => {
    const night = new Date(2026, 8, 26, 22, 10);
    expect(formatLog(night, 0.08).moon).toBe('Waxing crescent · 6% lit');
    expect(formatLog(night, 0.375).moon).toBe('Waxing gibbous · 85% lit');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/journeyMoon.test.ts tests/unit/voyageLog.test.ts`
Expected: `journeyMoon.test.ts` fails because the module doesn't exist. `voyageLog` already passes, because
`formatLog` doesn't change. It is a guard, not a RED.

- [ ] **Step 3: Implement `src/journey/journeyMoon.ts`**

```ts
import { SHOWN_OFFSET } from '../overlay/sections';
import { ANCHOR_EPSILON } from './timeline';
import type { SectionAnchor } from './types';

/**
 * The moon each chapter shows once its text is fully shown (spec 2026-09-25 §4.3; owner's pick: a half cycle).
 * A waxing crescent (6% lit) at Adrift, first quarter at The shore, waxing gibbous (85%) at What washed ashore, full
 * at The water's edge. Never new, so the moon is always there to look at; never waning, so the ending is the
 * brightest moment.
 */
export const CHAPTER_PHASES = [0.08, 0.25, 0.375, 0.5] as const;

/**
 * The phase at this point of the journey: each chapter's phase where its text is fully shown, straight lines in
 * between, held before the first and after the last. A pure function of scroll, like the camera and the text, so
 * scrolling back wanes the moon exactly as it waxed.
 */
export function journeyPhase(local: number, anchors: readonly SectionAnchor[]): number {
  let previousAt = 0;
  let previousPhase: number = CHAPTER_PHASES[0];
  if (local <= 0) return previousPhase;
  for (let i = 1; i < anchors.length && i < CHAPTER_PHASES.length; i++) {
    const at = (anchors[i] as SectionAnchor).from + SHOWN_OFFSET;
    const phase = CHAPTER_PHASES[i] as number;
    if (local <= at) return previousPhase + ((local - previousAt) / (at - previousAt)) * (phase - previousPhase);
    previousAt = at;
    previousPhase = phase;
  }
  return previousPhase;
}

/** Under reduced motion the moon steps with the chapters, cutting at each anchor with the camera and the text. */
export function reducedMotionPhase(local: number, anchors: readonly SectionAnchor[]): number {
  let phase: number = CHAPTER_PHASES[0];
  for (let i = 0; i < anchors.length && i < CHAPTER_PHASES.length; i++) {
    if (local + ANCHOR_EPSILON >= (anchors[i] as SectionAnchor).from) phase = CHAPTER_PHASES[i] as number;
  }
  return phase;
}
```

- [ ] **Step 4: Run the unit tests**

Run: `npx vitest run tests/unit/journeyMoon.test.ts tests/unit/voyageLog.test.ts`
Expected: PASS.

- [ ] **Step 5: The region sets the phase every frame**

In `src/regions/moonsink/index.ts`:
- Replace the import `import { moonLight, resolveMoonPhase } from './moonPhase';` with
  `import { moonLight } from './moonPhase';`. Also add `import { journeyPhase, reducedMotionPhase } from '../../journey/journeyMoon';`
  and `import type { SectionAnchor } from '../../journey/types';`.
- Change the signature to
  `export function createMoonsink(ctx: RegionContext, anchors: readonly SectionAnchor[], moonOverride?: number, seaOptions: SeaOptions = {}): MoonsinkRegion {`.
- Replace the three lines from `const phase = resolveMoonPhase(new Date(), moonOverride);` down to the `moonLight`
  assignment with:

```ts
  // The moon waxes with the scroll (spec 2026-09-25 §4.3), unless `?moon=` pins it for a test or a review.
  let shownPhase = -1;
  const setPhase = (phase: number) => {
    if (phase === shownPhase) return;
    shownPhase = phase;
    sea.uniforms.moonPhase.value = phase;
    sea.uniforms.moonLight.value = moonLight(phase);
  };
  setPhase(moonOverride ?? journeyPhase(0, anchors));
```

- Add `readonly phase: number;` to the `MoonsinkRegion` interface, with the doc comment
  `/** The phase the moon shows right now, for the voyage log. */`.
- At the start of `update`, after `sea.uniforms.time.value = timeSeconds;`, add:

```ts
      setPhase(
        moonOverride ?? (ctx.reducedMotion ? reducedMotionPhase(local, anchors) : journeyPhase(local, anchors)),
      );
```

- In the returned object, add `get phase() { return shownPhase; },`.
- Update the file's doc comment on `moonOverride`: "`?moon=`: pins the phase (0..1) for tests and reviews;
  undefined lets the journey wax it."

- [ ] **Step 6: The voyage log shows the shown phase**

Replace `createVoyageLog` in `src/overlay/voyageLog.ts`. Keep `formatLog` exactly as it is.

```ts
/**
 * The voyage log at the top of the page: today's date and time, and the moon the scene shows now, which waxes as
 * the visitor travels (spec 2026-09-25 §4.11). `show` is called every frame and writes only when the words change.
 */
export function createVoyageLog(root: HTMLElement): { show(phase: number): void } {
  const when = root.querySelector('[data-log-when]');
  const moon = root.querySelector('[data-log-moon]');
  if (when === null || moon === null) throw new Error('#voyage-log is missing its parts');
  let phase = 0;
  let lastWhen = '';
  let lastMoon = '';
  const write = () => {
    const text = formatLog(new Date(), phase);
    if (text.when !== lastWhen) when.textContent = lastWhen = text.when;
    if (text.moon !== lastMoon) moon.textContent = lastMoon = text.moon;
  };
  window.setInterval(write, 30_000);
  return {
    show(next) {
      phase = next;
      write();
    },
  };
}
```

- [ ] **Step 7: Wire boot**

In `src/app/boot.ts`:
- Replace `createVoyageLog(byId('voyage-log'), (now) => resolveMoonPhase(now, params.moon));` with:

```ts
  // The log names the moon the scene shows, which waxes with the scroll (or `?moon=`, pinned).
  const log = createVoyageLog(byId('voyage-log'));
  const phaseFor = (local: number) =>
    params.moon ?? (ctx.reducedMotion ? reducedMotionPhase(local, anchors) : journeyPhase(local, anchors));
  log.show(phaseFor(state.a.local));
```

  Move these lines to just after `let state: JourneyState = resolve(p, activeJourney);`, so that `state` exists.
- Remove the now-unused `resolveMoonPhase` import. Import `journeyPhase` and `reducedMotionPhase` from
  `'../journey/journeyMoon'`.
- In the stills loop `step`, after `sections.show(…)`, add `log.show(phaseFor(state.a.local));`.
- In the 3D path, change
  `createMoonsink(ctx, params.moon, { march: …, glints: … })` to
  `createMoonsink(ctx, anchors, params.moon, { march: …, glints: … })`.
- In `onFrame`, after `region.update(…)`, add `log.show(region.phase);`.

- [ ] **Step 8: E2E — the log waxes with the page**

Append to `tests/e2e/redesign.spec.ts`:

```ts
// Spec 2026-09-25 §4.3: the moon waxes from a crescent at Adrift to full at the water's edge, and the log says so.
for (const [progress, moon] of [
  [0, 'Waxing crescent · 6% lit'],
  [0.335, 'First quarter · 50% lit'],
  [0.585, 'Waxing gibbous · 85% lit'],
  [0.92, 'Full moon · 100% lit'],
] as const) {
  test(`the log reads "${moon}" at ${progress}`, async ({ page }) => {
    await page.goto(`/?stills&p=${progress}`);
    await expect(page.locator('#voyage-log [data-log-moon]')).toHaveText(moon);
  });
}
```

Run: `npm run check; npm test; npm run build`, then stop :4173 and run
`npx playwright test tests/e2e/redesign.spec.ts`.
Expected: all green. The existing `?moon=0.5` log test still reads "Full moon · 100% lit", because the pin wins.

- [ ] **Step 9: See it**

Run `npm run preview`. In the MCP browser, brought to the front, at 1280×720, screenshot `/?tier=3&p=<p>&time=12`
for p = 0, 0.335, 0.585 and 0.92. Hide the text with `#content{opacity:0 !important}`. The crescent, quarter,
gibbous and full moon must match storyboard frames I–IV, as far as this plan's camera allows; Task 2 changes the
camera. Stop the preview.

- [ ] **Step 10: Commit**

```bash
git add src/journey/journeyMoon.ts src/regions/moonsink/index.ts src/overlay/voyageLog.ts src/app/boot.ts tests/unit/journeyMoon.test.ts tests/unit/voyageLog.test.ts tests/e2e/redesign.spec.ts
git commit -m "feat: wax the moon from crescent to full as the voyage goes, and let the log name it"
```

---

### Task 2: The camera lands up the beach

**Files:**
- Modify: `src/journey/journey.config.ts` (`MOONSINK_SHORE_AT`)
- Modify: `src/regions/moonsink/cameraPath.ts` (`MOONSINK_PATH` and its comment)
- Test: `tests/unit/cameraPath.test.ts`, `tests/unit/journeyConfig.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `MOONSINK_SHORE_AT = 2.0 / MOONSINK_LENGTH`
  - `MOONSINK_PATH` with 6 keys:
    `[0, SHORE/3, 2·SHORE/3, SHORE, MOONSINK_WALK_END, 1]`

- [ ] **Step 1: Update the tests to the approved path (they fail on today's keys)**

In `tests/unit/journeyConfig.test.ts`, in the test named
`'starts each page just after the camera arrives…'`, replace
`expect(MOONSINK_SHORE_AT * MOONSINK_LENGTH).toBeCloseTo(2.7, 10);` with:

```ts
    // Up the beach, so the surf is under About's text and the sand is in view from here on (spec 2026-09-25 §4.4).
    expect(MOONSINK_SHORE_AT * MOONSINK_LENGTH).toBeCloseTo(2.0, 10);
```

In `tests/unit/cameraPath.test.ts`:

Replace the test `'keeps the drift to the shore evenly spaced, then walks the shoreline to the end'` with:

```ts
  it('keeps the drift to the shore evenly spaced, then walks the sand to the end', () => {
    const shore = MOONSINK_SHORE_AT;
    expect(MOONSINK_PATH.map((key) => key.at)).toEqual([0, shore / 3, (2 * shore) / 3, shore, MOONSINK_WALK_END, 1]);
  });

  // Spec 2026-09-25 §4.4 (owner's pick): the camera lands up the beach so the black sand is on screen.
  it('lands on the sand, well up the beach, and never below the sand it stands on', () => {
    const landed = { ...poseAt(MOONSINK_PATH, MOONSINK_SHORE_AT) };
    expect(landed.z).toBeLessThanOrEqual(-12);
    // sea.ts sandH peaks at −0.07·z + 0.025 (surfaceTop.ts): every key stays at least half a unit above it.
    for (const key of MOONSINK_PATH) expect(key.y - (-0.07 * key.z + 0.025)).toBeGreaterThan(0.5);
  });
```

In `'steps toward the sea for Contact and stops short of the foam line'`, the assertions still hold: z −8.5 is
more than −12, y 1.25 is less than 1.8, and −8.5 is less than −1.7. Leave that test alone.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/cameraPath.test.ts tests/unit/journeyConfig.test.ts`
Expected: FAIL on the landing (2.7 ≠ 2.0), the key list (7 keys ≠ 6) and `landed.z` (−5.5 > −12).

- [ ] **Step 3: Implement**

In `src/journey/journey.config.ts`, replace the `MOONSINK_SHORE_AT` doc comment and value with:

```ts
/**
 * Where the camera lands on the black sand, up the beach, then walks along it. At 2.0 screens (was 2.7) the surf is
 * already curving in under About's text, and the sand is in view for Projects and Contact (spec 2026-09-25 §4.4,
 * owner's pick from the storyboard).
 */
export const MOONSINK_SHORE_AT = 2.0 / MOONSINK_LENGTH;
```

In `src/regions/moonsink/cameraPath.ts`, replace the comment block above `const SHORE` and the
`MOONSINK_PATH` array with:

```ts
// Pages 1 and 2 drift from the open sea toward the shore, keys spread evenly up to the moment the camera lands
// (MOONSINK_SHORE_AT). It lands up the beach (z −12), so the surf is under About's text and the black sand is in view
// from then on; the old landing at z −5.5 stood at the waterline and never showed the sand. Page 3, Projects, walks
// along the sand: only x changes, so the foam stays at the same distance. Page 4, Contact, steps toward the sea and
// crouches, stopping on the sand (spec 2026-09-25 §4.4; owner's picks 2026-09-21 and 2026-09-25).
const SHORE = MOONSINK_SHORE_AT;

export const MOONSINK_PATH: readonly CameraKey[] = [
  { at: 0, x: 0, y: 3.2, z: 34, yaw: VIEW_YAW, pitch: VIEW_PITCH },
  { at: SHORE / 3, x: -2, y: 6, z: 26, yaw: VIEW_YAW, pitch: VIEW_PITCH },
  { at: (2 * SHORE) / 3, x: 1, y: 2.2, z: 9, yaw: VIEW_YAW, pitch: VIEW_PITCH },
  { at: SHORE, x: 2.5, y: 1.8, z: -12, yaw: VIEW_YAW, pitch: VIEW_PITCH },
  { at: MOONSINK_WALK_END, x: -8, y: 1.8, z: -12, yaw: VIEW_YAW, pitch: VIEW_PITCH },
  { at: 1, x: -8, y: 1.25, z: -8.5, yaw: VIEW_YAW, pitch: VIEW_PITCH },
];
```

- [ ] **Step 4: Run all unit tests**

Run: `npm test`
Expected: PASS. The moon-in-frame, turning, reduced-motion handover and surfaceTop tests are unchanged and green:
yaw and pitch did not change, and the reduced-motion cuts read the same constants.

- [ ] **Step 5: See it, on the real GPU**

Run `npm run build`, then `npm run preview`. In the MCP browser, brought to the front, with the text hidden,
screenshot at 1280×720 and 390×844 (`?tier=3&time=12&p=…`) for p = 0, 0.335, 0.585, 0.835 and 1. Compare with the
storyboard filmstrip:
- The shore (0.335) shows the surf curving in at the bottom right on desktop, and sand on the phone.
- 0.585 and 0.835 show black sand and foam.
- 1 shows the moon on wet sand.

Save the shots under `V:/Pdf/Project/.playwright-mcp/` for the owner review. Stop the preview.

- [ ] **Step 6: Commit**

```bash
git add src/journey/journey.config.ts src/regions/moonsink/cameraPath.ts tests/unit/cameraPath.test.ts tests/unit/journeyConfig.test.ts
git commit -m "feat: land the camera up the beach so the black sand is on screen"
```

---

### Task 3: Opening E — the name at first paint, the sea fades up under it

**Files:**
- Delete: `src/overlay/gate.ts`, `src/overlay/opening.ts`, `tests/unit/opening.test.ts`, `tests/e2e/gate.spec.ts`
- Create: `src/overlay/welcome.ts`, `tests/e2e/opening.spec.ts`
- Modify: `index.html` (opening removed; the intro kicker; the status line), `src/styles/overlay.css` (first
  paint, scene fade, settled state), `src/app/boot.ts` (no gate, no lock), `src/app/params.ts` and
  `tests/unit/params.test.ts` (`hold` removed), `src/overlay/nameMotion.ts` (no rise), `src/main.ts`
  (fallback)
- Modify tests that waited for the opening: `tests/e2e/smoke.spec.ts`, `tests/e2e/contact.spec.ts`,
  `tests/e2e/touchSnap.spec.ts`, `tests/e2e/projects.spec.ts`, `tests/e2e/sections.spec.ts`,
  `tests/e2e/a11y.spec.ts`

**Interfaces:**
- Consumes: `SplitText`/`ScrambleTextPlugin` (already registered in `sectionMotion.ts`).
- Produces:
  - `createWelcome(options: { kicker: HTMLElement; reducedMotion: () => boolean }): { sceneReady(): void; readonly settled: boolean }`
  - the classes `html.is-scene-ready` and `html.is-settled`;
  - the `#scene-status` status line;
  - `SETTLE_AFTER_MS = 1200`.

**Behaviour (spec §4.5):**
- First paint shows the intro: the kicker "Hello, voyager", the name and the line. Other sections are at opacity 0.
  The canvas is at opacity 0. The header and rail are hidden.
- Nothing waits: scrolling, links and the dialog work at once, over black.
- `sceneReady()` (3D warmed up, or stills started) adds `is-scene-ready`, which fades `.world` to 1 over 1.2 s
  (instantly under reduced motion) and clears the status line.
- The page settles `SETTLE_AFTER_MS` after navigation start or at `sceneReady()`, whichever is later:
  - `is-settled` fades the header and rail in over 0.6 s;
  - the intro kicker scrambles "Hello, voyager" → "I · Adrift" (switches under reduced motion);
  - `settled` becomes true.

- [ ] **Step 1: Write the failing e2e tests**

`tests/e2e/opening.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

// Opening E (spec 2026-09-25 §4.5): the name is the first paint, not a black screen. Before, it was readable 5.6 s in
// although the scene was ready at 0.23 s.

test('with no JavaScript the first paint is the intro: greeting, name, line', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('#intro-title')).toBeVisible();
  await expect(page.locator('#intro-title')).toHaveText('Vaibhav Mann');
  await expect(page.locator('#intro [data-welcome]')).toHaveText('Hello, voyager');
  await expect(page.locator('#intro .section__lede')).toBeVisible();
  expect(await page.locator('#intro').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  await context.close();
});

test('the name is on screen before the scene is ready, and nothing waits for it', async ({ page }) => {
  // Hold the renderer back: the page must already be readable and scrollable.
  await page.route('**/assets/*.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.goto('/?stills');
  await expect(page.locator('#intro-title')).toBeVisible();
  expect(await page.locator('#intro').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  await expect(page.locator('#opening')).toHaveCount(0);
});

test('it settles: the header and rail arrive and the greeting becomes the chapter title', async ({ page }) => {
  await page.goto('/?stills');
  await expect(page.locator('html')).toHaveClass(/is-scene-ready/);
  await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
  await expect(page.locator('#intro [data-welcome]')).toHaveText('I · Adrift', { timeout: 5_000 });
  await expect(page.locator('#scene-status')).toHaveText('');
});

test('scrolling works at once: no lock while the scene wakes', async ({ page }) => {
  await page.goto('/?stills');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.__moonlit?.progress() ?? -1)).toBeGreaterThan(0.9);
});
```

- [ ] **Step 2: Run them to verify they fail**

Stop :4173, then run `npx playwright test tests/e2e/opening.spec.ts --project=chromium`.
Expected: FAIL:
- the no-JS intro is at opacity 0, and `[data-welcome]` doesn't exist;
- `#opening` still exists;
- `is-scene-ready` is never set.

- [ ] **Step 3: HTML**

In `index.html`:
- Delete the `<a class="skip-link" id="skip-intro" …>Skip intro</a>` line.
- Delete the whole `<div class="opening" id="opening" …> … </div>` block.
- Change `<html lang="en" class="is-gated">` to `<html lang="en">`.
- In `<noscript><style>`, delete the `html.is-gated` and `.opening` rules.
- In `#intro`, replace the kicker paragraph with:

```html
          <p class="section__kicker">
            <span class="visually-hidden">Chapter one: Adrift</span>
            <span aria-hidden="true" data-welcome="I · Adrift">Hello, voyager</span>
          </p>
```

- Replace `<p class="visually-hidden" id="load-status" role="status">Loading the scene…</p>` with:

```html
      <p class="scene-status" id="scene-status" role="status">The sea is waking…</p>
```

The `<svg class="sprite">` glyph symbol is no longer used. Delete it.

- [ ] **Step 4: CSS**

In `src/styles/overlay.css`:
- Delete the rules `html.is-gated { … }`, `html.is-gated .content { … }` and every `.opening…` rule, including
  `.opening[hidden]`, `.opening.is-leaving`, `.opening__glyph`, `.opening__hello`, `.opening__line` and
  `.opening > *`. Delete the `.skip-link` rules.
- In the reduced-motion blocks, delete the `.opening` selectors.
- In `.content`, delete `transition: opacity 0.8s ease 2s;` and its comment. The text layer no longer waits.
- Replace `.world { … }` with the same rule plus the fade, and add the rules below it:

```css
.world {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 0;
  width: 100%;
  /* The large viewport never changes as a phone's toolbar shows or hides. Android only resizes the
     page once a scroll ends, so a viewport-sized scene jumped at the end of every swipe. */
  height: 100lvh;
  /* Opening E (spec 2026-09-25 §4.5): the text is the first paint; the sea fades up beneath it once the GPU is
     ready (html.is-scene-ready, overlay/welcome.ts). */
  opacity: 0;
  transition: opacity 1.2s ease;
}

html.is-scene-ready .world {
  opacity: 1;
}

/* The intro is the first paint, with or without JavaScript; later pages wait for the handover (sections.ts). */
#intro {
  opacity: 1;
}

/* What arrives once the page settles: the header and the rail (Task 4 adds them to this rule). */
.welcome-arrives {
  opacity: 0;
  transition: opacity 0.6s ease;
}

html.is-settled .welcome-arrives {
  opacity: 1;
}

.scene-status {
  position: absolute;
  bottom: max(1.25rem, env(safe-area-inset-bottom));
  left: max(1.25rem, env(safe-area-inset-left));
  margin: 0;
  color: rgba(230, 238, 240, 0.45);
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}
```

- In both reduced-motion blocks, add `.world` and `.welcome-arrives` to the `transition: none` selectors.

- [ ] **Step 5: `src/overlay/welcome.ts`**

```ts
import gsap from 'gsap';

/** How long after navigation starts the page settles, if the scene is ready by then (spec 2026-09-25 §4.5). */
export const SETTLE_AFTER_MS = 1200;

const KICKER_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ·';

export interface Welcome {
  /** The scene is on screen (3D warmed up, or stills started): fade it up, clear the status line. */
  sceneReady(): void;
  /** True once the header, the rail and the chapter title have arrived. */
  readonly settled: boolean;
}

/**
 * Opening E (spec 2026-09-25 §4.5). The HTML is already the first paint: the greeting, the name, the line. This
 * only runs the one arrival that happens on a clock, never on scroll: the sea fades up once it is ready, and
 * SETTLE_AFTER_MS after the page began (or at that moment, if later) the header and rail fade in and the greeting
 * types itself into the chapter title. Nothing is locked meanwhile.
 */
export function createWelcome(options: { kicker: HTMLElement; reducedMotion: () => boolean }): Welcome {
  const root = document.documentElement;
  const status = document.getElementById('scene-status');
  const title = options.kicker.dataset.welcome ?? '';
  let ready = false;
  let settled = false;

  const settle = () => {
    if (settled || !ready) return;
    settled = true;
    root.classList.add('is-settled');
    if (options.reducedMotion()) {
      options.kicker.textContent = title;
      return;
    }
    gsap.to(options.kicker, {
      scrambleText: { text: title, chars: KICKER_CHARS, speed: 0.6 },
      duration: 0.9,
      ease: 'none',
    });
  };
  window.setTimeout(settle, Math.max(0, SETTLE_AFTER_MS - performance.now()));

  return {
    sceneReady() {
      if (ready) return;
      ready = true;
      root.classList.add('is-scene-ready');
      if (status) status.textContent = '';
      if (performance.now() >= SETTLE_AFTER_MS) settle();
    },
    get settled() {
      return settled;
    },
  };
}
```

`ScrambleTextPlugin` is registered in `sectionMotion.ts`, which boot imports first. Add
`import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'; gsap.registerPlugin(ScrambleTextPlugin);` at the top
of `welcome.ts` as well, so the module works on its own.

- [ ] **Step 6: Boot without a gate**

In `src/app/boot.ts`:
- Remove the imports of `createGate` and `createOpening`. Import `createWelcome` from `'../overlay/welcome'`.
- Delete `openingElement`, `gate`, `opening`, `openWhenReady`, every `gate.…` and `opening.…` call, the
  `skip-intro` listener and `scroll.setLocked(true);`.
- After `const name = createNameMotion(byId('intro-title'));`, add:

```ts
  const welcome = createWelcome({
    kicker: byId('intro').querySelector<HTMLElement>('[data-welcome]') ?? byId('intro-title'),
    reducedMotion: () => ctx.reducedMotion,
  });
```

- In the dialog's `onClosed`, replace `if (gate.state === 'entered') scroll.setLocked(false);` with
  `scroll.setLocked(false);`.
- In `createTouchSnap`, `enabled: () => params.p === undefined && !dialog.isOpen,`.
- In `createPointerTouch`, `swellActive: () => !ctx.reducedMotion && welcome.settled && state.section === 'intro',`.
- Delete the `gate.onEnter(() => { scroll.setLocked(false); name.rise(…); });` block.
- In the `params.p !== undefined` block and the deep-link block, delete the `gate.enter(); opening.dismiss();`
  lines, and delete the `if (params.p !== undefined) { … }` block if it is left empty.
- In `startStills`, replace `gate.setReady(); openWhenReady();` with `welcome.sceneReady();`.
- In the 3D path, replace `region.setEntered` usage: after `const region = createMoonsink(…);` add
  `region.setEntered(true);` and delete the two `gate.onEnter(() => region.setEntered(true))` lines.
- Replace `moonlit.warmUp(); gate.setReady(); openWhenReady();` with `moonlit.warmUp(); welcome.sceneReady();`.
- Replace the `enteredAt` logic with `const enteredAt = performance.now();`, set right before `loop.start(…)`.
  The governor's warm-up is then 1.5 s after frames begin.

In `src/overlay/nameMotion.ts`, delete `rise` from the `NameMotion` interface and the implementation, along with
the `risen` variable. The name is on screen at first paint, and a rise would make it vanish first. Keep the split
and `chars` for the pointer swell. Update the file's doc comment to say so.

In `src/app/params.ts`, delete `hold` from `DebugParams` and from `readDebugParams`. In
`tests/unit/params.test.ts`, delete the `hold` key from the defaults object and the whole
`'reads a hold in milliseconds…'` test.

In `src/main.ts`, delete the lines that touch `is-gated` and `#opening`. Keep the `is-broken` fallback. Add
`document.documentElement.classList.add('is-scene-ready');`, so that a failed boot still shows the (empty) stage
rather than holding it at opacity 0.

Delete `src/overlay/gate.ts`, `src/overlay/opening.ts`, `tests/unit/opening.test.ts` and
`tests/e2e/gate.spec.ts`: `git rm` them.

- [ ] **Step 7: Update the tests that waited for the black opening**

- `tests/e2e/smoke.spec.ts`:
  - In the first test, replace `/?time=4&hold=600000` with `/?time=4`.
  - Replace the two `.opening__hello` expectations with
    `await expect(page.locator('#intro-title')).toBeVisible();`.
  - In `'stills mode keeps the page usable'`, replace `await expect(page.locator('#opening')).toBeHidden(…)` with
    `await expect(page.locator('html')).toHaveClass(/is-scene-ready/);`.
- `tests/e2e/contact.spec.ts`, `tests/e2e/touchSnap.spec.ts` (both tests) and `tests/e2e/projects.spec.ts`:
  replace each `await expect(page.locator('#opening')).toBeHidden(…)` with
  `await expect(page.locator('html')).toHaveClass(/is-scene-ready/);`. In `projects.spec.ts`, the deep-link test's
  `#opening` line becomes that too.
- `tests/e2e/sections.spec.ts`, in the fast-scroll test:
  - replace `'/?stills&hold=0'` with `'/?stills'`;
  - replace the `#content` opacity poll with
    `await expect(page.locator('html')).toHaveClass(/is-scene-ready/);`.
- `tests/e2e/a11y.spec.ts`: replace the `'the opening has no axe violations'` test with:

```ts
  test('the first paint has no axe violations', async ({ page }) => {
    await page.goto('/?stills');
    await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
```

  In the contrast tests, the `#content` opacity poll stays; `.content` now has no transition, so it passes at once.

- [ ] **Step 8: Run everything**

Run: `npm run check; npm test; npm run build; npm run size`, then stop :4173 and run `npm run e2e`.
Expected: all green; `opening.spec.ts` passes in all three browsers. If `ScrambleText` leaves `[data-welcome]` with
trailing scramble characters when the test reads it, the `toHaveText` poll waits for the end. Do not shorten the
scramble to make a test pass.

- [ ] **Step 9: See it**

In the headed MCP browser, open `/` with the cache disabled, via `page.route` with no cache, or a fresh context.
Take screenshots at 0 ms (as soon as `domcontentloaded` fires), at 600 ms and at 2.5 s. Compare with the
storyboard's opening row:
- the name and the line on black;
- the sea fading up;
- settled, with the log, the rail and the call to action.

Report the time to the first visible name, from `performance.getEntriesByName('first-contentful-paint')`.

- [ ] **Step 10: Commit**

```bash
git add -A index.html src tests
git commit -m "feat: open on the name at first paint and fade the sea up under it, with nothing locked"
```

---

### Task 4: The header and the rail of four moons

**Files:**
- Create: `src/overlay/header.ts`, `src/overlay/chapterRail.ts`, `tests/unit/chapterRail.test.ts`,
  `tests/e2e/navigation.spec.ts`
- Modify: `index.html` (the header replaces the bare log; the rail), `src/styles/overlay.css` (header, rail),
  `src/app/boot.ts` (wiring; the moon glyph phases come from `CHAPTER_PHASES`)

**Interfaces:**
- Consumes:
  - `CHAPTER_PHASES` (Task 1);
  - `SHOWN_OFFSET`;
  - `progressForSection` (`timeline.ts`);
  - `scroll.glideToProgress(p, smooth)`;
  - the `.welcome-arrives` class (Task 3).
- Produces:
  - `moonGlyphPath(phase: number): string`: the SVG path of the lit part in a 24 × 24 box, radius 10, waxing.
  - `createChapterRail(root: HTMLElement, options: { go: (id: SectionId) => void }): { show(section: SectionId): void }`
  - `bindGoLinks(root: ParentNode, options: { go: (id: SectionId) => void }): void`

- [ ] **Step 1: Write the failing unit test**

`tests/unit/chapterRail.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { moonGlyphPath } from '../../src/overlay/chapterRail';

// The rail draws each chapter's moon (spec 2026-09-25 §4.6), with the same terminator maths as sea.ts moonLit: the
// lit limb on the right (waxing) and an ellipse of half-width |cos 2πφ| × r bounding it.
describe('moonGlyphPath', () => {
  it('draws the crescent as the right limb minus an ellipse bulging right', () => {
    expect(moonGlyphPath(0.08)).toBe('M12 2A10 10 0 0 1 12 22A8.76 10 0 0 0 12 2Z');
  });

  it('draws the first quarter as the right half', () => {
    expect(moonGlyphPath(0.25)).toBe('M12 2A10 10 0 0 1 12 22A0 10 0 0 0 12 2Z');
  });

  it('draws the gibbous moon as the right limb plus an ellipse bulging left', () => {
    expect(moonGlyphPath(0.375)).toBe('M12 2A10 10 0 0 1 12 22A7.07 10 0 0 1 12 2Z');
  });

  it('draws the full moon as the whole disc', () => {
    expect(moonGlyphPath(0.5)).toBe('M12 2A10 10 0 0 1 12 22A10 10 0 0 1 12 2Z');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/chapterRail.test.ts`
Expected: FAIL. The module doesn't exist.

- [ ] **Step 3: `src/overlay/chapterRail.ts`**

```ts
import type { SectionId } from '../journey/types';

/**
 * The lit part of a waxing moon in a 24 × 24 box, radius 10, as an SVG path. The right limb is a half circle; the
 * terminator is a half ellipse of half-width |cos 2πφ| × 10, bulging right while less than half is lit and left once
 * more is (the same maths as the sea's moonLit, so the rail and the sky agree). Pure.
 */
export function moonGlyphPath(phase: number): string {
  const k = Math.cos(phase * Math.PI * 2);
  const rx = Math.round(Math.abs(k) * 1000) / 100;
  const sweep = k > 0 ? 0 : 1;
  return `M12 2A10 10 0 0 1 12 22A${rx} 10 0 0 ${sweep} 12 2Z`;
}

const IDS: readonly SectionId[] = ['intro', 'about', 'projects', 'contact'];

/**
 * The rail of four moons (spec 2026-09-25 §4.6): where you are, and a way to jump. The links are in index.html (they
 * work without JavaScript, as plain in-page links); this marks the current chapter and turns a click into a glide.
 */
export function createChapterRail(root: HTMLElement, options: { go: (id: SectionId) => void }) {
  const links = new Map<SectionId, HTMLAnchorElement>();
  for (const id of IDS) {
    const link = root.querySelector<HTMLAnchorElement>(`a[href="#${id}"]`);
    if (link === null) throw new Error(`the rail has no link to #${id}`);
    links.set(id, link);
    link.addEventListener('click', (event) => {
      event.preventDefault();
      options.go(id);
    });
  }
  let current: SectionId | null = null;
  return {
    show(section: SectionId) {
      if (section === current) return;
      if (current !== null) links.get(current)?.removeAttribute('aria-current');
      links.get(section)?.setAttribute('aria-current', 'step');
      current = section;
    },
  };
}
```

- [ ] **Step 4: Run it**

Run: `npx vitest run tests/unit/chapterRail.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: `src/overlay/header.ts`**

```ts
import type { SectionId } from '../journey/types';

const IDS: readonly string[] = ['intro', 'about', 'projects', 'contact'];

/**
 * Links that take the visitor to a chapter (spec 2026-09-25 §4.6): Work and About in the header, and "See the work"
 * on the first page. Each is a plain in-page link that works without JavaScript; with it, the journey glides there
 * instead of jumping. "Email me" is a plain mailto link and needs nothing from here.
 */
export function bindGoLinks(root: ParentNode, options: { go: (id: SectionId) => void }): void {
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[data-go]')) {
    const id = link.dataset.go ?? '';
    if (!IDS.includes(id)) throw new Error(`data-go="${id}" is not a chapter`);
    link.addEventListener('click', (event) => {
      event.preventDefault();
      options.go(id as SectionId);
    });
  }
}
```

- [ ] **Step 6: HTML**

In `index.html`, replace the `<p class="voyage-log" id="voyage-log">…</p>` block with:

```html
      <header class="site-header welcome-arrives" id="site-header">
        <p class="voyage-log" id="voyage-log">
          <span>Log</span>
          <span data-log-when></span>
          <span class="voyage-log__moon" data-log-moon></span>
        </p>
        <nav class="site-nav" aria-label="Main">
          <a href="#projects" data-go="projects">Work</a>
          <a href="#about" data-go="about">About</a>
          <a class="site-nav__email" href="mailto:vaibhavmann.03@gmail.com">Email me</a>
        </nav>
      </header>
      <nav class="chapter-rail welcome-arrives" id="chapter-rail" aria-label="Chapters">
        <a href="#intro"><span>I · Adrift</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path data-phase="0.08" /></svg></a>
        <a href="#about"><span>II · The shore</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path data-phase="0.25" /></svg></a>
        <a href="#projects"><span>III · What washed ashore</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path data-phase="0.375" /></svg></a>
        <a href="#contact"><span>IV · The water's edge</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path data-phase="0.5" /></svg></a>
      </nav>
```

Boot fills each `path[data-phase]`'s `d` from `moonGlyphPath(Number(path.dataset.phase))`, so the glyphs and the
sky use one formula.

In `#intro`, after the `section__lede` paragraph and before the `section__hint`, add the storyboard's call to action.
It arrives with the header:

```html
          <p class="section__actions welcome-arrives">
            <a class="section__cta" href="#projects" data-go="projects">See the work <span aria-hidden="true">→</span></a>
            <a class="section__email" href="mailto:vaibhavmann.03@gmail.com">vaibhavmann.03@gmail.com</a>
          </p>
```

In `<noscript><style>`, add `.welcome-arrives { opacity: 1; }`, so that without JavaScript the header, the rail
and the call to action show (review focus 4).

- [ ] **Step 7: CSS**

Append to `src/styles/overlay.css`, before the frame-fit rule:

```css
/* ---------- header and chapter rail (spec 2026-09-25 §4.6; storyboard frames) ---------- */
.site-header {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: max(0.5rem, env(safe-area-inset-top)) max(1.25rem, env(safe-area-inset-right)) 0
    max(1.25rem, env(safe-area-inset-left));
  pointer-events: auto;
}

.site-header .voyage-log {
  position: static;
}

.site-nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.site-nav a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--ink);
  text-decoration: none;
}

.site-nav .site-nav__email {
  padding: 0 1.1rem;
  border: 1px solid rgba(159, 230, 238, 0.45);
  border-radius: 999px;
}

.chapter-rail {
  position: absolute;
  top: 50%;
  right: max(1.5rem, env(safe-area-inset-right));
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  pointer-events: auto;
  translate: 0 -50%;
}

.chapter-rail a {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 44px;
  color: rgba(230, 238, 240, 0.6);
  text-decoration: none;
  text-shadow: 0 0 10px rgba(2, 4, 6, 0.95), 0 1px 2px rgba(2, 4, 6, 0.9);
}

.chapter-rail a[aria-current="step"] {
  color: var(--glow);
}

.chapter-rail svg {
  width: 16px;
  height: 16px;
  flex: none;
}

.chapter-rail circle {
  fill: none;
  stroke: currentColor;
  stroke-opacity: 0.45;
}

.chapter-rail path {
  fill: currentColor;
}

/* A boot failure falls back to the static layout (main.ts): show everything that would have arrived. */
html.is-broken .welcome-arrives {
  opacity: 1;
}

.section .section__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.25rem;
  max-width: none;
  margin-top: 1.6rem;
}

.section__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 48px;
  padding: 0 1.4rem;
  border-radius: 999px;
  background: var(--ink);
  color: #04161a;
  font-family: var(--font-display);
  font-weight: 500;
  text-decoration: none;
}

.section__email {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  color: var(--ink);
  text-decoration: underline;
  text-decoration-color: rgba(230, 238, 240, 0.35);
  text-underline-offset: 0.35em;
}

/* Phones: the rail is four moons in a row under the header, with names for screen readers only. */
@media (max-width: 699px) {
  .site-nav a:not(.site-nav__email) {
    display: none;
  }

  .chapter-rail {
    top: calc(max(0.5rem, env(safe-area-inset-top)) + 48px);
    right: auto;
    left: max(0.5rem, env(safe-area-inset-left));
    flex-direction: row;
    translate: none;
  }

  .chapter-rail a {
    justify-content: center;
    width: 44px;
  }

  .chapter-rail span {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
```

- [ ] **Step 8: Wire boot**

In `src/app/boot.ts`, after the `aboutShown`, `projectsShown` and `contactShown` constants, add:

```ts
  const introShown = 0;
  const shownAt: Record<SectionId, number> = {
    intro: introShown,
    about: aboutShown,
    projects: projectsShown,
    contact: contactShown,
  };
  // The rail, Work and About all glide to where a chapter is fully shown, then give its heading focus.
  const go = (id: SectionId) => {
    scroll.glideToProgress(shownAt[id], !ctx.reducedMotion);
    byId(id === 'intro' ? 'intro-title' : `${id}-title`).focus({ preventScroll: true });
  };
  for (const path of document.querySelectorAll<SVGPathElement>('#chapter-rail path[data-phase]')) {
    path.setAttribute('d', moonGlyphPath(Number(path.dataset.phase)));
  }
  const rail = createChapterRail(byId('chapter-rail'), { go });
  bindGoLinks(document, { go });
```

Import `type SectionId` from `'../journey/types'`, `createChapterRail, moonGlyphPath` from
`'../overlay/chapterRail'`, and `bindGoLinks` from `'../overlay/header'`. In both loops (stills `step` and
`onFrame`), after `sections.show(…)`, add `rail.show(state.section);`. Replace the `return-to-shore` listener
body with `go('intro');`.

- [ ] **Step 9: E2E**

`tests/e2e/navigation.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

// Spec 2026-09-25 §4.6: "Email me" on every page, and a rail that shows where you are and jumps.
for (const progress of [0, 0.36, 0.65, 0.92]) {
  test(`Email me is on screen at ${progress}`, async ({ page }) => {
    await page.goto(`/?stills&p=${progress}`);
    await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
    const email = page.locator('#site-header').getByRole('link', { name: 'Email me' });
    await expect(email).toBeVisible();
    await expect(email).toHaveAttribute('href', 'mailto:vaibhavmann.03@gmail.com');
  });
}

test('the rail marks the current chapter and jumps to another', async ({ page }) => {
  await page.goto('/?stills');
  await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
  const rail = page.getByRole('navigation', { name: 'Chapters' });
  await expect(rail.getByRole('link', { name: /I · Adrift/ })).toHaveAttribute('aria-current', 'step');
  await rail.getByRole('link', { name: /III · What washed ashore/ }).click();
  await expect(page.locator('#projects')).toHaveClass(/is-active/, { timeout: 5_000 });
  await expect.poll(() => page.locator('#projects').evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
  await expect(rail.getByRole('link', { name: /III · What washed ashore/ })).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('#projects-title')).toBeFocused();
});
```

Run: `npm run check; npm test; npm run build`, then stop :4173 and run
`npx playwright test tests/e2e/navigation.spec.ts tests/e2e/a11y.spec.ts tests/e2e/contact.spec.ts`.
Expected: PASS. axe must stay clean with the new header and rail.

- [ ] **Step 10: See it and commit**

In the MCP browser, check 1280×720 and 390×844 against storyboard frames I–IV: the header is at the top, the rail
on the right on desktop and as a row of moons on the phone, and the current moon is glow-blue. Then:

```bash
git add index.html src/overlay/header.ts src/overlay/chapterRail.ts src/styles/overlay.css src/app/boot.ts tests/unit/chapterRail.test.ts tests/e2e/navigation.spec.ts
git commit -m "feat: add a header with Email me on every page and a rail of four moons that shows the way"
```

---

### Task 5: Focus that never lands on something invisible, and the wheel-snap switch

**Files:**
- Create: `src/overlay/focusGlide.ts`, `tests/e2e/focus.spec.ts`
- Modify: `src/scroll/touchSnap.ts` (wheel input behind an option), `src/app/boot.ts`, `src/app/params.ts`,
  `tests/unit/params.test.ts`, `tests/unit/touchSnap.test.ts`

**Interfaces:**
- Consumes: `go`-style glide (Task 4), `shownAt`.
- Produces:
  - `createFocusGlide(options: { sectionOf: (el: Element) => SectionId | null; isShown: (id: SectionId) => boolean; glideTo: (id: SectionId) => void }): void`
  - `createTouchSnap({ …, wheel?: boolean })`
  - `DebugParams.snap?: 'wheel'`

- [ ] **Step 1: Write the failing e2e test**

`tests/e2e/focus.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

// Review 2026-09-25: Tab reached the project, email, GitHub, LinkedIn and Return links while their pages were at
// opacity 0, and nothing scrolled. Every focused element must be on screen once the glide settles (spec §4.6).
test('every Tab stop is visible once the page glides to it', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit only tabs to form controls by default, not links');
  await page.goto('/?stills');
  await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const el = document.activeElement;
            if (el === null || el === document.body) return 1;
            let opacity = 1;
            for (let node: Element | null = el; node !== null; node = node.parentElement) {
              opacity *= Number(getComputedStyle(node).opacity);
            }
            return opacity;
          }),
        { timeout: 4_000 },
      )
      .toBeGreaterThan(0.99);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Stop :4173, then run `npx playwright test tests/e2e/focus.spec.ts --project=chromium`.
Expected: FAIL. It times out on the first focused link inside a hidden section ("Moonlit").

- [ ] **Step 3: `src/overlay/focusGlide.ts`**

```ts
import type { SectionId } from '../journey/types';

/**
 * Nothing that has focus is ever invisible (spec 2026-09-25 §4.6). When focus moves into a page that is not the one
 * on screen (Tab, a screen reader, a script), the journey glides to where that page is fully shown. Pages stay in
 * the accessibility tree, as the master spec requires, so `inert` is not an option.
 */
export function createFocusGlide(options: {
  sectionOf: (element: Element) => SectionId | null;
  isShown: (id: SectionId) => boolean;
  glideTo: (id: SectionId) => void;
}): void {
  document.addEventListener('focusin', (event) => {
    if (!(event.target instanceof Element)) return;
    const id = options.sectionOf(event.target);
    if (id !== null && !options.isShown(id)) options.glideTo(id);
  });
}
```

In `boot.ts`, after `bindGoLinks(…)`:

```ts
  createFocusGlide({
    sectionOf: (element) => (element.closest<HTMLElement>('[data-section]')?.dataset.section as SectionId) ?? null,
    isShown: (id) => state.section === id,
    glideTo: (id) => scroll.glideToProgress(shownAt[id], !ctx.reducedMotion),
  });
```

- [ ] **Step 4: Run it**

Run: `npm run build`, stop :4173, then run `npx playwright test tests/e2e/focus.spec.ts`.
Expected: PASS in Chromium and Firefox; skipped in WebKit.

- [ ] **Step 5: The wheel-snap switch (failing unit test first)**

`touchSnapTarget` is already pure and tested. The new part is wiring the wheel to the same settle logic. Append to
`tests/unit/params.test.ts`:

```ts
  it('reads the wheel-snap switch', () => {
    expect(readDebugParams('?snap=wheel').snap).toBe('wheel');
    expect(readDebugParams('?snap=on').snap).toBeUndefined();
  });
```

Add `snap: undefined,` to the defaults object in the first test. Run `npx vitest run tests/unit/params.test.ts`.
Expected: FAIL.

Implement in `src/app/params.ts`: add the field
`/** \`?snap=wheel\`: mouse and trackpad snap to pages like touch (owner review, spec §7). */ snap?: 'wheel';` and
`snap: only('snap', 'wheel'),`. Run the test again. Expected: PASS.

In `src/scroll/touchSnap.ts`:
- Add `wheel?: boolean;` to `TouchSnapOptions`, with the doc comment
  `/** Mouse wheels and trackpads snap too (owner-review switch \`?snap=wheel\`). */`.
- In `createTouchSnap`, destructure `wheel = false`, and after the `touchstart` listener add:

```ts
  if (wheel) {
    // A wheel or trackpad scroll counts as one gesture from its first event until it has been still for SETTLE_MS.
    window.addEventListener(
      'wheel',
      () => {
        if (!pending) startP = progress();
        pending = true;
        settleSoon();
      },
      { passive: true },
    );
  }
```

- Change the doc comment on `createTouchSnap` to "Wires touchSnapTarget to touch (and, with `wheel`, mouse and
  trackpad) scrolling. Keys never snap."

In `boot.ts`, pass `wheel: params.snap === 'wheel'` to `createTouchSnap`.

- [ ] **Step 6: Run everything and commit**

Run: `npm run check; npm test; npm run build`, stop :4173, then run `npm run e2e`.
Expected: all green.

```bash
git add src/overlay/focusGlide.ts src/scroll/touchSnap.ts src/app/boot.ts src/app/params.ts tests/unit/params.test.ts tests/e2e/focus.spec.ts
git commit -m "fix: glide to a page when focus lands in it, and let mouse and trackpad snap behind a switch"
```

---

### Task 6: All fonts local, and the orphaned "hand:"

**Files:**
- Create: `public/fonts/fraunces-var-latin.woff2`, `public/fonts/space-mono-400-latin.woff2`
- Modify: `index.html` (no Google Fonts; preloads), `src/styles/base.css` (`@font-face`), `src/overlay/sectionMotion.ts` or `index.html` (orphan)
- Test: `tests/e2e/fonts.spec.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `Fraunces` and `Space Mono` served from `/fonts/`.

- [ ] **Step 1: Write the failing e2e test**

`tests/e2e/fonts.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

// Spec 2026-09-25 §4.7: every font ships with the site. A second font host delayed the page under load once (S34).
test('no request leaves the site for fonts', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname !== 'localhost') external.push(url.href);
  });
  await page.goto('/?stills');
  await page.evaluate(() => document.fonts.ready);
  expect(external).toEqual([]);
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replaceAll('"', '')));
  expect(loaded).toEqual(expect.arrayContaining(['Satoshi', 'Fraunces', 'Space Mono']));
});
```

Run it: `npx playwright test tests/e2e/fonts.spec.ts --project=chromium`.
Expected: FAIL, listing the `fonts.googleapis.com` and `fonts.gstatic.com` requests.

- [ ] **Step 2: Fetch the two font files**

Fraunces (roman, variable weight 300–800, optical size 9–144, latin) and Space Mono (regular, latin) are under the
SIL Open Font License, which allows self-hosting. Download the exact files Google serves to a modern browser:

```powershell
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36'
$css = (Invoke-WebRequest -UseBasicParsing -UserAgent $ua 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..800&family=Space+Mono&display=swap').Content
$css | Set-Content .superpowers\fonts.css
```

Read `.superpowers\fonts.css`. For each family, take the `src: url(…)` of the block whose preceding comment is
`/* latin */`, and download it:

```powershell
Invoke-WebRequest -UseBasicParsing <fraunces latin url> -OutFile public\fonts\fraunces-var-latin.woff2
Invoke-WebRequest -UseBasicParsing <space mono latin url> -OutFile public\fonts\space-mono-400-latin.woff2
```

Record both file sizes. Also copy the `unicode-range` line of each latin block, for Step 3.

- [ ] **Step 3: Serve them**

In `src/styles/base.css`, after the Satoshi faces, add the two faces below. Replace `<latin range>` with the
`unicode-range` value copied in Step 2, verbatim:

```css
/* Fraunces and Space Mono ship with the site too (SIL Open Font License), latin only, so the page never waits on
   another host (spec 2026-09-25 §4.7). Fraunces is variable: weight 300–800 for the name's pointer swell, and
   optical size. */
@font-face {
  font-family: Fraunces;
  src: url("/fonts/fraunces-var-latin.woff2") format("woff2");
  font-weight: 300 800;
  font-style: normal;
  font-display: swap;
  unicode-range: <latin range>;
}

@font-face {
  font-family: "Space Mono";
  src: url("/fonts/space-mono-400-latin.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  unicode-range: <latin range>;
}
```

In `index.html`:
- delete the two `preconnect` links and the Google Fonts stylesheet link;
- after the Satoshi preload, add
  `<link rel="preload" href="/fonts/fraunces-var-latin.woff2" as="font" type="font/woff2" crossorigin />`.

Fix the base.css comment that says "Fraunces is kept for two things only: the name, and the black opening's
greeting". It becomes "Fraunces is kept for the name alone".

Run `npx playwright test tests/e2e/fonts.spec.ts` (all browsers). Expected: PASS.

- [ ] **Step 4: The orphaned "hand:" (measure first)**

In the headed browser at 1280×720, `?stills&p=0.36`, read the About paragraph's split lines
(`#about .split-line`: `textContent` and width). Then confirm the cause: a line that ends with "hand:", followed by
a line holding the whole `<em>` phrase.

If the `<em>` is kept whole by SplitText, add `deepSlice: true` to the `SplitText.create` options in
`sectionMotion.ts` and measure again. If the phrase still starts its own line, replace the `<em>` in `index.html`
with a `<span class="section__stress">`, and move the `.section em` CSS rule to `.section .section__stress`.

Add a regression test to `tests/e2e/redesign.spec.ts`:

```ts
test('the stressed phrase in About flows with its sentence, never leaving "hand:" alone on a line', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?stills&p=0.36');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('#about')).toHaveClass(/is-active/);
  await page.waitForTimeout(1500);
  const lines = await page.locator('#about .split-line').allTextContents();
  expect(lines.map((line) => line.trim())).not.toContain('hand:');
});
```

It must fail before the fix and pass after it. Record both runs.

- [ ] **Step 5: Run everything and commit**

Run: `npm run check; npm test; npm run build; npm run size`, stop :4173, then run `npm run e2e`.
Expected: all green.

```bash
git add public/fonts src/styles/base.css index.html src/overlay/sectionMotion.ts src/styles/overlay.css tests/e2e/fonts.spec.ts tests/e2e/redesign.spec.ts
git commit -m "fix: ship Fraunces and Space Mono with the site, and keep the stressed phrase in its sentence"
```

---

### Task 7: The project card, the case study, and the copy

**Files:**
- Modify: `src/content/projects.ts` (fields, copy), `src/overlay/projectList.ts` (card),
  `src/overlay/projectDialog.ts` (F layout), `index.html` (dialog markup, About copy), `src/styles/overlay.css`
  (card, dialog)
- Create: `public/projects/moonlit-cover.jpg`. Until Task 8 captures it, copy
  `public/stills/contact-landscape.jpg` as a placeholder.
- Test: `tests/unit/projects.test.ts`, `tests/e2e/projects.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `Project.hardPart: string`
  - `Project.metric?: { value: string; label: string }`
  - `Project.cover` is now required.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/projects.test.ts`:

```ts
describe('the case study (spec 2026-09-25 §4.8, storyboard F)', () => {
  it('gives every project a cover, the hard part, and only a measured number', () => {
    for (const project of projects) {
      expect(project.cover.src, project.slug).toMatch(/^\/projects\/.+\.jpg$/);
      expect(project.hardPart.trim(), project.slug).not.toBe('');
      if (project.metric) expect(project.metric.value, project.slug).toMatch(/\d/);
    }
  });

  it('no longer promises tonight's real moon', () => {
    for (const project of projects) {
      expect([project.summary, ...project.details].join(' '), project.slug).not.toMatch(/tonight/i);
    }
  });
});
```

Append to `tests/e2e/projects.spec.ts`:

```ts
test('the card shows a cover, and the case study shows the hard part and its number', async ({ page }) => {
  await page.goto('/?stills&p=0.65');
  await expect(page.locator('#projects .project__cover')).toHaveAttribute('src', '/projects/moonlit-cover.jpg');
  await page.getByRole('button', { name: 'Moonlit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Moonlit' });
  await expect(dialog.getByRole('heading', { name: 'The hard part' })).toBeVisible();
  await expect(dialog.locator('[data-project-metric]')).toContainText('fps');
  await expect(dialog.getByRole('img')).toHaveAttribute('alt', /rendered by the site/);
});
```

Run: `npx vitest run tests/unit/projects.test.ts`.
Expected: FAIL. It won't type-check or run: `hardPart` is missing, and the copy says "tonight's".

- [ ] **Step 2: Content**

In `src/content/projects.ts`:
- Make `cover` required: `cover: { src: string; alt: string };`.
- Add `/** One real difficulty, in a sentence or two (storyboard F). */ hardPart: string;` and
  `/** One measured number, never an estimate. */ metric?: { value: string; label: string };`.
- Update the Moonlit entry. `summary` and `details[0]` follow spec §4.9. `hardPart` is written from plan 1's
  measurements. The metric uses plan 1's measured numbers.

```ts
    summary: 'The journey you are on: a moonlit sea whose moon fills as you travel.',
    details: [
      'My first project, built from scratch. The sea is drawn by a shader that follows every pixel’s ray down to the water, each frame, and the moon waxes from crescent to full as you travel.',
    ],
    hardPart:
      'Keeping it smooth on an ordinary laptop. Almost all of the sea’s cost turned out to be rays creeping through empty air above the waves, so each ray now starts at the highest surface it could meet; and the frame rate follows the screen, so 90 and 144 Hz displays no longer read as slow.',
    metric: { value: '31.6 → 58 fps', label: 'the sea at 80% sharpness on an Intel UHD laptop' },
    cover: { src: '/projects/moonlit-cover.jpg', alt: 'The full moon on wet black sand, rendered by the site' },
```

- [ ] **Step 3: About copy**

In `index.html`, change the About paragraph's stressed phrase to "the sea is a shader, and the moon fills as you
travel." Keep whichever element Task 6 settled on.

- [ ] **Step 4: The card**

In `src/overlay/projectList.ts`, before `item.append(meta, head, summary);`, create:

```ts
      const cover = document.createElement('img');
      cover.className = 'project__cover';
      cover.src = project.cover.src;
      cover.alt = '';
      cover.loading = 'lazy';
      cover.decoding = 'async';
```

and change the append to `item.append(cover, meta, head, summary);`. The alt is empty because the dialog carries
the described image. In the list the cover is decoration next to the title.

Append to `overlay.css`, in the projects block:

```css
.project-list li {
  display: grid;
  grid-template-columns: 11rem minmax(0, 1fr);
  column-gap: 1.25rem;
  align-items: start;
}

.project__cover {
  grid-row: span 3;
  width: 100%;
  aspect-ratio: 16 / 10;
  border: 1px solid rgba(159, 230, 238, 0.2);
  border-radius: 0.75rem;
  object-fit: cover;
}

@media (max-width: 699px) {
  .project-list li {
    grid-template-columns: minmax(0, 1fr);
  }

  .project__cover {
    grid-row: auto;
    margin-bottom: 0.75rem;
  }
}
```

- [ ] **Step 5: The case study dialog**

In `index.html`, replace the dialog body with:

```html
      <div class="project-dialog__body">
        <button class="project-dialog__close" type="button" data-project-close>Close</button>
        <img class="project-dialog__cover" data-project-cover alt="" />
        <div class="project-dialog__text-col">
          <p class="project-dialog__meta" data-project-meta></p>
          <h2 class="project-dialog__title" id="project-dialog-title" data-project-title>Project</h2>
          <h3 class="project-dialog__label">What it is</h3>
          <div class="project-dialog__text" data-project-text></div>
          <h3 class="project-dialog__label">The hard part</h3>
          <p class="project-dialog__hard" data-project-hard></p>
          <p class="project-dialog__metric" data-project-metric></p>
          <ul class="project-dialog__tools" aria-label="Built with" data-project-tools></ul>
          <p class="project-dialog__links" data-project-links></p>
        </div>
      </div>
```

In `src/overlay/projectDialog.ts`, add the parts `cover` (`[data-project-cover]`, as `HTMLImageElement`), `hard`
(`[data-project-hard]`) and `metric` (`[data-project-metric]`). In `fill`:

```ts
    cover.src = project.cover.src;
    cover.alt = project.cover.alt;
    hard.textContent = project.hardPart;
    metric.textContent = project.metric ? `${project.metric.value} — ${project.metric.label}` : '';
    metric.hidden = project.metric === undefined;
```

Append the dialog styles. Desktop is two columns (the text on the left, 28rem; the cover on the right); the phone
has the cover on top:

```css
.project-dialog {
  width: min(64rem, calc(100vw - 2rem));
}

.project-dialog__body {
  grid-template-columns: minmax(0, 28rem) minmax(0, 1fr);
  column-gap: 2rem;
}

.project-dialog__close {
  grid-column: 1 / -1;
}

.project-dialog__cover {
  grid-column: 2;
  grid-row: 2;
  width: 100%;
  height: 100%;
  min-height: 16rem;
  border-radius: 0.75rem;
  object-fit: cover;
}

.project-dialog__text-col {
  display: grid;
  gap: 0.75rem;
  align-content: start;
}

.project-dialog__label {
  margin: 0.5rem 0 0;
  color: var(--glow);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 400;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.project-dialog__hard,
.project-dialog__metric {
  margin: 0;
  color: var(--ink-dim);
  line-height: 1.7;
}

.project-dialog__metric {
  color: var(--ink);
  font-weight: 500;
}

@media (max-width: 699px) {
  .project-dialog__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .project-dialog__cover {
    grid-column: 1;
    grid-row: 2;
    height: 12rem;
    min-height: 0;
  }
}
```

- [ ] **Step 6: Run everything and commit**

Run: `npm run check; npm test; npm run build`, stop :4173, then run `npm run e2e`.
Expected: all green. axe on the dialog stays clean: the image has alt text, and the headings stay in order (h2
then h3).

```bash
git add src/content/projects.ts src/overlay/projectList.ts src/overlay/projectDialog.ts index.html src/styles/overlay.css public/projects tests/unit/projects.test.ts tests/e2e/projects.spec.ts
git commit -m "feat: give the project a card with a cover and a case study with its hard part and a measured number"
```

---

### Task 8: Stills and the cover, rendered from the real scene

**Files:**
- Create: `scripts/capture.mjs`
- Modify: `package.json` (a `capture` script), `src/app/params.ts` and `tests/unit/params.test.ts` (`bare`),
  `src/app/boot.ts` (`html.is-bare`), `src/styles/overlay.css` (`is-bare` hides the text layer)
- Replace: `public/stills/*.jpg` (8 files), `public/projects/moonlit-cover.jpg`

**Interfaces:**
- Consumes: the journey's shown stops, 0 / 0.335 / 0.585 / 0.835 (`SHOWN_OFFSET`).
- Produces: `DebugParams.bare: boolean` (`?bare`).

- [ ] **Step 1: The `?bare` hook (test first)**

Append to `tests/unit/params.test.ts`, in `'treats presence-only flags as true'`: add `&bare` to the query string
and `expect(params.bare).toBe(true);`. Add `bare: false,` to the defaults object. Run the test and see it fail.

Implement: add `bare: boolean;` to `DebugParams`, with the doc comment "`?bare`: hide the text layer, for rendering
stills" and `bare: query.has('bare'),`. In `boot.ts`, near the top, add
`if (params.bare) root.classList.add('is-bare');`. Add `html.is-bare .content { display: none; }` to overlay.css.
Run the test and see it pass.

- [ ] **Step 2: `scripts/capture.mjs`**

```js
// Renders the stills fallback and the project cover from the real scene (spec 2026-09-25 §4.10).
// Usage: npm run build && npm run capture   (needs a GPU: run it in a headed browser on a real machine)
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';

const PAGES = [
  ['intro', 0],
  ['about', 0.335],
  ['projects', 0.585],
  ['contact', 0.835],
];
const SHAPES = [
  ['landscape', { width: 1600, height: 1000 }],
  ['portrait', { width: 390, height: 844, deviceScaleFactor: 2 }],
];

const server = spawn('npx', ['vite', 'preview', '--port', '4180', '--strictPort'], { shell: true, stdio: 'ignore' });
await new Promise((resolve) => setTimeout(resolve, 3000));
const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu'] });
try {
  const shoot = async (viewport, progress, path) => {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.deviceScaleFactor ?? 1 });
    await page.bringToFront();
    await page.goto(`http://localhost:4180/?p=${progress}&tier=3&time=12&bare&pace=full`);
    await page.waitForFunction(() => (window.__moonlit?.frames() ?? 0) > 60, undefined, { timeout: 120_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path, type: 'jpeg', quality: 86 });
    await page.close();
    console.log('wrote', path);
  };
  for (const [name, progress] of PAGES) {
    for (const [shape, viewport] of SHAPES) await shoot(viewport, progress, `public/stills/${name}-${shape}.jpg`);
  }
  await shoot({ width: 1280, height: 800 }, 1, 'public/projects/moonlit-cover.jpg');
} finally {
  await browser.close();
  server.kill();
}
```

In `package.json` `scripts`, add `"capture": "node scripts/capture.mjs"`.

- [ ] **Step 3: Capture**

Run: `npm run build; npm run capture`.
Expected: nine `wrote …` lines.

Read each JPEG and compare it with the storyboard: crescent at sea, quarter with surf, gibbous on sand, full at
the water's edge, and the cover showing the moon on wet sand. If a frame has no sand or the wrong moon, stop: the
camera path or the phase schedule is wrong, not the capture. Record the file sizes. Keep each under 120 kB, and
lower the quality if needed.

- [ ] **Step 4: Run everything and commit**

Run: `npm run check; npm test; npm run build`, stop :4173, then run `npm run e2e`.
Expected: all green. The smoke test fetches all 8 stills.

```bash
git add scripts/capture.mjs package.json src/app/params.ts src/app/boot.ts src/styles/overlay.css tests/unit/params.test.ts public/stills public/projects
git commit -m "feat: render the stills and the project cover from the real scene, crescent to full"
```

---

### Task 9: The owner feels it, the switches go, the record is written

**Files:**
- Modify: whichever files hold each switch's losing side, `src/app/params.ts`, `tests/unit/params.test.ts`
- Modify: `docs/superpowers/specs/2026-09-13-moonlit-portfolio-design.md` (§17 S40–S43), `docs/HANDOVER.md`
- Delete: the `.superpowers/sdd/` workspaces of both plans, once each final review is clean

- [ ] **Step 1: Serve to the phone**

`npm run build`, then `npx vite preview --port 4173 --strictPort --host`. Do not use `npm run preview -- --host`:
PowerShell's `npm` drops the flag. Send the owner these links, with one plain sentence each on what to feel:
- the journey from the top;
- `?snap=wheel` on the laptop;
- `?glints=old` at `?p=0.65` (now on the sand, where it matters);
- `?march=old`;
- `?frame=old` in a laptop window;
- `?pace=full` (only matters on a 90 Hz screen).

- [ ] **Step 2: Apply the picks**

For each switch, keep the side the owner picked. Delete the other side's code, its param, its params test lines
and its HUD or handover mention. A switch whose old side is kept becomes the default with no switch. A pick that
asks for something new goes behind a switch and back to the owner (S34), and is never guessed.

- [ ] **Step 3: The record**

- Append S40–S43 to §17 of the master spec as written in the waxing-voyage spec §10, with each task's measured
  facts and the owner's picks.
- Update `docs/HANDOVER.md`:
  - §1's journey table: the landing at 2.0, the moon phases per page;
  - §3: `?hold` is gone; add `?bare` and `npm run capture`;
  - §4: the file tree;
  - §6: the opening;
  - §10: the state.
- Remove the ledger note on the deferred minor "landscape phones" only if the owner asked for it to be fixed.
  Otherwise leave it in §11 open work.

- [ ] **Step 4: Full verification, then the final review**

Stop :4173, then run `npm run check; npm test; npm run build; npm run size; npm run e2e`. All green; report the
counts. Then run the final whole-branch review (executing-plans), covering both plans on this branch.

- [ ] **Step 5: Commit, and ask before any push**

```bash
git add -A
git commit -m "docs: record the waxing voyage, the owner's picks, and remove the review switches"
```

Tell the owner the branch is ready and ask whether to merge it into `main` and push. **Pushing publishes the site.**
