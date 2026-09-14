export type GateState = 'loading' | 'ready' | 'entered';

export interface Gate {
  readonly state: GateState;
  setReady(): void;
  enter(): void;
  onEnter(listener: () => void): void;
}

/**
 * The journey's entry state: loading → ready → entered. It has no visuals of its own. The opening
 * layer shows it through `data-state` on `root`, and `status` is a screen-reader-only message.
 * Content is never hidden from screen readers: sections stay in the DOM underneath.
 */
export function createGate(root: HTMLElement, status: HTMLElement): Gate {
  const listeners: Array<() => void> = [];
  let state: GateState = 'loading';

  const setState = (next: GateState) => {
    state = next;
    root.dataset.state = next;
  };

  const gate: Gate = {
    get state() {
      return state;
    },
    setReady() {
      if (state !== 'loading') return;
      setState('ready');
      status.textContent = '';
    },
    enter() {
      if (state === 'entered') return;
      setState('entered');
      status.textContent = '';
      document.documentElement.classList.remove('is-gated');
      for (const listener of listeners) listener();
    },
    onEnter(listener) {
      listeners.push(listener);
    },
  };
  return gate;
}
