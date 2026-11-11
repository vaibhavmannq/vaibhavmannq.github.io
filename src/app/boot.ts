import { cameraPosition, densityFogFactor, fog, positionWorld } from 'three/tsl';
import { DataTexture, PerspectiveCamera, RGBAFormat, Scene, TextureLoader, Vector3 } from 'three/webgpu';
import { fetchBinary, loadManifest } from '../assets/loader';
import type { Manifest } from '../assets/manifest';
import { createSkyStore, skyAmbients } from '../assets/skies';
import { type Pose, poseAt } from '../journey/camera';
import flightPaths from '../journey/flightPaths.json';
import type { FlightPath } from '../journey/flights';
import { blendHours, HOURS } from '../journey/hours';
import { STOPS } from '../journey/stops';
import { buildTrack, type FrameState, frameAt, nearestStop, type Track } from '../journey/timeline';
import { STOP_IDS, toThree, type Vec3 } from '../journey/types';
import { installHud } from '../overlay/hud';
import { createJumps, snapStops, targetFromLocation } from '../overlay/links';
import { createRail } from '../overlay/rail';
import { createStage } from '../overlay/stage';
import { DEFAULT_GOVERNOR, Governor } from '../quality/governor';
import { bootTier, TIERS, type Tier } from '../quality/tiers';
import { createPipeline, type Pipeline } from '../render/pipeline';
import { createScroll, type ScrollController } from '../scroll/scroll';
import { createTouchSnap } from '../scroll/touchSnap';
import { createDressing, decodeDressing } from '../world/dressing';
import { createHeightSampler } from '../world/heights';
import { createLightUniforms, type LightUniforms, lightValues } from '../world/light';
import type { WorldFrame, WorldPart } from '../world/part';
import { createSea, heightTexture } from '../world/sea';
import { createSky, type Sky } from '../world/sky';
import { createTerrain } from '../world/terrain';
import { installBench } from './bench';
import { detectCapabilities } from './capabilities';
import { createLoop } from './loop';
import { readParams } from './params';

/** What the overlay, the HUD and the benchmarks need from a running world (Tasks 12–14 add to it). */
export interface App {
  readonly track: Track;
  readonly scroll: ScrollController;
  readonly manifest: Manifest;
  readonly pipeline: Pipeline | null;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** Journey position in screens; set by the benchmark to drive the camera without Lenis. */
  override: number | null;
  tier: Tier;
  setTier(t: Tier): void;
  addPart(part: WorldPart): void;
  /** Called after every rendered frame (HUD, overlay). */
  onFrame: ((frame: FrameState, nowMs: number, dtMs: number) => void)[];
  /** Show the renders at the stops (`?stills=off` and the HUD turn them off). */
  stills: boolean;
  /** Resolves when stage B (the world base) is in the scene. */
  stageB: Promise<void>;
}

const html = document.documentElement;
const rad = (d: number) => (d * Math.PI) / 180;
const _look = new Vector3();

function aimCamera(camera: PerspectiveCamera, pose: Pose): void {
  camera.position.set(...pose.position);
  const coast: Vec3 = [
    Math.sin(rad(pose.yaw)) * Math.cos(rad(pose.pitch)),
    Math.cos(rad(pose.yaw)) * Math.cos(rad(pose.pitch)),
    Math.sin(rad(pose.pitch)),
  ];
  camera.lookAt(_look.copy(camera.position).add(new Vector3(...toThree(coast))));
  if (Math.abs(camera.fov - pose.fov) > 1e-4) {
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
}

async function loadBase(app: App, sky: Sky, light: LightUniforms): Promise<void> {
  const dressingMeta = app.manifest.base.dressing;
  const [heightsBuf, ringBuf, colour, dressingBuf] = await Promise.all([
    fetchBinary('base/heights.bin'),
    fetchBinary('base/ring.bin'),
    new TextureLoader().loadAsync('/world/base/colour.webp'),
    dressingMeta ? fetchBinary(dressingMeta.file) : null,
  ]);
  const meta = app.manifest.base;
  const heights = new Uint16Array(heightsBuf);
  const terrain = createTerrain(heights, new Uint16Array(ringBuf), colour, meta, sky);
  const sea = createSea(heightTexture(heights, meta.heights), meta.heights, light, TIERS[app.tier]);
  const parts = [terrain, sea];
  if (dressingMeta && dressingBuf) {
    const instances = decodeDressing(new Uint16Array(dressingBuf), dressingMeta, meta.heights);
    parts.push(createDressing(instances, createHeightSampler(heights, meta.heights)));
  }
  for (const part of parts) {
    await app.pipeline?.renderer.compileAsync(part.object, app.camera, app.scene);
    app.addPart(part);
  }
}

/** Starts the site: the name is already on screen (index.html); the world fades in under it when ready. */
export async function boot(): Promise<App> {
  const caps = detectCapabilities();
  const params = readParams(location.search);
  const track = buildTrack(STOPS);
  const trackEl = document.getElementById('track');
  if (trackEl) trackEl.style.height = `${(track.total + 1) * 100}lvh`;
  const scroll = createScroll();

  // The overlay runs from the first frame, GPU or not: labels, stills, rail, links, touch snap (spec §2).
  let appRef: App | null = null;
  const stage = createStage(STOPS);
  const jumps = createJumps(scroll, track, (opacity) => stage.setVeil(opacity));
  const rail = createRail(document.getElementById('rail') as HTMLElement, STOPS, (i) => void jumps.go(i));
  createTouchSnap({
    progress: () => scroll.progress(),
    glideTo: (p) => scroll.glideToProgress(p, true),
    stops: snapStops(track),
    enabled: () => params.p === undefined,
  });
  const target = targetFromLocation(location.hash, location.search);
  if (target >= 0) jumps.goNow(target);
  else if (params.p !== undefined) scroll.scrollToProgress(params.p, true);
  window.addEventListener('hashchange', () => {
    const next = targetFromLocation(location.hash, '');
    if (next >= 0) void jumps.go(next);
  });
  const overlayTick = (nowMs: number) => {
    scroll.raf(nowMs);
    const u = appRef?.override ?? scroll.progress() * track.total;
    const state = frameAt(track, u, caps.reducedMotion);
    const nearest = nearestStop(track, u);
    stage.update(state, nearest, appRef?.stills ?? params.stills);
    rail.setCurrent(nearest);
    requestAnimationFrame(overlayTick);
  };
  requestAnimationFrame(overlayTick);

  const host = document.getElementById('world') as HTMLElement;
  const manifest = await loadManifest();
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 14000);
  let pipeline: Pipeline | null = null;
  if (!params.nogl) {
    try {
      pipeline = await createPipeline(host, params.webgl);
    } catch (error) {
      console.warn('No GPU path; showing the stills.', error);
    }
  }
  if (!pipeline) html.classList.add('is-stills');

  const parts: WorldPart[] = [];
  let tier: Tier = params.tier ?? bootTier(caps);
  // Loading hitches in the first seconds say nothing about the device (s04: the owner's phone fell to low in its first
  // second and stayed there), so the governor's first 3 s are not judged.
  const governor = new Governor(tier, { ...DEFAULT_GOVERNOR, warmupMs: 3000 });
  const applyTier = (t: Tier) => {
    tier = t;
    app.tier = t;
    pipeline?.setTier(TIERS[t], caps.devicePixelRatio);
    for (const part of parts) part.setTier(TIERS[t]);
  };
  const app: App = {
    track,
    scroll,
    manifest,
    pipeline,
    scene,
    camera,
    override: null,
    tier,
    /** A tier picked by hand (HUD, benchmark): the governor takes it as its own (review I3). */
    setTier(t) {
      applyTier(t);
      governor.reset(t, performance.now());
    },
    addPart(part) {
      parts.push(part);
      scene.add(part.object);
      part.setTier(TIERS[tier]);
    },
    onFrame: [],
    stills: params.stills,
    stageB: Promise.resolve(),
  };
  appRef = app;

  const paths = flightPaths as FlightPath[];
  const ambients = skyAmbients(manifest);
  const light = createLightUniforms();
  light.install(scene);
  const blank = new DataTexture(new Uint8Array([20, 18, 32, 255]), 1, 1, RGBAFormat);
  blank.needsUpdate = true;
  const skies = createSkyStore(manifest, blank, {
    onLoaded: (t) => {
      pipeline?.renderer.initTexture(t);
    },
  });
  // With no GPU nothing shows the skies, so jumps never wait for them (review I5).
  if (pipeline) jumps.ready = (i) => skies.ready(i);
  const sky = createSky(light, skies, blank);
  // Distance fades into the sky's own horizon colour, not a separate fog colour (see sky.ts horizonAt).
  scene.fogNode = fog(sky.horizonAt(positionWorld.sub(cameraPosition)), densityFogFactor(light.fogDensity));
  app.addPart(sky);

  const startedAt = performance.now();
  let last: FrameState | null = null;

  const frame = (nowMs: number, dtS: number): WorldFrame => {
    const u = app.override ?? scroll.progress() * track.total;
    const state = frameAt(track, u, caps.reducedMotion);
    const timeS = (nowMs - startedAt) / 1000;
    const pose = poseAt(state, paths, camera.aspect, timeS, caps.reducedMotion);
    aimCamera(camera, pose);
    const hour = blendHours(
      HOURS[STOP_IDS[state.a] ?? 'golden'],
      HOURS[STOP_IDS[state.b] ?? 'golden'],
      state.hourWeight,
    );
    const ambA = ambients[state.a] ?? ambients[0];
    const ambB = ambients[state.b] ?? ambients[0];
    if (ambA && ambB) light.apply(lightValues(hour, ambA, ambB, state.skyWeight), camera.position);
    last = state;
    return { state, hour, pose, timeS, dtS };
  };

  if (pipeline) {
    const active = pipeline;
    active.setScene(scene, camera, light);
    applyTier(tier);
    new ResizeObserver(() => {
      camera.aspect = host.clientWidth / Math.max(1, host.clientHeight);
      camera.updateProjectionMatrix();
      active.resize(host.clientWidth, host.clientHeight);
    }).observe(host);

    // Stage A: the skies of the place the visit starts at (a link may open on any place), then a hidden warm-up frame,
    // then the fade-in (spec §12, review I2). A failed sky still fades in; the store retries.
    const start = frameAt(track, scroll.progress() * track.total, caps.reducedMotion);
    await Promise.all([skies.ready(start.a), skies.ready(start.b)]).catch(() => undefined);
    const first = frame(performance.now(), 1 / 60);
    for (const part of parts) part.update(first);
    await active.warmUp();
    html.classList.add('is-scene-ready');

    const loop = createLoop((nowMs, dtS) => {
      const f = frame(nowMs, dtS);
      for (const part of parts) part.update(f);
      active.render();
      governor.setTargetInterval(loop.pacer.targetIntervalMs);
      // The governor rests while the benchmark drives the camera or the tier is pinned by `?tier=` (review I3).
      if (!loop.pacer.resumed && app.override === null && params.tier === undefined) {
        const change = governor.sample(dtS * 1000, nowMs, f.state.resting, !f.state.resting);
        if (change !== null) {
          applyTier(change);
          loop.pacer.rearm();
        }
      }
      for (const fn of app.onFrame) fn(f.state, nowMs, dtS * 1000);
    });
    loop.start(active.renderer);

    // Stage B: the world base (ground and sea), compiled off-screen before it joins the scene (spec §12).
    app.stageB = loadBase(app, sky, light)
      .then(() => governor.reset(app.tier, performance.now()))
      .catch((error: unknown) => console.warn('world base failed to load', error));
  }
  void last;
  installBench(app);
  if (params.hud) installHud(app);
  // Development only: the running app, for checks from the browser console and the headed test browser.
  if (import.meta.env.DEV) (window as unknown as { __app: App }).__app = app;
  return app;
}
