import Lenis from 'lenis';
import { clamp01 } from '../shared/math';
import { progressFrom } from './progress';
import { easeInOutSine, glideDurationMs } from './touchSnap';

export interface ScrollController {
  /** 0..1 of the journey track. */
  progress(): number;
  /** Advance Lenis's smoothing; called once per frame by the loop. */
  raf(nowMs: number): void;
  scrollToProgress(p: number, immediate: boolean): void;
  /** An eased glide; the visitor's next touch, wheel or key stops it at once. */
  glideToProgress(p: number, smooth: boolean): void;
  setLocked(locked: boolean): void;
  destroy(): void;
}

export function createScroll(): ScrollController {
  // Wheel/trackpad are smoothed; touch keeps the phone's native momentum (spec §8). The lerp was 0.1;
  // 0.08 is a touch softer, after the owner asked for "a bit slow and smooth" (2026-09-14).
  // Lenis already disables smoothing for visitors whose OS asks for reduced motion.
  const lenis = new Lenis({ autoRaf: false, smoothWheel: true, syncTouch: false, lerp: 0.08 });

  let glideFrame = 0;
  const stopGlide = () => {
    window.cancelAnimationFrame(glideFrame);
    glideFrame = 0;
  };
  // The visitor's own input always wins over a glide in progress.
  for (const type of ['touchstart', 'wheel', 'keydown'] as const) {
    window.addEventListener(type, stopGlide, { passive: true });
  }

  return {
    progress: () => progressFrom(lenis.scroll, lenis.limit),
    raf: (nowMs) => lenis.raf(nowMs),
    scrollToProgress: (p, immediate) => {
      const go = () => {
        lenis.resize();
        lenis.scrollTo(clamp01(p) * lenis.limit, { immediate, force: true });
      };
      go();
      // Before the page has loaded, WebKit can run this module before the stylesheet has given the
      // journey track its height, so the page is one screen tall and the target lands at the top (a
      // deep link opened over the intro). Go again once everything is laid out.
      if (document.readyState !== 'complete') window.addEventListener('load', go, { once: true });
    },
    glideToProgress: (p, smooth) => {
      stopGlide();
      const from = window.scrollY;
      const to = clamp01(p) * lenis.limit;
      if (!smooth) {
        window.scrollTo(0, to);
        return;
      }
      // Its own eased glide rather than the browser's smooth scroll, which is quick and abrupt on phones.
      const duration = glideDurationMs(progressFrom(from, lenis.limit), clamp01(p));
      const start = performance.now();
      const step = (nowMs: number) => {
        const t = Math.min(1, (nowMs - start) / duration);
        window.scrollTo(0, from + (to - from) * easeInOutSine(t));
        glideFrame = t < 1 ? window.requestAnimationFrame(step) : 0;
      };
      glideFrame = window.requestAnimationFrame(step);
    },
    setLocked: (locked) => {
      if (locked) lenis.stop();
      else lenis.start();
    },
    destroy: () => {
      stopGlide();
      lenis.destroy();
    },
  };
}
