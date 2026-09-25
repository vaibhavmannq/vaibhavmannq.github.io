/**
 * How big the chapter text is drawn on a laptop, and where: the owner's normal browser window (1897 × 886 on their
 * laptop) drew it at 83% under the earlier fit, and they asked for exactly that size everywhere, full screen too
 * (2026-09-26). Phones and tablets keep their own layout.
 */
export const TEXT_ZOOM = 0.83;
/** Narrower than this is a phone or a tablet: no zoom. */
const LAPTOP_FROM = 1024;
/** 'inset' keeps the normal window's margin instead of the edge: 161 px of that 1897 px window. */
const INSET = 161 / 1897;

export type FitMode = 'edge' | 'inset';

/**
 * Each page is laid out as usual, then scaled by `scale` and shifted right by `x` px. It depends on the width alone,
 * so a normal window and full screen of the same width show the same text in the same place, only the page's
 * height differs. The earlier rule (S46) followed the picture instead, which moved and shrank the text in a window.
 * Pure.
 */
export function frameFit(width: number, height: number, mode: FitMode = 'edge'): { scale: number; x: number } {
  // A stage with no size yet (WebKit can run this before the stylesheet has laid it out) means "no change",
  // never scale 0, which would shrink every page's text to nothing.
  if (width <= 0 || height <= 0 || width < LAPTOP_FROM) return { scale: 1, x: 0 };
  return { scale: TEXT_ZOOM, x: mode === 'inset' ? width * INSET : 0 };
}

/**
 * Writes the fit to `--frame-scale` and `--frame-x` on `root`, from the stage (the scene's own box), whenever the
 * stage changes size. Watching the stage rather than the window also catches the stylesheet sizing it after this
 * runs, which WebKit can do.
 */
export function applyFrameFit(root: HTMLElement, stage: HTMLElement, mode: FitMode = 'edge'): void {
  const update = () => {
    const { scale, x } = frameFit(stage.clientWidth, stage.clientHeight, mode);
    root.style.setProperty('--frame-scale', String(scale));
    root.style.setProperty('--frame-x', `${x}px`);
  };
  update();
  new ResizeObserver(update).observe(stage);
}
