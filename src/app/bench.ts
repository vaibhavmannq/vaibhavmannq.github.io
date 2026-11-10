import type { Material, Mesh } from 'three/webgpu';
import { stopCentre } from '../journey/timeline';
import { STOP_IDS, type StopId } from '../journey/types';
import { TIER_NAMES, type Tier } from '../quality/tiers';
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
  }
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

export function installBench(app: App): void {
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
