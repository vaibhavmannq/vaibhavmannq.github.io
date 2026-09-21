import gsap from 'gsap';

export interface PointerTouchOptions {
  /** The name's letters: they swell as the pointer comes near. */
  chars: readonly HTMLElement[];
  /** Links and buttons that lean gently toward the pointer. */
  pulled: readonly HTMLElement[];
  /** Whether the name is on screen and motion is allowed. */
  swellActive: () => boolean;
  /** Whether motion is allowed at all. */
  pullActive: () => boolean;
}

const RESTING_WEIGHT = 340;
const NEAR_PX = 260;

/**
 * The page answering the pointer (redesign, 2026-09-22; the owner kept the pull and dropped the water
 * ripple). Only for a mouse or trackpad: touch screens have no hover, so there is nothing to follow.
 */
export function createPointerTouch({ chars, pulled, swellActive, pullActive }: PointerTouchOptions): void {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const weights = chars.map((char) => gsap.quickTo(char, '--w', { duration: 0.5, ease: 'power3.out' }));
  const lifts = chars.map((char) => gsap.quickTo(char, 'y', { duration: 0.5, ease: 'power3.out' }));
  let swollen = false;
  window.addEventListener(
    'pointermove',
    (event) => {
      if (!swellActive()) {
        if (swollen) {
          for (const setWeight of weights) setWeight(RESTING_WEIGHT);
          for (const lift of lifts) lift(0);
          swollen = false;
        }
        return;
      }
      swollen = true;
      chars.forEach((char, i) => {
        const box = char.getBoundingClientRect();
        const distance = Math.hypot(
          event.clientX - (box.left + box.width / 2),
          event.clientY - (box.top + box.height / 2),
        );
        const near = Math.max(0, 1 - distance / NEAR_PX);
        weights[i]?.(RESTING_WEIGHT + 420 * near);
        lifts[i]?.(-8 * near);
      });
    },
    { passive: true },
  );

  for (const element of pulled) {
    const toX = gsap.quickTo(element, 'x', { duration: 0.5, ease: 'power3.out' });
    const toY = gsap.quickTo(element, 'y', { duration: 0.5, ease: 'power3.out' });
    element.addEventListener('pointermove', (event) => {
      if (!pullActive()) return;
      const box = element.getBoundingClientRect();
      toX((event.clientX - (box.left + box.width / 2)) * 0.25);
      toY((event.clientY - (box.top + box.height / 2)) * 0.35);
    });
    element.addEventListener('pointerleave', () => {
      toX(0);
      toY(0);
    });
  }
}
