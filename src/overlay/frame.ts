/**
 * The frame the camera composes for. On anything wider, the scene keeps its vertical field of view
 * (cameraPath.ts fovForAspect), so it is framed by height: a laptop in a window (1280 × 590) shows the same
 * picture as full screen (1280 × 720), only smaller, with more of the sea at the sides.
 */
export const FRAME_ASPECT = 16 / 9;

/**
 * How to draw the text so it keeps its place in that picture: each page is laid out as at 16:9, then scaled by
 * `scale` and shifted right by `x` px into the frame. Screens at 16:9 or narrower get 1 and 0. Pure.
 */
export function frameFit(width: number, height: number): { scale: number; x: number } {
  // A stage with no size yet (WebKit can run this before the stylesheet has laid it out) means "no change",
  // never scale 0, which would shrink every page's text to nothing.
  if (width <= 0 || height <= 0) return { scale: 1, x: 0 };
  const frameWidth = Math.min(width, height * FRAME_ASPECT);
  return { scale: frameWidth / width, x: (width - frameWidth) / 2 };
}

/**
 * Writes the fit to `--frame-scale` and `--frame-x` on `root`, from the stage (the scene's own box, 100lvh
 * tall), whenever the stage changes size (owner report, spec 2026-09-25 §4.14). Watching the stage rather than
 * the window also catches the stylesheet sizing it after this runs, which WebKit can do.
 */
export function applyFrameFit(root: HTMLElement, stage: HTMLElement): void {
  const update = () => {
    const { scale, x } = frameFit(stage.clientWidth, stage.clientHeight);
    root.style.setProperty('--frame-scale', String(scale));
    root.style.setProperty('--frame-x', `${x}px`);
  };
  update();
  new ResizeObserver(update).observe(stage);
}
