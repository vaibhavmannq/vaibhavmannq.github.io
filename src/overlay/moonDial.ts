import { illuminatedFraction, phaseName } from '../regions/moonsink/moonPhase';

/** What the dial says to a screen reader, e.g. "Waxing crescent, 16% lit". Pure. */
export function describePhase(phase: number): string {
  return `${phaseName(phase)}, ${Math.round(illuminatedFraction(phase) * 100)}% lit`;
}

/**
 * The moon-phase dial (owner request, 2026-09-14): scrubs the moon through a whole cycle, starting
 * from tonight's real phase. The choice is not stored, so every visit opens on tonight's moon.
 */
export function createMoonDial(input: HTMLInputElement, initialPhase: number, onChange: (phase: number) => void): void {
  const describe = (phase: number) => {
    const text = describePhase(phase);
    input.setAttribute('aria-valuetext', text);
    input.title = text;
  };

  input.value = String(initialPhase);
  describe(initialPhase);
  input.addEventListener('input', () => {
    const phase = Number(input.value);
    describe(phase);
    onChange(phase);
  });
}
