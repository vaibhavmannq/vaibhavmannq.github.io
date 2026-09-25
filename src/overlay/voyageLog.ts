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
 * The voyage log at the top of the page: today's date and time, and the moon the scene shows now, which waxes as
 * the visitor travels (spec 2026-09-25 §4.11). `show` is called every frame and writes only when the words change.
 */
export function createVoyageLog(root: HTMLElement): { show(phase: number): void } {
  const when = root.querySelector('[data-log-when]');
  const moon = root.querySelector('[data-log-moon]');
  if (when === null || moon === null) throw new Error('#voyage-log is missing its parts');
  let phase = 0;
  let lastWhen = '';
  let lastMoon = '';
  const write = () => {
    const text = formatLog(new Date(), phase);
    if (text.when !== lastWhen) {
      when.textContent = text.when;
      lastWhen = text.when;
    }
    if (text.moon !== lastMoon) {
      moon.textContent = text.moon;
      lastMoon = text.moon;
    }
  };
  window.setInterval(write, 30_000);
  return {
    show(next) {
      phase = next;
      write();
    },
  };
}
