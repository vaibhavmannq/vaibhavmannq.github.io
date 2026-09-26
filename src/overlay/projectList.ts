import type { Project, Upcoming } from '../content/projects';

/**
 * Fills the Projects page's list from the data (content/projects.ts). Each project is a card, as in the storyboard's
 * frame III: its cover, then the year and role, the title with its aside, one line of summary, and a button that
 * opens the case study. Several projects sit in a row that scrolls sideways (the owner's pick from a demo,
 * 2026-09-26): two cards in full view on a laptop, one with the next peeking in on a phone, where swiping up and down
 * already travels the journey.
 */
export function renderProjectList(
  list: HTMLElement,
  projects: readonly Project[],
  onOpen: (slug: string, opener: HTMLButtonElement) => void,
  upcoming: readonly Upcoming[] = [],
): void {
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const count = projects.length + upcoming.length;
  const cover = (src: string) => {
    // The cover is decoration here (empty alt); the case study carries the described image.
    const image = element('img', 'project__cover');
    image.src = src;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    return image;
  };
  const item = (card: HTMLElement) => {
    const li = document.createElement('li');
    li.append(card);
    return li;
  };

  list.classList.toggle('project-list--row', count > 1);
  list.replaceChildren(
    ...projects.map((project) => {
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
      card.append(cover(project.cover.src), body);
      return item(card);
    }),
    // A project on its way: the same card, saying so, with no case study to open yet.
    ...upcoming.map((next) => {
      const body = element('div', 'project__body');
      const head = element('div', 'project__head');
      head.append(element('h3', 'project__title', 'In the works'));
      body.append(
        element('p', 'project__meta', 'Coming soon'),
        head,
        element('p', 'project__summary', 'A new project is on its way here.'),
      );
      const card = element('article', 'project-card project-card--soon');
      card.append(cover(next.cover), body);
      return item(card);
    }),
  );

  list.parentElement?.querySelector('.project-row-nav')?.remove();
  if (count > 1) list.after(createRowNav(list, count));
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

  // Names the cards in full view: "1–2 / 4" on a laptop, "1 / 4" on a phone. The list is positioned (overlay.css), so
  // each card's offsetLeft is measured from the row's own start; a hair of slack absorbs sub-pixel rounding.
  const update = () => {
    const cards = [...list.children] as HTMLElement[];
    const left = list.scrollLeft - 2;
    const right = list.scrollLeft + list.clientWidth + 2;
    const inView = cards.flatMap((card, i) =>
      card.offsetLeft >= left && card.offsetLeft + card.offsetWidth <= right ? [i + 1] : [],
    );
    const first = inView[0] ?? 1;
    const last = inView.at(-1) ?? first;
    shown.textContent = `${first === last ? first : `${first}–${last}`} / ${count}`;
  };
  list.addEventListener('scroll', update, { passive: true });
  // Also when the cards change size: fonts arriving, a window resized across the phone breakpoint.
  new ResizeObserver(update).observe(list);
  update();

  nav.append(button('Previous project', '←', -1), shown, button('Next project', '→', 1));
  return nav;
}
