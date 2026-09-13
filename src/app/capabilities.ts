import type { DeviceHints } from '../quality/tiers';

export interface Capabilities extends DeviceHints {
  reducedMotion: boolean;
  /** Capped at 2: rendering phone screens at 3× costs a lot for little visible gain (spec §8). */
  devicePixelRatio: number;
}

type NavigatorHints = Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };

export function detectCapabilities(): Capabilities {
  const nav = navigator as NavigatorHints;
  return {
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    saveData: nav.connection?.saveData === true,
    deviceMemoryGB: nav.deviceMemory,
    // Only a hint; the renderer reports the backend it really got after init()
    webgpu: 'gpu' in navigator,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  };
}
