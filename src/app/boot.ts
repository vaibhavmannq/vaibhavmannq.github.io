import { demoProjects } from '../content/demoProjects';
import { projects as realProjects } from '../content/projects';
import { createHud } from '../dev/hud';
import { journey, journeyWithLength } from '../journey/journey.config';
import { journeyPhase, reducedMotionPhase } from '../journey/journeyMoon';
import { progressForSection, resolve, totalLength } from '../journey/timeline';
import type { JourneyState, RegionSegment, SectionId } from '../journey/types';
import { createChapterRail, moonGlyphPath } from '../overlay/chapterRail';
import { createFocusGlide } from '../overlay/focusGlide';
import { applyFrameFit } from '../overlay/frame';
import { bindGoLinks, createHeaderNav } from '../overlay/header';
import { createNameMotion } from '../overlay/nameMotion';
import { createPointerTouch } from '../overlay/pointerTouch';
import { createProjectDialog } from '../overlay/projectDialog';
import { renderProjectList } from '../overlay/projectList';
import { parseRoute, projectHash } from '../overlay/router';
import { createSectionMotion } from '../overlay/sectionMotion';
import { createSections, fullyShown, SHOWN_OFFSET } from '../overlay/sections';
import { createVoyageLog } from '../overlay/voyageLog';
import { createWelcome } from '../overlay/welcome';
import { Governor } from '../quality/governor';
import { bootTier, clampTier, TIERS, type Tier } from '../quality/tiers';
import { createMoonsink } from '../regions/moonsink';
import { createRenderer, type MoonlitRenderer } from '../render/renderer';
import { createScrollActivity } from '../scroll/activity';
import { createScroll } from '../scroll/scroll';
import { createTouchSnap } from '../scroll/touchSnap';
import { detectCapabilities } from './capabilities';
import { exposeDebug } from './debug';
import { createLoop, type Loop } from './loop';
import { readDebugParams } from './params';
import { createPacer } from './refresh';

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`#${id} is missing from index.html`);
  return element as T;
}

export async function boot(): Promise<void> {
  const params = readDebugParams(window.location.search);
  // `?length` lets the owner tune the journey's length by feel; everything below reads this.
  const activeJourney = params.length === undefined ? journey : journeyWithLength(params.length);
  const caps = detectCapabilities();
  const ctx = { reducedMotion: caps.reducedMotion };
  const root = document.documentElement;

  byId('journey-track').style.setProperty('--journey-length', String(totalLength(activeJourney)));
  // Text keeps its place in the scene whether the window is full screen or not (spec 2026-09-25 §4.14).
  applyFrameFit(root, byId('world'));
  // `?bare`: the scene alone, for rendering the stills and the project cover (scripts/capture.mjs).
  if (params.bare) root.classList.add('is-bare');

  // ---- HTML layer: works even if 3D never starts ----
  // Phase 1 has one region, so its anchors are the page's sections.
  const anchors = (activeJourney[0] as RegionSegment).sections;
  // Each chapter's text motion follows the same handover as its opacity (overlay/sectionMotion.ts).
  const motions = new Map(anchors.map((anchor) => [anchor.id, createSectionMotion(byId(anchor.id))] as const));
  const sections = createSections(byId('content'), anchors, motions);
  const name = createNameMotion(byId('intro-title'));
  // Opening E (spec 2026-09-25 §4.5): the HTML is the first paint; this runs the one timed arrival.
  const welcome = createWelcome({
    kicker: byId('intro').querySelector<HTMLElement>('[data-welcome]') ?? byId('intro-title'),
    reducedMotion: () => ctx.reducedMotion,
  });
  // Motion follows the system setting alone: the owner asked for the on-page "Reduce motion" button to go
  // (2026-09-25). Followed live, so turning the setting on mid-visit still quiets the page.
  const systemMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const applyMotion = () => {
    ctx.reducedMotion = systemMotion.matches;
    root.classList.toggle('is-reduced-motion', systemMotion.matches);
  };
  applyMotion();
  systemMotion.addEventListener('change', applyMotion);
  // Nothing is locked while the scene wakes: the text is readable and scrollable from the first paint.
  const scroll = createScroll();

  // ---- Projects: the list, its dialog and #/projects/<slug> deep links (spec §3.2) ----
  // `?demo` adds three placeholders, for the owner to judge the page with several projects (owner review).
  const projects = params.demo ? [...realProjects, ...demoProjects] : realProjects;
  let opener: HTMLElement | null = null;
  let pushedRoute = false;
  const clearRoute = () =>
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  const dialog = createProjectDialog(byId<HTMLDialogElement>('project-dialog'), projects, () => {
    scroll.setLocked(false);
    // Closing with Esc, the button or the backdrop also leaves the deep link: step back if this visit
    // opened it, so Back does not reopen it; otherwise just drop it from the address.
    if (parseRoute(window.location.hash).kind === 'project') {
      if (pushedRoute) window.history.back();
      else clearRoute();
    }
    pushedRoute = false;
    (opener ?? byId('projects-title')).focus({ preventScroll: true });
    opener = null;
  });
  const showProject = (slug: string): boolean => {
    if (!dialog.open(slug)) return false;
    scroll.setLocked(true);
    return true;
  };
  renderProjectList(byId('project-list'), projects, (slug, button) => {
    opener = button;
    window.history.pushState(window.history.state, '', projectHash(slug));
    pushedRoute = true;
    showProject(slug);
  });
  // Back, Forward and edited addresses: the hash decides whether a project is open.
  window.addEventListener('hashchange', () => {
    const route = parseRoute(window.location.hash);
    if (route.kind === 'project') {
      if (!dialog.isOpen && !showProject(route.slug)) clearRoute();
    } else if (dialog.isOpen) {
      pushedRoute = false;
      dialog.close();
    }
  });

  // Where each page is fully shown (overlay/sections.ts SHOWN_OFFSET). Deep links and the touch snap
  // land there, never in a handover gap.
  const aboutShown = progressForSection(activeJourney, 'about', SHOWN_OFFSET);
  const projectsShown = progressForSection(activeJourney, 'projects', SHOWN_OFFSET);
  const contactShown = progressForSection(activeJourney, 'contact', SHOWN_OFFSET);
  const shownAt: Record<SectionId, number> = {
    intro: 0,
    about: aboutShown,
    projects: projectsShown,
    contact: contactShown,
  };
  // The rail, Work, About, "See the work" and "Return to the shore" all glide to where a chapter is fully shown,
  // then give its heading focus (spec 2026-09-25 §4.6).
  const go = (id: SectionId) => {
    scroll.glideToProgress(shownAt[id], !ctx.reducedMotion);
    byId(`${id}-title`).focus({ preventScroll: true });
  };
  for (const path of document.querySelectorAll<SVGPathElement>('#chapter-rail path[data-phase]')) {
    path.setAttribute('d', moonGlyphPath(Number(path.dataset.phase)));
  }
  const rail = createChapterRail(byId('chapter-rail'), { go });
  bindGoLinks(document, { go });
  const headerNav = createHeaderNav(byId('site-header'));
  createFocusGlide({
    sectionOf: (element) => (element.closest<HTMLElement>('[data-section]')?.dataset.section as SectionId) ?? null,
    isShown: (id) => fullyShown(state.a.local, anchors, id, ctx.reducedMotion),
    glideTo: (id) => scroll.glideToProgress(shownAt[id], !ctx.reducedMotion),
  });
  createTouchSnap({
    progress: () => scroll.progress(),
    glideTo: (target) => scroll.glideToProgress(target, !ctx.reducedMotion),
    stops: [0, aboutShown, projectsShown, contactShown],
    enabled: () => params.p === undefined && !dialog.isOpen,
  });

  let p = params.p ?? 0;
  let state: JourneyState = resolve(p, activeJourney);
  sections.show(state.a.local, ctx.reducedMotion);
  // The log names the moon the scene shows, which waxes with the scroll (or `?moon=`, pinned).
  const log = createVoyageLog(byId('voyage-log'));
  const phaseFor = (local: number) =>
    params.moon ?? (ctx.reducedMotion ? reducedMotionPhase(local, anchors) : journeyPhase(local, anchors));
  log.show(phaseFor(state.a.local));

  // The page answers a mouse or trackpad: the name's letters swell near it, and nothing else moves.
  createPointerTouch({
    chars: name.chars,
    swellActive: () => !ctx.reducedMotion && welcome.settled && state.section === 'intro',
  });

  // "Return to the shore" (spec §3.2) glides back to the top and hands keyboard focus to the name.
  byId<HTMLAnchorElement>('return-to-shore').addEventListener('click', (event) => {
    event.preventDefault();
    go('intro');
  });
  // A deep link opens its project straight away, over the Projects page.
  const initialRoute = parseRoute(window.location.hash);
  if (initialRoute.kind === 'project') {
    if (projects.some((project) => project.slug === initialRoute.slug)) {
      scroll.scrollToProgress(projectsShown, true);
      showProject(initialRoute.slug);
    } else {
      clearRoute();
    }
  }

  // One frame of the text layer: scroll → journey state → the pages and the log. The stills loop runs it with its
  // scenery; until then, and until the 3D loop starts, the waking loop below runs it alone, so nothing waits for
  // the sea (opening E, spec 2026-09-25 §4.5; the shaders can compile for seconds on a phone).
  const textFrame = (nowMs: number, dtSeconds: number) => {
    scroll.raf(nowMs);
    p = params.p ?? scroll.progress();
    state = resolve(p, activeJourney);
    sections.show(state.a.local, ctx.reducedMotion, dtSeconds);
    log.show(phaseFor(state.a.local));
    rail.show(state.section);
    headerNav.show(state.section);
  };
  /** Frame time for loops that run on requestAnimationFrame: 0 on their first frame, so the text lands at once. */
  const frameClock = () => {
    let last = -1;
    return (nowMs: number) => {
      const dt = last < 0 ? 0 : Math.min(0.1, (nowMs - last) / 1000);
      last = nowMs;
      return dt;
    };
  };
  let waking = true;
  const wakingClock = frameClock();
  const wake = (nowMs: number) => {
    if (!waking) return;
    textFrame(nowMs, wakingClock(nowMs));
    window.requestAnimationFrame(wake);
  };
  window.requestAnimationFrame(wake);

  let stillsStarted = false;
  const startStills = () => {
    if (stillsStarted) return;
    stillsStarted = true;
    waking = false;
    root.classList.add('is-stills');
    exposeDebug({
      backend: 'stills',
      tier: () => 0,
      frames: () => 0,
      progress: () => p,
      section: () => state.section,
      reducedMotion: () => ctx.reducedMotion,
    });
    welcome.sceneReady();
    // Renders of each page's scenery stand in for the 3D scene (overlay.css .world__still). They are
    // created only here, so visitors with the 3D scene never download them.
    const stage = byId('world');
    const stills = new Map<string, HTMLElement>();
    for (const page of ['intro', 'about', 'projects', 'contact']) {
      const layer = document.createElement('div');
      layer.className = 'world__still';
      layer.dataset.page = page;
      stage.append(layer);
      stills.set(page, layer);
    }
    let shownStill = '';
    // Stills mode runs its own loop, so it measures its own frames: without that the text landed on its
    // scroll position at once here, while the 3D page let it travel (sections.ts CATCH_UP).
    const stillsClock = frameClock();
    const step = (nowMs: number) => {
      textFrame(nowMs, stillsClock(nowMs));
      if (state.section !== shownStill) {
        stills.get(shownStill)?.classList.remove('is-shown');
        stills.get(state.section)?.classList.add('is-shown');
        shownStill = state.section;
      }
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

  const region = createMoonsink(ctx, anchors, params.moon);
  // No opening to wait behind: the camera follows the scroll from the first frame.
  region.setEntered(true);
  moonlit.setView(region.scene, region.camera);
  // Size from the stage, not the window: the stage is the large viewport, which a phone's toolbar
  // never changes, so swiping never resizes the render buffers (overlay.css .world).
  const world = byId('world');
  let stageWidth = world.clientWidth;
  let stageHeight = world.clientHeight;
  region.resize(stageWidth, stageHeight);

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
      if (world.clientWidth === stageWidth && world.clientHeight === stageHeight) return;
      stageWidth = world.clientWidth;
      stageHeight = world.clientHeight;
      moonlit.resize(stageWidth, stageHeight);
      region.resize(stageWidth, stageHeight);
    }, 150);
  });

  // Compile shaders before the sea fades up, so the first scroll never stutters. This is where
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
  // A context loss can race this await (spec §17 S14: ~20 s on a software GPU). If it fired while
  // we were waiting, handleContextLoss already switched to stills — don't also start the 3D loop
  // on a now-dead device.
  if (contextLost) return;
  // Pay the first-frame shader cost now, while the canvas is still transparent (overlay.css .world).
  moonlit.warmUp();

  const hud = params.hud ? createHud(document.body) : null;
  const activity = createScrollActivity();
  let frames = 0;

  const onFrame = (nowMs: number, dtSeconds: number) => {
    scroll.raf(nowMs);
    p = params.p ?? scroll.progress();
    state = resolve(p, activeJourney);
    const scrolling = activity.update(p, nowMs);
    const timeSeconds = params.time ?? nowMs / 1000;

    region.update(state.a.local, timeSeconds, dtSeconds);
    log.show(region.phase);
    // Only the frame loops pass a frame time: the text travels toward the scroll's handover here. It landed on
    // the scroll before this loop began (the waking loop's first frame), as the camera does on its first frame.
    sections.show(state.a.local, ctx.reducedMotion, dtSeconds);
    rail.show(state.section);
    headerNav.show(state.section);
    moonlit.render();
    frames += 1;

    // Gap between rendered frames, not the cost of one — the loop caps at 60 fps, so a
    // healthy device sits at ~16.7 ms here. The governor's thresholds are tuned against
    // that budget (see governor.ts).
    const frameIntervalMs = dtSeconds * 1000;
    hud?.record(frameIntervalMs, scrolling);
    const refreshHz = loop?.pacer.refreshHz ?? null;
    hud?.paint(nowMs, {
      backend: moonlit.backend,
      tier,
      renderScale: TIERS[tier].renderScale,
      progress: p,
      scrolling,
      refresh:
        refreshHz === null
          ? 'measuring'
          : `${Math.round(refreshHz)} Hz → ${Math.round(1000 / (loop?.pacer.targetIntervalMs ?? 1000 / 60))} fps`,
    });

    // Let the governor judge only real, warmed-up, non-idle frames, only once the pacer knows the screen, and never
    // the first frame after the pacer measured quietly: its interval spans the pause (final review C1).
    const warmedUp = nowMs - enteredAt > 1500;
    const resumed = loop?.pacer.resumed ?? true;
    if (params.tier === undefined && warmedUp && !loop?.isIdle(nowMs) && refreshHz !== null && !resumed) {
      governor.setTargetInterval(loop?.pacer.targetIntervalMs ?? 1000 / 60);
      // Keep measuring while the visitor scrolls, but change tier only once they stop: a tier change
      // resizes render buffers, which hitches exactly when motion is most visible (spec §5.6).
      const next = governor.sample(frameIntervalMs, nowMs, !scrolling);
      if (next !== null) {
        hud?.tierChanged(scrolling);
        applyTier(next);
        // A new tier costs the GPU differently: let the pacer check once more whether slow frames are the screen's.
        loop?.pacer.rearm();
      }
    }
  };
  // While the pacer measures quietly, the text layer runs alone, as it did before the sea was ready.
  loop = createLoop(onFrame, createPacer(), textFrame);

  exposeDebug({
    backend: moonlit.backend,
    tier: () => tier,
    frames: () => frames,
    progress: () => p,
    section: () => state.section,
    reducedMotion: () => ctx.reducedMotion,
  });
  // The governor judges frames from 1.5 s after they begin (warmedUp above).
  const enteredAt = performance.now();
  waking = false;
  loop.start(moonlit.renderer);
  welcome.sceneReady();

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
