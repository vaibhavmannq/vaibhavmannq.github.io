import Lenis from 'lenis';
import { clamp01 } from '../shared/math';
import { progressFrom } from './progress';

export interface ScrollController {
  /** 0..1 of the journey track. */
  progress(): number;
  /** Advance Lenis's smoothing; called once per frame by the loop. */
  raf(nowMs: number): void;
  scrollToProgress(p: number, immediate: boolean): void;
  setLocked(locked: boolean): void;
  destroy(): void;
}

export function createScroll(): ScrollController {
  // Wheel/trackpad are smoothed; touch keeps the phone's native momentum (spec §8).
  // Lenis already disables smoothing for visitors whose OS asks for reduced motion.
  const lenis = new Lenis({ autoRaf: false, smoothWheel: true, syncTouch: false, lerp: 0.1 });

  return {
    progress: () => progressFrom(lenis.scroll, lenis.limit),
    raf: (nowMs) => lenis.raf(nowMs),
    scrollToProgress: (p, immediate) => lenis.scrollTo(clamp01(p) * lenis.limit, { immediate, force: true }),
    setLocked: (locked) => {
      if (locked) lenis.stop();
      else lenis.start();
    },
    destroy: () => lenis.destroy(),
  };
}
