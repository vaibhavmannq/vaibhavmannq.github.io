import { describe, expect, it } from 'vitest';
import { parseStoredMotion, resolveReducedMotion } from '../../src/overlay/motionPreference';

describe('parseStoredMotion', () => {
  it('accepts only known values', () => {
    expect(parseStoredMotion('reduced')).toBe('reduced');
    expect(parseStoredMotion('full')).toBe('full');
    expect(parseStoredMotion('banana')).toBeNull();
    expect(parseStoredMotion(null)).toBeNull();
  });
});

describe('resolveReducedMotion', () => {
  it('follows the operating system when nothing is stored', () => {
    expect(resolveReducedMotion(true, null)).toBe(true);
    expect(resolveReducedMotion(false, null)).toBe(false);
  });

  it('lets the visitor override the operating system', () => {
    expect(resolveReducedMotion(true, 'full')).toBe(false);
    expect(resolveReducedMotion(false, 'reduced')).toBe(true);
  });
});
