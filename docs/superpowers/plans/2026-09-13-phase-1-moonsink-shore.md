# Phase 1 · Moonsink Shore (vertical slice): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Partly superseded (2026-09-14).** This plan was executed in full. The owner then reviewed the
> result on desktop and phone and rejected the composition as cluttered. Plan
> `2026-09-14-phase-1r-composition-and-moon.md` revises it before merge:
> - Task 8 (the broken ring and shards) is removed.
> - Task 10's text card and Task 11's title-screen layout are replaced by the type-led look (spec §3.4).
> - The section fade in Task 10 is replaced by scroll-driven opacity (§5.4a).
> - `waveDetail` stops being a tier knob, and the tiers are retuned (§5.4, §5.6, §17 S17 and S21).
> - The camera keyframes are re-aimed (§17 S22).
>
> The history below is kept as it was written.

**Goal:** The first real region. A title screen over demo 1's moonlit sea (ported to TSL), the broken resonance ring, a scroll-driven camera path through Moonsink Shore, and the Intro and About text. Quality adapts to the device, reduced motion is respected, and it's steady at 60 fps on a budget Android phone.

**Architecture:**
- **One animation loop:** scroll progress `p`, then `resolve(p)` gives the journey state, the Moonsink region updates, the Three.js `RenderPipeline` draws (scene pass, plus bloom on higher tiers), and the HTML overlay updates.
- **The sea:** a full-screen `MeshBasicNodeMaterial` whose TSL colour and depth nodes ray-march the height field, so 3D meshes (ring, shards) sink into the water correctly.
- **Pure logic lives in small tested modules:** timeline, tiers, governor, camera path, params. Browser glue stays thin.

**Tech Stack:** three 0.186.0 (`three/webgpu`, `three/tsl`, `three/addons/tsl/display/BloomNode.js`) · lenis 1.3.26 · lil-gui 0.21.0 (dev only) · @axe-core/playwright 4.13.0 · everything from Phase 0.

**Spec:** `docs/superpowers/specs/2026-09-13-moonlit-portfolio-design.md` (§3 experience, §5 LLD, §5.6 tiers, §7 performance, §8 responsive, §10 accessibility, §17 spike changes)

**Prerequisite:** Phase 0 complete (site live, CI green).

## Global Constraints

- Exact versions: three 0.186.0, @types/three 0.186.0, @types/node 24.13.4, lenis 1.3.26, lil-gui 0.21.0, @axe-core/playwright 4.13.0.
- **Everything TypeScript is type-checked:** `src` + unit tests via `tsconfig.json`, and config files + browser tests via `tsconfig.node.json`. Both run inside `npm run build`.
- Import Three.js **only** from `three/webgpu` and `three/tsl` (plus the BloomNode addon). Never from `three`.
- **TSL rule:** any shader function with `.setLayout()` must be **pure**. It never reads a `uniform` directly; uniforms are passed in as parameters. Reading one inside a layout function breaks WGSL (`struct member nodeUniform0 not found`, found in the spike).
- **Reversed `smoothstep` edges are forbidden** in TSL (undefined in WGSL). Use `smoothstep(a, b, x).oneMinus()`.
- Tiers **never** change composition, camera path, content, timing or palette (spec §5.6).
- Build and verify on the **low tier first** (`?tier=0`, `?tier=1`) before looking at high tiers.
- **No console errors** in normal operation. Use `console.warn` for handled fallbacks.
- **Accessibility:**
  - canvas `aria-hidden`
  - real HTML text
  - visible focus
  - Skip intro first in tab order
  - no flashing
  - the system cursor is never hidden
- **IP:** no Wuthering Waves assets or terms; never the word "Tacet".
- **Git:**
  - Work on branch `phase-1-moonsink`.
  - Commit messages contain only a subject (and optional body): **no `Co-Authored-By:` or any other attribution trailer** (owner instruction, 2026-09-13).
- **Shell:** commands are written for PowerShell (one per line).
- **Working model:** every task ends with a **Walkthrough** and a **Check** for the owner (spec §13).

## Where this plan intentionally differs from the spec (recorded in spec §17)
1. **Post-processing:** `THREE.RenderPipeline`, since `PostProcessing` was renamed in r183.
2. **Region interface:**
   - no async `load()`; `boot` pre-compiles with `renderer.compileAsync`
   - `applyTier(settings)` replaces `setQuality(tier)`
3. **Journey segments:** region segments carry their own `sections` anchors.
4. **Bloom:** simply off (tiers 0–1) or on (tiers 2–4). No half-resolution variant in Phase 1.
5. **Motes:** drawn inside the sea shader, as in the prototype, not as a particle count per tier.
6. **JS budget:** the spike measured **254.3 KB gzip**. Task 1 asks the owner to approve **270 KB**.
7. **Reduced motion and Lenis:** Lenis already honours the OS reduced-motion setting for wheel smoothing. The in-page toggle controls scene motion and text animation.
8. **Visual screenshot baselines:** moved to Phase 3, because software-GPU images differ per OS. Phase 1 relies on zero console errors, a frame count, axe checks, and a manual visual comparison.

## File map (Phase 1)

| File | Responsibility | Tested by |
|---|---|---|
| `src/shared/math.ts` (modify) | + `damp` frame-rate-independent smoothing | unit |
| `src/shared/random.ts` | `mulberry32` seeded random | unit |
| `src/shared/dispose.ts` | free GPU memory for an object tree | tsc |
| `src/journey/types.ts` | journey types | tsc |
| `src/journey/journey.config.ts` | Phase 1 journey: Moonsink only | unit |
| `src/journey/timeline.ts` | `totalLength`, `resolve`, `progressForSection` | unit |
| `src/quality/tiers.ts` | tier table, `bootTier`, `clampTier` | unit |
| `src/quality/governor.ts` | `percentile`, `Governor` | unit |
| `src/app/params.ts` | `?tier ?p ?time ?hud ?gui ?webgl ?stills` | unit |
| `src/app/frameRate.ts` | 60 fps cap + idle 30 fps decisions | unit |
| `src/app/capabilities.ts` | device hints from the browser | e2e |
| `src/app/loop.ts` | the one animation loop | e2e |
| `src/app/debug.ts` | `window.__moonlit` for tests + HUD | e2e |
| `src/app/boot.ts` | wires everything together | e2e |
| `src/scroll/progress.ts` | `progressFrom(scroll, limit)` | unit |
| `src/scroll/scroll.ts` | Lenis wrapper | e2e |
| `src/render/renderer.ts` | WebGPURenderer + RenderPipeline + bloom | e2e |
| `src/regions/region.ts` | Region interface | tsc |
| `src/regions/moonsink/cameraPath.ts` | path keys, easing, yaw cap, portrait FOV | unit |
| `src/regions/moonsink/sea.ts` | TSL sea (verified in spike) | e2e + manual |
| `src/regions/moonsink/ring.ts` | broken resonance ring + shards | manual |
| `src/regions/moonsink/index.ts` | `createMoonsink` | e2e |
| `src/overlay/gate.ts` | title screen | e2e |
| `src/overlay/sections.ts` | section reveals (Web Animations API) | e2e |
| `src/overlay/motionPreference.ts` | stored/OS reduced-motion logic | unit |
| `src/overlay/motionToggle.ts` | the toggle button | e2e |
| `src/dev/hud.ts` | `?hud` frame-time overlay | manual |
| `src/dev/gui.ts` | `?gui` lil-gui panel (dev builds only) | manual |
| `src/styles/overlay.css` | title screen, sections, controls, HUD | e2e (axe) |
| `index.html` (replace) | title screen, sections, controls | e2e |
| `tests/e2e/*.spec.ts` | smoke, gate, sections, reduced motion, a11y | — |

---

### Task 1: Branch, dependencies and the size budget decision

**Concept:** Phase 1 brings in three runtime libraries: **Three.js**, which draws the 3D world, **Lenis**, which smooths the scroll, and **lil-gui**, which gives us live sliders during development. We work on a branch so `main` (the live site) only changes when the phase is reviewed. The size budget from Phase 0 is 250 KB, but the spike measured Three.js + WebGPU + bloom + the sea at 254.3 KB. Raising a budget is a decision, not an accident, so this task stops and asks you.

**Files:**
- Modify: `package.json` (dependencies, `build` script)
- Create: `tsconfig.node.json` (type-checks config files and browser tests)
- Modify: `vite.config.ts` (chunk warning threshold)
- Modify: `.size-limit.json` (limit)

**Interfaces:**
- Consumes: Phase 0 scripts
- Produces: `three`, `lenis`, `lil-gui`, `@axe-core/playwright`, `@types/node` available to later tasks; `npm run build` now also type-checks `*.config.ts`, `tests/e2e/**` and `src/app/debug.ts` (the `window.__moonlit` declaration Task 11 creates)

- [ ] **Step 1: Create the branch**

```powershell
git checkout -b phase-1-moonsink
```

- [ ] **Step 2: Replace `package.json`**

File: `package.json`
```json
{
  "name": "vaibhavmannq.github.io",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": {
    "node": ">=24.0.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && tsc --noEmit -p tsconfig.node.json && vite build",
    "preview": "vite preview --port 4173 --strictPort",
    "check": "biome check .",
    "format": "biome check --write .",
    "test": "vitest run",
    "e2e": "playwright test",
    "size": "size-limit"
  },
  "dependencies": {
    "lenis": "1.3.26",
    "three": "0.186.0"
  },
  "devDependencies": {
    "@axe-core/playwright": "4.13.0",
    "@biomejs/biome": "2.5.13",
    "@playwright/test": "1.63.0",
    "@size-limit/file": "13.1.1",
    "@types/node": "24.13.4",
    "@types/three": "0.186.0",
    "lil-gui": "0.21.0",
    "size-limit": "13.1.1",
    "typescript": "7.0.2",
    "vite": "8.3.0",
    "vitest": "5.0.0"
  }
}
```

- [ ] **Step 3: Install**

```powershell
npm install
```
Expected: `added N packages`, `package-lock.json` updated.

- [ ] **Step 4: Silence the expected large-chunk warning**

File: `vite.config.ts`
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  // User site (vaibhavmannq.github.io) is served from the domain root
  base: '/',
  build: {
    target: 'es2023',
    sourcemap: true,
    // Three.js with the WebGPU renderer is ~900 KB minified (~254 KB gzip). That's expected and budgeted in .size-limit.json.
    chunkSizeWarningLimit: 1100,
  },
});
```

- [ ] **Step 4b: Type-check the config files and browser tests**

`tsconfig.json` only covers `src` and `tests/unit`. The config files (`vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`) and the browser tests run in Node, so they get their own config with Node's types. It also includes `src/app/debug.ts` (created in Task 11), so the browser tests know the type of `window.__moonlit`.

File: `tsconfig.node.json`
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node", "vite/client"]
  },
  "include": ["*.config.ts", "tests/e2e", "src/app/debug.ts"]
}
```

Run:
```powershell
npx tsc --noEmit -p tsconfig.node.json
```
Expected: no output, exit code 0. (Before this change, `playwright.config.ts` failed with `Cannot find name 'process'`.)

- [ ] **Step 5: Budget decision (owner approved 270 KB on 2026-09-13; skip straight to Step 6)**

Ask exactly: *"The spike measured 254.3 KB gzip for Three.js + WebGPU + bloom + the sea. Approve raising the JS budget from 250 KB to 270 KB?"*
- **If approved:** do Step 6.
- **If not approved:** leave 250 KB. Task 11 Step 6 will then fail, and the owner decides between cutting bloom from the bundle or re-deciding the budget.

- [ ] **Step 6: Update the budget (only if approved)**

File: `.size-limit.json`
```json
[
  {
    "name": "JavaScript (all chunks, gzip)",
    "path": "dist/assets/*.js",
    "limit": "270 KB",
    "gzip": true
  }
]
```

- [ ] **Step 7: Commit**

```powershell
npm run check
npx tsc --noEmit -p tsconfig.node.json
git add package.json package-lock.json tsconfig.node.json vite.config.ts .size-limit.json
git commit -m "chore: add three, lenis, lil-gui and axe; type-check configs; set JS budget"
```

**Walkthrough (for the owner):**
- **`dependencies`:** what ships to visitors (Three.js, Lenis).
- **`devDependencies`:** tools that never reach the browser (types, tests, lil-gui, which we only load in dev).
- **`chunkSizeWarningLimit`:** only quiets Vite's generic "big file" warning. The real guard is `.size-limit.json`.
- **`tsconfig.node.json`:** a second type-check for code that runs in Node rather than the browser: the config files and the browser tests. `@types/node` teaches TypeScript what `process.env` is. `npm run build` runs both checks, so a typo in a test fails the build instead of a CI run.

**Check (owner):** `git branch --show-current` prints `phase-1-moonsink`, `npm ls three` shows `three@0.186.0`, and `npx tsc --noEmit -p tsconfig.node.json` prints nothing.

---

### Task 2: `damp` and seeded random

**Concept:**
- **`damp`:** smoothing that doesn't depend on frame rate. If the camera moves "10% closer each frame", it moves twice as fast on a 120 Hz screen as on 60 Hz. `damp` moves "the same amount per second" instead, so every device feels identical.
- **Seeded random:** the ring's broken arcs and shards come from random numbers. Using a *seeded* generator (`mulberry32`) makes the random pattern identical on every visit and in every test.

**Files:**
- Modify: `src/shared/math.ts`
- Modify: `tests/unit/math.test.ts`
- Create: `src/shared/random.ts`
- Create: `tests/unit/random.test.ts`

**Interfaces:**
- Consumes: `lerp` (Phase 0)
- Produces: `damp(current: number, target: number, lambda: number, dtSeconds: number): number`, `mulberry32(seed: number): () => number`

- [ ] **Step 1: Write the failing tests**

File: `tests/unit/math.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { clamp01, damp, lerp, smoothstep } from '../../src/shared/math';

describe('clamp01', () => {
  it('keeps values inside 0..1', () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(3)).toBe(1);
  });
});

describe('lerp', () => {
  it('blends between two numbers', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 0.5)).toBe(15);
    expect(lerp(10, 20, 1)).toBe(20);
  });
});

describe('smoothstep', () => {
  it('eases from 0 to 1 between the edges', () => {
    expect(smoothstep(0, 1, 0)).toBe(0);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(0, 1, 1)).toBe(1);
    expect(smoothstep(2, 4, 3)).toBe(0.5);
  });

  it('clamps outside the edges', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  it('is slower near the edges than in the middle', () => {
    expect(smoothstep(0, 1, 0.1)).toBeLessThan(0.1);
    expect(smoothstep(0, 1, 0.9)).toBeGreaterThan(0.9);
  });

  it('acts as a step instead of returning NaN when both edges are equal', () => {
    expect(smoothstep(2, 2, 1)).toBe(0);
    expect(smoothstep(2, 2, 2)).toBe(1);
    expect(smoothstep(2, 2, 3)).toBe(1);
  });
});

describe('damp', () => {
  it('does not move when no time passes', () => {
    expect(damp(0, 10, 2.2, 0)).toBe(0);
  });

  it('covers the same distance per second at any frame rate', () => {
    let at60 = 0;
    for (let i = 0; i < 60; i++) at60 = damp(at60, 10, 2.2, 1 / 60);
    let at120 = 0;
    for (let i = 0; i < 120; i++) at120 = damp(at120, 10, 2.2, 1 / 120);
    expect(at60).toBeCloseTo(at120, 10);
  });

  it('closes half the gap after ln(2)/lambda seconds', () => {
    expect(damp(0, 1, 2, Math.LN2 / 2)).toBeCloseTo(0.5, 10);
  });
});
```

File: `tests/unit/random.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/shared/random';

describe('mulberry32', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it('gives different sequences for different seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('always returns numbers in [0, 1)', () => {
    const next = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 2: Run and watch them fail**

```powershell
npm run test
```
Expected: FAIL. `damp` is not exported and `../../src/shared/random` cannot be resolved.

- [ ] **Step 3: Implement**

File: `src/shared/math.ts`
```ts
/** Clamp a number into the 0..1 range. */
export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Linear blend: t = 0 gives a, t = 1 gives b. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Hermite ease between two edges: 0 before edge0, 1 after edge1, smooth in between. */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  // Equal edges would divide 0 by 0 (NaN); treat them as a hard step instead
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/**
 * Frame-rate independent smoothing toward a target.
 * `lambda` is "how snappy" (higher = faster); dtSeconds is the time since the last frame.
 */
export const damp = (current: number, target: number, lambda: number, dtSeconds: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dtSeconds));
```

File: `src/shared/random.ts`
```ts
/**
 * Small, fast seeded random number generator (mulberry32).
 * Same seed means the same sequence, so procedural shapes look identical on every visit.
 */
export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run and watch them pass**

```powershell
npm run test
```
Expected: PASS, including the 3 new `damp` tests and 3 `mulberry32` tests.

- [ ] **Step 5: Commit**

```powershell
npm run check
git add src/shared tests/unit
git commit -m "feat: add frame-rate independent damp and seeded random"
```

**Walkthrough (for the owner):**
- **`damp`:** uses `1 - e^(-lambda·dt)` as the blend amount, which is the exact maths of "close a fixed fraction of the gap per second". The second test proves 60 small steps equal 120 even smaller steps.
- **`mulberry32`:** scrambles a 32-bit number with multiply and shift operations. You don't need to memorise the operations. What matters is that the same seed always gives the same output.

**Check (owner):** `npm run test` is all green. Change `2.2` to `3` in the frame-rate test, and it still passes (it holds for any lambda).

---

### Task 3: Journey timeline

**Concept:** The **journey** describes the whole site as data: "Moonsink Shore for 3 screen-heights of scroll". `resolve(p)` answers the most important question every frame: *given scroll progress `p` (0 to 1), which region are we in, how far through it, and which text section should show?* It's a **pure function** (same input, same output, no side effects), so we can test every edge without a browser. It already understands transitions between regions, which Phase 2 will use.

**Files:**
- Create: `src/journey/types.ts`
- Create: `src/journey/journey.config.ts`
- Create: `src/journey/timeline.ts`
- Create: `tests/unit/timeline.test.ts`

**Interfaces:**
- Consumes: `clamp01`, `smoothstep` (`src/shared/math.ts`)
- Produces:
  - types `RegionId`, `TransitionEffect`, `SectionId`, `SectionAnchor`, `RegionSegment`, `TransitionSegment`, `Segment`, `JourneyState`
  - `journey: readonly Segment[]`, `MOONSINK_ABOUT_FROM = 0.45`
  - `totalLength(journey): number`
  - `resolve(p: number, journey: readonly Segment[]): JourneyState`
  - `progressForSection(journey: readonly Segment[], id: SectionId): number`

- [ ] **Step 1: Create the types**

File: `src/journey/types.ts`
```ts
export type RegionId = 'moonsink' | 'lumenreach' | 'lastlight';
export type TransitionEffect = 'resonanceRipple' | 'bellToll';
export type SectionId = 'intro' | 'about' | 'projects' | 'contact';

/** A text section starts at `from` (0..1) of its region's own progress. */
export interface SectionAnchor {
  id: SectionId;
  from: number;
}

export interface RegionSegment {
  kind: 'region';
  region: RegionId;
  /** Scroll length in screen heights. */
  length: number;
  /** Sorted by `from`; the first anchor must start at 0. */
  sections: readonly SectionAnchor[];
}

export interface TransitionSegment {
  kind: 'transition';
  effect: TransitionEffect;
  length: number;
}

export type Segment = RegionSegment | TransitionSegment;

export interface JourneyState {
  a: { region: RegionId; local: number };
  /** Present only during a transition. */
  b?: { region: RegionId; local: number };
  /** 0 = all of A, 1 = all of B. */
  mix: number;
  effect?: TransitionEffect;
  section: SectionId;
}
```

- [ ] **Step 2: Create the Phase 1 journey**

File: `src/journey/journey.config.ts`
```ts
import type { Segment } from './types';

/** Where the About text begins inside Moonsink Shore (0..1 of the region). */
export const MOONSINK_ABOUT_FROM = 0.45;

export const journey: readonly Segment[] = [
  {
    kind: 'region',
    region: 'moonsink',
    length: 3,
    sections: [
      { id: 'intro', from: 0 },
      { id: 'about', from: MOONSINK_ABOUT_FROM },
    ],
  },
];
```

- [ ] **Step 3: Write the failing tests**

File: `tests/unit/timeline.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { journey } from '../../src/journey/journey.config';
import { progressForSection, resolve, totalLength } from '../../src/journey/timeline';
import type { Segment } from '../../src/journey/types';

const twoRegions: readonly Segment[] = [
  { kind: 'region', region: 'moonsink', length: 2, sections: [{ id: 'about', from: 0 }] },
  { kind: 'transition', effect: 'resonanceRipple', length: 1 },
  { kind: 'region', region: 'lumenreach', length: 1, sections: [{ id: 'projects', from: 0 }] },
];

describe('totalLength', () => {
  it('adds up every segment', () => {
    expect(totalLength(journey)).toBe(3);
    expect(totalLength(twoRegions)).toBe(4);
  });
});

describe('resolve (Phase 1 journey)', () => {
  it('starts at the beginning of Moonsink with the intro', () => {
    const state = resolve(0, journey);
    expect(state.a).toEqual({ region: 'moonsink', local: 0 });
    expect(state.b).toBeUndefined();
    expect(state.mix).toBe(0);
    expect(state.section).toBe('intro');
  });

  it('switches to About at its anchor', () => {
    expect(resolve(0.44, journey).section).toBe('intro');
    expect(resolve(0.5, journey).section).toBe('about');
    expect(resolve(0.5, journey).a.local).toBeCloseTo(0.5, 10);
  });

  it('clamps progress outside 0..1', () => {
    expect(resolve(-1, journey).a.local).toBe(0);
    expect(resolve(2, journey).a.local).toBe(1);
  });
});

describe('resolve (with a transition)', () => {
  it('is inside the first region for the first half', () => {
    const state = resolve(0.25, twoRegions);
    expect(state.a).toEqual({ region: 'moonsink', local: 0.5 });
    expect(state.b).toBeUndefined();
  });

  it('blends both regions during the transition', () => {
    const state = resolve(0.625, twoRegions);
    expect(state.a).toEqual({ region: 'moonsink', local: 1 });
    expect(state.b).toEqual({ region: 'lumenreach', local: 0 });
    expect(state.mix).toBeCloseTo(0.5, 10);
    expect(state.effect).toBe('resonanceRipple');
    expect(state.section).toBe('projects');
  });

  it('ends at the last region', () => {
    const state = resolve(1, twoRegions);
    expect(state.a).toEqual({ region: 'lumenreach', local: 1 });
    expect(state.b).toBeUndefined();
  });

  it('rejects a journey that does not start with a region', () => {
    const broken: readonly Segment[] = [{ kind: 'transition', effect: 'bellToll', length: 1 }];
    expect(() => resolve(0, broken)).toThrow('journey must start with a region');
  });
});

describe('progressForSection', () => {
  it('finds where a section starts in global progress', () => {
    expect(progressForSection(journey, 'about')).toBeCloseTo(0.45, 10);
    expect(progressForSection(twoRegions, 'projects')).toBeCloseTo(0.75, 10);
  });

  it('round-trips through resolve', () => {
    expect(resolve(progressForSection(journey, 'about'), journey).section).toBe('about');
  });

  it('throws for a section that is not in the journey', () => {
    expect(() => progressForSection(journey, 'contact')).toThrow('section contact is not in the journey');
  });
});
```

- [ ] **Step 4: Run and watch them fail**

```powershell
npm run test
```
Expected: FAIL. `../../src/journey/timeline` cannot be resolved.

- [ ] **Step 5: Implement**

File: `src/journey/timeline.ts`
```ts
import { clamp01, smoothstep } from '../shared/math';
import type { JourneyState, RegionSegment, SectionId, Segment } from './types';

/** Floating-point slack so a value that lands exactly on an anchor counts as "reached". */
const EPSILON = 1e-9;

export function totalLength(journey: readonly Segment[]): number {
  return journey.reduce((sum, segment) => sum + segment.length, 0);
}

function sectionAt(segment: RegionSegment, local: number): SectionId {
  const first = segment.sections[0];
  if (first === undefined) throw new Error(`region ${segment.region} has no sections`);
  let current = first.id;
  for (const anchor of segment.sections) {
    if (local + EPSILON >= anchor.from) current = anchor.id;
  }
  return current;
}

/** Turn scroll progress p (0..1) into "where are we in the journey". Pure: no DOM, no time. */
export function resolve(p: number, journey: readonly Segment[]): JourneyState {
  const first = journey[0];
  if (first === undefined || first.kind !== 'region') throw new Error('journey must start with a region');

  const position = clamp01(p) * totalLength(journey);
  let start = 0;
  let previousRegion: RegionSegment = first;

  for (let i = 0; i < journey.length; i++) {
    const segment = journey[i] as Segment;
    const end = start + segment.length;
    const isLast = i === journey.length - 1;

    if (position < end || isLast) {
      const local = segment.length > 0 ? clamp01((position - start) / segment.length) : 1;

      if (segment.kind === 'region') {
        return { a: { region: segment.region, local }, mix: 0, section: sectionAt(segment, local) };
      }

      const next = journey[i + 1];
      if (next === undefined || next.kind !== 'region') throw new Error('a transition must sit between two regions');
      return {
        a: { region: previousRegion.region, local: 1 },
        b: { region: next.region, local: 0 },
        mix: smoothstep(0, 1, local),
        effect: segment.effect,
        section: local < 0.5 ? sectionAt(previousRegion, 1) : sectionAt(next, 0),
      };
    }

    if (segment.kind === 'region') previousRegion = segment;
    start = end;
  }

  throw new Error('journey is empty');
}

/** Global progress (0..1) where a text section begins, used by "Skip intro" and later by the region rail. */
export function progressForSection(journey: readonly Segment[], id: SectionId): number {
  const total = totalLength(journey);
  let start = 0;
  for (const segment of journey) {
    if (segment.kind === 'region') {
      const anchor = segment.sections.find((candidate) => candidate.id === id);
      if (anchor) return (start + anchor.from * segment.length) / total;
    }
    start += segment.length;
  }
  throw new Error(`section ${id} is not in the journey`);
}
```

- [ ] **Step 6: Run and watch them pass**

```powershell
npm run test
```
Expected: PASS, including all `timeline.test.ts` tests.

- [ ] **Step 7: Commit**

```powershell
npm run check
git add src/journey tests/unit/timeline.test.ts
git commit -m "feat: add journey timeline with resolve and section lookup"
```

**Walkthrough (for the owner):**
- **`journey.config.ts`:** the only place that says what the site *is*. Phase 2 adds more entries here, not new logic.
- **`resolve`:** walks the segments, adding up their lengths until it finds the one containing the current position.
  - *Region:* it reports how far through it we are (`local`).
  - *Transition:* it reports both neighbouring regions and a smooth `mix`, which Phase 2's ripple shader will consume.
- **`EPSILON`:** handles a classic floating-point trap. `0.45 * 3 / 3` can come out as `0.44999999999999996`, which would miss the About anchor by a hair.

**Check (owner):** `npm run test` is green. Change `MOONSINK_ABOUT_FROM` to `0.6`: the "switches to About" test fails. Undo.

---

### Task 4: Quality tiers and the frame-time governor

**Concept:** A **tier** is a bundle of cost settings: render resolution, how many steps the sea's ray march takes, wave detail, and bloom. Tier 0 is the budget phone, tier 4 is the gaming PC. `bootTier` makes a cautious first guess from device hints. The **governor** then watches real frame times.
- **Step down:** the slowest 5% of frames (the 95th percentile) take longer than 15 ms over a second.
- **Step up:** that figure stays under 11 ms for three seconds in a row.
- **Cooldown:** after any change it waits 2 s, so it never flickers between tiers.

Tiers never change what you *see* composed on screen, only how expensive it is to draw.

**Files:**
- Create: `src/quality/tiers.ts`
- Create: `src/quality/governor.ts`
- Create: `tests/unit/tiers.test.ts`
- Create: `tests/unit/governor.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Tier = 0 | 1 | 2 | 3 | 4`, `interface TierSettings { renderScale; marchSteps; waveDetail; bloom }`, `TIERS: Readonly<Record<Tier, TierSettings>>`
  - `interface DeviceHints { coarsePointer; saveData; deviceMemoryGB; webgpu }`, `bootTier(hints): Tier`, `clampTier(tier: number, webgpu: boolean): Tier`
  - `percentile(values: readonly number[], p: number): number`
  - `class Governor { constructor(tier: Tier, webgpu: boolean, options?: GovernorOptions); readonly current: Tier; sample(frameMs: number, nowMs: number): Tier | null }`

- [ ] **Step 1: Write the failing tests**

File: `tests/unit/tiers.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { bootTier, clampTier, TIERS, type Tier } from '../../src/quality/tiers';

const desktop = { coarsePointer: false, saveData: false, deviceMemoryGB: 8, webgpu: true };

describe('bootTier', () => {
  it('starts desktops at tier 2', () => {
    expect(bootTier(desktop)).toBe(2);
  });

  it('starts touch devices at tier 1', () => {
    expect(bootTier({ ...desktop, coarsePointer: true })).toBe(1);
  });

  it('drops one tier for data saver or 4 GB of memory or less', () => {
    expect(bootTier({ ...desktop, saveData: true })).toBe(1);
    expect(bootTier({ ...desktop, deviceMemoryGB: 4 })).toBe(1);
  });

  it('drops only one tier when both apply', () => {
    expect(bootTier({ ...desktop, saveData: true, deviceMemoryGB: 2 })).toBe(1);
  });

  it('treats unknown memory as fine', () => {
    expect(bootTier({ ...desktop, deviceMemoryGB: undefined })).toBe(2);
  });

  it('never goes below tier 0', () => {
    expect(bootTier({ coarsePointer: true, saveData: true, deviceMemoryGB: 1, webgpu: false })).toBe(0);
  });
});

describe('clampTier', () => {
  it('caps WebGL2 at tier 3 and allows tier 4 on WebGPU', () => {
    expect(clampTier(4, false)).toBe(3);
    expect(clampTier(4, true)).toBe(4);
  });

  it('rounds into the valid range', () => {
    expect(clampTier(-3, true)).toBe(0);
    expect(clampTier(2.4, true)).toBe(2);
  });
});

describe('TIERS', () => {
  it('never gets cheaper as the tier rises', () => {
    const tiers: Tier[] = [0, 1, 2, 3, 4];
    for (let i = 1; i < tiers.length; i++) {
      const lower = TIERS[tiers[i - 1] as Tier];
      const higher = TIERS[tiers[i] as Tier];
      expect(higher.renderScale).toBeGreaterThanOrEqual(lower.renderScale);
      expect(higher.marchSteps).toBeGreaterThan(lower.marchSteps);
      expect(higher.waveDetail).toBeGreaterThanOrEqual(lower.waveDetail);
    }
  });

  it('keeps bloom off on the two cheapest tiers', () => {
    expect(TIERS[0].bloom).toBe(false);
    expect(TIERS[1].bloom).toBe(false);
    expect(TIERS[2].bloom).toBe(true);
  });
});
```

File: `tests/unit/governor.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { Governor, percentile } from '../../src/quality/governor';
import type { Tier } from '../../src/quality/tiers';

/** Feed ~1 s of frames (62 samples at 60 Hz). Returns the tier change reported during that window, if any. */
function runWindow(governor: Governor, frameMs: number, startMs: number): { change: Tier | null; endMs: number } {
  let change: Tier | null = null;
  let t = startMs;
  for (let i = 0; i < 62; i++) {
    t = startMs + i * (1000 / 60);
    const result = governor.sample(frameMs, t);
    if (result !== null) change = result;
  }
  return { change, endMs: t + 1000 / 60 };
}

describe('percentile', () => {
  it('returns the value below which the given share of samples fall', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 0.95)).toBe(95);
    expect(percentile(values, 0.5)).toBe(50);
    expect(percentile([7], 0.95)).toBe(7);
  });

  it('does not reorder the caller array', () => {
    const values = [3, 1, 2];
    percentile(values, 0.5);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe('Governor', () => {
  it('waits for a full window before deciding', () => {
    const governor = new Governor(2, true);
    expect(governor.sample(40, 0)).toBeNull();
    expect(governor.sample(40, 500)).toBeNull();
  });

  it('steps down when the slow frames exceed 15 ms', () => {
    const governor = new Governor(2, true);
    const { change } = runWindow(governor, 20, 0);
    expect(change).toBe(1);
    expect(governor.current).toBe(1);
  });

  it('holds during the cooldown after a change, then steps again', () => {
    const governor = new Governor(3, true);
    const first = runWindow(governor, 20, 0);
    expect(first.change).toBe(2);
    const second = runWindow(governor, 20, first.endMs);
    expect(second.change).toBeNull();
    const third = runWindow(governor, 20, second.endMs);
    expect(third.change).toBe(1);
  });

  it('steps up only after three consecutive fast windows', () => {
    const governor = new Governor(1, true);
    const a = runWindow(governor, 8, 0);
    const b = runWindow(governor, 8, a.endMs);
    const c = runWindow(governor, 8, b.endMs);
    expect(a.change).toBeNull();
    expect(b.change).toBeNull();
    expect(c.change).toBe(2);
  });

  it('resets the fast-window count after an in-between window', () => {
    const governor = new Governor(1, true);
    const a = runWindow(governor, 8, 0);
    const b = runWindow(governor, 8, a.endMs);
    const c = runWindow(governor, 13, b.endMs);
    const d = runWindow(governor, 8, c.endMs);
    expect(d.change).toBeNull();
  });

  it('never goes above tier 3 on WebGL2 or below tier 0', () => {
    const webgl = new Governor(3, false);
    let t = 0;
    for (let i = 0; i < 3; i++) t = runWindow(webgl, 8, t).endMs;
    expect(webgl.current).toBe(3);

    const floor = new Governor(0, true);
    expect(runWindow(floor, 40, 0).change).toBeNull();
    expect(floor.current).toBe(0);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

```powershell
npm run test
```
Expected: FAIL. `../../src/quality/tiers` and `../../src/quality/governor` cannot be resolved.

- [ ] **Step 3: Implement the tiers**

File: `src/quality/tiers.ts`
```ts
export type Tier = 0 | 1 | 2 | 3 | 4;

export interface TierSettings {
  /** Multiplies the (capped) device pixel ratio. */
  renderScale: number;
  /** Maximum ray-march steps for the sea. */
  marchSteps: number;
  /** Number of wave layers used for shading. */
  waveDetail: number;
  bloom: boolean;
}

/** Cost only. Tiers never change composition, camera path, content, timing or palette (spec §5.6). */
export const TIERS: Readonly<Record<Tier, TierSettings>> = {
  0: { renderScale: 0.5, marchSteps: 48, waveDetail: 4, bloom: false },
  1: { renderScale: 0.6, marchSteps: 64, waveDetail: 5, bloom: false },
  2: { renderScale: 0.75, marchSteps: 80, waveDetail: 6, bloom: true },
  3: { renderScale: 0.9, marchSteps: 100, waveDetail: 8, bloom: true },
  4: { renderScale: 1, marchSteps: 120, waveDetail: 9, bloom: true },
};

export interface DeviceHints {
  /** Touch-first device (phones, most tablets). */
  coarsePointer: boolean;
  /** Browser "data saver" is on. */
  saveData: boolean;
  /** navigator.deviceMemory, if the browser exposes it. */
  deviceMemoryGB: number | undefined;
  webgpu: boolean;
}

/** WebGL2 tops out at tier 3; tier 4 extras need WebGPU. */
export function clampTier(tier: number, webgpu: boolean): Tier {
  const max = webgpu ? 4 : 3;
  return Math.min(max, Math.max(0, Math.round(tier))) as Tier;
}

/** A cautious first guess. The governor corrects it from real frame times. */
export function bootTier(hints: DeviceHints): Tier {
  let tier = hints.coarsePointer ? 1 : 2;
  const lowMemory = hints.deviceMemoryGB !== undefined && hints.deviceMemoryGB <= 4;
  if (hints.saveData || lowMemory) tier -= 1;
  return clampTier(tier, hints.webgpu);
}
```

- [ ] **Step 4: Implement the governor**

File: `src/quality/governor.ts`
```ts
import { clampTier, type Tier } from './tiers';

export interface GovernorOptions {
  windowMs: number;
  /** Step down when the 95th-percentile frame time is above this. */
  downThresholdMs: number;
  /** Count a window as "fast" when the 95th percentile is below this. */
  upThresholdMs: number;
  upWindowsRequired: number;
  cooldownMs: number;
}

export const DEFAULT_GOVERNOR: GovernorOptions = {
  windowMs: 1000,
  downThresholdMs: 15,
  upThresholdMs: 11,
  upWindowsRequired: 3,
  cooldownMs: 2000,
};

/** Nearest-rank percentile, e.g. p = 0.95 gives the value 95% of samples are at or below. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[rank] as number;
}

export class Governor {
  private tier: Tier;
  private readonly webgpu: boolean;
  private readonly options: GovernorOptions;
  private samples: number[] = [];
  private windowStart: number | null = null;
  private fastWindows = 0;
  private lastChange = Number.NEGATIVE_INFINITY;

  constructor(tier: Tier, webgpu: boolean, options: GovernorOptions = DEFAULT_GOVERNOR) {
    this.tier = tier;
    this.webgpu = webgpu;
    this.options = options;
  }

  get current(): Tier {
    return this.tier;
  }

  /** Record one rendered frame. Returns the new tier when it changes, otherwise null. */
  sample(frameMs: number, nowMs: number): Tier | null {
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
      return this.changeTo(this.tier - 1, nowMs);
    }
    if (slowFrames < this.options.upThresholdMs) {
      this.fastWindows += 1;
      if (this.fastWindows >= this.options.upWindowsRequired) {
        this.fastWindows = 0;
        return this.changeTo(this.tier + 1, nowMs);
      }
      return null;
    }
    this.fastWindows = 0;
    return null;
  }

  private changeTo(target: number, nowMs: number): Tier | null {
    const next = clampTier(target, this.webgpu);
    if (next === this.tier) return null;
    this.tier = next;
    this.lastChange = nowMs;
    return next;
  }
}
```

- [ ] **Step 5: Run and watch them pass**

```powershell
npm run test
```
Expected: PASS for `tiers.test.ts` and `governor.test.ts`.

- [ ] **Step 6: Commit**

```powershell
npm run check
git add src/quality tests/unit/tiers.test.ts tests/unit/governor.test.ts
git commit -m "feat: add quality tiers and frame-time governor"
```

**Walkthrough (for the owner):**
- **`TIERS`:** one table you can read at a glance. Phase 4's high-end extras will add columns here.
- **`bootTier`:** deliberately starts low on phones (most visitors). The governor only climbs when the device *proves* it can afford more.
- **`percentile(…, 0.95)`:** why not the average? One 40 ms hitch is visible jank even if the average looks fine. The 95th percentile measures the bad frames you actually notice.
- **The governor doesn't read the clock itself.** You pass `nowMs` in. That's what makes it testable: the tests "play" fake seconds instantly.

**Check (owner):** `npm run test` is green. In the test file, change `runWindow(governor, 20, 0)` to `runWindow(governor, 14, 0)` and see the step-down test fail (14 ms isn't slow enough). Undo.

---

### Task 5: Small pure helpers: URL params, frame-rate cap, scroll progress, motion preference

**Concept:** Four tiny decisions that the browser code will make every frame or once at start-up. They're pulled out as pure functions so they're tested rather than guessed.
- **URL params:** test and debug hooks from spec §12.2, like `?tier=0` or `?p=0.6&time=4`.
- **Frame-rate cap:** render at most 60 fps even on 120 Hz screens, and 30 fps after 8 s without input, to save battery.
- **Scroll progress:** "how far down the page", as 0..1.
- **Motion preference:** what you chose in the toggle wins over the operating-system setting.

**Files:**
- Create: `src/app/params.ts`, `src/app/frameRate.ts`, `src/scroll/progress.ts`, `src/overlay/motionPreference.ts`
- Create: `tests/unit/params.test.ts`, `tests/unit/frameRate.test.ts`, `tests/unit/progress.test.ts`, `tests/unit/motionPreference.test.ts`

**Interfaces:**
- Consumes: `clamp01`; `Tier`
- Produces:
  - `interface DebugParams { tier?: Tier; p?: number; time?: number; hud: boolean; gui: boolean; forceWebGL: boolean; stills: boolean }`, `readDebugParams(search: string): DebugParams`
  - `frameInterval(idle: boolean, fps: number, idleFps: number): number`, `shouldRender(nowMs: number, lastFrameMs: number, intervalMs: number): boolean`
  - `progressFrom(scroll: number, limit: number): number`
  - `MOTION_STORAGE_KEY`, `type StoredMotion = 'reduced' | 'full'`, `parseStoredMotion(raw: string | null): StoredMotion | null`, `resolveReducedMotion(osPrefersReduced: boolean, stored: StoredMotion | null): boolean`

- [ ] **Step 1: Write the failing tests**

File: `tests/unit/params.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { readDebugParams } from '../../src/app/params';

describe('readDebugParams', () => {
  it('has safe defaults when nothing is set', () => {
    expect(readDebugParams('')).toEqual({
      tier: undefined,
      p: undefined,
      time: undefined,
      hud: false,
      gui: false,
      forceWebGL: false,
      stills: false,
    });
  });

  it('reads a valid tier and ignores invalid ones', () => {
    expect(readDebugParams('?tier=2').tier).toBe(2);
    expect(readDebugParams('?tier=7').tier).toBeUndefined();
    expect(readDebugParams('?tier=1.5').tier).toBeUndefined();
    expect(readDebugParams('?tier=abc').tier).toBeUndefined();
  });

  it('clamps progress and keeps a frozen time of zero', () => {
    expect(readDebugParams('?p=1.4').p).toBe(1);
    expect(readDebugParams('?p=0.6').p).toBe(0.6);
    expect(readDebugParams('?time=0').time).toBe(0);
    expect(readDebugParams('?time=').time).toBeUndefined();
  });

  it('treats presence-only flags as true', () => {
    const params = readDebugParams('?hud&gui&webgl&stills');
    expect(params.hud).toBe(true);
    expect(params.gui).toBe(true);
    expect(params.forceWebGL).toBe(true);
    expect(params.stills).toBe(true);
  });
});
```

File: `tests/unit/frameRate.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { frameInterval, shouldRender } from '../../src/app/frameRate';

describe('frameInterval', () => {
  it('is ~16.7 ms at 60 fps and ~33.3 ms when idle at 30 fps', () => {
    expect(frameInterval(false, 60, 30)).toBeCloseTo(16.667, 2);
    expect(frameInterval(true, 60, 30)).toBeCloseTo(33.333, 2);
  });
});

describe('shouldRender', () => {
  const at60 = 1000 / 60;
  const at30 = 1000 / 30;

  it('always renders the first frame', () => {
    expect(shouldRender(5, -1, at60)).toBe(true);
  });

  it('renders every frame on a 60 Hz display', () => {
    expect(shouldRender(1016.7, 1000, at60)).toBe(true);
  });

  it('skips every other frame on a 120 Hz display', () => {
    expect(shouldRender(1008.3, 1000, at60)).toBe(false);
    expect(shouldRender(1016.6, 1000, at60)).toBe(true);
  });

  it('halves the rate when idle', () => {
    expect(shouldRender(1016.7, 1000, at30)).toBe(false);
    expect(shouldRender(1033.3, 1000, at30)).toBe(true);
  });
});
```

File: `tests/unit/progress.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { progressFrom } from '../../src/scroll/progress';

describe('progressFrom', () => {
  it('turns a scroll position into 0..1', () => {
    expect(progressFrom(0, 1000)).toBe(0);
    expect(progressFrom(500, 1000)).toBe(0.5);
    expect(progressFrom(1000, 1000)).toBe(1);
  });

  it('clamps overscroll and handles a page that cannot scroll', () => {
    expect(progressFrom(-20, 1000)).toBe(0);
    expect(progressFrom(1200, 1000)).toBe(1);
    expect(progressFrom(0, 0)).toBe(0);
  });
});
```

File: `tests/unit/motionPreference.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { parseStoredMotion, resolveReducedMotion } from '../../src/overlay/motionPreference';

describe('parseStoredMotion', () => {
  it('accepts only known values', () => {
    expect(parseStoredMotion('reduced')).toBe('reduced');
    expect(parseStoredMotion('full')).toBe('full');
    expect(parseStoredMotion('banana')).toBeNull();
    expect(parseStoredMotion(null)).toBeNull();
  });
});

describe('resolveReducedMotion', () => {
  it('follows the operating system when nothing is stored', () => {
    expect(resolveReducedMotion(true, null)).toBe(true);
    expect(resolveReducedMotion(false, null)).toBe(false);
  });

  it('lets the visitor override the operating system', () => {
    expect(resolveReducedMotion(true, 'full')).toBe(false);
    expect(resolveReducedMotion(false, 'reduced')).toBe(true);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

```powershell
npm run test
```
Expected: FAIL. The four new modules cannot be resolved.

- [ ] **Step 3: Implement**

File: `src/app/params.ts`
```ts
import type { Tier } from '../quality/tiers';
import { clamp01 } from '../shared/math';

/** Debug and test hooks read from the URL (spec §12.2). */
export interface DebugParams {
  tier?: Tier;
  p?: number;
  time?: number;
  hud: boolean;
  gui: boolean;
  forceWebGL: boolean;
  stills: boolean;
}

export function readDebugParams(search: string): DebugParams {
  const query = new URLSearchParams(search);

  const number = (key: string): number | undefined => {
    const raw = query.get(key);
    if (raw === null || raw.trim() === '') return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };

  const tierValue = number('tier');
  const tier =
    tierValue !== undefined && Number.isInteger(tierValue) && tierValue >= 0 && tierValue <= 4
      ? (tierValue as Tier)
      : undefined;
  const progress = number('p');

  return {
    tier,
    p: progress === undefined ? undefined : clamp01(progress),
    time: number('time'),
    hud: query.has('hud'),
    gui: query.has('gui'),
    forceWebGL: query.has('webgl'),
    stills: query.has('stills'),
  };
}
```

File: `src/app/frameRate.ts`
```ts
/** Milliseconds between rendered frames. */
export const frameInterval = (idle: boolean, fps: number, idleFps: number): number => 1000 / (idle ? idleFps : fps);

/**
 * Render when enough time has passed since the last rendered frame.
 * The 2 ms tolerance keeps a 60 Hz display at every frame despite timer jitter.
 */
export const shouldRender = (nowMs: number, lastFrameMs: number, intervalMs: number): boolean =>
  lastFrameMs < 0 || nowMs - lastFrameMs >= intervalMs - 2;
```

File: `src/scroll/progress.ts`
```ts
import { clamp01 } from '../shared/math';

/** Scroll position as 0..1 of the scrollable distance. */
export const progressFrom = (scroll: number, limit: number): number => (limit > 0 ? clamp01(scroll / limit) : 0);
```

File: `src/overlay/motionPreference.ts`
```ts
export const MOTION_STORAGE_KEY = 'moonlit:motion';

export type StoredMotion = 'reduced' | 'full';

export function parseStoredMotion(raw: string | null): StoredMotion | null {
  return raw === 'reduced' || raw === 'full' ? raw : null;
}

/** The visitor's explicit choice wins; otherwise follow the operating-system setting. */
export function resolveReducedMotion(osPrefersReduced: boolean, stored: StoredMotion | null): boolean {
  return stored === null ? osPrefersReduced : stored === 'reduced';
}
```

- [ ] **Step 4: Run and watch them pass**

```powershell
npm run test
```
Expected: PASS for all four new test files.

- [ ] **Step 5: Commit**

```powershell
npm run check
git add src/app src/scroll src/overlay tests/unit
git commit -m "feat: add debug params, frame-rate cap, scroll progress and motion preference helpers"
```

**Walkthrough (for the owner):**
- **`readDebugParams`:** everything a tester (or you) can set in the address bar.
  - `?time=0` must stay `0`, not be treated as "missing", hence the explicit `undefined` checks.
- **`shouldRender`:**
  - On a 120 Hz phone the browser asks for a frame every 8.3 ms. We only draw every second one, which keeps the GPU cool and pacing even.
  - After 8 s without input we drop to 30 fps. Slow waves still look smooth, and the battery thanks you.
- **`resolveReducedMotion`:** the three-state logic behind the toggle: "follow my system", "always reduce", "never reduce".

**Check (owner):** `npm run test` is green. Open `http://localhost:5173/?tier=9`: nothing breaks, because invalid values are ignored (you'll see the effect once boot exists in Task 11).

---

### Task 6: The Moonsink camera path

**Concept:** The prototype's camera flies from the open sea, turns toward the black shore, and ends facing the moon again. We keep its exact **keyframes** ("at 28% of the region, be here, looking there") and ease between them with `smoothstep`. Three extra rules keep it comfortable and correct:
1. **Yaw speed cap:** a fast flick of the scroll wheel can't spin the camera faster than 1.2 rad/s (spec §10.1).
2. **Coordinate conversion:** the prototype used a left-handed camera. `toThreeCamera` converts once, in one place.
3. **Portrait FOV:** on tall phone screens the field of view widens so the moon and ring stay in frame (spec §8).

**Files:**
- Create: `src/regions/moonsink/cameraPath.ts`
- Create: `tests/unit/cameraPath.test.ts`

**Interfaces:**
- Consumes: `damp`, `lerp`, `smoothstep`; `MOONSINK_ABOUT_FROM`
- Produces:
  - `SEA_FOV = 34.708`, `MAX_YAW_SPEED = 1.2`
  - `interface CameraPose { x; y; z; yaw; pitch }`, `interface CameraKey extends CameraPose { at }`
  - `MOONSINK_PATH: readonly CameraKey[]`
  - `poseAt(path, s): CameraPose`
  - `approachPose(current, target, dtSeconds, lambda?): CameraPose`
  - `idlePose(timeSeconds, reducedMotion): CameraPose`
  - `reducedMotionTarget(local): CameraPose`
  - `toThreeCamera(pose): { position: [number, number, number]; rotation: [number, number, number] }`
  - `fovForAspect(baseVerticalFov, aspect, referenceAspect?, maxFov?): number`

- [ ] **Step 1: Write the failing tests**

File: `tests/unit/cameraPath.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import {
  approachPose,
  fovForAspect,
  idlePose,
  MAX_YAW_SPEED,
  MOONSINK_PATH,
  poseAt,
  reducedMotionTarget,
  SEA_FOV,
  toThreeCamera,
} from '../../src/regions/moonsink/cameraPath';

const first = MOONSINK_PATH[0];
const last = MOONSINK_PATH[MOONSINK_PATH.length - 1];

describe('poseAt', () => {
  it('returns the first and last keys at the ends and clamps beyond them', () => {
    expect(poseAt(MOONSINK_PATH, 0)).toMatchObject({ x: first?.x, y: first?.y, z: first?.z, yaw: first?.yaw });
    expect(poseAt(MOONSINK_PATH, -1)).toMatchObject({ x: first?.x, z: first?.z });
    expect(poseAt(MOONSINK_PATH, 1)).toMatchObject({ x: last?.x, y: last?.y, z: last?.z, yaw: last?.yaw });
    expect(poseAt(MOONSINK_PATH, 2)).toMatchObject({ x: last?.x, z: last?.z });
  });

  it('eases halfway between two keys', () => {
    const pose = poseAt(MOONSINK_PATH, 0.14);
    expect(pose.x).toBeCloseTo(-1, 10);
    expect(pose.yaw).toBeCloseTo(Math.PI * 0.45, 10);
  });
});

describe('approachPose', () => {
  it('damps position toward the target', () => {
    const current = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    const target = { x: 10, y: 0, z: 0, yaw: 0, pitch: 0 };
    expect(approachPose(current, target, 0.1).x).toBeCloseTo(10 * (1 - Math.exp(-0.22)), 10);
  });

  it('caps how fast the camera can turn', () => {
    const current = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    const target = { x: 0, y: 0, z: 0, yaw: 3, pitch: 0 };
    expect(approachPose(current, target, 0.1).yaw).toBeCloseTo(MAX_YAW_SPEED * 0.1, 10);
  });
});

describe('idlePose and reducedMotionTarget', () => {
  it('holds perfectly still with reduced motion', () => {
    expect(idlePose(12.3, true)).toEqual(poseAt(MOONSINK_PATH, 0));
  });

  it('drifts gently otherwise', () => {
    expect(idlePose(4, false).y).not.toBe(first?.y);
  });

  it('cuts between two viewpoints instead of flying', () => {
    expect(reducedMotionTarget(0.2)).toEqual(poseAt(MOONSINK_PATH, 0));
    expect(reducedMotionTarget(0.9)).toEqual(poseAt(MOONSINK_PATH, 1));
  });
});

describe('toThreeCamera', () => {
  it('mirrors x and converts yaw for the right-handed Three.js camera', () => {
    const converted = toThreeCamera({ x: 2, y: 3, z: 4, yaw: 0, pitch: -0.1 });
    expect(converted.position).toEqual([-2, 3, 4]);
    expect(converted.rotation[0]).toBe(-0.1);
    expect(converted.rotation[1]).toBeCloseTo(Math.PI, 10);
    expect(converted.rotation[2]).toBe(0);
  });
});

describe('fovForAspect', () => {
  it('keeps the base FOV on wide screens', () => {
    expect(fovForAspect(SEA_FOV, 16 / 9)).toBe(SEA_FOV);
    expect(fovForAspect(SEA_FOV, 2.4)).toBe(SEA_FOV);
  });

  it('widens on narrower screens so the same horizontal view fits', () => {
    expect(fovForAspect(SEA_FOV, 1.5)).toBeCloseTo(40.67, 1);
  });

  it('never exceeds the cap on tall phones', () => {
    expect(fovForAspect(SEA_FOV, 9 / 19.5)).toBe(70);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

```powershell
npm run test
```
Expected: FAIL. `../../src/regions/moonsink/cameraPath` cannot be resolved.

- [ ] **Step 3: Implement**

File: `src/regions/moonsink/cameraPath.ts`
```ts
import { MOONSINK_ABOUT_FROM } from '../../journey/journey.config';
import { damp, lerp, smoothstep } from '../../shared/math';

/** Prototype focal length 1.6 on a unit-height screen gives a vertical field of view of 2·atan(0.5/1.6) degrees. */
export const SEA_FOV = 34.708;

/** Comfort limit for turning (radians per second), spec §10.1. */
export const MAX_YAW_SPEED = 1.2;

/**
 * A camera pose in "prototype space": left-handed, yaw 0 looks toward +z, pitch > 0 looks up.
 * Keeping the prototype's convention means every number below is copied unchanged from demo 1.
 */
export interface CameraPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface CameraKey extends CameraPose {
  /** Position along the region, 0..1. */
  at: number;
}

export const MOONSINK_PATH: readonly CameraKey[] = [
  { at: 0, x: 0, y: 3.2, z: 34, yaw: 0, pitch: -0.06 },
  { at: 0.28, x: -2, y: 6, z: 26, yaw: Math.PI * 0.9, pitch: -0.17 },
  { at: 0.55, x: 1, y: 1.8, z: 8, yaw: Math.PI, pitch: -0.07 },
  { at: 0.78, x: 2.5, y: 1.55, z: -1.8, yaw: Math.PI * 1.5, pitch: -0.05 },
  { at: 1, x: 0, y: 1.45, z: -5.5, yaw: Math.PI * 2, pitch: -0.11 },
];

const copyPose = (pose: CameraPose): CameraPose => ({
  x: pose.x,
  y: pose.y,
  z: pose.z,
  yaw: pose.yaw,
  pitch: pose.pitch,
});

/** Eased pose at position s (0..1) along the path. */
export function poseAt(path: readonly CameraKey[], s: number): CameraPose {
  const first = path[0];
  const last = path[path.length - 1];
  if (first === undefined || last === undefined) throw new Error('camera path needs at least one key');
  if (s <= first.at) return copyPose(first);

  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1] as CameraKey;
    const to = path[i] as CameraKey;
    if (s <= to.at) {
      const t = smoothstep(from.at, to.at, s);
      return {
        x: lerp(from.x, to.x, t),
        y: lerp(from.y, to.y, t),
        z: lerp(from.z, to.z, t),
        yaw: lerp(from.yaw, to.yaw, t),
        pitch: lerp(from.pitch, to.pitch, t),
      };
    }
  }
  return copyPose(last);
}

/** Smoothly follow a moving target, with turning speed capped for comfort. */
export function approachPose(current: CameraPose, target: CameraPose, dtSeconds: number, lambda = 2.2): CameraPose {
  const desiredYaw = damp(current.yaw, target.yaw, lambda, dtSeconds);
  const maxStep = MAX_YAW_SPEED * dtSeconds;
  const yawStep = Math.max(-maxStep, Math.min(maxStep, desiredYaw - current.yaw));
  return {
    x: damp(current.x, target.x, lambda, dtSeconds),
    y: damp(current.y, target.y, lambda, dtSeconds),
    z: damp(current.z, target.z, lambda, dtSeconds),
    yaw: current.yaw + yawStep,
    pitch: damp(current.pitch, target.pitch, lambda, dtSeconds),
  };
}

/** Behind the title screen: a slow bob on the open sea (perfectly still with reduced motion). */
export function idlePose(timeSeconds: number, reducedMotion: boolean): CameraPose {
  const start = poseAt(MOONSINK_PATH, 0);
  if (reducedMotion) return start;
  return {
    ...start,
    y: start.y + Math.sin(timeSeconds * 0.35) * 0.25,
    yaw: start.yaw + Math.sin(timeSeconds * 0.12) * 0.04,
  };
}

/** Reduced motion: no flight, just the intro viewpoint or the About viewpoint. */
export function reducedMotionTarget(local: number): CameraPose {
  return poseAt(MOONSINK_PATH, local < MOONSINK_ABOUT_FROM ? 0 : 1);
}

/** Convert a prototype-space pose to Three.js (right-handed): mirror x, and yaw becomes π − yaw (Euler order YXZ). */
export function toThreeCamera(pose: CameraPose): {
  position: [number, number, number];
  rotation: [number, number, number];
} {
  return { position: [-pose.x, pose.y, pose.z], rotation: [pose.pitch, Math.PI - pose.yaw, 0] };
}

/**
 * On screens narrower than the reference aspect, widen the vertical FOV so the horizontal view stays the same,
 * keeping the moon and ring in frame on phones. Capped so tall screens don't turn fish-eye.
 */
export function fovForAspect(baseVerticalFov: number, aspect: number, referenceAspect = 16 / 9, maxFov = 70): number {
  if (aspect >= referenceAspect) return baseVerticalFov;
  const halfBase = (baseVerticalFov * Math.PI) / 360;
  const halfHorizontal = Math.atan(Math.tan(halfBase) * referenceAspect);
  const vertical = (2 * Math.atan(Math.tan(halfHorizontal) / aspect) * 180) / Math.PI;
  return Math.min(maxFov, vertical);
}
```

- [ ] **Step 4: Run and watch them pass**

```powershell
npm run test
```
Expected: PASS for `cameraPath.test.ts`.

- [ ] **Step 5: Commit**

```powershell
npm run check
git add src/regions tests/unit/cameraPath.test.ts
git commit -m "feat: add Moonsink camera path with comfort cap and portrait FOV"
```

**Walkthrough (for the owner):**
- **`MOONSINK_PATH`:** the five moments of the flight you liked in demo 1. `at` is how far into the region each happens.
- **`poseAt`:** finds the two keys around `s` and eases between them.
- **`approachPose`:** the camera *chases* the target instead of teleporting. That gives the soft, controlled feel even if the scroll jumps.
- **`toThreeCamera`:** why the minus sign? The prototype's x axis pointed the other way. Converting here means nothing else in the code needs to know.
- **`fovForAspect`:** on a 16:9 laptop nothing changes. On a phone held upright the view widens so the moon and ring don't fall off the sides.

**Check (owner):** `npm run test` is green. Change `MAX_YAW_SPEED` to `5`: the turning test fails, which shows the comfort cap is doing real work. Undo.

---

### Task 7: The sea (demo 1 ported to TSL)

**Concept:** This is the heart of Moonsink Shore, and the code was **already proven in a spike during planning**: it compiles and renders with zero errors on both the WebGPU and WebGL2 backends and matches demo 1. It's a **ray-marched height field**. For every pixel we shoot a ray from the camera and step along it until it meets the water or the black sand, then colour that point: reflected sky, moon glitter, foam, wet sand. It's written in **TSL**, Three.js's shader language in JavaScript, which Three compiles to WGSL on WebGPU or GLSL on WebGL2.

Two rules learned the hard way in the spike are built in:
1. **Shader functions are pure.** Time and step counts are passed in, never read from uniforms inside.
2. **The mesh also writes depth**, so the 3D ring can sink into the waves.

**Files:**
- Create: `src/regions/moonsink/sea.ts`

**Interfaces:**
- Consumes: `three/webgpu`, `three/tsl`
- Produces:
  - `createSea(): { mesh: Mesh; uniforms: { time; yaw; marchSteps; waveDetail } }`
  - `type Sea = ReturnType<typeof createSea>`
  - `type SeaUniforms = Sea['uniforms']`

- [ ] **Step 1: Create the sea (verified spike code)**

File: `src/regions/moonsink/sea.ts`
```ts
import {
  abs,
  atan,
  Break,
  cameraFar,
  cameraNear,
  cameraPosition,
  cameraProjectionMatrixInverse,
  cameraWorldMatrix,
  cos,
  dot,
  exp,
  Fn,
  float,
  floor,
  fract,
  If,
  int,
  Loop,
  length,
  max,
  min,
  mix,
  normalize,
  positionLocal,
  pow,
  reflect,
  screenCoordinate,
  screenSize,
  screenUV,
  select,
  sin,
  smoothstep,
  step,
  uniform,
  vec2,
  vec3,
  vec4,
  viewZToPerspectiveDepth,
} from 'three/tsl';
import type { Node } from 'three/webgpu';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

type F = Node<'float'>;
type I = Node<'int'>;
type V2 = Node<'vec2'>;
type V3 = Node<'vec3'>;

// "1 - smoothstep(a, b, x)". The prototype used reversed edges (smoothstep(0.14, 0.0, x)),
// which WGSL does not define, so we write the falling edge explicitly.
const fall = (a: number, b: number, x: F) => smoothstep(a, b, x).oneMinus();

// Rule for this file: functions with setLayout() are compiled into real shader functions and
// must be PURE. They never read uniforms directly; time and step counts come in as parameters.
// (Reading a uniform inside a layout function breaks WGSL compilation: "struct member not found".)

export function createSea() {
  const uniforms = {
    time: uniform(0),
    yaw: uniform(0),
    marchSteps: uniform(80, 'int'),
    waveDetail: uniform(9, 'int'),
  };

  // The prototype used a left-handed camera; Three.js is right-handed. Mirroring X into
  // "sea space" lets every constant below stay identical to the prototype.
  const toSea = (v: V3) => vec3(v.x.negate(), v.y, v.z);
  const MOON = vec3(0.148, 0.0691, 0.9866);

  const hash21 = Fn(([p]: [V2]) => {
    const q = fract(p.mul(vec2(123.34, 456.21))).toVar();
    q.addAssign(dot(q, q.add(45.32)));
    return fract(q.x.mul(q.y));
  }).setLayout({ name: 'hash21', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });

  const noise2 = Fn(([p]: [V2]) => {
    const i = floor(p);
    const f = fract(p);
    const u = f.mul(f).mul(f.mul(-2).add(3));
    const a = hash21(i);
    const b = hash21(i.add(vec2(1, 0)));
    const c = hash21(i.add(vec2(0, 1)));
    const d = hash21(i.add(vec2(1, 1)));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }).setLayout({ name: 'noise2', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });

  const waterH = Fn(([p, iters, time]: [V2, I, F]) => {
    const h = float(0).toVar();
    const amp = float(0.16).toVar();
    const freq = float(0.32).toVar();
    const speed = float(0.85).toVar();
    const q = vec2(p).toVar();
    Loop({ start: int(0), end: iters, type: 'int', condition: '<' }, ({ i }) => {
      const ang = sin(float(i).mul(1.73)).mul(0.9);
      const d = vec2(sin(ang), cos(ang));
      const x = dot(q, d).mul(freq).add(time.mul(speed));
      const w = exp(sin(x).sub(1));
      h.addAssign(amp.mul(w));
      q.subAssign(d.mul(w.mul(cos(x)).mul(amp).mul(0.55)));
      amp.mulAssign(0.74);
      freq.mulAssign(1.3);
      speed.mulAssign(1.06);
    });
    h.addAssign(sin(time.mul(0.55).sub(p.y.mul(0.35))).mul(0.1));
    return h.sub(0.16);
  }).setLayout({
    name: 'waterH',
    type: 'float',
    inputs: [
      { name: 'p', type: 'vec2' },
      { name: 'iters', type: 'int' },
      { name: 'time', type: 'float' },
    ],
  });

  const sandH = Fn(([p]: [V2]) => {
    const s = p.y.mul(-0.07).sub(0.12).toVar();
    s.addAssign(
      sin(p.x.mul(0.23).add(sin(p.y.mul(0.4))))
        .mul(0.12)
        .mul(smoothstep(0, 6, p.y.negate())),
    );
    s.addAssign(noise2(p.mul(1.3)).sub(0.5).mul(0.05));
    return min(s, 2.2);
  }).setLayout({ name: 'sandH', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });

  const heightAt = Fn(([p, time]: [V2, F]) => max(waterH(p, int(5), time), sandH(p))).setLayout({
    name: 'heightAt',
    type: 'float',
    inputs: [
      { name: 'p', type: 'vec2' },
      { name: 'time', type: 'float' },
    ],
  });

  const sky = Fn(([rd, stars, time]: [V3, F, F]) => {
    const y = max(rd.y, 0);
    const facing = dot(normalize(rd.xz.add(1e-4)), normalize(MOON.xz));
    const hor = mix(vec3(0.004, 0.007, 0.01), vec3(0.035, 0.06, 0.07), smoothstep(-0.7, 1.0, facing));
    const c = mix(hor, vec3(0.0005, 0.001, 0.003), pow(y, 0.3)).toVar();
    const md = max(dot(rd, MOON), 0);
    c.addAssign(vec3(1.0, 0.97, 0.88).mul(smoothstep(0.9993, 0.99965, md).mul(2.5)));
    c.addAssign(vec3(0.35, 0.6, 0.66).mul(pow(md, 40).mul(0.3)));
    c.addAssign(vec3(0.1, 0.25, 0.3).mul(pow(md, 6).mul(0.05)));
    const sp = vec2(atan(rd.x, rd.z), rd.y).mul(90);
    const cell = floor(sp);
    const st = hash21(cell);
    const offset = vec2(hash21(cell.add(5.3)), hash21(cell.add(9.1)))
      .sub(0.5)
      .mul(0.6);
    const sd = length(fract(sp).sub(0.5).sub(offset));
    const twinkle = sin(time.mul(1.7).add(st.mul(90)))
      .mul(0.5)
      .add(0.5);
    const starAmount = stars
      .mul(step(0.985, st))
      .mul(fall(0.0, 0.09, sd))
      .mul(smoothstep(0.04, 0.35, rd.y))
      .mul(twinkle)
      .mul(1.5);
    c.addAssign(vec3(0.7, 0.9, 1.0).mul(starAmount));
    const band = noise2(vec2(rd.x.mul(2.5).add(time.mul(0.015)), rd.y.mul(7).sub(time.mul(0.01))));
    const bandAmount = pow(band, 5)
      .mul(smoothstep(0.06, 0.35, y))
      .mul(fall(0.35, 0.85, y))
      .mul(0.7);
    c.addAssign(vec3(0.04, 0.22, 0.25).mul(bandAmount));
    return c;
  }).setLayout({
    name: 'sky',
    type: 'vec3',
    inputs: [
      { name: 'rd', type: 'vec3' },
      { name: 'stars', type: 'float' },
      { name: 'time', type: 'float' },
    ],
  });

  // Sphere-trace the height field. On overshoot we stop, then refine with a short
  // bisection *after* the loop (no nested loops, which keeps the shader simple).
  const march = Fn(([ro, rd, steps, time]: [V3, V3, I, F]) => {
    const t = float(0.05).toVar();
    const tPrev = float(0.05).toVar();
    const hit = float(-1).toVar();
    const overshot = float(0).toVar();
    Loop({ start: int(0), end: steps, type: 'int', condition: '<' }, () => {
      const p = ro.add(rd.mul(t)).toVar();
      If(p.y.greaterThan(2.4).and(rd.y.greaterThan(0)), () => {
        Break();
      });
      const d = p.y.sub(heightAt(p.xz, time)).toVar();
      If(d.lessThan(0), () => {
        overshot.assign(1);
        Break();
      });
      If(d.lessThan(t.mul(0.002)), () => {
        hit.assign(t);
        Break();
      });
      tPrev.assign(t);
      t.addAssign(max(d.mul(0.5), t.mul(0.006).add(0.012)));
      If(t.greaterThan(240), () => {
        Break();
      });
    });
    If(overshot.greaterThan(0.5), () => {
      const a = tPrev.toVar();
      const b = t.toVar();
      Loop({ start: int(0), end: int(6), type: 'int', condition: '<' }, () => {
        const m = a.add(b).mul(0.5).toVar();
        const pm = ro.add(rd.mul(m));
        If(pm.y.sub(heightAt(pm.xz, time)).lessThan(0), () => {
          b.assign(m);
        }).Else(() => {
          a.assign(m);
        });
      });
      hit.assign(b);
    });
    return hit;
  }).setLayout({
    name: 'march',
    type: 'float',
    inputs: [
      { name: 'ro', type: 'vec3' },
      { name: 'rd', type: 'vec3' },
      { name: 'steps', type: 'int' },
      { name: 'time', type: 'float' },
    ],
  });

  // Uniforms are read ONLY here, in the main shader body, then passed into the pure functions.
  const time = uniforms.time.toVar('seaTime');

  // Camera ray for this pixel, built from the real Three.js camera (screenUV origin is top-left)
  const ndc = vec2(screenUV.x.mul(2).sub(1), screenUV.y.mul(2).sub(1).negate());
  const viewPos = cameraProjectionMatrixInverse.mul(vec4(ndc, 0.5, 1));
  const dirView = normalize(viewPos.xyz.div(viewPos.w)).toVar('seaDirView');
  const dirWorld = normalize(cameraWorldMatrix.mul(vec4(dirView, 0)).xyz);
  const ro = toSea(cameraPosition).toVar('seaRo');
  const rd = toSea(dirWorld).toVar('seaRd');
  const tHit = march(ro, rd, uniforms.marchSteps, time).toVar('seaT');

  const color = Fn(() => {
    const col = vec3(0).toVar();
    If(tHit.lessThan(0), () => {
      col.assign(sky(rd, float(1), time));
    }).Else(() => {
      const detail = uniforms.waveDetail;
      const p = ro.add(rd.mul(tHit)).toVar();
      const wH = waterH(p.xz, detail, time).toVar();
      const sH = sandH(p.xz).toVar();
      const e = max(tHit.mul(0.0025), 0.012).toVar();
      const isWater = wH.greaterThanEqual(sH);
      const ex = vec2(e, 0);
      const ez = vec2(0, e);
      const hx1 = select(isWater, waterH(p.xz.sub(ex), detail, time), sandH(p.xz.sub(ex)));
      const hx2 = select(isWater, waterH(p.xz.add(ex), detail, time), sandH(p.xz.add(ex)));
      const hz1 = select(isWater, waterH(p.xz.sub(ez), detail, time), sandH(p.xz.sub(ez)));
      const hz2 = select(isWater, waterH(p.xz.add(ez), detail, time), sandH(p.xz.add(ez)));
      const n = normalize(vec3(hx1.sub(hx2), e.mul(2), hz1.sub(hz2))).toVar();
      const R = reflect(rd, n).toVar();
      R.y.assign(abs(R.y));
      const fres = pow(max(dot(n, rd.negate()), 0).oneMinus(), 5)
        .mul(0.97)
        .add(0.03);
      const skyR = sky(R, float(0), time).toVar();

      // Water: deep colour + faint crest scatter, mirrored sky, moon glitter, shoreline foam
      const crest = smoothstep(-0.05, 0.35, p.y);
      const scatter = crest.mul(max(dot(MOON.xz, rd.xz.negate()), 0).mul(0.6).add(0.4));
      const water = mix(vec3(0.001, 0.006, 0.01).add(vec3(0.002, 0.025, 0.028).mul(scatter)), skyR, fres).toVar();
      water.addAssign(vec3(1.0, 0.96, 0.88).mul(pow(max(dot(R, MOON), 0), 300).mul(2.2)));
      const foamNoise = noise2(p.xz.mul(vec2(2.5, 5.0)).add(vec2(0, time.mul(0.5))));
      const foam = fall(0.0, 0.14, wH.sub(sH)).mul(foamNoise.mul(0.55).add(0.45));
      water.assign(mix(water, vec3(0.3, 0.4, 0.42), foam.mul(0.7)));

      // Black sand: barely-lit base, wet sheen near the waterline, rare glints
      const sand = vec3(0.004, 0.004, 0.005)
        .mul(max(dot(n, MOON), 0).add(0.3))
        .add(vec3(0.004, 0.012, 0.016))
        .toVar();
      const wet = fall(0.0, 0.35, sH.sub(wH));
      sand.assign(mix(sand, skyR.mul(fres.mul(0.8)).add(vec3(0.002, 0.006, 0.008)), wet));
      sand.addAssign(vec3(0.55, 0.68, 0.7).mul(fall(0.0, 0.05, sH.sub(wH)).mul(0.25)));
      const gh = hash21(floor(p.xz.mul(50)));
      const glint = step(0.985, gh)
        .mul(pow(max(dot(R, MOON), 0), 5))
        .mul(
          sin(time.mul(3).add(gh.mul(80)))
            .mul(0.5)
            .add(0.5),
        )
        .mul(fall(2.0, 25.0, tHit))
        .mul(1.4);
      sand.addAssign(vec3(0.75, 0.95, 1.0).mul(glint));

      col.assign(select(isWater, water, sand));
      const fogColor = sky(normalize(vec3(rd.x, 0.015, rd.z)), float(0), time);
      col.assign(mix(col, fogColor, exp(tHit.mul(-0.022)).oneMinus()));
    });

    // Drifting motes in screen space, with parallax from yaw and camera height
    const uv = screenCoordinate.sub(screenSize.mul(0.5)).div(screenSize.y).toVar();
    const motes = float(0).toVar();
    Loop({ start: int(0), end: int(3), type: 'int', condition: '<' }, ({ i }) => {
      const fi = float(i);
      const drift = vec2(
        uniforms.yaw.mul(fi.add(1.5)).mul(2),
        time.mul(fi.mul(0.02).add(0.04)).negate().add(cameraPosition.y.mul(0.15)),
      );
      const g = uv.mul(fi.mul(4).add(5)).add(drift);
      const id = floor(g);
      const fr = fract(g).sub(0.5);
      const h = hash21(id.add(fi.mul(17)));
      const wobble = vec2(sin(time.mul(0.6).add(h.mul(40))), cos(time.mul(0.5).add(h.mul(30)))).mul(0.15);
      const o = vec2(hash21(id.add(3.1)), hash21(id.add(7.7)))
        .sub(0.5)
        .add(wobble);
      const dist = length(fr.sub(o.mul(0.7)));
      const pulse = sin(time.mul(1.3).add(h.mul(60)))
        .mul(0.5)
        .add(0.5);
      motes.addAssign(
        step(0.8, h)
          .mul(fall(0.0, 0.06, dist))
          .mul(pulse)
          .mul(fi.mul(-0.15).add(0.6)),
      );
    });
    col.addAssign(vec3(0.55, 0.88, 0.95).mul(motes.mul(0.35)));

    // Prototype tone curve. The pipeline's output transform then applies sRGB (~pow 1/2.2),
    // so raising to 0.62 * 2.2 = 1.364 lands on the prototype's final brightness.
    col.assign(pow(exp(col.mul(-1.4)).oneMinus(), vec3(1.364)));
    col.mulAssign(mix(0.55, 1.0, fall(0.35, 1.25, length(uv))));
    col.addAssign(
      hash21(screenCoordinate.add(fract(time).mul(100)))
        .sub(0.5)
        .mul(0.006),
    );
    return vec4(col, 1);
  })();

  // Depth of the water/sand hit, so 3D objects sink into the sea correctly
  const depth = select(tHit.lessThan(0), float(1), viewZToPerspectiveDepth(dirView.z.mul(tHit), cameraNear, cameraFar));

  const material = new MeshBasicNodeMaterial();
  material.vertexNode = vec4(positionLocal.xy, 0, 1);
  material.colorNode = color;
  material.depthNode = depth;

  const mesh = new Mesh(new PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;

  return { mesh, uniforms };
}

export type Sea = ReturnType<typeof createSea>;
export type SeaUniforms = Sea['uniforms'];
```

- [ ] **Step 2: Type-check and lint**

```powershell
npm run check
npx tsc --noEmit
```
Expected: both pass with no output errors. (Seeing it render comes in Task 11, once the renderer and boot exist.)

- [ ] **Step 3: Commit**

```powershell
git add src/regions/moonsink/sea.ts
git commit -m "feat: port the demo 1 sea to TSL with depth output"
```

**Walkthrough (for the owner).** Read the file top to bottom in this order:
1. **`uniforms`:** the four values JavaScript can change every frame: `time`, `yaw` (for mote parallax), and the two tier-controlled costs.
2. **`hash21` / `noise2`:** cheap pseudo-random patterns. They drive stars, foam and sand glints.
3. **`waterH` / `sandH`:** "how high is the surface at this point".
   - *Water:* layered sine waves, each nudging the next, which gives the sharp crests.
   - *Sand:* a gentle slope rising toward the shore.
4. **`sky`:** a dark gradient, the moon disc and halo, twinkling stars, faint aurora-like bands.
5. **`march`:** the ray walks forward in big steps while far from the surface and small steps when close. If it overshoots, six halving steps pin the exact hit.
6. **`color`:** if the ray hit nothing, draw sky. Otherwise:
   - find the surface normal (tilt)
   - mix reflected sky by the Fresnel factor (more mirror-like at grazing angles)
   - add glitter, foam and wet sand, then fog into the horizon
   - add motes
   - apply the prototype's tone curve, vignette and grain
7. **`depth`:** tells the GPU how far away the water is at this pixel, so the ring can sink into it.

**Check (owner):** `npx tsc --noEmit` passes. Search the file for `uniforms.` and confirm every use sits *outside* the `setLayout` functions. That's the purity rule in action.

---

### Task 8: The broken resonance ring, shards and GPU clean-up

**Concept:** Moonsink Shore's landmark is a colossal **broken ring** standing in the sea on the horizon, with the moon framed inside it. It's made of dark stone arcs with gaps, a thin glowing inner ring, and floating stone shards with glowing edges. The shapes are **procedural** (built by code from seeded random numbers); hand-made models come in Phase 5. Because the sea writes depth, the lower part of the ring disappears correctly beneath the waterline. We also add a helper that frees GPU memory for a whole object tree, which matters once regions come and go in Phase 2.

**Files:**
- Create: `src/shared/dispose.ts`
- Create: `src/regions/moonsink/ring.ts`

**Interfaces:**
- Consumes: `mulberry32`
- Produces:
  - `disposeObject(root: Object3D): void`
  - `createRing(): { group: Group; update(timeSeconds: number, reducedMotion: boolean): void }`

- [ ] **Step 1: Create the dispose helper**

File: `src/shared/dispose.ts`
```ts
import type { BufferGeometry, Material, Object3D } from 'three/webgpu';

/** Free the GPU memory (geometry buffers, materials) held by an object and all of its children. */
export function disposeObject(root: Object3D): void {
  root.traverse((object) => {
    const drawable = object as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };
    drawable.geometry?.dispose();
    const { material } = drawable;
    if (Array.isArray(material)) {
      for (const item of material) item.dispose();
    } else {
      material?.dispose();
    }
  });
}
```

- [ ] **Step 2: Create the ring**

File: `src/regions/moonsink/ring.ts`
```ts
import {
  Color,
  EdgesGeometry,
  Group,
  LineBasicNodeMaterial,
  LineSegments,
  Mesh,
  MeshBasicNodeMaterial,
  OctahedronGeometry,
  TorusGeometry,
} from 'three/webgpu';
import { mulberry32 } from '../../shared/random';

/**
 * Centre of the ring in prototype space (see cameraPath.ts). Chosen so the moon (direction 0.148, 0.069, 0.987)
 * sits inside the ring when seen from the start of the camera path.
 */
const RING_CENTER = { x: 14, y: 16, z: 205 };
const RING_RADIUS = 42;

interface Shard {
  mesh: Mesh;
  spin: number;
  phase: number;
  baseY: number;
}

export function createRing() {
  const group = new Group();
  // Prototype space → Three.js: mirror x (same conversion as the camera)
  group.position.set(-RING_CENTER.x, RING_CENTER.y, RING_CENTER.z);
  group.rotation.set(0.05, Math.PI + 0.25, 0.1);

  // Unlit, near-black stone: a silhouette against the night horizon
  const stone = new MeshBasicNodeMaterial({ color: new Color(0x05090b) });
  const random = mulberry32(7);

  // Broken arcs: random lengths with random gaps, always the same thanks to the seed
  let angle = 0.2;
  while (angle < Math.PI * 2 - 0.3) {
    const arc = 0.6 + random() * 0.9;
    const piece = new Mesh(new TorusGeometry(RING_RADIUS, 1.8, 10, 48, arc), stone);
    piece.rotation.z = angle;
    group.add(piece);
    angle += arc + 0.12 + random() * 0.3;
  }

  // Values above 1 are "brighter than white": bloom (tier 2+) turns them into a glow
  const glow = new MeshBasicNodeMaterial({ color: new Color(0.5, 2.2, 2.6) });
  group.add(new Mesh(new TorusGeometry(RING_RADIUS - 3, 0.18, 6, 256), glow));

  const edgeGlow = new LineBasicNodeMaterial({ color: new Color(0.45, 1.6, 1.9) });
  const shards: Shard[] = [];
  for (let i = 0; i < 10; i++) {
    const geometry = new OctahedronGeometry(1.5 + random() * 3.5, 0);
    const mesh = new Mesh(geometry, stone);
    mesh.add(new LineSegments(new EdgesGeometry(geometry), edgeGlow));
    const around = random() * Math.PI * 2;
    const distance = RING_RADIUS + 8 + random() * 22;
    mesh.position.set(Math.cos(around) * distance, Math.sin(around) * distance * 0.7 + 4, (random() - 0.5) * 20);
    group.add(mesh);
    shards.push({ mesh, spin: 0.15 + random() * 0.35, phase: random() * Math.PI * 2, baseY: mesh.position.y });
  }

  return {
    group,
    update(timeSeconds: number, reducedMotion: boolean) {
      if (reducedMotion) return;
      for (const shard of shards) {
        shard.mesh.rotation.set(timeSeconds * shard.spin * 0.5, timeSeconds * shard.spin, 0);
        shard.mesh.position.y = shard.baseY + Math.sin(timeSeconds * shard.spin + shard.phase) * 1.5;
      }
      // A slow breathing pulse, never a flash (spec §10.1)
      glow.color.setRGB(0.5, 2.2, 2.6).multiplyScalar(0.85 + 0.15 * Math.sin(timeSeconds * 1.3));
    },
  };
}
```

- [ ] **Step 3: Type-check and lint**

```powershell
npm run check
npx tsc --noEmit
```
Expected: both pass.

- [ ] **Step 4: Commit**

```powershell
git add src/shared/dispose.ts src/regions/moonsink/ring.ts
git commit -m "feat: add broken resonance ring, shards and dispose helper"
```

**Walkthrough (for the owner):**
- **The `while` loop:** walks around the circle placing arcs of random length with random gaps. That's what makes the ring look broken rather than decorative.
- **`new Color(0.5, 2.2, 2.6)`:** colour channels above 1 are HDR. Without bloom they simply show as bright cyan; with bloom (tier 2+) they glow.
- **The pulse:** a gentle 0.85–1.0 breathing pulse. Spec §10.1 forbids flashing, and a slow sine wave is the safe way to add life.
- **`reducedMotion`:** shards stop moving entirely when you ask for less motion.
- **`disposeObject`:** GPU memory isn't freed automatically when JavaScript forgets an object, so regions must clean up explicitly.

**Check (owner):** `npx tsc --noEmit` passes. You'll see the ring in Task 11.

---

### Task 9: Renderer, region interface and the Moonsink region

**Concept:**
- **The renderer** creates `WebGPURenderer`, which uses WebGPU when the browser has it and falls back to WebGL2 automatically. It then builds a **RenderPipeline**: draw the scene into a texture (`pass`), optionally add **bloom** (a soft glow around HDR-bright pixels), and output to the screen.
- **The region interface** is the contract every region follows: build a scene and camera, `update` each frame from journey progress, `resize`, `applyTier`, `dispose`. Moonsink is the first region to implement it: sea + ring + the camera path from Task 6.

**Files:**
- Create: `src/render/renderer.ts`
- Create: `src/regions/region.ts`
- Create: `src/regions/moonsink/index.ts`

**Interfaces:**
- Consumes: `TierSettings`; `createSea`, `SeaUniforms`; `createRing`; camera path functions; `disposeObject`; `RegionId`
- Produces:
  - `interface MoonlitRenderer { renderer; backend: 'webgpu' | 'webgl2'; setView(scene, camera); applyTier(settings, devicePixelRatio); resize(width, height); render() }`
  - `createRenderer(container: HTMLElement, forceWebGL: boolean): Promise<MoonlitRenderer>`
  - `interface RegionContext { reducedMotion: boolean }`
  - `interface Region { id; scene; camera; update(local, timeSeconds, dtSeconds); resize(width, height); applyTier(settings); dispose() }`
  - `interface MoonsinkRegion extends Region { setEntered(entered: boolean): void; readonly seaUniforms: SeaUniforms }`
  - `createMoonsink(ctx: RegionContext): MoonsinkRegion`

- [ ] **Step 1: Create the renderer**

File: `src/render/renderer.ts`
```ts
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { pass } from 'three/tsl';
import type { Camera, Node, Scene } from 'three/webgpu';
import { NoToneMapping, RenderPipeline, WebGPURenderer } from 'three/webgpu';
import type { TierSettings } from '../quality/tiers';

export interface MoonlitRenderer {
  readonly renderer: WebGPURenderer;
  readonly backend: 'webgpu' | 'webgl2';
  /** Build the output graph for this scene (call once per scene/camera). */
  setView(scene: Scene, camera: Camera): void;
  applyTier(settings: TierSettings, devicePixelRatio: number): void;
  resize(width: number, height: number): void;
  render(): void;
}

/** Throws if neither WebGPU nor WebGL2 is available; boot.ts catches that and shows stills. */
export async function createRenderer(container: HTMLElement, forceWebGL: boolean): Promise<MoonlitRenderer> {
  const renderer = new WebGPURenderer({ antialias: false, forceWebGL });
  await renderer.init();
  // The sea shader applies the prototype's own tone curve; the pipeline only converts to sRGB.
  renderer.toneMapping = NoToneMapping;
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.append(renderer.domElement);

  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true ? 'webgpu' : 'webgl2';
  const pipeline = new RenderPipeline(renderer);

  let plainOutput: Node | null = null;
  let bloomOutput: Node | null = null;
  let bloomEnabled = false;

  const selectOutput = () => {
    const next = bloomEnabled ? bloomOutput : plainOutput;
    if (next === null) return;
    pipeline.outputNode = next;
    pipeline.needsUpdate = true;
  };

  return {
    renderer,
    backend,
    setView(scene, camera) {
      const scenePass = pass(scene, camera);
      const color = scenePass.getTextureNode('output');
      plainOutput = color;
      // Both graphs are built once; switching tiers just picks one (no rebuild, no leaks)
      bloomOutput = color.add(bloom(color, 0.45, 0.4, 0.6));
      selectOutput();
    },
    applyTier(settings, devicePixelRatio) {
      renderer.setPixelRatio(devicePixelRatio * settings.renderScale);
      if (settings.bloom !== bloomEnabled) {
        bloomEnabled = settings.bloom;
        selectOutput();
      }
    },
    resize(width, height) {
      renderer.setSize(width, height);
    },
    render() {
      pipeline.render();
    },
  };
}
```

- [ ] **Step 2: Create the region interface**

File: `src/regions/region.ts`
```ts
import type { PerspectiveCamera, Scene } from 'three/webgpu';
import type { RegionId } from '../journey/types';
import type { TierSettings } from '../quality/tiers';

/** Shared, mutable settings every region reads each frame. */
export interface RegionContext {
  reducedMotion: boolean;
}

/** Every region has the same shape, so the rest of the app never needs to know which one it is (spec §5.2). */
export interface Region {
  readonly id: RegionId;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** local = 0..1 through this region; timeSeconds drives shader animation. */
  update(local: number, timeSeconds: number, dtSeconds: number): void;
  resize(width: number, height: number): void;
  applyTier(settings: TierSettings): void;
  dispose(): void;
}
```

- [ ] **Step 3: Create the Moonsink region**

File: `src/regions/moonsink/index.ts`
```ts
import { PerspectiveCamera, Scene } from 'three/webgpu';
import type { TierSettings } from '../../quality/tiers';
import { disposeObject } from '../../shared/dispose';
import type { Region, RegionContext } from '../region';
import {
  approachPose,
  type CameraPose,
  fovForAspect,
  idlePose,
  MOONSINK_PATH,
  poseAt,
  reducedMotionTarget,
  SEA_FOV,
  toThreeCamera,
} from './cameraPath';
import { createRing } from './ring';
import { createSea, type SeaUniforms } from './sea';

export interface MoonsinkRegion extends Region {
  /** False while the title screen is up: the camera bobs on the open sea instead of following the scroll. */
  setEntered(entered: boolean): void;
  readonly seaUniforms: SeaUniforms;
}

export function createMoonsink(ctx: RegionContext): MoonsinkRegion {
  const scene = new Scene();
  const camera = new PerspectiveCamera(SEA_FOV, window.innerWidth / window.innerHeight, 0.1, 400);
  const sea = createSea();
  const ring = createRing();
  scene.add(sea.mesh, ring.group);

  let entered = false;
  let current: CameraPose = poseAt(MOONSINK_PATH, 0);

  const applyPose = (pose: CameraPose) => {
    const { position, rotation } = toThreeCamera(pose);
    camera.position.set(position[0], position[1], position[2]);
    camera.rotation.set(rotation[0], rotation[1], rotation[2], 'YXZ');
    sea.uniforms.yaw.value = pose.yaw;
  };
  applyPose(current);

  return {
    id: 'moonsink',
    scene,
    camera,
    seaUniforms: sea.uniforms,
    setEntered(value) {
      entered = value;
    },
    update(local, timeSeconds, dtSeconds) {
      sea.uniforms.time.value = timeSeconds;

      let target: CameraPose;
      if (!entered) target = idlePose(timeSeconds, ctx.reducedMotion);
      else if (ctx.reducedMotion) target = reducedMotionTarget(local);
      else target = poseAt(MOONSINK_PATH, local);

      // Reduced motion cuts straight to the viewpoint; otherwise the camera glides after the target
      current = ctx.reducedMotion ? target : approachPose(current, target, dtSeconds);
      applyPose(current);
      ring.update(timeSeconds, ctx.reducedMotion);
    },
    resize(width, height) {
      camera.aspect = width / height;
      camera.fov = fovForAspect(SEA_FOV, camera.aspect);
      camera.updateProjectionMatrix();
    },
    applyTier(settings: TierSettings) {
      sea.uniforms.marchSteps.value = settings.marchSteps;
      sea.uniforms.waveDetail.value = settings.waveDetail;
    },
    dispose() {
      disposeObject(scene);
    },
  };
}
```

- [ ] **Step 4: Type-check, lint and run unit tests**

```powershell
npm run check
npx tsc --noEmit
npm run test
```
Expected: all pass (no new unit tests; the existing ones still pass).

- [ ] **Step 5: Commit**

```powershell
git add src/render src/regions/region.ts src/regions/moonsink/index.ts
git commit -m "feat: add renderer pipeline, region interface and Moonsink region"
```

**Walkthrough (for the owner):**
- **`createRenderer`:**
  - `await renderer.init()` is where Three.js picks WebGPU or WebGL2.
  - `backend` records which one won, so tests and the HUD can report it.
- **Bloom:** both output graphs (plain and bloom) are built once in `setView`. Changing tier only swaps `pipeline.outputNode`, so nothing is rebuilt mid-scroll.
- **`Region`:** `update(local, …)` is the only way the outside world moves a region. Journey progress goes in, a picture comes out.
- **`createMoonsink`:** three camera modes.
  1. *Title screen (not entered):* a gentle bob.
  2. *Reduced motion:* cut between two viewpoints.
  3. *Normal:* the eased flight along the path.

**Check (owner):** `npx tsc --noEmit` passes. Open `src/regions/moonsink/index.ts`, find the three `target = …` lines, and match each to a camera mode above.

---

### Task 10: Page shell: title screen, sections, motion toggle, scroll

**Concept:** Everything a visitor *reads* is real HTML layered over the canvas (spec §3.2, §10). It's selectable, readable by screen readers, and still there if 3D fails.
- **Title screen (gate):** shows the glyph and your name, then a "Click to enter" button once the sea is ready.
- **Sections:** Intro and About, which fade in and out with the Web Animations API as the journey moves.
- **"Skip intro":** a link that is the very first thing the Tab key reaches.
- **Motion toggle:** lets anyone reduce motion even if they don't know their system setting.
- **Scroll:** a tall invisible **track** makes the page scrollable, and **Lenis** smooths wheel scrolling while touch stays native.

**Files:**
- Replace: `index.html`
- Create: `src/styles/overlay.css`
- Create: `src/overlay/gate.ts`, `src/overlay/sections.ts`, `src/overlay/motionToggle.ts`
- Create: `src/scroll/scroll.ts`

**Interfaces:**
- Consumes: `SectionId`; `MOTION_STORAGE_KEY`, `parseStoredMotion`, `resolveReducedMotion`; `progressFrom`, `clamp01`
- Produces:
  - DOM ids `skip-intro`, `world`, `gate`, `gate-enter`, `gate-status`, `content`, `intro`, `intro-title`, `about`, `about-title`, `motion-toggle`, `journey-track`
  - `type GateState = 'loading' | 'ready' | 'entered'`, `interface Gate { readonly state; setStatus(message); setReady(); enter(); onEnter(listener) }`, `createGate(root, button, status): Gate`
  - `interface Sections { show(id: SectionId): void }`, `createSections(root, isReducedMotion: () => boolean): Sections`
  - `createMotionToggle(button, onChange: (reduced: boolean) => void): { readonly reduced: boolean }`
  - `interface ScrollController { progress(); raf(nowMs); scrollToProgress(p, immediate); setLocked(locked); destroy() }`, `createScroll(): ScrollController`

- [ ] **Step 1: Replace `index.html`**

File: `index.html`
```html
<!doctype html>
<html lang="en" class="is-gated">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="description" content="Vaibhav Mann. A moonlit journey across the sea; portfolio in progress." />
    <meta name="theme-color" content="#020406" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Manrope:wght@400;500;600&display=swap"
    />
    <noscript>
      <style>
        html.is-gated { overflow: auto; }
        .gate { display: none; }
        .content { position: static; pointer-events: auto; }
        .section { position: static; opacity: 1; margin: 2rem 0; }
      </style>
    </noscript>
    <title>Vaibhav Mann</title>
  </head>
  <body>
    <svg class="sprite" aria-hidden="true" focusable="false">
      <symbol id="glyph" viewBox="0 0 64 64">
        <line x1="32" y1="4" x2="32" y2="60" stroke="currentColor" stroke-width=".8" opacity=".45" />
        <circle cx="32" cy="32" r="21" fill="none" stroke="currentColor" stroke-width="1.1" />
        <circle cx="32" cy="23" r="4.2" fill="currentColor" />
        <path d="M13 37 q4.75 -4 9.5 0 t9.5 0 t9.5 0 t9.5 0" fill="none" stroke="currentColor" stroke-width="1.2" />
        <path d="M17 43 q3.75 -3 7.5 0 t7.5 0 t7.5 0 t7.5 0" fill="none" stroke="currentColor" stroke-width="1" opacity=".55" />
      </symbol>
    </svg>

    <a class="skip-link" id="skip-intro" href="#about">Skip intro</a>

    <div class="world" id="world" aria-hidden="true"></div>

    <header class="gate" id="gate" data-state="loading">
      <svg class="gate__glyph" aria-hidden="true" focusable="false"><use href="#glyph" /></svg>
      <p class="gate__name">Vaibhav Mann</p>
      <p class="gate__status" id="gate-status" role="status">Tuning the tide…</p>
      <button class="gate__enter" id="gate-enter" type="button" disabled>Click to enter</button>
    </header>

    <main class="content" id="content">
      <section class="section" id="intro" data-section="intro" aria-labelledby="intro-title">
        <div class="section__panel">
          <h1 id="intro-title" tabindex="-1">Vaibhav Mann</h1>
          <p class="section__lede">Creative developer in the making. I build quiet, moonlit things for the web.</p>
          <p class="section__hint" aria-hidden="true">scroll to drift ashore</p>
        </div>
      </section>

      <section class="section" id="about" data-section="about" aria-labelledby="about-title">
        <div class="section__panel">
          <p class="section__region">Moonsink Shore</p>
          <h2 id="about-title" tabindex="-1">About</h2>
          <p>
            I'm learning to shape light, water and code into places you can scroll through. This site is my first
            project: a journey across three moonlit regions, built from scratch with Three.js and hand-written shaders.
          </p>
          <p>More regions, and the projects that live in them, are on their way.</p>
        </div>
      </section>
    </main>

    <nav class="controls" aria-label="Site controls">
      <button class="controls__button" id="motion-toggle" type="button" aria-pressed="false">Reduce motion</button>
    </nav>

    <div class="journey-track" id="journey-track" aria-hidden="true"></div>

    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create the overlay stylesheet**

File: `src/styles/overlay.css`
```css
.sprite {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

html.is-gated {
  overflow: hidden;
}

:focus-visible {
  outline: 2px solid var(--glow);
  outline-offset: 3px;
}

/* ---------- 3D world ---------- */
.world {
  position: fixed;
  inset: 0;
  z-index: 0;
}

.world canvas {
  display: block;
  width: 100%;
  height: 100%;
}

html.is-stills .world {
  background:
    radial-gradient(60vmax 40vmax at 62% 22%, rgba(159, 230, 238, 0.12), transparent 60%),
    linear-gradient(180deg, #03080b 0%, #061318 55%, #010203 100%);
}

.journey-track {
  height: calc(var(--journey-length, 3) * 100svh);
}

/* ---------- skip link ---------- */
.skip-link {
  position: fixed;
  top: max(1rem, env(safe-area-inset-top));
  left: max(1rem, env(safe-area-inset-left));
  z-index: 50;
  padding: 0.6rem 1rem;
  border-radius: 999px;
  background: var(--ink);
  color: #04161a;
  font-weight: 600;
  text-decoration: none;
  transform: translateY(-200%);
  transition: transform 0.2s ease;
}

.skip-link:focus-visible {
  transform: none;
}

/* ---------- title screen ---------- */
.gate {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.9rem;
  padding: 1.5rem;
  text-align: center;
  transition:
    opacity 1.2s ease,
    visibility 0s linear 1.2s;
}

.gate[data-state="entered"] {
  opacity: 0;
  visibility: hidden;
}

.gate__glyph {
  width: 4.5rem;
  height: 4.5rem;
  color: var(--ink);
  filter: drop-shadow(0 0 14px rgba(159, 230, 238, 0.5));
}

.gate__name {
  margin: 0;
  padding-left: 0.42em;
  font-family: var(--font-display);
  font-weight: 300;
  font-size: clamp(2rem, 6vw, 4.4rem);
  letter-spacing: 0.42em;
  text-shadow: 0 0 30px rgba(159, 230, 238, 0.35);
}

.gate__status {
  min-height: 1.5em;
  margin: 0;
  color: var(--ink-dim);
  font-size: 0.8rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}

.gate__enter {
  margin-top: 1.5rem;
  padding: 0.85rem 1.6rem;
  border: 1px solid rgba(159, 230, 238, 0.45);
  border-radius: 999px;
  background: rgba(2, 4, 6, 0.35);
  color: var(--ink);
  font: inherit;
  font-size: 0.85rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  cursor: pointer;
}

.gate__enter:disabled {
  opacity: 0.45;
  cursor: progress;
}

.gate[data-state="ready"] .gate__enter {
  animation: breathe 2.8s ease-in-out infinite;
}

@keyframes breathe {
  0%,
  100% {
    box-shadow: 0 0 0 rgba(159, 230, 238, 0);
  }
  50% {
    box-shadow: 0 0 24px rgba(159, 230, 238, 0.35);
  }
}

/* ---------- sections ---------- */
.content {
  position: fixed;
  inset: 0;
  z-index: 10;
  pointer-events: none;
}

.section {
  position: absolute;
  right: 0;
  bottom: max(12svh, env(safe-area-inset-bottom));
  left: 0;
  padding-inline: max(1.25rem, env(safe-area-inset-left)) max(1.25rem, env(safe-area-inset-right));
  opacity: 0;
}

.section.is-active {
  pointer-events: auto;
}

.section__panel {
  max-width: 36rem;
  padding: 1.5rem 1.75rem;
  border-radius: 1rem;
  /* A soft backdrop keeps text at 4.5:1 contrast even over the bright moon path (spec §10.4) */
  background: rgba(2, 4, 6, 0.6);
  backdrop-filter: blur(6px);
}

.section h1,
.section h2 {
  margin: 0 0 0.75rem;
  font-family: var(--font-display);
  font-weight: 300;
  line-height: 1.05;
}

.section h1 {
  font-size: clamp(2.4rem, 6vw, 4.5rem);
  letter-spacing: 0.06em;
}

.section h2 {
  font-size: clamp(2rem, 5vw, 3.5rem);
}

.section p {
  margin: 0 0 0.9rem;
  color: var(--ink-dim);
  font-size: clamp(1rem, 1.4vw, 1.1rem);
  line-height: 1.7;
}

.section .section__lede {
  color: var(--ink);
}

.section .section__region,
.section .section__hint {
  font-size: 0.75rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}

.section .section__region {
  color: var(--glow);
}

/* ---------- controls ---------- */
.controls {
  position: fixed;
  right: max(1rem, env(safe-area-inset-right));
  bottom: max(1rem, env(safe-area-inset-bottom));
  /* Above the title screen, so motion can be reduced before entering */
  z-index: 35;
}

.controls__button {
  padding: 0.55rem 0.9rem;
  border: 1px solid rgba(159, 230, 238, 0.3);
  border-radius: 999px;
  background: rgba(2, 4, 6, 0.7);
  color: var(--ink);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}

.controls__button[aria-pressed="true"] {
  border-color: var(--glow);
}

/* ---------- dev HUD (?hud) ---------- */
.hud {
  position: fixed;
  bottom: 0.75rem;
  left: 0.75rem;
  z-index: 40;
  padding: 0.5rem 0.7rem;
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.65);
  color: #cfeff0;
  font:
    12px / 1.5 ui-monospace,
    Consolas,
    monospace;
  white-space: pre;
  pointer-events: none;
}

/* ---------- reduced motion ---------- */
@media (prefers-reduced-motion: reduce) {
  .gate {
    transition: none;
  }
  .gate[data-state="ready"] .gate__enter {
    animation: none;
  }
}

html.is-reduced-motion .gate {
  transition: none;
}

html.is-reduced-motion .gate[data-state="ready"] .gate__enter {
  animation: none;
}
```

- [ ] **Step 3: Create the gate**

File: `src/overlay/gate.ts`
```ts
export type GateState = 'loading' | 'ready' | 'entered';

export interface Gate {
  readonly state: GateState;
  setStatus(message: string): void;
  setReady(): void;
  enter(): void;
  onEnter(listener: () => void): void;
}

/** The title screen. It never hides content from screen readers: sections stay in the DOM underneath. */
export function createGate(root: HTMLElement, button: HTMLButtonElement, status: HTMLElement): Gate {
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
    setStatus(message) {
      status.textContent = message;
    },
    setReady() {
      if (state !== 'loading') return;
      setState('ready');
      status.textContent = '';
      button.disabled = false;
    },
    enter() {
      if (state === 'entered') return;
      setState('entered');
      button.disabled = true;
      document.documentElement.classList.remove('is-gated');
      for (const listener of listeners) listener();
    },
    onEnter(listener) {
      listeners.push(listener);
    },
  };

  button.addEventListener('click', () => gate.enter());
  return gate;
}
```

- [ ] **Step 4: Create the sections**

File: `src/overlay/sections.ts`
```ts
import type { SectionId } from '../journey/types';

export interface Sections {
  show(id: SectionId): void;
}

/** Fades the active text section in and the previous one out (Web Animations API; instant with reduced motion). */
export function createSections(root: HTMLElement, isReducedMotion: () => boolean): Sections {
  const elements = new Map<string, HTMLElement>();
  for (const element of root.querySelectorAll<HTMLElement>('[data-section]')) {
    const id = element.dataset.section;
    if (id) elements.set(id, element);
  }

  let current: SectionId | null = null;

  const fade = (element: HTMLElement, visible: boolean) => {
    const reduced = isReducedMotion();
    const shift = reduced ? 'none' : visible ? 'translateY(16px)' : 'translateY(-12px)';
    const keyframes = visible
      ? [
          { opacity: 0, transform: shift },
          { opacity: 1, transform: 'none' },
        ]
      : [
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: shift },
        ];
    let duration = 500;
    if (reduced) duration = 0;
    else if (visible) duration = 900;

    element.classList.toggle('is-active', visible);
    for (const running of element.getAnimations()) running.cancel();
    const animation = element.animate(keyframes, {
      duration,
      easing: visible ? 'cubic-bezier(0.2, 0.8, 0.2, 1)' : 'ease-in',
      fill: 'forwards',
    });
    // Keep the final style, then drop the animation object so they don't pile up
    animation.onfinish = () => {
      animation.commitStyles();
      animation.cancel();
    };
  };

  return {
    show(id) {
      if (id === current) return;
      const previous = current === null ? undefined : elements.get(current);
      const next = elements.get(id);
      current = id;
      if (previous) fade(previous, false);
      if (next) fade(next, true);
    },
  };
}
```

- [ ] **Step 5: Create the motion toggle**

File: `src/overlay/motionToggle.ts`
```ts
import { MOTION_STORAGE_KEY, parseStoredMotion, resolveReducedMotion } from './motionPreference';

function readStored() {
  try {
    return parseStoredMotion(window.localStorage.getItem(MOTION_STORAGE_KEY));
  } catch {
    return null; // storage blocked (private mode): fall back to the system setting
  }
}

/** "Reduce motion" button: the visitor's choice wins over the OS setting and is remembered. */
export function createMotionToggle(
  button: HTMLButtonElement,
  onChange: (reduced: boolean) => void,
): { readonly reduced: boolean } {
  const system = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = resolveReducedMotion(system.matches, readStored());

  const apply = () => {
    button.setAttribute('aria-pressed', String(reduced));
    document.documentElement.classList.toggle('is-reduced-motion', reduced);
    onChange(reduced);
  };

  button.addEventListener('click', () => {
    reduced = !reduced;
    try {
      window.localStorage.setItem(MOTION_STORAGE_KEY, reduced ? 'reduced' : 'full');
    } catch {
      // storage blocked: the choice still applies for this visit
    }
    apply();
  });

  system.addEventListener('change', () => {
    if (readStored() !== null) return;
    reduced = system.matches;
    apply();
  });

  apply();
  return {
    get reduced() {
      return reduced;
    },
  };
}
```

- [ ] **Step 6: Create the scroll controller**

File: `src/scroll/scroll.ts`
```ts
import Lenis from 'lenis';
import { clamp01 } from '../shared/math';
import { progressFrom } from './progress';

export interface ScrollController {
  /** 0..1 of the journey track. */
  progress(): number;
  /** Advance Lenis's smoothing; called once per frame by the loop. */
  raf(nowMs: number): void;
  scrollToProgress(p: number, immediate: boolean): void;
  setLocked(locked: boolean): void;
  destroy(): void;
}

export function createScroll(): ScrollController {
  // Wheel/trackpad are smoothed; touch keeps the phone's native momentum (spec §8).
  // Lenis already disables smoothing for visitors whose OS asks for reduced motion.
  const lenis = new Lenis({ autoRaf: false, smoothWheel: true, syncTouch: false, lerp: 0.1 });

  return {
    progress: () => progressFrom(lenis.scroll, lenis.limit),
    raf: (nowMs) => lenis.raf(nowMs),
    scrollToProgress: (p, immediate) => lenis.scrollTo(clamp01(p) * lenis.limit, { immediate, force: true }),
    setLocked: (locked) => {
      if (locked) lenis.stop();
      else lenis.start();
    },
    destroy: () => lenis.destroy(),
  };
}
```

- [ ] **Step 7: Type-check and lint**

```powershell
npm run check
npx tsc --noEmit
```
Expected: both pass. (`index.html` now references elements that `main.ts` doesn't use yet; that's wired in Task 11.)

- [ ] **Step 8: Commit**

```powershell
git add index.html src/styles/overlay.css src/overlay src/scroll/scroll.ts
git commit -m "feat: add title screen, sections, motion toggle and smooth scroll"
```

**Walkthrough (for the owner):**
- **`index.html` order is reading order:** Skip intro → title screen → Intro → About → controls. Screen readers and the Tab key follow it.
- **`class="is-gated"`** on `<html>` locks scrolling until you enter.
- **`<noscript>`** makes everything readable without JavaScript.
- **CSS layers (`z-index`):** world 0 → sections 10 → title screen 30 → controls 35 (so "Reduce motion" works before entering) → HUD 40 → skip link 50.
- **`gate.ts`:** a tiny state machine (`loading → ready → entered`) that notifies listeners on enter.
- **`sections.ts`:** `show('about')` fades Intro out and About in. With reduced motion the duration is 0, so the change is instant.
- **`motionToggle.ts`:** `aria-pressed` tells screen readers whether reduced motion is on, and `localStorage` remembers the choice.
- **`scroll.ts`:** we call `lenis.raf()` ourselves from our single loop instead of letting Lenis run its own, which is spec rule #1 (one loop).

**Check (owner):** `npx tsc --noEmit` passes.

---

### Task 11: Boot, the one loop, HUD and dev panel: first light

**Concept:** This task wires every piece together and switches the world on. **Boot** runs once:
1. Read URL hooks and device hints.
2. Create the title screen, sections, motion toggle and scroll.
3. Create the renderer (or fall back to stills).
4. Build Moonsink, pick a tier, and **pre-compile the shaders while the title screen says "Tuning the tide…"**.
5. Enable "Click to enter".

**The loop** runs every frame:
1. scroll
2. `resolve(p)`
3. update the region
4. show the right section
5. render
6. let the governor adjust quality

`window.__moonlit` exposes a few read-only facts for tests and the HUD.

**Files:**
- Create: `src/app/capabilities.ts`, `src/app/debug.ts`, `src/app/loop.ts`, `src/app/boot.ts`
- Create: `src/dev/hud.ts`, `src/dev/gui.ts`
- Replace: `src/main.ts`, `src/styles/base.css`

**Interfaces:**
- Consumes: everything from Tasks 2–10
- Produces:
  - `detectCapabilities(): Capabilities` (`DeviceHints` + `reducedMotion`, `devicePixelRatio`)
  - `interface MoonlitDebug { backend: 'webgpu' | 'webgl2' | 'stills'; tier(); frames(); progress(); section(); reducedMotion() }`, `exposeDebug(debug)`
  - `interface Loop { start(renderer); stop(); isIdle(nowMs) }`, `createLoop(onFrame: (nowMs: number, dtSeconds: number) => void): Loop`
  - `createHud(parent: HTMLElement): Hud`
  - `createGui(bindings: GuiBindings): Promise<void>`
  - `boot(): Promise<void>`

- [ ] **Step 1: Device capabilities**

File: `src/app/capabilities.ts`
```ts
import type { DeviceHints } from '../quality/tiers';

export interface Capabilities extends DeviceHints {
  reducedMotion: boolean;
  /** Capped at 2: rendering phone screens at 3× costs a lot for little visible gain (spec §8). */
  devicePixelRatio: number;
}

type NavigatorHints = Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };

export function detectCapabilities(): Capabilities {
  const nav = navigator as NavigatorHints;
  return {
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    saveData: nav.connection?.saveData === true,
    deviceMemoryGB: nav.deviceMemory,
    // Only a hint; the renderer reports the backend it really got after init()
    webgpu: 'gpu' in navigator,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  };
}
```

- [ ] **Step 2: Debug handle for tests and the HUD**

File: `src/app/debug.ts`
```ts
export interface MoonlitDebug {
  backend: 'webgpu' | 'webgl2' | 'stills';
  tier(): number;
  frames(): number;
  progress(): number;
  section(): string;
  reducedMotion(): boolean;
}

declare global {
  interface Window {
    __moonlit?: MoonlitDebug;
  }
}

/** Read-only facts about the running site, used by Playwright tests. Nothing here can change the site. */
export function exposeDebug(debug: MoonlitDebug): void {
  window.__moonlit = debug;
}
```

- [ ] **Step 3: The loop**

File: `src/app/loop.ts`
```ts
import type { WebGPURenderer } from 'three/webgpu';
import { frameInterval, shouldRender } from './frameRate';

export interface Loop {
  start(renderer: WebGPURenderer): void;
  stop(): void;
  isIdle(nowMs: number): boolean;
}

const FPS = 60;
const IDLE_FPS = 30;
const IDLE_AFTER_MS = 8000;
const INPUT_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/** The single animation loop (spec §4.3 rule 1): 60 fps cap, 30 fps when idle, paused in hidden tabs. */
export function createLoop(onFrame: (nowMs: number, dtSeconds: number) => void): Loop {
  let renderer: WebGPURenderer | null = null;
  let lastFrame = -1;
  let lastInput = performance.now();

  const isIdle = (nowMs: number) => nowMs - lastInput > IDLE_AFTER_MS;

  const tick = (nowMs: number) => {
    if (!shouldRender(nowMs, lastFrame, frameInterval(isIdle(nowMs), FPS, IDLE_FPS))) return;
    const dtSeconds = lastFrame < 0 ? 1 / FPS : Math.min(0.1, (nowMs - lastFrame) / 1000);
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
    if (document.hidden) halt();
    else run();
  });

  return {
    start(next) {
      renderer = next;
      run();
    },
    stop: halt,
    isIdle,
  };
}
```

- [ ] **Step 4: The HUD (`?hud`)**

File: `src/dev/hud.ts`
```ts
import { percentile } from '../quality/governor';

export interface HudInfo {
  backend: string;
  tier: number;
  renderScale: number;
  progress: number;
}

export interface Hud {
  record(frameMs: number): void;
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
  let lastPaint = 0;

  return {
    record(frameMs) {
      frames.push(frameMs);
      if (frames.length > 240) frames.shift();
      if (frameMs > 25) dropped += 1;
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
        `progress  ${info.progress.toFixed(3)}`,
      ].join('\n');
    },
  };
}
```

- [ ] **Step 5: The dev panel (`?gui`, dev builds only)**

File: `src/dev/gui.ts`
```ts
import type { Tier } from '../quality/tiers';

export interface GuiBindings {
  getTier(): Tier;
  setTier(tier: Tier): void;
  seaUniforms: { marchSteps: { value: number }; waveDetail: { value: number } };
}

/** Live sliders for look-dev. Loaded with a dynamic import, so lil-gui never ships to visitors. */
export async function createGui(bindings: GuiBindings): Promise<void> {
  const { default: GUI } = await import('lil-gui');
  const gui = new GUI({ title: 'Moonsink (dev)' });
  const state = { tier: bindings.getTier() };
  gui
    .add(state, 'tier', [0, 1, 2, 3, 4])
    .name('quality tier')
    .onChange((value: number) => bindings.setTier(value as Tier));
  gui.add(bindings.seaUniforms.marchSteps, 'value', 16, 160, 1).name('march steps');
  gui.add(bindings.seaUniforms.waveDetail, 'value', 1, 10, 1).name('wave detail');
}
```

- [ ] **Step 6: Boot**

File: `src/app/boot.ts`
```ts
import { createHud } from '../dev/hud';
import { journey } from '../journey/journey.config';
import { progressForSection, resolve, totalLength } from '../journey/timeline';
import type { JourneyState } from '../journey/types';
import { createGate } from '../overlay/gate';
import { createMotionToggle } from '../overlay/motionToggle';
import { createSections } from '../overlay/sections';
import { Governor } from '../quality/governor';
import { bootTier, clampTier, TIERS, type Tier } from '../quality/tiers';
import { createMoonsink } from '../regions/moonsink';
import { createRenderer, type MoonlitRenderer } from '../render/renderer';
import { createScroll } from '../scroll/scroll';
import { detectCapabilities } from './capabilities';
import { exposeDebug } from './debug';
import { createLoop } from './loop';
import { readDebugParams } from './params';

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`#${id} is missing from index.html`);
  return element as T;
}

export async function boot(): Promise<void> {
  const params = readDebugParams(window.location.search);
  const caps = detectCapabilities();
  const ctx = { reducedMotion: caps.reducedMotion };
  const root = document.documentElement;

  byId('journey-track').style.setProperty('--journey-length', String(totalLength(journey)));

  // ---- HTML layer: works even if 3D never starts ----
  const gate = createGate(byId('gate'), byId<HTMLButtonElement>('gate-enter'), byId('gate-status'));
  const sections = createSections(byId('content'), () => ctx.reducedMotion);
  createMotionToggle(byId<HTMLButtonElement>('motion-toggle'), (reduced) => {
    ctx.reducedMotion = reduced;
  });
  const scroll = createScroll();
  scroll.setLocked(true);

  let p = params.p ?? 0;
  let state: JourneyState = resolve(p, journey);
  sections.show(state.section);

  gate.onEnter(() => {
    scroll.setLocked(false);
    byId('intro-title').focus({ preventScroll: true });
  });
  byId<HTMLAnchorElement>('skip-intro').addEventListener('click', (event) => {
    event.preventDefault();
    gate.enter();
    scroll.scrollToProgress(progressForSection(journey, 'about'), true);
    byId('about-title').focus({ preventScroll: true });
  });
  // Test hook: ?p=… jumps straight into the journey
  if (params.p !== undefined) gate.enter();

  const startStills = () => {
    root.classList.add('is-stills');
    exposeDebug({
      backend: 'stills',
      tier: () => 0,
      frames: () => 0,
      progress: () => p,
      section: () => state.section,
      reducedMotion: () => ctx.reducedMotion,
    });
    gate.setReady();
    const step = (nowMs: number) => {
      scroll.raf(nowMs);
      p = params.p ?? scroll.progress();
      state = resolve(p, journey);
      sections.show(state.section);
      window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  };

  if (params.stills) {
    startStills();
    return;
  }

  // ---- 3D layer ----
  let moonlit: MoonlitRenderer;
  try {
    moonlit = await createRenderer(byId('world'), params.forceWebGL);
  } catch (error) {
    console.warn('3D renderer unavailable; showing stills instead.', error);
    startStills();
    return;
  }

  const region = createMoonsink(ctx);
  gate.onEnter(() => region.setEntered(true));
  if (gate.state === 'entered') region.setEntered(true);
  moonlit.setView(region.scene, region.camera);
  region.resize(window.innerWidth, window.innerHeight);

  const webgpu = moonlit.backend === 'webgpu';
  let tier: Tier = params.tier !== undefined ? clampTier(params.tier, webgpu) : bootTier({ ...caps, webgpu });
  const applyTier = (next: Tier) => {
    tier = next;
    moonlit.applyTier(TIERS[next], caps.devicePixelRatio);
    region.applyTier(TIERS[next]);
  };
  applyTier(tier);
  let governor = new Governor(tier, webgpu);

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      moonlit.resize(window.innerWidth, window.innerHeight);
      region.resize(window.innerWidth, window.innerHeight);
    }, 150);
  });

  // Compile shaders behind the title screen so the first scroll never stutters
  await moonlit.renderer.compileAsync(region.scene, region.camera);
  gate.setReady();

  let enteredAt = gate.state === 'entered' ? performance.now() : Number.POSITIVE_INFINITY;
  gate.onEnter(() => {
    enteredAt = performance.now();
  });

  const hud = params.hud ? createHud(document.body) : null;
  let frames = 0;

  const loop = createLoop((nowMs, dtSeconds) => {
    scroll.raf(nowMs);
    p = params.p ?? scroll.progress();
    state = resolve(p, journey);
    const timeSeconds = params.time ?? nowMs / 1000;

    region.update(state.a.local, timeSeconds, dtSeconds);
    sections.show(state.section);
    moonlit.render();
    frames += 1;

    const frameMs = dtSeconds * 1000;
    hud?.record(frameMs);
    hud?.paint(nowMs, { backend: moonlit.backend, tier, renderScale: TIERS[tier].renderScale, progress: p });

    // Let the governor judge only real, warmed-up, non-idle frames
    const warmedUp = nowMs - enteredAt > 1500;
    if (params.tier === undefined && warmedUp && !loop.isIdle(nowMs)) {
      const next = governor.sample(frameMs, nowMs);
      if (next !== null) applyTier(next);
    }
  });

  exposeDebug({
    backend: moonlit.backend,
    tier: () => tier,
    frames: () => frames,
    progress: () => p,
    section: () => state.section,
    reducedMotion: () => ctx.reducedMotion,
  });
  loop.start(moonlit.renderer);

  if (import.meta.env.DEV && params.gui) {
    const { createGui } = await import('../dev/gui');
    await createGui({
      getTier: () => tier,
      setTier: (next) => {
        applyTier(next);
        governor = new Governor(next, webgpu);
      },
      seaUniforms: region.seaUniforms,
    });
  }
}
```

- [ ] **Step 7: Replace `src/styles/base.css` and `src/main.ts`**

File: `src/styles/base.css`
```css
:root {
  color-scheme: dark;
  --ink: #e6eef0;
  --ink-dim: rgba(230, 238, 240, 0.78);
  --glow: #9fe6ee;
  --night: #020406;
  --font-display: "Cormorant Garamond", "Iowan Old Style", Georgia, serif;
  --font-body: "Manrope", "Segoe UI", system-ui, sans-serif;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  background: var(--night);
  color: var(--ink);
  font-family: var(--font-body);
}
```

File: `src/main.ts`
```ts
import 'lenis/dist/lenis.css';
import './styles/base.css';
import './styles/overlay.css';
import { boot } from './app/boot';

boot().catch((error: unknown) => {
  // Something unexpected: keep the text readable rather than leaving a locked title screen
  console.error('Moonlit failed to start.', error);
  document.documentElement.classList.remove('is-gated');
  document.documentElement.classList.add('is-stills');
});
```

- [ ] **Step 8: Type-check, lint, unit tests, build, size**

```powershell
npm run check
npm run test
npm run build
npm run size
```
Expected:
- all pass
- `npm run size` reports about 257 KB against the limit set in Task 1 (the planning dry run measured 256.7 KB)

If the limit stayed at 250 KB (not approved), size **fails** here. Stop and ask the owner.

- [ ] **Step 9: First light (owner + Claude, manual)**

```powershell
npm run dev
```
Open each URL below and compare against demo 1 (`.superpowers/brainstorm/1915-1789294650/content/experience-demos.html`, mode A):

| URL | Expected |
|---|---|
| `http://localhost:5173/?hud&tier=1` | Title screen over dark sea, low moon, star field, drifting motes; HUD shows `backend webgpu` or `webgl2`, `tier 1`; after ~1–3 s the Enter button enables |
| (click **Click to enter**, then scroll) | Camera rises and turns toward the black shore, then back to the moon; Intro fades to About near the middle |
| `http://localhost:5173/?hud&tier=3` | The ring's inner edge and shard edges glow (bloom); composition identical to tier 1 |
| `http://localhost:5173/?webgl&hud` | HUD shows `webgl2`; picture looks the same |
| `http://localhost:5173/?gui` | lil-gui panel; changing tier or march steps updates live |
| `http://localhost:5173/?stills` | No canvas; dark gradient; text still works while scrolling |

Browser DevTools console must show **no errors** in every case.

- [ ] **Step 10: Commit**

```powershell
git add src index.html
git commit -m "feat: boot the Moonsink Shore journey with adaptive quality"
```

**Walkthrough (for the owner):**
- **`boot.ts` reads top to bottom as the story of a page load:**
  1. HTML layer first, so text and keyboard work even if 3D fails.
  2. Then the renderer inside `try`. On failure, `startStills()`.
  3. Then region, tier, resize, **compile**, "ready".
  4. Then the loop.
- **`gate.onEnter` is registered in three places, on purpose:** one unlocks scroll and moves focus, one starts the camera flight, and one starts the governor's warm-up timer.
- **The loop callback matches spec §5.3 line for line:** scroll → resolve → update → sections → render → HUD → governor.
- **`import.meta.env.DEV && params.gui`:** in production builds `DEV` is `false`, so Vite deletes this branch and lil-gui is never downloaded.
- **`window.__moonlit`:** lets tests ask "which backend? how many frames?" without reaching into internals.

**Check (owner):** you see the moonlit sea behind your name, can enter and scroll, and the HUD shows a backend and tier.

---

### Task 12: End-to-end and accessibility tests

**Concept:** Now that the site really runs, we lock its promises in with browser tests, in all three engines:
- it loads with no console errors and actually renders frames (or falls back to stills)
- the title screen works with the keyboard, and **Skip intro** is the first Tab stop
- scroll progress picks the right section
- reduced motion is honoured and the toggle is remembered
- **axe** finds no accessibility violations on the title screen or the About section

Automated browsers have no real GPU, so these tests prove *correctness*, never *smoothness*. That's Task 14's job.

**Files:**
- Create: `tests/e2e/helpers.ts`
- Replace: `tests/e2e/smoke.spec.ts`
- Create: `tests/e2e/gate.spec.ts`, `tests/e2e/sections.spec.ts`, `tests/e2e/reduced-motion.spec.ts`, `tests/e2e/a11y.spec.ts`

**Interfaces:**
- Consumes: DOM ids (Task 10), `window.__moonlit` (Task 11), `?p` / `?time` hooks (Task 5)
- Produces: `collectConsoleErrors(page): string[]`, `waitForMoonlit(page): Promise<void>`

- [ ] **Step 1: Test helpers**

File: `tests/e2e/helpers.ts`
```ts
import type { Page } from '@playwright/test';

/** Start collecting console errors and uncaught exceptions; read the array at the end of the test. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Wait until boot has published window.__moonlit (after shaders compile, or immediately in stills mode). */
export async function waitForMoonlit(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__moonlit !== undefined, undefined, { timeout: 90_000 });
}
```

- [ ] **Step 2: Smoke test**

File: `tests/e2e/smoke.spec.ts`
```ts
import { expect, test } from '@playwright/test';
import { collectConsoleErrors, waitForMoonlit } from './helpers';

test('title screen loads without console errors and the world renders', async ({ page }) => {
  // Two long waits below (shader compile, then first frames) can each take up to 90 s on a CPU-rendered CI browser
  test.setTimeout(200_000);
  const errors = collectConsoleErrors(page);
  await page.goto('/?time=4');

  await expect(page.locator('.gate__name')).toHaveText('Vaibhav Mann');
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
  await expect(page.getByRole('button', { name: 'Click to enter' })).toBeEnabled();
  expect(errors).toEqual([]);
});
```

- [ ] **Step 3: Title screen and keyboard**

File: `tests/e2e/gate.spec.ts`
```ts
import { expect, test } from '@playwright/test';

test('Enter opens the journey and moves focus to the heading', async ({ page }) => {
  await page.goto('/?time=4');
  const enter = page.getByRole('button', { name: 'Click to enter' });
  await expect(enter).toBeEnabled({ timeout: 90_000 });

  await enter.focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('#gate')).toHaveAttribute('data-state', 'entered');
  await expect(page.locator('#intro-title')).toBeFocused();
});

test('Skip intro is the first Tab stop and lands on About', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit only tabs to form controls by default, not links');
  await page.goto('/?time=4');

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip intro' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.locator('#about-title')).toBeFocused();
  await expect(page.locator('#about')).toHaveClass(/is-active/, { timeout: 90_000 });
});
```

- [ ] **Step 4: Sections follow progress**

File: `tests/e2e/sections.spec.ts`
```ts
import { expect, test } from '@playwright/test';

test('scroll progress decides which section is shown', async ({ page }) => {
  await page.goto('/?p=0.7&time=4');
  await expect(page.locator('#about')).toHaveClass(/is-active/, { timeout: 90_000 });
  await expect(page.locator('#intro')).not.toHaveClass(/is-active/);

  await page.goto('/?p=0&time=4');
  await expect(page.locator('#intro')).toHaveClass(/is-active/, { timeout: 90_000 });
});
```

- [ ] **Step 5: Reduced motion**

File: `tests/e2e/reduced-motion.spec.ts`
```ts
import { expect, test } from '@playwright/test';
import { waitForMoonlit } from './helpers';

// Motion preference is HTML/JS behaviour, so these tests run in stills mode: fast and deterministic even on CI
// machines that render WebGL on the CPU. The 3D path is covered by the smoke, gate and sections tests.
test.use({ reducedMotion: 'reduce' });

test('follows the operating-system reduced-motion setting', async ({ page }) => {
  await page.goto('/?stills');
  await waitForMoonlit(page);
  expect(await page.evaluate(() => window.__moonlit?.reducedMotion())).toBe(true);
  await expect(page.getByRole('button', { name: 'Reduce motion' })).toHaveAttribute('aria-pressed', 'true');
});

test('the toggle overrides the system setting and is remembered', async ({ page }) => {
  await page.goto('/?stills');
  await waitForMoonlit(page);

  const toggle = page.getByRole('button', { name: 'Reduce motion' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.__moonlit?.reducedMotion())).toBe(false);

  await page.reload();
  await waitForMoonlit(page);
  await expect(page.getByRole('button', { name: 'Reduce motion' })).toHaveAttribute('aria-pressed', 'false');
});
```

- [ ] **Step 6: Accessibility (axe)**

File: `tests/e2e/a11y.spec.ts`
```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// axe analyses the HTML (the canvas is aria-hidden). Stills mode gives it the same DOM without a CPU-rendered
// 3D scene starving the page, which made axe time out during the planning dry run.
test.describe('accessibility', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'axe results are browser-independent; run once');

  test('title screen has no axe violations', async ({ page }) => {
    await page.goto('/?stills');
    await expect(page.getByRole('button', { name: 'Click to enter' })).toBeEnabled();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('About section has no axe violations', async ({ page }) => {
    await page.goto('/?p=0.7&stills');
    await expect(page.locator('#about')).toHaveClass(/is-active/);
    // Let the fade-in finish so axe measures the final colours
    await page.waitForTimeout(1200);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
```

- [ ] **Step 7: Run everything**

```powershell
npm run check
npm run e2e
```
Expected: all tests pass. The Skip-intro test is reported as **skipped** in WebKit, and the axe tests are skipped outside Chromium. Some engines may run in stills mode headless; the tests accept that by design.

If an axe violation appears, fix the HTML/CSS it names (don't disable the rule), re-run, and mention the fix in the commit message.

- [ ] **Step 8: Commit**

```powershell
git add tests/e2e
git commit -m "test: cover title screen, sections, reduced motion and accessibility"
```

**Walkthrough (for the owner):**
- **`helpers.ts`:** `collectConsoleErrors` turns "no red errors in the console" into an assertion.
- **`toHaveClass(/is-active/)`:** checks what `sections.ts` does, not how it looks. That's robust against animation timing.
- **`test.use({ reducedMotion: 'reduce' })`:** makes the browser pretend your OS asked for less motion.
- **axe:** checks roughly 90 rules: contrast, labels, landmarks, heading order, focusable hidden elements. An empty `violations` list is the spec §10 promise, automated.
- **Why some tests skip:** WebKit's default Tab behaviour and axe's browser-independence are real, not shortcuts. Each skip says why in plain words.
- **Why the axe and reduced-motion tests use `?stills`:** they check HTML behaviour only. Test browsers draw WebGL on the CPU, which is slow enough to time these tests out. The real 3D path is still tested by the smoke, gate and sections tests.

**Check (owner):** `npm run e2e` finishes green; read the skip reasons in the output.

---

### Task 13: Pull request, CI, merge and deploy

**Concept:** The branch goes to GitHub as a **pull request (PR)**. CI runs every check on GitHub's machines. Once it's green and you've looked at the changes, merging to `main` deploys Phase 1 to the live site automatically (Phase 0's workflow).

**Files:**
- None

**Interfaces:**
- Consumes: the CI workflow (Phase 0 Task 7)
- Produces: Phase 1 live at https://vaibhavmannq.github.io/

- [ ] **Step 1: Final local gate**

```powershell
npm run check
npm run test
npm run build
npm run size
npm run e2e
```
Expected: all pass.

- [ ] **Step 2: Push the branch**

```powershell
git push -u origin phase-1-moonsink
```

- [ ] **Step 3: Open the PR (owner, in the browser)**

Open the link Git prints (or go to the repo and click **Compare & pull request**). Fill in:
- **Title:** `Phase 1: Moonsink Shore vertical slice`
- **Description:** a short summary of what the phase adds (sea, ring, title screen, sections, tiers, tests). No attribution or "generated with" lines.

- [ ] **Step 4: Wait for CI**

Expected: the `check` job goes green on the PR (the `deploy` job does not run for PRs).

If it fails, open the failed step's log, fix it on the branch, commit, and push again. CI re-runs automatically.

- [ ] **Step 5: Merge (owner)**

Click **Merge pull request**, then **Confirm**. Then locally:
```powershell
git checkout main
git pull
```

- [ ] **Step 6: Watch the deploy**

Actions tab: expected **CI & Deploy** on `main` with `check` then `deploy` green. Open https://vaibhavmannq.github.io/: expected the title screen over the moonlit sea.

**Walkthrough (for the owner):**
- **A PR is a proposal:** "here are my commits, please check them".
- **CI on the PR:** the same checks as on your laptop, on a clean Linux machine. It catches "works on my machine" problems.
- **Merging to `main`:** the only way anything reaches the live site.

**Check (owner):** the live site shows Phase 1, and the Actions run for `main` is green.

---

### Task 14: Real-device exit check and font decision

**Concept:** This is the moment spec §14 designed Phase 1 around: **is the ported sea smooth on a budget Android phone?** No automated test can answer that honestly, so we measure on real hardware with the HUD. We also make the typography decision the spec left open, while seeing it over the real scene.

**Files:**
- Modify: `docs/superpowers/specs/2026-09-13-moonlit-portfolio-design.md` (§3.3 typography line, §17 results)

**Interfaces:**
- Consumes: the live site with `?hud`
- Produces: a recorded pass/fail for the Phase 1 exit criteria; a final font decision

- [ ] **Step 1: Measure on each device (owner)**

On each device, open `https://vaibhavmannq.github.io/?hud` over HTTPS (needed for WebGPU; a LAN `http://` dev server would silently fall back to WebGL2). Then:
1. Wait for **Click to enter**, enter, and wait **20 seconds** without scrolling while the governor settles.
2. Note the HUD's `dropped` value.
3. Scroll slowly through the whole region to the end and back, **three times**.
4. Record the numbers in this table.

| Device | Browser | backend | settled tier | fps (p50) | p95 ms | dropped before → after scrolling |
|---|---|---|---|---|---|---|
| Budget Android (Mali/Adreno class) | Chrome | | | | | |
| Mid-range iPhone | Safari | | | | | |
| Old laptop, integrated GPU | Chrome | | | | | |
| Old laptop, integrated GPU | Firefox | | | | | |
| Desktop, discrete GPU | Chrome | | | | | |

Notes:
- iPhones in **Low Power Mode** are capped at 30 fps by iOS. Turn it off for this test.
- A phone that is already hot will throttle; test from cool.

- [ ] **Step 2: Judge the budget Android result against the exit criterion**

**Pass** means all three:
- fps p50 is 59–60
- p95 ≤ 20 ms
- `dropped` increases by **no more than 3** across the three scroll passes

**If it fails even at tier 0, stop here.** Don't start Phase 2. Tell the owner, and write a follow-up plan choosing from spec §15's mitigations:
- render the sea at half resolution and upscale
- or use a mesh-based sea at tier 0 with the same look

- [ ] **Step 3: Visual sign-off (owner)**

Compare the live site with demo 1 side by side. Confirm, or list differences to fix: sea darkness, moon position/size, star density, motes, the camera flight, and the faint horizon band (spec §17 S13).

- [ ] **Step 4: Font decision (owner)**

Look at the title screen and the About panel on your phone and desktop. Decide:
- **Keep** Cormorant Garamond (display) + Manrope (text), or
- **Replace** them: name the fonts. Claude then updates the Google Fonts `<link>` in `index.html` and `--font-display` / `--font-body` in `src/styles/base.css` on a new branch, and re-runs `npm run e2e` (axe contrast).

- [ ] **Step 5: Record the results in the spec**

Edit spec §3.3: replace the sentence starting "**Typography:** Cormorant Garamond (display) + Manrope (UI/body) are candidates" with the final decision and today's date.

Append a row to §17:

| S16 | Phase 1 device results: (paste the Step 1 table summary) | Real-device exit check |

- [ ] **Step 6: Commit and tag**

```powershell
git checkout -b phase-1-results
git add docs/superpowers/specs/2026-09-13-moonlit-portfolio-design.md
git commit -m "docs: record Phase 1 device results and font decision"
git push -u origin phase-1-results
```
Open and merge the PR as in Task 13, then:
```powershell
git checkout main
git pull
git tag -a v0.1.0 -m "Phase 1: Moonsink Shore"
git push origin v0.1.0
```

**Walkthrough (for the owner):**
- **p50 vs p95:** p50 is "typical", p95 is "the bad moments". Smoothness lives in p95.
- **Why 20 s of settling first:** the governor starts cautious on phones and climbs only after proving headroom. We measure the tier it *chose*, not the one it started on.
- **Why this gates Phase 2:** building two more regions on a sea that stutters on the phones most visitors use would just multiply the problem.

**Check (owner):** the table is filled in, the budget Android passed (or a follow-up plan exists), and the font is decided.

---

## Phase 1 exit criteria (spec §14)
- [ ] **Steady 60 fps on the budget Android phone** at its settled tier (Task 14 Step 2)
- [ ] Looks like demo 1: owner sign-off (Task 14 Step 3)
- [ ] axe clean on the title screen and About (Task 12)
- [ ] Keyboard: Skip intro first, Enter works, focus lands on headings (Task 12)
- [ ] Reduced motion honoured and toggle remembered (Task 12)
- [ ] Zero console errors on WebGPU, WebGL2 and stills paths (Tasks 11–12)
- [ ] CI green and deployed from `main`; tagged `v0.1.0`
- [ ] Font decision recorded in the spec
