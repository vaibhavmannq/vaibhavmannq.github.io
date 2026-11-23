import {
  DataTexture,
  Group,
  type Material,
  Mesh,
  MeshStandardNodeMaterial,
  RGBAFormat,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three/webgpu';
import { STOPS } from '../journey/stops';
import { stopCentre } from '../journey/timeline';
import { STOP_IDS, type StopId, toThree } from '../journey/types';
import { TIER_NAMES, type Tier } from '../quality/tiers';
import { EYE_ONLY_LAYER } from '../world/meadow';
import type { App } from './boot';

export interface FlightResult {
  frames: number;
  fps: number;
  p95: number;
  max: number;
  over20: number;
  over50: number;
  /** Where on the journey (screens) each frame over 50 ms happened, and how long it took. */
  slow: { u: number; ms: number }[];
}

export interface CensusRow {
  stop: StopId;
  draws: number;
  triangles: number;
  materials: number;
}

declare global {
  interface Window {
    /** Fly the whole night linearly over `seconds` at a tier, counting every rendered frame (s02's method). */
    __flight(tier: (typeof TIER_NAMES)[number], seconds: number): Promise<FlightResult>;
    /** One frame at every stop: draws, triangles and distinct materials (spec §14). */
    __census(): Promise<CensusRow[]>;
    /** The part (and object) that draws with material `id` (a pipeline label's number), for first-build hunts. */
    __whoIs(id: number): string[];
    /** Hold the camera on flight `flight` (from stop `flight`) at fraction `t`; resolves after three rendered frames. */
    __flightPose(flight: number, t: number): Promise<void>;
    /** When each part joined the scene, ms after navigation start, and when the scene was first shown. */
    __joined(): Record<string, number>;
    /** Resolves once stage B (the world base and every part in it) is in the scene. */
    __stageB(): Promise<void>;
    /** Temporary (M8.5 #17): settings over the tier's (scale, reflect, bloom, grass, leaves); {} restores. */
    __quality(q: Partial<import('../quality/tiers').TierSettings>): void;
    /** Hold the named parts hidden until called again (plan M2 Task 7's on/off switch). */
    __parts(off: string[]): void;
    /** Keep the named parts out of the sea's mirror (s27 R203 cost probe); [] restores. */
    __mirrorOff(names: string[]): void;
    /** Rest at a stop (or at track position `u`) for `seconds` at a tier: frame times, and the GPU's own ms per frame when `?gpu` is on. */
    __hold(stop: StopId | number, seconds: number, tier: (typeof TIER_NAMES)[number]): Promise<HoldResult>;
    /** The head's look-around turn now, degrees (plan M2.5 Task 6). */
    __look(): { yaw: number; pitch: number };
    /** Golden's lantern on screen, CSS pixels (plan M2.5 Task 7: its parallax slide is measured). */
    __lanternPx(): [number, number];
    __projectPx(): number[][];
    /**
     * A synthetic close-up set in front of stop `stop`'s camera (world-to-100 Task 3, the GPU ceiling): `draws` lit
     * meshes sharing `tris` triangles, one 1024² texture each until `texMB`; in the mirror unless `mirror` is false.
     * Compiled for the eye and the mirror before it shows. `null` removes it.
     */
    /** Each place's close-up set state (world-to-100 Task 4): none, fetching, ready or shown. */
    __sets(): Record<string, string>;
    __load(opts: LoadOptions | null): Promise<{ draws: number; tris: number; texMB: number } | null>;
  }
}

export interface LoadOptions {
  stop: StopId;
  tris?: number;
  draws?: number;
  texMB?: number;
  mirror?: boolean;
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Wait for `n` frames that really rendered and read the renderer's counters straight after the last one. The counters
 * reset on every animation frame, and the pacer skips some (it measures the screen first), so reading them on a
 * plain requestAnimationFrame can see an empty frame.
 */
function afterRenders(app: App, n: number): Promise<{ draws: number; triangles: number }> {
  return new Promise((resolve) => {
    let left = n;
    const hook = () => {
      left -= 1;
      if (left > 0) return;
      app.onFrame.splice(app.onFrame.indexOf(hook), 1);
      const info = app.pipeline?.renderer.info.render;
      resolve({ draws: info?.drawCalls ?? 0, triangles: info?.triangles ?? 0 });
    };
    app.onFrame.push(hook);
  });
}

/** Distinct materials on visible meshes: each is a shader the renderer must build (D13). */
function countMaterials(app: App): number {
  const seen = new Set<Material>();
  app.scene.traverseVisible((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) seen.add(m);
  });
  return seen.size;
}

export interface HoldResult {
  frames: number;
  fps: number;
  p95: number;
  max: number;
  /** Median and 95th percentile GPU ms per frame; null without `?gpu` or where the backend has no timer. */
  gpuMs: number | null;
  gpuP95: number | null;
}

const pct = (xs: number[], q: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return Math.round((s[Math.min(s.length - 1, Math.floor(s.length * q))] ?? 0) * 100) / 100;
};

/** One 1024² RGBA texture with its mips: 4 MiB × 4/3. */
const TEX_MB = (1024 * 1024 * 4 * 4) / 3 / 2 ** 20;

function noiseTexture(seed: number): DataTexture {
  const n = 1024;
  const data = new Uint8Array(n * n * 4);
  let x = seed * 2654435761;
  for (let i = 0; i < data.length; i++) {
    x = (x ^ (x << 13)) >>> 0;
    x = (x ^ (x >>> 17)) >>> 0;
    x = (x ^ (x << 5)) >>> 0;
    data[i] = i % 4 === 3 ? 255 : 90 + (x % 120);
  }
  const t = new DataTexture(data, n, n, RGBAFormat);
  t.colorSpace = SRGBColorSpace;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export function installBench(app: App): void {
  window.__sets = () => Object.fromEntries(STOP_IDS.map((id) => [id, app.streamer?.state(id) ?? 'none']));
  let load: { group: Group; dispose(): void } | null = null;
  window.__load = async (opts) => {
    if (load) {
      app.scene.remove(load.group);
      load.dispose();
      load = null;
    }
    if (!opts) return null;
    const stop = STOPS[STOP_IDS.indexOf(opts.stop)];
    if (!stop) throw new Error(`no stop ${opts.stop}`);
    const textures = Math.ceil((opts.texMB ?? 0) / TEX_MB);
    const draws = Math.max(1, opts.draws ?? 1, textures);
    const per = Math.max(2, (opts.tris ?? 0) / draws);
    const seg = Math.max(3, Math.ceil(Math.sqrt(per / 2)));
    const geometry = new SphereGeometry(1, seg, seg + 1);
    const plain = new MeshStandardNodeMaterial({ color: 0x8a8070, roughness: 0.9 });
    const maps: DataTexture[] = [];
    const materials: MeshStandardNodeMaterial[] = [plain];
    const group = new Group();
    const yaw = (stop.landscape.yaw * Math.PI) / 180;
    let r = 12345;
    const rand = () => {
      r = (r * 16807) % 2147483647;
      return r / 2147483647;
    };
    for (let i = 0; i < draws; i++) {
      let material = plain;
      if (i < textures) {
        const map = noiseTexture(i + 1);
        maps.push(map);
        material = new MeshStandardNodeMaterial({ map, roughness: 0.9 });
        materials.push(material);
      }
      const mesh = new Mesh(geometry, material);
      // scattered 12–80 m ahead, ±35° of the stop's gaze, on the eye's level ±4 m
      const a = yaw + (rand() - 0.5) * 1.2;
      const d = 12 + rand() * 68;
      const c = stop.cam;
      mesh.position.set(...toThree([c[0] + Math.sin(a) * d, c[1] + Math.cos(a) * d, c[2] + (rand() - 0.5) * 8]));
      mesh.scale.setScalar(0.4 + rand() * 1.2);
      if (opts.mirror === false) mesh.layers.set(EYE_ONLY_LAYER);
      group.add(mesh);
    }
    await app.pipeline?.compile(group, { mirror: opts.mirror !== false });
    app.scene.add(group);
    load = {
      group,
      dispose() {
        geometry.dispose();
        for (const m of materials) m.dispose();
        for (const t of maps) t.dispose();
      },
    };
    const tris = (geometry.index ? geometry.index.count : geometry.attributes.position!.count) / 3;
    return { draws, tris: Math.round(tris * draws), texMB: Math.round(textures * TEX_MB) };
  };

  window.__joined = () => Object.fromEntries([...app.joined].map(([k, v]) => [k, Math.round(v)]));
  window.__stageB = () => app.stageB;
  window.__quality = (q) => app.setQuality(q);

  // s33 16a: the screen pixels each drawn cloud card covers, summed (overdraw in screens), field and banks apart
  (window as unknown as { __cloudPx: () => unknown }).__cloudPx = () => {
    const mesh = app.parts.get('clouds')?.object as
      | {
          geometry: {
            instanceCount: number;
            getAttribute(n: string): { getX(i: number): number; getY(i: number): number; getZ(i: number): number };
          };
        }
      | undefined;
    if (!mesh) return null;
    const g = mesh.geometry;
    const c = g.getAttribute('iCenter');
    const sz = g.getAttribute('iSize');
    const cam = app.camera;
    cam.updateMatrixWorld();
    const W = innerWidth;
    const H = innerHeight;
    let field = 0;
    let banks = 0;
    let n = 0;
    const e = cam.position;
    const p = new Vector3();
    for (let i = 0; i < g.instanceCount; i++) {
      const cx = c.getX(i);
      const cy = c.getY(i);
      const cz = c.getZ(i);
      let fx = e.x - cx;
      let fz = e.z - cz;
      const fl = Math.hypot(fx, fz) || 1;
      fx /= fl;
      fz /= fl;
      const w = sz.getX(i);
      const h = sz.getY(i);
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      let behind = false;
      for (const [a, b] of [
        [-0.5, 0],
        [0.5, 0],
        [-0.5, 1],
        [0.5, 1],
      ] as const) {
        p.set(cx + fz * a * w, cy + b * h, cz - fx * a * w);
        p.applyMatrix4(cam.matrixWorldInverse);
        if (p.z > -1) behind = true;
        p.applyMatrix4(cam.projectionMatrix);
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y);
        y1 = Math.max(y1, p.y);
      }
      if (behind) continue;
      const px =
        ((Math.max(-1, Math.min(1, x1)) - Math.max(-1, Math.min(1, x0))) / 2) *
        W *
        (((Math.max(-1, Math.min(1, y1)) - Math.max(-1, Math.min(1, y0))) / 2) * H);
      if (px <= 0) continue;
      n++;
      // banks are flattened (iInfo.z's fade is 0.3 × … for banks): tell them by their aspect instead, wide and low
      const ud = (mesh as unknown as { userData: { bank?: Uint8Array; kept?: Float32Array } }).userData;
      const k = ud.kept?.[i] ?? 1;
      if (ud.bank?.[i]) banks += px * k;
      else field += px * k;
    }
    return { field: +(field / (W * H)).toFixed(2), banks: +(banks / (W * H)).toFixed(2), cards: n };
  };

  window.__parts = (off) => {
    app.partsOff = new Set(off);
  };

  const masks = new Map<object, number>();
  window.__mirrorOff = (names) => {
    for (const [name, part] of app.parts)
      part.object.traverse((o) => {
        if (!masks.has(o)) masks.set(o, o.layers.mask);
        if (names.includes(name)) o.layers.set(EYE_ONLY_LAYER);
        else o.layers.mask = masks.get(o) as number;
      });
  };

  window.__hold = async (stop, seconds, tierName) => {
    const tier = TIER_NAMES.indexOf(tierName) as Tier;
    if (tier >= 0) app.setTier(tier);
    await app.stageB;
    app.override = typeof stop === 'number' ? stop : stopCentre(app.track, STOP_IDS.indexOf(stop));
    for (let i = 0; i < 30; i++) await nextFrame();
    const intervals: number[] = [];
    const gpu: number[] = [];
    const renderer = app.pipeline?.renderer;
    const timed = renderer !== undefined && (renderer.backend as { trackTimestamp?: boolean }).trackTimestamp === true;
    const collect = (_: unknown, __: number, dtMs: number) => {
      intervals.push(dtMs);
      if (timed)
        void renderer
          .resolveTimestampsAsync('render')
          .then((ms) => {
            if (typeof ms === 'number' && ms > 0) gpu.push(ms);
          })
          .catch(() => undefined);
    };
    app.onFrame.push(collect);
    const start = performance.now();
    while (performance.now() - start < seconds * 1000) {
      window.dispatchEvent(new PointerEvent('pointermove'));
      await nextFrame();
    }
    app.onFrame.splice(app.onFrame.indexOf(collect), 1);
    app.override = null;
    const total = intervals.reduce((s, x) => s + x, 0);
    return {
      frames: intervals.length,
      fps: Math.round((intervals.length / Math.max(1, total)) * 1000 * 10) / 10,
      p95: pct(intervals, 0.95),
      max: pct(intervals, 1),
      gpuMs: gpu.length ? pct(gpu, 0.5) : null,
      gpuP95: gpu.length ? pct(gpu, 0.95) : null,
    };
  };

  window.__flight = async (tierName, seconds) => {
    const tier = TIER_NAMES.indexOf(tierName) as Tier;
    if (tier >= 0) app.setTier(tier);
    await app.stageB;
    const intervals: number[] = [];
    const slow: { u: number; ms: number }[] = [];
    const collect = (_: unknown, __: number, dtMs: number) => {
      intervals.push(dtMs);
      if (dtMs > 50) slow.push({ u: Math.round((app.override ?? 0) * 100) / 100, ms: Math.round(dtMs) });
    };
    app.override = 0;
    for (let i = 0; i < 10; i++) await nextFrame();
    app.onFrame.push(collect);
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        const t = (now - start) / (seconds * 1000);
        app.override = Math.min(1, t) * app.track.total;
        // A visitor flying the night is scrolling; without input the loop drops to its idle half rate after 8 s.
        window.dispatchEvent(new PointerEvent('pointermove'));
        if (t >= 1) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    app.onFrame.splice(app.onFrame.indexOf(collect), 1);
    app.override = null;
    const sorted = [...intervals].sort((a, b) => a - b);
    const total = intervals.reduce((s, x) => s + x, 0);
    return {
      frames: intervals.length,
      fps: Math.round((intervals.length / total) * 1000 * 10) / 10,
      p95: Math.round((sorted[Math.floor(sorted.length * 0.95)] ?? 0) * 10) / 10,
      max: Math.round((sorted[sorted.length - 1] ?? 0) * 10) / 10,
      over20: intervals.filter((x) => x > 20).length,
      over50: intervals.filter((x) => x > 50).length,
      slow,
    };
  };

  window.__flightPose = async (flight, t) => {
    await app.stageB;
    const seg = app.track.segments.find((s) => s.kind === 'flight' && s.from === flight);
    if (!seg) throw new Error(`no flight ${flight}`);
    app.override = seg.start + (seg.end - seg.start) * t;
    await afterRenders(app, 3);
  };

  window.__whoIs = (id) => {
    const out: string[] = [];
    for (const [name, part] of app.parts)
      part.object.traverse((o) => {
        const m = (o as Mesh).material;
        if (m && (Array.isArray(m) ? m : [m]).some((x) => (x as unknown as { id: number }).id === id))
          out.push(`${name}/${o.name || o.type}`);
      });
    return out;
  };

  window.__census = async () => {
    await app.stageB;
    const rows: CensusRow[] = [];
    for (let i = 0; i < STOP_IDS.length; i++) {
      app.override = stopCentre(app.track, i);
      const { draws, triangles } = await afterRenders(app, 3);
      rows.push({ stop: STOP_IDS[i] as StopId, draws, triangles, materials: countMaterials(app) });
    }
    app.override = null;
    return rows;
  };
}
