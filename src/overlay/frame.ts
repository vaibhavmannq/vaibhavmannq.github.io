/**
 * How big the chapter text is drawn on a laptop, and where: the owner's normal browser window (1897 × 886 on their
 * laptop) drew it at 83% under the earlier fit, and they asked for exactly that size everywhere, full screen too
 * (2026-09-26). Phones and tablets keep their own layout.
 */
export const TEXT_ZOOM = 0.83;
/** Narrower than this is a phone or a tablet: no zoom. */
const LAPTOP_FROM = 1024;
/**
 * How far in from the edge the text starts, as a share of the width: 110 px of the owner's 1897 px window. They
 * compared the edge with the normal window's 161 px and asked for the inset, "a bit to the left" (2026-09-26).
 */
const INSET = 110 / 1897;

/**
 * Each page is laid out as usual, then scaled by `scale` and shifted right by `x` px. It depends on the width alone,
 * so a normal window and full screen of the same width show the same text in the same place, only the page's
 * height differs. The earlier rule (S46) followed the picture instead, which moved and shrank the text in a window.
 * Pure.
 */
export function frameFit(width: number, height: number): { scale: number; x: number } {
  // A stage with no size yet (WebKit can run this before the stylesheet has laid it out) means "no change",
  // never scale 0, which would shrink every page's text to nothing.
  if (width <= 0 || height <= 0 || width < LAPTOP_FROM) return { scale: 1, x: 0 };
  return { scale: TEXT_ZOOM, x: width * INSET };
}

/**
 * Writes the fit to `--frame-scale` and `--frame-x` on `root`, from the stage (the scene's own box), whenever the
 * stage changes size. Watching the stage rather than the window also catches the stylesheet sizing it after this
 * runs, which WebKit can do.
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
