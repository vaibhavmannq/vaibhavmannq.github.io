import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

export interface NameMotion {
  /** The name's letters, for the pointer's swell (pointerTouch.ts). */
  readonly chars: readonly HTMLElement[];
}

/**
 * Splits the name into letters, each behind its own mask, for the pointer's swell. SplitText labels the heading for
 * screen readers. The name no longer rises in: it is on screen at first paint (opening E, spec 2026-09-25 §4.5), and
 * a rise would make it vanish first.
 */
export function createNameMotion(name: HTMLElement): NameMotion {
  const split = SplitText.create(name, { type: 'words,chars', mask: 'chars', charsClass: 'section__char' });
  // The letter masks clip with clip-path (overlay.css), which leaves room for the halo; SplitText's inline
  // `overflow: clip` would cut it at each letter's own box.
  for (const mask of split.masks) (mask as HTMLElement).style.overflow = 'visible';
  return { chars: split.chars as HTMLElement[] };
}
