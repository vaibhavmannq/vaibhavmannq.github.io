import gsap from 'gsap';

export interface PointerTouchOptions {
  /** The name's letters: they swell as the pointer comes near. */
  chars: readonly HTMLElement[];
  /** Whether the name is on screen and motion is allowed. */
  swellActive: () => boolean;
}

const RESTING_WEIGHT = 340;
const NEAR_PX = 260;

/**
 * The page answering the pointer. The name's letters grow heavier and lift a little as the pointer nears
 * them, and nothing else moves: the owner had links lean toward the cursor until 2026-09-25, which could
 * push them past the edge of the window, and asked for it to go from the project list and the contact
 * links alike. Only for a mouse or trackpad: touch screens have no hover, so there is nothing to follow.
 */
export function createPointerTouch({ chars, swellActive }: PointerTouchOptions): void {
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
}
