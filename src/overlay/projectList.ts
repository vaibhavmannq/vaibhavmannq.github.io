import type { Project } from '../content/projects';

/**
 * Fills the Projects page's list from the data (content/projects.ts). Each entry's title is a button
 * that opens the project's dialog; the year, role and summary sit beside it as plain text.
 */
export function renderProjectList(
  list: HTMLElement,
  projects: readonly Project[],
  onOpen: (slug: string, opener: HTMLButtonElement) => void,
): void {
  list.replaceChildren(
    ...projects.map((project) => {
      const item = document.createElement('li');

      const meta = document.createElement('p');
      meta.className = 'project__meta';
      meta.textContent = `${project.year} · ${project.role}`;

      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'project__open';
      open.textContent = project.title;
      open.setAttribute('aria-haspopup', 'dialog');
      open.addEventListener('click', () => onOpen(project.slug, open));

      const summary = document.createElement('p');
      summary.className = 'project__summary';
      summary.textContent = project.summary;

      const head = document.createElement('div');
      head.className = 'project__head';
      head.append(open);
      if (project.aside) {
        const aside = document.createElement('span');
        aside.className = 'project__aside';
        aside.textContent = project.aside;
        head.append(aside);
      }

      // The cover is decoration beside the title here (empty alt); the dialog carries the described image.
      const cover = document.createElement('img');
      cover.className = 'project__cover';
      cover.src = project.cover.src;
      cover.alt = '';
      cover.loading = 'lazy';
      cover.decoding = 'async';

      item.append(cover, meta, head, summary);
      return item;
    }),
  );
}
