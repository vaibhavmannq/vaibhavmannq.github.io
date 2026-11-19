import { cameraPosition, densityFogFactor, fog, positionWorld } from 'three/tsl';
import { DataTexture, PerspectiveCamera, RGBAFormat, Scene, TextureLoader, Vector3 } from 'three/webgpu';
import { fetchBinary, fetchJson, loadManifest } from '../assets/loader';
import type { Manifest } from '../assets/manifest';
import { createSkyStore, skyAmbients } from '../assets/skies';
import { fovFor, type Pose, poseAt, shortestYaw } from '../journey/camera';
import flightPaths from '../journey/flightPaths.json';
import flightPathsOld from '../journey/flightPathsOld.json';
import type { FlightPath } from '../journey/flights';
import { blendHours, HOURS } from '../journey/hours';
import { createLook, dragEnded, touchIntent } from '../journey/look';
import { follow, LEAD_SCREENS, rideMs } from '../journey/pace';
import { nearDistance, PARALLAX_RATE, parallaxOffset, parallaxWeight } from '../journey/parallax';
import { OLD_CAMS, OLD_CAMS_ON, SHOTS } from '../journey/shots';
import { SPOT_WALK_MS, SPOTS, type SpotPath, sampleSpot, spotsAt, spotsOpen } from '../journey/spots';
import { STOPS, stopIndex } from '../journey/stops';
import { loadThread, saveThread } from '../journey/thread';
import { buildTrack, type FrameState, frameAt, nearestStop, type Track } from '../journey/timeline';
import { STOP_IDS, type StopId, toThree, type Vec3 } from '../journey/types';
import { installHud } from '../overlay/hud';
import { createJumps, snapStops, targetFromLocation } from '../overlay/links';
import { createRail } from '../overlay/rail';
import { createRide } from '../overlay/ride';
import { createStage } from '../overlay/stage';
import { DEFAULT_GOVERNOR, Governor } from '../quality/governor';
import { bootTier, TIERS, type Tier } from '../quality/tiers';
import { createPipeline, type Pipeline } from '../render/pipeline';
import { createScroll, type ScrollController } from '../scroll/scroll';
import { createTouchSnap, easeInOutSine } from '../scroll/touchSnap';
import { createArch, createRockMaterial, decodeArch } from '../world/arch';
import { type AuroraData, createAurora } from '../world/aurora';
import { BOWL, createBowl, fallsLayout } from '../world/bowl';
import { capInstances } from '../world/caps';
import { createCave, decodeCave } from '../world/cave';
import { createCliffs, decodeCliffs } from '../world/cliffs';
import { createCloudSea } from '../world/cloudSea';
import { coronaCurves, coronaShot } from '../world/corona';
import { createDressing, decodeDressing } from '../world/dressing';
import { createCaps, createGrove, decodeGrove } from '../world/grove';
import { createHeightSampler, createSurfaceSampler } from '../world/heights';
import { createLantern, LANTERN_AT } from '../world/lantern';
import { createDuskLanterns, SHALLOWS_AT } from '../world/lanterns';
import { createLife } from '../world/life';
import { createLightUniforms, type LightUniforms, lightValues } from '../world/light';
import { createMeadow, EYE_ONLY_LAYER } from '../world/meadow';
import { createMist } from '../world/mist';
import { createNightLife, nightLure, nightWeight } from '../world/nightlife';
import type { WorldFrame, WorldPart } from '../world/part';
import { PART_STOPS, partOrder } from '../world/partOrder';
import { createPebbles } from '../world/pebbles';
import { createPlankton, planktonStirs, waterline } from '../world/plankton';
import { scatterCove } from '../world/scatter';
import { createSea, heightTexture } from '../world/sea';
import { createSky, type Sky } from '../world/sky';
import { createSpotGlints } from '../world/spotGlints';
import { createStacks, decodeStacks } from '../world/stacks';
import { STIR_SPACING, stir, waterHit } from '../world/stir';
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

/**
 * A part joins the scene once its shader is compiled (no hitch when it first shows). compileAsync skips hidden
 * objects, so a part that starts hidden is shown for the compile only; its first update decides. A part that fails
 * is left out with a warning; the rest of the world goes on (final review I1).
 */
async function compileThenAdd(app: App, part: WorldPart, name: string): Promise<void> {
  try {
    const shown = part.object.visible;
    part.object.visible = true;
    try {
      await app.pipeline?.compile(part.object);
    } finally {
      part.object.visible = shown;
    }
    app.addPart(part, name);
  } catch (error) {
    console.warn(`${name} failed to join`, error);
  }
}

async function loadBase(
  app: App,
  sky: Sky,
  light: LightUniforms,
  auroraActive: boolean,
  /** the stop the visitor is at when stage B starts: its parts compile first (plan M2.5 Task 8) */
  opening: () => StopId,
  reducedMotion: boolean,
): Promise<void> {
  const dressingMeta = app.manifest.base.dressing;
  const auroraMeta = app.manifest.base.aurora;
  const caveMeta = app.manifest.base.cave;
  const archMeta = app.manifest.base.arch;
  const stacksMeta = app.manifest.base.stacks;
  const cliffsMeta = app.manifest.base.cliffs;
  const groveMeta = app.manifest.base.grove;
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
  // Night's lagoon is fed by the falls, not the sea: no tide bands there (rock.ts). Its middle lies between the pool
  // and the camera; 120 m reaches the bowl's walls.
  // s18: the bowl's own middle (plan M5 Task 1); its walls stand 34-48 m out, the crater's 8 m slopes up to 70 m.
  const lagoon = { x: BOWL.x, y: BOWL.y, r: 62 };
  const terrain = createTerrain(heights, new Uint16Array(ringBuf), colour, meta, sky, cut, lagoon, light);
  const heightMap = heightTexture(heights, meta.heights);
  const sea = createSea(heightMap, meta.heights, light, TIERS[app.tier]);
  // One material for every rock part (D13); the lagoon's fresh water wears no barnacle line (plan M5 Task 1).
  const rock = createRockMaterial(lagoon, light.aurora as unknown as Parameters<typeof createRockMaterial>[1]);
  const parts: [string, WorldPart][] = [
    ['terrain', terrain],
    ['sea', sea],
  ];
  // Night's fireflies and glowing reeds (plan M5 Task 4)
  parts.push(['nightlife', createNightLife(reducedMotion)]);
  // Night's bowl of basalt columns (plan M5 Task 1): made here, no download. Not with `?cams=old`: the old camera
  // stands behind the new south wall.
  if (SHOTS.night.falls && !OLD_CAMS_ON)
    parts.push([
      'bowl',
      createBowl(
        rock,
        { x: SHOTS.night.falls.x, y: SHOTS.night.falls.yLip },
        { x: SHOTS.night.cam[0], y: SHOTS.night.cam[1] },
      ),
    ]);
  // The cove's grass and flowers (plan M3 Task 1): made here from the base heights, no download.
  parts.push(['meadow', createMeadow(scatterCove(createSurfaceSampler(heights, meta.heights)), light)]);
  // The life layer (plan M3 Task 6): gulls, bats, the flock, petals and dew in one sprite draw; First light's fish ring.
  parts.push(['life', createLife(light, createSurfaceSampler(heights, meta.heights), reducedMotion)]);
  if (dressingMeta && dressingBuf) {
    const instances = decodeDressing(new Uint16Array(dressingBuf), dressingMeta, meta.heights);
    parts.push(['dressing', createDressing(instances, heightAt)]);
  }
  // The four unknowns (M2). Each hides itself wherever its hour or place is not in play.
  const { night, midnight } = SHOTS;
  if (auroraData && night.aurora && midnight.aurora)
    // Night's curtains are the corona made here (plan M5 Task 3); Midnight keeps the baked ones
    parts.push([
      'aurora',
      OLD_CAMS_ON
        ? createAurora(auroraData, night.aurora, midnight.aurora, auroraActive)
        : createAurora(
            { ...auroraData, night: coronaCurves() },
            coronaShot(night.aurora),
            midnight.aurora,
            auroraActive,
          ),
    ]);
  if (midnight.cloudsea) parts.push(['cloud', createCloudSea(midnight.cloudsea, heightMap, meta.heights, light)]);
  // the falls in two tiers come from the bowl's alcove (plan M5 Task 2)
  if (night.falls) parts.push(['falls', createWaterfall(fallsLayout(), light)]);
  if (caveShot && caveMeta && caveBuf)
    parts.push(['cave', createCave(decodeCave(caveBuf, caveMeta), caveShot, sky, light)]);
  const byName = new Map(parts);
  // All compiles start at once, nearest parts first (the driver builds pipelines in parallel); each part joins as
  // soon as its own shader is ready, never waiting for one that is slower but not needed here (plan M2.5 Task 8).
  const join = (name: string) => {
    const part = byName.get(name);
    return part ? compileThenAdd(app, part, name) : Promise.resolve();
  };
  // The headland pack (the arch and the stacks, 1.9 MB of rock) and the cove pack (its cliffs and grove, 0.7 MB) are
  // fetched after the base, so the ground and sea never wait for them, and a failed download costs only that pack
  // (final review I1).
  let capsFound: (caps: Float32Array) => void = () => undefined;
  const capsAt = new Promise<Float32Array>((resolve) => {
    capsFound = resolve;
  });
  const surfaceAt = createSurfaceSampler(heights, meta.heights);
  const coveReady = (async () => {
    try {
      const [cliffsBuf, groveBuf] = await Promise.all([
        cliffsMeta ? fetchBinary(cliffsMeta.file) : null,
        groveMeta ? fetchBinary(groveMeta.file) : null,
      ]);
      // Golden's pebbles (s16): made here, drawn with the rock material, so they join with the cove pack
      const joins: Promise<void>[] = [compileThenAdd(app, createPebbles(surfaceAt, rock), 'pebbles')];
      if (cliffsMeta && cliffsBuf)
        joins.push(compileThenAdd(app, createCliffs(decodeCliffs(cliffsBuf, cliffsMeta), cliffsMeta, rock), 'cliffs'));
      if (groveMeta && groveBuf) {
        const grove = createGrove(decodeGrove(groveBuf, groveMeta), surfaceAt, light);
        joins.push(compileThenAdd(app, grove, 'grove'));
        // the stacks' and the arch's scrub caps share the grove's shrub and material (plan M4 Task 3)
        joins.push(
          capsAt.then((caps) => (caps.length ? compileThenAdd(app, createCaps(grove, caps), 'caps') : undefined)),
        );
      }
      await Promise.all(joins);
    } catch (error) {
      console.warn('the cove pack failed to load', error);
    }
  })();
  const rockReady = (async () => {
    try {
      const [archBuf, stacksBuf] = await Promise.all([
        archMeta ? fetchBinary(archMeta.file) : null,
        stacksMeta ? fetchBinary(stacksMeta.file) : null,
      ]);
      const joins: Promise<void>[] = [];
      // Blue hour's sea sparkle lights where the rock meets the water (plan M4 Task 1)
      const feet: Float32Array[] = [];
      const caps: Float32Array[] = [];
      if (archMeta && archBuf) {
        const parts = decodeArch(archBuf, archMeta);
        feet.push(waterline(parts.position, parts.index, archMeta));
        caps.push(capInstances(parts.position, parts.index, archMeta, 11));
        joins.push(compileThenAdd(app, createArch(parts, archMeta, rock), 'arch'));
      }
      if (stacksMeta && stacksBuf) {
        const parts = decodeStacks(stacksBuf, stacksMeta);
        feet.push(waterline(parts.position, parts.index, stacksMeta));
        caps.push(capInstances(parts.position, parts.index, stacksMeta, 12));
        joins.push(compileThenAdd(app, createStacks(parts, stacksMeta, rock), 'stacks'));
      }
      capsFound(new Float32Array(caps.flatMap((c) => Array.from(c))));
      const all = new Float32Array(feet.reduce((n, a) => n + a.length, 0));
      feet.reduce((o, a) => (all.set(a, o), o + a.length), 0);
      joins.push(compileThenAdd(app, createPlankton(all, reducedMotion), 'plankton'));
      await Promise.all(joins);
    } catch (error) {
      console.warn('the headland rock failed to load', error);
    }
    capsFound(new Float32Array(0)); // no rock, no caps (a second resolve is a no-op)
  })();
  // two waves: what the opening stop shows, then the rest (sharing the driver with far parts slowed the near ones)
  const stop = opening();
  const order = partOrder([...byName.keys()], stop);
  const here = order.filter((n) => PART_STOPS[n]?.has(stop));
  await Promise.all(here.map(join));
  await Promise.all(order.filter((n) => !here.includes(n)).map(join));
  await Promise.all([rockReady, coveReady]);
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
  /** Set by look-around when a touch turns the head; such a touch never snaps the scroll. */
  const gesture = { turned: false };
  createTouchSnap({
    progress: () => scroll.progress(),
    // A swipe that stops short carries on to the next place at the ride's pace, never cutting a flight short.
    glideTo: (p) => {
      const from = cameraU(performance.now());
      scroll.glideToProgress(p, true, Math.max(500, rideMs(track, from, p * track.total)));
    },
    stops: snapStops(track),
    enabled: () => params.p === undefined,
    turnedHead: () => gesture.turned,
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
  // the cove's plants draw for the eye but not in the water's mirror (meadow.ts, sea.ts)
  camera.layers.enable(EYE_ONLY_LAYER);
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

  // `?cams=old` (D31): Sunset's and Dusk's pre-M3 cameras, with the flights baked to them then
  const paths = (flightPaths as FlightPath[]).map((p) =>
    OLD_CAMS_ON ? ((flightPathsOld as FlightPath[]).find((o) => o.from === p.from && o.to === p.to) ?? p) : p,
  );
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
  // First light's mist (plan M3 Task 3) is height fog in the same colour, folded into the one fog: no draw, and the
  // mirror pass shows it because it renders this scene. Zero at every hour but First light and Sunrise.
  const mist = createMist();
  const haze = densityFogFactor(light.fogDensity);
  scene.fogNode = fog(
    sky.horizonAt(positionWorld.sub(cameraPosition)),
    haze.oneMinus().mul(mist.factor.oneMinus()).oneMinus(),
  );
  app.addPart(sky, 'sky');
  app.addPart(mist.part, 'mist');
  // Golden's paper lantern, the first near layer (plan M2.5 Task 7), and the glints of its spots: no download, so
  // they join with the first view.
  // Both are compiled before they join, so opening anywhere else they never compile mid-flight (final review M7).
  const lantern = createLantern();
  // the walks at Sunset and Dusk start from the new cameras: none there under `?cams=old`
  const LIVE_SPOTS = OLD_CAMS_ON ? SPOTS.filter((sp) => !(sp.stop in OLD_CAMS)) : SPOTS;
  const glints = createSpotGlints(LIVE_SPOTS);
  // The lantern thread (plan M3 Task 5): the lantern claimed at Golden drifts among Dusk's and rests in First light's
  // shallows. Kept for this visit (sessionStorage; the accessor itself can throw in a locked-down browser).
  const store = (() => {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  })();
  const thread = loadThread(store);
  const duskLanterns = createDuskLanterns(caps.reducedMotion);
  const [fl, sr] = [STOP_IDS.indexOf('firstlight'), STOP_IDS.indexOf('sunrise')];
  const shallows = createLantern({
    at: SHALLOWS_AT,
    inPlay: (s) =>
      thread.claimed &&
      ((s.kind === 'stop' && (s.a === fl || s.a === sr)) ||
        (s.kind === 'flight' && ((s.b === fl && s.t > 0.5) || s.a === fl || (s.a === sr && s.t < 0.5)))),
    // dim at First light; at Sunrise the sun takes over
    level: (s) => (s.kind === 'stop' ? (s.a === sr ? 0.3 : 0.6) : s.a === fl && s.b === sr ? 0.6 - 0.3 * s.t : 0.6),
  });
  const claimLantern = () => {
    lantern.claim();
    thread.claimed = true;
    saveThread(store, thread);
    duskLanterns.setMine(true);
  };
  if (thread.claimed) {
    lantern.claim();
    duskLanterns.setMine(true);
  }
  // Joined once the pipeline has its scene: before that its compile is a no-op, and a part hidden at the start (Dusk's
  // lanterns, the shallows lantern) then built its shaders on its first trip, mid-flight (s16: 150 ms into Dusk).
  const joinNear = () =>
    Promise.all([
      compileThenAdd(app, lantern, 'lantern'),
      compileThenAdd(app, glints, 'spots'),
      compileThenAdd(app, duskLanterns, 'lanterns'),
      compileThenAdd(app, shallows, 'shallows'),
    ]);
  const goldenCam = STOPS[0]?.cam ?? [0, 0, 0];
  /** ruling R3: the lantern is the nearest thing in Golden's view, so the parallax slides it ~3 % of the width */
  const lanternNear = Math.hypot(LANTERN_AT[0] - goldenCam[0], LANTERN_AT[1] - goldenCam[1]);
  let walk: { spot: SpotPath; startMs: number; durMs: number } | null = null;
  let walkW = 0;
  let spotPose: Pose | null = null;
  const startWalk = (spot: SpotPath | undefined) => {
    if (!spot || !LIVE_SPOTS.includes(spot) || !spotsOpen(walk !== null, walkW)) return;
    walk = { spot, startMs: performance.now(), durMs: SPOT_WALK_MS(spot) };
    glints.setWalking(true);
  };
  const spotsEl = document.getElementById('spots');
  const spotButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-spot]')];
  let twinsAt = -1;
  for (const b of spotButtons) b.addEventListener('click', () => startWalk(SPOTS.find((s) => s.id === b.dataset.spot)));
  const toScreen = (v: Vector3) => {
    const p = v.clone().project(camera);
    return [((p.x + 1) / 2) * window.innerWidth, ((1 - p.y) / 2) * window.innerHeight, p.z] as const;
  };
  window.__lanternPx = () => {
    const [x, y] = toScreen(lantern.centre);
    return [x, y];
  };
  /** Leave a spot: the camera eases back to the stop (a click on empty world, or Esc). */
  const endWalk = () => {
    if (!walk) return false;
    walk = null;
    return true;
  };
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') endWalk();
  });
  /** A tap or click on the world: a glint starts its walk; the lantern becomes the visitor's; elsewhere, back. */
  const pick = (x: number, y: number) => {
    if (glints.object.visible)
      for (const g of glints.at) {
        if (!g.sprite.visible) continue;
        const [gx, gy, gz] = toScreen(g.position);
        if (gz < 1 && Math.hypot(gx - x, gy - y) < 40) return startWalk(g.spot);
      }
    if (lantern.object.visible) {
      const [lx, ly, lz] = toScreen(lantern.centre);
      if (lz < 1 && Math.hypot(lx - x, ly - y) < 60) return claimLantern();
    }
    endWalk();
  };

  const startedAt = performance.now();
  let last: FrameState | null = null;

  // Pointer parallax (D28): a mouse or pen moves the view at once; touch scrolls, and gets tilt later (D27).
  const pointer: [number, number] = [0, 0];
  const slide: [number, number] = [0, 0];
  let touchAt: [number, number] | null = null;
  let pointerSeen = false;
  const ray = new Vector3();
  window.addEventListener(
    'pointermove',
    (event) => {
      const x = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const y = 1 - (event.clientY / Math.max(1, window.innerHeight)) * 2;
      // a finger on the water stirs it while it is down (plan M4 Task 1); it never moves the parallax
      if (event.pointerType === 'touch') {
        if (touchAt) touchAt = [x, y];
        return;
      }
      pointer[0] = x;
      pointer[1] = y;
      pointerSeen = true;
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    pointer[0] = 0;
    pointer[1] = 0;
    pointerSeen = false;
  });
  window.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType !== 'touch') return;
      touchAt = [
        (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1,
        1 - (event.clientY / Math.max(1, window.innerHeight)) * 2,
      ];
    },
    { passive: true },
  );
  const lift = (event: PointerEvent) => {
    if (event.pointerType === 'touch') touchAt = null;
  };
  window.addEventListener('pointerup', lift, { passive: true });
  window.addEventListener('pointercancel', lift, { passive: true });

  // Look-around (plan M2.5 Task 6; Amendment 1 §6): drag on the world to turn the head. A mouse drags with the button
  // held; a touch drag turns the head when its first 12 px run more sideways than up or down (the world layer is
  // `touch-action: pan-y`, so the browser keeps vertical drags for scrolling and never scrolls on a sideways one).
  const look = createLook();
  let head = { yaw: 0, pitch: 0 };
  window.__look = () => ({ ...head });
  const worldLayer = document.getElementById('world');
  let grab: { id: number; x: number; y: number; touch: boolean; turning: boolean; moved: number } | null = null;
  window.addEventListener(
    'pointerdown',
    (event) => {
      gesture.turned = false; // every touch starts unclaimed, on the rail too (final review M10)
      if (!worldLayer?.contains(event.target as Node) || (event.pointerType === 'mouse' && event.button !== 0)) return;
      const touch = event.pointerType === 'touch';
      grab = { id: event.pointerId, x: event.clientX, y: event.clientY, touch, turning: !touch, moved: 0 };
    },
    { passive: true },
  );
  window.addEventListener(
    'pointermove',
    (event) => {
      if (!grab || event.pointerId !== grab.id) return;
      if (dragEnded(event.pointerType, event.buttons)) {
        grab = null;
        return;
      }
      const dx = event.clientX - grab.x;
      const dy = event.clientY - grab.y;
      if (!grab.turning) {
        const intent = touchIntent(dx, dy, last?.resting === true);
        if (intent === 'wait') return;
        if (intent !== 'turn') {
          grab = null; // a vertical drag (the browser scrolls), or a sideways one mid-flight (the touch snap goes on)
          return;
        }
        grab.turning = true;
        gesture.turned = true;
      }
      grab.moved += Math.hypot(dx, dy);
      look.drag(dx, dy, Math.max(1, window.innerWidth));
      grab.x = event.clientX;
      grab.y = event.clientY;
    },
    { passive: true },
  );
  const letGo = (event: PointerEvent) => {
    if (grab && event.pointerId === grab.id) grab = null;
  };
  window.addEventListener(
    'pointerup',
    (event) => {
      if (grab && event.pointerId === grab.id && grab.moved < 6) pick(event.clientX, event.clientY);
      letGo(event);
    },
    { passive: true },
  );
  window.addEventListener('pointercancel', letGo, { passive: true });

  const frame = (nowMs: number, dtS: number): WorldFrame => {
    const u = app.override ?? cameraU(nowMs);
    const state = frameAt(track, u, caps.reducedMotion);
    const timeS = (nowMs - startedAt) / 1000;
    const pose = poseAt(state, paths, camera.aspect, timeS, caps.reducedMotion);
    // A spot's walk (plan M2.5 Task 7): along its baked path at 1.2 m/s, eased at both ends; scrolling on leaves from
    // wherever you are, easing back to the journey's path.
    const here = walk && state.resting && state.a === stopIndex(walk.spot.stop);
    if (walk && !here) walk = null;
    if (walk) {
      // reduced motion: a cut to the spot, as jumps between places cut (final review M13)
      const k = caps.reducedMotion ? 1 : Math.min(1, (nowMs - walk.startMs) / walk.durMs);
      spotPose = sampleSpot(walk.spot, easeInOutSine(k), camera.aspect);
    }
    if (caps.reducedMotion) walkW = walk ? 1 : 0;
    else walkW += ((walk ? 1 : 0) - walkW) * (1 - Math.exp(-8 * dtS));
    const open = spotsOpen(walk !== null, walkW);
    glints.setWalking(!open);
    if (spotPose && walkW > 0.001) {
      const w = walkW;
      pose.position = [
        pose.position[0] + (spotPose.position[0] - pose.position[0]) * w,
        pose.position[1] + (spotPose.position[1] - pose.position[1]) * w,
        pose.position[2] + (spotPose.position[2] - pose.position[2]) * w,
      ];
      pose.yaw = shortestYaw(pose.yaw, spotPose.yaw, w);
      pose.pitch += (spotPose.pitch - pose.pitch) * w;
    }
    const twinsHidden = !(state.resting && spotsAt(state.a).some((sp) => LIVE_SPOTS.includes(sp)) && open);
    if (spotsEl && spotsEl.hidden !== twinsHidden) spotsEl.hidden = twinsHidden;
    if (!twinsHidden && twinsAt !== state.a) {
      // each stop offers its own spots (plan M3 Task 7)
      twinsAt = state.a;
      for (const b of spotButtons) b.hidden = SPOTS.find((s) => s.id === b.dataset.spot)?.stop !== STOP_IDS[state.a];
    }
    head = look.update(state.resting && !caps.reducedMotion, dtS);
    pose.yaw += head.yaw;
    pose.pitch += head.pitch;
    if (!caps.reducedMotion) {
      const atStop = state.t < 0.5 ? state.a : state.b;
      // At Golden the lantern sets the slide: it moves ~3 % of the width (owner, s11; the sand at the frame's foot,
      // nearer, moves a little more). Elsewhere the nearest ground in view does.
      const near = atStop === 0 && !walk ? lanternNear : (app.nearM[atStop] ?? 10);
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
    if (lantern.object.visible) {
      const [lx, ly] = toScreen(lantern.centre);
      const px = ((pointer[0] + 1) / 2) * window.innerWidth;
      const py = ((1 - pointer[1]) / 2) * window.innerHeight;
      lantern.setHover(Math.hypot(lx - px, ly - py) < 70);
    }
    const hour = blendHours(
      HOURS[STOP_IDS[state.a] ?? 'golden'],
      HOURS[STOP_IDS[state.b] ?? 'golden'],
      state.hourWeight,
    );
    const ambA = ambients[state.a] ?? ambients[0];
    const ambB = ambients[state.b] ?? ambients[0];
    if (ambA && ambB) light.apply(lightValues(hour, ambA, ambB, state.skyWeight), camera.position);
    // Sea sparkle answers the pointer and a wading visitor's feet (plan M4 Task 1): stir where they meet the water.
    if (hour.plankton > 0.01) {
      // one stroke at a time: the feet while wading, else the pointer (both share the ring's last point)
      const at = touchAt ?? (pointerSeen ? pointer : null);
      if (walk && pose.position[1] < 1.6) {
        // the legs are a stride ahead of the eye (coast yaw: forward is (sin, cos) → three.js (sin, −cos))
        const yaw = (pose.yaw * Math.PI) / 180;
        stir(
          planktonStirs,
          pose.position[0] + Math.sin(yaw) * 0.9,
          pose.position[2] - Math.cos(yaw) * 0.9,
          timeS,
          1.4,
          0.6,
        );
      } else if (at) {
        const d = ray.set(at[0], at[1], 0.5).unproject(camera).sub(camera.position);
        const hit = waterHit([camera.position.x, camera.position.y, camera.position.z], [d.x, d.y, d.z]);
        if (hit) {
          const far = Math.hypot(hit[0] - camera.position.x, hit[1] - camera.position.z);
          stir(planktonStirs, hit[0], hit[1], timeS, 1, Math.max(STIR_SPACING, far * 0.03));
        }
      }
    }
    // Night's fireflies drift toward where the pointer (or a finger) meets the water (plan M5 Task 4)
    if (nightWeight(state) > 0.5) {
      const at = touchAt ?? (pointerSeen ? pointer : null);
      if (at) {
        const d = ray.set(at[0], at[1], 0.5).unproject(camera).sub(camera.position);
        const hit = waterHit([camera.position.x, camera.position.y, camera.position.z], [d.x, d.y, d.z]);
        if (hit && Math.hypot(hit[0] - camera.position.x, hit[1] - camera.position.z) < 40) {
          nightLure.x = hit[0];
          nightLure.z = hit[1];
          nightLure.atS = timeS;
        }
      }
    }
    last = state;
    return { state, hour, pose, timeS, dtS };
  };

  if (pipeline) {
    const active = pipeline;
    active.setScene(scene, camera, light);
    applyTier(tier);
    const nearReady = joinNear();
    new ResizeObserver(() => {
      camera.aspect = host.clientWidth / Math.max(1, host.clientHeight);
      camera.updateProjectionMatrix();
      active.resize(host.clientWidth, host.clientHeight);
    }).observe(host);

    // Stage A: the skies of the place the visit starts at (a link may open on any place), then a hidden warm-up frame,
    // then the fade-in (spec §12, review I2). A failed sky still fades in; the store retries.
    const start = frameAt(track, scroll.progress() * track.total, caps.reducedMotion);
    await Promise.all([skies.ready(start.a), skies.ready(start.b), nearReady]).catch(() => undefined);
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
    const opening = (): StopId =>
      STOP_IDS[last ? (last.kind === 'stop' || last.t < 0.5 ? last.a : last.b) : 0] ?? 'golden';
    app.stageB = loadBase(app, sky, light, params.auroraActive, opening, caps.reducedMotion)
      .then(() => governor.reset(app.tier, performance.now()))
      .catch((error: unknown) => console.warn('world base failed to load', error));
  } else {
    void joinNear();
  }
  void last;
  installBench(app);
  if (params.hud) installHud(app);
  // Development only: the running app, for checks from the browser console and the headed test browser.
  if (import.meta.env.DEV) (window as unknown as { __app: App }).__app = app;
  return app;
}
