import { describe, expect, it } from 'vitest';
import { holdRemaining, MIN_HOLD_MS } from '../../src/overlay/opening';

describe('holdRemaining', () => {
  it('holds the greeting for 2.2 s by default', () => {
    expect(MIN_HOLD_MS).toBe(2200);
  });

  it('waits out the rest of the minimum hold', () => {
    expect(holdRemaining(0)).toBe(MIN_HOLD_MS);
    expect(holdRemaining(1200)).toBe(MIN_HOLD_MS - 1200);
  });

  it('is zero once the hold has passed, never negative', () => {
    expect(holdRemaining(MIN_HOLD_MS)).toBe(0);
    expect(holdRemaining(9000)).toBe(0);
  });

  it('honours a custom hold', () => {
    expect(holdRemaining(100, 600000)).toBe(599900);
  });
});
