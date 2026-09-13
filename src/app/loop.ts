import type { WebGPURenderer } from 'three/webgpu';
import { frameInterval, shouldRender } from './frameRate';

export interface Loop {
  start(renderer: WebGPURenderer): void;
  stop(): void;
  isIdle(nowMs: number): boolean;
}

const FPS = 60;
const IDLE_FPS = 30;
const IDLE_AFTER_MS = 8000;
const INPUT_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/** The single animation loop (spec §4.3 rule 1): 60 fps cap, 30 fps when idle, paused in hidden tabs. */
export function createLoop(onFrame: (nowMs: number, dtSeconds: number) => void): Loop {
  let renderer: WebGPURenderer | null = null;
  let lastFrame = -1;
  let lastInput = performance.now();

  const isIdle = (nowMs: number) => nowMs - lastInput > IDLE_AFTER_MS;

  const tick = (nowMs: number) => {
    if (!shouldRender(nowMs, lastFrame, frameInterval(isIdle(nowMs), FPS, IDLE_FPS))) return;
    const dtSeconds = lastFrame < 0 ? 1 / FPS : Math.min(0.1, (nowMs - lastFrame) / 1000);
    lastFrame = nowMs;
    onFrame(nowMs, dtSeconds);
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
    if (document.hidden) halt();
    else run();
  });

  return {
    start(next) {
      renderer = next;
      run();
    },
    stop: halt,
    isIdle,
  };
}
