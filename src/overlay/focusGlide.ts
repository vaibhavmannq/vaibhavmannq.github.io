import type { SectionId } from '../journey/types';

/**
 * Nothing that has focus is ever invisible (spec 2026-09-25 §4.6). When focus moves into a page that is not the one
 * on screen (Tab, a screen reader, a script), the journey glides to where that page is fully shown. Pages stay in
 * the accessibility tree, as the master spec requires, so `inert` is not an option.
 */
export function createFocusGlide(options: {
  sectionOf: (element: Element) => SectionId | null;
  isShown: (id: SectionId) => boolean;
  glideTo: (id: SectionId) => void;
}): void {
  document.addEventListener('focusin', (event) => {
    if (!(event.target instanceof Element)) return;
    const id = options.sectionOf(event.target);
    if (id !== null && !options.isShown(id)) options.glideTo(id);
  });
}
