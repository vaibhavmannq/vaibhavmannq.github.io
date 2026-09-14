# Journey Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the site on a black "Hello, voyager" screen that leaves by itself, set the approved type pairing, and fix the scroll: sequential text handover, a camera that follows the finger, less stutter, and a shorter journey.

**Architecture:** The moonlit title screen and its button go; a new `overlay/opening.ts` drives a black layer while `gate.ts` keeps the loading → ready → entered state machine. Section text opacity becomes a pure function of region-local position and the anchors. The journey camera gets its own short-time-constant follow. The governor learns to hold tier changes while a new `scroll/activity.ts` says the visitor is scrolling. Everything else stays as built.

**Tech Stack:** Vite 8 · TypeScript 7 · three 0.186 (`three/webgpu`, TSL) · Lenis 1.3.26 · Vitest 5 · Playwright 1.63 · Biome 2.5 · Google Fonts (Gelasio, Cormorant Garamond italic, Manrope).

**Spec:** `docs/superpowers/specs/2026-09-14-journey-flow-design.md`, which amends `docs/superpowers/specs/2026-09-13-moonlit-portfolio-design.md` (§3.1, §3.3, §3.4 rule 4, §5.4a, §5.6, §5.8, §10.1, §10.2, §12.2, §14, §15, §17 S25).

**Base:** branch `journey-flow` at `050b7e9`. The working tree holds uncommitted brainstorming demos (`src/dev/opening.ts` plus scratch blocks in `index.html`, `src/app/boot.ts` and `src/styles/overlay.css`). Task 1 discards them first.

## Global Constraints

- **Composition rules (master spec §3.4) are binding:** one focal point per screen; no panels behind text; type is primary; text never crosses the moon or its path; content never repeats on screen; nothing overlaps at 390 px. Rule 4's one exception: the one-line opening greeting may use wide letter-spacing.
- **No game terminology:** the word "Tacet" never appears, and "Rover" is not used. No Wuthering Waves assets or region names.
- **Frame-loop contract:** no allocation in the steady-state frame (no `new`, object or array literals, or per-frame closures) and no layout-forcing DOM reads.
- **TSL rules (§17 S2, S3):** `.setLayout()` functions stay pure; no reversed `smoothstep` edges. This plan touches no shader code.
- **Tier invariant (§5.6):** a tier change may only alter resolution, aliasing and bloom.
- **Accessibility:** the keyboard path stays intact; axe clean; reduced motion honoured; text contrast ≥ 4.5:1 over the brightest (full) moon, measured by `tests/e2e/a11y.spec.ts`.
- **Browsers:** Chromium, Firefox, Safari 16.4+ (§9). The JS budget stays under 270 KB gzip (`npm run size`).
- **Commits:** a plain subject line with **no trailer of any kind** (no `Co-Authored-By:`, no `Claude-Session:`, no "Generated with"). Stage explicit paths.
- **Never push.** Merging and pushing are the owner's decisions.
- **Verification per task:** `npx tsc --noEmit`, `npx tsc --noEmit -p tsconfig.node.json`, `npm run check`, `npm run test`. The controller runs `npm run e2e` (the full three-browser suite) at the end.
- **Owner:** Claude writes the code; every task ends with a plain-language walkthrough and a check the owner can do.

## File map

| File | Responsibility after this plan |
|---|---|
| `index.html` | Opening markup, visually hidden load status, font request |
| `src/styles/base.css` | Colour and font tokens (`--font-display`, `--font-accent`, `--font-body`) |
| `src/styles/overlay.css` | Opening, sections, controls, HUD styles |
| `src/overlay/opening.ts` (new) | The black opening layer: hold, start triggers, leaving, dismissal |
| `src/overlay/gate.ts` | Loading → ready → entered state machine (no button) |
| `src/overlay/sections.ts` | Sequential handover maths and per-frame DOM writes |
| `src/scroll/activity.ts` (new) | "Is the visitor scrolling?" from progress over time |
| `src/quality/governor.ts` | Tier decisions, deferred while scrolling |
| `src/regions/moonsink/cameraPath.ts` | Keyframes, `followPose` for the journey, `approachPose` for the idle bob |
| `src/regions/moonsink/index.ts` | Chooses the camera behaviour per frame |
| `src/journey/journey.config.ts` | Region length 2.4 and `journeyWithLength` |
| `src/app/params.ts` | `?length` and `?hold` hooks |
| `src/app/boot.ts` | Wiring |
| `src/dev/hud.ts` | Scroll readouts |
| `src/main.ts` | Hide the opening if boot throws |

---

### Task 1: Type pairing, and discard the brainstorming demos

**Files:**
- Modify: `index.html` (the Google Fonts request)
- Modify: `src/styles/base.css` (font tokens)
- Modify: `src/styles/overlay.css` (heading weight, italic tagline)
- Delete: `src/dev/opening.ts` (scratch, never committed)

**Interfaces:**
- Produces: CSS custom properties `--font-display` (Gelasio stack) and `--font-accent` (Cormorant Garamond italic stack), used by Task 6's opening styles.

- [ ] **Step 1: Discard the scratch demos**

```bash
git status --porcelain
git checkout -- index.html src/app/boot.ts src/styles/overlay.css
rm src/dev/opening.ts
git status --porcelain
```

Expected: the first status lists exactly `M index.html`, `M src/app/boot.ts`, `M src/styles/overlay.css` and `?? src/dev/opening.ts`. The second prints nothing. If the first lists anything else, stop and report it; don't discard work you didn't expect.

- [ ] **Step 2: Request the paired fonts**

In `index.html`, replace the font stylesheet `href`:

```html
      href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,300&family=Gelasio:wght@400;500&family=Manrope:wght@400;500;600&display=swap"
```

Cormorant's upright weights (`0,300;0,400`) are no longer requested.

- [ ] **Step 3: Set the font tokens**

In `src/styles/base.css`, replace the `--font-display` line and add `--font-accent` below it:

```css
  --font-display: Gelasio, Georgia, "Times New Roman", serif;
  --font-accent: "Cormorant Garamond", "Iowan Old Style", Georgia, serif;
```

- [ ] **Step 4: Heavy headings, italic tagline**

In `src/styles/overlay.css`, in the `.section h1, .section h2` rule, change `font-weight: 300;` to:

```css
  font-weight: 400;
```

Replace the `.section .section__lede` rule with:

```css
.section .section__lede {
  color: var(--ink);
  font-family: var(--font-accent);
  font-size: clamp(1.35rem, 5.4vw, 1.9rem);
  font-style: italic;
  font-weight: 300;
  line-height: 1.3;
}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit && npx tsc --noEmit -p tsconfig.node.json && npm run check && npm run test
npm run build
npx playwright test tests/e2e/a11y.spec.ts --project=chromium
```

Expected: everything passes, including "text stays legible over the brightest moon on a phone". That test reads each line's real computed colour. *(As written it only measured About; the final review caught the gap, and the fix wave added the intro and its italic tagline.)*

- [ ] **Step 6: Commit**

```bash
git add index.html src/styles/base.css src/styles/overlay.css
git commit -m "feat: pair heavy Gelasio headings with a light italic tagline"
```

**Walkthrough (for the owner):** three families now carry the site. Gelasio is the heavy serif, designed with Georgia's letter widths, so it looks like your Phase 0 page on every device, Android included. Cormorant Garamond appears only as a light italic for the tagline. Manrope stays for body text. The font request asks Google only for what is used.

**Check (owner):** the name and "About" look heavier, and "Creative developer in the making…" is in italic.

---

### Task 2: Sequential text handover

**Files:**
- Modify: `src/overlay/sections.ts` (full rewrite)
- Modify: `src/journey/types.ts` (the `sectionMix` doc comment)
- Modify: `src/app/boot.ts` (how sections are created and updated)
- Test: `tests/unit/sections.test.ts` (full rewrite), `tests/unit/reducedMotionHandover.test.ts` (full rewrite)

**Interfaces:**
- Consumes: `SectionAnchor` from `src/journey/types.ts` (`{ id: SectionId; from: number }`); `smoothstep(edge0, edge1, x)` from `src/shared/math.ts`.
- Produces:
  - `export const HANDOVER_FADE = 0.1`, `export const HANDOVER_GAP = 0.08`
  - `export function sectionOpacity(local: number, anchors: readonly SectionAnchor[], index: number, reducedMotion: boolean): number`
  - `export function sectionOffset(local: number, anchors: readonly SectionAnchor[], index: number, reducedMotion: boolean): number`
  - `export function createSections(root: HTMLElement, anchors: readonly SectionAnchor[]): Sections`, where `Sections.show(local: number, reducedMotion: boolean): void`

- [ ] **Step 1: Write the failing tests**

Replace `tests/unit/sections.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import type { SectionAnchor } from '../../src/journey/types';
import { HANDOVER_FADE, HANDOVER_GAP, sectionOffset, sectionOpacity } from '../../src/overlay/sections';

const ABOUT = 0.45;
const anchors: readonly SectionAnchor[] = [
  { id: 'intro', from: 0 },
  { id: 'about', from: ABOUT },
];
const outEnd = ABOUT - HANDOVER_GAP / 2;
const outStart = outEnd - HANDOVER_FADE;
const inStart = ABOUT + HANDOVER_GAP / 2;
const inEnd = inStart + HANDOVER_FADE;
const everyPosition = Array.from({ length: 1001 }, (_, i) => i / 1000);

describe('sectionOpacity', () => {
  it('shows the intro fully until its fade begins, and About fully once its fade ends', () => {
    expect(sectionOpacity(0, anchors, 0, false)).toBe(1);
    expect(sectionOpacity(outStart, anchors, 0, false)).toBe(1);
    expect(sectionOpacity(inEnd, anchors, 1, false)).toBe(1);
    expect(sectionOpacity(1, anchors, 1, false)).toBe(1);
  });

  it('never shows two sections at the same scroll position', () => {
    for (const local of everyPosition) {
      const intro = sectionOpacity(local, anchors, 0, false);
      const about = sectionOpacity(local, anchors, 1, false);
      expect(Math.min(intro, about), `local ${local}`).toBe(0);
    }
  });

  it('leaves a quiet gap around the anchor where only the scene shows', () => {
    for (const local of [outEnd, ABOUT, inStart]) {
      expect(sectionOpacity(local, anchors, 0, false)).toBe(0);
      expect(sectionOpacity(local, anchors, 1, false)).toBe(0);
    }
  });

  it('is half faded exactly midway through each fade', () => {
    expect(sectionOpacity((outStart + outEnd) / 2, anchors, 0, false)).toBeCloseTo(0.5, 10);
    expect(sectionOpacity((inStart + inEnd) / 2, anchors, 1, false)).toBeCloseTo(0.5, 10);
  });

  it('runs backwards exactly: the value depends only on position, not on the direction of travel', () => {
    const forward = everyPosition.map((local) => sectionOpacity(local, anchors, 0, false));
    const backward = [...everyPosition]
      .reverse()
      .map((local) => sectionOpacity(local, anchors, 0, false))
      .reverse();
    expect(backward).toEqual(forward);
  });

  it('under reduced motion switches exactly at the anchor, with no in-between values', () => {
    expect(sectionOpacity(ABOUT - 1e-6, anchors, 0, true)).toBe(1);
    expect(sectionOpacity(ABOUT - 1e-6, anchors, 1, true)).toBe(0);
    expect(sectionOpacity(ABOUT, anchors, 0, true)).toBe(0);
    expect(sectionOpacity(ABOUT, anchors, 1, true)).toBe(1);
    for (const local of everyPosition) {
      const value = sectionOpacity(local, anchors, 0, true);
      expect(value === 0 || value === 1).toBe(true);
    }
  });

  it('would reject the old overlapping crossfade (proves the no-overlap test bites)', () => {
    // The Phase 1R handover at local 0.4: t = smoothstep(0.7, 1, local / ABOUT); intro = 1 − t, About = t.
    const smooth = (x: number) => {
      const t = Math.min(1, Math.max(0, x));
      return t * t * (3 - 2 * t);
    };
    const t = smooth((0.4 / ABOUT - 0.7) / 0.3);
    expect(Math.min(1 - t, t)).toBeGreaterThan(0);
  });
});

describe('sectionOffset', () => {
  it('drifts the outgoing text up and brings the incoming text up from below', () => {
    expect(sectionOffset(outStart, anchors, 0, false)).toBe(0);
    expect(sectionOffset(outEnd, anchors, 0, false)).toBe(-12);
    expect(sectionOffset(inStart, anchors, 1, false)).toBe(16);
    expect(sectionOffset(inEnd, anchors, 1, false)).toBe(0);
  });

  it('never offsets under reduced motion', () => {
    for (const local of everyPosition) {
      expect(sectionOffset(local, anchors, 0, true)).toBe(0);
      expect(sectionOffset(local, anchors, 1, true)).toBe(0);
    }
  });
});
```

Replace `tests/unit/reducedMotionHandover.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { journey, MOONSINK_ABOUT_FROM } from '../../src/journey/journey.config';
import { resolve } from '../../src/journey/timeline';
import type { RegionSegment } from '../../src/journey/types';
import { sectionOpacity } from '../../src/overlay/sections';
import { MOONSINK_PATH, poseAt, reducedMotionTarget } from '../../src/regions/moonsink/cameraPath';

// Under reduced motion there is no flight and no fade, so the text and the camera must change in
// one cut, at the same scroll position: the About anchor (spec §5.4a, §17 S24). Phase 1 has one
// region, so progress and region-local position are the same number.
const anchors = (journey[0] as RegionSegment).sections;

describe('reduced-motion handover from intro to About', () => {
  const halfway = MOONSINK_ABOUT_FROM / 2 + 0.01;
  const justBefore = MOONSINK_ABOUT_FROM - 0.01;

  it('keeps the intro text and the intro viewpoint until the About anchor', () => {
    for (const local of [0, halfway, justBefore]) {
      // resolve returns a shared object: read the field straight away.
      const { section } = resolve(local, journey);
      expect(section).toBe('intro');
      expect(sectionOpacity(local, anchors, 0, true)).toBe(1);
      expect(sectionOpacity(local, anchors, 1, true)).toBe(0);
      expect({ ...reducedMotionTarget(local) }).toEqual({ ...poseAt(MOONSINK_PATH, 0) });
    }
  });

  it('switches the text and the viewpoint together at the anchor', () => {
    const { section } = resolve(MOONSINK_ABOUT_FROM, journey);
    expect(section).toBe('about');
    expect(sectionOpacity(MOONSINK_ABOUT_FROM, anchors, 0, true)).toBe(0);
    expect(sectionOpacity(MOONSINK_ABOUT_FROM, anchors, 1, true)).toBe(1);
    expect({ ...reducedMotionTarget(MOONSINK_ABOUT_FROM) }).toEqual({ ...poseAt(MOONSINK_PATH, 1) });
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run tests/unit/sections.test.ts tests/unit/reducedMotionHandover.test.ts`
Expected: FAIL. `HANDOVER_FADE`, `sectionOpacity` and `sectionOffset` are not exported yet.

- [ ] **Step 3: Rewrite `src/overlay/sections.ts`**

```ts
import type { SectionAnchor } from '../journey/types';
import { smoothstep } from '../shared/math';

export interface Sections {
  /** Called every frame with the region-local scroll position (0..1). */
  show(local: number, reducedMotion: boolean): void;
}

/** How much of the region (0..1) each text fade takes. Tuned by feel (journey-flow design §5.1). */
export const HANDOVER_FADE = 0.1;
/** The quiet stretch around an anchor where no text shows, only the scene. */
export const HANDOVER_GAP = 0.08;

/** Pixel drift while a section leaves (up) and arrives (from below). Dropped under reduced motion. */
const EXIT_OFFSET_PX = -12;
const ENTER_OFFSET_PX = 16;

/** Same slack as journey/timeline.ts, so a position exactly on an anchor counts as "reached". */
const ANCHOR_EPSILON = 1e-9;

/** 0..1 progress of a section's outgoing fade (0 before it starts, 1 once gone). */
function leaving(local: number, next: SectionAnchor | undefined): number {
  if (next === undefined) return 0;
  const end = next.from - HANDOVER_GAP / 2;
  return smoothstep(end - HANDOVER_FADE, end, local);
}

/** 0..1 progress of a section's incoming fade (0 before it starts, 1 once fully in). */
function arriving(local: number, anchor: SectionAnchor, index: number): number {
  if (index === 0) return 1;
  const start = anchor.from + HANDOVER_GAP / 2;
  return smoothstep(start, start + HANDOVER_FADE, local);
}

/**
 * Opacity of one section as a pure function of scroll position. The outgoing text is fully gone
 * before the incoming text starts, so two texts never share the screen (spec §5.4a, amended).
 * Under reduced motion it is a hard switch exactly at the anchor, matching the camera cut (§17 S24).
 */
export function sectionOpacity(
  local: number,
  anchors: readonly SectionAnchor[],
  index: number,
  reducedMotion: boolean,
): number {
  const anchor = anchors[index];
  if (anchor === undefined) return 0;
  const next = anchors[index + 1];
  if (reducedMotion) {
    const started = local + ANCHOR_EPSILON >= anchor.from;
    const ended = next !== undefined && local + ANCHOR_EPSILON >= next.from;
    return started && !ended ? 1 : 0;
  }
  return arriving(local, anchor, index) * (1 - leaving(local, next));
}

/** Companion translateY in px for the same handover; always 0 under reduced motion. Pure. */
export function sectionOffset(
  local: number,
  anchors: readonly SectionAnchor[],
  index: number,
  reducedMotion: boolean,
): number {
  const anchor = anchors[index];
  if (reducedMotion || anchor === undefined) return 0;
  const out = leaving(local, anchors[index + 1]);
  // `+ 0` turns -0 into 0, so an unchanged offset is written as 'none', not 'translateY(-0px)'.
  if (out > 0) return EXIT_OFFSET_PX * out + 0;
  if (index === 0) return 0;
  return ENTER_OFFSET_PX * (1 - arriving(local, anchor, index)) + 0;
}

interface Tracked {
  element: HTMLElement;
  lastOpacity: number | undefined;
  lastOffset: number | undefined;
  lastActive: boolean | undefined;
}

/**
 * Writes the handover to the DOM every frame. No timers, no `element.animate()`, no CSS transition
 * on these properties. The last value per element is cached so an unchanged value is never re-applied.
 */
export function createSections(root: HTMLElement, anchors: readonly SectionAnchor[]): Sections {
  const tracked: Tracked[] = [];
  for (const anchor of anchors) {
    const element = root.querySelector<HTMLElement>(`[data-section="${anchor.id}"]`);
    if (element === null) throw new Error(`section ${anchor.id} is missing from index.html`);
    tracked.push({ element, lastOpacity: undefined, lastOffset: undefined, lastActive: undefined });
  }

  const write = (entry: Tracked, opacity: number, offsetPx: number, active: boolean) => {
    if (entry.lastOpacity !== opacity) {
      entry.element.style.opacity = String(opacity);
      entry.lastOpacity = opacity;
    }
    if (entry.lastOffset !== offsetPx) {
      entry.element.style.transform = offsetPx === 0 ? 'none' : `translateY(${offsetPx}px)`;
      entry.lastOffset = offsetPx;
    }
    if (entry.lastActive !== active) {
      entry.element.classList.toggle('is-active', active);
      entry.lastActive = active;
    }
  };

  return {
    show(local, reducedMotion) {
      for (let i = 0; i < tracked.length; i++) {
        const next = anchors[i + 1];
        const active =
          local + ANCHOR_EPSILON >= (anchors[i] as SectionAnchor).from &&
          (next === undefined || local + ANCHOR_EPSILON < next.from);
        write(
          tracked[i] as Tracked,
          sectionOpacity(local, anchors, i, reducedMotion),
          sectionOffset(local, anchors, i, reducedMotion),
          active,
        );
      }
    },
  };
}
```

- [ ] **Step 4: Update the `sectionMix` comment in `src/journey/types.ts`**

Replace the two-line comment above `sectionMix: number;` with:

```ts
  /** 0 = right on `section`'s own anchor, 1 = at (or past) the next anchor's `from`. Section text no
   *  longer reads this: it follows region-local position directly (overlay/sections.ts). */
```

- [ ] **Step 5: Wire it in `src/app/boot.ts`**

Change the types import:

```ts
import type { JourneyState, RegionSegment } from '../journey/types';
```

Replace `const sections = createSections(byId('content'));` with:

```ts
  // Phase 1 has one region, so its anchors are the page's sections.
  const anchors = (journey[0] as RegionSegment).sections;
  const sections = createSections(byId('content'), anchors);
```

Replace **all three** occurrences of `sections.show(state.section, state.sectionMix, ctx.reducedMotion);` with the line below, keeping each call's indentation:

```ts
sections.show(state.a.local, ctx.reducedMotion);
```

The loop's frame order is unchanged: scroll → resolve → update → sections → render → HUD → governor.

- [ ] **Step 6: Run the tests to confirm they pass**

```bash
npx tsc --noEmit && npx tsc --noEmit -p tsconfig.node.json && npm run check && npm run test
```

Expected: all pass. If Biome only reports formatting, run `npm run format` and re-run `npm run check`. `tests/e2e/sections.spec.ts` still asserts the old overlap and would fail in a browser run; Task 8 rewrites it, so don't run e2e here.

- [ ] **Step 7: Commit**

```bash
git add src/overlay/sections.ts src/journey/types.ts src/app/boot.ts tests/unit/sections.test.ts tests/unit/reducedMotionHandover.test.ts
git commit -m "fix: hand section text over in sequence so texts never collide"
```

**Walkthrough (for the owner):** the old handover faded the intro out *while* About faded in, in the same spot, which is the jumble you saw. Now the intro finishes leaving (drifting up), then there is a short stretch with only the sea, then About rises in. Each text's opacity is still worked out from exactly where you are in the scroll, so scrolling back plays it in reverse. A test checks a thousand scroll positions and fails if two texts are ever visible together.

**Check (owner):** scroll slowly past the intro. The name and tagline leave completely, you see only the sea for a moment, then "About" arrives.

---

### Task 3: The camera follows the scroll

**Files:**
- Modify: `src/regions/moonsink/cameraPath.ts` (add `followPose`; re-space keyframes)
- Modify: `src/regions/moonsink/index.ts` (use `followPose` during the journey)
- Test: `tests/unit/cameraPath.test.ts`

**Interfaces:**
- Consumes: `damp(current, target, lambda, dtSeconds)` from `src/shared/math.ts` (`lerp(current, target, 1 − e^(−λ·dt))`); `CameraPose`.
- Produces:
  - `export const FOLLOW_TIME_CONSTANT_MS = 70`
  - `export function followPose(current: CameraPose, target: CameraPose, dtSeconds: number, timeConstantMs?: number): CameraPose`, which mutates and returns `current`

- [ ] **Step 1: Write the failing tests**

In `tests/unit/cameraPath.test.ts`, add `followPose` and `FOLLOW_TIME_CONSTANT_MS` to the import from `'../../src/regions/moonsink/cameraPath'`.

Replace the `'eases halfway between two keys'` test with:

```ts
  it('eases halfway between two keys', () => {
    const pose = poseAt(MOONSINK_PATH, 0.125);
    expect(pose.x).toBeCloseTo(-1, 10);
    expect(pose.yaw).toBeCloseTo(-0.04, 10);
  });

  it('spaces the keyframes evenly so each stretch gets the same scroll distance', () => {
    expect(MOONSINK_PATH.map((key) => key.at)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
```

Add this `describe` block after the existing `describe('approachPose', …)` block:

```ts
describe('followPose', () => {
  it('covers 1 − 1/e of the distance after one time constant', () => {
    const current = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    const target = { x: 10, y: 4, z: -10, yaw: 0.5, pitch: -0.2 };
    followPose(current, target, FOLLOW_TIME_CONSTANT_MS / 1000);
    const k = 1 - Math.exp(-1);
    expect(current.x).toBeCloseTo(10 * k, 10);
    expect(current.y).toBeCloseTo(4 * k, 10);
    expect(current.z).toBeCloseTo(-10 * k, 10);
    expect(current.yaw).toBeCloseTo(0.5 * k, 10);
    expect(current.pitch).toBeCloseTo(-0.2 * k, 10);
  });

  it('is within 1% of the target after five time constants, so the camera does not trail the finger', () => {
    const current = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    const target = { x: 10, y: 0, z: 0, yaw: 0, pitch: 0 };
    const frame = 1 / 60;
    for (let t = 0; t < (5 * FOLLOW_TIME_CONSTANT_MS) / 1000; t += frame) followPose(current, target, frame);
    expect(Math.abs(10 - current.x)).toBeLessThan(0.1);
  });

  it('has no turn-speed cap, unlike approachPose', () => {
    const current = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    const target = { x: 0, y: 0, z: 0, yaw: 3, pitch: 0 };
    expect(followPose(current, target, 0.1).yaw).toBeGreaterThan(MAX_YAW_SPEED * 0.1);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run tests/unit/cameraPath.test.ts`
Expected: FAIL. `followPose` and `FOLLOW_TIME_CONSTANT_MS` are not exported, and the keyframes are still at 0.28 / 0.55 / 0.78.

- [ ] **Step 3: Re-space the keyframes in `src/regions/moonsink/cameraPath.ts`**

Replace the `MOONSINK_PATH` array with (poses unchanged, only `at` moves):

```ts
export const MOONSINK_PATH: readonly CameraKey[] = [
  { at: 0, x: 0, y: 3.2, z: 34, yaw: 0, pitch: -0.06 },
  { at: 0.25, x: -2, y: 6, z: 26, yaw: -0.08, pitch: -0.17 },
  { at: 0.5, x: 1, y: 1.8, z: 8, yaw: 0.02, pitch: -0.1 },
  { at: 0.75, x: 2.5, y: 1.55, z: -1.8, yaw: -0.05, pitch: -0.08 },
  { at: 1, x: 0, y: 1.45, z: -5.5, yaw: -0.03, pitch: -0.11 },
];
```

- [ ] **Step 4: Add `followPose`**

In the same file, directly after the `approachPose` function, add:

```ts
/** Time constant of the journey camera's follow, in ms: long enough to hide scroll-event jitter,
 *  short enough not to be felt (journey-flow design §5.2). */
export const FOLLOW_TIME_CONSTANT_MS = 70;

/**
 * The journey camera: follows the scroll-driven target with exponential smoothing. There is no
 * turn-speed cap here, because the whole path turns less than 1 rad (§17 S22 tests pin that).
 * Mutates and returns `current`, like approachPose.
 */
export function followPose(
  current: CameraPose,
  target: CameraPose,
  dtSeconds: number,
  timeConstantMs = FOLLOW_TIME_CONSTANT_MS,
): CameraPose {
  const lambda = 1000 / timeConstantMs;
  current.x = damp(current.x, target.x, lambda, dtSeconds);
  current.y = damp(current.y, target.y, lambda, dtSeconds);
  current.z = damp(current.z, target.z, lambda, dtSeconds);
  current.yaw = damp(current.yaw, target.yaw, lambda, dtSeconds);
  current.pitch = damp(current.pitch, target.pitch, lambda, dtSeconds);
  return current;
}
```

Change the first line of the doc comment above `approachPose` from `Smoothly follow a moving target, with turning speed capped for comfort.` to:

```ts
 * The idle bob behind the opening: follow a slowly moving target, with turning speed capped for comfort.
```

- [ ] **Step 5: Use it in `src/regions/moonsink/index.ts`**

Add `followPose,` to the named import from `'./cameraPath'`. Then replace:

```ts
      } else {
        approachPose(current, target, dtSeconds);
      }
```

with:

```ts
      } else if (entered) {
        // The journey camera moves with the scroll (journey-flow design §5.2).
        followPose(current, target, dtSeconds);
      } else {
        // The idle bob behind the opening keeps its gentle, capped easing.
        approachPose(current, target, dtSeconds);
      }
```

- [ ] **Step 6: Run the tests to confirm they pass**

```bash
npx tsc --noEmit && npx tsc --noEmit -p tsconfig.node.json && npm run check && npm run test
```

Expected: all pass, including the existing frame checks ("keeps the moon right of centre…", "keeps the moon in the upper half…") and the turning checks, since poses and total turn are unchanged. If Biome only reports import order or formatting, run `npm run format` and re-run `npm run check`.

- [ ] **Step 7: Commit**

```bash
git add src/regions/moonsink/cameraPath.ts src/regions/moonsink/index.ts tests/unit/cameraPath.test.ts
git commit -m "fix: move the camera with the scroll instead of easing a second behind"
```

**Walkthrough (for the owner):** before, the camera eased toward where the scroll said it should be and needed about 1.4 s to catch up. On a phone, where your finger drives the scroll directly, that easing made the view trail behind. Now the camera gets within 1% of its target in about a third of a second, and the 70 ms smoothing is only there to hide tiny jitters. The gentle bob behind the opening screen keeps its slow easing. The waypoints are also spaced evenly, so no stretch of the journey feels rushed or dragged.

**Check (owner):** drag the page slowly and stop. The view stops with your finger instead of drifting on.

---

### Task 4: No quality changes mid-scroll, and HUD scroll readouts

**Files:**
- Create: `src/scroll/activity.ts`
- Modify: `src/quality/governor.ts` (the `sample` method)
- Modify: `src/dev/hud.ts` (full rewrite)
- Modify: `src/app/boot.ts` (loop wiring)
- Test: `tests/unit/activity.test.ts` (new), `tests/unit/governor.test.ts`

**Interfaces:**
- Produces:
  - `export const SCROLL_SETTLE_MS = 300`
  - `export function createScrollActivity(settleMs?: number): ScrollActivity`, where `ScrollActivity.update(progress: number, nowMs: number): boolean`
  - `Governor.sample(frameMs: number, nowMs: number, canChange?: boolean): Tier | null` (`canChange` defaults to `true`)
  - `Hud.record(frameMs: number, scrolling: boolean)`, `Hud.tierChanged(scrolling: boolean)`, and `HudInfo.scrolling: boolean`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/activity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createScrollActivity, SCROLL_SETTLE_MS } from '../../src/scroll/activity';

describe('createScrollActivity', () => {
  it('is still on the very first frame, whatever the progress', () => {
    expect(createScrollActivity().update(0.2, 1000)).toBe(false);
  });

  it('is scrolling from the frame the progress changes', () => {
    const activity = createScrollActivity();
    activity.update(0, 0);
    expect(activity.update(0.01, 16)).toBe(true);
  });

  it('stays scrolling until the progress has held still for the settle time', () => {
    const activity = createScrollActivity();
    activity.update(0, 0);
    activity.update(0.01, 100);
    expect(activity.update(0.01, 100 + SCROLL_SETTLE_MS - 1)).toBe(true);
    expect(activity.update(0.01, 100 + SCROLL_SETTLE_MS)).toBe(false);
  });

  it('counts scrolling back up as scrolling', () => {
    const activity = createScrollActivity();
    activity.update(0.5, 0);
    activity.update(0.5, 1000);
    expect(activity.update(0.4, 1016)).toBe(true);
  });
});
```

In `tests/unit/governor.test.ts`, give `runWindow` a `canChange` parameter. Replace its signature line and the `sample` call inside it:

```ts
function runWindow(
  governor: Governor,
  frameMs: number,
  startMs: number,
  canChange = true,
): { change: Tier | null; endMs: number } {
```

```ts
    const result = governor.sample(frameMs, t, canChange);
```

Then add these tests at the end of the `describe('Governor', …)` block:

```ts
  it('never changes tier while the visitor is scrolling, however slow the frames', () => {
    const governor = new Governor(2, true);
    let t = 0;
    for (let i = 0; i < 5; i++) {
      const window = runWindow(governor, 33, t, false);
      expect(window.change).toBeNull();
      t = window.endMs;
    }
    expect(governor.current).toBe(2);
  });

  it('applies a slow verdict on the first window after scrolling stops', () => {
    const governor = new Governor(2, true);
    const scrolling = runWindow(governor, 33, 0, false);
    const settled = runWindow(governor, 33, scrolling.endMs, true);
    expect(settled.change).toBe(1);
  });

  it('keeps counting fast windows while scrolling, then steps up once it may', () => {
    const governor = new Governor(1, true);
    let t = 0;
    for (let i = 0; i < 3; i++) t = runWindow(governor, 16.7, t, false).endMs;
    expect(governor.current).toBe(1);
    expect(runWindow(governor, 16.7, t, true).change).toBe(2);
  });
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run tests/unit/activity.test.ts tests/unit/governor.test.ts`
Expected: FAIL. `src/scroll/activity.ts` doesn't exist, and the governor still changes tier while `canChange` is false.

- [ ] **Step 3: Create `src/scroll/activity.ts`**

```ts
/** How long after the last change in scroll progress the visitor still counts as scrolling. */
export const SCROLL_SETTLE_MS = 300;

export interface ScrollActivity {
  /** Call once per frame with the current progress. Returns true while the visitor is scrolling. */
  update(progress: number, nowMs: number): boolean;
}

/** "Is the visitor scrolling?", worked out from progress over time. Allocation-free per call. */
export function createScrollActivity(settleMs = SCROLL_SETTLE_MS): ScrollActivity {
  let lastProgress = Number.NaN;
  let lastMoveMs = Number.NEGATIVE_INFINITY;
  return {
    update(progress, nowMs) {
      if (progress !== lastProgress) {
        // The first reading is a starting point, not a movement.
        if (!Number.isNaN(lastProgress)) lastMoveMs = nowMs;
        lastProgress = progress;
      }
      return nowMs - lastMoveMs < settleMs;
    },
  };
}
```

- [ ] **Step 4: Let the governor wait, in `src/quality/governor.ts`**

Replace the whole `sample` method with:

```ts
  /**
   * Record one rendered frame. Returns the new tier when it changes, otherwise null.
   * While `canChange` is false (the visitor is scrolling) the tier never changes, but windows are
   * still measured: a slow window's verdict waits for the first window after scrolling stops, and
   * fast windows keep counting toward a step up (spec §5.6, never mid-scroll).
   */
  sample(frameMs: number, nowMs: number, canChange = true): Tier | null {
    if (this.windowStart === null) this.windowStart = nowMs;
    this.samples.push(frameMs);
    if (nowMs - this.windowStart < this.options.windowMs) return null;

    const slowFrames = percentile(this.samples, 0.95);
    this.samples = [];
    this.windowStart = nowMs;

    if (nowMs - this.lastChange < this.options.cooldownMs) {
      this.fastWindows = 0;
      return null;
    }
    if (slowFrames > this.options.downThresholdMs) {
      this.fastWindows = 0;
      return canChange ? this.changeTo(this.tier - 1, nowMs) : null;
    }
    if (slowFrames < this.options.upThresholdMs) {
      this.fastWindows += 1;
      if (this.fastWindows >= this.options.upWindowsRequired && canChange) {
        this.fastWindows = 0;
        return this.changeTo(this.tier + 1, nowMs);
      }
      return null;
    }
    this.fastWindows = 0;
    return null;
  }
```

- [ ] **Step 5: Rewrite `src/dev/hud.ts`**

```ts
import { percentile } from '../quality/governor';

export interface HudInfo {
  backend: string;
  tier: number;
  renderScale: number;
  progress: number;
  scrolling: boolean;
}

export interface Hud {
  record(frameMs: number, scrolling: boolean): void;
  /** Call when the governor changes tier, so a change during a scroll shows up as a regression. */
  tierChanged(scrolling: boolean): void;
  paint(nowMs: number, info: HudInfo): void;
}

/** Frame-time overlay for real-device testing (spec §7). Shows the numbers the governor acts on. */
export function createHud(parent: HTMLElement): Hud {
  const element = document.createElement('div');
  element.className = 'hud';
  element.setAttribute('aria-hidden', 'true');
  parent.append(element);

  const frames: number[] = [];
  let dropped = 0;
  let droppedInScroll = 0;
  let tierChangesInScroll = 0;
  let lastPaint = 0;

  return {
    record(frameMs, scrolling) {
      frames.push(frameMs);
      if (frames.length > 240) frames.shift();
      if (frameMs > 25) {
        dropped += 1;
        if (scrolling) droppedInScroll += 1;
      }
    },
    tierChanged(scrolling) {
      if (scrolling) tierChangesInScroll += 1;
    },
    paint(nowMs, info) {
      if (nowMs - lastPaint < 500 || frames.length === 0) return;
      lastPaint = nowMs;
      const median = percentile(frames, 0.5);
      const slow = percentile(frames, 0.95);
      element.textContent = [
        `backend   ${info.backend}`,
        `tier      ${info.tier}  (render scale ${info.renderScale})`,
        `fps       ${Math.round(1000 / median)}`,
        `frame ms  p50 ${median.toFixed(1)}  p95 ${slow.toFixed(1)}`,
        `dropped   ${dropped}  (frames > 25 ms)`,
        `scroll    ${info.scrolling ? 'moving' : 'still'}`,
        `in scroll ${droppedInScroll} long frames (> 25 ms)`,
        `tier changes in scroll ${tierChangesInScroll}`,
        `progress  ${info.progress.toFixed(3)}`,
      ].join('\n');
    },
  };
}
```

- [ ] **Step 6: Wire it in `src/app/boot.ts`**

Add the import next to the other scroll import:

```ts
import { createScrollActivity } from '../scroll/activity';
```

Directly after `const hud = params.hud ? createHud(document.body) : null;`, add:

```ts
  const activity = createScrollActivity();
```

In the loop callback, directly after `state = resolve(p, journey);`, add:

```ts
    const scrolling = activity.update(p, nowMs);
```

Replace `hud?.record(frameIntervalMs);` with:

```ts
    hud?.record(frameIntervalMs, scrolling);
```

Add `scrolling` to the object passed to `hud?.paint(…)`:

```ts
    hud?.paint(nowMs, { backend: moonlit.backend, tier, renderScale: TIERS[tier].renderScale, progress: p, scrolling });
```

Replace:

```ts
      const next = governor.sample(frameIntervalMs, nowMs);
      if (next !== null) applyTier(next);
```

with:

```ts
      // Keep measuring while the visitor scrolls, but change tier only once they stop: a tier change
      // resizes render buffers, which hitches exactly when motion is most visible (spec §5.6).
      const next = governor.sample(frameIntervalMs, nowMs, !scrolling);
      if (next !== null) {
        hud?.tierChanged(scrolling);
        applyTier(next);
      }
```

The `hud?.…` calls are skipped entirely without `?hud`, so the paint object is never built in production.

- [ ] **Step 7: Run the tests to confirm they pass**

```bash
npx tsc --noEmit && npx tsc --noEmit -p tsconfig.node.json && npm run check && npm run test
```

Expected: all pass, including every existing governor test. `canChange` defaults to `true`, so their behaviour is unchanged. If Biome only reports formatting or import order, run `npm run format` and re-run `npm run check`.

- [ ] **Step 8: Commit**

```bash
git add src/scroll/activity.ts src/quality/governor.ts src/dev/hud.ts src/app/boot.ts tests/unit/activity.test.ts tests/unit/governor.test.ts
git commit -m "fix: hold quality changes until scrolling stops, and show scroll jank in the HUD"
```

**Walkthrough (for the owner):** changing quality resizes the image buffers the scene draws into, and that causes a hitch. The governor used to do that whenever its numbers said so, often in the middle of your scroll, exactly when a hitch is most visible. Now it keeps measuring while you scroll but waits until you've stopped for 300 ms before changing anything. The HUD gains three lines: whether you're scrolling, how many long frames happened *while* scrolling, and how many quality changes happened while scrolling. That last number should always read 0.

**Check (owner):** open `?hud`, then scroll top to bottom and back three times. "tier changes in scroll" stays 0, and "in scroll … long frames" grows slowly, if at all.

---

### Task 5: Cheaper text legibility

**Files:**
- Modify: `src/styles/overlay.css`

**Interfaces:** none. CSS only.

**Why:** a local spike (spec §17 S25) measured the text overlay in stills mode on a phone-sized viewport (DPR 2.625, CPU 4× slower, scrolling end to end). As built it produced 4 long frames of 356 and **352 ms** of raster work. Without the 18 px blurred text shadow it produced 0 long frames and 145 ms. The per-frame opacity and transform changes also repaint the text unless each section sits on its own compositor layer.

**Order:** this task must run **before Task 6**. Its measurement script clicks "Click to enter", which Task 6 removes.

- [ ] **Step 1: Tighten the text shadow**

In `src/styles/overlay.css`, the declaration `text-shadow: 0 2px 18px rgba(2, 4, 6, 0.9);` appears **twice**: in the `.section h1, .section h2` rule and in the `.section p` rule. Replace both with:

```css
  text-shadow: 0 1px 2px rgba(2, 4, 6, 0.8);
```

- [ ] **Step 2: Put each section on its own layer**

Replace the `.section` rule with:

```css
.section {
  position: absolute;
  right: 0;
  bottom: max(12svh, env(safe-area-inset-bottom));
  left: 0;
  padding-inline: max(1.25rem, env(safe-area-inset-left)) max(1.25rem, env(safe-area-inset-right));
  opacity: 0;
  /* The handover changes these every frame; own layers composite them instead of repainting the text. */
  will-change: opacity, transform;
}
```

- [ ] **Step 3: Check contrast over the brightest moon**

```bash
npm run check
npx playwright test tests/e2e/a11y.spec.ts --project=chromium
```

Expected: all pass, including "text stays legible over the brightest moon on a phone" (every line ≥ 4.5:1, or ≥ 3:1 for large text).

If that contrast test fails, strengthen the floor gradient. Never change the text colour. Replace the `background` line in the `.content::before` rule with the following, and re-run the test:

```css
  background: linear-gradient(to top, rgba(2, 4, 6, 0.9) 12%, rgba(2, 4, 6, 0.55) 46%, rgba(2, 4, 6, 0) 100%);
```

- [ ] **Step 4: Measure the overlay again**

The spike script is git-ignored scratch at `.superpowers/sdd/spike-stutter.mjs` and needs the dev server:

```bash
npm run dev
```

In a second terminal, while it runs:

```bash
node .superpowers/sdd/spike-stutter.mjs
```

Then stop the dev server. Read the `as built` row, which now measures your change. **Acceptance:** raster at most **176 ms** (at least 50% below the recorded 352 ms baseline) and **0** frames over 25 ms. Report the full table. If acceptance fails, report it; don't commit and don't try other shadow values.

- [ ] **Step 5: Commit**

```bash
git add src/styles/overlay.css
git commit -m "perf: lighter text shadow and compositor layers for section text"
```

**Walkthrough (for the owner):** a soft, wide shadow behind large text is expensive, because the phone redraws that blur every time the text fades or moves, and it competes with the 3D sea for the same GPU. The shadow is now a tight 2 px outline, and the dark gradient at the bottom of the screen does most of the work of keeping text readable. Each text block also gets its own compositing layer, so fading it doesn't redraw it. The contrast test still measures the real pixels at full moon.

**Check (owner):** the text still reads clearly over the moonlit water, especially your tagline under a full moon (`?moon=0.5`).

---

### Task 6: The black opening

**Files:**
- Create: `src/overlay/opening.ts`
- Modify: `src/overlay/gate.ts` (full rewrite, no button)
- Modify: `src/app/params.ts` (`?hold` test hook)
- Modify: `index.html` (opening markup, status element, `<noscript>` rule)
- Modify: `src/styles/overlay.css` (opening styles replace title-screen styles)
- Modify: `src/app/boot.ts` (wiring)
- Modify: `src/main.ts` (hide the opening if boot throws)
- Test: `tests/unit/opening.test.ts` (new), `tests/unit/params.test.ts`

**Interfaces:**
- Consumes: `--font-display`, `--font-accent`, `--night`, `--ink`, `--ink-dim` from `src/styles/base.css` (Task 1).
- Produces:
  - `export const MIN_HOLD_MS = 2200`
  - `export function holdRemaining(nowMs: number, minHoldMs?: number): number`
  - `export type OpeningStart = 'auto' | 'pointer' | 'key'`
  - `export function createOpening(element: HTMLElement, settings?: { minHoldMs?: number }): Opening`, with `Opening.begin({ reducedMotion: () => boolean; onStart: (how: OpeningStart) => void })` and `Opening.dismiss()`
  - `export function createGate(root: HTMLElement, status: HTMLElement): Gate` (same `Gate` interface as before)
  - `DebugParams.hold?: number`
  - DOM: `#opening` (with `data-state` of `loading`, `ready` or `entered`), `#load-status`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/opening.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { holdRemaining, MIN_HOLD_MS } from '../../src/overlay/opening';

describe('holdRemaining', () => {
  it('holds the greeting for 2.2 s by default', () => {
    expect(MIN_HOLD_MS).toBe(2200);
  });

  it('waits out the rest of the minimum hold', () => {
    expect(holdRemaining(0)).toBe(MIN_HOLD_MS);
    expect(holdRemaining(1200)).toBe(MIN_HOLD_MS - 1200);
  });

  it('is zero once the hold has passed, never negative', () => {
    expect(holdRemaining(MIN_HOLD_MS)).toBe(0);
    expect(holdRemaining(9000)).toBe(0);
  });

  it('honours a custom hold', () => {
    expect(holdRemaining(100, 600000)).toBe(599900);
  });
});
```

In `tests/unit/params.test.ts`, add `hold: undefined,` to the defaults object in `'has safe defaults when nothing is set'`, and add this test inside the `describe`:

```ts
  it('reads a hold in milliseconds and ignores negative or junk values', () => {
    expect(readDebugParams('?hold=600000').hold).toBe(600000);
    expect(readDebugParams('?hold=0').hold).toBe(0);
    expect(readDebugParams('?hold=-5').hold).toBeUndefined();
    expect(readDebugParams('?hold=abc').hold).toBeUndefined();
  });
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run tests/unit/opening.test.ts tests/unit/params.test.ts`
Expected: FAIL. `src/overlay/opening.ts` doesn't exist, and `hold` isn't read.

- [ ] **Step 3: Create `src/overlay/opening.ts`**

```ts
/** "Hello, voyager" stays up at least this long, measured from navigation start, so it can be read. */
export const MIN_HOLD_MS = 2200;

/** Milliseconds still to wait before the opening may leave on its own. Pure. */
export function holdRemaining(nowMs: number, minHoldMs = MIN_HOLD_MS): number {
  return Math.max(0, minHoldMs - nowMs);
}

export type OpeningStart = 'auto' | 'pointer' | 'key';

export interface OpeningOptions {
  /** Read at the moment of leaving, so a reduced-motion toggle during the greeting is honoured. */
  reducedMotion: () => boolean;
  /** Called once, as the opening starts to leave. */
  onStart: (how: OpeningStart) => void;
}

export interface Opening {
  /** The page is ready: leave after the hold, or at the first tap, scroll or key. */
  begin(options: OpeningOptions): void;
  /** Remove the opening at once, with no fade ("Skip intro" and the `?p` test hook). */
  dismiss(): void;
}

/**
 * The black "Hello, voyager" layer (journey-flow design §3). It only runs once the page is ready,
 * because there is nothing to reveal before that, and on a slow phone the greeting is simply the
 * loading screen for longer.
 */
export function createOpening(element: HTMLElement, settings: { minHoldMs?: number } = {}): Opening {
  const minHoldMs = settings.minHoldMs ?? MIN_HOLD_MS;
  let started = false;
  let timer = 0;

  const hide = () => {
    element.hidden = true;
  };

  return {
    begin({ reducedMotion, onStart }) {
      if (started) return;

      // Tab and Shift keep moving focus, and keys pressed on a link or button keep their own job, so
      // "Skip intro" and "Reduce motion" stay usable while the greeting is up.
      const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Tab' || event.key === 'Shift') return;
        if (event.target instanceof Element && event.target.closest('a, button')) return;
        start('key');
      };

      const start = (how: OpeningStart) => {
        if (started) return;
        started = true;
        window.clearTimeout(timer);
        window.removeEventListener('keydown', onKey);
        onStart(how);
        if (reducedMotion()) {
          hide();
          return;
        }
        // Hide once the layer's own fade ends. Its children fade too, and their events bubble here.
        element.addEventListener('transitionend', (event) => {
          if (event.target === element) hide();
        });
        element.classList.add('is-leaving');
      };

      timer = window.setTimeout(() => start('auto'), holdRemaining(performance.now(), minHoldMs));
      window.addEventListener('keydown', onKey);
      for (const type of ['pointerdown', 'wheel', 'touchstart'] as const) {
        window.addEventListener(type, () => start('pointer'), { once: true, passive: true });
      }
    },
    dismiss() {
      started = true;
      window.clearTimeout(timer);
      hide();
    },
  };
}
```

- [ ] **Step 4: Rewrite `src/overlay/gate.ts`**

```ts
export type GateState = 'loading' | 'ready' | 'entered';

export interface Gate {
  readonly state: GateState;
  setReady(): void;
  enter(): void;
  onEnter(listener: () => void): void;
}

/**
 * The journey's entry state: loading → ready → entered. It has no visuals of its own. The opening
 * layer shows it through `data-state` on `root`, and `status` is a screen-reader-only message.
 * Content is never hidden from screen readers: sections stay in the DOM underneath.
 */
export function createGate(root: HTMLElement, status: HTMLElement): Gate {
  const listeners: Array<() => void> = [];
  let state: GateState = 'loading';

  const setState = (next: GateState) => {
    state = next;
    root.dataset.state = next;
  };

  const gate: Gate = {
    get state() {
      return state;
    },
    setReady() {
      if (state !== 'loading') return;
      setState('ready');
      status.textContent = '';
    },
    enter() {
      if (state === 'entered') return;
      setState('entered');
      status.textContent = '';
      document.documentElement.classList.remove('is-gated');
      for (const listener of listeners) listener();
    },
    onEnter(listener) {
      listeners.push(listener);
    },
  };
  return gate;
}
```

- [ ] **Step 5: Read `?hold` in `src/app/params.ts`**

Add to the `DebugParams` interface, after `moon`:

```ts
  /** `?hold=ms`: the opening's minimum hold, for tests. Undefined uses the default 2.2 s. */
  hold?: number;
```

Add `const holdValue = number('hold');` after `const moonValue = number('moon');`. Add this to the returned object, after the `moon` line:

```ts
    hold: holdValue === undefined || holdValue < 0 ? undefined : holdValue,
```

- [ ] **Step 6: Replace the title screen markup in `index.html`**

Replace the whole `<header class="gate" id="gate" data-state="loading">…</header>` element with:

```html
    <div class="opening" id="opening" data-state="loading" aria-hidden="true">
      <svg class="opening__glyph" aria-hidden="true" focusable="false"><use href="#glyph" /></svg>
      <p class="opening__hello">Hello, voyager</p>
      <p class="opening__line">A moonlit journey across the sea.</p>
    </div>
```

Add this as the **first child** of `<main class="content" id="content">`, so the screen-reader message sits inside a landmark (axe flags page text outside landmarks):

```html
      <p class="visually-hidden" id="load-status" role="status">Loading the scene…</p>
```

In the `<noscript>` styles, replace `.gate { display: none; }` with:

```css
        .opening { display: none; }
```

- [ ] **Step 7: Replace the title screen styles in `src/styles/overlay.css`**

Delete the `/* ---------- title screen ---------- */` comment and every rule after it whose selector begins with `.gate`, down to and including `.gate__enter:disabled { … }`. Put this in their place:

```css
/* ---------- opening ---------- */
.opening {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.75rem;
  padding-block: max(1.5rem, env(safe-area-inset-top));
  padding-inline: max(1.5rem, env(safe-area-inset-left)) max(1.5rem, env(safe-area-inset-right));
  text-align: center;
  background: var(--night);
  /* Leaving: the black lifts over 1.8 s, starting once the greeting has begun to fade. */
  transition: opacity 1.8s ease 0.5s;
}

.opening > * {
  transition: opacity 0.7s ease;
}

.opening__glyph {
  width: 4.5rem;
  height: 4.5rem;
  color: var(--ink);
  filter: drop-shadow(0 0 14px rgba(159, 230, 238, 0.45));
}

.opening__hello {
  margin: 0.5rem 0 0;
  /* Balances the trailing letter-spacing so the line stays optically centred. */
  padding-left: 0.3em;
  font-family: var(--font-display);
  font-size: clamp(1.9rem, 8vw, 4.5rem);
  font-weight: 400;
  letter-spacing: 0.3em;
}

.opening__line {
  margin: 0;
  color: var(--ink-dim);
  font-family: var(--font-accent);
  font-size: clamp(1.2rem, 4.8vw, 1.6rem);
  font-style: italic;
  font-weight: 300;
  letter-spacing: 0.01em;
}

.opening[hidden] {
  display: none;
}

.opening.is-leaving {
  opacity: 0;
  pointer-events: none;
}

.opening.is-leaving > * {
  opacity: 0;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
```

Inside the `.content` rule, replace the multi-line comment above `transition: opacity 0.9s ease 1.2s;` with:

```css
  /* Held at 0 by html.is-gated below. When the opening starts to leave, its greeting fades in 0.7 s,
     so this reveal waits 1.2 s: the name never appears while the greeting is still on screen. */
```

In the `.controls` rule, change the comment `/* Above the title screen, so motion can be reduced before entering */` to:

```css
  /* Above the opening, so motion can be reduced before the journey starts */
```

Replace the whole reduced-motion section at the end of the file (the `@media (prefers-reduced-motion: reduce)` block and the two `html.is-reduced-motion` rules) with:

```css
/* ---------- reduced motion ---------- */
@media (prefers-reduced-motion: reduce) {
  .opening,
  .opening > *,
  .content {
    transition: none;
  }
}

html.is-reduced-motion .opening,
html.is-reduced-motion .opening > *,
html.is-reduced-motion .content {
  transition: none;
}
```

Confirm nothing is left behind: `grep -n "gate" src/styles/overlay.css` returns nothing.

- [ ] **Step 8: Wire it in `src/app/boot.ts`**

Add the import after `import { createMotionToggle } from '../overlay/motionToggle';`:

```ts
import { createOpening } from '../overlay/opening';
```

Replace `const gate = createGate(byId('gate'), byId<HTMLButtonElement>('gate-enter'), byId('gate-status'));` with:

```ts
  const openingElement = byId('opening');
  const gate = createGate(openingElement, byId('load-status'));
  const opening = createOpening(openingElement, { minHoldMs: params.hold });
```

Replace:

```ts
  gate.onEnter(() => {
    scroll.setLocked(false);
    byId('intro-title').focus({ preventScroll: true });
  });
```

with:

```ts
  gate.onEnter(() => {
    scroll.setLocked(false);
  });
```

Replace the "Skip intro" listener and the `?p` hook that follows it:

```ts
  byId<HTMLAnchorElement>('skip-intro').addEventListener('click', (event) => {
    event.preventDefault();
    gate.enter();
    scroll.scrollToProgress(progressForSection(journey, 'about'), true);
    byId('about-title').focus({ preventScroll: true });
  });
  // Test hook: ?p=… jumps straight into the journey
  if (params.p !== undefined) gate.enter();
```

with:

```ts
  byId<HTMLAnchorElement>('skip-intro').addEventListener('click', (event) => {
    event.preventDefault();
    gate.enter();
    opening.dismiss();
    scroll.scrollToProgress(progressForSection(journey, 'about'), true);
    byId('about-title').focus({ preventScroll: true });
  });
  // Test hook: ?p=… jumps straight into the journey, past the opening
  if (params.p !== undefined) {
    gate.enter();
    opening.dismiss();
  }

  // The opening leaves by itself once the page is ready (spec §5.8). A key that starts it moves focus
  // to the intro heading for keyboard users; an automatic or pointer start moves no focus, so no
  // focus ring appears around the name.
  const openWhenReady = () =>
    opening.begin({
      reducedMotion: () => ctx.reducedMotion,
      onStart: (how) => {
        gate.enter();
        if (how === 'key') byId('intro-title').focus({ preventScroll: true });
      },
    });
```

In `startStills`, directly after its `gate.setReady();`, add:

```ts
    openWhenReady();
```

In the 3D path, directly after `if (contextLost) return;` and the `gate.setReady();` that follows it, add:

```ts
  openWhenReady();
```

- [ ] **Step 9: Hide the opening if boot throws, in `src/main.ts`**

Replace the `boot().catch(…)` call with:

```ts
boot().catch((error: unknown) => {
  // Something unexpected: keep the text readable rather than leaving the black opening up
  console.error('Moonlit failed to start.', error);
  document.documentElement.classList.remove('is-gated');
  document.documentElement.classList.add('is-stills');
  document.getElementById('opening')?.setAttribute('hidden', '');
});
```

- [ ] **Step 10: Run the tests to confirm they pass**

```bash
npx tsc --noEmit && npx tsc --noEmit -p tsconfig.node.json && npm run check && npm run test
grep -rn "gate-enter\|gate-status\|gate__" src index.html
```

Expected: all pass, and the grep prints nothing. If Biome only reports formatting or import order, run `npm run format` and re-run `npm run check`. The e2e specs that click "Click to enter" (`gate`, `smoke`, `a11y`) now fail in a browser, and so does the Task 5 spike script; Task 8 rewrites the specs, so don't run e2e here.

- [ ] **Step 11: Commit**

```bash
git add src/overlay/opening.ts src/overlay/gate.ts src/app/params.ts index.html src/styles/overlay.css src/app/boot.ts src/main.ts tests/unit/opening.test.ts tests/unit/params.test.ts
git commit -m "feat: open on a black Hello, voyager screen that leaves by itself"
```

**Walkthrough (for the owner):** the page now opens black, with the glyph, "Hello, voyager" and your italic line. Behind it the sea loads. Once it's ready, and at least 2.2 s have passed so the greeting can be read, the words fade and the black lifts. Tap, scroll or press a key to go sooner. Tab still moves between links, and keys pressed on a link or button do their own job, so "Skip intro" and "Reduce motion" stay usable. A keyboard start moves focus to your name for screen readers; a tap or the automatic start doesn't, so no focus box appears. The old "Click to enter" button is gone. The gate code still tracks whether the journey has started; it just has nothing to click.

**Check (owner):** reload the site. The black greeting holds, then fades into the sea and your name. Reload again and tap straight away: it goes sooner.

---

### Task 7: A shorter journey, tunable by feel

**Files:**
- Modify: `src/journey/journey.config.ts` (full rewrite)
- Modify: `src/app/params.ts` (`?length`)
- Modify: `src/app/boot.ts` (use the tuned journey)
- Test: `tests/unit/journeyConfig.test.ts` (new), `tests/unit/timeline.test.ts`, `tests/unit/params.test.ts`

**Interfaces:**
- Produces:
  - `export const MOONSINK_LENGTH = 2.4`
  - `export function journeyWithLength(length: number): readonly Segment[]`
  - `DebugParams.length?: number`, clamped to 1.5–4

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/journeyConfig.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { journey, journeyWithLength, MOONSINK_ABOUT_FROM, MOONSINK_LENGTH } from '../../src/journey/journey.config';
import { progressForSection, totalLength } from '../../src/journey/timeline';

describe('journey config', () => {
  it('makes Moonsink Shore 2.4 screen heights long', () => {
    expect(MOONSINK_LENGTH).toBe(2.4);
    expect(totalLength(journey)).toBe(2.4);
  });

  it('can rebuild the journey with another length for tuning, keeping the anchors', () => {
    const tuned = journeyWithLength(3.1);
    expect(totalLength(tuned)).toBe(3.1);
    expect(progressForSection(tuned, 'about')).toBeCloseTo(MOONSINK_ABOUT_FROM, 10);
  });
});
```

In `tests/unit/timeline.test.ts`, inside `'adds up every segment'`, change `expect(totalLength(journey)).toBe(3);` to:

```ts
    expect(totalLength(journey)).toBe(2.4);
```

In `tests/unit/params.test.ts`, add `length: undefined,` to the defaults object, and add this test inside the `describe`:

```ts
  it('reads a journey length and clamps it to 1.5–4 screen heights', () => {
    expect(readDebugParams('?length=2.8').length).toBe(2.8);
    expect(readDebugParams('?length=9').length).toBe(4);
    expect(readDebugParams('?length=0.5').length).toBe(1.5);
    expect(readDebugParams('?length=abc').length).toBeUndefined();
  });
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run tests/unit/journeyConfig.test.ts tests/unit/timeline.test.ts tests/unit/params.test.ts`
Expected: FAIL. `journeyWithLength` and `MOONSINK_LENGTH` don't exist, the length is still 3, and `length` isn't read.

- [ ] **Step 3: Rewrite `src/journey/journey.config.ts`**

```ts
import type { Segment } from './types';

/** Where the About text begins inside Moonsink Shore (0..1 of the region). */
export const MOONSINK_ABOUT_FROM = 0.45;

/** Moonsink Shore's scroll length in screen heights. It was 3; the owner asked for a little shorter. */
export const MOONSINK_LENGTH = 2.4;

/** The journey with Moonsink's length replaced, for the `?length` tuning hook. Called once at boot. */
export function journeyWithLength(length: number): readonly Segment[] {
  return [
    {
      kind: 'region',
      region: 'moonsink',
      length,
      sections: [
        { id: 'intro', from: 0 },
        { id: 'about', from: MOONSINK_ABOUT_FROM },
      ],
    },
  ];
}

export const journey: readonly Segment[] = journeyWithLength(MOONSINK_LENGTH);
```

- [ ] **Step 4: Read `?length` in `src/app/params.ts`**

Add to the `DebugParams` interface, after `hold`:

```ts
  /** `?length=`: Moonsink's scroll length in screen heights, for tuning by feel (clamped 1.5–4). */
  length?: number;
```

Add `const lengthValue = number('length');` after `const holdValue = number('hold');`. Add this to the returned object, after the `hold` line:

```ts
    length: lengthValue === undefined ? undefined : Math.min(4, Math.max(1.5, lengthValue)),
```

- [ ] **Step 5: Use the tuned journey in `src/app/boot.ts`**

Change the journey import to:

```ts
import { journey, journeyWithLength } from '../journey/journey.config';
```

Directly after `const params = readDebugParams(window.location.search);`, add:

```ts
  // `?length` lets the owner tune the journey's length by feel; everything below reads this.
  const activeJourney = params.length === undefined ? journey : journeyWithLength(params.length);
```

Then replace every use of `journey` as a **value** in `boot.ts` with `activeJourney`. That covers `totalLength(journey)`, every `resolve(p, journey)`, `progressForSection(journey, 'about')` and `(journey[0] as RegionSegment)`. Leave the import line alone. Confirm:

```bash
grep -n "journey" src/app/boot.ts
```

Expected: `journey` (without `active`) appears only in the import line and in the `activeJourney` definition.

- [ ] **Step 6: Run the tests to confirm they pass**

```bash
npx tsc --noEmit && npx tsc --noEmit -p tsconfig.node.json && npm run check && npm run test
```

Expected: all pass. `progressForSection(journey, 'about')` is still 0.45 (one region), so the existing timeline and handover tests hold. If Biome only reports formatting, run `npm run format` and re-run `npm run check`.

- [ ] **Step 7: Commit**

```bash
git add src/journey/journey.config.ts src/app/params.ts src/app/boot.ts tests/unit/journeyConfig.test.ts tests/unit/timeline.test.ts tests/unit/params.test.ts
git commit -m "feat: shorten the journey to 2.4 screen heights, with a ?length tuning hook"
```

**Walkthrough (for the owner):** the whole Moonsink journey is now 2.4 screen heights of scrolling instead of 3, about 20% shorter, and the text and camera keep their positions *within* it. Add `?length=2` or `?length=3` to try other values by feel. Tell me the one you like and it becomes the default.

**Check (owner):** compare `?length=2.4` with `?length=3` on your phone. The journey should feel a little quicker, not rushed.

---

### Task 8: Browser tests, docs, and full verification

**Files:**
- Modify: `tests/e2e/gate.spec.ts` (full rewrite: the opening)
- Modify: `tests/e2e/smoke.spec.ts` (full rewrite)
- Modify: `tests/e2e/sections.spec.ts` (full rewrite: sequential handover)
- Modify: `tests/e2e/a11y.spec.ts` (the title-screen test becomes the opening test)
- Modify: `docs/superpowers/specs/2026-09-14-journey-flow-design.md` and `docs/superpowers/specs/2026-09-13-moonlit-portfolio-design.md` (the key rules and test hooks as built)

**Interfaces:**
- Consumes: `#opening` with `data-state` (`loading` | `ready` | `entered`), `.opening__hello`, `#intro`, `#about`, `#intro-title`, `#about-title`, and the `?stills`, `?p`, `?hold`, `?moon`, `?tier`, `?time` URL hooks.

- [ ] **Step 1: Rewrite `tests/e2e/gate.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

// Stills mode runs the same opening as the 3D page, without waiting for shaders on a CPU renderer.
// `?hold=600000` keeps the greeting up, so a test can act before it would leave on its own.

test('the opening greets, then leaves by itself once the page is ready', async ({ page }) => {
  await page.goto('/?stills');
  await expect(page.locator('.opening__hello')).toHaveText('Hello, voyager');
  await expect(page.locator('#opening')).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'entered');
  // An automatic start moves no focus, so nothing draws a focus ring.
  expect(await page.evaluate(() => document.querySelector(':focus-visible')?.id ?? null)).toBeNull();
});

test('a key press starts the journey and moves focus to the intro heading', async ({ page }) => {
  await page.goto('/?stills&hold=600000');
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'ready');
  await page.keyboard.press('Enter');
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'entered');
  await expect(page.locator('#intro-title')).toBeFocused();
});

test('a tap starts the journey without leaving a focus ring on the name', async ({ page }) => {
  await page.goto('/?stills&hold=600000');
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'ready');
  await page.mouse.click(40, 40);
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'entered');
  expect(await page.evaluate(() => document.querySelector(':focus-visible')?.id ?? null)).toBeNull();
});

test('Skip intro is the first Tab stop and lands on About', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit only tabs to form controls by default, not links');
  await page.goto('/?stills&hold=600000');
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'ready');

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip intro' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.locator('#about-title')).toBeFocused();
  await expect(page.locator('#opening')).toBeHidden();
  await expect(page.locator('#about')).toHaveClass(/is-active/);
});
```

- [ ] **Step 2: Rewrite `tests/e2e/smoke.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { collectConsoleErrors, waitForMoonlit } from './helpers';

test('the page loads without console errors and the world renders', async ({ page }) => {
  // Two long waits below (shader compile, then first frames) can each take up to 90 s on a CPU-rendered CI browser
  test.setTimeout(200_000);
  const errors = collectConsoleErrors(page);
  await page.goto('/?time=4');

  await expect(page.locator('.opening__hello')).toHaveText('Hello, voyager');
  await waitForMoonlit(page);

  const backend = await page.evaluate(() => window.__moonlit?.backend);
  expect(['webgpu', 'webgl2', 'stills']).toContain(backend);
  if (backend !== 'stills') {
    await page.waitForFunction(() => (window.__moonlit?.frames() ?? 0) > 10, undefined, { timeout: 90_000 });
  }
  expect(errors).toEqual([]);
});

test('stills mode keeps the page usable', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto('/?stills');
  await waitForMoonlit(page);
  expect(await page.evaluate(() => window.__moonlit?.backend)).toBe('stills');
  await expect(page.locator('#opening')).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('#intro')).toHaveClass(/is-active/);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 3: Rewrite `tests/e2e/sections.spec.ts`**

```ts
import { expect, type Page, test } from '@playwright/test';

// Stills mode runs the same section logic as the 3D page, without waiting for shaders. With one
// region, `?p` equals region-local position: the intro leaves over 0.31–0.41, nothing shows over
// 0.41–0.49, and About arrives over 0.49–0.59 (journey-flow design §5.1).
const opacityOf = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => Number(getComputedStyle(element).opacity));

test('scroll progress decides which section is shown', async ({ page }) => {
  await page.goto('/?stills&p=0.8');
  await expect(page.locator('#about')).toHaveClass(/is-active/);
  await expect.poll(() => opacityOf(page, '#about')).toBe(1);
  expect(await opacityOf(page, '#intro')).toBe(0);

  await page.goto('/?stills&p=0');
  await expect(page.locator('#intro')).toHaveClass(/is-active/);
  await expect.poll(() => opacityOf(page, '#intro')).toBe(1);
});

test('the intro leaves before About arrives, with a gap between them (spec §5.4a)', async ({ page }) => {
  await page.goto('/?stills&p=0.36');
  await expect.poll(() => opacityOf(page, '#intro')).toBeGreaterThan(0);
  expect(await opacityOf(page, '#intro')).toBeLessThan(1);
  expect(await opacityOf(page, '#about')).toBe(0);

  await page.goto('/?stills&p=0.45');
  // `is-active` is written in the same call as the opacities, so once it lands the values are current.
  await expect(page.locator('#about')).toHaveClass(/is-active/);
  expect(await opacityOf(page, '#intro')).toBe(0);
  expect(await opacityOf(page, '#about')).toBe(0);

  await page.goto('/?stills&p=0.54');
  await expect.poll(() => opacityOf(page, '#about')).toBeGreaterThan(0);
  expect(await opacityOf(page, '#about')).toBeLessThan(1);
  expect(await opacityOf(page, '#intro')).toBe(0);
});
```

- [ ] **Step 4: Replace the title-screen test in `tests/e2e/a11y.spec.ts`**

Replace the whole `test('title screen has no axe violations', …)` block with:

```ts
  test('the opening has no axe violations', async ({ page }) => {
    await page.goto('/?stills&hold=600000');
    await expect(page.locator('#opening')).toHaveAttribute('data-state', 'ready');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
```

Leave the About test and the full-moon contrast test unchanged. Both enter through `?p`, which removes the opening.

- [ ] **Step 5: Record the as-built rules in the docs**

In `docs/superpowers/specs/2026-09-14-journey-flow-design.md`, make these three replacements.

Find:

```markdown
- **"Skip intro"** stays the first focusable element. It starts the opening straight away, scrolls to About and focuses the About heading.
```

Replace with:

```markdown
- **"Skip intro"** stays the first focusable element. It removes the opening at once, scrolls to About and focuses the About heading.
- **Keys that don't start the opening:** Tab and Shift, and any key pressed on a link or button. They keep their normal job, so "Skip intro" and "Reduce motion" stay usable while the greeting is up.
```

Find:

```markdown
- **Test hook `?p=`** jumps into the journey and removes the opening at once, so browser tests stay fast.
```

Replace with:

```markdown
- **Test hook `?p=`** jumps into the journey and removes the opening at once, so browser tests stay fast.
- **Test hook `?hold=ms`** keeps the greeting up at least that long, so a browser test can act before it leaves on its own.
```

Find:

```markdown
| `src/app/params.ts` | `length?: number`, clamped 1.5–4 |
```

Replace with:

```markdown
| `src/app/params.ts` | `length?: number`, clamped 1.5–4; `hold?: number`, a test hook in ms |
```

In `docs/superpowers/specs/2026-09-13-moonlit-portfolio-design.md`, make these two replacements.

Find:

```markdown
- The opening moves focus to the intro heading only when a key started it. An automatic or pointer start leaves focus alone, so no focus ring appears around the name.
```

Replace with:

```markdown
- The opening moves focus to the intro heading only when a key started it. An automatic or pointer start leaves focus alone, so no focus ring appears around the name. Tab, Shift and keys pressed on a link or button never start it.
```

Find:

```markdown
- `?length=2.4`: override the journey length in screen heights, for tuning (clamped to 1.5–4)
```

Replace with:

```markdown
- `?length=2.4`: override the journey length in screen heights, for tuning (clamped to 1.5–4)
- `?hold=600000`: keep the opening's greeting up at least this many milliseconds (tests)
```

- [ ] **Step 6: Verify types and lint, then commit**

```bash
npx tsc --noEmit && npx tsc --noEmit -p tsconfig.node.json && npm run check && npm run test
git add tests/e2e/gate.spec.ts tests/e2e/smoke.spec.ts tests/e2e/sections.spec.ts tests/e2e/a11y.spec.ts docs/superpowers/specs/2026-09-14-journey-flow-design.md docs/superpowers/specs/2026-09-13-moonlit-portfolio-design.md
git commit -m "test: cover the opening and the sequential handover in the browser"
```

- [ ] **Step 7: Full verification (controller)**

```bash
npm run build
npm run size
npx playwright test --workers=1
```

Expected: the build succeeds; size stays under 270 KB gzip; every browser test passes in Chromium, Firefox and WebKit. The accepted skips are axe and the contrast test outside Chromium, and Skip intro on WebKit. Run with `--workers=1` locally: three parallel browsers rendering WebGL on the CPU have run this machine out of memory before.

- [ ] **Step 8: Owner acceptance on the phone**

With the dev server exposed (`npm run dev -- --host`), the owner opens `http://<computer's LAN address>:5173/?hud` and checks:

1. **Opening:** a black "Hello, voyager" holds, then the greeting fades, the black lifts and the name arrives. Tapping early goes sooner.
2. **Text handover:** the intro leaves completely, only the sea shows for a moment, then About arrives. Two texts are never on screen together.
3. **Camera:** drag and stop. The view stops with the finger.
4. **Stutter:** scroll top to bottom and back three times at the settled tier. `tier changes in scroll` stays 0, and `in scroll … long frames` grows by at most 3 per pass. If not, the remaining cost is the 3D scene (design §5.3), which is the next lever, not a failure of this plan.
5. **Length:** compare `?length=2.4` with `?length=3`, and tell Claude the preferred value.
6. **Type:** a heavy greeting, name and headings, with a light italic subtitle and tagline.

**Walkthrough (for the owner):** the browser tests now check what you'll see. The opening greets and leaves by itself. A key moves focus for keyboard users; a tap doesn't draw a focus box. Skip intro still works. And the intro and About texts are never visible at the same moment: the test looks at the gap between them and requires both to be fully transparent there.

**Check (owner):** the six phone checks above.

---

## After all tasks

Final whole-branch review against both spec documents, with §3.4 (composition) and §5.3 (stutter acceptance) as explicit lenses. Then the owner's phone acceptance before any merge. Nothing is pushed without asking.
