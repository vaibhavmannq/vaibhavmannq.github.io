import { describe, expect, it } from 'vitest';
import { describePhase } from '../../src/overlay/moonDial';
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

  it('wraps at the end of the dial, where the new moon returns', () => {
    expect(phaseName(0.98)).toBe('New moon');
    expect(phaseName(1)).toBe('New moon');
  });
});

describe('describePhase', () => {
  it('adds how much of the disc is lit', () => {
    expect(describePhase(0.5)).toBe('Full moon, 100% lit');
    expect(describePhase(0.25)).toBe('First quarter, 50% lit');
    expect(describePhase(0)).toBe('New moon, 0% lit');
  });
});
