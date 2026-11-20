import type { Sound } from './engine';

/** sessionStorage key: the visitor's choice lasts for the visit, never across visits (design §1). */
export const SOUND_KEY = 'sound';

const ICON_ON =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const ICON_OFF =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

const read = (): boolean => {
  try {
    return sessionStorage.getItem(SOUND_KEY) === 'on';
  } catch {
    return false;
  }
};
const write = (on: boolean) => {
  try {
    sessionStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {}
};

/**
 * The sound toggle (design §1): a small button always in view at the top right, off until pressed; a keyboard button
 * with `aria-pressed`. If sound was on earlier in this visit, a reload cannot start it by itself (browsers need a tap
 * or key), so it comes back on with the visitor's first tap or key press.
 */
export function mountSoundToggle(parent: HTMLElement, sound: Sound): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sound';
  button.id = 'sound';
  const show = (on: boolean) => {
    button.setAttribute('aria-pressed', String(on));
    button.innerHTML = `${on ? ICON_ON : ICON_OFF}<span>Sound ${on ? 'on' : 'off'}</span>`;
  };
  show(false);
  button.addEventListener('click', async () => {
    const on = await sound.toggle();
    write(on);
    show(on);
  });
  parent.append(button);

  if (read()) {
    const resume = async (e: Event) => {
      if (e.target instanceof Node && button.contains(e.target)) return; // the button's own click handles it
      window.removeEventListener('pointerdown', resume, true);
      window.removeEventListener('keydown', resume, true);
      if (!sound.on) show(await sound.toggle());
    };
    window.addEventListener('pointerdown', resume, true);
    window.addEventListener('keydown', resume, true);
  }
  return button;
}
