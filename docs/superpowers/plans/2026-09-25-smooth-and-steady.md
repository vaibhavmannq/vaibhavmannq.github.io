# Smooth and Steady Implementation Plan (waxing voyage, plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frames evenly paced at every refresh rate, a fast scroll that never stacks pages, headings without a
clipped halo, the same composition in a window and full screen, and a sea about twice as fast.

**Architecture:**
- A pure `Pacer` measures the display's refresh and renders every Nth vsync. The governor judges frames against
  that interval instead of a fixed 16.7 ms.
- Section text goes through a pure `createHandover` state machine that allows one shown page at a time.
- Heading masks clip to an outset `clip-path`.
- Text panels are scaled into the scene's 16:9 frame.
- The ray march starts at a per-frame bounding plane computed from the camera.

Every look-and-feel change sits behind a `?switch` until the owner has felt it on the phone.

**Tech Stack:** TypeScript 7, Vite 8, Three.js 0.186 (WebGPU + TSL), GSAP 3.15 SplitText, Lenis 1.3, Vitest 5,
Playwright 1.63, Biome 2.5.

**Spec:** `docs/superpowers/specs/2026-09-25-waxing-voyage-design.md`, sections §4.1, §4.2, §4.12, §4.13, §4.14,
§5, §7. Plan 2 (the waxing voyage) covers §4.3–§4.11.

## Global Constraints

- Branch `waxing-voyage`. **Never push.** Pushing `main` publishes the site; only the owner says when.
- Commits carry **no attribution trailers**: no `Co-Authored-By`, no "Generated with", no session lines.
- Commit messages follow the repo's style: `feat: …`, `fix: …`, `perf: …`, `docs: …`, lower case, plain words.
- No new dependencies. JavaScript stays ≤ 330 kB gzip (`npm run size`).
- Everything visible stays a pure function of scroll, except the eased text (S35), which still takes its target
  only from scroll.
- The moon and the sky never move (S27): yaw 0 and pitch −0.06, unchanged in this plan.
- TSL `setLayout()` functions stay pure: uniforms are read in the main shader body and passed in (S2).
- Judge anything visual on `npm run preview`, never the dev server.
- Before any `npm run e2e` or `npx playwright test`, stop anything on port 4173. Playwright reuses a running server
  and would silently test stale code.
- Long bash heredocs fail on this machine. For multi-line scripts, write a file and run it.
- After each task, give the owner a plain-language walkthrough of what changed and why.
- Checks that must be green before every commit: `npm run check`, `npm test`, and `npm run build` for any `src/`
  change.

## Review Focus

1. **A long frame during the refresh measurement** (shader compile, garbage collection): the median must ignore
   it. The page must not settle on 30 Hz. Pinned in Task 1.
2. **The window dragged to a 144 Hz monitor mid-visit:** the resize triggers a new measurement and the new
   cadence. Pinned in Task 1.
3. **A scroll flung down and then reversed before the exit finishes:** never two pages, and it lands on the page
   under the scroll. Pinned in Task 4.
4. **A window exactly 16:9, taller than 16:9 (a portrait phone), or ultra-wide:** scale 1 and shift 0 when not
   wider than 16:9; otherwise scaled into the frame. Pinned in Task 6.
5. **A reduced-motion visitor flinging fast:** the hard switch, never two pages. Pinned in Task 4.

---

### Task 1: The pacer — measure the refresh, render every Nth vsync

**Files:**
- Create: `src/app/refresh.ts`
- Test: `tests/unit/refresh.test.ts`

**Interfaces:**
- Consumes: `frameInterval(idle, fps, idleFps)` and `shouldRender(nowMs, lastFrameMs, intervalMs)` from `src/app/frameRate.ts` (unchanged).
- Produces:
  - `MEASURE_SAMPLES: number`
  - `refreshFromDeltas(deltasMs: readonly number[]): number`
  - `frameDivisor(hz: number, targetFps?: number): number`
  - `interface Pacer { tick(nowMs: number, idle: boolean): boolean; remeasure(): void; readonly refreshHz: number | null; readonly targetIntervalMs: number }`
  - `createPacer(options?: { full?: boolean; fallbackFps?: number; idleFps?: number }): Pacer`

- [ ] **Step 1: Write the failing tests**

`tests/unit/refresh.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPacer, frameDivisor, MEASURE_SAMPLES, refreshFromDeltas } from '../../src/app/refresh';

/** Feed a pacer animation frames at `hz` for `seconds`; returns the intervals between rendered frames. */
function run(pacer: ReturnType<typeof createPacer>, hz: number, seconds: number, startMs = 1000): number[] {
  const rendered: number[] = [];
  for (let n = 0; n < hz * seconds; n++) {
    const now = startMs + (n * 1000) / hz;
    if (pacer.tick(now, false)) rendered.push(now);
  }
  return rendered.slice(1).map((t, i) => t - (rendered[i] as number));
}

describe('refreshFromDeltas', () => {
  it('reads the display rate from the median frame delta', () => {
    expect(refreshFromDeltas(Array(30).fill(1000 / 60))).toBeCloseTo(60, 5);
    expect(refreshFromDeltas(Array(30).fill(1000 / 144))).toBeCloseTo(144, 5);
  });

  // Review focus 1: a shader compile or a GC pause during measurement must not read as a slow screen.
  it('ignores a few long frames among the samples', () => {
    const deltas = [...Array(26).fill(1000 / 60), 250, 90, 48, 33];
    expect(refreshFromDeltas(deltas)).toBeCloseTo(60, 5);
  });

  it('falls back to 60 Hz with no samples', () => {
    expect(refreshFromDeltas([])).toBe(60);
  });
});

describe('frameDivisor', () => {
  it('renders every vsync up to ~90 Hz, every second one to ~150 Hz, every third above', () => {
    expect([60, 75, 90, 100, 120, 144, 165].map((hz) => frameDivisor(hz))).toEqual([1, 1, 2, 2, 2, 2, 3]);
    expect(frameDivisor(59.94)).toBe(1);
    expect(frameDivisor(119.88)).toBe(2);
  });
});

describe('createPacer', () => {
  it('keeps frames evenly spaced on every common refresh rate once measured', () => {
    for (const hz of [60, 75, 90, 100, 120, 144, 165]) {
      const intervals = run(createPacer(), hz, 5).slice(MEASURE_SAMPLES);
      const distinct = new Set(intervals.map((ms) => ms.toFixed(2)));
      expect(distinct.size, `${hz} Hz`).toBe(1);
      const expected = (frameDivisor(hz) * 1000) / hz;
      expect(intervals[0], `${hz} Hz`).toBeCloseTo(expected, 5);
    }
  });

  it('reports the measured refresh and the target interval the governor should judge against', () => {
    const pacer = createPacer();
    expect(pacer.refreshHz).toBeNull();
    expect(pacer.targetIntervalMs).toBeCloseTo(1000 / 60, 5);
    run(pacer, 90, 1);
    expect(pacer.refreshHz).toBeCloseTo(90, 5);
    expect(pacer.targetIntervalMs).toBeCloseTo(2000 / 90, 5);
  });

  it('renders every vsync when asked for full pace', () => {
    const intervals = run(createPacer({ full: true }), 90, 2).slice(MEASURE_SAMPLES);
    expect(intervals.every((ms) => Math.abs(ms - 1000 / 90) < 1e-6)).toBe(true);
  });

  it('halves the rate when idle', () => {
    const pacer = createPacer();
    run(pacer, 60, 1);
    const rendered: number[] = [];
    for (let n = 0; n < 60; n++) {
      const now = 5000 + (n * 1000) / 60;
      if (pacer.tick(now, true)) rendered.push(now);
    }
    expect(rendered.length).toBeGreaterThanOrEqual(29);
    expect(rendered.length).toBeLessThanOrEqual(31);
  });

  it('still counts a vsync the browser skipped', () => {
    const pacer = createPacer();
    run(pacer, 120, 1);
    // Next callbacks arrive 3 vsyncs apart (a busy main thread): each one renders, none waits for a 4th.
    const vsync = 1000 / 120;
    let t = 10_000;
    expect(pacer.tick(t, false)).toBe(true);
    t += 3 * vsync;
    expect(pacer.tick(t, false)).toBe(true);
  });

  // Review focus 2: a window dragged from a 60 Hz laptop screen to a 144 Hz monitor.
  it('re-measures after remeasure() and adopts the new cadence', () => {
    const pacer = createPacer();
    run(pacer, 60, 1);
    expect(pacer.refreshHz).toBeCloseTo(60, 5);
    pacer.remeasure();
    expect(pacer.refreshHz).toBeNull();
    const intervals = run(pacer, 144, 2, 20_000).slice(MEASURE_SAMPLES);
    expect(pacer.refreshHz).toBeCloseTo(144, 5);
    expect(new Set(intervals.map((ms) => ms.toFixed(2))).size).toBe(1);
    expect(intervals[0]).toBeCloseTo(2000 / 144, 5);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/refresh.test.ts`
Expected: FAIL. The module `../../src/app/refresh` does not exist yet.

- [ ] **Step 3: Implement `src/app/refresh.ts`**

```ts
import { frameInterval, shouldRender } from './frameRate';

/** How many animation-frame deltas decide the refresh rate: half a second at 60 Hz. */
export const MEASURE_SAMPLES = 30;

/**
 * The display's refresh rate in Hz, from the time between animation frames. The median, so a shader compile
 * or a garbage-collection pause during the measurement cannot make a 60 Hz screen read as 30 Hz. Pure.
 */
export function refreshFromDeltas(deltasMs: readonly number[]): number {
  if (deltasMs.length === 0) return 60;
  const sorted = [...deltasMs].sort((a, b) => a - b);
  return 1000 / (sorted[Math.floor(sorted.length / 2)] as number);
}

/**
 * Render every Nth vsync, so frames stay evenly spaced and near 60 fps: 90 Hz renders every second one (45 fps),
 * 144 Hz every second one (72 fps). The old "60 fps minus 2 ms" cap spaced 90 Hz frames 22 ms apart, which the
 * governor read as slow (spec 2026-09-25 §4.1). Pure.
 */
export function frameDivisor(hz: number, targetFps = 60): number {
  return Math.max(1, Math.round(hz / targetFps));
}

export interface Pacer {
  /** Call on every animation frame; true when this frame should render. */
  tick(nowMs: number, idle: boolean): boolean;
  /** Forget the measured refresh: the tab was hidden, or the window may now be on another screen. */
  remeasure(): void;
  /** The measured refresh in Hz, or null while measuring. */
  readonly refreshHz: number | null;
  /** Time between rendered frames when not idle, in ms: the interval the governor judges against. */
  readonly targetIntervalMs: number;
}

export function createPacer(options: { full?: boolean; fallbackFps?: number; idleFps?: number } = {}): Pacer {
  const fallbackFps = options.fallbackFps ?? 60;
  const idleFps = options.idleFps ?? 30;
  let deltas: number[] = [];
  let lastTick = -1;
  let lastRender = -1;
  let vsyncMs: number | null = null;
  let divisor = 1;

  return {
    tick(nowMs, idle) {
      if (vsyncMs === null && lastTick >= 0) {
        deltas.push(nowMs - lastTick);
        if (deltas.length >= MEASURE_SAMPLES) {
          const hz = refreshFromDeltas(deltas);
          vsyncMs = 1000 / hz;
          divisor = options.full ? 1 : frameDivisor(hz);
        }
      }
      lastTick = nowMs;

      // Until the screen is measured, the old time-based cap keeps the first half second smooth enough.
      if (vsyncMs === null) {
        if (!shouldRender(nowMs, lastRender, frameInterval(idle, fallbackFps, idleFps))) return false;
        lastRender = nowMs;
        return true;
      }
      const every = idle ? divisor * 2 : divisor;
      // Whole vsyncs since the last render, so a callback the browser skipped still counts.
      if (lastRender >= 0 && Math.round((nowMs - lastRender) / vsyncMs) < every) return false;
      lastRender = nowMs;
      return true;
    },
    remeasure() {
      deltas = [];
      vsyncMs = null;
      lastTick = -1;
    },
    get refreshHz() {
      return vsyncMs === null ? null : 1000 / vsyncMs;
    },
    get targetIntervalMs() {
      return vsyncMs === null ? 1000 / fallbackFps : vsyncMs * divisor;
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/refresh.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Lint and commit**

```bash
npm run check
git add src/app/refresh.ts tests/unit/refresh.test.ts
git commit -m "feat: measure the display's refresh and pace frames to an even divisor of it"
```

---

### Task 2: The governor judges against the target interval

**Files:**
- Modify: `src/quality/governor.ts` (options, thresholds, new `setTargetInterval`)
- Test: `tests/unit/governor.test.ts` (append), `tests/unit/refreshSimulation.test.ts` (create)

**Interfaces:**
- Consumes: `createPacer`, `MEASURE_SAMPLES` (Task 1).
- Produces:
  - `GovernorOptions` gains `downRatio: number` and `upRatio: number`, and loses `downThresholdMs` and
    `upThresholdMs`.
  - `Governor.setTargetInterval(ms: number): void`. The default is 1000/60.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/governor.test.ts`, inside `describe('Governor', …)`:

```ts
  // Spec 2026-09-25 §4.1: on a 90 Hz screen the pacer renders every second vsync, 22.2 ms apart. That is
  // healthy, not slow.
  it('judges frames against the target interval it is given', () => {
    const governor = new Governor(3, false);
    governor.setTargetInterval(2000 / 90);
    let t = 0;
    for (let i = 0; i < 10; i++) t = runWindow(governor, 2000 / 90, t).endMs;
    expect(governor.current).toBe(3);
    expect(runWindow(governor, 30, t + 2100).change).toBe(2);
  });

  it('keeps S16 exactly at 60 Hz: slow above 20 ms, fast below 17.5 ms', () => {
    const governor = new Governor(2, true);
    expect(runWindow(governor, 19.9, 0).change).toBeNull();
    expect(runWindow(governor, 20.1, 2100).change).toBe(1);
  });
```

Create `tests/unit/refreshSimulation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPacer, MEASURE_SAMPLES } from '../../src/app/refresh';
import { Governor } from '../../src/quality/governor';

// The regression from the 2026-09-25 review: with a GPU that costs nothing, 75, 90 and 144 Hz screens fell to
// tier 0 within 7 s. This runs the real pacer and the real governor, the way boot.ts wires them.
describe('a free GPU on any refresh rate', () => {
  for (const hz of [60, 75, 90, 100, 120, 144, 165]) {
    it(`${hz} Hz: evenly spaced frames and no tier change in 30 s`, () => {
      const pacer = createPacer();
      const governor = new Governor(4, true);
      let last = -1;
      let changes = 0;
      const intervals = new Set<string>();
      for (let n = 0; n < hz * 30; n++) {
        const now = 1000 + (n * 1000) / hz;
        if (!pacer.tick(now, false)) continue;
        if (last >= 0) {
          const interval = now - last;
          if (n > MEASURE_SAMPLES * 4) intervals.add(interval.toFixed(2));
          governor.setTargetInterval(pacer.targetIntervalMs);
          if (governor.sample(interval, now, true) !== null) changes++;
        }
        last = now;
      }
      expect(changes).toBe(0);
      expect(intervals.size).toBe(1);
      expect(governor.current).toBe(4);
    });
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/governor.test.ts tests/unit/refreshSimulation.test.ts`
Expected: FAIL. `setTargetInterval is not a function`.

- [ ] **Step 3: Implement in `src/quality/governor.ts`**

Replace the two threshold fields in `GovernorOptions` and in `DEFAULT_GOVERNOR`:

```ts
export interface GovernorOptions {
  windowMs: number;
  /**
   * Step down when the 95th-percentile interval between rendered frames is above this many target intervals.
   * The target is what the pacer renders at (app/refresh.ts): 16.7 ms on a 60 Hz screen, 22.2 ms on a 90 Hz
   * screen that renders every second vsync. At 60 Hz, 1.2 × 16.7 = 20 ms: S16's threshold, unchanged.
   */
  downRatio: number;
  /** Count a window as fast below this many target intervals: 1.05 × 16.7 = 17.5 ms at 60 Hz, as S16. */
  upRatio: number;
  upWindowsRequired: number;
  cooldownMs: number;
  settleMs: number;
}

export const DEFAULT_GOVERNOR: GovernorOptions = {
  windowMs: 1000,
  downRatio: 1.2,
  upRatio: 1.05,
  upWindowsRequired: 3,
  cooldownMs: 2000,
  settleMs: 20_000,
};
```

Keep the doc comment on `settleMs` as it is today. Add a field and a method to `Governor`:

```ts
  /** The interval between rendered frames on a healthy device (app/refresh.ts). */
  private targetMs = 1000 / 60;

  /** Tell the governor what "on time" is: the pacer's target interval. Called every frame; cheap. */
  setTargetInterval(ms: number): void {
    this.targetMs = ms;
  }
```

In `sample`, replace the two comparisons:

```ts
    if (slowFrames > this.options.downRatio * this.targetMs) {
```

```ts
    if (slowFrames < this.options.upRatio * this.targetMs) {
```

- [ ] **Step 4: Run all the unit tests**

Run: `npm test`
Expected: PASS. Every existing governor test is unchanged and green, because at 60 Hz the thresholds are
identical.

- [ ] **Step 5: Lint and commit**

```bash
npm run check
git add src/quality/governor.ts tests/unit/governor.test.ts tests/unit/refreshSimulation.test.ts
git commit -m "fix: judge frames against the paced interval so 75, 90 and 144 Hz screens keep their tier"
```

---

### Task 3: Wire the pacer into the loop, boot and the HUD; add the switches

**Files:**
- Modify: `src/app/loop.ts` (whole file shown)
- Modify: `src/app/boot.ts:323-355` (the loop callback) and `:365` (`loop.start`)
- Modify: `src/app/params.ts` (four new switches)
- Modify: `src/dev/hud.ts` (a refresh line)
- Test: `tests/unit/params.test.ts`

**Interfaces:**
- Consumes: `createPacer`, `Pacer` (Task 1); `Governor.setTargetInterval` (Task 2).
- Produces:
  - `Loop` gains `readonly pacer: Pacer`.
  - `createLoop(onFrame, pacer?: Pacer)`.
  - `DebugParams` gains `pace?: 'full'`, `march?: 'old'`, `glints?: 'old'` and `frame?: 'old'` (the last three
    are read by Tasks 6 and 7).
  - `HudInfo` gains `refresh: string`.

- [ ] **Step 1: Write the failing params test**

In `tests/unit/params.test.ts`, change the defaults expectation to include the new keys:

```ts
    expect(readDebugParams('')).toEqual({
      tier: undefined,
      p: undefined,
      time: undefined,
      moon: undefined,
      hold: undefined,
      length: undefined,
      pace: undefined,
      march: undefined,
      glints: undefined,
      frame: undefined,
      hud: false,
      gui: false,
      forceWebGL: false,
      stills: false,
    });
```

Append:

```ts
  it('reads the owner-review switches, and only their one alternative value', () => {
    const params = readDebugParams('?pace=full&march=old&glints=old&frame=old');
    expect([params.pace, params.march, params.glints, params.frame]).toEqual(['full', 'old', 'old', 'old']);
    const junk = readDebugParams('?pace=fast&march=new&glints=1&frame');
    expect([junk.pace, junk.march, junk.glints, junk.frame]).toEqual([undefined, undefined, undefined, undefined]);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/params.test.ts`
Expected: FAIL. The extra keys are missing.

- [ ] **Step 3: Implement the params**

In `src/app/params.ts`, add to `DebugParams` after `length`:

```ts
  /** `?pace=full`: render every vsync instead of an even divisor near 60 fps (owner review, spec §7). */
  pace?: 'full';
  /** `?march=old`: the sea's ray march as it was before the bounding plane (owner review, spec §7). */
  march?: 'old';
  /** `?glints=old`: sand glints strongest at the camera, as before (owner review, spec §7). */
  glints?: 'old';
  /** `?frame=old`: text sized by the window, not fitted to the scene's 16:9 frame (owner review, spec §7). */
  frame?: 'old';
```

In `readDebugParams`, before the `return`, add:

```ts
  const only = <T extends string>(key: string, value: T): T | undefined => (query.get(key) === value ? value : undefined);
```

and in the returned object, after `length`:

```ts
    pace: only('pace', 'full'),
    march: only('march', 'old'),
    glints: only('glints', 'old'),
    frame: only('frame', 'old'),
```

- [ ] **Step 4: Run the params tests**

Run: `npx vitest run tests/unit/params.test.ts`
Expected: PASS.

- [ ] **Step 5: Replace `src/app/loop.ts`**

```ts
import type { WebGPURenderer } from 'three/webgpu';
import { createPacer, type Pacer } from './refresh';

export interface Loop {
  start(renderer: WebGPURenderer): void;
  stop(): void;
  isIdle(nowMs: number): boolean;
  /** Decides which animation frames render, and what "on time" means for the governor (app/refresh.ts). */
  readonly pacer: Pacer;
}

const IDLE_AFTER_MS = 8000;
const INPUT_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/**
 * The single animation loop (spec §4.3 rule 1). The pacer renders every Nth vsync, so frames are evenly spaced
 * near 60 fps on any screen; idle halves that; a hidden tab pauses. The refresh is measured again when the tab
 * comes back and when the window is resized, which is how it notices a move to another monitor.
 */
export function createLoop(onFrame: (nowMs: number, dtSeconds: number) => void, pacer: Pacer = createPacer()): Loop {
  let renderer: WebGPURenderer | null = null;
  let lastFrame = -1;
  let lastInput = performance.now();

  const isIdle = (nowMs: number) => nowMs - lastInput > IDLE_AFTER_MS;

  const tick = (nowMs: number) => {
    if (!pacer.tick(nowMs, isIdle(nowMs))) return;
    const dtSeconds = lastFrame < 0 ? 1 / 60 : Math.min(0.1, (nowMs - lastFrame) / 1000);
    lastFrame = nowMs;
    onFrame(nowMs, dtSeconds);
  };

  const run = () => {
    renderer?.setAnimationLoop(tick);
  };
  const halt = () => {
    renderer?.setAnimationLoop(null);
    lastFrame = -1;
  };

  const markInput = () => {
    lastInput = performance.now();
  };
  for (const type of INPUT_EVENTS) window.addEventListener(type, markInput, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      halt();
      return;
    }
    pacer.remeasure();
    run();
  });
  window.addEventListener('resize', () => pacer.remeasure(), { passive: true });

  return {
    start(next) {
      renderer = next;
      run();
    },
    stop: halt,
    isIdle,
    pacer,
  };
}
```

- [ ] **Step 6: Wire `boot.ts`**

Add to the imports:

```ts
import { createPacer } from './refresh';
```

Change `loop = createLoop((nowMs, dtSeconds) => {` so that the callback ends with the pacer argument. The
closing `});` of that call becomes:

```ts
  }, createPacer({ full: params.pace === 'full' }));
```

Inside the callback, immediately before `const next = governor.sample(frameIntervalMs, nowMs, !scrolling);`,
add:

```ts
      governor.setTargetInterval(loop?.pacer.targetIntervalMs ?? 1000 / 60);
```

Replace the `hud?.paint(…)` line with:

```ts
    const refreshHz = loop?.pacer.refreshHz;
    hud?.paint(nowMs, {
      backend: moonlit.backend,
      tier,
      renderScale: TIERS[tier].renderScale,
      progress: p,
      scrolling,
      refresh:
        refreshHz == null
          ? 'measuring'
          : `${Math.round(refreshHz)} Hz → ${Math.round(1000 / (loop?.pacer.targetIntervalMs ?? 16.7))} fps`,
    });
```

In the `setTier` of the dev GUI, the `new Governor(next, webgpu)` line stays as it is: the loop callback sets the
target on the new governor at the next frame.

- [ ] **Step 7: The HUD line**

In `src/dev/hud.ts`, add `refresh: string;` to `HudInfo`. In `paint`, insert this after the `tier` line:

```ts
        `display   ${info.refresh}`,
```

- [ ] **Step 8: Build, test and check it running**

Run: `npm run check; npm test; npm run build`
Expected: all green; the size check stays below 330 kB (`npm run size`).

Then start `npm run preview`. In the Playwright MCP browser (headed, with the real GPU), open
`http://localhost:4173/?hud`. After about 1 s the HUD reads `display   60 Hz → 60 fps` on this laptop's 60 Hz
panel. Stop the preview.

- [ ] **Step 9: Commit**

```bash
git add src/app/loop.ts src/app/boot.ts src/app/params.ts src/dev/hud.ts tests/unit/params.test.ts
git commit -m "feat: pace the render loop by the measured refresh, and add the owner-review switches"
```

---

### Task 4: The exclusive handover — one page at a time, however fast the scroll

**Files:**
- Modify: `src/overlay/sections.ts` (a new pure `createHandover`; `createSections` uses it; export `CATCH_UP`)
- Test: `tests/unit/handover.test.ts` (create), `tests/e2e/sections.spec.ts` (append)

**Interfaces:**
- Consumes: `handoverAt`, `opacityFrom` (existing, in `sections.ts`); `damp` (`shared/math.ts`).
- Produces:
  - `export const CATCH_UP = 3.5`
  - `export const LEAVE_FAST = 12`
  - `export interface Shown { arrive: number; leave: number }`
  - `export function createHandover(anchors: readonly SectionAnchor[]): { step(local: number, reducedMotion: boolean, dtSeconds?: number): readonly Shown[] }`

- [ ] **Step 1: Write the failing unit tests**

`tests/unit/handover.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { SectionAnchor } from '../../src/journey/types';
import { CATCH_UP, createHandover, handoverAt, opacityFrom } from '../../src/overlay/sections';
import { damp } from '../../src/shared/math';

const anchors: readonly SectionAnchor[] = [
  { id: 'intro', from: 0 },
  { id: 'about', from: 0.25 },
  { id: 'projects', from: 0.5 },
  { id: 'contact', from: 0.75 },
];
const DT = 1 / 60;
const visibleCount = (shown: readonly { arrive: number; leave: number }[], above = 0.001) =>
  shown.filter((s) => opacityFrom(s.arrive, s.leave) > above).length;

/** Drive the handover along `path` (one local position per frame), then hold the last one for `holdFrames`. */
function drive(path: readonly number[], holdFrames: number, reducedMotion = false) {
  const handover = createHandover(anchors);
  const frames: { arrive: number; leave: number }[][] = [];
  const last = path[path.length - 1] as number;
  for (const local of [...path, ...Array(holdFrames).fill(last)]) {
    frames.push(handover.step(local, reducedMotion, frames.length === 0 ? 0 : DT).map((s) => ({ ...s })));
  }
  return frames;
}

const ramp = (from: number, to: number, frames: number) =>
  Array.from({ length: frames }, (_, i) => from + ((to - from) * (i + 1)) / frames);

describe('createHandover', () => {
  it('never shows two pages at once on a fast scroll down, and the destination arrives fully', () => {
    const frames = drive([0, ...ramp(0, 0.9, 5)], 180);
    for (const [i, frame] of frames.entries()) expect(visibleCount(frame), `frame ${i}`).toBeLessThanOrEqual(1);
    const end = frames[frames.length - 1] as { arrive: number; leave: number }[];
    expect(opacityFrom(end[3]?.arrive ?? 0, end[3]?.leave ?? 0)).toBe(1);
  });

  it('never shows two pages at once on a fast scroll up', () => {
    const frames = drive([0.9, ...ramp(0.9, 0, 5)], 180);
    for (const frame of frames) expect(visibleCount(frame)).toBeLessThanOrEqual(1);
    const end = frames[frames.length - 1] as { arrive: number; leave: number }[];
    expect(opacityFrom(end[0]?.arrive ?? 0, end[0]?.leave ?? 0)).toBe(1);
  });

  it('never shows the pages that were only flown past', () => {
    const frames = drive([0, ...ramp(0, 0.9, 5)], 180);
    const peak = (index: number) =>
      Math.max(...frames.map((frame) => opacityFrom(frame[index]?.arrive ?? 0, frame[index]?.leave ?? 0)));
    expect(peak(1)).toBeLessThan(0.001);
    expect(peak(2)).toBeLessThan(0.001);
  });

  // Review focus 3: the visitor changes their mind mid-flight.
  it('handles a fling that reverses before the exit has finished', () => {
    const frames = drive([0.36, ...ramp(0.36, 0.9, 3), ...ramp(0.9, 0.36, 3)], 180);
    for (const frame of frames) expect(visibleCount(frame)).toBeLessThanOrEqual(1);
    const end = frames[frames.length - 1] as { arrive: number; leave: number }[];
    expect(opacityFrom(end[1]?.arrive ?? 0, end[1]?.leave ?? 0)).toBe(1);
  });

  // Review focus 5: reduced motion is a hard switch, so exclusive by construction.
  it('under reduced motion follows the scroll exactly, one page at a time', () => {
    const frames = drive([0, ...ramp(0, 0.9, 5)], 10, true);
    for (const frame of frames) {
      expect(visibleCount(frame)).toBeLessThanOrEqual(1);
      for (const s of frame) expect(opacityFrom(s.arrive, s.leave) === 0 || opacityFrom(s.arrive, s.leave) === 1).toBe(true);
    }
  });

  it('matches the old eased handover on a slow scroll (within 0.01)', () => {
    // A minute from top to bottom: the old per-page easing, reimplemented here as the reference.
    const path = ramp(0, 1, 3600);
    const old = anchors.map(() => ({ arrive: 0, leave: 0 }));
    const settle = (v: number, t: number) => (Math.abs(t - v) < 0.008 ? t : v);
    const handover = createHandover(anchors);
    path.forEach((local, frame) => {
      const next = handover.step(local, false, frame === 0 ? 0 : DT);
      anchors.forEach((_, i) => {
        const target = handoverAt(local, anchors, i, false);
        const o = old[i] as { arrive: number; leave: number };
        o.arrive = frame === 0 ? target.arrive : settle(damp(o.arrive, target.arrive, CATCH_UP, DT), target.arrive);
        o.leave = frame === 0 ? target.leave : settle(damp(o.leave, target.leave, CATCH_UP, DT), target.leave);
        const was = opacityFrom(o.arrive, o.leave);
        const now = opacityFrom(next[i]?.arrive ?? 0, next[i]?.leave ?? 0);
        expect(Math.abs(now - was), `frame ${frame}, page ${i}`).toBeLessThan(0.01);
      });
    });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/handover.test.ts`
Expected: FAIL. `createHandover` and `CATCH_UP` are not exported.

- [ ] **Step 3: Implement in `src/overlay/sections.ts`**

1. Change `const CATCH_UP = 3.5;` to `export const CATCH_UP = 3.5;`. Leave its comment unchanged.
2. Below `settle`, add:

```ts
/**
 * How fast the shown page leaves when the scroll has already moved on to a different page: about 0.25 s. A fast
 * scroll used to leave every page it passed half faded at once, because each page eased toward its own target
 * (owner report, spec 2026-09-25 §4.12).
 */
export const LEAVE_FAST = 12;

/** Where a page is in its handover as shown on screen, which may trail the scroll. */
export interface Shown {
  arrive: number;
  leave: number;
}

/**
 * The handover as shown: at most one page is visible, ever. The page under the scroll eases toward its
 * scroll-derived target as before. When the scroll lands on a different page, the shown one leaves fast
 * (up and out when the new page is further on, sinking back when it is earlier) and only then does the new
 * page start to arrive. Pages that were only flown past never appear. Pure: no DOM, no clock.
 */
export function createHandover(anchors: readonly SectionAnchor[]) {
  const state: Shown[] = anchors.map(() => ({ arrive: 0, leave: 0 }));
  let shown = -1;
  let started = false;

  return {
    step(local: number, reducedMotion: boolean, dtSeconds = 0): readonly Shown[] {
      let wanted = -1;
      for (let i = 0; i < anchors.length; i++) {
        const target = handoverAt(local, anchors, i, reducedMotion);
        if (opacityFrom(target.arrive, target.leave) > 0) wanted = i;
      }

      const smooth = dtSeconds > 0 && !reducedMotion && started;
      started = true;
      if (!smooth) {
        for (let i = 0; i < anchors.length; i++) {
          const target = handoverAt(local, anchors, i, reducedMotion);
          const entry = state[i] as Shown;
          entry.arrive = target.arrive;
          entry.leave = target.leave;
        }
        shown = wanted;
        return state;
      }

      if (shown !== -1 && wanted !== -1 && wanted !== shown) {
        const leaving = state[shown] as Shown;
        if (wanted > shown) leaving.leave = settle(damp(leaving.leave, 1, LEAVE_FAST, dtSeconds), 1);
        else leaving.arrive = settle(damp(leaving.arrive, 0, LEAVE_FAST, dtSeconds), 0);
        if (opacityFrom(leaving.arrive, leaving.leave) <= SETTLED) {
          leaving.arrive = 0;
          leaving.leave = 0;
          shown = wanted;
        }
      }
      if (shown === -1) shown = wanted;

      for (let i = 0; i < anchors.length; i++) {
        if (i === shown) continue;
        const hidden = state[i] as Shown;
        hidden.arrive = 0;
        hidden.leave = 0;
      }
      if (shown !== -1 && (wanted === shown || wanted === -1)) {
        const target = handoverAt(local, anchors, shown, reducedMotion);
        const entry = state[shown] as Shown;
        entry.arrive = settle(damp(entry.arrive, target.arrive, CATCH_UP, dtSeconds), target.arrive);
        entry.leave = settle(damp(entry.leave, target.leave, CATCH_UP, dtSeconds), target.leave);
      }
      return state;
    },
  };
}
```

3. In `createSections`:
   - Remove `arrive`, `leave` and `started` from the `Tracked` interface and from the objects pushed into
     `tracked`.
   - Create `const handover = createHandover(anchors);` after the loop that fills `tracked`.
   - Replace the body of `show` with:

```ts
    show(local, reducedMotion, dtSeconds = 0) {
      const shown = handover.step(local, reducedMotion, dtSeconds);
      for (let i = 0; i < tracked.length; i++) {
        const entry = tracked[i] as Tracked;
        const anchor = anchors[i] as SectionAnchor;
        const next = anchors[i + 1];
        const active =
          local + ANCHOR_EPSILON >= anchor.from && (next === undefined || local + ANCHOR_EPSILON < next.from);
        const { arrive, leave } = shown[i] as Shown;
        write(entry, opacityFrom(arrive, leave), reducedMotion ? 0 : offsetFrom(arrive, leave, i), active);
        motions.get(anchor.id)?.set(arrive, leave);
      }
    },
```

- [ ] **Step 4: Run the unit tests**

Run: `npm test`
Expected: PASS, including the six new handover tests. The existing `sections.test.ts` is unchanged and green.

- [ ] **Step 5: Write the failing e2e test**

Append to `tests/e2e/sections.spec.ts`:

```ts
// Owner report (spec 2026-09-25 §4.12): scroll fast and "Projects", "Moonlit", the About text and "Hola Amigo"
// all showed at once. Measured before the fix: all four at 0.06–0.35 opacity, for about a second.
test('a fast scroll never shows two pages at once, going down or up', async ({ page }) => {
  await page.goto('/?stills&hold=0');
  await expect
    .poll(() => page.locator('#content').evaluate((el) => getComputedStyle(el).opacity), { timeout: 15_000 })
    .toBe('1');
  await page.mouse.move(640, 360);
  for (const direction of [1, -1]) {
    await page.evaluate(() => {
      const w = window as unknown as { __worst: number; __sampling?: boolean };
      w.__worst = 0;
      if (w.__sampling) return;
      w.__sampling = true;
      const sample = () => {
        const visible = [...document.querySelectorAll('.section')].filter(
          (s) => Number(getComputedStyle(s).opacity) > 0.05,
        ).length;
        w.__worst = Math.max(w.__worst, visible);
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    for (let i = 0; i < 14; i++) {
      await page.mouse.wheel(0, direction * 400);
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(2500);
    const worst = await page.evaluate(() => (window as unknown as { __worst: number }).__worst);
    expect(worst, direction > 0 ? 'down' : 'up').toBeLessThanOrEqual(1);
  }
});
```

- [ ] **Step 6: Prove the e2e test bites, then passes**

Run: `git stash push src/overlay/sections.ts`, stop anything on :4173, then
`npx playwright test tests/e2e/sections.spec.ts -g "fast scroll" --project=chromium`
Expected: FAIL, with worst 3 or 4.

Run: `git stash pop`, then the same command.
Expected: PASS.

Then run the whole sections spec on all three browsers: `npx playwright test tests/e2e/sections.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npm run check
git add src/overlay/sections.ts tests/unit/handover.test.ts tests/e2e/sections.spec.ts
git commit -m "fix: show one page at a time however fast the scroll, so pages never stack"
```

---

### Task 5: Heading masks — room for descenders and the halo

**Files:**
- Modify: `src/overlay/sectionMotion.ts` (line class, rise distance)
- Modify: `src/overlay/nameMotion.ts` (rise distance)
- Modify: `src/styles/overlay.css` (append the mask rule)
- Test: `tests/e2e/redesign.spec.ts` (append)

**Interfaces:**
- Consumes: SplitText's mask naming. A mask copies its line's or char's class and adds `-mask`
  (`node_modules/gsap/SplitText.js:277`), and SplitText sets `overflow: clip` inline (`:278`).
- Produces: the CSS classes `split-line`, `split-line-mask` and `section__char-mask`. Plan 2 reuses them.

- [ ] **Step 1: Write the failing e2e test**

Append to `tests/e2e/redesign.spec.ts` (keep its existing imports; add `type Page` to the `@playwright/test`
import if it is not already there):

```ts
// Owner report (spec 2026-09-25 §4.13): a faint box around the big headings, and the "g" of "Amigo" cut off. The
// masks clipped the 20 px halo and the descenders. A heading drawn with its masks must look exactly like the
// same heading with no clipping at all.
for (const [id, progress] of [
  ['intro-title', 0],
  ['projects-title', 0.65],
  ['contact-title', 0.92],
] as const) {
  test(`#${id} is not clipped by its masks`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/?stills&p=${progress}`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.section.is-active')).toHaveCount(1);
    // The name rises letter by letter 2 s after entering and takes about 1.6 s; every line must be at rest.
    await page.waitForTimeout(4500);
    const box = await page.locator(`#${id}`).boundingBox();
    if (box === null) throw new Error(`#${id} has no box`);
    const clip = { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 40), width: box.width + 80, height: box.height + 80 };
    const masked = await page.screenshot({ clip, animations: 'disabled' });
    await page.addStyleTag({
      content: '.split-line-mask, .section__char-mask, [style*="overflow: clip"] { clip-path: none !important; overflow: visible !important }',
    });
    const unclipped = await page.screenshot({ clip, animations: 'disabled' });
    expect(masked.equals(unclipped)).toBe(true);
  });
}
```

- [ ] **Step 2: Run it to verify it fails**

Stop anything on :4173, then run: `npx playwright test tests/e2e/redesign.spec.ts -g "not clipped" --project=chromium`
Expected: FAIL on `projects-title` and `contact-title` (the descenders and the halo). `intro-title` may fail on
the halo.

- [ ] **Step 3: Implement**

In `src/overlay/sectionMotion.ts`:

Add, next to `KICKER_CHARS`:

```ts
/**
 * How far a line travels to rise in and to lift out, as a share of its own height. Its mask now reaches past the
 * line by max(0.2em, 20px) for the halo (overlay.css), so a line has to start 180% below to be fully hidden,
 * even for body text, the worst case: 20 px of margin on a 26 px line.
 */
const TRAVEL_PERCENT = 180;
```

In `build()`:
- replace `{ yPercent: 115 }` with `{ yPercent: TRAVEL_PERCENT }`;
- replace `{ yPercent: -115, duration: 0.45, …` with `{ yPercent: -TRAVEL_PERCENT, duration: 0.45, …`, keeping
  the rest of that object.

In `SplitText.create(element, {`, add `linesClass: 'split-line',` after `mask: 'lines',`.

In `src/overlay/nameMotion.ts`, replace `{ yPercent: 115, rotate: 6 }` with `{ yPercent: 160, rotate: 6 }`, and
add above `gsap.fromTo`:

```ts
      // 160%: the letter masks reach past each letter for its halo (overlay.css), so a letter must start
      // lower to stay hidden, as low as a 48 px phone name needs.
```

Append to `src/styles/overlay.css`, before the reduced-motion block:

```css
/* SplitText's masks (…-mask) clipped at the line's own box, which cut the descenders ("Amigo", "Projects") and the
   headings' 20 px halo into a visible rectangle (owner report, spec 2026-09-25 §4.13). The clip now reaches past
   the box on every side; clip-path changes nothing about layout, so the lines stay exactly where they were. */
.split-line-mask,
.section__char-mask {
  overflow: visible !important;
  clip-path: inset(calc(-1 * max(0.2em, 20px)) calc(-1 * max(0.3em, 20px)));
}
```

- [ ] **Step 4: Run the test and the suite**

Run: `npx playwright test tests/e2e/redesign.spec.ts --project=chromium`
Expected: PASS for all three headings.

Then, on all browsers: `npx playwright test tests/e2e/redesign.spec.ts tests/e2e/sections.spec.ts tests/e2e/a11y.spec.ts`
Expected: PASS. The contrast tests must not regress.

If Firefox or WebKit fails only the "not clipped" test, that browser is ignoring the negative `inset()` values.
Stop and report it with the screenshots; do not switch to `overflow: visible`, which would show the lines below
their masks while they rise.

- [ ] **Step 5: Look at it**

Run `npm run build`, then `npm run preview`. In the MCP browser at 1280×720, scroll slowly through all four pages.
The lines must still rise in from nothing and lift out to nothing, with no ascender peeking above a mask before its
line moves. Screenshot "Hola Amigo" at `?p=0.92` and check the "g" is whole. Stop the preview.

- [ ] **Step 6: Commit**

```bash
npm run check
git add src/overlay/sectionMotion.ts src/overlay/nameMotion.ts src/styles/overlay.css tests/e2e/redesign.spec.ts
git commit -m "fix: let heading masks clear the descenders and the halo, so no box shows around the big type"
```

---

### Task 6: One composition in a window and full screen

**Files:**
- Create: `src/overlay/frame.ts`
- Modify: `src/app/boot.ts` (call `applyFrameFit` near the top of `boot()`, unless `params.frame === 'old'`)
- Modify: `src/styles/overlay.css` (panel transform)
- Modify: `docs/superpowers/specs/2026-09-25-waxing-voyage-design.md` §4.14 (the method changed; see below)
- Test: `tests/unit/frame.test.ts` (create), `tests/e2e/frame.spec.ts` (create)

**Interfaces:**
- Consumes: `params.frame` (Task 3).
- Produces:
  - `FRAME_ASPECT = 16 / 9`
  - `frameFit(width: number, height: number): { scale: number; x: number }`
  - `applyFrameFit(root: HTMLElement, stage: HTMLElement): void`
  - the CSS custom properties `--frame-scale` and `--frame-x` on `<html>`.

**Why the method differs from the spec's first draft.** Scaling the font sizes by the frame keeps the headings in
step with the scene. But the rem spacing and the small mono labels do not scale, so a 590 px window still drifts by
about 3% of the height. Drawing each panel at its 16:9 layout, then scaling and shifting it into the frame, keeps
the composition exact. Step 6 updates §4.14 to say so.

- [ ] **Step 1: Write the failing unit tests**

`tests/unit/frame.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { frameFit } from '../../src/overlay/frame';

describe('frameFit', () => {
  it('leaves 16:9 and anything narrower alone: phones, tablets, 4:3', () => {
    expect(frameFit(1280, 720)).toEqual({ scale: 1, x: 0 });
    expect(frameFit(390, 844)).toEqual({ scale: 1, x: 0 });
    expect(frameFit(1024, 768)).toEqual({ scale: 1, x: 0 });
  });

  it('scales and centres the frame on screens wider than 16:9, like a windowed laptop', () => {
    const { scale, x } = frameFit(1280, 590);
    expect(scale).toBeCloseTo((590 * 16) / 9 / 1280, 10);
    expect(x).toBeCloseTo((1280 - (590 * 16) / 9) / 2, 10);
  });

  // Review focus 4: the edges of the rule.
  it('is continuous at exactly 16:9 and handles an ultra-wide screen', () => {
    expect(frameFit(1600, 900).scale).toBe(1);
    expect(frameFit(1600, 899.99).scale).toBeLessThan(1);
    expect(frameFit(3440, 1440).scale).toBeCloseTo((1440 * 16) / 9 / 3440, 10);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/frame.test.ts`
Expected: FAIL. The module does not exist.

- [ ] **Step 3: Implement `src/overlay/frame.ts`**

```ts
/**
 * The frame the camera composes for. On anything wider, the scene keeps its vertical field of view
 * (cameraPath.ts fovForAspect), so it is framed by height: a laptop in a window (1280 × 590) shows the same
 * picture as full screen (1280 × 720), only smaller, with more of the sea at the sides.
 */
export const FRAME_ASPECT = 16 / 9;

/**
 * How to draw the text so it keeps its place in that picture: each page is laid out as at 16:9, then scaled by
 * `scale` and shifted right by `x` px into the frame. Screens at 16:9 or narrower get 1 and 0. Pure.
 */
export function frameFit(width: number, height: number): { scale: number; x: number } {
  const frameWidth = Math.min(width, height * FRAME_ASPECT);
  return { scale: frameWidth / width, x: (width - frameWidth) / 2 };
}

/**
 * Writes the fit to `--frame-scale` and `--frame-x` on `root`, from the stage (the scene's own box, 100lvh
 * tall), now and on every resize (owner report, spec 2026-09-25 §4.14).
 */
export function applyFrameFit(root: HTMLElement, stage: HTMLElement): void {
  const update = () => {
    const { scale, x } = frameFit(stage.clientWidth, stage.clientHeight);
    root.style.setProperty('--frame-scale', String(scale));
    root.style.setProperty('--frame-x', `${x}px`);
  };
  update();
  window.addEventListener('resize', update, { passive: true });
}
```

- [ ] **Step 4: Wire boot and CSS**

In `src/app/boot.ts`, add the import `import { applyFrameFit } from '../overlay/frame';`. Right after
`byId('journey-track').style.setProperty(…)`, add:

```ts
  // Text keeps its place in the scene whether the window is full screen or not (spec 2026-09-25 §4.14).
  // `?frame=old` shows the previous behaviour for the owner to compare.
  if (params.frame !== 'old') applyFrameFit(root, byId('world'));
```

In `src/styles/overlay.css`, after the `.section__panel { max-width: 40rem; }` rule, add:

```css
/* On screens wider than 16:9 the scene is framed by height, so the text is too: each page keeps its 16:9 layout,
   scaled and moved into the frame (overlay/frame.ts writes the two values; both default to no change). Top pages
   scale from their top edge and bottom pages from their bottom edge, so each stays at its height in the picture. */
.section__panel {
  transform-origin: bottom left;
  translate: var(--frame-x, 0px) 0;
  scale: var(--frame-scale, 1);
}
```

Inside the existing `@media (min-width: 700px)` block that sets `#intro, #projects { top: 16svh; … }`, add:

```css
  #intro .section__panel,
  #projects .section__panel {
    transform-origin: top left;
  }
```

- [ ] **Step 5: Write the e2e test**

`tests/e2e/frame.spec.ts`:

```ts
import { expect, type Page, test } from '@playwright/test';

// Owner report (spec 2026-09-25 §4.14): a normal window and full screen (Fn+F11) placed the text differently.
// Measured before: the Projects block reached 75% of the height in a 1280 × 590 window, 64% at 1280 × 720.
async function place(page: Page, height: number, progress: number) {
  await page.setViewportSize({ width: 1280, height });
  await page.goto(`/?stills&p=${progress}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.section.is-active')).toHaveCount(1);
  await page.waitForTimeout(1200);
  return page.evaluate(() => {
    const panel = document.querySelector('.section.is-active .section__panel');
    if (panel === null) throw new Error('no active panel');
    const r = panel.getBoundingClientRect();
    const W = window.innerWidth;
    const H = window.innerHeight;
    const frameW = Math.min(W, (H * 16) / 9);
    const x0 = (W - frameW) / 2;
    return { top: r.top / H, bottom: r.bottom / H, left: (r.left - x0) / frameW, right: (r.right - x0) / frameW };
  });
}

for (const [page_, progress] of [
  ['intro', 0],
  ['about', 0.36],
  ['projects', 0.65],
  ['contact', 0.92],
] as const) {
  test(`${page_} keeps its place in the picture in a window and full screen`, async ({ page }) => {
    const full = await place(page, 720, progress);
    const windowed = await place(page, 590, progress);
    for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
      expect(Math.abs(windowed[edge] - full[edge]), edge).toBeLessThan(0.01);
    }
  });
}
```

- [ ] **Step 6: Run the tests**

Run: `npm test`, then stop anything on :4173 and run `npx playwright test tests/e2e/frame.spec.ts`
Expected: PASS in all three browsers. If `left` is off by up to 0.01, that is the unscaled 1.25rem gutter;
anything larger is a bug.

Then run the full e2e suite (`npm run e2e`). Expected: PASS. The contrast tests use a 390 × 844 phone, where the
scale is 1.

Update spec §4.14. Replace the paragraph that begins "**Fix:** size and place the text by the same frame" and its
CSS block with:

```markdown
**Fix:** draw each page as at 16:9, then scale and shift it into the frame. `overlay/frame.ts` computes
`frameFit(stageWidth, stageHeight)` → `{ scale, x }` (1 and 0 at 16:9 or narrower) and writes `--frame-scale`
and `--frame-x`. `.section__panel` gets `scale` and `translate` from them: top pages scale from the top edge,
bottom pages from the bottom. Scaling the font sizes alone was tried on paper and rejected: the rem spacing and the
small labels do not scale, which leaves about 3% of drift in a 590 px window.
```

Also change the `?frame=old` row's description in §7 to "no frame fit".

- [ ] **Step 7: Commit**

```bash
npm run check
git add src/overlay/frame.ts src/app/boot.ts src/styles/overlay.css tests/unit/frame.test.ts tests/e2e/frame.spec.ts docs/superpowers/specs/2026-09-25-waxing-voyage-design.md
git commit -m "fix: fit the text into the scene's 16:9 frame so a window and full screen look the same"
```

---

### Task 7: The sea — start at a bounding plane, a longer step, glints that fade near the camera

**Files:**
- Create: `src/regions/moonsink/surfaceTop.ts`
- Modify: `src/regions/moonsink/sea.ts` (options, uniform, `march`, glints)
- Modify: `src/regions/moonsink/index.ts` (pass options, set `surfaceTop` every frame)
- Modify: `src/app/boot.ts` (pass the switches to `createMoonsink`)
- Test: `tests/unit/surfaceTop.test.ts` (create)

**Interfaces:**
- Consumes: `params.march` and `params.glints` (Task 3).
- Produces:
  - `WAVE_TOP: number`, `sandTopAt(z: number): number`, `surfaceTopAt(cameraZ: number): number`
  - `interface SeaOptions { march?: 'bounded' | 'old'; glints?: 'fade' | 'old' }`
  - `createSea(options?: SeaOptions)`, with a new `uniforms.surfaceTop`
  - `createMoonsink(ctx, moonOverride?, seaOptions?: SeaOptions)`

- [ ] **Step 1: Write the failing tests**

`tests/unit/surfaceTop.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sandTopAt, surfaceTopAt, WAVE_TOP } from '../../src/regions/moonsink/surfaceTop';

// These mirror sea.ts's waterH and sandH (six wave layers; sand slope, ridge and grain). If either shader function
// changes, change these too: the bound is what lets a ray skip the empty air above the sea.
function waterH(x: number, z: number, time: number): number {
  let h = 0;
  let amp = 0.16;
  let freq = 0.32;
  let speed = 0.85;
  let qx = x;
  let qz = z;
  for (let i = 0; i < 6; i++) {
    const ang = Math.sin(i * 1.73) * 0.9;
    const dx = Math.sin(ang);
    const dz = Math.cos(ang);
    const phase = (qx * dx + qz * dz) * freq + time * speed;
    const w = Math.exp(Math.sin(phase) - 1);
    h += amp * w;
    qx -= dx * w * Math.cos(phase) * amp * 0.55;
    qz -= dz * w * Math.cos(phase) * amp * 0.55;
    amp *= 0.74;
    freq *= 1.3;
    speed *= 1.06;
  }
  h += Math.sin(time * 0.55 - z * 0.35) * 0.1;
  return h - 0.16;
}

/** sandH with its grain at the worst case (noise = 1). */
function sandHMax(x: number, z: number): number {
  const ridge = Math.sin(x * 0.23 + Math.sin(z * 0.4)) * 0.12 * Math.min(1, Math.max(0, -z / 6) ** 2 * (3 - 2 * Math.min(1, Math.max(0, -z / 6))));
  return Math.min(-0.07 * z - 0.12 + ridge + 0.025, 2.2);
}

describe('surfaceTop', () => {
  it('bounds the water from above everywhere', () => {
    let highest = -Infinity;
    for (let x = -40; x <= 40; x += 0.37) {
      for (let z = -20; z <= 60; z += 0.41) {
        for (const time of [0, 3.3, 12, 47.9]) highest = Math.max(highest, waterH(x, z, time));
      }
    }
    expect(highest).toBeLessThanOrEqual(WAVE_TOP);
  });

  it('bounds the sand from above at the camera and everywhere ahead of it', () => {
    for (let x = -20; x <= 20; x += 0.5) {
      for (let z = -20; z <= 40; z += 0.25) expect(sandHMax(x, z)).toBeLessThanOrEqual(sandTopAt(z) + 1e-12);
    }
    // Ahead of the camera (+z) the sand only falls away, so the camera's own z bounds the whole view.
    for (let z = -20; z < 40; z += 0.25) expect(sandTopAt(z + 0.25)).toBeLessThan(sandTopAt(z));
  });

  it('sits above both, with a margin, wherever the camera is', () => {
    for (const cameraZ of [34, 26, 9, 0, -5.5, -12, -12.5]) {
      expect(surfaceTopAt(cameraZ)).toBeGreaterThan(Math.max(WAVE_TOP, sandTopAt(cameraZ)));
    }
    expect(surfaceTopAt(34)).toBeCloseTo(WAVE_TOP + 0.05, 10);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/surfaceTop.test.ts`
Expected: FAIL. The module does not exist.

- [ ] **Step 3: Implement `src/regions/moonsink/surfaceTop.ts`**

```ts
/**
 * The highest the water can reach: six wave layers whose amplitude starts at 0.16 and falls 0.74× each
 * (each layer's shape exp(sin − 1) peaks at 1), plus the 0.1 swell, less the 0.16 offset (sea.ts waterH). ≈ 0.454.
 */
export const WAVE_TOP = (0.16 * (1 - 0.74 ** 6)) / (1 - 0.74) + 0.1 - 0.16;

/** The highest the sand can reach at sea-space z (sea.ts sandH): its slope and offset, with the ±0.12 ridge and the
 *  ±0.025 grain at their peaks. */
export const sandTopAt = (z: number): number => -0.07 * z - 0.12 + 0.12 + 0.025;

const MARGIN = 0.05;

/**
 * The highest surface any ray from this camera can meet. The view never turns (yaw 0, S27), so every ray heads
 * toward +z, where the sand only falls away: nothing ahead is higher than the sand at the camera's own z, or the
 * highest wave. Rays start where they cross this height instead of creeping down from the camera, which was
 * nearly all of the sea's cost (spec 2026-09-25 §4.2).
 */
export function surfaceTopAt(cameraZ: number): number {
  return Math.max(WAVE_TOP, sandTopAt(cameraZ)) + MARGIN;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/surfaceTop.test.ts`
Expected: PASS.

- [ ] **Step 5: Change `src/regions/moonsink/sea.ts`**

1. Above `export function createSea()`, add:

```ts
/** Owner-review switches (spec 2026-09-25 §7). The defaults are the new behaviour. */
export interface SeaOptions {
  /** 'bounded' starts each ray at `surfaceTop` and steps 0.7 of the height gap; 'old' is the march before. */
  march?: 'bounded' | 'old';
  /** 'fade' keeps glints away from the camera; 'old' makes them strongest right at it. */
  glints?: 'fade' | 'old';
}
```

and change the signature to `export function createSea(options: SeaOptions = {}) {`. At the start of the body,
add:

```ts
  const bounded = options.march !== 'old';
  // The share of the height gap a step may cover. 0.7 still never jumps through a crest at this wave height;
  // the bisection after the loop refines the hit either way.
  const stepShare = bounded ? 0.7 : 0.5;
```

2. In `uniforms`, add after `marchSteps`:

```ts
    // The highest surface a ray from the camera can meet, set every frame from the camera (surfaceTop.ts).
    surfaceTop: uniform(2.4),
```

3. Replace the `march` function's opening, from `const march = Fn(([ro, rd, steps, time]: [V3, V3, I, F]) => {`
   through the `Loop({ … }, () => {` line, with:

```ts
  const march = Fn(([ro, rd, steps, time, top]: [V3, V3, I, F, F]) => {
    const t = float(0.05).toVar();
    const tPrev = float(0.05).toVar();
    const hit = float(-1).toVar();
    const overshot = float(0).toVar();
    // 1 when the ray starts above every surface and heads up: sky, with no steps at all.
    const skyOnly = float(0).toVar();
    if (bounded) {
      If(ro.y.greaterThan(top), () => {
        If(rd.y.greaterThanEqual(0), () => {
          skyOnly.assign(1);
        }).Else(() => {
          t.assign(max(t, ro.y.sub(top).div(rd.y.negate())));
          tPrev.assign(t);
        });
      });
    }
    Loop({ start: int(0), end: select(skyOnly.greaterThan(0.5), int(0), steps), type: 'int', condition: '<' }, () => {
```

4. In the loop body, change `t.addAssign(max(d.mul(0.5), t.mul(0.006).add(0.012)));` to:

```ts
      t.addAssign(max(d.mul(stepShare), t.mul(0.006).add(0.012)));
```

5. Change the out-of-steps fallback condition
   `If(hit.lessThan(0).and(overshot.lessThan(0.5)).and(rd.y.lessThan(0)), () => {` to:

```ts
    If(hit.lessThan(0).and(overshot.lessThan(0.5)).and(rd.y.lessThan(0)).and(skyOnly.lessThan(0.5)), () => {
```

6. In `march`'s `setLayout` inputs, add `{ name: 'top', type: 'float' },` after the `time` input.

7. Change the call to:

```ts
  const tHit = march(ro, rd, uniforms.marchSteps, time, uniforms.surfaceTop).toVar('seaT');
```

8. Replace the glint's distance factor. Change `.mul(fall(2.0, 25.0, tHit))` to:

```ts
        // Glints rise away from the camera and fade into the distance. Strongest at the camera, as before, they
        // drew large square specks behind the phone's text once the camera stood on the sand (spec §4.2).
        .mul(options.glints === 'old' ? fall(2.0, 25.0, tHit) : smoothstep(1.5, 5.0, tHit).mul(fall(5.0, 25.0, tHit)))
```

- [ ] **Step 6: Set the uniform every frame, and pass the switches**

In `src/regions/moonsink/index.ts`:
- Import `import { surfaceTopAt } from './surfaceTop';` and `type SeaOptions` from `'./sea'`.
- Change the signature to
  `export function createMoonsink(ctx: RegionContext, moonOverride?: number, seaOptions: SeaOptions = {}): MoonsinkRegion {`
  and `const sea = createSea(seaOptions);`.
- In `update`, after `applyPose(current);`, add:

```ts
      // Sea space mirrors x only (sea.ts toSea), so the camera's z is the sea's z.
      sea.uniforms.surfaceTop.value = surfaceTopAt(camera.position.z);
```

- In `applyPose`, nothing changes.

In `src/app/boot.ts`, change `const region = createMoonsink(ctx, params.moon);` to:

```ts
  const region = createMoonsink(ctx, params.moon, {
    march: params.march === 'old' ? 'old' : 'bounded',
    glints: params.glints === 'old' ? 'old' : 'fade',
  });
```

- [ ] **Step 7: Build and verify that nothing goes flat or wrong**

Run: `npm run check; npm test; npm run build`, then `npm run preview`.

In the MCP browser (headed, real GPU), at 1280 × 720, for each of `p` = 0, 0.36, 0.65 and 0.92, screenshot these
two URLs:
- `/?tier=3&p=<p>&moon=0.5&time=12`
- `/?tier=3&p=<p>&moon=0.5&time=12&march=old`

View each pair. The composition, the horizon and the moon must match. Only the glitter pattern may differ. The sea
must show wave structure, never go flat (S21), and show no holes or sky below the horizon. Save the pairs under
`V:/Pdf/Project/.playwright-mcp/` for the owner review.

- [ ] **Step 8: Measure the speed-up**

With the same preview, for tiers 2, 3 and 4 at `p=0.36`, count rendered frames over 2.5 s with and without
`&march=old`. Use `window.__moonlit.frames()` before and after a 2.5 s wait, and add `&pace=full` so the pacer
never caps the count below 60. Put the six numbers in the commit message body. These numbers become the case
study's metric in Plan 2. Stop the preview.

- [ ] **Step 9: Commit**

```bash
git add src/regions/moonsink/surfaceTop.ts src/regions/moonsink/sea.ts src/regions/moonsink/index.ts src/app/boot.ts tests/unit/surfaceTop.test.ts
git commit -m "perf: start each ray at the highest surface it can meet, and keep glints off the camera" -m "Measured on the Intel UHD laptop, 1280x720 at DPR 1.5, p=0.36, frames per second old -> new: tier 2 A -> B, tier 3 C -> D, tier 4 E -> F."
```

Replace A–F with the numbers from Step 8 before running the commit. No letter may be left in the message.

```bash
```

---

### Task 8: The owner feels it on the phone, and the record is written

**Files:**
- Modify: `docs/superpowers/specs/2026-09-13-moonlit-portfolio-design.md` (§17: add S38, S39, S44, S45, S46)
- Modify: `docs/HANDOVER.md` (§3 hooks table, §7 traps, §10 state)
- Possibly modify: the files of any switch whose old side the owner picks

**Interfaces:**
- Consumes: everything above.
- Produces: the owner's picks, recorded. The switches stay in place until Plan 2's last task removes the losing
  sides.

- [ ] **Step 1: Serve the build to the owner's phone**

```bash
npm run build
npm run preview -- --host
```

Read the LAN address that Vite prints (`http://192.168.x.x:4173`). Send the owner these links, each one with a
single plain sentence on what to feel:
- `/?hud`: the HUD's `display` line, at the phone's 60 Hz and then at 120 Hz.
- `/`, then `/?march=old`: the glitter on the water.
- `/?p=0.65&glints=old`, then `/?p=0.65`: on this plan's camera the glints hardly change. The real test comes when
  Plan 2 puts the camera on the sand, so say so.
- On the laptop, `/`, then `/?frame=old`: a normal window against full screen.
- Anywhere: fling the scroll up and down fast. It is one page at a time now.

- [ ] **Step 2: Record the picks**

For each switch the owner picks the old side of, stop and ask how they would like it. Build that option behind a
switch, as S34 requires; do not guess. For each new side they keep, note it.

- [ ] **Step 3: Write the change log and the handover**

Append to the §17 table in `docs/superpowers/specs/2026-09-13-moonlit-portfolio-design.md` the S38, S39, S44, S45
and S46 rows exactly as written in the waxing-voyage spec §10. Add the measured numbers to S39, and the owner's
picks to each row.

In `docs/HANDOVER.md`:
- §3 hooks table: add `?pace=full`, `?march=old`, `?glints=old` and `?frame=old`, each marked "owner-review switch,
  removed at the end of plan 2".
- §7 traps: add "Headless test browsers render in software, but this laptop has an Intel UHD (Gen12) GPU, and the
  headed MCP browser gets WebGPU on it: use it for performance numbers, counting frames per animation frame
  (burst timing with `onSubmittedWorkDone` gave bogus numbers)."
- §10 state: the branch, what plan 1 changed, and that plan 2 is next.

- [ ] **Step 4: Full verification**

Stop anything on :4173. Run: `npm run check; npm test; npm run build; npm run size; npm run e2e`
Expected: all green. Report the counts: unit tests, e2e passed and skipped, and the kB.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-13-moonlit-portfolio-design.md docs/HANDOVER.md
git commit -m "docs: record even frame pacing, the exclusive handover, the halo fix, the frame fit and the faster sea"
```

Do not push. Tell the owner that plan 1 is done and that plan 2, the waxing voyage, is next.
