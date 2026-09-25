import type { Project } from '../content/projects';

/**
 * Fills the Projects page's list from the data (content/projects.ts). Each project is a card, as in the storyboard's
 * frame III: its cover, then the year and role, the title with its aside, one line of summary, and a button that
 * opens the case study.
 */
export function renderProjectList(
  list: HTMLElement,
  projects: readonly Project[],
  onOpen: (slug: string, opener: HTMLButtonElement) => void,
): void {
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

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
      const open = element('button', 'project__open', 'Read the case study');
      open.type = 'button';
      open.setAttribute('aria-haspopup', 'dialog');
      open.setAttribute('aria-label', `Read the case study: ${project.title}`);
      const arrow = element('span', 'project__arrow', '→');
      arrow.setAttribute('aria-hidden', 'true');
      open.append(arrow);
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
}
