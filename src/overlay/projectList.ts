import type { Project } from '../content/projects';

/** More projects than this and the cards go into the sideways row (createRowNav below); up to it, all are in view. */
const IN_VIEW = 2;

/**
 * Fills the Projects page's list from the data (content/projects.ts). Each project is a card: its picture, the year
 * and what kind of thing it is, the title with its aside, one line of summary, and a button that opens the case
 * study.
 *
 * Redone 2026-11-08. With two real projects, both cards are in full view on every screen: side by side on a laptop,
 * the picture above the words; stacked on a phone, the picture beside them. The earlier sideways row hid the second
 * project behind a swipe on a phone and behind arrows on a laptop. It comes back by itself past IN_VIEW projects,
 * when they no longer fit on one screen. Projects still on the way are one quiet line under the cards.
 */
export function renderProjectList(
  list: HTMLElement,
  projects: readonly Project[],
  onOpen: (slug: string, opener: HTMLButtonElement) => void,
  upcoming: readonly string[] = [],
): void {
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const row = projects.length > IN_VIEW;
  list.classList.toggle('project-list--row', row);
  list.classList.toggle('project-list--grid', !row);
  list.replaceChildren(
    ...projects.map((project) => {
      // The card's picture is decoration here (empty alt); the case study carries the described image.
      const cover = element('img', 'project__cover');
      cover.src = project.thumb?.src ?? project.cover.src;
      cover.alt = '';
      cover.loading = 'lazy';
      cover.decoding = 'async';
      if (project.thumb?.focus) cover.style.setProperty('--focus', project.thumb.focus);

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
        element('p', 'project__meta', `${project.year} · ${project.kind}`),
        head,
        element('p', 'project__summary', project.summary),
        open,
      );

      const card = element('article', 'project-card');
      card.append(cover, body);
      const li = document.createElement('li');
      li.append(card);
      return li;
    }),
  );

  const panel = list.parentElement;
  panel?.querySelector('.project-row-nav')?.remove();
  panel?.querySelector('.project-next')?.remove();
  if (row) list.after(createRowNav(list, projects.length));
  if (upcoming.length > 0) {
    const next = element('p', 'project-next');
    next.append(element('span', 'project-next__label', 'Next'), ...upcoming.map((line) => element('span', '', line)));
    (panel?.querySelector('.project-row-nav') ?? list).after(next);
  }
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
