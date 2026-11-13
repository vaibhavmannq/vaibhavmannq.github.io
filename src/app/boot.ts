import { cameraPosition, densityFogFactor, fog, positionWorld } from 'three/tsl';
import { DataTexture, PerspectiveCamera, RGBAFormat, Scene, TextureLoader, Vector3 } from 'three/webgpu';
import { fetchBinary, fetchJson, loadManifest } from '../assets/loader';
import type { Manifest } from '../assets/manifest';
import { createSkyStore, skyAmbients } from '../assets/skies';
import { fovFor, type Pose, poseAt } from '../journey/camera';
import flightPaths from '../journey/flightPaths.json';
import type { FlightPath } from '../journey/flights';
import { blendHours, HOURS } from '../journey/hours';
import { follow, LEAD_SCREENS, rideMs } from '../journey/pace';
import { nearDistance, PARALLAX_RATE, parallaxOffset, parallaxWeight } from '../journey/parallax';
import { SHOTS } from '../journey/shots';
import { STOPS } from '../journey/stops';
import { buildTrack, type FrameState, frameAt, nearestStop, type Track } from '../journey/timeline';
import { STOP_IDS, toThree, type Vec3 } from '../journey/types';
import { installHud } from '../overlay/hud';
import { createJumps, snapStops, targetFromLocation } from '../overlay/links';
import { createRail } from '../overlay/rail';
import { createRide } from '../overlay/ride';
import { createStage } from '../overlay/stage';
import { DEFAULT_GOVERNOR, Governor } from '../quality/governor';
import { bootTier, TIERS, type Tier } from '../quality/tiers';
import { createPipeline, type Pipeline } from '../render/pipeline';
import { createScroll, type ScrollController } from '../scroll/scroll';
import { createTouchSnap } from '../scroll/touchSnap';
import { type AuroraData, createAurora } from '../world/aurora';
import { createCave, decodeCave } from '../world/cave';
import { createCloudSea } from '../world/cloudSea';
import { createDressing, decodeDressing } from '../world/dressing';
import { createHeightSampler } from '../world/heights';
import { createLightUniforms, type LightUniforms, lightValues } from '../world/light';
import type { WorldFrame, WorldPart } from '../world/part';
import { createSea, heightTexture } from '../world/sea';
import { createSky, type Sky } from '../world/sky';
import { createTerrain } from '../world/terrain';
import { createWaterfall } from '../world/waterfall';
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
  /** Where the camera is on the journey this frame, in screens (it follows the scroll with a top speed). */
  cameraU(nowMs: number): number;
  tier: Tier;
  setTier(t: Tier): void;
  /** Parts by name, for the benchmarks' on/off switch. */
  readonly parts: Map<string, WorldPart>;
  /** Parts held hidden by the benchmark (`__parts`). */
  partsOff: Set<string>;
  /** When each part joined the scene (performance.now ms), for the benchmarks. */
  readonly joined: Map<string, number>;
  addPart(part: WorldPart, name: string): void;
  /** Called after every rendered frame (HUD, overlay). */
  onFrame: ((frame: FrameState, nowMs: number, dtMs: number) => void)[];
  /** Show the renders at the stops (`?stills=off` and the HUD turn them off). */
  stills: boolean;
  /** Resolves when stage B (the world base) is in the scene. */
  stageB: Promise<void>;
  /** Per stop, the distance to the nearest thing in view (pointer parallax); 10 m until the ground has loaded. */
  nearM: number[];
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

async function loadBase(app: App, sky: Sky, light: LightUniforms, auroraActive: boolean): Promise<void> {
  const dressingMeta = app.manifest.base.dressing;
  const auroraMeta = app.manifest.base.aurora;
  const caveMeta = app.manifest.base.cave;
  const [heightsBuf, ringBuf, colour, dressingBuf, auroraData, caveBuf] = await Promise.all([
    fetchBinary('base/heights.bin'),
    fetchBinary('base/ring.bin'),
    new TextureLoader().loadAsync('/world/base/colour.webp'),
    dressingMeta ? fetchBinary(dressingMeta.file) : null,
    auroraMeta ? fetchJson<AuroraData>(auroraMeta.file) : null,
    caveMeta ? fetchBinary(caveMeta.file) : null,
  ]);
  const caveShot = SHOTS.beforedawn.cave;
  const meta = app.manifest.base;
  const heights = new Uint16Array(heightsBuf);
  const heightAt = createHeightSampler(heights, meta.heights);
  app.nearM = STOPS.map((s) =>
    nearDistance(s.cam, s.landscape.yaw, s.landscape.pitch, fovFor(s.landscape.lens, 16 / 9), heightAt),
  );
  const cut = caveShot && caveBuf ? { x: caveShot.x, y: caveShot.y, rx: 12.2, ry: 10.2 } : undefined;
  const terrain = createTerrain(heights, new Uint16Array(ringBuf), colour, meta, sky, cut);
  const heightMap = heightTexture(heights, meta.heights);
  const sea = createSea(heightMap, meta.heights, light, TIERS[app.tier]);
  const parts: [string, WorldPart][] = [
    ['terrain', terrain],
    ['sea', sea],
  ];
  if (dressingMeta && dressingBuf) {
    const instances = decodeDressing(new Uint16Array(dressingBuf), dressingMeta, meta.heights);
    parts.push(['dressing', createDressing(instances, heightAt)]);
  }
  // The four unknowns (M2). Each hides itself wherever its hour or place is not in play.
  const { night, midnight } = SHOTS;
  if (auroraData && night.aurora && midnight.aurora)
    parts.push(['aurora', createAurora(auroraData, night.aurora, midnight.aurora, auroraActive)]);
  if (midnight.cloudsea) parts.push(['cloud', createCloudSea(midnight.cloudsea, heightMap, meta.heights, light)]);
  if (night.falls) parts.push(['falls', createWaterfall(night.falls, light)]);
  if (caveShot && caveMeta && caveBuf)
    parts.push(['cave', createCave(decodeCave(caveBuf, caveMeta), caveShot, sky, light)]);
  // Every part's shader is compiled here, while it is still visible and before it joins the scene (no hitch later).
  for (const [name, part] of parts) {
    await app.pipeline?.renderer.compileAsync(part.object, app.camera, app.scene);
    app.addPart(part, name);
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

  // The camera's place on the journey follows the scroll with damping and a top speed (Amendment 1 §7). Worked out
  // once per animation frame, so the overlay and the world, which run in two callbacks, agree.
  let camU = Number.NaN;
  let camAt = -1;
  let lastTarget = Number.NaN;
  const cameraU = (nowMs: number): number => {
    const target = scroll.progress() * track.total;
    // A jump of more than a screen in one frame that no wheel, key or finger made is a teleport (the browser restoring
    // a position on reload, a scrollbar drag, find in page): the camera jumps with it instead of flying there.
    const teleport =
      nowMs !== camAt && Math.abs(target - lastTarget) > 1 && nowMs - scroll.lastInputMs() > 250 && !scroll.gliding();
    lastTarget = target;
    if (Number.isNaN(camU) || caps.reducedMotion || teleport) camU = target;
    else if (nowMs !== camAt) camU = follow(track, camU, target, Math.min(0.1, Math.max(0, (nowMs - camAt) / 1000)));
    if (nowMs !== camAt) scroll.holdNear(camU / track.total, LEAD_SCREENS / track.total);
    camAt = nowMs;
    return camU;
  };
  scroll.onJump = (p) => {
    camU = p * track.total;
  };

  // The overlay runs from the first frame, GPU or not: labels, stills, rail, links, touch snap (spec §2).
  let appRef: App | null = null;
  const stage = createStage(STOPS);
  const jumps = createJumps(scroll, track, (opacity) => stage.setVeil(opacity));
  const rail = createRail(document.getElementById('rail') as HTMLElement, STOPS, (i) => void jumps.go(i));
  createTouchSnap({
    progress: () => scroll.progress(),
    // A swipe that stops short carries on to the next place at the ride's pace, never cutting a flight short.
    glideTo: (p) => {
      const from = cameraU(performance.now());
      scroll.glideToProgress(p, true, Math.max(500, rideMs(track, from, p * track.total)));
    },
    stops: snapStops(track),
    enabled: () => params.p === undefined,
  });
  const target = targetFromLocation(location.hash, location.search);
  // A link to a place wins over the browser's restored position on reload.
  if (target >= 0 && 'scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (target >= 0) jumps.goNow(target);
  else if (params.p !== undefined) scroll.scrollToProgress(params.p, true);
  window.addEventListener('hashchange', () => {
    const next = targetFromLocation(location.hash, '');
    if (next >= 0) void jumps.go(next);
  });
  const ride = createRide(
    document.getElementById('ride') as HTMLButtonElement,
    STOPS,
    track,
    scroll,
    () => cameraU(performance.now()),
    () => params.p === undefined,
  );
  const overlayTick = (nowMs: number) => {
    scroll.raf(nowMs);
    const u = appRef?.override ?? cameraU(nowMs);
    ride.update(u);
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
      pipeline = await createPipeline(host, params.webgl, params.gpu);
    } catch (error) {
      console.warn('No GPU path; showing the stills.', error);
    }
  }
  if (!pipeline) html.classList.add('is-stills');

  const parts: WorldPart[] = [];
  const named = new Map<string, WorldPart>();
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
    cameraU,
    tier,
    /** A tier picked by hand (HUD, benchmark): the governor takes it as its own (review I3). */
    setTier(t) {
      applyTier(t);
      governor.reset(t, performance.now());
    },
    parts: named,
    partsOff: new Set(),
    joined: new Map(),
    addPart(part, name) {
      parts.push(part);
      named.set(name, part);
      app.joined.set(name, performance.now());
      scene.add(part.object);
      part.setTier(TIERS[tier]);
    },
    onFrame: [],
    stills: params.stills,
    stageB: Promise.resolve(),
    nearM: STOPS.map(() => 10),
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
  app.addPart(sky, 'sky');

  const startedAt = performance.now();
  let last: FrameState | null = null;

  // Pointer parallax (D28): a mouse or pen moves the view at once; touch scrolls, and gets tilt later (D27).
  const pointer: [number, number] = [0, 0];
  const slide: [number, number] = [0, 0];
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch') return;
      pointer[0] = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      pointer[1] = 1 - (event.clientY / Math.max(1, window.innerHeight)) * 2;
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    pointer[0] = 0;
    pointer[1] = 0;
  });

  const frame = (nowMs: number, dtS: number): WorldFrame => {
    const u = app.override ?? cameraU(nowMs);
    const state = frameAt(track, u, caps.reducedMotion);
    const timeS = (nowMs - startedAt) / 1000;
    const pose = poseAt(state, paths, camera.aspect, timeS, caps.reducedMotion);
    if (!caps.reducedMotion) {
      const near = app.nearM[state.t < 0.5 ? state.a : state.b] ?? 10;
      const [right, up] = parallaxOffset(pointer, near, pose.fov, camera.aspect);
      const w = parallaxWeight(state);
      const k = 1 - Math.exp(-PARALLAX_RATE * dtS);
      slide[0] += (right * w - slide[0]) * k;
      slide[1] += (up * w - slide[1]) * k;
      // sideways in the camera's own frame (coast axes: right of yaw is (cos, -sin)); three.js: x, y up, z = -north
      const yaw = (pose.yaw * Math.PI) / 180;
      pose.position = [
        pose.position[0] + Math.cos(yaw) * slide[0],
        pose.position[1] + slide[1],
        pose.position[2] + Math.sin(yaw) * slide[0],
      ];
    }
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
      for (const name of app.partsOff) {
        const held = named.get(name);
        if (held) held.object.visible = false;
      }
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
    app.stageB = loadBase(app, sky, light, params.auroraActive)
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
