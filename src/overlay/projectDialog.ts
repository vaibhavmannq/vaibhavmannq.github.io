import type { Project } from '../content/projects';

export interface ProjectDialog {
  /** Fills the dialog with a project and opens it. False for a slug that is not in the data. */
  open(slug: string): boolean;
  close(): void;
  readonly isOpen: boolean;
}

/**
 * The project details dialog (spec §3.2, §10.2): a native modal <dialog>, so the page behind it is
 * inert, focus moves in, and Esc closes it. `onClosed` runs however it closes: Esc, the Close
 * button, a click on the dimmed backdrop, or the address changing.
 */
export function createProjectDialog(
  dialog: HTMLDialogElement,
  projects: readonly Project[],
  onClosed: () => void,
): ProjectDialog {
  const part = <T extends HTMLElement>(selector: string): T => {
    const element = dialog.querySelector<T>(selector);
    if (element === null) throw new Error(`${selector} is missing from #${dialog.id}`);
    return element;
  };
  const meta = part('[data-project-meta]');
  const title = part('[data-project-title]');
  const text = part('[data-project-text]');
  const tools = part('[data-project-tools]');
  const links = part('[data-project-links]');

  part<HTMLButtonElement>('[data-project-close]').addEventListener('click', () => dialog.close());
  // The body fills the dialog, so a click that lands on the dialog element itself is on the backdrop.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', onClosed);

  const link = (href: string, label: string) => {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    anchor.textContent = label;
    const note = document.createElement('span');
    note.className = 'visually-hidden';
    note.textContent = ' (opens in a new tab)';
    anchor.append(note);
    return anchor;
  };

  const fill = (project: Project) => {
    meta.textContent = `${project.year} · ${project.role}`;
    title.textContent = project.title;
    text.replaceChildren(
      ...project.details.map((paragraph) => {
        const element = document.createElement('p');
        element.textContent = paragraph;
        return element;
      }),
    );
    tools.replaceChildren(
      ...project.tools.map((tool) => {
        const element = document.createElement('li');
        element.textContent = tool;
        return element;
      }),
    );
    const anchors: HTMLAnchorElement[] = [];
    if (project.links?.live) anchors.push(link(project.links.live, 'Visit the live site'));
    if (project.links?.repo) anchors.push(link(project.links.repo, 'Source code on GitHub'));
    links.replaceChildren(...anchors);
    links.hidden = anchors.length === 0;
  };

  return {
    open(slug) {
      const project = projects.find((candidate) => candidate.slug === slug);
      if (project === undefined) return false;
      fill(project);
      if (!dialog.open) dialog.showModal();
      return true;
    },
    close() {
      if (dialog.open) dialog.close();
    },
    get isOpen() {
      return dialog.open;
    },
  };
}
