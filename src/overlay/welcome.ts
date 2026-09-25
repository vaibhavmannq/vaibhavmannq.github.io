import gsap from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

gsap.registerPlugin(ScrambleTextPlugin);

/** How long after navigation starts the page settles, if the scene is ready by then (spec 2026-09-25 §4.5). */
export const SETTLE_AFTER_MS = 1200;
/**
 * The page settles by now whether or not the scene is ready. A phone can compile the sea for seconds, and the header,
 * the rail and the chapter title must not wait for it (final review I1).
 */
export const SETTLE_BY_MS = 3000;

const KICKER_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ·';

export interface Welcome {
  /** The scene is on screen (3D warmed up, or stills started): fade it up, clear the status line. */
  sceneReady(): void;
  /** True once the header, the rail and the chapter title have arrived. */
  readonly settled: boolean;
}

/**
 * Opening E (spec 2026-09-25 §4.5). The HTML is already the first paint: the greeting, the name, the line. This only
 * runs the one arrival that happens on a clock, never on scroll: the sea fades up once it is ready, and
 * SETTLE_AFTER_MS after the page began (or at that moment, if later, but never after SETTLE_BY_MS) the header and
 * rail fade in and the greeting types itself into the chapter title. Nothing is locked meanwhile.
 */
export function createWelcome(options: { kicker: HTMLElement; reducedMotion: () => boolean }): Welcome {
  const root = document.documentElement;
  const status = document.getElementById('scene-status');
  const title = options.kicker.dataset.welcome ?? '';
  let ready = false;
  let settled = false;

  const settle = (force = false) => {
    if (settled || !(ready || force)) return;
    settled = true;
    root.classList.add('is-settled');
    if (options.reducedMotion()) {
      options.kicker.textContent = title;
      return;
    }
    gsap.to(options.kicker, {
      scrambleText: { text: title, chars: KICKER_CHARS, speed: 0.6 },
      duration: 0.9,
      ease: 'none',
    });
  };
  window.setTimeout(() => settle(), Math.max(0, SETTLE_AFTER_MS - performance.now()));
  window.setTimeout(() => settle(true), Math.max(0, SETTLE_BY_MS - performance.now()));

  return {
    sceneReady() {
      if (ready) return;
      ready = true;
      root.classList.add('is-scene-ready');
      if (status) status.textContent = '';
      if (performance.now() >= SETTLE_AFTER_MS) settle();
    },
    get settled() {
      return settled;
    },
  };
}
