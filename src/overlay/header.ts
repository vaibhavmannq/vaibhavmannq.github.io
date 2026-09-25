import type { SectionId } from '../journey/types';

const IDS: readonly string[] = ['intro', 'about', 'projects', 'contact'];

/**
 * Links that take the visitor to a chapter (spec 2026-09-25 §4.6): Work and About in the header, and "See the work"
 * on the first page. Each is a plain in-page link that works without JavaScript; with it, the journey glides there
 * instead of jumping. "Email me" is a plain mailto link and needs nothing from here.
 */
export function bindGoLinks(root: ParentNode, options: { go: (id: SectionId) => void }): void {
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[data-go]')) {
    const id = link.dataset.go ?? '';
    if (!IDS.includes(id)) throw new Error(`data-go="${id}" is not a chapter`);
    link.addEventListener('click', (event) => {
      event.preventDefault();
      options.go(id as SectionId);
    });
  }
}
