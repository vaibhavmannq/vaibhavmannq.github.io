import type { Project } from '../content/projects';

/**
 * A project's card, opened from its lantern at Night (plan M5 Task 5; spec §10). A plain `<dialog>`: Esc and the close
 * button shut it and focus returns where it was. The words and the look are M9's; this is the working skeleton.
 */
export interface ProjectCard {
  open(p: Project): void;
  readonly isOpen: boolean;
}

export function createProjectCard(
  host: HTMLElement = document.body,
  /** Told when the card opens and closes: the journey's scroll stops behind an open card (M8.5, s24). */
  onOpenChange: (open: boolean) => void = () => undefined,
): ProjectCard {
  const dialog = document.createElement('dialog');
  dialog.className = 'card';
  dialog.setAttribute('aria-labelledby', 'card-title');
  // A click on the backdrop closes it, a click on the card's own padding does not (Modern Web Guidance,
  // light-dismiss-a-dialog): `closedby="any"` where supported, else a check that the click fell outside the card.
  dialog.setAttribute('closedby', 'any');
  if (!('closedBy' in HTMLDialogElement.prototype))
    dialog.addEventListener('click', (e) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      const inside = r.top <= e.clientY && e.clientY <= r.bottom && r.left <= e.clientX && e.clientX <= r.right;
      if (!inside) dialog.close();
    });
  // `close` fires however it shuts (Esc, the button, the backdrop)
  dialog.addEventListener('close', () => onOpenChange(false));
  host.append(dialog);
  return {
    open(p) {
      dialog.replaceChildren();
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'card__close';
      close.textContent = 'Close';
      close.addEventListener('click', () => dialog.close());
      const title = document.createElement('h2');
      title.id = 'card-title';
      title.textContent = p.title;
      if (p.aside) {
        const aside = document.createElement('em');
        aside.textContent = ` ${p.aside}`;
        title.append(aside);
      }
      const meta = document.createElement('p');
      meta.className = 'card__meta';
      meta.textContent = `${p.year} · ${p.kind}`;
      const summary = document.createElement('p');
      summary.textContent = p.summary;
      const links = document.createElement('p');
      links.className = 'card__links';
      for (const [label, href] of [
        ['Open it', p.links?.live],
        ['Source', p.links?.repo],
      ] as const) {
        if (!href) continue;
        const a = document.createElement('a');
        a.href = href;
        a.textContent = label;
        a.target = '_blank';
        a.rel = 'noopener';
        links.append(a);
      }
      dialog.append(close, title, meta, summary, links);
      dialog.showModal();
      onOpenChange(true);
    },
    get isOpen() {
      return dialog.open;
    },
  };
}
