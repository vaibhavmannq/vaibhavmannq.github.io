import { DataTexture, PerspectiveCamera, RGBAFormat, Scene, TextureLoader, Vector3 } from 'three/webgpu';
import { fetchBinary, loadManifest } from '../assets/loader';
import type { Manifest } from '../assets/manifest';
import { createSkyStore, skyAmbients } from '../assets/skies';
import { type Pose, poseAt } from '../journey/camera';
import flightPaths from '../journey/flightPaths.json';
import type { FlightPath } from '../journey/flights';
import { blendHours, HOURS } from '../journey/hours';
import { STOPS } from '../journey/stops';
import { buildTrack, type FrameState, frameAt, stopCentre, type Track } from '../journey/timeline';
import { STOP_IDS, toThree, type Vec3 } from '../journey/types';
import { Governor } from '../quality/governor';
import { bootTier, TIERS, type Tier } from '../quality/tiers';
import { createPipeline, type Pipeline } from '../render/pipeline';
import { createScroll, type ScrollController } from '../scroll/scroll';
import { createLightUniforms, type LightUniforms, lightValues } from '../world/light';
import type { WorldFrame, WorldPart } from '../world/part';
import { createSea, heightTexture } from '../world/sea';
import { createSky, type Sky } from '../world/sky';
import { createTerrain } from '../world/terrain';
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
  const [heightsBuf, ringBuf, colour] = await Promise.all([
    fetchBinary('base/heights.bin'),
    fetchBinary('base/ring.bin'),
    new TextureLoader().loadAsync('/world/base/colour.webp'),
  ]);
  const meta = app.manifest.base;
  const heights = new Uint16Array(heightsBuf);
  const terrain = createTerrain(heights, new Uint16Array(ringBuf), colour, meta, sky);
  const sea = createSea(heightTexture(heights, meta.heights), meta.heights, light, TIERS[app.tier]);
  for (const part of [terrain, sea]) {
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
  if (params.stop) scroll.scrollToProgress(stopCentre(track, STOP_IDS.indexOf(params.stop)) / track.total, true);
  else if (params.p !== undefined) scroll.scrollToProgress(params.p, true);

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
  const app: App = {
    track,
    scroll,
    manifest,
    pipeline,
    scene,
    camera,
    override: null,
    tier,
    setTier(t) {
      tier = t;
      app.tier = t;
      pipeline?.setTier(TIERS[t], caps.devicePixelRatio);
      for (const part of parts) part.setTier(TIERS[t]);
    },
    addPart(part) {
      parts.push(part);
      scene.add(part.object);
      part.setTier(TIERS[tier]);
    },
    onFrame: [],
  };

  const paths = flightPaths as FlightPath[];
  const ambients = skyAmbients(manifest);
  const light = createLightUniforms();
  light.install(scene);
  const blank = new DataTexture(new Uint8Array([20, 18, 32, 255]), 1, 1, RGBAFormat);
  blank.needsUpdate = true;
  const skies = createSkyStore(manifest, blank);
  const sky = createSky(light, skies, blank);
  app.addPart(sky);

  const governor = new Governor(tier);
  const startedAt = performance.now();
  let last: FrameState | null = null;

  const frame = (nowMs: number, dtS: number): WorldFrame => {
    scroll.raf(nowMs);
    const u = app.override ?? scroll.progress() * track.total;
    const state = frameAt(track, u, caps.reducedMotion);
    const timeS = (nowMs - startedAt) / 1000;
    const pose = poseAt(state, paths, camera.aspect, timeS);
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
    app.setTier(tier);
    new ResizeObserver(() => {
      camera.aspect = host.clientWidth / Math.max(1, host.clientHeight);
      camera.updateProjectionMatrix();
      active.resize(host.clientWidth, host.clientHeight);
    }).observe(host);

    // Stage A: the first stop's sky, then a hidden warm-up frame, then the fade-in (spec §12).
    await skies.ready(0);
    const first = frame(performance.now(), 1 / 60);
    for (const part of parts) part.update(first);
    await active.warmUp();
    html.classList.add('is-scene-ready');

    const loop = createLoop((nowMs, dtS) => {
      const f = frame(nowMs, dtS);
      for (const part of parts) part.update(f);
      active.render();
      governor.setTargetInterval(loop.pacer.targetIntervalMs);
      if (!loop.pacer.resumed) {
        const change = governor.sample(dtS * 1000, nowMs, f.state.resting);
        if (change !== null) {
          app.setTier(change);
          loop.pacer.rearm();
        }
      }
      for (const fn of app.onFrame) fn(f.state, nowMs, dtS * 1000);
    });
    loop.start(active.renderer);

    // Stage B: the world base (ground and sea), compiled off-screen before it joins the scene (spec §12).
    void loadBase(app, sky, light).catch((error: unknown) => console.warn('world base failed to load', error));
  } else {
    // No GPU: keep the overlay moving with the scroll.
    const tick = (nowMs: number) => {
      scroll.raf(nowMs);
      const state = frameAt(track, scroll.progress() * track.total, caps.reducedMotion);
      last = state;
      for (const fn of app.onFrame) fn(state, nowMs, 16.7);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  void last;
  // Development only: the running app, for checks from the browser console and the headed test browser.
  if (import.meta.env.DEV) (window as unknown as { __app: App }).__app = app;
  return app;
}
