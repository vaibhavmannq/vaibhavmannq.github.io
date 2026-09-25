import type { SectionId } from '../journey/types';

/**
 * The lit part of a waxing moon in a 24 × 24 box, radius 10, as an SVG path. The right limb is a half circle; the
 * terminator is a half ellipse of half-width |cos 2πφ| × 10, bulging right while less than half is lit and left once
 * more is (the same maths as the sea's moonLit, so the rail and the sky agree). Pure.
 */
export function moonGlyphPath(phase: number): string {
  const k = Math.cos(phase * Math.PI * 2);
  const rx = Math.round(Math.abs(k) * 1000) / 100;
  const sweep = k > 0 ? 0 : 1;
  return `M12 2A10 10 0 0 1 12 22A${rx} 10 0 0 ${sweep} 12 2Z`;
}

const IDS: readonly SectionId[] = ['intro', 'about', 'projects', 'contact'];

/**
 * The rail of four moons (spec 2026-09-25 §4.6): where you are, and a way to jump. The links are in index.html (they
 * work without JavaScript, as plain in-page links); this marks the current chapter and turns a click into a glide.
 */
export function createChapterRail(root: HTMLElement, options: { go: (id: SectionId) => void }) {
  const links = new Map<SectionId, HTMLAnchorElement>();
  for (const id of IDS) {
    const link = root.querySelector<HTMLAnchorElement>(`a[href="#${id}"]`);
    if (link === null) throw new Error(`the rail has no link to #${id}`);
    links.set(id, link);
    link.addEventListener('click', (event) => {
      event.preventDefault();
      options.go(id);
    });
  }
  let current: SectionId | null = null;
  return {
    show(section: SectionId) {
      if (section === current) return;
      if (current !== null) links.get(current)?.removeAttribute('aria-current');
      links.get(section)?.setAttribute('aria-current', 'step');
      current = section;
    },
  };
}
