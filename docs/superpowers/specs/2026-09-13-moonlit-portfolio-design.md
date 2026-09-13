# Moonlit Journey Portfolio: Design Spec

- **Date:** 2026-09-13
- **Status:** Draft, awaiting owner review
- **Owner:** vaibhavmannq
- **Site:** https://vaibhavmannq.github.io/ (repo `vaibhavmannq.github.io`)
- **Local folder:** `V:\Pdf\Project\my-portfolio`

---

## 1. Summary

A personal portfolio built as a **scroll-driven journey through three original night-time regions**. The mood is inspired by Wuthering Waves, but every asset is original. Visitors enter through a title screen over a dark moonlit sea, then scroll through **Moonsink Shore** (About), **Lumenreach** (Projects) and **Lastlight Isle** (Contact). Shader transitions join the regions seamlessly.

The owner has no projects yet. The site itself is the first showcase piece.

### Goals
- Reproduce the feeling of the first prototype: dark sea, low moon, glyph, title screen, smooth and controlled scrolling.
- Give the same experience on every device and run smoothly everywhere, **designed for budget phones first**, with extras on high-end devices.
- Make it accessible (keyboard, screen reader, reduced motion, flash-safe) and indexable (real HTML content).
- Make adding a project a one-file data change.
- Deploy automatically to GitHub Pages on every push to `main`.
- The owner should understand every part of the code (see §13).

### Non-goals (for now)
- Separate multi-page case studies (see §11 and the Astro trigger in §4.4).
- A CMS, backend, analytics or contact-form server.
- Music and hand-made 3D models before the core journey is finished (phases 5–6).

### Hard rules (IP)
- **No Wuthering Waves assets:** no screenshots, icons, logos, models, music or scene footage. Kuro Games owns them.
- **No game terminology on the site.** The word "Tacet" is never used; the transition is the **resonance ripple**.
- Crediting inspiration in the footer ("mood inspired by Wuthering Waves") is fine.
- Any third-party footage, fonts or audio must have a licence that is checked and recorded in `CREDITS.md`.

---

## 2. Decision log

| # | Decision | Alternatives rejected | Why |
|---|---|---|---|
| D1 | Scroll journey (title screen → regions) | Explorable free-roam shore; atmospheric editorial | Owner preferred it in demo 1; works with scroll on phones |
| D2 | Three regions, one per section, all original | Recreating in-game regions | IP; original work is stronger portfolio material |
| D3 | Region names: Moonsink Shore, Lumenreach, Lastlight Isle | Sound, poetic and invented-word name sets | Owner's choice: the moon ties the journey together |
| D4 | **All night**, each region with its own accent | Deepening night; free time of day; luminous/bright | The bright pass "felt worse"; demo 1's dark sea is the reference |
| D5 | **Three.js with `three/webgpu`** (WebGPURenderer, automatic WebGL2 fallback) + **TSL** shaders | React Three Fiber; 2.5D painted layers; Babylon.js; PlayCanvas; OGL; raw WebGPU | Real 3D travel; creative-web standard; TSL compiles to WGSL and GLSL; Three.js is TSL-first going forward |
| D6 | **Lenis** for wheel/trackpad smoothing only; native momentum on touch | GSAP ScrollSmoother (needs wrapper elements); native CSS scroll-driven animations (don't smooth, and Firefox stable still has them flagged) | Smallest option that keeps native scrolling and accessibility |
| D7 | **No GSAP.** Text uses the Web Animations API + CSS; add Motion (`motion`) only if a real need appears | GSAP (inherited from the inspiration repo) | Text follows the journey progress `p`, so ScrollTrigger isn't needed |
| D8 | **Vite** (not Astro) | Astro 7 | One-page WebGL experience; Astro only pays off with many content pages |
| D9 | No separate plain view; every device gets the journey | Minimal page; realistic video background; realistic photo | Owner rejected all three after seeing them |
| D10 | Same experience, adaptive cost; budget-phone first, extras on top | Same workload for everyone; pre-rendered video | Identical workload can't be smooth on both ends |
| D11 | GitHub Pages user site `vaibhavmannq.github.io` | Project page `/my-portfolio/` | Cleanest URL, base path `/` |
| D12 | Claude writes the code, and each task is explained to the owner | Owner writes the code | Owner's choice (§13) |

---

## 3. Experience design

### 3.1 Journey

| Stop | Region | Accent | On screen | Scene & camera | Scroll length* |
|---|---|---|---|---|---|
| 0 · Title screen | Moonsink Shore | cold teal, moon | Glyph, name, "click to enter", load progress | Dark sea, low moon, gentle drift | (fixed overlay) |
| 1 · Intro + About | **Moonsink Shore** | cold teal, black sand, moon path | Intro line, about text | Open sea → shoreline; broken resonance ring on the horizon, floating shards | 3 |
| transition | resonance ripple | cyan | "resonance shifting" caption (decorative) | Ripple dissolve from Moonsink to Lumenreach | 1 |
| 2 · Projects | **Lumenreach** | warm lanterns in the dark | Project entries (or a "still being lit" empty state) | Climb through a terraced lantern city toward a ring gate | 4 |
| transition | bell toll | pale gold / silver | none | A shockwave ring from the bell; brief chromatic offset, flash-safe | 1 |
| 3 · Contact | **Lastlight Isle** | silver stone, stars, canals | Links, email, "return to the shore" | Settle on the bell tower and the moon | 2 |

\*Measured in screen heights of scroll, and configurable in `journey.config.ts`.

### 3.2 Behaviour
- **Real HTML text** is layered over the canvas. It's selectable, indexable and readable by screen readers.
- **Project details** open in a native `<dialog>` over a dimmed scene. Deep links use `#/projects/:slug`; Back or Esc closes the dialog.
- **Navigation overlay:** glyph (back to top), region rail (buttons that travel to a region), a motion toggle, and later a sound toggle.
- **"Return to the shore"** at the end travels back to the top with a ripple.
- **Phones:** the same journey. Text stacks vertically, the camera's field of view widens in portrait so landmarks stay in frame, and touch scrolling is native.

### 3.3 Visual direction
- **Reference build:** `my-portfolio/.superpowers/brainstorm/1915-1789294650/content/experience-demos.html` (mode A). The sea shader, moon, motes and palette there are the baseline for Moonsink Shore.
- **Glyph:** the original SVG mark from the prototypes (circle, moon dot, two wave strokes, vertical line). It's the logo and favicon.
- **Typography:** Cormorant Garamond (display) + Manrope (UI/body) are candidates and **not yet final**. Decide during phase 1 with the real scene behind the text.
- **Glow sources:** only the moon, lanterns, the resonance ring and the transition effects. No bright hazy skies.

| Region | Palette | Landmarks (procedural first, hand-made in phase 5) |
|---|---|---|
| Moonsink Shore | near-black ink water, teal horizon mist, white-gold moon | black-sand shore with foam, leaning monoliths, broken resonance ring, floating shards, echo crystal with water ripples |
| Lumenreach | deep indigo night, warm amber windows and lanterns | terraced city on valley slopes, ring gate with hanging lanterns, tiered tower, river reflecting lights, rising lantern motes |
| Lastlight Isle | cold navy, silver stone, starfield | pale stone island city, arches, bell tower, canals reflecting stars, the moon overhead |

---

## 4. Architecture

### 4.1 Stack (versions checked 2026-09-13; pinned in `package.json`)

| Purpose | Package | Version |
|---|---|---|
| Runtime | Node LTS | 24.21.0 |
| Build / dev server | vite | 8.3.0 |
| Language | typescript | 7.0.2 |
| 3D rendering | three (`three/webgpu`, `three/tsl`) | 0.186.0 |
| Types | @types/three | 0.186.0 |
| Smooth scroll | lenis | 1.3.26 |
| Lint + format | @biomejs/biome | 2.5.13 |
| Unit tests | vitest | 5.0.0 |
| E2E tests | @playwright/test | 1.63.0 |
| Accessibility checks | @axe-core/playwright | 4.13.0 |
| Load budgets | @lhci/cli | 0.15.1 |
| Bundle budget | size-limit | 13.1.1 |
| Dev tweaking (dev only) | lil-gui | 0.21.0 |
| Model compression (phase 5) | @gltf-transform/cli | 4.5.0 |

### 4.2 Structure

```
index.html ─ title screen · section text · project dialog   (real HTML)
    │
 main.ts ─ boot: check device → pick quality tier → build Moonsink behind the title screen
    │
    ├─ Scroll (Lenis) ───────► progress p ∈ [0, 1]
    │                              │
    ├─ Journey timeline ◄──────────┘  resolve(p) → { a, b?, mix, effect?, section }
    │        │
    │        ├──► Director ─► regions/ moonsink · lumenreach · lastlight
    │        │                (Region interface: load · update · resize · setQuality · dispose)
    │        │
    │        └──► Overlay ─► text reveals · rail · URL hash · dialog
    │
    ├─ Renderer ─ WebGPURenderer (WebGL2 fallback)
    │             PostProcessing: pass(A) [+ pass(B)] → transition node → bloom node → output
    │
    ├─ Quality ─ boot tier + live frame-time watcher (changes cost, never composition)
    └─ content/ ─ site + projects as typed data
```

### 4.3 Principles
1. **One animation loop runs everything.** Each frame: scroll, then timeline, then update, then draw, then overlay. No other `requestAnimationFrame` loops.
2. **Scroll progress `p` is the single source of truth.** Camera, transitions and text all derive from it.
3. **Regions share one interface.** They can be added, replaced or reordered without touching the others.
4. **Only visible regions update and render.** The next region is built ahead of time; distant regions are disposed on low tiers.
5. **HTML for text, WebGPU/WebGL for the world.**
6. **Content is data.**
7. **Budget phone first.** Every feature is built and checked on the low tier before high-tier extras.

### 4.4 Astro trigger
Move to Astro, with the canvas kept as an island, **only if** individual project pages need their own URLs for search (hash routes aren't indexed). Content stays data, so the move is a re-host, not a rewrite.

---

## 5. Low-level design

### 5.1 Folders

```
my-portfolio/
├─ index.html
├─ public/                   stills/ (fallback frames) · og-image.jpg · favicon.svg · CNAME (optional)
├─ src/
│  ├─ main.ts
│  ├─ app/        boot.ts · loop.ts · capabilities.ts
│  ├─ scroll/     scroll.ts
│  ├─ journey/    journey.config.ts · timeline.ts
│  ├─ render/     renderer.ts · postprocessing.ts
│  ├─ transitions/ resonanceRipple.ts · bellToll.ts           (TSL node functions)
│  ├─ regions/    region.ts
│  │   ├─ moonsink/   index.ts · sea.ts · sky.ts · ring.ts · shards.ts
│  │   ├─ lumenreach/ index.ts · city.ts · gate.ts · lanterns.ts
│  │   └─ lastlight/  index.ts · tower.ts · canals.ts · stars.ts
│  ├─ shared/     tsl/ (noise, sky gradient) · objects/ (motes, ripples)
│  ├─ quality/    tiers.ts · governor.ts
│  ├─ overlay/    gate.ts · sections.ts · rail.ts · projectDialog.ts · router.ts · motionToggle.ts
│  ├─ content/    site.ts · projects.ts
│  ├─ dev/        hud.ts · gui.ts                              (tree-shaken from production)
│  └─ styles/     base.css · overlay.css
├─ assets-src/               Blender sources (phase 5; not shipped)
├─ tests/        unit/ · e2e/
├─ docs/superpowers/specs/   this document
├─ CREDITS.md
└─ .github/workflows/        ci.yml · deploy.yml
```

### 5.2 Core types

```ts
type RegionId = 'moonsink' | 'lumenreach' | 'lastlight';
type Tier = 0 | 1 | 2 | 3 | 4;              // 0 = lowest cost … 4 = high-end extras

interface RegionContext {
  renderer: WebGPURenderer;
  tier: Tier;
  reducedMotion: boolean;
}

interface Region {
  readonly id: RegionId;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  load(ctx: RegionContext): Promise<void>;                // build meshes; renderer.compileAsync(scene, camera)
  update(local: number, time: number, dt: number): void;  // local ∈ [0,1] within this region
  resize(width: number, height: number): void;
  setQuality(tier: Tier): void;
  dispose(): void;
}

type Segment =
  | { kind: 'region'; region: RegionId; length: number }
  | { kind: 'transition'; effect: 'resonanceRipple' | 'bellToll'; length: number };

type SectionId = 'intro' | 'about' | 'projects' | 'contact';

interface JourneyState {
  a: { region: RegionId; local: number };
  b?: { region: RegionId; local: number };   // present only during a transition
  mix: number;                               // 0 = all A, 1 = all B
  effect?: 'resonanceRipple' | 'bellToll';
  section: SectionId;
}

function resolve(p: number, journey: readonly Segment[]): JourneyState;  // pure
```

**`resolve` rules:**
- Total length L is the sum of segment lengths, and `p * L` is located inside a segment.
- Inside a region: `a.local` is the position within that region.
- Inside a transition: `a` is the previous region at `local = 1`, `b` is the next region at `local = 0`, and `mix` is the eased position. Both regions keep animating over time, so neither freezes.
- `section` comes from per-region anchors defined in `journey.config.ts`.
- `p` is clamped to [0, 1].

### 5.3 Frame sequence (`loop.ts`)
1. `lenis.raf(now)`, then `p = scroll.progress()` (falls back to `scrollY` if Lenis isn't loaded).
2. `state = resolve(p, journey)`
3. `director.ensure(state)`: loads the upcoming region if needed and disposes distant ones on low tiers.
4. `regionA.update(...)`, plus `regionB.update(...)` if `state.b` exists.
5. `postprocessing.render(state)`:
   - **No transition:** `pass(A)` → bloom (tier ≥ 2) → output.
   - **Transition:** `pass(A)` and `pass(B)` → transition node(`mix`, `time`) → bloom → output.
6. `overlay.update(state)`: text reveals (Web Animations API), rail position, `aria-current`.
7. `governor.sample(frameTime)`: may request `setQuality`, applied between frames.

### 5.4 Moonsink sea (port of demo 1)
- **What:** the prototype's height-field sea (ray marching, not a mesh), foam, wet sand, stars and moon, rewritten as **TSL** functions in `regions/moonsink/sea.ts`.
- **How it's drawn:** a full-screen background mesh with a `NodeMaterial`. `colorNode` holds the ray-marched colour, and `depthNode` writes the hit distance converted to depth, so 3D meshes (ring, shards, crystal) sink into the water correctly.
- **Camera:** rays are built from the Three.js camera's `projectionMatrixInverse` and `matrixWorld`, so the sea and meshes always line up.
- **Cost controls by tier:**
  - march steps: 48 at tier 0, up to 120 at tier 4
  - wave iterations: 4 up to 9
  - normal detail
  - star density
- **Known risk:** porting GLSL to TSL is the biggest unknown (§15). Phase 1 exists to retire that risk first.

### 5.5 Transitions
- Both are TSL functions that take (`texA`, `texB`, `mix`, `time`, `aspect`, `intensity`) and return a colour.
- **Resonance ripple:**
  - An expanding ring reveals B inside and keeps A outside.
  - The UVs wobble near the ring front.
  - A slight chromatic split sits on the ring.
  - Glitch bands are small, low-contrast and slow (§10.1).
- **Bell toll:**
  - A shockwave ring spreads from the bell's screen position.
  - A short-lived radial blur lies behind it.
  - B fades up behind it.
- **Reduced motion:** both become a plain 400 ms crossfade.

### 5.6 Quality tiers & governor

| Knob | Tier 0 | 1 | 2 | 3 | 4 (extras) |
|---|---|---|---|---|---|
| Render scale × min(devicePixelRatio, 2) | 0.5 | 0.6 | 0.75 | 0.9 | 1.0 |
| Sea march steps / wave iterations | 48 / 4 | 64 / 5 | 80 / 6 | 100 / 8 | 120 / 9 |
| Motes | 150 | 250 | 400 | 700 | 700 + GPU particles (WebGPU only) |
| Bloom | off | off | half-res | full-res | full-res |
| Light shafts / volumetric fog | off | off | off | light | full |
| Frame cap | 60 | 60 | 60 | 60 | 120 when headroom |

**Boot tier:** start at tier 1 on mobile or unknown devices and tier 2 on desktop. Drop one tier if the `Save-Data` header is on or device memory is ≤ 4 GB.

**Governor:**
- Every 1 s, compute the 95th-percentile frame time.
- **> 15 ms:** step down one tier.
- **< 11 ms for 3 consecutive windows:** step up one tier.
- After any change, wait 2 s before changing again (hysteresis).
- Never exceed tier 3 on WebGL2. Tier 4 requires WebGPU.
- **Invariant:** tiers never change camera paths, composition, content, timing or palette.

**Battery:**
- Hidden tab: stop rendering.
- Dialog open: 30 fps.
- No input for 8 s: 30 fps ambient, back to 60 immediately on any input.

### 5.7 Content model

```ts
interface SiteContent {
  name: string; tagline: string; about: string[];            // paragraphs
  links: { label: string; href: string }[];
  email?: string;
}
interface Project {
  slug: string;                       // unique, kebab-case, used in #/projects/:slug
  title: string; year: number; role: string;
  tools: string[]; summary: string;
  cover?: { src: string; alt: string };
  links?: { live?: string; repo?: string };
}
```
A unit test checks that slugs are unique, required fields are present, and every cover has alt text. With no projects, Lumenreach shows the "still being lit" state.

### 5.8 Loading sequence
1. HTML and inline critical CSS paint the title screen: glyph, name, "loading".
2. The module script loads, then `capabilities.ts` detects WebGPU or WebGL2, device pixel ratio, memory and reduced motion.
3. Create the renderer, then build Moonsink with `renderer.compileAsync` (shaders compile while the title screen is up).
4. The title screen shows **"click to enter"**. During idle time, build Lumenreach.
5. When `p` passes Lumenreach's midpoint, build Lastlight. On tiers 0–1, dispose Moonsink once `p` is past the first transition, and rebuild it if the visitor scrolls back.

---

## 6. Error handling & fallback chain

| Situation | Result |
|---|---|
| WebGPU available | WebGPU path |
| No WebGPU | WebGL2 fallback (automatic in `three/webgpu`); tier capped at 3 |
| No WebGL2, or renderer init fails | Stills mode: the same HTML over `public/stills/*` (frames captured from our own scenes), crossfaded per section |
| GPU device or context lost at runtime | Pause the loop, show stills, try to rebuild once. If that fails, stay in stills mode. |
| Region asset fails to load (phase 5+) | Use the procedural version; text never waits on it |
| Lenis fails to load | Native scroll; progress read from `scrollY` |
| JavaScript disabled | All content visible; `<noscript>` CSS still background |
| Uncaught error in the loop | Log it, switch to stills mode, keep the page usable |

---

## 7. Performance targets

| Metric | Target | Measured by |
|---|---|---|
| Frame pacing | Steady 60 fps; no dropped frames while scrolling, on the budget test phone | Dev HUD (p50/p95 frame time, dropped frames) on real devices |
| Frame budget | JS ≤ 4 ms, GPU ≤ ~10 ms, remainder spare | Chrome DevTools Performance |
| Scroll response | The scene responds on the next frame; Lenis easing ~0.3 s (tunable) | Manual + DevTools |
| Interaction (INP) | < 100 ms (Core Web Vitals "good" is ≤ 200 ms) | Lighthouse CI / DevTools |
| Title screen visible (LCP) | ≤ 1.5 s, mid-range phone on 4G | Lighthouse CI (mobile, throttled) |
| "Click to enter" ready | ≤ 3 s, mid-range phone | Custom mark in `boot.ts` |
| Layout shift (CLS) | 0 | Lighthouse CI |
| JS (phase 1–3) | ≤ 250 KB gzip total (Three.js alone is ~170 KB) | size-limit, fails CI |
| Other assets (phase 1–3) | ≤ 300 KB | Build report |
| GPU memory | ≤ ~250 MB; at most 2 regions alive on tiers 0–1 | Chrome `about:gpu` / Safari Web Inspector |

**Real-device matrix (manual, every phase):**
- budget Android (Mali or Adreno class) on Chrome
- mid-range iPhone on Safari
- old laptop with integrated graphics on Chrome + Firefox
- desktop with a discrete GPU on Chrome

**Known limits outside our control:**
- iOS Low Power Mode caps pages at 30 fps.
- Phones throttle when hot.
- Firefox Android and some older Android GPUs lack WebGPU, so they use WebGL2.

---

## 8. Responsive design
- **Breakpoints:** ≤ 640 px (phone), ≤ 1024 px (tablet), > 1024 px (desktop). All type uses `rem` and `clamp()`.
- **Portrait:** the camera's vertical FOV grows so the horizontal view covers the same key landmarks (moon, ring, gate, tower). Anchors are defined per region.
- **Screen changes:** resize and orientation changes are debounced (150 ms) and trigger `resize` on the renderer, regions and post-processing. `env(safe-area-inset-*)` is respected.
- **Touch:** Lenis `syncTouch` is off, so touch uses native momentum. Wheel and trackpad use Lenis smoothing.

---

## 9. Browser & device support

| Support level | Browsers / devices (as of 2026-09) | Rendering path |
|---|---|---|
| Full, WebGPU | Chrome / Edge 113+ desktop · Chrome 121+ on Android 12+ · Safari 26+ (macOS, iOS, iPadOS) · Firefox 141+ Windows · Firefox 145+ macOS (Apple Silicon) | WebGPU, tiers 0–4 |
| Full, WebGL2 fallback | Firefox on Android and Linux · Safari 15–18 · Android GPUs without WebGPU drivers | WebGL2, tiers 0–3 |
| Stills mode | Browsers without WebGL2, or with the GPU blocklisted | §6 |

- **Minimum layout width:** 320 px.
- **Same content everywhere:** every support level shows the same content and navigation. Only the scenery rendering differs (§6).

---

## 10. Accessibility

### 10.1 Motion, comfort, flashing
- **Camera:** turn speed is capped per scroll step; no roll.
- **Reduced motion:** `prefers-reduced-motion`, **plus** an in-page motion toggle stored in `localStorage`. When on:
  - camera cuts or crossfades between viewpoints
  - sea drift slows
  - no ripple distortion, glitch or flash
  - transitions become 400 ms crossfades
- **Flashing (WCAG 2.3.1), for everyone:**
  - no more than 3 flashes in any second
  - glitch bands limited to small, low-contrast areas with slow flicker
  - transition glow ramps up gradually, never strobes
- **Cursor:** the system cursor is never hidden.

### 10.2 Keyboard
- **"Skip intro"** is the first focusable element; Enter or Space opens the title screen.
- Native keyboard scrolling works.
- Rail items are buttons with `aria-current`.
- Visible focus ring on every interactive element.
- **Project dialog:** native `<dialog>`, focus moves in, Esc closes, focus returns to the element that opened it.

### 10.3 Screen readers
- Canvas: `aria-hidden="true"`.
- Headings: `h1` name, `h2` About / Projects / Contact; region names are subtitles.
- The title screen is a visual overlay only. Content is always in the DOM.
- Project covers require alt text (enforced by test).
- `lang="en"`.

### 10.4 Readability
- Text contrast ≥ 4.5:1 at the brightest frame behind it (moon path). Soft backdrops are used where needed.
- Works at 200% zoom without clipping.

### 10.5 Sound (phase 6)
- Off by default, never autoplays, visible toggle, preference remembered.

---

## 11. SEO & sharing
- Real HTML content, `<title>`, meta description, canonical URL `https://vaibhavmannq.github.io/`.
- Open Graph and Twitter card image: a still of Moonsink Shore (`public/og-image.jpg`, 1200×630).
- `sitemap.xml`, `robots.txt`, and JSON-LD `Person` (name, url, sameAs: GitHub/LinkedIn).
- **Limit:** `#/projects/:slug` isn't indexed by search engines (see the Astro trigger in §4.4).

---

## 12. Tooling, testing, CI/CD, deployment

### 12.1 Scripts

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server with HMR; `?hud` and `?gui` available |
| `npm run build` | `tsc --noEmit`, then `vite build` |
| `npm run preview` | Serve `dist/` locally |
| `npm run check` | `biome check .` (lint + format check) |
| `npm run test` | Vitest unit tests |
| `npm run e2e` | Playwright (Chromium, WebKit, Firefox) + axe |
| `npm run size` | size-limit budget check |

### 12.2 Dev & test hooks (query string)
- `?hud`: frame-time overlay
- `?gui`: lil-gui panel (dev builds only)
- `?p=0.35`: freeze scroll progress
- `?time=0`: freeze shader time
- `?tier=0..4`: force a tier
- `?stills`: force stills mode

### 12.3 Tests

| Layer | Tool | Cases |
|---|---|---|
| Unit | Vitest | `resolve()` boundaries (0, 1, segment edges, transitions); governor step-down/step-up/hysteresis; router parse and serialise; content schema |
| E2E smoke | Playwright | Loads with no console errors; title screen opens by click and by keyboard; scrolling reaches Contact; deep link opens dialog; Esc closes and returns focus |
| Reduced motion | Playwright `reducedMotion: 'reduce'` | No camera flight; transitions are crossfades |
| Accessibility | @axe-core/playwright | No violations on the title screen, each section, and the open dialog |
| Visual | Playwright screenshots at `?p=…&time=0&tier=1` | Catches black screens and broken shaders (loose thresholds; software GPU) |
| Load budgets | Lighthouse CI + size-limit | §7 targets; fails CI when exceeded |
| Smoothness | **Manual real-device checklist** | Automated browsers have no real GPU, so smoothness is never claimed from CI |

### 12.4 GitHub Actions
- **`ci.yml`** (pull requests and pushes):
  - `actions/checkout@v7`, then `actions/setup-node@v7` (Node 24, npm cache)
  - `npm ci`, `npm run check`, `npm run build`, `npm run test`
  - Playwright install, `npm run e2e`, `npm run size`
- **`deploy.yml`** (push to `main`, after the CI job passes):
  - the same build
  - `actions/configure-pages@v6`, then `actions/upload-pages-artifact@v5` (`dist/`), then `actions/deploy-pages@v5`
  - permissions: `pages: write`, `id-token: write`
- **Vite `base`:** `/` (user site).

### 12.5 GitHub Pages limits
- No custom HTTP headers, so short cache TTL and no custom security headers. Hashed filenames keep deploys safe.
- gzip only, no Brotli.
- Soft limits: ~1 GB site size, ~100 GB/month bandwidth.
- Custom domain possible later via `public/CNAME`; HTTPS is automatic.

### 12.6 Git
- The repo lives in `my-portfolio/`, and the remote becomes `github.com/vaibhavmannq/vaibhavmannq.github.io` in phase 0.
- `.gitignore`: `node_modules/`, `dist/`, `.superpowers/`, `test-results/`, `playwright-report/`, `.lighthouseci/`.
- Feature branches merge into `main`. `main` is always deployable.

---

## 13. Working model (how the owner learns)
- **Claude writes the code.** The owner reads it, runs it and understands it.
- Each phase starts with an **implementation plan** (writing-plans skill) of small tasks. Every task includes:
  1. **Concept:** what problem this solves and the idea behind it, in plain language.
  2. **Code:** written by Claude, with comments explaining *why*, not *what*.
  3. **Walkthrough:** a short tour of the new code: which file, which function, how data flows, what to look at in the browser.
  4. **Check:** a command or browser action the owner runs to see it working, plus the expected result.
- After each phase:
  - a short recap: what was built, key concepts, where to read more
  - the owner can ask about anything before the next phase starts
- Claude reports test and device results honestly, including failures and anything it couldn't verify.

---

## 14. Roadmap

| Phase | Scope | Owner learns | Exit criteria |
|---|---|---|---|
| **0 · Foundations** | Repo + GitHub remote, Vite + TS, Biome, Vitest, Playwright skeleton, CI + deploy, "hello moon" page with glyph | Git, npm, Vite, TypeScript basics, GitHub Actions | Live at https://vaibhavmannq.github.io/ from a push to `main`; CI green |
| **1 · Moonsink Shore (vertical slice)** | Title screen, loop, Lenis, journey timeline (single region), WebGPURenderer + fallback, **demo-1 sea ported to TSL** with depth, moon, ring, shards, motes, About text, tiers + governor + HUD, reduced motion + toggle, keyboard basics, font decision | Render loop, TSL/shaders, cameras, scroll mapping, performance measurement | **Steady 60 fps on the budget Android phone** at its settled tier; looks like demo 1; axe clean for this section |
| **2 · Lumenreach + transitions** | Post-processing pipeline, resonance ripple (flash-safe), Lumenreach scene, projects data, dialog + hash router, lazy build/dispose, "still being lit" state | Render targets / passes, TSL node composition, data-driven UI, routing | Ripple smooth on the budget phone; deep links + keyboard dialog pass e2e |
| **3 · Lastlight Isle + core complete** | Lastlight scene, bell-toll transition, Contact, stills fallback capture, SEO/OG/JSON-LD, full a11y pass | Accessibility, SEO, fallbacks | axe clean everywhere; NVDA + VoiceOver manual pass; Lighthouse budgets met |
| **4 · High-end extras** | GPU particles (WebGPU compute), light shafts / volumetric fog, 120 fps when there's headroom | Compute shaders, adaptive quality | Tier 4 visibly richer; tiers 0–1 unchanged and still smooth |
| **5 · Hand-made structures** | Blender → glTF → gltf-transform (meshopt, KTX2) pipeline; replace procedural landmarks; LODs per tier | 3D asset pipeline | Asset budgets met; procedural fallback still works |
| **6 · Music & ambience** | Original or licensed loops, Web Audio, sound toggle, `CREDITS.md` | Web Audio | Off by default, no autoplay, licences recorded |
| **Ongoing** | Add real projects | — | One edit to `content/projects.ts` per project |

---

## 15. Risks & open questions

| Risk / question | Impact | Mitigation / when decided |
|---|---|---|
| GLSL → TSL port of the ray-marched sea is harder than expected, or slower on WebGL2 | High | Phase 1 does it first. If blocked, keep the sea as a raw WGSL/GLSL fragment via Three's node escape hatches, and reassess |
| Ray-marched sea too heavy for budget GPUs even at tier 0 | High | Tier 0 march/iteration limits; half-res sea + upscale; worst case a mesh-based sea at tier 0 with the same look |
| Firefox Android / older GPUs lack WebGPU | Medium | Automatic WebGL2 fallback; tier cap 3; tested in the device matrix |
| `three/webgpu` bundle (renderer + node system + both backends) may exceed the ~170 KB gzip figure measured for classic Three.js, breaking the 250 KB JS budget | Medium | Measure in phase 0 with size-limit; import only the TSL nodes used; if still over, raise the budget with owner sign-off rather than silently |
| TSL has fewer learning resources than GLSL | Medium | Walkthroughs in each task (§13); link official Three.js TSL examples |
| Final typography | Low | Decide in phase 1 against the real scene |
| Lumenreach / Lastlight look not yet prototyped in the chosen dark mood | Medium | Quick in-engine look-dev at the start of phases 2 and 3; owner signs off before building |
| Hash routes not indexed | Low | Astro trigger (§4.4) |
| Biome lacks a needed rule/plugin | Low | Swap to ESLint 10 + Prettier 3 if it happens |
| Third-party asset licences (fonts, audio) | Medium | `CREDITS.md` with licence per asset; no unlicensed assets merged |

---

## 16. Appendix

### 16.1 Prototype references (throwaway, not shipped)
- `.superpowers/brainstorm/1915-1789294650/content/experience-demos.html`: **demo 1, the visual reference** (mode A scroll journey)
- `.superpowers/brainstorm/2020-1789296706/content/approach-demos.html`: approach comparison (Three.js / R3F / 2.5D) and the ripple transition prototype
- `.superpowers/brainstorm/2020-1789296706/content/plain-view-demos.html`: rejected plain views

### 16.2 Research sources (2026-09-13)
- WebGPU in all major browsers: https://web.dev/blog/webgpu-supported-major-browsers
- WebGPU implementation status: https://github.com/gpuweb/gpuweb/wiki/Implementation-Status
- Three.js in 2026 (WebGPU, TSL): https://www.utsubo.com/blog/threejs-2026-what-changed
- Three.js WebGPU migration: https://www.utsubo.com/blog/webgpu-threejs-migration-guide
- Three.js post-processing in 2026: https://threejsroadmap.com/blog/the-complete-guide-to-threejs-post-processing-in-2026
- Three.js vs Babylon.js vs PlayCanvas: https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison
- CSS scroll-driven animations support: https://cydstumpel.nl/start-using-scroll-driven-animations-today/
- Smooth scroll libraries compared: https://www.borndigital.be/blog/our-smooth-scrolling-libraries
- GSAP vs Motion: https://motion.dev/docs/gsap-vs-motion
- Motion vanilla API: https://motion.dev/docs/quick-start
- Static site generators 2026: https://thesoftwarescout.com/best-static-site-generators-2026-astro-next-js-hugo-more/
