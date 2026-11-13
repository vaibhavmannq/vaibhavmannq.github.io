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
  /**
   * A glide; the visitor's next touch, wheel or scrolling key stops it at once. Eased over its own short duration,
   * or, with `durationMs`, a ride: steady over that time (the flight path does its own easing, Amendment 1 §7).
   */
  glideToProgress(p: number, smooth: boolean, durationMs?: number): void;
  /** A glide is running (the pace's hold leaves it alone). */
  gliding(): boolean;
  /** A finger is on the screen. */
  touching(): boolean;
  /** Keep the scroll within `lead` (0..1 of the track) of `p`: it may not run ahead of the camera (Amendment 1 §7). */
  holdNear(p: number, lead: number): void;
  /** Called after an instant jump (a link, a fade), so the camera can jump with it instead of flying there. */
  onJump: ((p: number) => void) | null;
  setLocked(locked: boolean): void;
  destroy(): void;
}

/** Keys that move focus or modify another key, never the scroll. */
const FOCUS_KEYS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta']);

export function createScroll(): ScrollController {
  // Wheel/trackpad are smoothed; touch keeps the phone's native momentum (spec §8). The lerp was 0.1;
  // 0.08 is a touch softer, after the owner asked for "a bit slow and smooth" (2026-09-14).
  // Lenis already disables smoothing for visitors whose OS asks for reduced motion.
  const lenis = new Lenis({ autoRaf: false, smoothWheel: true, syncTouch: false, lerp: 0.08 });

  let glideFrame = 0;
  // A glide has just landed and the camera is still on its way: the hold must not pull the scroll back to it.
  let landed = false;
  const stopGlide = () => {
    landed = false;
    window.cancelAnimationFrame(glideFrame);
    glideFrame = 0;
  };
  // The visitor's own input always wins over a glide in progress. Tab and the modifier keys do not scroll: they move
  // focus, and focus starts its own glide (focusGlide.ts), so stopping here stranded a Tab stop mid-fade (final
  // review I2).
  for (const type of ['touchstart', 'wheel'] as const) {
    window.addEventListener(type, stopGlide, { passive: true });
  }
  let finger = false;
  window.addEventListener('touchstart', () => (finger = true), { passive: true });
  for (const type of ['touchend', 'touchcancel'] as const)
    window.addEventListener(type, () => (finger = false), { passive: true });
  window.addEventListener(
    'keydown',
    (event) => {
      if (!FOCUS_KEYS.has(event.key)) stopGlide();
    },
    { passive: true },
  );

  const controller: ScrollController = {
    onJump: null,
    gliding: () => glideFrame !== 0,
    touching: () => finger,
    holdNear: (p, lead) => {
      if (glideFrame !== 0 || finger || lenis.limit <= 0) return;
      const now = progressFrom(lenis.scroll, lenis.limit);
      if (Math.abs(now - p) <= lead) {
        landed = false;
        return;
      }
      if (landed) return;
      const held = clamp01(now > p ? p + lead : p - lead);
      lenis.scrollTo(held * lenis.limit, { immediate: true, force: true });
    },
    progress: () => progressFrom(lenis.scroll, lenis.limit),
    raf: (nowMs) => lenis.raf(nowMs),
    scrollToProgress: (p, immediate) => {
      const go = () => {
        lenis.resize();
        lenis.scrollTo(clamp01(p) * lenis.limit, { immediate, force: true });
        if (immediate) controller.onJump?.(clamp01(p));
      };
      go();
      // Before the page has loaded, WebKit can run this module before the stylesheet has given the
      // journey track its height, so the page is one screen tall and the target lands at the top (a
      // deep link opened over the intro). Go again once everything is laid out.
      if (document.readyState !== 'complete') window.addEventListener('load', go, { once: true });
    },
    glideToProgress: (p, smooth, durationMs) => {
      stopGlide();
      const from = window.scrollY;
      const to = clamp01(p) * lenis.limit;
      if (!smooth) {
        window.scrollTo(0, to);
        return;
      }
      // Its own eased glide rather than the browser's smooth scroll, which is quick and abrupt on phones.
      const duration = durationMs ?? glideDurationMs(progressFrom(from, lenis.limit), clamp01(p));
      const ease = durationMs === undefined ? easeInOutSine : (t: number) => t;
      const start = performance.now();
      const step = (nowMs: number) => {
        const t = Math.min(1, (nowMs - start) / duration);
        window.scrollTo(0, from + (to - from) * ease(t));
        glideFrame = t < 1 ? window.requestAnimationFrame(step) : 0;
        if (t >= 1) landed = true;
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
  return controller;
}
