import { describe, expect, it } from 'vitest';
import { canSwap, PASSAGES } from '../../src/journey/passages';
import type { FrameState } from '../../src/journey/timeline';
import { STOP_IDS } from '../../src/journey/types';

const base = { hourWeight: 0, skyWeight: 0, stillWeight: 0, fade: 0 };
const stop = (a: number): FrameState => ({ ...base, kind: 'stop', a, b: a, t: 0.5, resting: true });
const flight = (a: number, t: number, fade = 0): FrameState => ({
  ...base,
  kind: 'flight',
  a,
  b: a + 1,
  t,
  resting: false,
  fade,
});
const shown = { reducedMotion: false, firstShown: true, veil: 0, ownSetMissing: false };

describe('passages, where close-up sets swap', () => {
  it('every ride has one window inside (0.15, 0.85)', () => {
    for (let i = 0; i + 1 < STOP_IDS.length; i++) {
      const p = PASSAGES[`${STOP_IDS[i]}>${STOP_IDS[i + 1]}` as keyof typeof PASSAGES];
      expect(p).toBeDefined();
      expect(p!.from).toBeGreaterThan(0.15);
      expect(p!.to).toBeLessThan(0.85);
      expect(p!.to - p!.from).toBeGreaterThanOrEqual(0.1);
    }
  });

  it('a ride swaps inside its window only, either way', () => {
    const p = PASSAGES['midnight>beforedawn']!;
    expect(canSwap(flight(5, (p.from + p.to) / 2), shown)).toBe(true);
    expect(canSwap(flight(5, p.from - 0.05), shown)).toBe(false);
    expect(canSwap(flight(5, p.to + 0.05), shown)).toBe(false);
  });

  it('canSwap is false at a stop after the first view', () => {
    expect(canSwap(stop(6), shown)).toBe(false);
    expect(canSwap(stop(6), { ...shown, firstShown: false })).toBe(true);
  });

  it("reduced motion swaps at the fade's midpoint", () => {
    const rm = { ...shown, reducedMotion: true };
    expect(canSwap(flight(5, 0.5, 1), rm)).toBe(true);
    expect(canSwap(flight(5, 0.3, 0), rm)).toBe(false);
  });

  it('a jump swaps behind the fade', () => {
    expect(canSwap(stop(6), { ...shown, veil: 1 })).toBe(true);
    expect(canSwap(stop(6), { ...shown, veil: 0.5 })).toBe(false);
  });

  it('a place whose own set came late still gets it', () => {
    expect(canSwap(stop(6), { ...shown, ownSetMissing: true })).toBe(true);
  });
});
