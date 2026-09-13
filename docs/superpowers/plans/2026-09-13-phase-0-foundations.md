# Phase 0 · Foundations: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tiny "hello moon" page, built with Vite + TypeScript, checked by Biome, Vitest, Playwright and a bundle budget, and deployed automatically to https://vaibhavmannq.github.io/ on every push to `main`.

**Architecture:** A static site. Vite builds `index.html` + `src/` into `dist/`, and one GitHub Actions workflow runs every check before uploading `dist/` to GitHub Pages. No 3D yet. This phase only proves the pipeline works end to end, so Phase 1 can focus on the scene.

**Tech Stack:** Node 24 LTS · npm · Vite 8.3.0 · TypeScript 7.0.2 · Biome 2.5.13 · Vitest 5.0.0 · Playwright 1.63.0 · size-limit 13.1.1 · GitHub Actions (`checkout@v7`, `setup-node@v7`, `upload-pages-artifact@v5`, `configure-pages@v6`, `deploy-pages@v5`)

**Spec:** `docs/superpowers/specs/2026-09-13-moonlit-portfolio-design.md` (§4.1 stack, §12 tooling/CI, §13 working model, §14 roadmap)

## Global Constraints

- Node **24 LTS** everywhere (`.nvmrc` = `24`; CI reads it).
- Dependency versions are **exact** (no `^`): vite 8.3.0, typescript 7.0.2, @biomejs/biome 2.5.13, vitest 5.0.0, @playwright/test 1.63.0, size-limit 13.1.1, @size-limit/file 13.1.1.
- Vite `base` is `/` (GitHub Pages user site `vaibhavmannq.github.io`).
- Line endings are LF in the repo (`.gitattributes`).
- **IP:** no Wuthering Waves assets or terminology anywhere (spec §1).
- Git identity for this repo: `Vaibhav Mann <93813535+vaibhavmannq@users.noreply.github.com>` (already set locally).
- Every commit message ends with the attribution trailer lines required by the executing session.
- Commands are written to work in **PowerShell** (the owner's shell): one command per line, no `&&` chaining in the terminal (inside `package.json` scripts `&&` is fine).
- **Working model (spec §13):** Claude writes the code. Every task ends with a **Walkthrough** (plain-language tour for the owner) and a **Check** the owner can run.

## File map (end of Phase 0)

| File | Responsibility |
|---|---|
| `.nvmrc` | Pins Node 24 for local and CI |
| `.gitattributes` | Forces LF line endings in the repo |
| `package.json` / `package-lock.json` | Scripts + exact dev dependencies |
| `tsconfig.json` | TypeScript settings (type-check only; Vite does the bundling) |
| `vite.config.ts` | Build settings (`base: '/'`) |
| `vitest.config.ts` | Where unit tests live |
| `playwright.config.ts` | Browsers + local preview server for end-to-end tests |
| `biome.json` | Lint + format rules |
| `.size-limit.json` | JavaScript size budget |
| `index.html` | The page: glyph, name, one line of text |
| `public/favicon.svg` | Glyph favicon |
| `src/main.ts` | Entry point (loads CSS for now) |
| `src/styles/base.css` | Colours, fonts, hello layout |
| `src/shared/math.ts` | `clamp01`, `lerp`, `smoothstep` (used heavily in Phase 1) |
| `tests/unit/math.test.ts` | Unit tests for the math helpers |
| `tests/e2e/smoke.spec.ts` | "Page loads, heading visible, no console errors" |
| `.github/workflows/ci.yml` | Checks on every push/PR; deploy job on `main` |

---

### Task 1: Node 24 toolchain + repo hygiene

**Concept:** Every tool in this project (Vite 8, Vitest 5, size-limit 13) needs a recent Node. Your machine has Node 22.16, and size-limit requires ≥ 22.18, so we move to Node 24 LTS, the version CI will use too. Pinning it in `.nvmrc` means "works on my machine" and "works on CI" are the same machine as far as Node is concerned. `.gitattributes` stops Windows from turning line endings into CRLF inside the repo, which would otherwise make the Linux CI and Biome disagree with your files.

**Files:**
- Create: `.nvmrc`
- Create: `.gitattributes`

**Interfaces:**
- Consumes: nothing
- Produces: Node 24 on PATH; LF line endings for every later file

- [ ] **Step 1: Install Node 24 LTS (owner runs this)**

Run in PowerShell:
```powershell
winget install --id OpenJS.NodeJS.LTS --exact
```
Close and reopen the terminal (PATH only refreshes in new terminals).

- [ ] **Step 2: Verify the version**

Run:
```powershell
node -v
npm -v
```
Expected: `node -v` prints `v24.` followed by any patch (for example `v24.21.0`). If it still prints `v22.16.0`, the old install is first on PATH. Uninstall Node 22 from *Settings → Apps*, then reopen the terminal.

- [ ] **Step 3: Create `.nvmrc`**

File: `.nvmrc`
```text
24
```

- [ ] **Step 4: Create `.gitattributes`**

File: `.gitattributes`
```text
# Store text files with LF endings in the repo, whatever the OS
* text=auto eol=lf

# Binary assets
*.png binary
*.jpg binary
*.webp binary
*.glb binary
*.ktx2 binary
```

- [ ] **Step 5: Re-normalise the files already committed**

Run:
```powershell
git add --renormalize .
git status --short
```
Expected: `.gitattributes`, `.nvmrc`, and possibly the spec file listed as changed. No other files.

- [ ] **Step 6: Commit**

```powershell
git add .nvmrc .gitattributes docs
git commit -m "chore: pin Node 24 and normalise line endings"
```

**Walkthrough (for the owner):** `.nvmrc` is a one-line file that tools like GitHub's `setup-node` action read to pick the Node version. `.gitattributes` tells git "store text files with LF". Windows editors still show them normally. Nothing here changes how the site looks. It removes two whole classes of "it broke on CI but not on my laptop" problems.

**Check (owner):** `node -v` shows v24.x, and `git log --oneline -1` shows the commit.

---

### Task 2: Vite + TypeScript scaffold with the "hello moon" page

**Concept:** **Vite** is the development server and the builder. `npm run dev` serves the page with instant reloads, and `npm run build` produces the optimised `dist/` folder that GitHub Pages will host. **TypeScript** adds types to JavaScript so mistakes show up before the browser runs the code. Vite strips the types when bundling, and `tsc --noEmit` checks them without producing files. We also create the very first version of the site: a dark page with the glyph and your name.

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `public/favicon.svg`, `src/main.ts`, `src/styles/base.css`
- Modify: `.gitignore` (already ignores `node_modules/` and `dist/`; no change needed)

**Interfaces:**
- Consumes: Node 24 (Task 1)
- Produces: scripts `dev`, `build`, `preview` (port 4173), `check`, `format`, `test`, `e2e`, `size`, used by every later task and by CI

- [ ] **Step 1: Create `package.json`**

File: `package.json`
```json
{
  "name": "vaibhavmannq.github.io",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "engines": {
    "node": ">=24.0.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --port 4173 --strictPort",
    "check": "biome check .",
    "format": "biome check --write .",
    "test": "vitest run",
    "e2e": "playwright test",
    "size": "size-limit"
  },
  "devDependencies": {
    "@biomejs/biome": "2.5.13",
    "@playwright/test": "1.63.0",
    "@size-limit/file": "13.1.1",
    "size-limit": "13.1.1",
    "typescript": "7.0.2",
    "vite": "8.3.0",
    "vitest": "5.0.0"
  }
}
```

- [ ] **Step 2: Install the exact versions**

Run:
```powershell
npm install
```
Expected: `added N packages`, a new `package-lock.json`, and no `EBADENGINE` warnings (those would mean Node isn't 24).

- [ ] **Step 3: Create `tsconfig.json`**

File: `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests/unit"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

File: `vite.config.ts`
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  // User site (vaibhavmannq.github.io) is served from the domain root
  base: '/',
  build: {
    target: 'es2023',
    sourcemap: true,
  },
});
```

- [ ] **Step 5: Create the favicon**

File: `public/favicon.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <title>Vaibhav Mann</title>
  <rect width="64" height="64" rx="14" fill="#020406"/>
  <g fill="none" stroke="#e6eef0" stroke-linecap="round">
    <circle cx="32" cy="32" r="21" stroke-width="3"/>
    <path d="M13 37 q4.75 -4 9.5 0 t9.5 0 t9.5 0 t9.5 0" stroke-width="3"/>
  </g>
  <circle cx="32" cy="23" r="5" fill="#9fe6ee"/>
</svg>
```

- [ ] **Step 6: Create `index.html`**

File: `index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="description" content="Vaibhav Mann. A moonlit journey across the sea, under construction." />
    <meta name="theme-color" content="#020406" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>Vaibhav Mann</title>
  </head>
  <body>
    <main class="hello">
      <svg class="glyph" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <line x1="32" y1="4" x2="32" y2="60" stroke="currentColor" stroke-width=".8" opacity=".45" />
        <circle cx="32" cy="32" r="21" fill="none" stroke="currentColor" stroke-width="1.1" />
        <circle cx="32" cy="23" r="4.2" fill="currentColor" />
        <path d="M13 37 q4.75 -4 9.5 0 t9.5 0 t9.5 0 t9.5 0" fill="none" stroke="currentColor" stroke-width="1.2" />
        <path d="M17 43 q3.75 -3 7.5 0 t7.5 0 t7.5 0 t7.5 0" fill="none" stroke="currentColor" stroke-width="1" opacity=".55" />
      </svg>
      <h1>Vaibhav Mann</h1>
      <p>A moonlit journey is being built here.</p>
    </main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 7: Create the stylesheet**

File: `src/styles/base.css`
```css
:root {
  color-scheme: dark;
  --ink: #e6eef0;
  --ink-dim: rgba(230, 238, 240, 0.72);
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

body {
  min-height: 100svh;
}

.hello {
  min-height: 100svh;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.75rem;
  text-align: center;
  padding: max(1.5rem, env(safe-area-inset-top)) 1.5rem;
}

.glyph {
  width: 4.5rem;
  height: 4.5rem;
  color: var(--ink);
  filter: drop-shadow(0 0 14px rgba(159, 230, 238, 0.45));
}

.hello h1 {
  margin: 0.5rem 0 0;
  padding-left: 0.3em;
  font-family: var(--font-display);
  font-weight: 300;
  font-size: clamp(2.2rem, 7vw, 4.5rem);
  letter-spacing: 0.3em;
}

.hello p {
  margin: 0;
  color: var(--ink-dim);
  letter-spacing: 0.08em;
}
```

- [ ] **Step 8: Create the entry point**

File: `src/main.ts`
```ts
import './styles/base.css';
```

- [ ] **Step 9: Build and confirm**

Run:
```powershell
npm run build
```
Expected: no TypeScript errors, and Vite prints `dist/index.html` plus `dist/assets/…css` and `…js` files with `✓ built in …`.

- [ ] **Step 10: Look at it**

Run:
```powershell
npm run dev
```
Open the printed `http://localhost:5173/`. Expected: black page, glowing glyph, "V A I B H A V  M A N N", and the line of text. Stop the server with `Ctrl+C`.

- [ ] **Step 11: Commit**

```powershell
git add package.json package-lock.json tsconfig.json vite.config.ts index.html public src
git commit -m "feat: scaffold Vite + TypeScript hello moon page"
```

**Walkthrough (for the owner):**
- **`package.json`:** the project's ID card. `scripts` are shortcuts: `npm run build` really runs `tsc --noEmit && vite build`, meaning "check types, and if that passes, bundle".
- **`index.html`:** the page itself. The glyph is inline SVG, so it renders with no extra download, and `aria-hidden` tells screen readers it's decoration.
- **`src/main.ts`:** just imports the CSS for now. Vite sees that import and bundles the stylesheet.
- **`tsconfig.json`:** `strict: true` turns on TypeScript's full checking. `noEmit` means TypeScript only checks and Vite does the building.
- **`vite.config.ts`:** `base: '/'` because your site lives at the root of `vaibhavmannq.github.io`.

**Check (owner):** `npm run dev` shows the page. `npm run build` finishes without errors.

---

### Task 3: Biome (lint + format)

**Concept:** **Linting** catches suspicious code, like unused variables or accidental `==`. **Formatting** makes every file look the same so diffs only show real changes. Biome does both in one fast tool, and CI runs `biome check` so badly formatted or suspicious code can't reach `main`.

**Files:**
- Create: `biome.json`

**Interfaces:**
- Consumes: `check` / `format` scripts (Task 2)
- Produces: a lint + format gate used by CI (Task 7)

- [ ] **Step 1: Create `biome.json`**

File: `biome.json`
```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 120
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single"
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "preset": "recommended"
    }
  },
  "assist": {
    "enabled": true,
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  }
}
```

- [ ] **Step 2: Format everything once**

Run:
```powershell
npm run format
```
Expected: `Checked N files … Fixed M files` (M can be 0).

- [ ] **Step 3: Confirm the gate passes**

Run:
```powershell
npm run check
```
Expected: `Checked N files in …ms. No fixes applied.` and exit code 0.

- [ ] **Step 4: Prove the gate catches problems (then undo)**

Temporarily add this line to the end of `src/main.ts`:
```ts
const unused = 1;
```
Run `npm run check`. Expected: FAIL with `lint/correctness/noUnusedVariables`. Remove the line again and re-run `npm run check`; expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add biome.json
git commit -m "chore: add Biome lint and format"
```

**Walkthrough (for the owner):**
- **`"preset": "recommended"`:** turns on Biome's curated rule set. (The older `"recommended": true` form is deprecated in Biome 2.5.)
- **`useIgnoreFile`:** Biome skips whatever `.gitignore` skips (`node_modules`, `dist`, `.superpowers`).
- **`npm run format`:** fixes what it can.
- **`npm run check`:** only reports, and CI uses that.

**Check (owner):** `npm run check` passes. Step 4 showed it fails on bad code.

---

### Task 4: Vitest + math helpers (first test-driven code)

**Concept:** **Unit tests** are small programs that call your functions with known inputs and check the outputs. We write the test **first**, watch it fail, then write the code to make it pass. That's *test-driven development*, and it proves the test actually tests something. These three helpers (`clamp01`, `lerp`, `smoothstep`) run every frame in Phase 1, where camera movement, transitions and text fades are all built from them.

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/unit/math.test.ts`
- Create: `src/shared/math.ts`

**Interfaces:**
- Consumes: `test` script (Task 2)
- Produces: `clamp01(x: number): number`, `lerp(a: number, b: number, t: number): number`, `smoothstep(edge0: number, edge1: number, x: number): number` from `src/shared/math.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

File: `vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 2: Write the failing tests**

File: `tests/unit/math.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { clamp01, lerp, smoothstep } from '../../src/shared/math';

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
});
```

- [ ] **Step 3: Run the tests and watch them fail**

Run:
```powershell
npm run test
```
Expected: FAIL. Vitest can't resolve `../../src/shared/math` because the file doesn't exist yet.

- [ ] **Step 4: Write the implementation**

File: `src/shared/math.ts`
```ts
/** Clamp a number into the 0..1 range. */
export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Linear blend: t = 0 gives a, t = 1 gives b. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Hermite ease between two edges: 0 before edge0, 1 after edge1, smooth in between. */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
```

- [ ] **Step 5: Run the tests and watch them pass**

Run:
```powershell
npm run test
```
Expected: PASS, `Test Files 1 passed`, `Tests 5 passed`.

- [ ] **Step 6: Commit**

```powershell
npm run check
git add vitest.config.ts tests/unit/math.test.ts src/shared/math.ts
git commit -m "feat: add math helpers with unit tests"
```

**Walkthrough (for the owner):**
- **`clamp01`:** keeps a value between 0 and 1, like scroll progress.
- **`lerp`:** "go this far between A and B". The camera uses it to move between path points.
- **`smoothstep`:** like `lerp`'s progress, but it starts and ends gently instead of snapping. It's why motion in the prototype felt calm.
- **The tests read like sentences:** `describe` names the function, `it` names one behaviour, and `expect(…).toBe(…)` is the actual check.

**Check (owner):** `npm run test` shows 5 passing tests. Break one number in `math.ts`, re-run to see which test catches it, then undo.

---

### Task 5: Playwright end-to-end smoke test

**Concept:** Unit tests check functions. **End-to-end tests** open a real browser, load the real built site and act like a visitor. This first one checks that the page loads, the heading is visible, and the browser console logged no errors. Across the three engines (Chromium, Firefox, WebKit, which is Safari's engine) it's the test that would have caught the black-screen bugs we hit during brainstorming.

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: `build` and `preview` scripts (Task 2), `public/favicon.svg` (Task 2; a missing favicon logs a 404 console error)
- Produces: `npm run e2e`, used by CI (Task 7) and extended in Phase 1

- [ ] **Step 1: Install the browsers (one-time, owner machine)**

Run:
```powershell
npx playwright install
```
Expected: downloads Chromium, Firefox and WebKit (a few hundred MB).

- [ ] **Step 2: Create `playwright.config.ts`**

File: `playwright.config.ts`
```ts
import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'tests/e2e',
  // Headless browsers render WebGL on the CPU; compiling the Phase 1 sea alone can take ~20 s there
  timeout: 120_000,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  // Tests always run against the production build, never the dev server.
  // CI already builds in an earlier workflow step, so skip rebuilding here.
  webServer: {
    command: isCI ? 'npm run preview' : 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

- [ ] **Step 3: Write the smoke test**

File: `tests/e2e/smoke.spec.ts`
```ts
import { expect, test } from '@playwright/test';

test('home page loads with its heading and no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Vaibhav Mann' })).toBeVisible();
  expect(errors).toEqual([]);
});
```

- [ ] **Step 4: Run it**

Run:
```powershell
npm run e2e
```
Expected: `3 passed` (one per browser).

- [ ] **Step 5: Prove it catches a broken page (then undo)**

Temporarily change the `<h1>` text in `index.html` to `Vaibhav`. Run `npm run e2e`. Expected: FAIL in all three browsers (heading not found). Restore `Vaibhav Mann` and re-run; expected: `3 passed`.

- [ ] **Step 6: Commit**

```powershell
npm run check
git add playwright.config.ts tests/e2e/smoke.spec.ts
git commit -m "test: add Playwright smoke test across three browsers"
```

**Walkthrough (for the owner):**
- **`webServer`:** Playwright builds the site and starts `vite preview` by itself, so tests run against the same files GitHub Pages will serve.
- **`getByRole('heading', { level: 1 })`:** finds the element the way a screen reader would. That way the test also nudges us toward accessible HTML.
- **Console listeners:** collect any red errors. The test fails if there are any.
- **`isCI`:** on GitHub, failures retry once and are reported inline on the pull request.

**Check (owner):** `npm run e2e` prints `3 passed`.

---

### Task 6: JavaScript size budget

**Concept:** Every kilobyte of JavaScript costs download time and CPU time on a budget phone. A **budget** turns "keep it light" into a rule the build enforces: if the gzipped JavaScript grows past the limit, CI fails and we must decide deliberately. Phase 0's page is tiny. The limit matters in Phase 1, when Three.js arrives. During planning, Three.js + WebGPU renderer + bloom + the sea measured **254.3 KB gzipped** (spec §15), and Phase 1 will ask you to approve the final limit.

**Files:**
- Create: `.size-limit.json`

**Interfaces:**
- Consumes: `build` / `size` scripts (Task 2)
- Produces: a size gate used by CI (Task 7)

- [ ] **Step 1: Create the budget**

File: `.size-limit.json`
```json
[
  {
    "name": "JavaScript (all chunks, gzip)",
    "path": "dist/assets/*.js",
    "limit": "250 KB",
    "gzip": true
  }
]
```

- [ ] **Step 2: Build and measure**

Run:
```powershell
npm run build
npm run size
```
Expected: a report showing `Size` well under `250 KB` (a few hundred bytes to ~1 KB for this page) and exit code 0.

- [ ] **Step 3: Prove the gate works (then undo)**

Temporarily change `"limit": "250 KB"` to `"limit": "10 B"`. Run `npm run size`. Expected: FAIL, `Package size limit has exceeded`. Restore `"250 KB"`.

- [ ] **Step 4: Commit**

```powershell
npm run check
git add .size-limit.json
git commit -m "chore: add JavaScript size budget"
```

**Walkthrough (for the owner):**
- **`path`:** covers every bundled JS file Vite produces.
- **`gzip: true`:** measures the compressed size, which is roughly what visitors download.
- **The limit is a deliberate number.** We raise it only on purpose, never by accident.

**Check (owner):** `npm run size` prints the current size and passes.

---

### Task 7: CI and deployment workflow

**Concept:** **GitHub Actions** runs scripts on GitHub's servers whenever you push. Our workflow has two jobs:
1. **`check`** runs on every push and pull request. It installs exactly what's in `package-lock.json`, then runs lint, unit tests, build, size and end-to-end tests.
2. **`deploy`** runs only for pushes to `main`, and only if `check` passed. It publishes `dist/` to GitHub Pages.

So a broken build can never reach the live site.

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `.nvmrc` (Task 1), scripts `check`/`test`/`build`/`size`/`e2e` (Tasks 2–6)
- Produces: automatic deploys to https://vaibhavmannq.github.io/ (activated in Task 8)

- [ ] **Step 1: Create the workflow**

File: `.github/workflows/ci.yml`
```yaml
name: CI & Deploy

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Set up Node from .nvmrc
        uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm

      - name: Install exact dependencies
        run: npm ci

      - name: Lint and format check
        run: npm run check

      - name: Unit tests
        run: npm run test

      - name: Type-check and build
        run: npm run build

      - name: JavaScript size budget
        run: npm run size

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: End-to-end tests
        run: npm run e2e

      - name: Upload Playwright results
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v7
        with:
          name: playwright-results
          path: |
            test-results/
            playwright-report/
          retention-days: 7
          if-no-files-found: ignore

      - name: Upload site for GitHub Pages
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: check
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    concurrency:
      group: pages
      cancel-in-progress: false
    steps:
      - name: Configure Pages
        uses: actions/configure-pages@v6

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 2: Run every CI command locally, in CI order**

Run:
```powershell
npm ci
npm run check
npm run test
npm run build
npm run size
npm run e2e
```
Expected: each command exits successfully (the same results as Tasks 3–6).

- [ ] **Step 3: Commit**

```powershell
git add .github/workflows/ci.yml
git commit -m "ci: add check and GitHub Pages deploy workflow"
```

**Walkthrough (for the owner):**
- **`on:`** lists when the workflow runs: pushes to `main`, any pull request, or a manual button.
- **`npm ci` vs `npm install`:** `ci` installs *exactly* the lockfile and fails if it's out of date. That keeps reproducible builds honest.
- **The deploy job's `if:`** means pull requests are checked but never deployed.
- **`concurrency: pages`:** two deploys never overlap. The `ci-${{ github.ref }}` group cancels an outdated check run when you push again quickly on a branch or PR — but `cancel-in-progress` is `false` for `refs/heads/main`, so a push to `main` never cancels a run that's already mid-deploy; it queues behind it instead.
- **`playwright-results` artifact:** the "Upload Playwright results" step always runs (unless the job was cancelled) and uploads `test-results/` (traces, screenshots) and `playwright-report/` (the HTML report) so a failed e2e run can be diagnosed after the fact. Download it from the workflow run's summary page in the Actions tab, under "Artifacts".
- **Why one file:** the spec listed separate `ci.yml`/`deploy.yml`. One workflow with two jobs gives the same guarantee (deploy only after checks pass) without cross-workflow plumbing, as recorded in spec §17.

**Check (owner):** open `.github/workflows/ci.yml` and find the `needs: check` line. That's the guarantee.

---

### Task 8: GitHub repository, first push, live site

**Concept:** The repository name `vaibhavmannq.github.io` is special: GitHub serves it at the root of your personal Pages domain. We create the empty repo, connect your local folder to it (a **remote**), push, and tell Pages to publish whatever the workflow uploads.

**Files:**
- None (repository and settings only)

**Interfaces:**
- Consumes: the workflow (Task 7)
- Produces: https://vaibhavmannq.github.io/ serving the hello moon page; `origin` remote used by all later phases

- [ ] **Step 1: Create the repository (owner, in the browser)**

Go to https://github.com/new and fill in:
- **Repository name:** `vaibhavmannq.github.io`
- **Visibility:** Public (GitHub Pages on free accounts needs public repos)
- **Do not** add a README, .gitignore or licence (the local repo already has history)

Click **Create repository**.

- [ ] **Step 2: Select GitHub Actions as the Pages source (owner, in the browser)**

In the new repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

- [ ] **Step 3: Connect and push**

Run:
```powershell
git remote add origin https://github.com/vaibhavmannq/vaibhavmannq.github.io.git
git push -u origin main
```
Expected: Git Credential Manager opens a browser sign-in the first time. Then `branch 'main' set up to track 'origin/main'`.

- [ ] **Step 4: Watch the workflow**

Open https://github.com/vaibhavmannq/vaibhavmannq.github.io/actions. Expected: a **CI & Deploy** run with `check` and then `deploy` both green (the first run takes several minutes while Playwright browsers install).

If `deploy` fails with a message about Pages not being enabled, Step 2 didn't save. Repeat it, then click **Re-run failed jobs**.

- [ ] **Step 5: Visit the live site**

Open https://vaibhavmannq.github.io/. Expected: the same glyph + name page as `npm run dev`. (The first deploy can take a minute or two to appear.)

- [ ] **Step 6: Tag the phase**

```powershell
git tag -a v0.0.1 -m "Phase 0: foundations live"
git push origin v0.0.1
```

**Walkthrough (for the owner):**
- **`origin`:** the conventional name for "the GitHub copy" of your repo.
- **`git push -u origin main`:** uploads your commits and remembers the link, so later pushes are just `git push`.
- **The Pages "Source: GitHub Actions" setting:** tells GitHub to publish the artifact our `deploy` job uploads, instead of looking for a branch.
- **Tags:** bookmarks in history. `v0.0.1` marks the moment the pipeline first worked.

**Check (owner):** https://vaibhavmannq.github.io/ loads the page, and the Actions tab shows a green run.

---

## Phase 0 exit criteria (spec §14)
- [ ] https://vaibhavmannq.github.io/ is live and was deployed by a push to `main`
- [ ] The latest CI run is green (lint, unit, build, size, e2e in three browsers)
- [ ] The owner can explain what `npm run check`, `test`, `build`, `size` and `e2e` each do
