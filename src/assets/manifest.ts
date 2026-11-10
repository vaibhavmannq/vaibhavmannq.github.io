import type { RGB, StopId } from '../journey/types';
import type { GridMeta, RingMeta } from '../world/heights';

/** A: needed for the first view. B: everything else, fetched once A is in (spec §12). */
export type Stage = 'A' | 'B';

export interface FileEntry {
  /** Relative to /world/. */
  path: string;
  bytes: number;
  sha256: string;
  stage: Stage;
  /** The stops that need this file, or 'all' for the world base. */
  stops: StopId[] | 'all';
}

export interface SkyAmbient {
  ambientSky: RGB;
  ambientGround: RGB;
}

export interface Manifest {
  version: 1;
  base: { heights: GridMeta; ring: RingMeta };
  skies: Partial<Record<StopId, SkyAmbient & { file: string }>>;
  files: FileEntry[];
}

export interface Budgets {
  stageABytes: number;
  perStopBytes: number;
}

/** Spec §14: the first view's world files stay under 1.2 MB (1.6 MB with code); each stop adds at most 3 MB. */
export const BUDGETS: Budgets = { stageABytes: 1.2e6, perStopBytes: 3e6 };

const mb = (bytes: number) => `${(bytes / 1e6).toFixed(2)} MB`;

export function checkBudgets(m: Manifest, b: Budgets): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  let ok = true;
  const stageA = m.files.filter((f) => f.stage === 'A').reduce((sum, f) => sum + f.bytes, 0);
  const aOver = stageA > b.stageABytes;
  ok &&= !aOver;
  lines.push(`stage A ${mb(stageA)} of ${mb(b.stageABytes)}${aOver ? ' — over' : ''}`);
  const perStop = new Map<string, number>();
  for (const f of m.files) {
    if (f.stops === 'all') continue;
    for (const stop of f.stops) perStop.set(stop, (perStop.get(stop) ?? 0) + f.bytes);
  }
  for (const [stop, bytes] of perStop) {
    const over = bytes > b.perStopBytes;
    ok &&= !over;
    lines.push(`${stop} ${mb(bytes)} of ${mb(b.perStopBytes)}${over ? ' — over' : ''}`);
  }
  const shared = m.files.filter((f) => f.stops === 'all').reduce((sum, f) => sum + f.bytes, 0);
  lines.push(`world base (shared by every stop) ${mb(shared)}`);
  return { ok, lines };
}
