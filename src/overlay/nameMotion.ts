import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

export interface NameMotion {
  /** The name's letters, for the pointer's swell (pointerTouch.ts). */
  readonly chars: readonly HTMLElement[];
  /** The name rises letter by letter, timed to the page's reveal as the opening lifts. */
  rise(reducedMotion: boolean): void;
}

/** Splits the name into letters, each behind its own mask. SplitText labels the heading for screen readers. */
export function createNameMotion(name: HTMLElement): NameMotion {
  const split = SplitText.create(name, { type: 'words,chars', mask: 'chars', charsClass: 'section__char' });
  const chars = split.chars as HTMLElement[];
  let risen = false;
  return {
    chars,
    rise(reducedMotion) {
      if (risen || reducedMotion) return;
      risen = true;
      // The text layer fades in 1.2 s after the opening starts to leave (overlay.css .content).
      gsap.fromTo(
        chars,
        { yPercent: 115, rotate: 6 },
        { yPercent: 0, rotate: 0, duration: 1.1, ease: 'expo.out', stagger: 0.045, delay: 1.1 },
      );
    },
  };
}
