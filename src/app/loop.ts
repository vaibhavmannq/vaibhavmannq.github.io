import type { WebGPURenderer } from 'three/webgpu';
import { createPacer, type Pacer } from './refresh';

export interface Loop {
  start(renderer: WebGPURenderer): void;
  stop(): void;
  isIdle(nowMs: number): boolean;
  /** Decides which animation frames render, and what "on time" means for the governor (app/refresh.ts). */
  readonly pacer: Pacer;
}

const IDLE_AFTER_MS = 8000;
const INPUT_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/**
 * The single animation loop (spec §4.3 rule 1). The pacer renders every Nth vsync, so frames are evenly spaced
 * near 60 fps on any screen; idle halves that; a hidden tab pauses. The refresh is measured again when the tab
 * comes back; a faster screen is noticed by the pacer itself, and a resize only re-arms its check for a slower one.
 * While the pacer measures it renders nothing (final review C1), and `onQuiet` runs instead, so the text keeps
 * moving. Both share one clock, so the first rendered frame after a quiet spell does not jump.
 */
export function createLoop(
  onFrame: (nowMs: number, dtSeconds: number) => void,
  pacer: Pacer = createPacer(),
  onQuiet: (nowMs: number, dtSeconds: number) => void = () => {},
): Loop {
  let renderer: WebGPURenderer | null = null;
  let lastFrame = -1;
  let lastInput = performance.now();

  const isIdle = (nowMs: number) => nowMs - lastInput > IDLE_AFTER_MS;

  const tick = (nowMs: number) => {
    const render = pacer.tick(nowMs, isIdle(nowMs));
    if (!render && !pacer.quiet) return;
    const dtSeconds = lastFrame < 0 ? 1 / 60 : Math.min(0.1, (nowMs - lastFrame) / 1000);
    lastFrame = nowMs;
    if (render) onFrame(nowMs, dtSeconds);
    else onQuiet(nowMs, dtSeconds);
  };

  const run = () => {
    renderer?.setAnimationLoop(tick);
  };
  const halt = () => {
    renderer?.setAnimationLoop(null);
    lastFrame = -1;
  };

  const markInput = () => {
    lastInput = performance.now();
  };
  for (const type of INPUT_EVENTS) window.addEventListener(type, markInput, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      halt();
      return;
    }
    pacer.remeasure();
    run();
  });
  // A resize measures nothing (it used to, and froze the sea for half a second on every phone toolbar swipe; final
  // review M10), but a window moved to a slower screen may need the pacer's check for a slower screen again.
  window.addEventListener('resize', () => pacer.rearm(), { passive: true });

  return {
    start(next) {
      renderer = next;
      run();
    },
    stop: halt,
    isIdle,
    pacer,
  };
}
