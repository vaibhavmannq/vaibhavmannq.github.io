import { illuminatedFraction, phaseName } from '../regions/moonsink/moonPhase';

export interface LogText {
  /** "26 Sept 2026 · 22:10", for a laptop. */
  when: string;
  /** "Waxing crescent · 6% lit", for a laptop. */
  moon: string;
  /** "22:10", for a phone. */
  time: string;
  /** "Crescent · 6%", for a phone: the storyboard's one-line phone header. */
  moonShort: string;
}

/** The voyage log's parts: when it is, and the moon the scene shows, long for a laptop and short for a phone. Pure. */
export function formatLog(now: Date, phase: number): LogText {
  const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const name = phaseName(phase);
  const lit = Math.round(illuminatedFraction(phase) * 100);
  const short = name.replace(/^(Waxing|Waning) (\w)/, (_, _side: string, first: string) => first.toUpperCase());
  return {
    when: `${date} · ${time}`,
    moon: `${name} · ${lit}% lit`,
    time,
    moonShort: `${short} · ${lit}%`,
  };
}

/**
 * The voyage log at the top of the page: today's date and time, and the moon the scene shows now, which waxes as
 * the visitor travels (spec 2026-09-25 §4.11). `show` is called every frame and writes only when the words change.
 */
export function createVoyageLog(root: HTMLElement): { show(phase: number): void } {
  const keys = ['when', 'moon', 'time', 'moonShort'] as const;
  const parts = keys.map((key) => {
    const element = root.querySelector(`[data-log-${key.replace('S', '-s')}]`);
    if (element === null) throw new Error(`#voyage-log is missing data-log-${key}`);
    return { key, element, last: '' };
  });
  let phase = 0;
  const write = () => {
    const text = formatLog(new Date(), phase);
    for (const part of parts) {
      if (text[part.key] === part.last) continue;
      part.element.textContent = text[part.key];
      part.last = text[part.key];
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
