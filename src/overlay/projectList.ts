import type { Project } from '../content/projects';

/**
 * How several projects share the page (owner review, 2026-09-26):
 * - 'auto': on a laptop the newest is the full card and the rest are one-line rows under it; on a phone they sit in a
 *   row the visitor swipes sideways, since swiping up and down already travels the journey.
 * - 'list': the card and the rows on every screen.
 * - 'row': the sideways row on every screen, with buttons to step through on a laptop.
 * One project is always just the card.
 */
export type CardLayout = 'auto' | 'list' | 'row';

/**
 * Fills the Projects page's list from the data (content/projects.ts). Each project is a card, as in the storyboard's
 * frame III: its cover, then the year and role, the title with its aside, one line of summary, and a button that
 * opens the case study.
 */
export function renderProjectList(
  list: HTMLElement,
  projects: readonly Project[],
  onOpen: (slug: string, opener: HTMLButtonElement) => void,
  layout: CardLayout = 'auto',
): void {
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // One class names the layout in force; 'auto' follows the screen, and changes if a window crosses the breakpoint.
  const wide = window.matchMedia('(min-width: 700px)');
  const arrange = () => {
    const as = layout === 'auto' ? (wide.matches ? 'list' : 'row') : layout;
    list.classList.toggle('project-list--as-list', projects.length > 1 && as === 'list');
    list.classList.toggle('project-list--as-row', projects.length > 1 && as === 'row');
  };
  arrange();
  wide.addEventListener('change', arrange);
  list.replaceChildren(
    ...projects.map((project) => {
      // The cover is decoration here (empty alt); the case study carries the described image.
      const cover = element('img', 'project__cover');
      cover.src = project.cover.src;
      cover.alt = '';
      cover.loading = 'lazy';
      cover.decoding = 'async';

      const head = element('div', 'project__head');
      head.append(element('h3', 'project__title', project.title));
      if (project.aside) head.append(element('span', 'project__aside', project.aside));

      // "Read the case study" names its project for a screen reader, which may hear the button out of context. The
      // label starts with the visible words, so a voice command that reads them still finds the button.
      const open = element('button', 'project__open');
      open.type = 'button';
      open.setAttribute('aria-haspopup', 'dialog');
      open.setAttribute('aria-label', `Read the case study: ${project.title}`);
      const arrow = element('span', 'project__arrow', '→');
      arrow.setAttribute('aria-hidden', 'true');
      open.append(element('span', 'project__open-words', 'Read the case study'), arrow);
      open.addEventListener('click', () => onOpen(project.slug, open));

      const body = element('div', 'project__body');
      body.append(
        element('p', 'project__meta', `${project.year} · ${project.role}`),
        head,
        element('p', 'project__summary', project.summary),
        open,
      );

      const card = element('article', 'project-card');
      card.append(cover, body);
      const item = document.createElement('li');
      item.append(card);
      return item;
    }),
  );

  list.parentElement?.querySelector('.project-row-nav')?.remove();
  if (projects.length > 1) list.after(createRowNav(list, projects.length));
}

/** The sideways row's count ("2 / 4") and, on a laptop, the buttons that step through it. */
function createRowNav(list: HTMLElement, count: number): HTMLElement {
  const nav = document.createElement('div');
  nav.className = 'project-row-nav';
  const button = (label: string, symbol: string, step: number) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'project-row-nav__step';
    node.setAttribute('aria-label', label);
    node.textContent = symbol;
    node.addEventListener('click', () => {
      const card = list.firstElementChild as HTMLElement | null;
      const gap = Number.parseFloat(getComputedStyle(list).columnGap) || 0;
      list.scrollBy({ left: step * ((card?.offsetWidth ?? 0) + gap), behavior: 'smooth' });
    });
    return node;
  };
  const shown = document.createElement('span');
  shown.className = 'project-row-nav__count';
  shown.setAttribute('aria-live', 'polite');

  // The card whose left edge is nearest the row's left edge is the one on show; scrolled to the very end, the last
  // one. The list is positioned (overlay.css), so each card's offsetLeft is measured from the row's own start.
  const update = () => {
    const cards = [...list.children] as HTMLElement[];
    const scrolls = list.scrollWidth > list.clientWidth + 2;
    const atEnd = scrolls && list.scrollLeft + list.clientWidth >= list.scrollWidth - 2;
    const distance = (card: HTMLElement) => Math.abs(card.offsetLeft - list.scrollLeft);
    let index = 0;
    cards.forEach((card, i) => {
      if (distance(card) < distance(cards[index] as HTMLElement)) index = i;
    });
    shown.textContent = `${atEnd ? count : index + 1} / ${count}`;
  };
  list.addEventListener('scroll', update, { passive: true });
  update();

  nav.append(button('Previous project', '←', -1), shown, button('Next project', '→', 1));
  return nav;
}
