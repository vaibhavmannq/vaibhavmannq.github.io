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

      item.append(meta, open, summary);
      return item;
    }),
  );
}
