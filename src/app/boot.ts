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
import { createLoop, type Loop } from './loop';
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

  // GPU context loss (driver reset, GPU switch, tab recovering from a crash): stop the loop and
  // fall back to stills so the page stays usable. `loop` is assigned further down, once it
  // exists; rebuild/retry is deliberately out of scope for Phase 1 (spec §6 only asks for a
  // graceful fallback, not recovery).
  let loop: Loop | undefined;
  let contextLost = false;
  const handleContextLoss = (reason: unknown) => {
    if (contextLost) return;
    contextLost = true;
    console.warn('GPU context lost; showing stills instead.', reason);
    loop?.stop();
    moonlit.renderer.domElement.remove();
    startStills();
  };
  moonlit.renderer.domElement.addEventListener('webglcontextlost', () => handleContextLoss('webglcontextlost'), {
    passive: true,
  });
  // WebGPU reports loss as a promise on the device rather than a DOM event.
  (moonlit.renderer.backend as { device?: { lost?: Promise<unknown> } }).device?.lost?.then((info) =>
    handleContextLoss(info),
  );

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

  // Compile shaders behind the title screen so the first scroll never stutters. This is where
  // WGSL compile errors on WebGPU would surface (spec §17 S2) — guard it the same way renderer
  // creation is guarded above, so a failure here still leaves a usable page.
  try {
    await moonlit.renderer.compileAsync(region.scene, region.camera);
  } catch (error) {
    console.warn('Shader compilation failed; showing stills instead.', error);
    moonlit.renderer.domElement.remove();
    startStills();
    return;
  }
  gate.setReady();

  let enteredAt = gate.state === 'entered' ? performance.now() : Number.POSITIVE_INFINITY;
  gate.onEnter(() => {
    enteredAt = performance.now();
  });

  const hud = params.hud ? createHud(document.body) : null;
  let frames = 0;

  loop = createLoop((nowMs, dtSeconds) => {
    scroll.raf(nowMs);
    p = params.p ?? scroll.progress();
    state = resolve(p, journey);
    const timeSeconds = params.time ?? nowMs / 1000;

    region.update(state.a.local, timeSeconds, dtSeconds);
    sections.show(state.section);
    moonlit.render();
    frames += 1;

    // Gap between rendered frames, not the cost of one — the loop caps at 60 fps, so a
    // healthy device sits at ~16.7 ms here. The governor's thresholds are tuned against
    // that budget (see governor.ts).
    const frameIntervalMs = dtSeconds * 1000;
    hud?.record(frameIntervalMs);
    hud?.paint(nowMs, { backend: moonlit.backend, tier, renderScale: TIERS[tier].renderScale, progress: p });

    // Let the governor judge only real, warmed-up, non-idle frames
    const warmedUp = nowMs - enteredAt > 1500;
    if (params.tier === undefined && warmedUp && !loop?.isIdle(nowMs)) {
      const next = governor.sample(frameIntervalMs, nowMs);
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
