/** "Hello, voyager" stays up at least this long, measured from navigation start, so it can be read. */
export const MIN_HOLD_MS = 2200;

/** Milliseconds still to wait before the opening may leave on its own. Pure. */
export function holdRemaining(nowMs: number, minHoldMs = MIN_HOLD_MS): number {
  return Math.max(0, minHoldMs - nowMs);
}

export type OpeningStart = 'auto' | 'pointer' | 'key';

/** Keys that never start the opening: they move focus, or belong to the browser or the system. */
const KEYS_THAT_DONT_START = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

/** The black lifts over 1.6 s after a 0.4 s delay; hide by then even if no transition event fires. */
const LEAVE_SAFETY_MS = 2300;

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
  let begun = false;
  let started = false;
  let timer = 0;

  const hide = () => {
    element.hidden = true;
  };

  return {
    begin({ reducedMotion, onStart }) {
      // A GPU context loss during the greeting can call begin() a second time: attach listeners once.
      if (begun || started) return;
      begun = true;

      // Tab, Shift and shortcuts such as Alt+Tab or Ctrl+L keep their normal job, and so do keys pressed
      // on a link or button, so "Skip intro" and "Reduce motion" stay usable while the greeting is up.
      const onKey = (event: KeyboardEvent) => {
        if (KEYS_THAT_DONT_START.has(event.key) || event.ctrlKey || event.metaKey || event.altKey) return;
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
        // Hide once the layer's own fade ends, or is cancelled by a reduced-motion switch mid-fade. Its
        // children fade too, and their events bubble here, so check the target. The timer covers a fade
        // that never runs, e.g. the system asks for reduced motion but the visitor chose full motion.
        const onFadeEnd = (event: TransitionEvent) => {
          if (event.target === element) hide();
        };
        element.addEventListener('transitionend', onFadeEnd);
        element.addEventListener('transitioncancel', onFadeEnd);
        element.classList.add('is-leaving');
        window.setTimeout(hide, LEAVE_SAFETY_MS);
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
