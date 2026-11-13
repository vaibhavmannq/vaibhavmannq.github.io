import { rideMs, rideTarget } from '../journey/pace';
import { stopCentre, type Track } from '../journey/timeline';
import type { Stop } from '../journey/types';
import type { ScrollController } from '../scroll/scroll';

/** Keys that ride forward or back (Amendment 1 §7). Home and End stay native. */
const FORWARD = new Set(['ArrowDown', 'ArrowRight', 'PageDown']);
const BACK = new Set(['ArrowUp', 'ArrowLeft', 'PageUp']);

/** Focus in a text field keeps its keys; space presses a focused button or link. */
function ownsKeys(el: Element | null, key: string): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return true;
  return key === ' ' && ['BUTTON', 'A', 'SUMMARY'].includes(el.tagName);
}

function direction(event: KeyboardEvent): 1 | -1 | 0 {
  if (FORWARD.has(event.key) || (event.key === ' ' && !event.shiftKey)) return 1;
  if (BACK.has(event.key) || event.key === ' ') return -1;
  return 0;
}

/**
 * The ride (Amendment 1 §7): a "Next" button, and the arrow keys, Page Up/Down and space, play the flight to the next
 * place at its designed length, with no scrolling needed. The visitor's own wheel or touch stops it (scroll.ts).
 */
export function createRide(
  button: HTMLButtonElement,
  stops: readonly Stop[],
  track: Track,
  scroll: ScrollController,
  cameraU: () => number,
  enabled: () => boolean,
) {
  const label = button.querySelector('.ride__to') as HTMLElement;
  const go = (dir: 1 | -1) => {
    const from = cameraU();
    const to = rideTarget(track, from, dir);
    if (to === null) return;
    const toU = stopCentre(track, to);
    scroll.glideToProgress(toU / track.total, true, rideMs(track, from, toU));
  };
  button.addEventListener('click', () => go(1));
  window.addEventListener('keydown', (event) => {
    if (!enabled() || event.altKey || event.ctrlKey || event.metaKey) return;
    if (ownsKeys(document.activeElement, event.key)) return;
    const dir = direction(event);
    if (dir === 0) return;
    event.preventDefault();
    if (!event.repeat) go(dir);
  });

  let shownFor = -2;
  return {
    /** Each frame: name the next place; hide the button at the end of the night. */
    update(camU: number) {
      const next = rideTarget(track, camU, 1);
      const key = next ?? -1;
      if (key === shownFor) return;
      shownFor = key;
      button.hidden = next === null;
      const stop = next === null ? undefined : stops[next];
      if (!stop) return;
      label.textContent = stop.hour;
      button.setAttribute('aria-label', `Fly to the next place: ${stop.numeral}, ${stop.hour}, ${stop.place}`);
    },
  };
}
