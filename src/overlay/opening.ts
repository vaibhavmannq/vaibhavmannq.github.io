/** "Hello, voyager" stays up at least this long, measured from navigation start, so it can be read. */
export const MIN_HOLD_MS = 2200;

/** Milliseconds still to wait before the opening may leave on its own. Pure. */
export function holdRemaining(nowMs: number, minHoldMs = MIN_HOLD_MS): number {
  return Math.max(0, minHoldMs - nowMs);
}

export type OpeningStart = 'auto' | 'pointer' | 'key';

export interface OpeningOptions {
  /** Read at the moment of leaving, so a reduced-motion toggle during the greeting is honoured. */
  reducedMotion: () => boolean;
  /** Called once, as the opening starts to leave. */
  onStart: (how: OpeningStart) => void;
}

export interface Opening {
  /** The page is ready: leave after the hold, or at the first tap, scroll or key. */
  begin(options: OpeningOptions): void;
  /** Remove the opening at once, with no fade ("Skip intro" and the `?p` test hook). */
  dismiss(): void;
}

/**
 * The black "Hello, voyager" layer (journey-flow design §3). It only runs once the page is ready,
 * because there is nothing to reveal before that, and on a slow phone the greeting is simply the
 * loading screen for longer.
 */
export function createOpening(element: HTMLElement, settings: { minHoldMs?: number } = {}): Opening {
  const minHoldMs = settings.minHoldMs ?? MIN_HOLD_MS;
  let started = false;
  let timer = 0;

  const hide = () => {
    element.hidden = true;
  };

  return {
    begin({ reducedMotion, onStart }) {
      if (started) return;

      // Tab and Shift keep moving focus, and keys pressed on a link or button keep their own job, so
      // "Skip intro" and "Reduce motion" stay usable while the greeting is up.
      const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Tab' || event.key === 'Shift') return;
        if (event.target instanceof Element && event.target.closest('a, button')) return;
        start('key');
      };

      const start = (how: OpeningStart) => {
        if (started) return;
        started = true;
        window.clearTimeout(timer);
        window.removeEventListener('keydown', onKey);
        onStart(how);
        if (reducedMotion()) {
          hide();
          return;
        }
        // Hide once the layer's own fade ends. Its children fade too, and their events bubble here.
        element.addEventListener('transitionend', (event) => {
          if (event.target === element) hide();
        });
        element.classList.add('is-leaving');
      };

      timer = window.setTimeout(() => start('auto'), holdRemaining(performance.now(), minHoldMs));
      window.addEventListener('keydown', onKey);
      for (const type of ['pointerdown', 'wheel', 'touchstart'] as const) {
        window.addEventListener(type, () => start('pointer'), { once: true, passive: true });
      }
    },
    dismiss() {
      started = true;
      window.clearTimeout(timer);
      hide();
    },
  };
}
