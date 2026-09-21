import { illuminatedFraction, phaseName } from '../regions/moonsink/moonPhase';

/** The voyage log's two parts: when it is, and the moon tonight. Pure. */
export function formatLog(now: Date, phase: number): { when: string; moon: string } {
  const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return {
    when: `${date} · ${time}`,
    moon: `${phaseName(phase)} · ${Math.round(illuminatedFraction(phase) * 100)}% lit`,
  };
}

/**
 * The voyage log at the top of the page (redesign, 2026-09-22): today's date and time, and tonight's
 * real moon, so every visit carries its own night. `phaseAt` returns the phase the scene shows.
 */
export function createVoyageLog(root: HTMLElement, phaseAt: (now: Date) => number): void {
  const when = root.querySelector('[data-log-when]');
  const moon = root.querySelector('[data-log-moon]');
  if (when === null || moon === null) throw new Error('#voyage-log is missing its parts');
  const write = () => {
    const now = new Date();
    const text = formatLog(now, phaseAt(now));
    when.textContent = text.when;
    moon.textContent = text.moon;
  };
  write();
  window.setInterval(write, 30_000);
}
