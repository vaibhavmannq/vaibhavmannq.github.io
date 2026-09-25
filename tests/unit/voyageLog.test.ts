import { describe, expect, it } from 'vitest';
import { formatLog } from '../../src/overlay/voyageLog';
import { phaseName } from '../../src/regions/moonsink/moonPhase';

describe('phaseName', () => {
  it('names every stage of a whole cycle, waxing then waning', () => {
    expect(phaseName(0)).toBe('New moon');
    expect(phaseName(0.15)).toBe('Waxing crescent');
    expect(phaseName(0.25)).toBe('First quarter');
    expect(phaseName(0.35)).toBe('Waxing gibbous');
    expect(phaseName(0.5)).toBe('Full moon');
    expect(phaseName(0.6)).toBe('Waning gibbous');
    expect(phaseName(0.75)).toBe('Last quarter');
    expect(phaseName(0.9)).toBe('Waning crescent');
  });

  it('wraps at the end of the cycle, where the new moon returns', () => {
    expect(phaseName(0.98)).toBe('New moon');
    expect(phaseName(1)).toBe('New moon');
  });
});

describe('formatLog', () => {
  const night = new Date(2026, 8, 22, 0, 45);

  it('writes the date and the time', () => {
    const { when } = formatLog(night, 0.5);
    expect(when).toMatch(/^22 Sep\w* 2026 · 00:45$/);
  });

  it('names the moon and how much of it is lit', () => {
    expect(formatLog(night, 0.5).moon).toBe('Full moon · 100% lit');
    expect(formatLog(night, 0.25).moon).toBe('First quarter · 50% lit');
    expect(formatLog(night, 0).moon).toBe('New moon · 0% lit');
  });
});

describe('the log follows the journey moon', () => {
  it('names the crescent and the gibbous moon the journey passes through', () => {
    const night = new Date(2026, 8, 26, 22, 10);
    expect(formatLog(night, 0.08).moon).toBe('Waxing crescent · 6% lit');
    expect(formatLog(night, 0.375).moon).toBe('Waxing gibbous · 85% lit');
  });
});
