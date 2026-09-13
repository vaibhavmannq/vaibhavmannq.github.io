export type GateState = 'loading' | 'ready' | 'entered';

export interface Gate {
  readonly state: GateState;
  setStatus(message: string): void;
  setReady(): void;
  enter(): void;
  onEnter(listener: () => void): void;
}

/** The title screen. It never hides content from screen readers: sections stay in the DOM underneath. */
export function createGate(root: HTMLElement, button: HTMLButtonElement, status: HTMLElement): Gate {
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
    setStatus(message) {
      status.textContent = message;
    },
    setReady() {
      if (state !== 'loading') return;
      setState('ready');
      status.textContent = '';
      button.disabled = false;
    },
    enter() {
      if (state === 'entered') return;
      setState('entered');
      button.disabled = true;
      document.documentElement.classList.remove('is-gated');
      for (const listener of listeners) listener();
    },
    onEnter(listener) {
      listeners.push(listener);
    },
  };

  button.addEventListener('click', () => gate.enter());
  return gate;
}
