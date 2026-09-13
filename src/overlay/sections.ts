import type { SectionId } from '../journey/types';

export interface Sections {
  show(id: SectionId): void;
}

/** Fades the active text section in and the previous one out (Web Animations API; instant with reduced motion). */
export function createSections(root: HTMLElement, isReducedMotion: () => boolean): Sections {
  const elements = new Map<string, HTMLElement>();
  for (const element of root.querySelectorAll<HTMLElement>('[data-section]')) {
    const id = element.dataset.section;
    if (id) elements.set(id, element);
  }

  let current: SectionId | null = null;

  const fade = (element: HTMLElement, visible: boolean) => {
    const reduced = isReducedMotion();
    const shift = reduced ? 'none' : visible ? 'translateY(16px)' : 'translateY(-12px)';
    const keyframes = visible
      ? [
          { opacity: 0, transform: shift },
          { opacity: 1, transform: 'none' },
        ]
      : [
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: shift },
        ];
    let duration = 500;
    if (reduced) duration = 0;
    else if (visible) duration = 900;

    element.classList.toggle('is-active', visible);
    for (const running of element.getAnimations()) running.cancel();
    const animation = element.animate(keyframes, {
      duration,
      easing: visible ? 'cubic-bezier(0.2, 0.8, 0.2, 1)' : 'ease-in',
      fill: 'forwards',
    });
    // Keep the final style, then drop the animation object so they don't pile up
    animation.onfinish = () => {
      animation.commitStyles();
      animation.cancel();
    };
  };

  return {
    show(id) {
      if (id === current) return;
      const previous = current === null ? undefined : elements.get(current);
      const next = elements.get(id);
      current = id;
      if (previous) fade(previous, false);
      if (next) fade(next, true);
    },
  };
}
