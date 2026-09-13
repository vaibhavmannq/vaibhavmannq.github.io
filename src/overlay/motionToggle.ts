import { MOTION_STORAGE_KEY, parseStoredMotion, resolveReducedMotion } from './motionPreference';

function readStored() {
  try {
    return parseStoredMotion(window.localStorage.getItem(MOTION_STORAGE_KEY));
  } catch {
    return null; // storage blocked (private mode): fall back to the system setting
  }
}

/** "Reduce motion" button: the visitor's choice wins over the OS setting and is remembered. */
export function createMotionToggle(
  button: HTMLButtonElement,
  onChange: (reduced: boolean) => void,
): { readonly reduced: boolean } {
  const system = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = resolveReducedMotion(system.matches, readStored());

  const apply = () => {
    button.setAttribute('aria-pressed', String(reduced));
    document.documentElement.classList.toggle('is-reduced-motion', reduced);
    onChange(reduced);
  };

  button.addEventListener('click', () => {
    reduced = !reduced;
    try {
      window.localStorage.setItem(MOTION_STORAGE_KEY, reduced ? 'reduced' : 'full');
    } catch {
      // storage blocked: the choice still applies for this visit
    }
    apply();
  });

  system.addEventListener('change', () => {
    if (readStored() !== null) return;
    reduced = system.matches;
    apply();
  });

  apply();
  return {
    get reduced() {
      return reduced;
    },
  };
}
