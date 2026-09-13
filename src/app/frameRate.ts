/** Milliseconds between rendered frames. */
export const frameInterval = (idle: boolean, fps: number, idleFps: number): number => 1000 / (idle ? idleFps : fps);

/**
 * Render when enough time has passed since the last rendered frame.
 * The 2 ms tolerance keeps a 60 Hz display at every frame despite timer jitter.
 */
export const shouldRender = (nowMs: number, lastFrameMs: number, intervalMs: number): boolean =>
  lastFrameMs < 0 || nowMs - lastFrameMs >= intervalMs - 2;
